/**
 * localhub.js -- a Valence hub that lives in the page: a replay of one
 * machine from its catalog and retained STATE, where nothing moves.
 *
 * It speaks the wire through createSession's `WebSocketImpl` seam, so a client
 * reaches it with zero changes to its session code (the Prime Rule: through
 * Valence, never around it). Built for demo and configure mode: a client
 * renders, writes settings, flips modes and works the safety strip against
 * the hub's answers instead of a machine.
 *
 *   const hub = createLocalHub({ catalogBytes, identity, snapshots, items });
 *   const s = createSession({ host: 'virtual', WebSocketImpl: hub.WebSocket });
 *
 * Options:
 *   catalogBytes  Uint8Array, the catalog encoding (blob namespace 0)
 *   etag          optional; must equal the bytes' own etag (SPEC §8.3)
 *   identity      {product, fw_version, hub_name, estop_cuts_power}. No
 *                 hub_instance_id is sent, ever: a replay is not that hub
 *                 (SPEC §6.1). hub_name gains " (virtual)"; absent, it is
 *                 "Virtual Valence".
 *   snapshots     {channelId: Uint8Array} retained STATE; a STATE channel
 *                 without one starts from its catalog defaults
 *                 (meta.enabled_mask all set)
 *   items         [{storeId, slot, bytes}] store item documents (SPEC §8.7)
 *   roles         granted tier, default configure
 *
 * Enforces: HELLO/WELCOME with the etag fast path, BLOB namespace 0 with
 * repair, the readiness gate (§6.4), SUBSCRIBE/GRANT with retained STATE,
 * CLOCK, PING; INTENT validation against the catalog (unknown key, wrong type
 * or option index: NACK INVALID_VALUE; per-op access), the post-clamp ECHO
 * inside the schema and layout min/max (§8.8), the idempotency ring (§9.3);
 * the safety latches pause/resume, estop/release, override/return and the raw
 * ESTOP frame (§11.1, §11.2) with the safety snapshot and its edges; motion
 * refusals (ESTOP_ACTIVE, NOT_HOMED, INTERLOCK under PAUSE, SOURCE_CONFLICT
 * between the pattern.running and advgen.running sources and for a move
 * while one runs, §11.4); store reads (ns 1) and the action.store ops on an
 * in-memory item list with the roster STATE; trial writes (RFC-099, §9.3)
 * when the catalog declares settings-trial: per-session baselines, commit,
 * revert, TRIAL_CONFLICT, revert on close, and every meta.trial_pending field.
 *
 * Does not: move, plan or publish telemetry (position holds at its snapshot);
 * grant c2h STREAM publications (PUBLISH grants nothing); time out deadman or
 * readiness; rate-limit; pair or authenticate (every session gets `roles`);
 * apply a stored item on `load`, or capture live state on a payload-less
 * `save` (it stores an empty payload); update control-owner.
 */

import { cbUint, cbInt, cbBool, cbF32, cbTstr, cbBstr, cbArray, cbMap, cbDecodeFull } from './cbor.js';
import {
  FRAME, K, IDENTITY_K, BLOB_K, BLOB_NS, WELCOME_LIMITS_K, ACCESS, CHANNEL_CLASS, PACKED, PACKED_SIZE,
  CBOR_FIELD, NACK, SAFETY_OP, SAFETY_OP_ROLE_EXEMPT, SAFETY_CAUSE, SAFETY_EVENT_KIND, FIELD_ROLE, ACTION_TAG,
  LIMITS, PROTO_VER, WS_SUBPROTOCOL, CH_SAFETY, CH_SAFETY_INTENTS, CH_SAFETY_EVENTS, CH_SETTINGS_TRIAL,
  encodeFrame, parseFrames, crc32, ESTOP_FRAME_BYTES,
} from './frames.js';
import { decodeCatalog, decodePacked, schemaByKey, canUseOption } from './catalog.js';
import { catalogEtag, bytesEqual } from './sha256.js';
import { STORE_OP, TRIAL_OP } from './generated/registry_vocab.js';

const CHUNK = LIMITS.catalog_chunk_payload;
const RING = 32; // idempotency_ring_depth (§9.3)
const MAX_FRAME = 4096;
const ESTOP = 0x01, PAUSE = 0x08; // safety word bits (§11.1)
const OVERRIDE = 0x01, HOME_REQUIRED = 0x02; // safety modes bits
const SOURCES = new Set([FIELD_ROLE.pattern_running, FIELD_ROLE.advgen_running]);
const ROLE_STORE = 'action.' + ACTION_TAG.store;
const ROLE_HOME = 'action.' + ACTION_TAG.home;
const enc = new TextEncoder();
const RANGE = {
  [PACKED.u8]: [0, 0xff], [PACKED.i8]: [-0x80, 0x7f], [PACKED.u16]: [0, 0xffff], [PACKED.i16]: [-0x8000, 0x7fff],
  [PACKED.u32]: [0, 0xffffffff], [PACKED.i32]: [-0x80000000, 0x7fffffff],
};
const STR = new Set([PACKED.str16, PACKED.str32, PACKED.str64]);

/** Map with keys sorted ascending, as the deterministic profile requires (§5.3). */
const map = (pairs) => cbMap(pairs.slice().sort((a, b) => a[0] - b[0]));
const later = typeof queueMicrotask === 'function' ? queueMicrotask : (fn) => Promise.resolve().then(fn);
const fieldSize = (f) => PACKED_SIZE[f.type] ?? f.declaredSize ?? 0;
const layoutSize = (layout) => layout.reduce((n, f) => n + fieldSize(f), 0);

function truncUtf8(s, max) {
  let out = String(s);
  while (enc.encode(out).length > max) out = out.slice(0, -1);
  return out;
}

/** Write one physical value into a packed snapshot (the inverse of decodePacked). */
function writeField(snap, layout, field, value) {
  let off = 0;
  for (const f of layout) { if (f === field) break; off += fieldSize(f); }
  const size = fieldSize(field);
  const out = new Uint8Array(Math.max(snap.length, off + size));
  out.set(snap);
  const dv = new DataView(out.buffer);
  const v = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  if (STR.has(field.type)) {
    out.fill(0, off, off + size);
    out.set(enc.encode(truncUtf8(v, size - 1)), off);
  } else if (field.type === PACKED.f32) {
    dv.setFloat32(off, v * (field.scale || 1), true);
  } else if (field.type === PACKED.bitfield8) {
    dv.setUint8(off, v & 0xff);
  } else if (RANGE[field.type]) {
    const [lo, hi] = RANGE[field.type];
    const raw = Math.min(hi, Math.max(lo, Math.round(v * (field.scale || 1))));
    switch (field.type) {
      case PACKED.u8: dv.setUint8(off, raw); break;
      case PACKED.i8: dv.setInt8(off, raw); break;
      case PACKED.u16: dv.setUint16(off, raw, true); break;
      case PACKED.i16: dv.setInt16(off, raw, true); break;
      case PACKED.u32: dv.setUint32(off, raw, true); break;
      case PACKED.i32: dv.setInt32(off, raw, true); break;
    }
  }
  return out;
}

/** A STATE channel's snapshot from its catalog defaults; meta.enabled_mask reads all-enabled. */
export function defaultSnapshot(entry) {
  let snap = new Uint8Array(layoutSize(entry.layout || []));
  for (const f of entry.layout || []) {
    const v = f.role === FIELD_ROLE.meta_enabled_mask ? 0xff : f.default;
    if (v != null) snap = writeField(snap, entry.layout, f, v);
  }
  return snap;
}

/** An INTENT value checked against its schema field and clamped into min/max; undefined = refuse. */
function coerce(f, v) {
  switch (f.type) {
    case CBOR_FIELD.uint_t: case CBOR_FIELD.int_t: case CBOR_FIELD.f32_t: {
      if (typeof v === 'bigint') v = Number(v);
      if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
      if (f.type !== CBOR_FIELD.f32_t && !Number.isInteger(v)) return undefined;
      if (f.options && (v < 0 || v >= f.options.length)) return undefined;
      return clamp(f, f.type === CBOR_FIELD.uint_t ? Math.max(0, v) : v);
    }
    case CBOR_FIELD.bool_t: return typeof v === 'boolean' ? v : undefined;
    case CBOR_FIELD.tstr_t: return typeof v === 'string' ? v : undefined;
    case CBOR_FIELD.bstr_t: return v instanceof Uint8Array ? v : undefined;
    default: return undefined;
  }
}

function clamp(f, v) {
  if (typeof v !== 'number') return v;
  if (f.min != null) v = Math.max(f.min, v);
  if (f.max != null) v = Math.min(f.max, v);
  return v;
}

function cbAs(f, v) {
  if (f.flagBits && f.flagBits.secret) return cbBool(true); // §8.8: ECHO never carries a secret
  switch (f.type) {
    case CBOR_FIELD.uint_t: return cbUint(v);
    case CBOR_FIELD.int_t: return cbInt(v);
    case CBOR_FIELD.f32_t: return cbF32(v);
    case CBOR_FIELD.bool_t: return cbBool(v);
    case CBOR_FIELD.tstr_t: return cbTstr(v);
    default: return cbBstr(v);
  }
}

/**
 * @param {Object} o see the file header
 * @returns {{WebSocket: Function, etag: Uint8Array, snapshot: (ch:number) => Uint8Array|undefined}}
 */
export function createLocalHub(o) {
  const catalogBytes = o.catalogBytes;
  const etag = catalogEtag(catalogBytes, LIMITS.etag_bytes);
  if (o.etag && !bytesEqual(o.etag, etag)) throw new Error('createLocalHub: etag is not the catalog bytes\' own');
  const entries = decodeCatalog(catalogBytes);
  const byId = new Map(entries.map((e) => [e.id, e]));
  const roles = o.roles ?? ACCESS.configure;
  const id = o.identity || {};
  const bootId = ((Math.random() * 0xfffffffe) >>> 0) + 1;
  let cfgGen = 1;

  const snaps = new Map();
  for (const e of entries) {
    if (e.cls !== CHANNEL_CLASS.STATE || !e.layout) continue;
    const s = o.snapshots && o.snapshots[e.id];
    snaps.set(e.id, s ? Uint8Array.from(s) : defaultSnapshot(e));
  }
  const seqs = new Map(); // channel -> STATE seq (§7.3)
  const items = new Map(); // storeId * 256 + slot -> item document bytes
  for (const it of o.items || []) items.set(it.storeId * 256 + it.slot, Uint8Array.from(it.bytes));
  const gens = new Map(); // storeId -> roster generation
  const conns = new Set();

  const stores = entries.filter((e) => e.cls === CHANNEL_CLASS.STORE && e.store);
  const rosterOf = (sid) => entries.find((e) => e.storeId === sid && e.cls === CHANNEL_CLASS.STATE && e.layout) || null;
  const valueOf = (e, f) => decodePacked(snaps.get(e.id), e.layout)[f.name];
  const setField = (e, f, v) => snaps.set(e.id, writeField(snaps.get(e.id), e.layout, f, v));
  function syncRoster(sid) {
    const r = rosterOf(sid);
    const st = stores.find((e) => e.store.storeId === sid);
    if (!r) return null;
    const n = [...items.keys()].filter((k) => Math.floor(k / 256) === sid).length;
    for (const [name, v] of [['generation', gens.get(sid) || 0], ['count', n], ['capacity', st.store.capacity]]) {
      const f = r.layout.find((x) => x.name === name);
      if (f) setField(r, f, v);
    }
    return r.id;
  }
  for (const st of stores) {
    const r = rosterOf(st.store.storeId);
    const g = r && r.layout.find((x) => x.name === 'generation');
    gens.set(st.store.storeId, g ? valueOf(r, g) | 0 : 0);
    syncRoster(st.store.storeId);
  }

  // ---- delivery ---------------------------------------------------------
  function deliver(c, type, ch, payload, seq = 0) {
    const f = encodeFrame(type, ch, payload, seq);
    const data = f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength);
    later(() => { if (c.sock.readyState === 1 && c.sock.onmessage) c.sock.onmessage({ data }); });
  }
  const pushState = (c, ch) => { if (snaps.has(ch)) deliver(c, FRAME.STATE, ch, snaps.get(ch), seqs.get(ch) || 0); };
  function broadcast(ch) {
    seqs.set(ch, ((seqs.get(ch) || 0) + 1) & 0xffff);
    for (const c of conns) if (c.ready && c.subs.has(ch)) pushState(c, ch);
  }
  function nack(c, code, h, extra = {}) {
    const pairs = [[K.code, cbUint(code)], [K.intent_seq, cbUint(h.seq)]];
    if (extra.ch != null) pairs.push([K.channel_id, cbUint(extra.ch)]);
    if (extra.detail) pairs.push([K.detail, cbTstr(extra.detail)]);
    if (extra.intentId != null) pairs.push([K.intent_id, cbUint(extra.intentId)]);
    deliver(c, FRAME.NACK, extra.ch || 0, map(pairs));
  }
  function sendBlob(c, ns, sid, slot, gen, bytes, want) {
    const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
    for (const i of want || Array.from({ length: n }, (_, j) => j)) {
      if (!Number.isInteger(i) || i >= n) continue;
      const part = bytes.subarray(i * CHUNK, (i + 1) * CHUNK);
      const out = new Uint8Array(14 + part.length);
      const dv = new DataView(out.buffer);
      dv.setUint8(0, ns); dv.setUint8(1, sid); dv.setUint8(2, slot);
      dv.setUint16(4, gen, true); dv.setUint16(6, i, true); dv.setUint16(8, n, true); dv.setUint32(10, bytes.length, true);
      out.set(part, 14);
      deliver(c, FRAME.BLOB_CHUNK, 0, out);
    }
  }

  // ---- the safety latch (§11.1), by registry bit positions ---------------
  function latch() {
    const s = snaps.get(CH_SAFETY) || new Uint8Array(9);
    const dv = new DataView(s.buffer, s.byteOffset, s.byteLength);
    return {
      word: s[0] | 0, cause: s.length > 1 ? s[1] : 0, owner: s.length >= 6 ? dv.getUint32(2, true) : 0,
      seq: s.length >= 8 ? dv.getUint16(6, true) : 0, modes: s.length >= 9 ? s[8] : 0,
    };
  }
  function setLatch(L, edge) {
    const s = new Uint8Array(Math.max(9, (snaps.get(CH_SAFETY) || []).length));
    s.set(snaps.get(CH_SAFETY) || []);
    const dv = new DataView(s.buffer);
    s[0] = L.word; s[1] = L.cause; dv.setUint32(2, L.owner, true); dv.setUint16(6, L.seq, true); s[8] = L.modes;
    snaps.set(CH_SAFETY, s);
    broadcast(CH_SAFETY);
    const ev = byId.get(CH_SAFETY_EVENTS);
    if (!edge || !ev) return;
    const body = [];
    for (const f of ev.schema || []) {
      const v = { word: L.word, cause: L.cause, owner_session: L.owner, estop_seq: L.seq }[f.name];
      if (v != null) body.push([f.key, cbUint(v)]);
    }
    const payload = map([[K.event_kind, cbUint(edge)], [K.seq_of_state, cbUint(seqs.get(CH_SAFETY) || 0)], [K.body, map(body)]]);
    for (const c of conns) if (c.ready && c.subs.has(CH_SAFETY_EVENTS)) deliver(c, FRAME.EVENT, CH_SAFETY_EVENTS, payload);
  }
  function latchEstop() {
    const L = latch();
    if (L.word & ESTOP) return;
    // Motion is prohibited while latched: every generator stops.
    for (const e of entries) {
      for (const f of (snaps.has(e.id) && e.layout) || []) {
        if (SOURCES.has(f.role) && valueOf(e, f)) { setField(e, f, 0); broadcast(e.id); }
      }
    }
    L.word = (L.word | ESTOP); L.cause = SAFETY_CAUSE.user; L.seq = (L.seq + 1) & 0xffff;
    L.modes = (L.modes & ~OVERRIDE) | (id.estop_cuts_power ? HOME_REQUIRED : 0);
    setLatch(L, SAFETY_EVENT_KIND.estop_latched);
  }
  function safetyOp(op) {
    const L = latch();
    const paused = (L.word & PAUSE) !== 0, estop = (L.word & ESTOP) !== 0;
    const pause = () => { L.word |= PAUSE; L.cause = SAFETY_CAUSE.user; };
    switch (op) {
      case SAFETY_OP.estop: latchEstop(); return null;
      case SAFETY_OP.pause: if (!paused) { pause(); setLatch(L, SAFETY_EVENT_KIND.pause_latched); } return null;
      case SAFETY_OP.resume:
        if (estop) return { code: NACK.ESTOP_ACTIVE };
        if (L.modes & OVERRIDE) return { code: NACK.INTERLOCK, detail: 'override latched' };
        if (L.modes & HOME_REQUIRED) return { code: NACK.NOT_HOMED };
        if (paused) { L.word &= ~PAUSE; setLatch(L, SAFETY_EVENT_KIND.pause_cleared); }
        return null;
      case SAFETY_OP.release: // lands in PAUSE (§11.2)
        if (estop) { L.word = (L.word & ~ESTOP) | PAUSE; setLatch(L, SAFETY_EVENT_KIND.estop_cleared); }
        return null;
      case SAFETY_OP.override:
        if (estop) return { code: NACK.ESTOP_ACTIVE };
        L.modes |= OVERRIDE;
        if (!paused) pause();
        setLatch(L, paused ? 0 : SAFETY_EVENT_KIND.pause_latched);
        return null;
      case SAFETY_OP.return_op: if (L.modes & OVERRIDE) { L.modes &= ~OVERRIDE; setLatch(L, 0); } return null;
      default: return { code: NACK.UNSUPPORTED_OP };
    }
  }

  // ---- intents -------------------------------------------------------------
  const stateFor = (ch) => entries.filter((e) => e.settingChannel === ch && snaps.has(e.id));
  const sourceRunning = (except) => entries.some((e) => snaps.has(e.id) &&
    e.layout.some((f) => SOURCES.has(f.role) && f !== except && valueOf(e, f)));

  function storeOp(entry, vals, changed) {
    const st = stores.find((e) => e.store.storeId === entry.storeId);
    if (!st) return { code: NACK.UNSUPPORTED_OP, detail: 'the writer names no store' };
    const plain = entry.schema.filter((f) => !f.role);
    const one = (t) => { const h = plain.filter((f) => f.type === t); return h.length === 1 ? h[0] : null; };
    const opF = entry.schema.find((f) => f.role === ROLE_STORE);
    const slotF = one(CBOR_FIELD.uint_t), nameF = one(CBOR_FIELD.tstr_t), itemF = one(CBOR_FIELD.bstr_t);
    const { storeId: sid, capacity, kind, perItemMax, nameMax } = st.store;
    const slot = slotF ? vals.get(slotF.key) : undefined;
    if (!Number.isInteger(slot) || slot < 0 || slot >= capacity) return { code: NACK.INVALID_VALUE, detail: 'slot' };
    const k = sid * 256 + slot, have = items.get(k);
    const old = have ? cbDecodeFull(have) : null;
    const name = nameF && vals.has(nameF.key) ? vals.get(nameF.key) : (old ? old.get(BLOB_K.name) : '') || '';
    if (nameMax && enc.encode(name).length > nameMax) return { code: NACK.INVALID_VALUE, detail: 'name too long' };
    const item = (payload) => map([[BLOB_K.slot, cbUint(slot)], [BLOB_K.name, cbTstr(name)],
      [BLOB_K.kind, cbTstr(kind)], [BLOB_K.payload, cbBstr(payload)]]);
    switch (vals.get(opF.key)) {
      case STORE_OP.save: {
        const payload = (itemF && vals.get(itemF.key)) || new Uint8Array(0);
        if (perItemMax && payload.length > perItemMax) return { code: NACK.INVALID_VALUE, detail: 'item too large' };
        items.set(k, item(payload));
        break;
      }
      case STORE_OP.load: return have ? {} : { code: NACK.INVALID_VALUE, detail: 'slot is empty' };
      case STORE_OP.delete_item: items.delete(k); break;
      case STORE_OP.rename:
        if (!have) return { code: NACK.INVALID_VALUE, detail: 'slot is empty' };
        items.set(k, item(old.get(BLOB_K.payload) || new Uint8Array(0)));
        break;
      default: return { code: NACK.UNSUPPORTED_OP };
    }
    gens.set(sid, ((gens.get(sid) || 0) + 1) & 0xffff);
    const r = syncRoster(sid);
    if (r != null) changed.add(r);
    return {};
  }

  // ---- RFC-099 trial writes: 'channel:key' -> {sid, base: [[state, field, value]]} ----
  const trialsOn = byId.has(CH_SETTINGS_TRIAL);
  const trials = new Map();
  const trialKey = (ch, k) => ch + ':' + k;
  function trialMasks(changed) {
    for (const st of entries) {
      if (!snaps.has(st.id) || st.settingChannel == null) continue;
      const marks = st.layout.filter((f) => f.role === FIELD_ROLE.meta_trial_pending);
      if (!marks.length) continue;
      let bits = 0, i = 0;
      for (const f of st.layout) {
        if (f.settingKey == null) continue;
        if (trials.has(trialKey(st.settingChannel, f.settingKey))) bits |= 1 << i;
        i++;
      }
      marks.forEach((f, j) => {
        const v = (bits >>> (8 * j)) & 0xff;
        if (valueOf(st, f) !== v) { setField(st, f, v); changed.add(st.id); }
      });
    }
  }
  /** Commit or revert every trial `sid` holds; true when a value moved. */
  function endTrials(sid, commit, changed) {
    let moved = false;
    for (const [k, t] of trials) {
      if (t.sid !== sid) continue;
      trials.delete(k);
      if (commit) continue;
      for (const [st, f, v] of t.base) {
        if (valueOf(st, f) === v) continue;
        setField(st, f, v);
        changed.add(st.id);
        moved = true;
      }
    }
    trialMasks(changed);
    return moved;
  }

  function applyIntent(entry, vals, changed) {
    const has = (role) => entry.schema.some((f) => f.role === role && vals.has(f.key));
    if (has(ROLE_STORE)) return storeOp(entry, vals, changed);
    const L = latch();
    const estop = (L.word & ESTOP) !== 0, paused = (L.word & PAUSE) !== 0, override = (L.modes & OVERRIDE) !== 0;
    if (has(ROLE_HOME) && estop) return { code: NACK.ESTOP_ACTIVE };
    if (has(FIELD_ROLE.command_position)) {
      if (estop) return { code: NACK.ESTOP_ACTIVE };
      if (L.modes & HOME_REQUIRED) return { code: NACK.NOT_HOMED };
      if (!override && paused) return { code: NACK.INTERLOCK, detail: 'paused' };
      if (!override && sourceRunning(null)) return { code: NACK.SOURCE_CONFLICT, detail: 'a source owns the rail' };
    }
    const writes = [];
    for (const [k, v] of vals) {
      for (const st of stateFor(entry.id)) {
        const f = st.layout.find((x) => x.settingKey === k);
        if (f) writes.push([st, f, k, clamp(f, v)]);
      }
    }
    for (const [st, f, , v] of writes) {
      if (!SOURCES.has(f.role) || !v || valueOf(st, f)) continue;
      if (estop) return { code: NACK.ESTOP_ACTIVE };
      if (paused) return { code: NACK.INTERLOCK, detail: 'paused' };
      if (sourceRunning(f)) return { code: NACK.SOURCE_CONFLICT, detail: 'another source owns the rail' };
    }
    for (const [st, f, k, v] of writes) {
      if (!(f.flagBits && f.flagBits.secret)) setField(st, f, v);
      vals.set(k, v);
      changed.add(st.id);
    }
    if (has(ROLE_HOME) && (L.modes & HOME_REQUIRED)) { L.modes &= ~HOME_REQUIRED; setLatch(L, 0); }
    return { config: writes.length > 0 };
  }

  function onIntent(c, h, payload) {
    let m;
    try { m = cbDecodeFull(payload); } catch (e) { nack(c, NACK.MALFORMED, h, { ch: h.channel }); return; }
    const ch = m.get(K.channel_id) ?? h.channel, intentId = m.get(K.intent_id), val = m.get(K.value);
    const refuse = (code, detail) => nack(c, code, h, { ch, detail, intentId });
    const entry = byId.get(ch);
    if (!entry) return refuse(NACK.UNKNOWN_CHANNEL);
    if (entry.cls !== CHANNEL_CLASS.INTENT) return refuse(NACK.CLASS_MISMATCH);
    if (!(val instanceof Map)) return refuse(NACK.INVALID_VALUE, 'value is not a map');
    const opKey = ch === CH_SAFETY_INTENTS ? ((entry.schema || []).find((f) => f.options) || {}).key : null;
    const exempt = opKey != null && SAFETY_OP_ROLE_EXEMPT.has(val.get(opKey));
    if (!c.ready && !exempt) return refuse(NACK.NOT_READY);
    // §11.2: the control floor on re-arming ops holds whatever the catalog says.
    if (opKey != null && !exempt && c.roles < ACCESS.control) return refuse(NACK.NOT_CONTROLLER);
    if (c.echoes.has(intentId)) { deliver(c, FRAME.ECHO, ch, c.echoes.get(intentId)); return; }

    const schema = schemaByKey(entry);
    const vals = new Map();
    for (const [k, v] of val) {
      const f = schema.get(k);
      if (!f) return refuse(NACK.INVALID_VALUE, 'no schema field for key ' + k);
      if (!canUseOption(entry, k, v, c.roles)) return refuse(NACK.ACCESS_DENIED, f.name);
      const x = coerce(f, v);
      if (x === undefined) return refuse(NACK.INVALID_VALUE, f.name);
      vals.set(k, x);
    }
    const changed = new Set();
    const me = c.sessionId;
    const trial = trialsOn && m.get(K.trial) === true;
    const opened = new Map();
    if (trialsOn) {
      for (const k of vals.keys()) {
        const t = trials.get(trialKey(ch, k));
        if (t && t.sid !== me) return refuse(NACK.TRIAL_CONFLICT, 'on trial by another session');
      }
    }
    if (trial) {
      const verb = (entry.schema || []).some((f) => typeof f.role === 'string' && f.role.startsWith('action.'));
      if (opKey != null || ch === CH_SETTINGS_TRIAL || verb) return refuse(NACK.UNSUPPORTED_OP, 'not trialable');
      for (const k of vals.keys()) {
        if (trials.has(trialKey(ch, k))) continue;
        const base = [];
        for (const st of stateFor(ch)) {
          for (const f of st.layout) if (f.settingKey === k) base.push([st, f, valueOf(st, f)]);
        }
        if (!base.length || base.some(([, f]) => SOURCES.has(f.role) || (f.flagBits && f.flagBits.secret))) {
          return refuse(NACK.UNSUPPORTED_OP, 'not trialable');
        }
        opened.set(k, base);
      }
    }
    let r;
    if (trialsOn && ch === CH_SETTINGS_TRIAL) {
      const op = vals.get(1);
      if (op !== TRIAL_OP.commit && op !== TRIAL_OP.revert) return refuse(NACK.UNSUPPORTED_OP, 'op is commit or revert');
      r = { config: endTrials(me, op === TRIAL_OP.commit, changed) };
    } else {
      r = opKey != null ? (safetyOp(vals.get(opKey)) || {}) : applyIntent(entry, vals, changed);
    }
    if (r.code != null) return refuse(r.code, r.detail);
    if (trialsOn && ch !== CH_SETTINGS_TRIAL) {
      for (const k of vals.keys()) {
        if (opened.has(k)) trials.set(trialKey(ch, k), { sid: me, base: opened.get(k) });
        else if (!trial && trials.get(trialKey(ch, k))?.sid === me) trials.delete(trialKey(ch, k));
      }
      trialMasks(changed);
    }
    if (r.config) cfgGen = (cfgGen + 1) & 0xffff;
    const echo = map([[K.cfg_gen, cbUint(cfgGen)], [K.intent_id, cbUint(intentId)],
      [K.applied, map([...vals].map(([k, x]) => [k, cbAs(schema.get(k), x)]))]]);
    c.echoes.set(intentId, echo);
    if (c.echoes.size > RING) c.echoes.delete(c.echoes.keys().next().value);
    deliver(c, FRAME.ECHO, ch, echo);
    for (const s of changed) broadcast(s);
  }

  // ---- session plane ----------------------------------------------------------
  function grantsFor(c, wishes, h, answer) {
    const out = [];
    for (const w of wishes || []) {
      const ch = w.get(K.channel_id), e = byId.get(ch);
      const why = !e ? NACK.UNKNOWN_CHANNEL
        : (e.cls !== CHANNEL_CLASS.STATE && e.cls !== CHANNEL_CLASS.EVENT) ? NACK.CLASS_MISMATCH
          : e.access > c.roles ? NACK.ACCESS_DENIED : null;
      if (why != null) { if (answer) nack(c, why, h, { ch }); continue; }
      const rate = w.get(K.rate_hz) || 0;
      c.subs.add(ch);
      out.push({ ch, rate: e.maxRateHz ? Math.min(rate, e.maxRateHz) : rate, prio: w.get(K.priority) || 0 });
    }
    return out;
  }
  const grantMap = (g) => map([[K.priority, cbUint(g.prio)], [K.granted_rate_hz, cbF32(g.rate)], [K.channel_id, cbUint(g.ch)]]);

  function onHello(c, payload) {
    const m = cbDecodeFull(payload);
    const offered = m.get(K.catalog_etag);
    c.ready = offered instanceof Uint8Array && bytesEqual(offered, etag);
    c.subs = new Set();
    c.echoes = new Map();
    const grants = grantsFor(c, m.get(K.subscriptions), null, false);
    const retained = grants.filter((g) => snaps.has(g.ch));
    const wish = m.get(K.deadman_wish_ms) ?? LIMITS.deadman_default_ms;
    const ident = [[IDENTITY_K.hub_name, cbTstr(id.hub_name ? id.hub_name + ' (virtual)' : 'Virtual Valence')],
      [IDENTITY_K.estop_cuts_power, cbBool(id.estop_cuts_power === true)]];
    if (id.product) ident.push([IDENTITY_K.product, cbTstr(id.product)]);
    if (id.fw_version) ident.push([IDENTITY_K.fw_version, cbTstr(id.fw_version)]);
    deliver(c, FRAME.WELCOME, 0, map([
      [K.proto_ver, cbUint(PROTO_VER)], [K.session_id, cbUint(c.sessionId)], [K.boot_id, cbUint(bootId)],
      [K.catalog_etag, cbBstr(etag)], [K.cfg_gen, cbUint(cfgGen)],
      [K.limits, map([[WELCOME_LIMITS_K.max_frame, cbUint(MAX_FRAME)],
        [WELCOME_LIMITS_K.max_subscriptions, cbUint(LIMITS.max_subscriptions_per_session)],
        [WELCOME_LIMITS_K.retained_pending, cbUint(retained.length)],
        [WELCOME_LIMITS_K.max_subscriptions_per_frame, cbUint(LIMITS.max_subscriptions_per_frame)]])],
      [K.roles, cbUint(c.roles)],
      [K.deadman_ms, cbUint(Math.min(LIMITS.deadman_max_ms, Math.max(LIMITS.deadman_min_ms, wish)))],
      [K.grants, cbArray(grants.map(grantMap))], [K.identity, map(ident)],
    ]));
    if (c.ready) for (const g of retained) pushState(c, g.ch);
  }

  function onBlobReq(c, h, payload) {
    const m = payload.length ? cbDecodeFull(payload) : new Map();
    const b = m.get(K.blob) instanceof Map ? m.get(K.blob) : new Map();
    const ns = b.get(BLOB_K.ns) ?? BLOB_NS.catalog;
    const want = Array.isArray(m.get(K.chunks)) ? m.get(K.chunks) : null;
    if (ns === BLOB_NS.catalog) { sendBlob(c, 0, 0, 0, 0, catalogBytes, want); return; }
    if (ns !== BLOB_NS.store) { nack(c, NACK.INVALID_NAMESPACE, h); return; }
    const sid = b.get(BLOB_K.store_id), slot = b.get(BLOB_K.slot);
    const st = stores.find((e) => e.store.storeId === sid);
    if (st && st.access > c.roles) { nack(c, NACK.ACCESS_DENIED, h, { ch: st.id }); return; }
    const item = st && items.get(sid * 256 + slot);
    if (!item) { nack(c, NACK.CHUNK_UNAVAILABLE, h); return; }
    sendBlob(c, ns, sid, slot, gens.get(sid) || 0, item, want);
  }

  function onCatalogReady(c) {
    if (c.ready) return;
    c.ready = true;
    for (const ch of c.subs) pushState(c, ch);
  }

  function receive(c, bytes) {
    if (bytes.length === ESTOP_FRAME_BYTES && bytes[0] === 0xe5 && bytes[1] === 0xe5 && bytes[2] === 0xe5 && bytes[3] === 0xe5) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      if (crc32(bytes.subarray(0, 8)) === dv.getUint32(8, true)) latchEstop();
      return;
    }
    for (const { header: h, payload } of parseFrames(bytes)) {
      try {
        switch (h.type) {
          case FRAME.HELLO: onHello(c, payload); break;
          case FRAME.CATALOG_READY: onCatalogReady(c); break;
          case FRAME.BLOB_REQ: onBlobReq(c, h, payload); break;
          case FRAME.CLOCK: {
            if (payload.length < 4) break;
            const out = new Uint8Array(12), dv = new DataView(out.buffer);
            const now = Math.floor((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 1000) >>> 0;
            out.set(payload.subarray(0, 4)); dv.setUint32(4, now, true); dv.setUint32(8, now, true);
            deliver(c, FRAME.CLOCK, 0, out);
            break;
          }
          case FRAME.PING: deliver(c, FRAME.PONG, h.channel, payload); break;
          case FRAME.SUBSCRIBE: {
            const wishes = cbDecodeFull(payload).get(K.subscriptions) || [];
            if (wishes.length > LIMITS.max_subscriptions_per_frame) { nack(c, NACK.SUBSCRIBE_REJECTED, h); break; }
            const grants = grantsFor(c, wishes, h, true);
            deliver(c, FRAME.GRANT, 0, map([[K.grants, cbArray(grants.map(grantMap))]]));
            if (c.ready) for (const g of grants) pushState(c, g.ch);
            break;
          }
          case FRAME.UNSUBSCRIBE: for (const ch of cbDecodeFull(payload) || []) c.subs.delete(ch); break;
          case FRAME.PUBLISH: deliver(c, FRAME.GRANT, 0, map([[K.grants, cbArray([])], [K.granted_publishes, cbArray([])]])); break;
          case FRAME.INTENT: onIntent(c, h, payload); break;
          case FRAME.PAIR_REQ: nack(c, NACK.PAIRING_DENIED, h, { detail: 'virtual hub' }); break;
          case FRAME.AUTH: nack(c, NACK.UNSUPPORTED_OP, h, { detail: 'virtual hub' }); break;
          default: break; // STREAM (never granted), BLOB_DONE, GOODBYE, PONG
        }
      } catch (e) {
        nack(c, NACK.MALFORMED, h, { detail: String(e && e.message) });
      }
    }
  }

  /** The WebSocket duck: one instance per connect, all on this one hub. */
  class LocalSocket {
    constructor(url) {
      this.url = url;
      this.protocol = WS_SUBPROTOCOL;
      this.binaryType = 'arraybuffer';
      this.readyState = 0;
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      this._c = { sock: this, ready: false, roles, subs: new Set(), echoes: new Map(),
        sessionId: ((Math.random() * 0xfffffffe) >>> 0) + 1 };
      later(() => {
        if (this.readyState !== 0) return;
        this.readyState = 1;
        conns.add(this._c);
        if (this.onopen) this.onopen({});
      });
    }
    send(data) {
      if (this.readyState !== 1) return;
      const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice ? data.slice(0) : data);
      later(() => { if (this.readyState === 1) receive(this._c, bytes); });
    }
    close(code = 1000, reason = '') {
      if (this.readyState >= 2) return;
      this.readyState = 3;
      conns.delete(this._c);
      // RFC-099: a session's end reverts its trials.
      const changed = new Set();
      if (endTrials(this._c.sessionId, false, changed)) cfgGen = (cfgGen + 1) & 0xffff;
      for (const ch of changed) broadcast(ch);
      later(() => { if (this.onclose) this.onclose({ code, reason, wasClean: true }); });
    }
  }

  return { WebSocket: LocalSocket, etag, snapshot: (ch) => snaps.get(ch) };
}
