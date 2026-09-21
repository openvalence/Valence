/**
 * frames.js — Valence 8-byte frame header + the wire numbers the registry does
 * not own.
 *
 * Every registry-defined vocabulary is RE-EXPORTED from generated/registry_vocab.js
 * (source of truth: spec/registry/registry.yaml, emitted by
 * tools/gen_registry_header.py, RFC-052(c)). Do not transcribe a registry number
 * into this file: the hand-copied tables that used to live here had drifted in
 * seven places, one of them silently mislabeling every settings tab in every
 * client. If you need a wire number the registry lacks, fix the registry first
 * (the spec-gap ritual, spec/RFC-QUEUE.md's own header).
 *
 * What legitimately stays hand-written here: facts whose home is catalog.cddl or
 * a device's own catalog rather than the registry, and the header codec itself.
 *
 * Frame header (SPEC §5.1), 8 bytes little-endian:
 *   [type:u8][flags:u8][channel:u16][seq:u16][len:u16]
 */

// Locally bound because the code below reads them; `export ... from` re-exports
// without creating a local binding.
import {
  CORE_CHANNEL, NACK, NACK_NAME, SAFETY_OP, HEADER_BYTES,
} from './generated/registry_vocab.js';

export {
  PROTO_VER, HEADER_BYTES, WS_SUBPROTOCOL, MDNS_SERVICE,
  FRAME, FRAME_NAME,
  K,
  IDENTITY_K, BLOB_K, BLOB_NS, TRUST_K, PRESENTATION_MODE, WELCOME_LIMITS_K,
  PROBE_RESULT_K, TRUST_LEDGER_K, TRUST_STATE,
  ACCESS, ACCESS_NAME, PRIORITY, CHANNEL_CLASS, CHANNEL_CLASS_NAME,
  PACKED, PACKED_NAME,
  SETTING_FLAG, STREAM_KIND,
  SAFETY_OP, SAFETY_CAUSE, SAFETY_CAUSE_NAME, SESSION_ADMIN_OP,
  SESSION_EVENT_KIND, SAFETY_EVENT_KIND, LOG_EVENT_KIND, PAIRING_EVENT_KIND,
  LOG_LEVEL, LOG_LEVEL_NAME,
  PAIRING_MODE, PAIRING_MODE_NAME, BLE_ADV_FLAG,
  NACK, NACK_NAME,
  PROCEDURE_PHASE, CURVE_FAMILY,
  // RFC-047/048 rendering metamodel — what a generic renderer binds to.
  UI_CATEGORY, UI_CATEGORY_NAME, UI_RANK, UI_RANK_NAME,
  VALUE_ASPECT, VALUE_ASPECT_NAME, VALUE_SCOPE, VALUE_SCOPE_NAME,
  VALUE_PROVENANCE, VALUE_PROVENANCE_NAME, UNIT_ID, UNIT_ID_NAME,
  UI_ARCHETYPE, UI_ARCHETYPE_NAME, UI_REGION, RENDERER_CLASS, WIDGET_PATTERN,
  FIELD_ROLE, ACTION_TAG,
  LIMITS,
} from './generated/registry_vocab.js';

// ---- Frame flags (registry header_flags) -----------------------------------
// Named individually rather than as a table because the codec below ORs them
// into a byte; a two-entry object would read worse at every call site.
export const FLAG_FRAG_START = 1 << 0; // header_flags FRAG_START
export const FLAG_FRAG_MORE = 1 << 1; // header_flags FRAG_MORE

// ---- Direction (spec §5.1: h2c=0, c2h=1) -----------------------------------
// Not a registry section — frame_types carry `dir` as prose, and the numbering
// is stated by the spec, so there is nothing to generate.
export const DIRECTION_NAME = ['h2c', 'c2h'];

/**
 * Wire size in bytes for each PackedFieldType.
 *
 * Hand-written on purpose: the widths are normative in spec/schema/catalog.cddl's
 * `packed-type` block, and registry.yaml's packed_field_types carries names only.
 * Index-aligned with PACKED — a new packed type needs a width added HERE too.
 */
export const PACKED_SIZE = [1, 1, 2, 2, 4, 4, 4, 1, 16, 32, 64];

// ---- CBOR schema field types (spec/schema/catalog.cddl `cbor-type`) --------
// Home is the CDDL, not registry.yaml — nothing to generate.
export const CBOR_FIELD = { uint_t: 0, int_t: 1, f32_t: 2, bool_t: 3, tstr_t: 4, bstr_t: 5 };
export const CBOR_FIELD_NAME = ['uint_t', 'int_t', 'f32_t', 'bool_t', 'tstr_t', 'bstr_t'];

// ---- Reserved registry channel ids -----------------------------------------
// Aliases onto the generated CORE_CHANNEL table, kept because call sites read
// better as CH_SAFETY than CORE_CHANNEL.safety. Derived, so they cannot drift.
export const CH_CATALOG = CORE_CHANNEL.catalog;
export const CH_SESSION_ROSTER = CORE_CHANNEL.session_roster;
export const CH_SAFETY = CORE_CHANNEL.safety;
export const CH_CONTROL_OWNER = CORE_CHANNEL.control_owner;
export const CH_SAFETY_INTENTS = CORE_CHANNEL.safety_intents;
export const CH_HUB_STATUS = CORE_CHANNEL.hub_status;
export const CH_SESSION_EVENTS = CORE_CHANNEL.session_events;
export const CH_LOG = CORE_CHANNEL.log;
export const CH_SESSION_ADMIN = CORE_CHANNEL.session_admin;
export const CH_PENDING_PAIRING = CORE_CHANNEL.pending_pairing;
export const CH_PAIRING_EVENTS = CORE_CHANNEL.pairing_events;
export const CH_PAIRED_DEVICES = CORE_CHANNEL.paired_devices;
export const CH_PAIRED_DEVICES_ROSTER = CORE_CHANNEL.paired_devices_roster;
export const CH_SAFETY_EVENTS = CORE_CHANNEL.safety_events;

// ---- Device channel ids (include/comms/ValenceCatalog.h ch::) -------------
// RFC-047 "Phase C2" renumbered these onto the new grid (Jul 2026). Values
// below are current; see the RFC for the old->new table if you need history.
export const CH_MOTION = 0x1100; // ch::motion (STATE)
export const CH_MACHINE_CONFIG = 0x1000; // ch::machine_config (STATE)
export const CH_PATTERN_STATE = 0x1200; // ch::pattern_state (STATE)
export const CH_ODOMETER = 0x1020; // ch::odometer (STATE)
export const CH_MOTION_INPUT = 0x2100; // ch::motion_input (STREAM c2h)
export const CH_MOTION_SEGMENT = 0x2101; // ch::motion_segment (STREAM c2h)
export const CH_PLAN_STRIP = 0x1110; // ch::plan_strip (STATE, 45 Hz diagnostics)
export const CH_POWER = 0x1010; // ch::power (STATE, only when the hardware exists)
export const CH_MOTION_DIAG = 0x1111; // ch::motion_diag (STATE, kinetic counters)
export const CH_MOTION_ANOMALY = 0x4100; // ch::motion_anomaly (EVENT)
// M5b: the four MODE settings the legacy :81/HTTP plane owned. A separate
// category from 0x1000 because that channel's RFC-009 enabled_mask is a
// bitfield8 with seven of eight bits already spoken for.
export const CH_MACHINE_MODES = 0x1030; // ch::machine_modes (STATE)
export const CH_MOVE = 0x3100; // ch::move (INTENT)
export const CH_CONFIG_SET = 0x3000; // ch::config_set (INTENT)
export const CH_PATTERN_CMD = 0x3200; // ch::pattern_cmd (INTENT)
export const CH_HOME = 0x3101; // ch::home (INTENT)
export const CH_MODES_SET = 0x3030; // ch::modes_set (INTENT)

/**
 * Ops any session may send regardless of role (RFC-025b) — safety outranks
 * authorization. estop(6) is RFC-010's client-assertable e-stop: the hub treats
 * it exactly as a valid 0xE5 frame (latch, cause=user, publish 0x0003, EVENT
 * twin). Derived from the generated table; the EXEMPTION is the fact this line
 * owns, and it lives here because it is a rule, not a vocabulary.
 */
export const SAFETY_OP_ROLE_EXEMPT = new Set([SAFETY_OP.stop, SAFETY_OP.estop]);

// ---- Home intent ops (ValenceCatalog.h 0x3101) ----------------------------
// A DEVICE channel's op numbering, not a registry vocabulary — a different hub
// may number its homing ops differently and still conform.
export const HOME_OP = { home: 1, force_home: 2, clear_override: 3 };

/**
 * GOODBYE reason codes. RFC-022.2: GOODBYE has NO separate code space — its
 * codes are DRAWN FROM `nack_codes`, which is why these are aliases and not
 * fresh numbers. Two clients had independently hand-written the 0x0107 literal
 * before this existed; naming it is the fix.
 */
export const GOODBYE_CODE = {
  NORMAL_CLOSURE: NACK.NORMAL_CLOSURE, // 0x0107 — clean voluntary teardown
  SESSION_EVICTED: NACK.SESSION_EVICTED,
  DEADMAN_TIMEOUT: NACK.DEADMAN_TIMEOUT,
  REBOOTING: NACK.REBOOTING,
  READY_TIMEOUT: NACK.READY_TIMEOUT,
  IDLE_REAPED: NACK.IDLE_REAPED, // RFC-039.4: housekeeping reap of a dark viewer, never a safety event
  BLOB_REFUSED: NACK.BLOB_REFUSED, // RFC-039.2: this client refusing an over-cap blob transfer
};

/**
 * §4.3: an unknown NACK code MUST be treated as the generic code of its range
 * (the high byte) — never an error, never a reason to disconnect.
 * @param {number} code
 * @returns {string}
 */
export function nackName(code) {
  if (code == null) return '?';
  if (code in NACK_NAME) return NACK_NAME[code];
  const range = (code >> 8) & 0xff;
  return 'UNKNOWN(0x' + code.toString(16).padStart(4, '0') + ', range 0x' + range.toString(16).padStart(2, '0') + '__)';
}

// ============================================================================
// Frame header build / parse — 8-byte little-endian
// ============================================================================

/**
 * Build a full frame (header + payload).
 * @param {number} type frame type byte (FRAME.*)
 * @param {number} channel target channel id (0 = session-scoped control)
 * @param {Uint8Array} [payload]
 * @param {number} [seq]
 * @param {number} [flags]
 * @returns {Uint8Array}
 */
export function encodeFrame(type, channel, payload = new Uint8Array(0), seq = 0, flags = 0) {
  const out = new Uint8Array(HEADER_BYTES + payload.length);
  const dv = new DataView(out.buffer);
  dv.setUint8(0, type);
  dv.setUint8(1, flags);
  dv.setUint16(2, channel, true);
  dv.setUint16(4, seq, true);
  dv.setUint16(6, payload.length, true);
  out.set(payload, HEADER_BYTES);
  return out;
}

// ---- The ESTOP frame (§5.5) — 12 bytes, OUTSIDE the header discipline ------
// E5 E5 E5 E5 | cause:u8 origin:u8 seq:u16 | crc32:u32   (all LE)
// crc32 is CRC-32/IEEE over the first 8 bytes. Deliberately recognizable
// WITHOUT deframing so a serial ISR or relay hot path can act on it — and, for
// this client, the reason a raw e-stop still works while the session is
// pre-READY: the hub matches the magic BEFORE header decode and before any
// readiness/occupancy gate (hub_impl.hpp::pumpSlot).
export const ESTOP_FRAME_BYTES = 12;

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32/IEEE (wire/crc32.hpp). @param {Uint8Array} bytes @returns {number} u32 */
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Build the 12-byte raw ESTOP frame.
 * @param {number} cause a SAFETY_CAUSE value (user for an operator press)
 * @param {number} origin the initiator's AccessLevel
 * @param {number} seq increments per INITIATION event (repeats share it, §5.5)
 * @returns {Uint8Array}
 */
export function encodeEstopFrame(cause, origin, seq) {
  const out = new Uint8Array(ESTOP_FRAME_BYTES);
  out[0] = 0xe5; out[1] = 0xe5; out[2] = 0xe5; out[3] = 0xe5;
  const dv = new DataView(out.buffer);
  dv.setUint8(4, cause & 0xff);
  dv.setUint8(5, origin & 0xff);
  dv.setUint16(6, seq & 0xffff, true);
  dv.setUint32(8, crc32(out.subarray(0, 8)), true);
  return out;
}

/**
 * Decode one 8-byte header from `buf` at `off`.
 * @param {Uint8Array} buf
 * @param {number} [off]
 * @returns {{type:number, flags:number, channel:number, seq:number, len:number}|null}
 */
export function decodeFrameHeader(buf, off = 0) {
  if (buf.length - off < HEADER_BYTES) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset + off, HEADER_BYTES);
  return {
    type: dv.getUint8(0),
    flags: dv.getUint8(1),
    channel: dv.getUint16(2, true),
    seq: dv.getUint16(4, true),
    len: dv.getUint16(6, true),
  };
}

/**
 * Split one binary WS message into its frames. Usually one frame per message,
 * but the hub MAY pack multiple BLOB_CHUNK frames back-to-back (§8.4), so a
 * receiver must walk the buffer. Returns [{header, payload}, ...].
 * @param {Uint8Array} buf
 * @returns {Array<{header:{type:number,flags:number,channel:number,seq:number,len:number}, payload:Uint8Array}>}
 */
export function parseFrames(buf) {
  const out = [];
  let off = 0;
  while (off + HEADER_BYTES <= buf.length) {
    const header = decodeFrameHeader(buf, off);
    if (!header) break;
    const start = off + HEADER_BYTES;
    const end = start + header.len;
    if (end > buf.length) break; // truncated / not our framing — stop
    out.push({ header, payload: buf.subarray(start, end) });
    off = end;
  }
  return out;
}
