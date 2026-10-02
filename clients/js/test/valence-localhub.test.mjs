/**
 * valence-localhub.test.mjs -- a real createSession against createLocalHub
 * over the WebSocketImpl duck, on the recorded valencesim catalog.
 *
 * Asserts: HELLO -> catalog transfer -> CATALOG_READY -> LIVE, then the etag
 * fast path on a second session; a setting write echoed clamped into the
 * catalog range and reflected in STATE; NACK INVALID_VALUE for an unknown key
 * (raw frame, the session refuses to encode one); pause/resume; the estop
 * latch holding against resume and a move until release, release landing in
 * PAUSE; SOURCE_CONFLICT between the two generators; a store save, read back.
 *
 * Run:  node clients/js/test/valence-localhub.test.mjs   (exits 1 on any failure)
 */

import { readFileSync } from 'node:fs';
import { createSession, SESSION_STATE } from '../session.js';
import { createLocalHub } from '../localhub.js';
import { cbMap, cbUint, cbDecodeFull } from '../cbor.js';
import {
  FRAME, K, NACK, SAFETY_OP, BLOB_K, CH_SAFETY, CH_CONTROL_OWNER, CH_HUB_STATUS, PRIORITY,
  encodeFrame, parseFrames,
} from '../frames.js';
import { decodeCatalog, decodePacked } from '../catalog.js';

let failures = 0;
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const settle = (p) => p.then((v) => ({ v }), (e) => ({ e }));
function waitFor(s, ev, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { off(); reject(new Error('timeout waiting for ' + ev)); }, ms);
    const off = s.on(ev, (...a) => { clearTimeout(t); off(); resolve(a); });
  });
}
const tick = () => new Promise((r) => setTimeout(r, 10));

const catBytes = new Uint8Array(readFileSync(new URL('./fixtures/valencesim-catalog.bin', import.meta.url)));
const entries = decodeCatalog(catBytes);
const byId = (id) => entries.find((e) => e.id === id);
const CFG = byId(0x1000), CFG_SET = 0x3000;
const winMax = CFG.layout.find((f) => f.name === 'window_max');
const PRESETS = entries.find((e) => e.store && e.store.kind === 'pattern.frayd');
const PRESET_CMD = entries.find((e) => e.storeId === PRESETS.store.storeId && e.schema);

function memStore() {
  let held = null;
  return { load: () => held, save(h, etag, bytes) { held = { etag, bytes }; }, clear() { held = null; } };
}
const WISHES = [[CH_SAFETY, 0, PRIORITY.critical], [CH_CONTROL_OWNER, 0, PRIORITY.critical], [CH_HUB_STATUS, 1, PRIORITY.background]];

console.log('valence-js localhub: createSession over the WebSocketImpl duck');

const hub = createLocalHub({ catalogBytes: catBytes, identity: { product: 'ossm', hub_name: 'Bench', estop_cuts_power: true } });
const cache = memStore();
const open = async () => {
  const s = createSession({ host: 'virtual', autoReconnect: false, catalogStore: cache, subscriptions: WISHES, WebSocketImpl: hub.WebSocket });
  const live = waitFor(s, 'live');
  s.connect();
  await live;
  return s;
};

// ---- HELLO through LIVE, then the cached-etag fast path ---------------------
let s = await open();
assert('first session LIVE after a catalog transfer', s.phase === SESSION_STATE.LIVE && !!s.catalog);
assert('identity is marked virtual and carries no hub_instance_id',
  s.identity.hub_name === 'Bench (virtual)' && s.identity.hub_instance_id === null, s.identity.hub_name);
assert('the retained safety latch was adopted before LIVE', s.state.safety && s.state.safety.estopLatched === false);
s.close();
await tick();
let catalogMeta = null;
s = createSession({ host: 'virtual', autoReconnect: false, catalogStore: cache, subscriptions: WISHES, WebSocketImpl: hub.WebSocket });
s.on('catalog', (_e, _m, meta) => { catalogMeta = meta; });
const live2 = waitFor(s, 'live');
s.connect();
await live2;
assert('second session takes the etag fast path', catalogMeta && catalogMeta.cached === true);

// ---- a setting write, clamped, reflected in STATE ---------------------------
const states = [];
s.on('state', (ch, smp) => { if (ch === CFG.id) states.push(smp); });
s.subscribe([[CFG.id, 0, PRIORITY.normal]]);
await tick();
const echo = await s.sendConfigSet({ [winMax.settingKey]: 99999 });
await tick();
assert('ECHO applied is clamped to the field max', echo.applied[winMax.settingKey] === winMax.max, echo.applied[winMax.settingKey]);
assert('STATE reflects the clamped value', states.at(-1) && states.at(-1).window_max === winMax.max, states.at(-1) && states.at(-1).window_max);
assert('the hub snapshot carries it too', decodePacked(hub.snapshot(CFG.id), CFG.layout).window_max === winMax.max);

// ---- NACK: an unknown key (a raw frame; the session will not encode one) ----
{
  const raw = new hub.WebSocket('ws://virtual/');
  const got = [];
  raw.onmessage = (ev) => { for (const f of parseFrames(new Uint8Array(ev.data))) got.push(f); };
  await new Promise((r) => { raw.onopen = r; });
  raw.send(encodeFrame(FRAME.HELLO, 0, cbMap([[K.proto_ver, cbUint(1)]])));
  await tick();
  const welcome = got.find((f) => f.header.type === FRAME.WELCOME);
  raw.send(encodeFrame(FRAME.CATALOG_READY, 0, cbDecodeFull(welcome.payload).get(K.catalog_etag)));
  raw.send(encodeFrame(FRAME.INTENT, CFG_SET, cbMap([[K.channel_id, cbUint(CFG_SET)], [K.intent_id, cbUint(5)],
    [K.value, cbMap([[99, cbUint(1)]])]]), 5));
  await tick();
  const n = got.find((f) => f.header.type === FRAME.NACK);
  const m = n && cbDecodeFull(n.payload);
  assert('unknown key -> NACK INVALID_VALUE with the intent id', m && m.get(K.code) === NACK.INVALID_VALUE && m.get(K.intent_id) === 5);
  raw.close();
}

// ---- pause / resume ----------------------------------------------------------
await s.sendSafetyIntent(SAFETY_OP.pause);
await tick();
assert('pause latches PAUSE in the safety snapshot', s.state.safety.paused === true);
const move = await settle(s.sendIntent(0x3100, { 1: 100 }));
assert('a move under PAUSE -> NACK INTERLOCK', move.e && move.e.code === NACK.INTERLOCK, move.e && move.e.name);
await s.sendSafetyIntent(SAFETY_OP.resume);
await tick();
assert('resume clears PAUSE', s.state.safety.paused === false);

// ---- estop holds until release ----------------------------------------------
await s.assertEstop();
await tick();
assert('estop latches, home required on a power-cutting hub', s.state.safety.estopLatched && s.state.safety.homeRequired);
const r1 = await settle(s.sendSafetyIntent(SAFETY_OP.resume));
assert('resume under estop -> NACK ESTOP_ACTIVE', r1.e && r1.e.code === NACK.ESTOP_ACTIVE);
const m1 = await settle(s.sendIntent(0x3100, { 1: 50 }));
assert('a move under estop -> NACK ESTOP_ACTIVE', m1.e && m1.e.code === NACK.ESTOP_ACTIVE);
await s.sendSafetyIntent(SAFETY_OP.release);
await tick();
assert('release clears ESTOP and lands in PAUSE', !s.state.safety.estopLatched && s.state.safety.paused);
const r2 = await settle(s.sendSafetyIntent(SAFETY_OP.resume));
assert('resume before a home -> NACK NOT_HOMED', r2.e && r2.e.code === NACK.NOT_HOMED);
await s.sendHome(1);
await s.sendSafetyIntent(SAFETY_OP.resume);
await tick();
assert('home then resume runs clear', !s.state.safety.paused && !s.state.safety.homeRequired);

// ---- the two generators are exclusive sources (§11.4) ----------------------
await s.sendPatternCmd({ 1: true });
const adv = await settle(s.sendIntent(0x3210, { 45: true }));
assert('advgen start while the pattern runs -> NACK SOURCE_CONFLICT', adv.e && adv.e.code === NACK.SOURCE_CONFLICT);
await s.sendPatternCmd({ 1: false });

// ---- store: save, read back --------------------------------------------------
const opKey = PRESET_CMD.schema.find((f) => f.role === 'action.store').key;
await s.sendIntent(PRESET_CMD.id, { [opKey]: 1, 2: 3, 3: 'demo' });
const got = await settle(s.fetchBlob({ storeId: PRESETS.store.storeId, slot: 3 }));
assert('a saved preset reads back with its name', got.v && cbDecodeFull(got.v.bytes).get(BLOB_K.name) === 'demo');
const empty = await settle(s.fetchBlob({ storeId: PRESETS.store.storeId, slot: 4 }));
assert('an empty slot -> UNAVAILABLE', empty.e && empty.e.code === 'UNAVAILABLE');

s.close();
console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall passed');
process.exit(failures ? 1 : 0);
