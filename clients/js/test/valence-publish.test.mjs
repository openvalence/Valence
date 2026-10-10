/**
 * valence-publish.test.mjs -- c2h STREAM publishing: publish wishes, grant
 * tracking, the bundle sender, and its refusals; plus the session-layer
 * decodes that ride the same scripted socket (WELCOME identity/limits, the
 * safety snapshot, admission refusals).
 *
 * Golden bytes come from lib/valence's own C++ encoders via
 * test/fixtures/gen_publish_golden.cpp (build and run command in its header).
 * spec/vectors carries no STREAM or publish vector files yet (manifest D-04,
 * P-01..P-04 are ids without bytes), so the reference encoder is the oracle.
 *
 * Run:  node clients/js/test/valence-publish.test.mjs   (exits 1 on any failure)
 */

import { readFileSync } from 'node:fs';
import { cbUint, cbF32, cbBstr, cbBool, cbTstr, cbMap, cbArray } from '../cbor.js';
import {
  K, FRAME, NACK, IDENTITY_K, WELCOME_LIMITS_K, CH_SAFETY,
  encodeFrame, encodeBundle, decodeFrameHeader, decodeSafetySnapshot,
} from '../frames.js';
import { encodePacked } from '../catalog.js';
import { createSession, PublishError, PUBLISH_ERROR, SESSION_STATE } from '../session.js';
import { fromHex } from '../sha256.js';

let failures = 0;
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
function check(name, actual, expectedHex) {
  const ok = hex(actual) === expectedHex;
  console.log('  [' + (ok ? 'PASS' : 'FAIL') + '] ' + name);
  if (!ok) { console.log('        expected: ' + expectedHex + '\n        actual:   ' + hex(actual)); failures++; }
}
function assert(name, cond) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name);
  if (!cond) failures++;
}
function refusal(name, fn, code) {
  let got = null;
  try { fn(); } catch (e) { got = e; }
  assert(name + ' -> ' + code, got instanceof PublishError && got.code === code);
  if (got && !(got instanceof PublishError && got.code === code)) console.log('        got: ' + got.message);
}

// ---- golden bytes (gen_publish_golden.cpp output) ---------------------------
const G = {
  HELLO_FRAME: '0000000000004700A601010264746573740366676F6C64656E044801020304050607080A81A30CFA000000000D010F010B82A20CFA424800000F192100A30CFA41A000000F192101182AFA42200000',
  PUBLISH_FRAME: '1800000000001500A10B81A30CFA41A000000F192101182AFA42200000',
  GRANT_PUBLISH_PAYLOAD: 'A2182380182481A30EFA41A000000F192101182AFA42200000',
  GRANT_EMPTY_PAYLOAD: 'A2182380182480',
  WELCOME_PAYLOAD: 'AC0101061A01020304071A0A0B0C0D08480000000000000000090716A3010002000300170118181907D0181900181D480000000000000000182380182481A20EFA424800000F192100',
  STREAM_SAMPLES_FRAME: '0C0000210700120078563412020000001027881306FF4C1D7D00',
  STREAM_SEGMENT_FRAME: '0C000121FFFF0E0000FFFFFF01000000C40978000CFE',
};

// Layouts shaped like the reference device's 0x2100 / 0x2101 (the generator's).
const U16 = 2, I16 = 3;
const INPUT_LAYOUT = [
  { name: 'target_norm', type: U16, typeName: 'u16', scale: 10000 },
  { name: 'vel_norm', type: I16, typeName: 'i16', scale: 1000 },
];
const SEG_LAYOUT = [
  { name: 'target_norm', type: U16, typeName: 'u16', scale: 10000 },
  { name: 'duration_ms', type: U16, typeName: 'u16', scale: 1 },
  { name: 'end_vel_norm', type: I16, typeName: 'i16', scale: 1000 },
];

console.log('valence-js publish test (golden bytes from lib/valence via gen_publish_golden.cpp):');

// ---- pure encoders ----------------------------------------------------------
check('STREAM samples frame == C++ BundleWriter + packField',
  encodeFrame(FRAME.STREAM, 0x2100, encodeBundle(0x12345678, [0, 10000], [
    encodePacked({ target_norm: 0.5, vel_norm: -0.25 }, INPUT_LAYOUT),
    encodePacked({ target_norm: 0.75, vel_norm: 0.125 }, INPUT_LAYOUT),
  ]), 7), G.STREAM_SAMPLES_FRAME);
check('STREAM segment frame == C++ (t_base near the u32 wrap, seq 0xFFFF)',
  encodeFrame(FRAME.STREAM, 0x2101, encodeBundle(0xFFFFFF00, [0], [
    encodePacked({ target_norm: 0.25, duration_ms: 120, end_vel_norm: -0.5 }, SEG_LAYOUT),
  ]), 0xffff), G.STREAM_SEGMENT_FRAME);
const s4 = encodePacked({ target_norm: 0, vel_norm: 0 }, INPUT_LAYOUT);
const throws = (fn) => { try { fn(); return false; } catch (e) { return true; } };
assert('bundle: 33 samples rejected', throws(() => encodeBundle(0, [...Array(33).keys()], Array(33).fill(s4))));
assert('bundle: 21 ms span rejected', throws(() => encodeBundle(0, [0, 21000], [s4, s4])));
assert('bundle: t_off[0] != 0 rejected', throws(() => encodeBundle(0, [5], [s4])));
assert('bundle: repeated t_off rejected', throws(() => encodeBundle(0, [0, 100, 100], [s4, s4, s4])));
assert('bundle: exactly 20 ms span accepted', !throws(() => encodeBundle(0, [0, 20000], [s4, s4])));
// RFC-087 t_off units, against hand-built bundles (t_base 0x01020304):
//   samples  [0, 5000 us]          -> t_off 0x0000, 0x1388 (1 us units)
//   segments [0, 120 ms, 240 ms]   -> t_off 0x0000, 0x04B0, 0x0960 (100 us units)
const segA = encodePacked({ target_norm: 0.25, duration_ms: 120, end_vel_norm: 0 }, SEG_LAYOUT);
check('samples bundle: t_off in 1 us units',
  encodeBundle(0x01020304, [0, 5000], [s4, s4]), '0403020102000000881300000000' + '00000000');
check('segments bundle: t_off in 100 us units, spanning 240 ms under a 250 ms horizon',
  encodeBundle(0x01020304, [0, 120000, 240000], [segA, segA, segA], { unitUs: 100, spanCapUs: 250000 }),
  '040302010300' + '0000B0046009' + 'C40978000000'.repeat(3));
assert('segments bundle: 260 ms span refused at a 250 ms horizon',
  throws(() => encodeBundle(0, [0, 260000], [segA, segA], { unitUs: 100, spanCapUs: 250000 })));
assert('segments bundle: an offset off the 100 us grid refused',
  throws(() => encodeBundle(0, [0, 120050], [segA, segA], { unitUs: 100, spanCapUs: 250000 })));
assert('packed: out-of-range u16 refused, never wrapped', throws(() => encodePacked({ target_norm: 7, vel_norm: 0 }, INPUT_LAYOUT)));
assert('packed: missing field refused', throws(() => encodePacked({ target_norm: 0.5 }, INPUT_LAYOUT)));

// ---- a scripted WebSocket ---------------------------------------------------
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
const memStore = (cat) => ({ load: () => cat, save() {}, clear() {} });
const tick = () => new Promise((r) => setTimeout(r, 0));

// ---- HELLO publish wishes: byte-exact against encodeHello -------------------
{
  const s = createSession({
    host: 't1', clientKind: 'test', clientName: 'golden', deadmanWishMs: null,
    instanceId: Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8), autoReconnect: false,
    publishes: [[0x2100, 50], [0x2101, 20, 40]],
    catalogStore: memStore(null), WebSocketImpl: FakeWS,
  });
  s.connect();
  FakeWS.last.open();
  check('HELLO with publish wishes (plain + burst) and the catalog wish == C++ encodeHello', FakeWS.last.sent[0], G.HELLO_FRAME);

  // WELCOME from the C++ encoder: granted_publishes (36) adopted.
  let evt = null;
  s.on('publishGrant', (g) => { evt = g; });
  FakeWS.last.recv(FRAME.WELCOME, fromHex(G.WELCOME_PAYLOAD));
  const gp = s.state.grantedPublishes.get(0x2100);
  assert('WELCOME granted_publishes -> state.grantedPublishes (0x2100 @ 50 Hz, no burst)',
    !!gp && gp.rate === 50 && gp.burst === null);
  assert('WELCOME grant emits publishGrant', Array.isArray(evt) && evt.length === 1);

  // PUBLISH: byte-exact, and the C++ GRANT answer resolves it.
  const p = s.publish([[0x2101, 20, 40]]);
  check('PUBLISH frame == C++ encodePublish', FakeWS.last.framesOf(FRAME.PUBLISH)[0].bytes, G.PUBLISH_FRAME);
  FakeWS.last.recv(FRAME.GRANT, fromHex(G.GRANT_PUBLISH_PAYLOAD));
  const res = await p;
  assert('PUBLISH resolves with the applied grant (rate 20, burst 40)',
    res.length === 1 && res[0].rate === 20 && res[0].burst === 40);

  // A PUBLISH answered by the reference hub's empty GRANT: nothing granted.
  const drop = s.publish([[0x2101, 0]]);
  FakeWS.last.recv(FRAME.GRANT, fromHex(G.GRANT_EMPTY_PAYLOAD));
  const dropped = await drop;
  assert('empty GRANT answers the PUBLISH and the channel is no longer granted',
    dropped.length === 0 && !s.state.grantedPublishes.has(0x2101) && s.state.grantedPublishes.has(0x2100));
  s.close();
}

// ---- the sender, against the real device catalog fixture --------------------
{
  const catBytes = new Uint8Array(readFileSync(new URL('./fixtures/valencesim-catalog.bin', import.meta.url)));
  const etag = fromHex(readFileSync(new URL('./fixtures/valencesim-catalog.etag', import.meta.url), 'utf8').trim());
  const s = createSession({
    host: 't2', autoReconnect: false, deadmanWishMs: null,
    catalogStore: memStore({ etag, bytes: catBytes }), WebSocketImpl: FakeWS,
  });
  s.connect();
  const ws = FakeWS.last;
  ws.open();
  refusal('before WELCOME', () => s.publishSamples(0x2100, { target_norm: 0.5, vel_norm: 0 }), PUBLISH_ERROR.NOT_LIVE);

  const welcome = cbMap([
    [K.proto_ver, cbUint(1)], [K.session_id, cbUint(9)], [K.boot_id, cbUint(3)],
    [K.catalog_etag, cbBstr(etag)], [K.cfg_gen, cbUint(1)],
    [K.limits, cbMap([[WELCOME_LIMITS_K.max_frame, cbUint(512)], [WELCOME_LIMITS_K.retained_pending, cbUint(0)]])],
    [K.roles, cbUint(1)], [K.deadman_ms, cbUint(2000)],
    [K.grants, cbArray([])],
    [K.granted_publishes, cbArray([cbMap([[K.granted_rate_hz, cbF32(50)], [K.channel_id, cbUint(0x2100)]])])],
  ]);
  ws.recv(FRAME.WELCOME, welcome);
  assert('cached catalog + zero retained -> LIVE', s.phase === SESSION_STATE.LIVE);

  const one = { target_norm: 0.5, vel_norm: 0 };
  refusal('before the CLOCK reply', () => s.publishSamples(0x2100, one), PUBLISH_ERROR.NO_CLOCK);
  const clockOut = ws.framesOf(FRAME.CLOCK)[0].bytes;
  const t0 = new DataView(clockOut.buffer, clockOut.byteOffset + 8).getUint32(0, true);
  const reply = new Uint8Array(12);
  const rdv = new DataView(reply.buffer);
  rdv.setUint32(0, t0, true); rdv.setUint32(4, (t0 + 5000000) >>> 0, true); rdv.setUint32(8, (t0 + 5000000) >>> 0, true);
  ws.recv(FRAME.CLOCK, reply);
  assert('CLOCK reply marks the session clock synced', s.state.clockSynced === true);

  refusal('ungranted channel', () => s.publishSegment(0x2101, { target_norm: 0.5, duration_ms: 100, end_vel_norm: 0 }), PUBLISH_ERROR.NOT_GRANTED);
  refusal('segment on a samples channel', () => s.publishSegment(0x2100, { target_norm: 0.5, duration_ms: 100, end_vel_norm: 0 }), PUBLISH_ERROR.WRONG_STREAM_KIND);
  refusal('STATE channel', () => s.publishSamples(0x1100, one), PUBLISH_ERROR.NOT_PUBLISHABLE);
  refusal('unknown channel', () => s.publishSamples(0x7777, one), PUBLISH_ERROR.UNKNOWN_CHANNEL);
  refusal('missing layout field', () => s.publishSamples(0x2100, { target_norm: 0.5 }), PUBLISH_ERROR.BAD_SAMPLE);
  refusal('target outside u16 after scale', () => s.publishSamples(0x2100, { target_norm: 9, vel_norm: 0 }), PUBLISH_ERROR.BAD_SAMPLE);
  refusal('span over 20 ms', () => s.publishSamples(0x2100, [one, one], { periodUs: 25000 }), PUBLISH_ERROR.BAD_BUNDLE);
  assert('refusals put nothing on the wire', ws.framesOf(FRAME.STREAM).length === 0);

  // Sequence continuity: per channel, from 0, one per bundle that went out.
  const seqs = [0, 1, 2].map(() => s.publishSamples(0x2100, one).seq);
  const out = ws.framesOf(FRAME.STREAM);
  assert('seq 0,1,2 returned and on the wire', seqs.join() === '0,1,2' && out.map((f) => f.header.seq).join() === '0,1,2');
  assert('header.channel is the target channel', out.every((f) => f.header.channel === 0x2100));
  const anchor = new DataView(out[2].bytes.buffer, out[2].bytes.byteOffset + 8).getUint32(0, true);
  assert('default anchor is hub time (client clock + CLOCK offset)', Math.abs(((anchor - s.hubNowUs()) | 0)) < 100000);

  // Token bucket at the granted 50 Hz: 3 spent, 32 more fit, the next 32 do not.
  const burst = Array(32).fill(one);
  s.publishSamples(0x2100, burst, { periodUs: 600 });
  refusal('overdrawing the granted rate', () => s.publishSamples(0x2100, burst, { periodUs: 600 }), PUBLISH_ERROR.RATE_EXCEEDED);
  const seqAfter = s.publishSamples(0x2100, one).seq;
  assert('a refused bundle does not consume a seq', seqAfter === 4);

  // Segments: grant via PUBLISH, then the §5.4 scheduling ceiling.
  const p = s.publish([[0x2101, 20]]);
  ws.recv(FRAME.GRANT, cbMap([[K.grants, cbArray([])],
    [K.granted_publishes, cbArray([cbMap([[K.granted_rate_hz, cbF32(20)], [K.channel_id, cbUint(0x2101)]])])]]));
  await p;
  const segv = { target_norm: 0.8, duration_ms: 120, end_vel_norm: 0 };
  refusal('segment anchored 300 ms ahead', () => s.publishSegment(0x2101, segv, { anchor: (s.hubNowUs() + 300000) >>> 0 }), PUBLISH_ERROR.SCHEDULE_TOO_FAR);
  assert('segment anchored 100 ms ahead goes out, seq 0 on its own channel',
    s.publishSegment(0x2101, segv, { anchor: (s.hubNowUs() + 100000) >>> 0 }).seq === 0);
  assert('no key 50 -> horizon 250 ms', s.state.grantedPublishes.get(0x2101).scheduleHorizonMs === 250);
  refusal('two segments without offsets', () => s.publishSegment(0x2101, [segv, segv]), PUBLISH_ERROR.BAD_BUNDLE);
  refusal('last start 260 ms out at the 250 ms default', () => s.publishSegment(0x2101, [segv, segv],
    { anchor: s.hubNowUs(), offsetsUs: [0, 260000] }), PUBLISH_ERROR.BAD_BUNDLE);
  refusal('span inside 250 ms but last start past it', () => s.publishSegment(0x2101, [segv, segv],
    { anchor: (s.hubNowUs() + 100000) >>> 0, offsetsUs: [0, 200000] }), PUBLISH_ERROR.SCHEDULE_TOO_FAR);

  // A 1000 ms horizon (re-GRANT with key 50): fill a bundle to 900 ms.
  ws.recv(FRAME.GRANT, cbMap([[K.grants, cbArray([])],
    [K.granted_publishes, cbArray([cbMap([[K.granted_rate_hz, cbF32(20)], [K.channel_id, cbUint(0x2101)],
      [K.schedule_horizon_ms, cbUint(1000)]])])]]));
  const r = s.publishSegment(0x2101, [segv, segv, segv], { offsetsUs: [0, 450000, 900000] });
  const wire = ws.framesOf(FRAME.STREAM).filter((f) => f.header.channel === 0x2101).pop().bytes;
  const wdv = new DataView(wire.buffer, wire.byteOffset + 8);
  assert('900 ms bundle accepted at horizon 1000; wire t_off 0/4500/9000 (100 us units)',
    r.n === 3 && wdv.getUint8(4) === 3 && wdv.getUint16(6, true) === 0 &&
    wdv.getUint16(8, true) === 4500 && wdv.getUint16(10, true) === 9000);

  // Unsolicited re-grant (§10.2): a key-36 GRANT with nothing pending updates the rate.
  ws.recv(FRAME.GRANT, cbMap([[K.grants, cbArray([])],
    [K.granted_publishes, cbArray([cbMap([[K.granted_rate_hz, cbF32(25)], [K.channel_id, cbUint(0x2100)]])])]]));
  assert('unsolicited re-grant adopted', s.state.grantedPublishes.get(0x2100).rate === 25);
  assert('no key 49 -> scheduleLatencyUs null', s.state.grantedPublishes.get(0x2100).scheduleLatencyUs === null);

  // RFC-059: schedule_latency_us (49) rides the grant entry; a change is a re-GRANT.
  ws.recv(FRAME.GRANT, cbMap([[K.grants, cbArray([])],
    [K.granted_publishes, cbArray([cbMap([[K.granted_rate_hz, cbF32(25)], [K.channel_id, cbUint(0x2100)],
      [K.schedule_latency_us, cbUint(12500)]])])]]));
  assert('GRANT schedule_latency_us -> grantedPublishes.scheduleLatencyUs',
    s.state.grantedPublishes.get(0x2100).scheduleLatencyUs === 12500);

  s.close();
  refusal('after close', () => s.publishSamples(0x2100, one), PUBLISH_ERROR.NOT_LIVE);
  assert('close forgets the grants', s.state.grantedPublishes.size === 0);
}

// ---- session decodes: identity key 6, limits 5/6, grant key 50, safety bits ----
{
  const s = createSession({ host: 't3', autoReconnect: false, deadmanWishMs: null, catalogStore: memStore(null), WebSocketImpl: FakeWS });
  s.connect();
  const ws = FakeWS.last;
  ws.open();
  let safetyEvt = null;
  s.on('safety', (v) => { safetyEvt = v; });
  ws.recv(FRAME.WELCOME, cbMap([
    [K.proto_ver, cbUint(1)], [K.session_id, cbUint(4)], [K.boot_id, cbUint(3)], [K.cfg_gen, cbUint(1)],
    [K.limits, cbMap([[WELCOME_LIMITS_K.max_frame, cbUint(512)],
      [WELCOME_LIMITS_K.max_sessions, cbUint(4)], [WELCOME_LIMITS_K.sessions_in_use, cbUint(2)]])],
    [K.roles, cbUint(1)], [K.grants, cbArray([])],
    [K.granted_publishes, cbArray([
      cbMap([[K.granted_rate_hz, cbF32(20)], [K.channel_id, cbUint(0x2101)], [K.schedule_horizon_ms, cbUint(500)]]),
      cbMap([[K.granted_rate_hz, cbF32(20)], [K.channel_id, cbUint(0x2102)]]),
      cbMap([[K.granted_rate_hz, cbF32(20)], [K.channel_id, cbUint(0x2103)], [K.schedule_horizon_ms, cbUint(300)]]),
    ])],
    [K.identity, cbMap([[IDENTITY_K.product, cbTstr('t')], [IDENTITY_K.hub_instance_id, cbUint(0x5e95c1a7d3b2f00dn)],
      [IDENTITY_K.estop_cuts_power, cbBool(true)]])],
  ]));
  assert('WELCOME identity.estop_cuts_power true', s.state.identity.estop_cuts_power === true);
  assert('hub_instance_id: 16 lowercase hex digits, exact, BigInt beside it (rfc-0oj)',
    s.state.identity.hub_instance_id === '5e95c1a7d3b2f00d' && s.state.identity.hub_instance_id_u64 === 0x5e95c1a7d3b2f00dn);
  assert('WELCOME limits max_sessions 4 / sessions_in_use 2',
    s.state.limits.max_sessions === 4 && s.state.limits.sessions_in_use === 2);
  const gp = s.state.grantedPublishes;
  assert('grant key 50 = 500 -> scheduleHorizonMs 500', gp.get(0x2101).scheduleHorizonMs === 500);
  assert('grant without key 50 -> scheduleHorizonMs 250', gp.get(0x2102).scheduleHorizonMs === 250);
  assert('grant with an off-step horizon (300) -> the 250 default', gp.get(0x2103).scheduleHorizonMs === 250);

  // 0x0003: word estop+pause (0x09), cause 2, owner 0xdeadbeef, estop_seq 7, modes override+home_required.
  const snap = Uint8Array.of(0x09, 0x02, 0xef, 0xbe, 0xad, 0xde, 0x07, 0x00, 0x03);
  ws.recv(FRAME.STATE, snap, CH_SAFETY);
  assert('safety snapshot by registry bits: estop, paused, override, homeRequired',
    !!safetyEvt && safetyEvt.estopLatched && safetyEvt.paused && safetyEvt.override && safetyEvt.homeRequired &&
    safetyEvt.cause === 2 && safetyEvt.ownerSession === 0xdeadbeef && safetyEvt.estopSeq === 7 && s.state.safety === safetyEvt);
  const old = decodeSafetySnapshot(Uint8Array.of(0x06, 0, 0, 0, 0, 0, 0, 0));
  assert('retired word bits 1/2 read as nothing; a modes-less 8 B snapshot reads both modes clear',
    !old.estopLatched && !old.paused && !old.override && !old.homeRequired);
  s.close();

  const s2 = createSession({ host: 't4', autoReconnect: false, deadmanWishMs: null, catalogStore: memStore(null), WebSocketImpl: FakeWS });
  s2.connect();
  FakeWS.last.open();
  FakeWS.last.recv(FRAME.WELCOME, cbMap([[K.session_id, cbUint(5)], [K.identity, cbMap([[IDENTITY_K.product, cbTstr('t')]])]]));
  const s3 = createSession({ host: 't4b', autoReconnect: false, deadmanWishMs: null, catalogStore: memStore(null), WebSocketImpl: FakeWS });
  s3.connect();
  FakeWS.last.open();
  FakeWS.last.recv(FRAME.WELCOME, cbMap([[K.session_id, cbUint(6)],
    [K.identity, cbMap([[IDENTITY_K.product, cbTstr('t')], [IDENTITY_K.hub_instance_id, cbUint(0x2a)]])]]));
  assert('a small hub_instance_id still renders as 16 hex digits', s3.state.identity.hub_instance_id === '000000000000002a');
  s3.close();
  assert('identity without key 6 -> estop_cuts_power false', s2.state.identity.estop_cuts_power === false);
  assert('identity without key 5 -> hub_instance_id null', s2.state.identity.hub_instance_id === null &&
    s2.state.identity.hub_instance_id_u64 === null);
  s2.close();
}

// ---- §6.3 admission refusals: retry_after_ms binds, with jitter --------------
{
  const s = createSession({ host: 't5', deadmanWishMs: null, catalogStore: memStore(null), WebSocketImpl: FakeWS });
  let adm = null;
  s.on('admission', (a) => { adm = a; });
  s.connect();
  const ws = FakeWS.last;
  ws.open();
  ws.recv(FRAME.NACK, cbMap([[K.code, cbUint(NACK.HUB_AT_CAPACITY)], [K.retry_after_ms, cbUint(3000)]]));
  assert('NACK HUB_AT_CAPACITY surfaces on the session with retry_after_ms',
    !!adm && adm.name === 'HUB_AT_CAPACITY' && adm.retryAfterMs === 3000 && s.state.admission === adm);
  assert('reconnect delay never sooner than retry_after_ms, jittered within +50%',
    adm.reconnectInMs >= 3000 && adm.reconnectInMs <= 4500);
  assert('the refused socket is closed', ws.readyState === 3);
  s.connect();
  assert('an explicit connect() inside the window opens no socket', FakeWS.last === ws);
  s.close();

  const delays = new Set();
  for (let i = 0; i < 8; i++) {
    const r = createSession({ host: 't6', autoReconnect: false, deadmanWishMs: null, catalogStore: memStore(null), WebSocketImpl: FakeWS });
    r.connect();
    FakeWS.last.open();
    FakeWS.last.recv(FRAME.GOODBYE, cbMap([[K.code, cbUint(NACK.HUB_SHEDDING)], [K.retry_after_ms, cbUint(1000)]]));
    assert('GOODBYE HUB_SHEDDING surfaces (' + i + ')', r.state.admission && r.state.admission.name === 'HUB_SHEDDING' &&
      r.state.admission.reconnectInMs >= 1000);
    delays.add(r.state.admission.reconnectInMs);
    r.close();
  }
  assert('jitter: eight refusals did not all pick one delay', delays.size > 1);

  const b = createSession({ host: 't7', autoReconnect: false, deadmanWishMs: null, catalogStore: memStore(null), WebSocketImpl: FakeWS });
  b.connect();
  FakeWS.last.open();
  FakeWS.last.recv(FRAME.NACK, cbMap([[K.code, cbUint(NACK.BUSY)]]));
  assert('BUSY on a HELLO (pre-RFC-055 hub) reads as HUB_AT_CAPACITY, default retry 2000 ms',
    b.state.admission && b.state.admission.name === 'HUB_AT_CAPACITY' && b.state.admission.retryAfterMs === 2000);
  b.close();
}

await tick();
console.log('');
if (failures === 0) { console.log('ALL PASS'); process.exit(0); }
console.log(failures + ' FAILED');
process.exit(1);
