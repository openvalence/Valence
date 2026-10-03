/**
 * valence-blob.test.mjs -- STORE item fetch (BLOB namespace 1, §8.7): the
 * request, per-transfer reassembly, BLOB_DONE outcomes and the typed refusals.
 *
 * Golden bytes come from lib/valence's own C++ encoders via
 * test/fixtures/gen_blob_golden.cpp (build and run command in its header).
 *
 * Run:  node clients/js/test/valence-blob.test.mjs   (exits 1 on any failure)
 */

import { readFileSync } from 'node:fs';
import { cbUint, cbBstr, cbMap, cbArray } from '../cbor.js';
import { K, FRAME, NACK, WELCOME_LIMITS_K, encodeFrame, decodeFrameHeader } from '../frames.js';
import { createSession, BlobError, BLOB_ERROR, SESSION_STATE } from '../session.js';
import { fromHex, sha256 } from '../sha256.js';

let failures = 0;
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
function check(name, actual, expectedHex) {
  const ok = !!actual && hex(actual) === expectedHex;
  console.log('  [' + (ok ? 'PASS' : 'FAIL') + '] ' + name);
  if (!ok) { console.log('        expected: ' + expectedHex + '\n        actual:   ' + (actual ? hex(actual) : 'none')); failures++; }
}
function assert(name, cond) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name);
  if (!cond) failures++;
}

// ---- golden bytes (gen_blob_golden.cpp output) ------------------------------
const G = {
  BLOB_REQ_STORE_FRAME: '1A00000001000A00A11826A3010102020303',
  BLOB_REQ_STORE_REPAIR_FRAME: '1A00000002000E00A2181B81011826A3010102020303',
  BLOB_CHUNK: [
    '0102030007000000030090010000030A11181F262D343B424950575E656C737A81888F969DA4ABB2B9C0C7CED5DCE3EAF1F8FF060D141B222930373E454C535A61686F767D848B9299A0A7AEB5BCC3CAD1D8DFE6EDF4FB020910171E252C333A41484F565D646B727980878E959CA3AAB1B8BFC6CDD4DBE2E9F0F7FE050C131A21282F363D444B525960676E757C838A91989FA6ADB4BBC2C9D0D7DEE5ECF3FA01080F161D242B323940474E555C636A71787F868D949BA2A9B0B7BEC5CCD3DAE1E8EFF6FD040B121920272E353C',
    '0102030007000100030090010000434A51585F666D747B828990979EA5ACB3BAC1C8CFD6DDE4EBF2F900070E151C232A31383F464D545B626970777E858C939AA1A8AFB6BDC4CBD2D9E0E7EEF5FC030A11181F262D343B424950575E656C737A81888F969DA4ABB2B9C0C7CED5DCE3EAF1F8FF060D141B222930373E454C535A61686F767D848B9299A0A7AEB5BCC3CAD1D8DFE6EDF4FB020910171E252C333A41484F565D646B727980878E959CA3AAB1B8BFC6CDD4DBE2E9F0F7FE050C131A21282F363D444B525960676E757C',
    '0102030007000200030090010000838A91989FA6ADB4BBC2C9D0D7DEE5EC',
  ],
  BLOB_DONE_STORE_FRAME: [
    '200000000000070001020300070000',
    '200000000000070001020300070001',
    '200000000000070001020300070002',
  ],
};
const ITEM = Uint8Array.from({ length: 400 }, (_, i) => (i * 7 + 3) & 0xff);
const chunk = (i) => fromHex(G.BLOB_CHUNK[i]);

// ---- a scripted WebSocket and a fake clock ----------------------------------
class FakeWS {
  static last = null;
  constructor() { this.readyState = 0; this.sent = []; FakeWS.last = this; }
  send(b) { this.sent.push(new Uint8Array(b)); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  open() { this.readyState = 1; this.onopen(); }
  recv(type, payload, channel = 0, seq = 0) {
    const f = encodeFrame(type, channel, payload, seq);
    this.onmessage({ data: f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) });
  }
  framesOf(type) {
    return this.sent.filter((b) => b[0] === type).map((b) => ({ header: decodeFrameHeader(b), bytes: b }));
  }
}
let now = 1_000_000;
Date.now = () => now;
const pump = () => new Promise((r) => setTimeout(r, 70)); // one real 50 ms pump interval
const settle = (p) => p.then((v) => ({ v }), (e) => ({ e }));

const catBytes = new Uint8Array(readFileSync(new URL('./fixtures/valencesim-catalog.bin', import.meta.url)));
const etag = fromHex(readFileSync(new URL('./fixtures/valencesim-catalog.etag', import.meta.url), 'utf8').trim());

/** A LIVE session on the fixture catalog (store 1 trust ledger, store 2 presets). */
function liveSession() {
  const s = createSession({
    host: 'blob', autoReconnect: false, deadmanWishMs: null,
    catalogStore: { load: () => ({ etag, bytes: catBytes }), save() {}, clear() {} },
    WebSocketImpl: FakeWS,
  });
  s.connect();
  const ws = FakeWS.last;
  ws.open();
  ws.recv(FRAME.WELCOME, cbMap([
    [K.proto_ver, cbUint(1)], [K.session_id, cbUint(9)], [K.boot_id, cbUint(3)],
    [K.catalog_etag, cbBstr(etag)], [K.cfg_gen, cbUint(1)],
    [K.limits, cbMap([[WELCOME_LIMITS_K.max_frame, cbUint(512)], [WELCOME_LIMITS_K.retained_pending, cbUint(0)]])],
    [K.roles, cbUint(1)], [K.deadman_ms, cbUint(2000)], [K.grants, cbArray([])],
  ]));
  return { s, ws };
}
const doneFrames = (ws) => ws.framesOf(FRAME.BLOB_DONE).map((f) => f.bytes);

console.log('valence-js blob test (golden bytes from lib/valence via gen_blob_golden.cpp):');

// ---- request bytes, out-of-order reassembly, gap repair, status 0 -----------
{
  const { s, ws } = liveSession();
  assert('fixture session is LIVE', s.phase === SESSION_STATE.LIVE);
  const p = settle(s.fetchBlob({ storeId: 2, slot: 3 }));
  check('BLOB_REQ ns=1 store=2 slot=3 == C++ encodeBlobReq', ws.framesOf(FRAME.BLOB_REQ)[0]?.bytes, G.BLOB_REQ_STORE_FRAME);

  ws.recv(FRAME.BLOB_CHUNK, chunk(2));
  ws.recv(FRAME.BLOB_CHUNK, fromHex(G.BLOB_CHUNK[0].replace(/^010203/, '010204'))); // slot 4: not ours
  ws.recv(FRAME.BLOB_CHUNK, chunk(0));
  now += 600; // past catalog_chunk_gap_timeout_ms with chunk 1 missing
  await pump();
  check('gap repair names chunk 1 only == C++ encodeBlobReq (seq 2)', ws.framesOf(FRAME.BLOB_REQ)[1]?.bytes, G.BLOB_REQ_STORE_REPAIR_FRAME);
  ws.recv(FRAME.BLOB_CHUNK, chunk(1));
  const { v, e } = await p;
  assert('resolves out-of-order chunks to the exact 400 item bytes', !e && hex(v.bytes) === hex(ITEM));
  assert('identity carried back (ns 1, store 2, slot 3, generation 7)',
    v && v.ns === 1 && v.storeId === 2 && v.slot === 3 && v.generation === 7);
  check('BLOB_DONE status 0 == C++ encodeBlobDone', doneFrames(ws)[0], G.BLOB_DONE_STORE_FRAME[0]);
  assert('exactly one BLOB_DONE', doneFrames(ws).length === 1);
  s.close();
}

// ---- expectDigest: match -> 0, mismatch -> 1 --------------------------------
{
  const { s, ws } = liveSession();
  const good = settle(s.fetchBlob({ storeId: 2, slot: 3, expectDigest: sha256(ITEM).subarray(0, 8) }));
  for (const i of [0, 1, 2]) ws.recv(FRAME.BLOB_CHUNK, chunk(i));
  assert('matching expectDigest resolves', !(await good).e);
  const bad = settle(s.fetchBlob({ storeId: 2, slot: 3, expectDigest: new Uint8Array(8) }));
  await pump();
  for (const i of [0, 1, 2]) ws.recv(FRAME.BLOB_CHUNK, chunk(i));
  const { e } = await bad;
  assert('mismatch rejects HASH_MISMATCH with the bytes attached',
    e instanceof BlobError && e.code === BLOB_ERROR.HASH_MISMATCH && hex(e.bytes) === hex(ITEM));
  check('BLOB_DONE status 1 == C++ encodeBlobDone', doneFrames(ws)[1], G.BLOB_DONE_STORE_FRAME[1]);
  s.close();
}

// ---- abort: AbortSignal -> status 2; timeout -> status 2 --------------------
{
  const { s, ws } = liveSession();
  const ac = new AbortController();
  const p = settle(s.fetchBlob({ storeId: 2, slot: 3, signal: ac.signal }));
  ws.recv(FRAME.BLOB_CHUNK, chunk(0));
  ac.abort();
  const { e } = await p;
  assert('AbortSignal rejects ABORTED', e instanceof BlobError && e.code === BLOB_ERROR.ABORTED);
  check('BLOB_DONE status 2 == C++ encodeBlobDone', doneFrames(ws)[0], G.BLOB_DONE_STORE_FRAME[2]);
  ws.recv(FRAME.BLOB_CHUNK, chunk(1)); // late chunk of the aborted transfer
  assert('late chunks after abort are dropped, no second BLOB_DONE', doneFrames(ws).length === 1);

  const t = settle(s.fetchBlob({ storeId: 2, slot: 3 }));
  ws.recv(FRAME.BLOB_CHUNK, chunk(0));
  now += 5000;
  await pump();
  const r = await t;
  assert('no completion within frag_reassembly_timeout_ms rejects TIMEOUT',
    r.e instanceof BlobError && r.e.code === BLOB_ERROR.TIMEOUT);
  check('timeout sends BLOB_DONE status 2', doneFrames(ws)[1], G.BLOB_DONE_STORE_FRAME[2]);
  s.close();
}

// ---- refusals, NACKs, queueing, catalog supersede, close --------------------
{
  const { s, ws } = liveSession();
  const code = async (p) => { const { e } = await settle(p); return e instanceof BlobError ? e.code : 'resolved'; };
  assert('store 9 not in the catalog -> UNKNOWN_STORE', await code(s.fetchBlob({ storeId: 9, slot: 0 })) === BLOB_ERROR.UNKNOWN_STORE);
  assert('ns 0 -> BAD_REQUEST', await code(s.fetchBlob({ ns: 0, storeId: 2, slot: 0 })) === BLOB_ERROR.BAD_REQUEST);
  assert('slot 256 -> BAD_REQUEST', await code(s.fetchBlob({ storeId: 2, slot: 256 })) === BLOB_ERROR.BAD_REQUEST);
  assert('refusals put nothing on the wire', ws.framesOf(FRAME.BLOB_REQ).length === 0);

  const a = settle(s.fetchBlob({ storeId: 2, slot: 0 }));
  const b = settle(s.fetchBlob({ storeId: 1, slot: 0 }));
  assert('two fetches, one BLOB_REQ on the wire', ws.framesOf(FRAME.BLOB_REQ).length === 1);
  const seqA = ws.framesOf(FRAME.BLOB_REQ)[0].header.seq;
  ws.recv(FRAME.NACK, cbMap([[K.code, cbUint(NACK.CHUNK_UNAVAILABLE)], [K.intent_seq, cbUint(seqA)]]));
  const ra = await a;
  assert('NACK CHUNK_UNAVAILABLE (by intent_seq) -> UNAVAILABLE, no BLOB_DONE',
    ra.e && ra.e.code === BLOB_ERROR.UNAVAILABLE && doneFrames(ws).length === 0);
  assert('the queued fetch goes out once the head concludes', ws.framesOf(FRAME.BLOB_REQ).length === 2);
  const seqB = ws.framesOf(FRAME.BLOB_REQ)[1].header.seq;
  ws.recv(FRAME.NACK, cbMap([[K.channel_id, cbUint(0x000c)], [K.code, cbUint(NACK.ACCESS_DENIED)], [K.intent_seq, cbUint(seqB)]]));
  const rb = await b;
  assert('NACK ACCESS_DENIED -> REFUSED with the nack attached',
    rb.e && rb.e.code === BLOB_ERROR.REFUSED && rb.e.nack.name === 'ACCESS_DENIED');

  const c = settle(s.fetchBlob({ storeId: 2, slot: 3 }));
  s.requestCatalog();
  const rc = await c;
  assert('a catalog transfer supersedes the store fetch -> ABORTED', rc.e && rc.e.code === BLOB_ERROR.ABORTED);
  const d = settle(s.fetchBlob({ storeId: 2, slot: 3 }));
  const reqs = ws.framesOf(FRAME.BLOB_REQ).length;
  await pump();
  assert('no store BLOB_REQ while the catalog transfer is in flight', ws.framesOf(FRAME.BLOB_REQ).length === reqs);
  s.close();
  const rd = await d;
  assert('socket close rejects a queued fetch ABORTED', rd.e && rd.e.code === BLOB_ERROR.ABORTED);
}

// ---- RFC-077: a catalog transfer the hub aborts starts over, a bounded number of times
{
  const { s, ws } = liveSession();
  const reqs = () => ws.framesOf(FRAME.BLOB_REQ).length;
  const abort = () => ws.recv(FRAME.NACK, cbMap([[K.code, cbUint(NACK.CHUNK_UNAVAILABLE)], [K.intent_seq, cbUint(0)]]));
  s.requestCatalog();
  assert('catalog BLOB_REQ on the wire', reqs() === 1);
  abort();
  assert('the etag moved under the transfer: it is requested again', reqs() === 2);
  abort();
  abort();
  assert('each abort restarts it while the budget lasts', reqs() === 4);
  abort();
  assert('a fourth abort is not chased', reqs() === 4);
  s.close();
}

console.log(failures ? failures + ' FAILED' : 'all passed');
process.exit(failures ? 1 : 0);
