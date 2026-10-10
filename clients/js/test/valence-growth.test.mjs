/**
 * valence-growth.test.mjs -- live catalog growth (RFC-077, SPEC §6.4, §8.6):
 * a recorded lib/valence Hub transcript replayed into the session.
 *
 * The transcript comes from test/fixtures/gen_growth_transcript.cpp (build and
 * run command in its header): a join, a forget that withdraws a granted
 * channel, a transfer aborted by a second join, and a change outside the user
 * space. Each step's client frames must equal the recorded client's.
 *
 * Run:  node clients/js/test/valence-growth.test.mjs   (exits 1 on any failure)
 */

import { readFileSync } from 'node:fs';
import { cbUint, cbMap } from '../cbor.js';
import { K, FRAME, NACK, PRIORITY, LIMITS, encodeFrame } from '../frames.js';
import { BLOB_DONE_STATUS } from '../catalog.js';
import { createSession, SESSION_STATE } from '../session.js';
import { fromHex, catalogEtag } from '../sha256.js';

let failures = 0;
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name);
  if (!cond) { failures++; if (detail) console.log('        ' + detail); }
}
function same(name, actual, expected) {
  const ok = actual === expected;
  assert(name, ok, ok ? null : 'expected: ' + expected + '\n        actual:   ' + actual);
}

// ---- the transcript ---------------------------------------------------------
const steps = new Map();
let catalogV1 = null;
{
  let cur = null;
  const text = readFileSync(new URL('./fixtures/growth-transcript.txt', import.meta.url), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const [tag, val] = line.split(' ');
    if (tag === 'CATALOG') catalogV1 = fromHex(val);
    else if (tag === 'STEP') steps.set(val, cur = { h2c: [], c2h: [] });
    else if (tag === 'H2C' || tag === 'C2H') cur[tag.toLowerCase()].push(fromHex(val));
  }
}
const slice = (k, r) => 0x8000 + LIMITS.accessory_slice_ids * k + r;
const etagV1 = catalogEtag(catalogV1, LIMITS.etag_bytes);

// ---- a scripted WebSocket ----------------------------------------------------
class FakeWS {
  static last = null;
  constructor() { this.readyState = 0; this.sent = []; FakeWS.last = this; }
  send(b) { this.sent.push(new Uint8Array(b)); }
  close() { this.readyState = 3; if (this.onclose) this.onclose({ code: 1000 }); }
  open() { this.readyState = 1; this.onopen(); }
  deliver(f) { this.onmessage({ data: f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) }); }
  recv(type, payload, channel = 0) { this.deliver(encodeFrame(type, channel, payload, 0)); }
}
Date.now = () => 1_000_000; // frozen: the pump's PING and repeat cadences stay quiet

// The frames the recorded client sends; PING and CLOCK ride their own timers.
const RECORDED = new Set([FRAME.HELLO, FRAME.BLOB_REQ, FRAME.BLOB_DONE, FRAME.CATALOG_READY]);

function rig() {
  const saved = [];
  const events = { catalog: [], withdrawn: [], degraded: [] };
  const s = createSession({
    host: 'growth', clientKind: 'test', clientName: 'growth', deadmanWishMs: null, autoReconnect: false,
    instanceId: Uint8Array.from({ length: 8 }, (_, i) => 0x40 + i),
    subscriptions: [[0x0003, 0, PRIORITY.critical], [slice(0, 2), 10, PRIORITY.normal]],
    catalogStore: { load: () => ({ etag: etagV1, bytes: catalogV1 }), save: (h, e, b) => saved.push({ e, b }), clear() {} },
    WebSocketImpl: FakeWS,
  });
  s.on('catalog', (entries) => events.catalog.push(entries));
  s.on('withdrawn', (ch) => events.withdrawn.push(ch));
  s.on('degraded', (info) => events.degraded.push(info));
  s.connect();
  const ws = FakeWS.last;
  // Replays one step's hub frames; returns the client frames they provoked.
  const play = (name) => {
    const st = steps.get(name);
    const before = ws.sent.length;
    if (name === 'hello') ws.open();
    for (const f of st.h2c) ws.deliver(f);
    return ws.sent.slice(before).filter((b) => RECORDED.has(b[0]));
  };
  return { s, ws, saved, events, play };
}
const recorded = (name) => steps.get(name).c2h.map(hex).join(' ');
const ids = (entries) => new Set(entries.map((e) => e.id));

console.log('valence-js growth test (transcript from lib/valence via gen_growth_transcript.cpp):');

// ---- the replay ---------------------------------------------------------------
{
  const { s, saved, events, play } = rig();
  const phases = [];
  const step = (name) => {
    same(name + ': client frames == the recorded client\'s', play(name).map(hex).join(' '), recorded(name));
    phases.push(s.phase);
  };

  step('hello'); // the HELLO carries the catalog wish after the caller's own
  step('welcome');
  assert('welcome: LIVE on the cached catalog', s.phase === SESSION_STATE.LIVE && events.catalog.length === 1);

  step('join-announce');
  step('join-transfer');
  const joined = events.catalog.at(-1);
  assert('join: the grown catalog is adopted (acc1 appears, acc0 stays)',
    events.catalog.length === 2 && ids(joined).has(slice(1, 2)) && ids(joined).has(slice(0, 2)));
  assert('join: the verified catalog is cached under the new etag',
    saved.length === 1 && hex(saved[0].e) === hex(catalogEtag(saved[0].b, LIMITS.etag_bytes)) &&
    hex(saved[0].e) === hex(s.state.readyEtag));

  step('forget-announce');
  assert('forget: one withdrawn event for the granted acc0 level', events.withdrawn.join() === String(slice(0, 2)));
  assert('forget: its grant is gone, the others stay',
    !s.state.grants.has(slice(0, 2)) && s.state.grants.has(0x0003) && s.state.grants.has(0x0001));
  step('forget-partial');
  step('abort'); // CHUNK_UNAVAILABLE: the refetch restarts at once
  step('abort-transfer');
  const regrown = events.catalog.at(-1);
  assert('abort: the restarted refetch adopts the newest catalog (acc1 and acc2, no acc0)',
    events.catalog.length === 3 && ids(regrown).has(slice(2, 2)) && !ids(regrown).has(slice(0, 2)));

  step('resync-announce');
  step('resync-transfer');
  assert('resync: the new device entry is adopted', ids(events.catalog.at(-1)).has(0x00A0));
  step('resync-ready');
  assert('the session stayed LIVE through every step', phases.slice(1).every((p) => p === SESSION_STATE.LIVE),
    phases.join(' '));
  s.close();
}

// ---- NOT_READY while LIVE: a re-sync ---------------------------------------
const notReady = cbMap([[K.code, cbUint(NACK.NOT_READY)]]);
const safetyPush = steps.get('welcome').h2c.find((f) => f[0] === FRAME.STATE && f[2] === 0x03 && f[3] === 0x00);
{
  const { s, ws, play } = rig();
  play('hello');
  play('welcome');
  const before = ws.sent.length;
  ws.recv(FRAME.NACK, notReady);
  assert('NOT_READY while LIVE goes back to SYNCING', s.phase === SESSION_STATE.SYNCING && !s.state.ready);
  const ready = ws.sent.slice(before).filter((b) => b[0] === FRAME.CATALOG_READY);
  assert('...and declares the held etag again', ready.length === 1 && hex(ready[0].subarray(-8)) === hex(etagV1));
  ws.deliver(safetyPush);
  assert('the first STATE after it returns the session to LIVE', s.phase === SESSION_STATE.LIVE);
  s.close();
}
{
  const { s, ws, play } = rig();
  play('hello');
  play('welcome');
  play('join-announce');
  const before = ws.sent.length;
  ws.recv(FRAME.NACK, notReady);
  assert('NOT_READY mid-refetch: SYNCING, nothing declared yet',
    s.phase === SESSION_STATE.SYNCING && !ws.sent.slice(before).some((b) => b[0] === FRAME.CATALOG_READY));
  same('the refetch completes and declares the new etag', play('join-transfer').map(hex).join(' '), recorded('join-transfer'));
  assert('...still SYNCING until a STATE proves the gate reopened', s.phase === SESSION_STATE.SYNCING);
  ws.deliver(safetyPush);
  assert('...then LIVE', s.phase === SESSION_STATE.LIVE);
  s.close();
}

// ---- a grown catalog over the reassembly cap ---------------------------------
{
  const { s, ws, events, play } = rig();
  play('hello');
  play('welcome');
  play('join-announce');
  const total = 70000; // over the 65472-byte default cap
  const head = new Uint8Array(14 + LIMITS.catalog_chunk_payload);
  const dv = new DataView(head.buffer);
  dv.setUint16(6, 0, true);
  dv.setUint16(8, Math.ceil(total / LIMITS.catalog_chunk_payload), true);
  dv.setUint32(10, total, true);
  const before = ws.sent.length;
  ws.recv(FRAME.BLOB_CHUNK, head);
  const out = ws.sent.slice(before);
  assert('over the cap: no GOODBYE, the session stays LIVE',
    !out.some((b) => b[0] === FRAME.GOODBYE) && ws.readyState === 1 && s.phase === SESSION_STATE.LIVE);
  const done = out.filter((b) => b[0] === FRAME.BLOB_DONE);
  assert('...BLOB_DONE says aborted', done.length === 1 && done[0].at(-1) === BLOB_DONE_STATUS.ABORTED);
  assert('...and the app hears it as degraded',
    events.degraded.length === 1 && events.degraded[0].declaredTotalBytes === total);
  const quiet = ws.sent.length;
  play('join-transfer');
  play('join-announce');
  assert('the rest of that transfer is dropped and its etag is not asked for again',
    ws.sent.length === quiet && events.catalog.length === 1);
  s.close();
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall growth checks passed');
process.exit(failures ? 1 : 0);
