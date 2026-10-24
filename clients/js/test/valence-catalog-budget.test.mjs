/**
 * valence-catalog-budget.test.mjs -- RFC-121 on the JS client: WELCOME identity
 * key 7 (config_mode) and the catalog budget at limits::catalog_max_bytes
 * (SPEC §8.1): a catalog of that size reassembles through a session, a late
 * duplicate chunk after completion is dropped, an override still refuses.
 *
 * Run:  node clients/js/test/valence-catalog-budget.test.mjs   (exits 1 on any failure)
 */

import { cbUint, cbBstr, cbTstr, cbBool, cbMap } from '../cbor.js';
import { K, FRAME, IDENTITY_K, LIMITS, encodeFrame } from '../frames.js';
import { BlobReassembler, BLOB_DONE_STATUS, BLOB_CHUNK_PAYLOAD } from '../catalog.js';
import { createSession, SESSION_STATE } from '../session.js';
import { catalogEtag } from '../sha256.js';

let failures = 0;
function assert(name, cond) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name);
  if (!cond) failures++;
}

class FakeWS {
  static last = null;
  constructor() { this.readyState = 0; this.sent = []; FakeWS.last = this; }
  send(b) { this.sent.push(new Uint8Array(b)); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  open() { this.readyState = 1; this.onopen(); }
  recv(type, payload, channel = 0) {
    const f = encodeFrame(type, channel, payload, 0);
    this.onmessage({ data: f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) });
  }
}
Date.now = () => 1_000_000; // frozen: no gap or timeout fires mid-test

function chunkPayload(index, count, total, body) {
  const out = new Uint8Array(14 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint16(6, index, true);
  dv.setUint16(8, count, true);
  dv.setUint32(10, total, true);
  out.set(body, 14);
  return out;
}

// Largest legal catalog shape: 256 entries of 4,095 B (catalog_max_entries x
// catalog_max_entry_bytes less one), padded through an unknown key (§4.3).
function bigCatalog() {
  const entry = (i, pad) => cbMap([[1, cbUint(0x3000 + i)], [2, cbTstr('c' + i)], [3, cbUint(0)], [99, cbBstr(new Uint8Array(pad))]]);
  const base = entry(0, 0).length;
  // bstr header is 3 B for 256..65535 B payloads
  const pad = 4095 - base - 3;
  const parts = [Uint8Array.of(0x99, 0x01, 0x00)];
  for (let i = 0; i < LIMITS.catalog_max_entries; i++) parts.push(entry(i, pad));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function welcome(ws, idmap, etag) {
  const fields = [[K.proto_ver, cbUint(1)], [K.session_id, cbUint(1)], [K.boot_id, cbUint(1)]];
  if (etag) fields.push([K.catalog_etag, cbBstr(etag)]);
  fields.push([K.cfg_gen, cbUint(1)]);
  if (idmap) fields.push([K.identity, cbMap(idmap)]);
  ws.recv(FRAME.WELCOME, cbMap(fields));
}
const memStore = () => ({ saved: [], load: () => null, save(h, e, b) { this.saved.push({ e, b }); }, clear() {} });
const open = (host, store) => {
  const s = createSession({ host, autoReconnect: false, deadmanWishMs: null, catalogStore: store, WebSocketImpl: FakeWS });
  s.connect();
  const ws = FakeWS.last;
  ws.open();
  return { s, ws };
};

console.log('valence-js catalog budget + config_mode (RFC-121):');

// ---- WELCOME identity key 7 -------------------------------------------------
{
  const cases = [
    ['key 7 true', [[IDENTITY_K.product, cbTstr('t')], [IDENTITY_K.config_mode, cbBool(true)]], true],
    ['key 7 false', [[IDENTITY_K.product, cbTstr('t')], [IDENTITY_K.config_mode, cbBool(false)]], false],
    ['key 7 absent', [[IDENTITY_K.product, cbTstr('t')]], false],
  ];
  for (const [name, idmap, want] of cases) {
    const { s, ws } = open('id-' + name, memStore());
    welcome(ws, idmap, null);
    assert('WELCOME ' + name + ' -> identity.config_mode ' + want, s.state.identity.config_mode === want);
    s.close();
  }
  const { s, ws } = open('no-identity', memStore());
  welcome(ws, null, null);
  assert('WELCOME without an identity map -> identity null', s.state.identity === null);
  s.close();
}

// ---- budget default and override --------------------------------------------
{
  const def = new BlobReassembler();
  assert('default budget is limits::catalog_max_bytes (1 MiB)', def.maxTotalBytes === 1048576 && LIMITS.catalog_max_bytes === 1048576);
  const hdr = (total) => ({ ns: 0, storeId: 0, slot: 0, chunkCount: Math.ceil(total / BLOB_CHUNK_PAYLOAD), totalBytes: total });
  assert('1 MiB accepted, 1 MiB + 1 refused', def.begin(hdr(1048576), 0) === true && def.begin(hdr(1048577), 0) === false);
  const small = new BlobReassembler(4096);
  assert('an explicit budget still overrides and refuses', small.begin(hdr(4096), 0) === true && small.begin(hdr(4097), 0) === false);
}

// ---- a 1 MiB catalog through a session, in reverse order, then a late duplicate
{
  const catalog = bigCatalog();
  const total = catalog.length;
  const count = Math.ceil(total / BLOB_CHUNK_PAYLOAD);
  assert('fixture is a ~1 MiB catalog over 5,000 chunks', total > 1040000 && total <= LIMITS.catalog_max_bytes && count > 5000);
  const etag = catalogEtag(catalog, LIMITS.etag_bytes);
  const store = memStore();
  const { s, ws } = open('big', store);
  let adopted = 0;
  let errors = 0;
  s.on('catalog', (entries) => { adopted = entries.length; });
  s.on('error', () => { errors++; });
  welcome(ws, [[IDENTITY_K.config_mode, cbBool(true)]], etag);
  const chunk = (i) => chunkPayload(i, count, total, catalog.subarray(i * BLOB_CHUNK_PAYLOAD, Math.min(total, (i + 1) * BLOB_CHUNK_PAYLOAD)));
  const t0 = performance.now();
  for (let i = count - 1; i >= 0; i--) ws.recv(FRAME.BLOB_CHUNK, chunk(i));
  const ms = performance.now() - t0;
  const done = ws.sent.filter((b) => b[0] === FRAME.BLOB_DONE);
  assert('transfer completes: one BLOB_DONE, verified complete',
    done.length === 1 && done[0].at(-1) === BLOB_DONE_STATUS.VERIFIED_COMPLETE);
  assert('no GOODBYE, no error event', !ws.sent.some((b) => b[0] === FRAME.GOODBYE) && errors === 0);
  assert('all 256 entries adopted and the verified catalog cached byte-exact',
    adopted === 256 && store.saved.length === 1 && store.saved[0].b.length === total);
  assert('reassembly of ' + count + ' chunks is linear (< 2 s, took ' + Math.round(ms) + ' ms)', ms < 2000);

  const sentBefore = ws.sent.length;
  ws.recv(FRAME.BLOB_CHUNK, chunk(count - 1));
  ws.recv(FRAME.BLOB_CHUNK, chunk(0));
  assert('late duplicate chunks after completion are dropped: nothing sent, no second adoption, no second save',
    ws.sent.length === sentBefore && store.saved.length === 1 && s.phase !== SESSION_STATE.CLOSED);
  s.close();
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall catalog budget checks passed');
process.exit(failures ? 1 : 0);
