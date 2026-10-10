// ============================================================================
// GENERATED FILE — DO NOT EDIT.
// Source of truth: spec/registry/registry.yaml
// Regenerate:      python tools/gen_registry_header.py   (--check in CI)
//
// The JS twin of generated/registry_constants.hpp (RFC-052(c)). Committed
// because clients/js is imported directly by browsers — there is no build
// step available to generate it on demand.
// ============================================================================

export const PROTO_VER = 1;
export const HEADER_BYTES = 8;
export const WS_SUBPROTOCOL = 'valence.v1';

// ---- frame_types ---------------------------------------------------
export const FRAME = {
  HELLO: 0x00,  // §6.2
  WELCOME: 0x01,  // §6.3
  PING: 0x03,  // §6.5
  PONG: 0x04,  // §6.5
  CLOCK: 0x05,  // §7.1
  SUBSCRIBE: 0x06,  // §6.6
  UNSUBSCRIBE: 0x07,  // §6.6
  GRANT: 0x08,  // §10.2
  STATE: 0x0b,  // §9.1
  STREAM: 0x0c,  // §9.2
  INTENT: 0x0d,  // §9.3
  ECHO: 0x0e,  // §9.3
  EVENT: 0x0f,  // §9.4
  NACK: 0x10,  // §16.1
  GOODBYE: 0x11,  // §6.8
  PROBE: 0x12,  // §6.4
  PROBE_REPORT: 0x13,  // §6.4
  PAIR_REQ: 0x14,  // §12.2
  PAIR_GRANT: 0x15,  // §12.2
  ACKMASK: 0x16,  // §13.3
  BEACON: 0x17,  // §13.7, §13.3.1
  PUBLISH: 0x18,  // §6.6
  CATALOG_READY: 0x19,  // §8.4
  BLOB_REQ: 0x1a,  // §8.4
  BLOB_CHUNK: 0x1b,  // §8.4
  AUTH: 0x1c,  // §12.2
  HUB_SIG: 0x1d,  // §12.2
  DISCOVER_PROBE: 0x1e,  // §13.8, §13.3.1
  DISCOVER_REPLY: 0x1f,  // §13.8
  BLOB_DONE: 0x20,  // §8.4
  JOIN_REQ: 0x21,  // §13.3.2
  JOIN_REPLY: 0x22,  // §13.3.2
  ESTOP: 0xe5,  // §5.5, §11.2
};
export const FRAME_NAME = {
  0x00: 'HELLO',
  0x01: 'WELCOME',
  0x03: 'PING',
  0x04: 'PONG',
  0x05: 'CLOCK',
  0x06: 'SUBSCRIBE',
  0x07: 'UNSUBSCRIBE',
  0x08: 'GRANT',
  0x0b: 'STATE',
  0x0c: 'STREAM',
  0x0d: 'INTENT',
  0x0e: 'ECHO',
  0x0f: 'EVENT',
  0x10: 'NACK',
  0x11: 'GOODBYE',
  0x12: 'PROBE',
  0x13: 'PROBE_REPORT',
  0x14: 'PAIR_REQ',
  0x15: 'PAIR_GRANT',
  0x16: 'ACKMASK',
  0x17: 'BEACON',
  0x18: 'PUBLISH',
  0x19: 'CATALOG_READY',
  0x1a: 'BLOB_REQ',
  0x1b: 'BLOB_CHUNK',
  0x1c: 'AUTH',
  0x1d: 'HUB_SIG',
  0x1e: 'DISCOVER_PROBE',
  0x1f: 'DISCOVER_REPLY',
  0x20: 'BLOB_DONE',
  0x21: 'JOIN_REQ',
  0x22: 'JOIN_REPLY',
  0xe5: 'ESTOP',
};

// ---- channel_classes -----------------------------------------------
export const CHANNEL_CLASS = {
  STATE: 0,  // §9.1
  STREAM: 1,  // §9.2
  INTENT: 2,  // §9.3
  EVENT: 3,  // §9.4
  STORE: 4,  // §8.7
};
export const CHANNEL_CLASS_NAME = {
  0: 'STATE',
  1: 'STREAM',
  2: 'INTENT',
  3: 'EVENT',
  4: 'STORE',
};

// ---- access_levels -------------------------------------------------
export const ACCESS = {
  watch: 0,
  control: 1,
  configure: 2,
};
export const ACCESS_NAME = {
  0: 'watch',
  1: 'control',
  2: 'configure',
};

// ---- priority_classes ----------------------------------------------
export const PRIORITY = {
  background: 0,
  normal: 1,
  elevated: 2,
  critical: 3,
};
export const PRIORITY_NAME = {
  0: 'background',
  1: 'normal',
  2: 'elevated',
  3: 'critical',
};

// ---- packed_field_types --------------------------------------------
export const PACKED = {
  u8: 0,
  i8: 1,
  u16: 2,
  i16: 3,
  u32: 4,
  i32: 5,
  f32: 6,
  bitfield8: 7,  // bit meanings enumerated in catalog entry
  str16: 8,  // 16 bytes, zero-padded UTF-8 (RFC-026). The default string width: session-roster names, device na
  str32: 9,  // 32 bytes, zero-padded UTF-8 (RFC-026)
  str64: 10,  // 64 bytes, zero-padded UTF-8 (RFC-026). 26% of a 242 B snapshot: use deliberately.
};
export const PACKED_NAME = {
  0: 'u8',
  1: 'i8',
  2: 'u16',
  3: 'i16',
  4: 'u32',
  5: 'i32',
  6: 'f32',
  7: 'bitfield8',
  8: 'str16',
  9: 'str32',
  10: 'str64',
};

// ---- core_channels -------------------------------------------------
export const CORE_CHANNEL = {
  catalog: 0x0001,  // layout etag_lo u32 + etag_hi u32 (the 8 etag bytes in wire order) + chunk_count u16 + entry_coun
  session_roster: 0x0002,  // RFC-047 §3: allocated and specified (RFC-018), NOT implemented: no reference catalog builder dec
  safety: 0x0003,  // latched safety word (§11.1, RFC-085): bit0 ESTOP, bit3 PAUSE; bits 1/2 (STOP/HOLD) retired, zero
  control_owner: 0x0004,  // owning session per arbiter source (§11.4). 4 slots {src<i> u8, owner<i> u32 (0 = unowned)} = 20 
  safety_intents: 0x0005,  // the three safety pairs (§11, RFC-085; safety_intent_ops): pause/resume, override/return, estop/r
  hub_status: 0x0006,  // boot_id, heap, uptime, transport stats. NO fw version: RFC-016 puts identity in WELCOME `identit
  session_events: 0x0007,  // join/leave/takeover/eviction notifications
  log: 0x0008,  // RFC-017: device log in-band: {level u8, tag, hub-ms, message <=128 B} via the `body` sub-map. Bo
  session_admin: 0x0009,  // RFC-018: {op: evict, session_id} -> hub GOODBYEs the target with SESSION_EVICTED. `configure` ac
  pending_pairing: 0x000a,  // RFC-027(a) knock-and-approve: the bounded pending list (pairing_pending_max) as protocol state: 
  pairing_events: 0x000b,  // RFC-027: knock arrived / approved / denied / expired, plus pairing-window open/close. EVENT twin
  paired_devices: 0x000c,  // trust-ledger store descriptor: {store_id, kind 'trust.ledger', capacity paired_devices_max, per_
  paired_devices_roster: 0x000d,  // the 0x000C store's roster: {generation u16, count u8, capacity u8}. On-change, tiny; a generatio
  safety_events: 0x000e,  // RFC/§9.4 duality: the EVENT TWIN of the `safety` STATE channel (0x0003). Kinds in `safety_event_
  provisioning: 0x000f,  // RFC-069 (§13.9), specified, not yet implemented by a reference hub: client-pushed network creden
  accessories: 0x0010,  // RFC-076 (§8.10): the accessory-record store, kind 'accessory.record', `watch` access, registered
  accessories_roster: 0x0011,  // RFC-076 (§8.10): {generation u16, count u8, capacity u8, online 4 x bitfield8, safe 4 x bitfield
  accessory_admin: 0x0012,  // RFC-076 (§8.10): `configure`; one op select with role action.accessory over `accessory_admin_ops
  relationships: 0x0013,  // RFC-078 (§8.11): the relationship store, kind 'relationship.map', `watch` access, registered ite
  relationships_roster: 0x0014,  // RFC-078 (§8.11): {generation u16, count u8, capacity u8, armed 2 x bitfield8, faulted 2 x bitfie
  relationships_write: 0x0015,  // RFC-078 (§8.11): `configure`; an action.store op select over store_ops (save creates/replaces, d
  settings_trial: 0x0016,  // RFC-099 (§9.3): `control`; one op select (key 1, role action.trial) over `trial_ops`: commit per
};
export const CORE_CHANNEL_NAME = {
  0x0001: 'catalog',
  0x0002: 'session-roster',
  0x0003: 'safety',
  0x0004: 'control-owner',
  0x0005: 'safety-intents',
  0x0006: 'hub-status',
  0x0007: 'session-events',
  0x0008: 'log',
  0x0009: 'session-admin',
  0x000a: 'pending-pairing',
  0x000b: 'pairing-events',
  0x000c: 'paired-devices',
  0x000d: 'paired-devices-roster',
  0x000e: 'safety-events',
  0x000f: 'provisioning',
  0x0010: 'accessories',
  0x0011: 'accessories-roster',
  0x0012: 'accessory-admin',
  0x0013: 'relationships',
  0x0014: 'relationships-roster',
  0x0015: 'relationships-write',
  0x0016: 'settings-trial',
};

// ---- cbor_keys -----------------------------------------------------
export const K = {
  proto_ver: 1,  // HELLO/WELCOME: protocol MAJOR (SPEC §1.4, RFC-102); never carries a minor
  client_kind: 2,  // e.g. webui, c5-remote, mobile, sim, tcode-bridge
  client_name: 3,  // human-readable, ≤32 UTF-8 bytes
  instance_id: 4,  // 8-byte stable client identity (§6.1)
  token: 5,  // 16-byte pairing token (§12.2); absent = viewer
  session_id: 6,  // u32, hub-assigned (§6.1)
  boot_id: 7,  // u32 random per hub boot (§7.2)
  catalog_etag: 8,  // 8-byte truncated SHA-256 (§8.3)
  cfg_gen: 9,  // u16 config generation (§4.2)
  subscriptions: 10,  // of {15:channel,12:rate,13:priority}
  publishes: 11,  // of {15:channel,12:rate,42:burst}: HELLO wishes and PUBLISH (0x18) renegotiation (RFC-013)
  rate_hz: 12,  // requested rate; 0 = on-change only
  priority: 13,  // priority class 0-3
  granted_rate_hz: 14,  // GRANT: applied rate after clamp (§10.2)
  channel_id: 15,  // u16
  code: 16,  // NACK/GOODBYE reason code (§16.1)
  detail: 17,  // optional human-readable diagnostic
  intent_id: 18,  // u16 idempotency id, session-scoped (§9.3)
  applied: 19,  // ECHO: post-clamp applied values
  value: 20,  // INTENT payload value(s) per catalog schema
  timestamp: 21,  // hub-ms (control plane events)
  limits: 22,  // WELCOME: hub limits (max_frame, max_subs, max_clients...)
  roles: 23,  // granted access level (max of session)
  deadman_ms: 24,  // WELCOME: applied deadman timeout for this session
  deadman_policy: 25,  // 0=stop(decel) 1=hold 2=none: per active-source rules §11.3
  probe_result: 26,  // PROBE_REPORT: {bytes, span_ms, loss_pct, rtt_ms}: sub-keys in `probe_result_keys`
  chunks: 27,  // BLOB_REQ repair: missing chunk indices. (Was 'CATALOG_REQ repair' pre-v1.0; the key is REUSED ra
  pin_proof: 28,  // PAIR_REQ: HMAC-SHA256(PIN, hello-nonce) truncated 16B (§12.2)
  nonce: 29,  // WELCOME: 8-byte pairing nonce
  precondition: 30,  // INTENT: expected cfg_gen (CAS guard, §9.3)
  retry_after_ms: 31,  // NACK BUSY: earliest reconnect time
  takeover: 32,  // safety-intent: forcible source takeover flag (§11.4)
  event_kind: 33,  // EVENT: kind discriminator per catalog entry
  seq_of_state: 34,  // EVENT: seq of the STATE twin frame it corresponds to (§9.4)
  grants: 35,  // WELCOME: batch grant results: array of {13:priority, 14:granted_rate_hz, 15:channel_id} (§6.3, §
  granted_publishes: 36,  // WELCOME / PUBLISH result: granted STREAM-ingress publishes: array of {14:granted_rate_hz, 15:cha
  identity: 37,  // WELCOME: hub identity (RFC-016): sub-keys in `identity_keys`. Capability discovery is CATALOG in
  blob: 38,  // BLOB_REQ / BLOB_CHUNK: which blob (RFC-021): sub-keys in `blob_keys`. A store CRUD INTENT carrie
  trust: 39,  // HELLO + WELCOME + AUTH: identity proof, signature material, token presentation, pairing modes (R
  body: 40,  // EVENT: the kind-specific fields. Integer keys come from the CHANNEL'S CATALOG `schema`, exactly 
  intent_seq: 41,  // NACK: seq of the frame being rejected (RFC-001). Hubs SHOULD populate it whenever a specific inb
  burst: 42,  // publishes / granted_publishes ENTRY maps: token-bucket capacity in samples, decoupled from rate 
  reboot_in_ms: 43,  // ECHO `applied` (19): this accepted intent commits by rebooting, in about this many ms (RFC-020).
  deadman_wish_ms: 44,  // HELLO: requested deadman window (RFC-038). The hub clamps into [deadman_min_ms, deadman_max_ms] 
  // 45 curve_family: RETIRED pre-tag by RFC-106 (operator 2026-10-08): the segment stream's family wish. A sender's d
  ws_port: 46,  // WELCOME: the hub's own WebSocket listening port (RFC-046 §3). Present on every binding but load-
  ipv4: 47,  // WELCOME: the hub's own IPv4 address (RFC-046 §3), packed big-endian into one u32 (e.g. 192.168.1
  // 48 requested_curve_family: RETIRED pre-tag by RFC-106 (operator 2026-10-08): the echo of the family wish (45). Never emitte
  schedule_latency_us: 49,  // granted_publishes ENTRY maps (RFC-059): the hub's declared fixed delay, in µs, between a sample'
  schedule_horizon_ms: 50,  // granted_publishes ENTRY maps (RFC-087), segments-kind grants only: the schedule horizon, how far
  trial: 51,  // INTENT (RFC-099, §9.3): true = a TRIAL write: applied, clamped, echoed and published like any wr
};
export const K_NAME = {
  1: 'proto_ver',
  2: 'client_kind',
  3: 'client_name',
  4: 'instance_id',
  5: 'token',
  6: 'session_id',
  7: 'boot_id',
  8: 'catalog_etag',
  9: 'cfg_gen',
  10: 'subscriptions',
  11: 'publishes',
  12: 'rate_hz',
  13: 'priority',
  14: 'granted_rate_hz',
  15: 'channel_id',
  16: 'code',
  17: 'detail',
  18: 'intent_id',
  19: 'applied',
  20: 'value',
  21: 'timestamp',
  22: 'limits',
  23: 'roles',
  24: 'deadman_ms',
  25: 'deadman_policy',
  26: 'probe_result',
  27: 'chunks',
  28: 'pin_proof',
  29: 'nonce',
  30: 'precondition',
  31: 'retry_after_ms',
  32: 'takeover',
  33: 'event_kind',
  34: 'seq_of_state',
  35: 'grants',
  36: 'granted_publishes',
  37: 'identity',
  38: 'blob',
  39: 'trust',
  40: 'body',
  41: 'intent_seq',
  42: 'burst',
  43: 'reboot_in_ms',
  44: 'deadman_wish_ms',
  46: 'ws_port',
  47: 'ipv4',
  49: 'schedule_latency_us',
  50: 'schedule_horizon_ms',
  51: 'trial',
};

// ---- welcome_limits_keys -------------------------------------------
export const WELCOME_LIMITS_K = {
  max_frame: 1,  // largest frame this hub accepts, bytes
  max_subscriptions: 2,  // per-session subscription cap
  retained_pending: 3,  // count of retained STATE pushes that will follow WELCOME
  max_subscriptions_per_frame: 4,  // RFC-033.3: most subscription wishes one SUBSCRIBE (or HELLO) frame may carry. Before this was ad
  max_sessions: 5,  // RFC-055 (§6.3): concurrent sessions this hub admits. 0 = unknown.
  sessions_in_use: 6,  // RFC-055 (§6.3): sessions occupying a slot, the admitted one included (STALE sessions count). 0 =
  osc_max_hz: 7,  // RFC-103 (§9.7): float, Hz: the highest frequency this hub's oscillator renders, from the hub's o
};

// ---- probe_result_keys ---------------------------------------------
export const PROBE_RESULT_K = {
  bytes_received: 1,  // bytes received during the probe burst
  span_ms: 2,  // wall time of the burst as observed by the client
  loss_pct_x100: 3,  // loss percentage x100 (2 decimal fixed-point)
  rtt_ms: 4,  // measured round-trip time, ms
};

// ---- identity_keys -------------------------------------------------
export const IDENTITY_K = {
  product: 1,  // tstr: product/model identifier, e.g. 'nucleus' (<=32 B)
  fw_version: 2,  // tstr: the hub's MAJOR.MINOR, e.g. '1.2' (<=24 B); the patch never rides the wire (RFC-102, SPEC 
  hub_name: 3,  // tstr: operator-assigned machine name (<=32 B). Writable as a str16/str32 setting (RFC-026) where
  info: 4,  // map: OPTIONAL device-defined extras (hardware rev, build date...). Keys are device-defined tstr;
  hub_instance_id: 5,  // uint (u64): RFC-048, operator veto of an RFC-046 decision. DURABLE hub identity: generated once 
  estop_cuts_power: 6,  // bool: RFC-085 (§11.2). Whether this hub's ESTOP cuts motor power (true: category 0, the machine 
};

// ---- blob_keys -----------------------------------------------------
export const BLOB_K = {
  ns: 1,  // uint: which blob space: see `blob_namespaces`. (Named `ns`, not `namespace`: the generated C++ c
  store_id: 2,  // uint u8: which store within blob_namespaces.store; absent/0 for the catalog namespace. Declared 
  slot: 3,  // uint u8: item index within the store, 0..capacity-1
  generation: 4,  // uint u16: the roster generation this request/response is consistent with. Lets a client notice i
  name: 5,  // tstr: item name, <= the store's declared name_max
  kind: 6,  // tstr: namespaced payload kind, e.g. 'pattern.frayd'. The hub validates kind + size on import and
  payload: 7,  // bstr: the opaque item document (<= preset_item_max_bytes / the store's per_item_max). Present on
  chunk_index: 8,  // uint: 0-based index of this chunk
  chunk_count: 9,  // uint: total chunks in this transfer
  total_bytes: 10,  // uint: total encoded byte length being transferred (lets a receiver size/reject before assembling
  digest: 11,  // bstr: RFC-073, OPTIONAL on a store item map: SHA-256 (32 B) over `payload` alone. The receiver's
};

// ---- trust_keys ----------------------------------------------------
export const TRUST_K = {
  client_ver: 1,  // tstr: HELLO, client software version (<=24 B). The CHANGE TRIPWIRE: an observed version change d
  client_nonce: 2,  // bstr: HELLO: 8 bytes of CLIENT entropy. The hub signs client_nonce || session_id || boot_id. Thi
  sig_request: 3,  // bool: HELLO, 'please sign my nonce'. Signing is ON REQUEST because the S3 has no ECC accelerator
  hub_pubkey: 4,  // bstr: PAIR_GRANT, SEC1-compressed P-256 public key (33 B). Delivered AT THE PAIRING CEREMONY, i.
  welcome_sig: 5,  // bstr: WELCOME or HUB_SIG (0x1D): deterministic ECDSA-P256 (RFC 6979) signature over the 16-byte 
  token_proof: 6,  // bstr: AUTH: HMAC-SHA256(token, WELCOME nonce) truncated to 16 B. Costs ONE extra round trip per 
  presentation_mode: 7,  // uint: how the client presents its token: 0 = bearer (raw 16 B in HELLO; legal, the potato floor 
  pairing_modes: 8,  // uint: WELCOME: BITMASK of `pairing_modes` this hub currently offers, RE-EVALUATED PER SESSION so
};

// ---- trust_ledger_keys ---------------------------------------------
export const TRUST_LEDGER_K = {
  instance_id: 1,  // bstr: the device's 8-byte stable identity (§6.1): the ledger's primary key, and the value a `ses
  kind: 2,  // tstr: the `client_kind` this device presented (<=16 B, HELLO key 2). Recorded so a roster can sa
  name: 3,  // tstr: the `client_name` this device presented (<=16 B here; HELLO allows 32 and the ledger trunc
  version: 4,  // tstr: the `trust`.client_ver observed when the role was last approved (<=24 B). The value the RF
  first_seen: 5,  // uint: UNIX epoch seconds when this device was first paired, or 0 for unknown. ZERO IS THE HONEST
  last_seen: 6,  // uint: UNIX epoch seconds of the most recent HELLO from this device, or 0 for unknown. Same wall-
  role: 7,  // uint: the granted `access_levels` value. While `state` is recognized_pending this is the SUSPEND
  state: 8,  // uint: a `trust_states` value.
  presentation_mode: 9,  // uint: the `trust`.presentation_mode this device last used (0 bearer / 1 proof). RFC-029.6 requir
  pairing_mode: 10,  // uint: the single `pairing_modes` BIT this device paired through (1 knock_approve / 2 pin_proof /
};

// ---- trust_states --------------------------------------------------
export const TRUST_STATE = {
  trusted: 0,  // paired, and the version observed at the last HELLO matches the version recorded when the role wa
  recognized_pending: 1,  // RFC-029 item 2's tripwire fired: this device presented a DIFFERENT `client_ver` than the ledger 
};
export const TRUST_STATE_NAME = {
  0: 'trusted',
  1: 'recognized_pending',
};

// ---- presentation_modes --------------------------------------------
export const PRESENTATION_MODE = {
  bearer: 0,  // raw 16-byte token in HELLO. LEGAL, DEFAULT, and the potato floor: a coin-cell client does exactl
  proof: 1,  // HMAC-SHA256(key = token, message = the WELCOME nonce) truncated to 16 B, presented in an AUTH (0
};
export const PRESENTATION_MODE_NAME = {
  0: 'bearer',
  1: 'proof',
};

// ---- blob_namespaces -----------------------------------------------
export const BLOB_NS = {
  catalog: 0,  // the hub's channel catalog (§8.4). store_id/slot absent. This is the ONLY namespace with a READY 
  store: 1,  // items in a catalog-declared STORE-class channel: store_id picks the store, slot picks the item. 
};
export const BLOB_NS_NAME = {
  0: 'catalog',
  1: 'store',
};

// ---- session_event_kinds -------------------------------------------
export const SESSION_EVENT_KIND = {
  takeover: 1,  // control source ownership transferred (§11.4)
  session_joined: 2,  // a session reached GRANTED
  session_left: 3,  // a session ended (any reason)
  session_stale: 4,  // RFC-042: a session's silence exceeded its liveness window (deadman for a source-owner, idle reap
  session_resumed: 5,  // RFC-042: a STALE session returned to LIVE, either by any frame arriving on its still-attached tr
};
export const SESSION_EVENT_KIND_NAME = {
  1: 'takeover',
  2: 'session_joined',
  3: 'session_left',
  4: 'session_stale',
  5: 'session_resumed',
};

// ---- log_event_kinds -----------------------------------------------
export const LOG_EVENT_KIND = {
  entry: 1,  // a log line was published (fields ride `body`: level, tag, hub-ms, message)
};
export const LOG_EVENT_KIND_NAME = {
  1: 'entry',
};

// ---- pairing_event_kinds -------------------------------------------
export const PAIRING_EVENT_KIND = {
  knocked: 1,  // a PAIR_REQ joined the pending list (0x000A): knock-and-approve or PIN mode (RFC-027.2)
  granted: 2,  // a pending knock (or an existing device's re-approval) was granted a role, via PAIR_GRANT or the 
  denied: 3,  // a pending knock was denied by a `configure` session
  expired: 4,  // a pending knock's window elapsed unanswered (pairing_window_default_s)
  window_opened: 5,  // a pairing association window opened (push-to-pair boot gesture, or a mode newly advertised in `t
  window_closed: 6,  // the pairing association window closed
  revoked: 7,  // a paired device's token was revoked from the trust ledger (RFC-018 admin surface, store 0x000C)
  recognized_pending: 8,  // RFC-029 item 2: a paired device's observed `client_ver` changed; state dropped trusted -> RECOGN
  accessory_refused: 9,  // RFC-077: an accessory join was refused (body: accessory_id, result as a `join_results` value), s
};
export const PAIRING_EVENT_KIND_NAME = {
  1: 'knocked',
  2: 'granted',
  3: 'denied',
  4: 'expired',
  5: 'window_opened',
  6: 'window_closed',
  7: 'revoked',
  8: 'recognized_pending',
  9: 'accessory_refused',
};

// ---- safety_event_kinds --------------------------------------------
export const SAFETY_EVENT_KIND = {
  estop_latched: 1,  // the ESTOP bit went 0 -> 1 (§5.5). `body` carries word/cause/owner_session/estop_seq. Cause is a 
  estop_cleared: 2,  // the ESTOP bit went 1 -> 0 via §11.2's guarded `release` (the hub's and delegate's preconditions)
  pause_latched: 3,  // RFC-085 (was stop_latched): the PAUSE bit went 0 -> 1. Cause distinguishes an operator pause (us
  pause_cleared: 4,  // RFC-085 (was stop_cleared): the PAUSE bit went 1 -> 0, only ever by `resume`.
};
export const SAFETY_EVENT_KIND_NAME = {
  1: 'estop_latched',
  2: 'estop_cleared',
  3: 'pause_latched',
  4: 'pause_cleared',
};

// ---- log_levels ----------------------------------------------------
export const LOG_LEVEL = {
  trace: 0,  // geiger::Level::Trace (GLOGT)
  debug: 1,  // geiger::Level::Debug (GLOGD)
  info: 2,  // geiger::Level::Info (GLOGI)
  warn: 3,  // geiger::Level::Warn (GLOGW)
  error: 4,  // geiger::Level::Error (GLOGE)
  fatal: 5,  // geiger::Level::Fatal (GLOGF)
};
export const LOG_LEVEL_NAME = {
  0: 'trace',
  1: 'debug',
  2: 'info',
  3: 'warn',
  4: 'error',
  5: 'fatal',
};

// ---- safety_intent_ops ---------------------------------------------
export const SAFETY_OP = {
  release: 1,  // RFC-085 (was estop_clear): release the ESTOP latch (§11.2 preconditions; NACK CLEAR_REFUSED othe
  pause: 4,  // RFC-085: latch PAUSE (§11.1): decelerate, hold position, every source suspended, stream bundles 
  resume: 5,  // the only clear of PAUSE (§11.1). Refused ESTOP_ACTIVE while ESTOP is latched, INTERLOCK while ov
  estop: 6,  // ASSERT e-stop (RFC-010). ROLE-EXEMPT. The hub treats it exactly as a valid 0xE5 frame: latch, ca
  override: 7,  // RFC-085 (was override_on; merges the former bypass): latch the override mode, carrying PAUSE: th
  return_op: 8,  // RFC-085, the `return` op (was override_off; registry identifier `return_op` only because `return
};
export const SAFETY_OP_NAME = {
  1: 'release',
  4: 'pause',
  5: 'resume',
  6: 'estop',
  7: 'override',
  8: 'return_op',
};

// ---- session_admin_ops ---------------------------------------------
export const SESSION_ADMIN_OP = {
  evict: 1,  // RFC-018: GOODBYE the session named by `session_id` with SESSION_EVICTED. Runs the full §6.8/RFC-
  pair_approve: 2,  // RFC-027(a): approve the pending knock named by `instance_id` at `role`, issuing PAIR_GRANT {toke
  pair_deny: 3,  // RFC-027(a): drop the pending knock named by `instance_id` without issuing a token; emits pairing
  revoke: 4,  // RFC-027(4)/029: delete `instance_id` from the trust ledger. Revocation is PROTOCOL, not a WebUI 
};
export const SESSION_ADMIN_OP_NAME = {
  1: 'evict',
  2: 'pair_approve',
  3: 'pair_deny',
  4: 'revoke',
};

// ---- safety_causes -------------------------------------------------
export const SAFETY_CAUSE = {
  user: 0,  // operator-initiated (physical button, UI, safety-intents `estop`/`pause`): §5.5
  deadman: 1,  // §11.3 deadman window actually elapsed (silence timeout, not some other way the session ended: se
  fault: 2,  // hub/driver-detected fault
  relay: 3,  // relay-originated (segment-local safety event): §5.5
  session_loss: 4,  // RFC-022.3: the owning session ended by ANY non-deadman teardown path (GOODBYE, rude detach, eith
};
export const SAFETY_CAUSE_NAME = {
  0: 'user',
  1: 'deadman',
  2: 'fault',
  3: 'relay',
  4: 'session_loss',
};

// ---- source_kinds --------------------------------------------------
export const SOURCE_KIND = {
  jog: 0,  // a manual point move. Never takes the rail from another source (RFC-085); released when its move 
  stream: 1,  // c2h STREAM motion input. Released when its last admitted bundle has played out and nothing arriv
  classic: 2,  // the hub's classic pattern generator (RFC-093). Released on stop.
  advanced: 3,  // the hub's advanced generator (RFC-093). Released on stop.
  remote: 4,  // a hand-held remote driving the rail through the hub. Released when its source is quiet.
  reserved: 5,  // the slot names no source: never owned, never drawn.
};
export const SOURCE_KIND_NAME = {
  0: 'jog',
  1: 'stream',
  2: 'classic',
  3: 'advanced',
  4: 'remote',
  5: 'reserved',
};

// ---- stream_kinds --------------------------------------------------
export const STREAM_KIND = {
  samples: 0,  // dense points reporting a value AT AN INSTANT (§9.2); a dropped sample is recoverable by interpol
  segments: 1,  // each sample COMMANDS A TIME EXTENT: it carries its own duration, so it is not a point on a conti
};
export const STREAM_KIND_NAME = {
  0: 'samples',
  1: 'segments',
};

// ---- procedure_phases ----------------------------------------------
export const PROCEDURE_PHASE = {
  idle: 0,  // not running; the reconnect-safe resting value
  running: 1,  // started and in progress; `progress` 0-100 is advisory
  succeeded: 2,  // terminal, ok. Also EVENTed (RFC-020).
  failed: 3,  // terminal, error: `result` u16 carries a nack_codes value or a device code
  aborted: 4,  // terminal, canceled or superseded
};
export const PROCEDURE_PHASE_NAME = {
  0: 'idle',
  1: 'running',
  2: 'succeeded',
  3: 'failed',
  4: 'aborted',
};

// ---- curve_families ------------------------------------------------
export const CURVE_FAMILY = {
  // 0 unspecified: RETIRED pre-tag by RFC-106: no declaration. Never emitted, never reused.
  // 1 g1: RETIRED pre-tag by RFC-106: a velocity-continuous sender. Never emitted, never reused.
  // 2 g2: RETIRED pre-tag by RFC-106: an acceleration-continuous sender. Never emitted, never reused.
  // 3 step: RETIRED pre-tag by RFC-106: a held value with instantaneous transitions. Never emitted, never re
};
export const CURVE_FAMILY_NAME = {
};

// ---- osc_shapes ----------------------------------------------------
export const OSC_SHAPE = {
  sine: 0,  // -cos: trough at phase 0, crest at the half cycle. With a dwell, each half is a rest-to-rest quin
  square: 1,  // a rising quintic edge at phase 0, the crest held, a falling edge at the half cycle, the trough h
  saw: 2,  // a linear rise over most of the period, then a quintic flyback whose slope matches the ramp at bo
  saw_reverse: 3,  // saw mirrored in time: the flyback rises, the ramp falls. Ignores the dwells.
};
export const OSC_SHAPE_NAME = {
  0: 'sine',
  1: 'square',
  2: 'saw',
  3: 'saw_reverse',
};

// ---- osc_drives ----------------------------------------------------
export const OSC_DRIVE = {
  fixed: 0,  // the parameter is its own field's value; the bounds are unused
  speed: 1,  // the magnitude of the commanded speed the oscillator rides, in the unit of the hub's telemetry.ve
  position: 2,  // the commanded position the oscillator rides, in the unit of the hub's telemetry.target field
  axis: 3,  // the osc.drive stream's field of the same name (amplitude or frequency), 0 .. 1; 0 once the strea
};
export const OSC_DRIVE_NAME = {
  0: 'fixed',
  1: 'speed',
  2: 'position',
  3: 'axis',
};

// ---- nack_codes ----------------------------------------------------
export const NACK = {
  MALFORMED: 0x0000,  // undecodable frame/CBOR
  UNSUPPORTED_VERSION: 0x0001,  // HELLO proto_ver not servable
  FRAME_TOO_LARGE: 0x0002,  // exceeds negotiated max_frame
  PROFILE_VIOLATION: 0x0003,  // CBOR not in deterministic profile
  BUSY: 0x0100,  // refused per-request work (concurrent blob transfers, §8.4 row 4); carries retry_after_ms. RFC-05
  UNAUTHORIZED: 0x0101,  // token invalid/revoked
  NOT_CONTROLLER: 0x0102,  // control op without controller role
  PAIRING_REQUIRED: 0x0103,  // controller requested, no token, pairing window closed
  PAIRING_DENIED: 0x0104,  // bad pin_proof or pairing window closed
  SESSION_EVICTED: 0x0105,  // admin kick (GOODBYE code). RFC-051 narrowed this from slow-consumer stalls, which now PARK the s
  DUPLICATE_INSTANCE: 0x0106,  // instance_id already in live session; old session evicted instead: see §6.8
  NORMAL_CLOSURE: 0x0107,  // clean voluntary teardown (GOODBYE code, either direction): not an error
  DEADMAN_TIMEOUT: 0x0108,  // hub-initiated session teardown: silence exceeded the deadman window (§11.3, GOODBYE code)
  REBOOTING: 0x0109,  // hub is committing a change by rebooting and is closing every session first (RFC-020/022.2, GOODB
  READY_TIMEOUT: 0x010a,  // session never sent CATALOG_READY within catalog_ready_timeout_ms (RFC-015, GOODBYE code). Needed
  NOT_READY: 0x010b,  // frame refused because the session has not sent CATALOG_READY yet (RFC-015). READY gates BOTH pla
  IDLE_REAPED: 0x010c,  // RFC-039.4: hub-initiated teardown of a NON-OWNING session that fell silent past idle_reap_multip
  SLOT_RECLAIMED: 0x010d,  // RFC-042: a HELLO that would otherwise NACK HUB_AT_CAPACITY (BUSY before RFC-055) instead evicted
  HUB_AT_CAPACITY: 0x010e,  // RFC-055 (§6.3): HELLO refused because max_sessions are in use (incumbents are never degraded to 
  HUB_SHEDDING: 0x010f,  // RFC-055 (§6.3): HELLO or connection refused because the hub is protecting itself (resource press
  UNKNOWN_CHANNEL: 0x0200,  // channel id not in catalog
  ACCESS_DENIED: 0x0201,  // channel access level above session role
  CLASS_MISMATCH: 0x0202,  // e.g. SUBSCRIBE to an INTENT channel
  SUB_LIMIT: 0x0203,  // per-session subscription cap reached
  SUBSCRIBE_REJECTED: 0x0204,  // RFC-033.2: the SUBSCRIBE frame as a WHOLE could not be processed (undecodable, or more wishes th
  CHANNEL_WITHDRAWN: 0x0205,  // RFC-077 (§8.6): UNSOLICITED, one per withdrawn subscription or publication grant, carrying `chan
  CONFLICT: 0x0300,  // precondition (cfg_gen CAS) failed
  RATE_LIMITED: 0x0301,  // ingress intent rate exceeded
  INVALID_VALUE: 0x0302,  // outside schema min/max or wrong type; also a store import whose kind or size the hub refuses (RF
  UNSUPPORTED_OP: 0x0303,  // intent op not implemented on this hub
  NETWORK_JOIN_FAILED: 0x0304,  // RFC-069: a provisioning `wifi_join` (§13.9) did not join (wrong passphrase, no such network, tim
  ACCESSORY_OFFLINE: 0x0305,  // RFC-076 (§8.10): a write to a paired accessory that is not reachable right now (absent, or no an
  ACCESSORY_CAPACITY: 0x0306,  // RFC-077 (§8.10): accessory-admin window_open refused because the host has no free slice, no free
  TRIAL_CONFLICT: 0x0307,  // RFC-099 (§9.3): a write, trial or durable, to a key in ANOTHER session's open trial set. The who
  ESTOP_ACTIVE: 0x0400,  // refused while e-stop latched
  NOT_HOMED: 0x0401,  // motion intent before homing
  INTERLOCK: 0x0402,  // hub-specific safety interlock
  SOURCE_CONFLICT: 0x0403,  // another session owns this arbiter source
  TAKEOVER_REQUIRED: 0x0404,  // control exists; retry with takeover flag
  CLEAR_REFUSED: 0x0405,  // e-stop clear conditions not met (§11.2)
  CHUNK_UNAVAILABLE: 0x0500,  // blob chunk index out of range, or a store/slot that does not exist WITHIN a registered namespace
  REASSEMBLY_TIMEOUT: 0x0501,  // fragment reassembly abandoned (5 s)
  ETAG_MISMATCH: 0x0502,  // static-profile client etag != hub catalog etag
  BLOB_REFUSED: 0x0503,  // RFC-039.2: a RECEIVER refusing a declared blob (total_bytes over its reassembly budget), sent as
  INVALID_NAMESPACE: 0x0504,  // RFC-049e: a BLOB_REQ naming a `blob.ns` value not in the registered `blob_namespaces` table (0 c
};
export const NACK_NAME = {
  0x0000: 'MALFORMED',
  0x0001: 'UNSUPPORTED_VERSION',
  0x0002: 'FRAME_TOO_LARGE',
  0x0003: 'PROFILE_VIOLATION',
  0x0100: 'BUSY',
  0x0101: 'UNAUTHORIZED',
  0x0102: 'NOT_CONTROLLER',
  0x0103: 'PAIRING_REQUIRED',
  0x0104: 'PAIRING_DENIED',
  0x0105: 'SESSION_EVICTED',
  0x0106: 'DUPLICATE_INSTANCE',
  0x0107: 'NORMAL_CLOSURE',
  0x0108: 'DEADMAN_TIMEOUT',
  0x0109: 'REBOOTING',
  0x010a: 'READY_TIMEOUT',
  0x010b: 'NOT_READY',
  0x010c: 'IDLE_REAPED',
  0x010d: 'SLOT_RECLAIMED',
  0x010e: 'HUB_AT_CAPACITY',
  0x010f: 'HUB_SHEDDING',
  0x0200: 'UNKNOWN_CHANNEL',
  0x0201: 'ACCESS_DENIED',
  0x0202: 'CLASS_MISMATCH',
  0x0203: 'SUB_LIMIT',
  0x0204: 'SUBSCRIBE_REJECTED',
  0x0205: 'CHANNEL_WITHDRAWN',
  0x0300: 'CONFLICT',
  0x0301: 'RATE_LIMITED',
  0x0302: 'INVALID_VALUE',
  0x0303: 'UNSUPPORTED_OP',
  0x0304: 'NETWORK_JOIN_FAILED',
  0x0305: 'ACCESSORY_OFFLINE',
  0x0306: 'ACCESSORY_CAPACITY',
  0x0307: 'TRIAL_CONFLICT',
  0x0400: 'ESTOP_ACTIVE',
  0x0401: 'NOT_HOMED',
  0x0402: 'INTERLOCK',
  0x0403: 'SOURCE_CONFLICT',
  0x0404: 'TAKEOVER_REQUIRED',
  0x0405: 'CLEAR_REFUSED',
  0x0500: 'CHUNK_UNAVAILABLE',
  0x0501: 'REASSEMBLY_TIMEOUT',
  0x0502: 'ETAG_MISMATCH',
  0x0503: 'BLOB_REFUSED',
  0x0504: 'INVALID_NAMESPACE',
};

// ---- ui_categories -------------------------------------------------
export const UI_CATEGORY = {
  generator: 1,  // RFC-094 (was `control`): driving the machine now: the generators and patterns, move, streams
  motion: 2,  // live physical telemetry; since RFC-094 also the engine internals and calibration that were `tuni
  safety: 3,  // faults, interlocks, e-stop state: the stop affordance itself is rank-pinned (ui_ranks), not a me
  limits: 4,  // window + ceilings
  // 5 library: RETIRED pre-tag by RFC-094: folded into `system` (13) under subgroup Library. Never reissued.
  playback: 6,  // hub-local content transport: play/pause/seek/queue
  auxiliary: 7,  // secondary actuators: heat, lube, suction, inflation
  automation: 8,  // routines, schedules, scenes
  // 9 tuning: RETIRED pre-tag by RFC-094: folded into `motion` (2) under subgroup Tuning. Never reissued.
  hardware: 10,  // geometry, drive config, sensors, homing
  network: 11,  // WiFi/BLE state, endpoints, provisioning
  session: 12,  // clients, roles, ownership, pairing/trust
  system: 13,  // diagnostics and configuration: power, thermals, memory, firmware, logs; since RFC-094 also the s
  other: 14,  // the defined overflow: every unrecognized category id (including an untaught vendor id) renders h
  setup: 15,  // RFC-079: the machine COMMISSIONING surface: network credentials (provisioning 0x000F), machine n
};
export const UI_CATEGORY_NAME = {
  1: 'generator',
  2: 'motion',
  3: 'safety',
  4: 'limits',
  6: 'playback',
  7: 'auxiliary',
  8: 'automation',
  10: 'hardware',
  11: 'network',
  12: 'session',
  13: 'system',
  14: 'other',
  15: 'setup',
};

// ---- ui_categories tier (RFC-094, RENDERING.md §3) ----------------------
export const UI_CATEGORY_TIER = {
  1: 1,  // generator
  2: 1,  // motion
  3: 1,  // safety
  4: 1,  // limits
  6: 1,  // playback
  7: 1,  // auxiliary
  8: 1,  // automation
  10: 1,  // hardware
  11: 2,  // network
  12: 2,  // session
  13: 1,  // system
  14: 1,  // other
  15: 1,  // setup
};
export const UI_NAV_TIER_CATEGORIES = {
  1: [1, 2, 3, 4, 6, 7, 8, 10, 13, 14, 15],
  2: [11, 12],
  3: [],
};

// ---- ui_nav_tiers --------------------------------------------------
export const UI_NAV_TIER = {
  machine: 1,  // things on the machine: every tier-1 category, every vendor id and every unrecognized id
  link: 2,  // things on or between the machine and its clients: `network` (11), `session` (12), and the render
  client: 3,  // renderer-local settings (display, plugins, saved hubs, an embedded server). No category and no c
};
export const UI_NAV_TIER_NAME = {
  1: 'machine',
  2: 'link',
  3: 'client',
};

// ---- ui_ranks ------------------------------------------------------
export const UI_RANK = {
  hero: 0,  // the machine's face; surfaced by default on every renderer class
  control: 1,  // everyday driving controls; surfaced by default on handheld/full, one navigation step away on gla
  detail: 2,  // useful but not primary; reachable, not surfaced
  advanced: 3,  // the `setting_flags.advanced` bit's migration into this ladder; hidden behind an advanced afforda
  diagnostic: 4,  // reachable on every class; a renderer MAY choose to omit it under its own display budget, but tha
  hidden: 5,  // carried on the wire for compatibility, NEVER rendered: the honest home for an inert-but-released
};
export const UI_RANK_NAME = {
  0: 'hero',
  1: 'control',
  2: 'detail',
  3: 'advanced',
  4: 'diagnostic',
  5: 'hidden',
};

// ---- value_aspects -------------------------------------------------
export const VALUE_ASPECT = {
  live: 0,  // the value now (default)
  peak: 1,  // highest observed
  min: 2,  // lowest observed
  mean: 3,  // average observed
  total: 4,  // cumulative (an odometer figure)
  rate: 5,  // a derivative/frequency quantity
};
export const VALUE_ASPECT_NAME = {
  0: 'live',
  1: 'peak',
  2: 'min',
  3: 'mean',
  4: 'total',
  5: 'rate',
};

// ---- value_scopes --------------------------------------------------
export const VALUE_SCOPE = {
  session: 0,  // since this client connected (default)
  lifetime: 1,  // since the device was manufactured/last factory-reset
  window: 2,  // a bounded rolling window, device-defined width
};
export const VALUE_SCOPE_NAME = {
  0: 'session',
  1: 'lifetime',
  2: 'window',
};

// ---- value_provenance ----------------------------------------------
export const VALUE_PROVENANCE = {
  demand: 0,  // the raw requested value
  planned: 1,  // the target the planner is currently aiming for
  actual: 2,  // the measured value (default). demand/planned/actual are one quantity at three stages; the axis a
};
export const VALUE_PROVENANCE_NAME = {
  0: 'demand',
  1: 'planned',
  2: 'actual',
};

// ---- unit_ids ------------------------------------------------------
export const UNIT_ID = {
  mm: 0,  // length
  mm_s: 1,  // speed (mm/s)
  mm_s2: 2,  // acceleration (mm/s²)
  mm_s3: 3,  // jerk (mm/s³)
  normalized: 4,  // 0-1
  percent: 5,  // %
  hz: 6,  // Hz
  ms: 7,  // milliseconds
  s: 8,  // seconds
  v: 9,  // volts
  a: 10,  // amps
  w: 11,  // watts
  wh: 12,  // watt-hours
  deg_c: 13,  // °C
  count: 14,  // dimensionless count
  bytes: 15,  // data size
  db: 16,  // decibels
  n: 17,  // force, over-provisioned: force-feedback actuators
  kpa: 18,  // pressure, over-provisioned: suction/inflation
  ml: 19,  // volume, over-provisioned: lube dosing
  ml_min: 20,  // flow rate, over-provisioned: lube dosing
  rpm: 21,  // rotational speed, over-provisioned: rotary actuators
  bpm: 22,  // beats per minute, over-provisioned: bio-sync accessories
  deg: 23,  // RFC-086: angle in degrees. Radians are a math convenience, not a knob unit.
  us: 24,  // RFC-086: microseconds, the §7 hub-time resolution (only ms and s were registered)
  hub_s: 25,  // RFC-086: seconds in the hub's own §7.1 timebase, distinct from `s` so a client knows to apply it
};
export const UNIT_ID_NAME = {
  0: 'mm',
  1: 'mm_s',
  2: 'mm_s2',
  3: 'mm_s3',
  4: 'normalized',
  5: 'percent',
  6: 'hz',
  7: 'ms',
  8: 's',
  9: 'v',
  10: 'a',
  11: 'w',
  12: 'wh',
  13: 'deg_c',
  14: 'count',
  15: 'bytes',
  16: 'db',
  17: 'n',
  18: 'kpa',
  19: 'ml',
  20: 'ml_min',
  21: 'rpm',
  22: 'bpm',
  23: 'deg',
  24: 'us',
  25: 'hub_s',
};

// ---- store_ops -----------------------------------------------------
export const STORE_OP = {
  save: 1,  // capture current live state into the slot; a supplied `payload` makes it an import (§8.7)
  load: 2,  // apply the slot; the resulting truth arrives on the ordinary STATE broadcasts
  delete_item: 3,  // the `delete` verb (named `delete_item` only because the generated C++ constant would otherwise b
  rename: 4,  // change the slot's item name (<= the store's name_max)
};
export const STORE_OP_NAME = {
  1: 'save',
  2: 'load',
  3: 'delete_item',
  4: 'rename',
};

// ---- provisioning_ops ----------------------------------------------
export const PROVISIONING_OP = {
  wifi_join: 1,  // join the WiFi network named by `ssid` with `passphrase`; answered after the join concludes (§13.
};
export const PROVISIONING_OP_NAME = {
  1: 'wifi_join',
};

// ---- accessory_admin_ops -------------------------------------------
export const ACCESSORY_ADMIN_OP = {
  window_open: 1,  // open the §12.3 association window for an accessory join: the in-band twin of the pairing button.
  forget: 2,  // GOODBYE the accessory, delete its record and every relationship targeting it, retire its slice, 
  rename: 3,  // set the hub-authored name of the accessory named by accessory_id
};
export const ACCESSORY_ADMIN_OP_NAME = {
  1: 'window_open',
  2: 'forget',
  3: 'rename',
};

// ---- trial_ops -----------------------------------------------------
export const TRIAL_OP = {
  commit: 1,  // persist every value the sender trial-wrote, as it stands, and clear the sender's trial set. No e
  revert: 2,  // restore every pre-trial value of the sender's trial set and clear it. A restored value that diff
};
export const TRIAL_OP_NAME = {
  1: 'commit',
  2: 'revert',
};

// ---- join_results --------------------------------------------------
export const JOIN_RESULT = {
  accepted: 0,  // joined (or rejoined); the accessory waits in its safe state for a command
  window_closed: 1,  // unknown accessory and no association window open
  capacity: 2,  // no free slice, no peer entry, or the declaration exceeds the host's advertised capacity
  unsupported: 3,  // proto_ver not servable
  declaration_invalid: 4,  // the declaration failed §8.10 validation; nothing stored
  not_paired: 5,  // a rejoin from an accessory this host has forgotten; the accessory MAY clear its stored hub
};
export const JOIN_RESULT_NAME = {
  0: 'accepted',
  1: 'window_closed',
  2: 'capacity',
  3: 'unsupported',
  4: 'declaration_invalid',
  5: 'not_paired',
};

// ---- accessory_record_keys -----------------------------------------
export const ACCESSORY_RECORD_K = {
  accessory_id: 1,  // bstr 8: the accessory's durable identity (§8.10), the record's primary key
  slice: 2,  // uint: slice index k; the accessory's channels are 0x8000 + 0x20*k + r
  name: 3,  // tstr: the hub-authored name (renamed via accessory-admin rename)
  product: 4,  // tstr: the JOIN_REQ product string (<= 16 B)
  fw_version: 5,  // tstr: the JOIN_REQ fw_version string (<= 16 B)
  declaration_etag: 6,  // bstr 8: etag of the stored declaration (§8.3)
};

// ---- accessory_states ----------------------------------------------
export const ACCESSORY_STATE = {
  live: 0,  // commanded and running normally
  safe_joined: 1,  // joined, holding safe values, awaiting its first command
  safe_deadman: 2,  // safe: no matching BEACON for its deadman window (§13.3.1)
  safe_goodbye: 3,  // safe: a GOODBYE arrived from its hub
  safe_estop: 4,  // safe: an ESTOP frame or a BEACON with estop_latched; the host's acknowledgment that the e-stop r
  safe_fault: 5,  // safe: a local fault (see `fault`)
};
export const ACCESSORY_STATE_NAME = {
  0: 'live',
  1: 'safe_joined',
  2: 'safe_deadman',
  3: 'safe_goodbye',
  4: 'safe_estop',
  5: 'safe_fault',
};

// ---- relationship_maps ---------------------------------------------
export const RELATIONSHIP_MAP = {
  linear_clamp: 1,  // out = L(in) = out_min + (clamp(in, in_min, in_max) - in_min) * (out_max - out_min) / (in_max - i
  invert: 2,  // out = out_max + out_min - L(in): in_min maps to out_max
  threshold_hysteresis: 3,  // params on_above, off_below (source units, off_below <= on_above): out_max once the source rises 
  slew_limit: 4,  // L(in) with its rate of change bounded by params rise_per_s, fall_per_s (target units/s; one valu
  lowpass: 5,  // L(in) through a first-order low-pass, param tau_s (seconds)
  gate: 6,  // out = L(in) while in_min <= in <= in_max, else the target's `safe` value
  piecewise_table: 7,  // params: up to 8 (in, out) points flattened, in strictly ascending; linear between, held at the e
};
export const RELATIONSHIP_MAP_NAME = {
  1: 'linear_clamp',
  2: 'invert',
  3: 'threshold_hysteresis',
  4: 'slew_limit',
  5: 'lowpass',
  6: 'gate',
  7: 'piecewise_table',
};

// ---- relationship_keys ---------------------------------------------
export const RELATIONSHIP_K = {
  rel_id: 1,  // uint: 0..relationships_max-1; bit index in the roster masks
  name: 2,  // tstr: client-authored label
  source_channel: 3,  // uint: absolute id of an h2c STATE or STREAM channel
  source_field: 4,  // uint: layout index of a numeric field on source_channel
  target_channel: 5,  // uint: absolute id of an accessory INTENT or c2h STREAM channel
  target_field: 6,  // uint: schema key (INTENT) or layout index (STREAM) of a value-bearing field
  map: 7,  // uint: a `relationship_maps` value
  in_min: 8,  // float: source physical units
  in_max: 9,  // float: source physical units
  out_min: 10,  // float: target physical units
  out_max: 11,  // float: target physical units
  params: 12,  // array of up to 16 floats, in the order the map lists them
  enabled: 13,  // bool: persisted. `armed` is volatile, never stored, false at boot (§11.6)
};

// ---- ui_archetypes -------------------------------------------------
export const UI_ARCHETYPE = {
  readout: 0,  // display of a value; bounds present -> bar/gauge projection
  indicator: 1,  // status lamp; never the sole carrier of a safety fact
  slider: 2,  // bounded numeric intent; commit-on-release
  stepper: 3,  // precision numeric, increments in `step`-sized ticks
  toggle: 4,  // boolean
  select: 5,  // enum + options; wire value is the array index; index 0 is filler only on op selects (SPEC §8.9, 
  trigger: 6,  // payload-less intent (button); destructive invocation (setting_flags.destructive, destructive_opt
  axis: 7,  // 1-D positional hero control (role command.position) with commanded-vs-actual overlay; carries th
  chart: 8,  // time-series; glance degrades to sparkline/value; missing samples render as gaps
  list: 9,  // roster/store items + item actions; pending is a THIRD state distinct from success/failure
  text: 10,  // constrained string; glance projects a digit/char wheel: the pairing-PIN path
  stop: 11,  // the safety stop affordances (RFC-085: the estop/release and pause/resume controls, one control p
  pad2d: 12,  // two-axis control: the multi-axis runway; triggered by two command.position fields on one INTENT 
  color: 13,  // chromatic actuator setpoint (lighting/glow accessories); triggered by color.red/green/blue in on
  datetime: 14,  // moment/interval input (automation schedules) in hub time; triggered by datetime.moment, or datet
};
export const UI_ARCHETYPE_NAME = {
  0: 'readout',
  1: 'indicator',
  2: 'slider',
  3: 'stepper',
  4: 'toggle',
  5: 'select',
  6: 'trigger',
  7: 'axis',
  8: 'chart',
  9: 'list',
  10: 'text',
  11: 'stop',
  12: 'pad2d',
  13: 'color',
  14: 'datetime',
};

// ---- ui_regions ----------------------------------------------------
export const UI_REGION = {
  primary: 0,  // hero-rank patterns (axis-hero and peers); the machine's face, exactly one per axis/capability in
  persistent: 1,  // the safety-strip: latch state, ownership, the stop archetype. MUST remain visible in every navig
  content: 2,  // the category tree's territory: cards/panes/menu screens in canonical category order; diagnostic-
  utility: 3,  // connection/session status, identity, theme: chrome about the CLIENT, kept out of the machine's w
  overlay: 4,  // the modal layer: confirms, pairing knocks, alerts. Only ceremony/confirmation content may use it
};
export const UI_REGION_NAME = {
  0: 'primary',
  1: 'persistent',
  2: 'content',
  3: 'utility',
  4: 'overlay',
};

// ---- renderer_classes ----------------------------------------------
export const RENDERER_CLASS = {
  glance: 0,  // OLED remote: home screen = hero-rank; categories = a menu stack; everything except diagnostic re
  handheld: 1,  // phone: categories as sections/tabs; hero+control surfaced, detail one tap away
  full: 2,  // desktop: categories as panes, everything visible
};
export const RENDERER_CLASS_NAME = {
  0: 'glance',
  1: 'handheld',
  2: 'full',
};

// ---- widget_patterns -----------------------------------------------
export const WIDGET_PATTERN = {
  axis_hero: 0,  // rail + window band + command tape + live position/velocity numerals + nested plan-view; command-
  plan_view: 1,  // in-flight plan lane; visibility gated by data freshness, collapses to zero height when idle
  link_strip: 2,  // utility region: connection phase, rx liveness, catalog state; safety-relevant chips pinned, rest
  safety_strip: 3,  // persistent region; ops sorted role-EXEMPT-first; stop sticky-visible within any overflow
  settings_card: 4,  // a subgroup's fields via the archetype decision table; every disabled control shows WHICH gate di
  scope: 5,  // multi-lane strip chart: missing samples render as GAPS never zeros; series colors stable by decl
  event_stream: 6,  // bounded rings; unknown body fields render generically as key=value, never dropped; auto-scroll w
  roster: 7,  // list + item actions; pending is a THIRD state distinct from success/failure; locked-by-role hone
  protocol_pane: 8,  // the one deliberately device-aware diagnostic surface: wire ids visible by design
  pattern_panel: 9,  // the standard generator surface: run/stop with live state, pattern selection as an exclusive-choi
  generator_advanced: 10,  // the fray-d surface: master controls (advgen.* roles incl. its own run/stop advgen.running, RFC-0
  transport: 11,  // playback: play/pause/seek/queue cluster for hubs that play content
  wizard: 12,  // stepped ceremony flow: pairing, calibration, provisioning; glance-class projects it as sequentia
};
export const WIDGET_PATTERN_NAME = {
  0: 'axis-hero',
  1: 'plan-view',
  2: 'link-strip',
  3: 'safety-strip',
  4: 'settings-card',
  5: 'scope',
  6: 'event-stream',
  7: 'roster',
  8: 'protocol-pane',
  9: 'pattern-panel',
  10: 'generator-advanced',
  11: 'transport',
  12: 'wizard',
};

// ---- setting_flags (bit flags) -------------------------------------
export const SETTING_FLAG = {
  advanced: 1 << 0,  // hide behind an 'advanced' affordance by default; NEVER remove from the surface
  restart_required: 1 << 1,  // the applied value takes effect on the next boot (distinct from RFC-020's reboot_in_ms, which is 
  secret: 1 << 2,  // NORMATIVE (RFC-009.5): the value NEVER appears in STATE. The snapshot carries only a set/unset p
  destructive: 1 << 3,  // RFC-063: on a schema field with an `action.*` role, invoking the verb loses state the operator c
};
export const SETTING_FLAG_NAME = {
  1: 'advanced',
  2: 'restart_required',
  4: 'secret',
  8: 'destructive',
};

// ---- pairing_modes (bit flags) -------------------------------------
export const PAIRING_MODE = {
  knock_approve: 1 << 0,  // PRIMARY and capability-agnostic: bare PAIR_REQ with no proof -> bounded pending list (pairing_pe
  pin_proof: 1 << 1,  // the HMAC-PIN flow, for keyboard-bearing joiners when no configure session exists. HONESTY CLAUSE
  push_to_pair: 1 << 2,  // PHYSICAL-PRESENCE proof opens a short SINGLE-GRANT window. The spec requires the PROOF, not a GP
};
export const PAIRING_MODE_NAME = {
  1: 'knock_approve',
  2: 'pin_proof',
  4: 'push_to_pair',
};

// ---- ble_adv_flags (bit flags) -------------------------------------
export const BLE_ADV_FLAG = {
  pairing_window_open: 1 << 0,  // a §12.3 association window is open right now (same meaning as the 0x17 BEACON pairing-open flag,
  ws_available: 1 << 1,  // the hub currently has a live IP and a listening WebSocket port: RFC-043's signal that a BLE-conn
  config_mode: 1 << 2,  // RFC-079 (§13.4.1): the hub booted with its pairing control held and is in config mode: BLE + USB
};
export const BLE_ADV_FLAG_NAME = {
  1: 'pairing_window_open',
  2: 'ws_available',
  4: 'config_mode',
};

// ---- beacon_flags (bit flags) --------------------------------------
export const BEACON_FLAG = {
  pairing_window_open: 1 << 0,  // a §12.3 association window is open (the original BEACON pairing flag)
  datagram_estop: 1 << 1,  // this hub accepts ESTOP frames from any peer on its channel (the RFC-053 item 2b mirror bit, rati
  accessory_host: 1 << 2,  // RFC-075: this hub runs the ESP-NOW spoke and accepts accessory joins (§13.3.1, §8.10)
  estop_latched: 1 << 3,  // RFC-075: this hub's safety snapshot (0x0003) shows ESTOP latched right now; an accessory hearing
};
export const BEACON_FLAG_NAME = {
  1: 'pairing_window_open',
  2: 'datagram_estop',
  4: 'accessory_host',
  8: 'estop_latched',
};

// ---- discover_reply_flags (bit flags) ------------------------------
export const DISCOVER_REPLY_FLAG = {
  pairing_window_open: 1 << 0,  // a §12.3 association window is open right now (the 0x17 BEACON flag's meaning, plus the endpoint)
  datagram_estop: 1 << 1,  // RFC-053 item 2b: this hub honors an ESTOP frame on this UDP port right now (the setting's live v
};
export const DISCOVER_REPLY_FLAG_NAME = {
  1: 'pairing_window_open',
  2: 'datagram_estop',
};

// ---- plan_flags (bit flags) ----------------------------------------
export const PLAN_FLAG = {
  shaped: 1 << 0,  // the planner trimmed a knot toward the previous one to fit the ceilings (amplitude gives, time ne
  stretched: 1 << 1,  // the knot lands after its commanded time: a jog's fastest move, or the newest knot finishing late
  clamped: 1 << 2,  // a ceiling or the travel window changed the command
};
export const PLAN_FLAG_NAME = {
  1: 'shaped',
  2: 'stretched',
  4: 'clamped',
};

// ---- field_roles (tstr wire values) -------------------------------
export const FIELD_ROLE = {
  limit_jog_speed: 'limit.jog.speed',  // speed ceiling of the JOG (manual) limit set: jog moves and the override `return` run at it. CEIL
  limit_jog_accel: 'limit.jog.accel',  // accel ceiling of the jog limit set. RFC-085 renamed it from limit.user.accel.
  limit_input_speed: 'limit.input.speed',  // speed ceiling of the INPUT (machine-driven: patterns, streams, TCode) limit set
  limit_input_accel: 'limit.input.accel',  // accel ceiling of the input limit set
  limit_input_jerk: 'limit.input.jerk',  // jerk ceiling of the input limit set
  geometry_max_travel: 'geometry.max_travel',  // the configured travel ceiling: how far the machine's rail geometry allows it to search/move (0x0
  geometry_measured_travel: 'geometry.measured_travel',  // the usable travel a real home actually measured between the two hard stops, as opposed to geomet
  window_min: 'window.min',  // stroke window lower bound. Limits normalized against the window are window-relative and therefor
  window_max: 'window.max',  // stroke window upper bound
  telemetry_position: 'telemetry.position',  // live actuator position
  telemetry_target: 'telemetry.target',  // RFC-032: the position the machine is currently COMMANDED to, as opposed to telemetry.position wh
  telemetry_velocity: 'telemetry.velocity',  // live actuator velocity
  telemetry_current: 'telemetry.current',  // motor/drive current
  telemetry_power_bus: 'telemetry.power.bus',  // DC bus voltage or power
  telemetry_temp: 'telemetry.temp',  // a temperature reading; the field's own name/unit says which
  telemetry_uptime: 'telemetry.uptime',  // hub uptime
  identity_name: 'identity.name',  // the writable machine-name setting (RFC-026 tier 2, str16/str32). Its READ-ONLY twin is WELCOME i
  meta_enabled_mask: 'meta.enabled_mask',  // RFC-009.4: a bitfield8 field whose bit i gates the i-th setting-annotated field of the SAME layo
  meta_trial_pending: 'meta.trial_pending',  // RFC-099 (§8.8): a bitfield8 field whose bit i marks the i-th setting-annotated field of the SAME
  meta_reset_gen: 'meta.reset_gen',  // RFC-019: increments on every applied reset in this counter group, so ALL subscribers observe the
  pattern_running: 'pattern.running',  // whether the built-in (classic) pattern generator is currently driving the machine. The advanced 
  pattern_select: 'pattern.select',  // which built-in pattern the generator plays; options are the device's pattern names, index-aligne
  pattern_speed: 'pattern.speed',  // pattern generator speed knob, as a percentage of its own range
  pattern_depth: 'pattern.depth',  // pattern generator depth knob: how far into the stroke window it reaches
  pattern_stroke: 'pattern.stroke',  // pattern generator stroke-length knob, as a percentage of the available depth
  pattern_sensation: 'pattern.sensation',  // pattern generator character knob; what it changes depends on the selected pattern
  command_position: 'command.position',  // RFC-032: INTENT field carrying a commanded ABSOLUTE target position in the channel's own unit. A
  axis_flipped: 'axis.flipped',  // RFC-088 (§9.6): a stored, writable bool (or two-option select) setting: the rail's direction fli
  input_target: 'input.target',  // RFC-071: the commanded position of a motion-input sample or segment, in the field's own unit and
  input_velocity: 'input.velocity',  // RFC-071: a samples-kind point's instantaneous velocity hint. Optional; a client that does not un
  input_duration: 'input.duration',  // RFC-071: a segments-kind sample's commanded time extent
  input_end_velocity: 'input.end_velocity',  // RFC-071: a segments-kind sample's velocity at its end (the §9.6 handoff); its type minimum means
  plan_start: 'plan.start',  // normalized start position of the segment in flight
  plan_end: 'plan.end',  // normalized end position of the segment in flight
  plan_current: 'plan.current',  // normalized current position along the plan
  plan_velocity: 'plan.velocity',  // current planned velocity
  plan_elapsed: 'plan.elapsed',  // elapsed time within the segment in flight
  plan_duration: 'plan.duration',  // total duration of the segment in flight
  plan_latency: 'plan.latency',  // RFC-059: optional live telemetry twin of a grant's schedule_latency_us (cbor key 49), for diagno
  plan_style: 'plan.style',  // which planning style produced the segment; options are the device's style names, index-aligned w
  plan_flags: 'plan.flags',  // RFC-100 (§8.8): bitfield8, bits per plan_flags: set when a segment plans, from that plan, cleare
  advgen_running: 'advgen.running',  // RFC-093: bool, the advanced generator's own run/stop (essential binding of generator-advanced). 
  advgen_master: 'advgen.master',  // RFC-081: overall rate scale of the advanced program, percent of its own range
  advgen_depth_max: 'advgen.depth_max',  // RFC-081: the deep stroke bound the program swings to, percent of the stroke window
  advgen_depth_min: 'advgen.depth_min',  // RFC-081: the shallow stroke bound the program swings to, percent of the stroke window
  advgen_speed_in: 'advgen.speed_in',  // RFC-081: inward stroke speed base
  advgen_speed_out: 'advgen.speed_out',  // RFC-081: outward stroke speed base
  advgen_accel_in: 'advgen.accel_in',  // RFC-081: inward acceleration base
  advgen_accel_out: 'advgen.accel_out',  // RFC-081: outward acceleration base
  advgen_dwell_crest: 'advgen.dwell_crest',  // RFC-095: hold at the deep bound (advgen.depth_max) after the inward half completes and before th
  advgen_dwell_trough: 'advgen.dwell_trough',  // RFC-095: hold at the shallow bound (advgen.depth_min) after the outward half completes and befor
  mod_amount: 'mod.amount',  // RFC-066: how far the modulator swings its target, in the target's terms; 0 = no modulation
  mod_rise: 'mod.rise',  // RFC-066: duration of the rising leg of the cycle (field unit: strokes or seconds)
  mod_hold: 'mod.hold',  // RFC-066: dwell at the top of the cycle (field unit: strokes or seconds)
  mod_fall: 'mod.fall',  // RFC-066: duration of the falling leg of the cycle (field unit: strokes or seconds)
  mod_rest: 'mod.rest',  // RFC-066: dwell at the bottom of the cycle (field unit: strokes or seconds)
  mod_phase: 'mod.phase',  // RFC-066: offset of this modulator's cycle start (field unit: strokes or seconds)
  mod_shape: 'mod.shape',  // RFC-066: optional select naming the cycle shape; absent = the cycling trapezoid (rise, hold, fal
  osc_enabled: 'osc.enabled',  // RFC-103: bool, the oscillator runs. Never persisted (false at boot); cleared by the hub when the
  osc_frequency: 'osc.frequency',  // RFC-103: f32, Hz, 0 .. WELCOME limits osc_max_hz (key 7), clamped. The moving part of one cycle 
  osc_amplitude: 'osc.amplitude',  // RFC-103: f32, a share of the travel window, 0 .. 1: the PEAK displacement from the planned posit
  osc_shape: 'osc.shape',  // RFC-103: select over osc_shapes (0 sine, 1 square, 2 saw, 3 saw_reverse); the wire value is the 
  osc_dwell_crest: 'osc.dwell_crest',  // RFC-103: f32, two decimals, 0 = no hold: the share of the moving cycle (1 / frequency) held at t
  osc_dwell_trough: 'osc.dwell_trough',  // RFC-103: f32, two decimals, 0 = no hold: the share of the moving cycle held at the trough, as os
  osc_frequency_drive: 'osc.frequency.drive',  // RFC-103: select over osc_drives: what sets osc.frequency. fixed = the field's own value (the bou
  osc_frequency_in_min: 'osc.frequency.in_min',  // RFC-103: f32, the drive's input at which osc.frequency reads out_min (the drive's own unit: tele
  osc_frequency_in_max: 'osc.frequency.in_max',  // RFC-103: f32, the drive's input at which osc.frequency reads out_max; in_min != in_max
  osc_frequency_out_min: 'osc.frequency.out_min',  // RFC-103: f32, Hz, the frequency at in_min
  osc_frequency_out_max: 'osc.frequency.out_max',  // RFC-103: f32, Hz, the frequency at in_max
  osc_amplitude_drive: 'osc.amplitude.drive',  // RFC-103: select over osc_drives: what sets osc.amplitude, as osc.frequency.drive; axis = the osc
  osc_amplitude_in_min: 'osc.amplitude.in_min',  // RFC-103: f32, the drive's input at which osc.amplitude reads out_min (the drive's own unit, as o
  osc_amplitude_in_max: 'osc.amplitude.in_max',  // RFC-103: f32, the drive's input at which osc.amplitude reads out_max; in_min != in_max
  osc_amplitude_out_min: 'osc.amplitude.out_min',  // RFC-103: f32, window share, the amplitude at in_min
  osc_amplitude_out_max: 'osc.amplitude.out_max',  // RFC-103: f32, window share, the amplitude at in_max
  osc_active: 'osc.active',  // RFC-103: STATE bool: the oscillator is enabled and rendering a nonzero amplitude this instant. F
  osc_amplitude_effective: 'osc.amplitude_effective',  // RFC-103: STATE f32, window share: the amplitude the ceilings and the window left after shaping (
  store_slot: 'store.slot',  // RFC-089 (§8.7): uint, the item's slot in the writer's store. Required by load, delete and rename
  store_name: 'store.name',  // RFC-089 (§8.7): text, the item's name, fitting the store's name_max. Required by save and rename
  store_item: 'store.item',  // RFC-089 (§8.7): byte string carrying one whole store-item document (the blob_keys map: slot, nam
  color_red: 'color.red',  // RFC-083: writable numeric red channel of one color group; color.red/green/blue together trigger 
  color_green: 'color.green',  // RFC-083: writable numeric green channel of one color group
  color_blue: 'color.blue',  // RFC-083: writable numeric blue channel of one color group
  datetime_moment: 'datetime.moment',  // RFC-083: a scheduled moment in HUB TIME: whole seconds in the hub's §7.1 timebase (unit_ids hub_
  datetime_start: 'datetime.start',  // RFC-083: interval start, hub time seconds (as datetime.moment); with datetime.end in one group t
  datetime_end: 'datetime.end',  // RFC-083: interval end, hub time seconds (as datetime.moment)
  source_background_run: 'source.background_run',  // bool, `setting_key`-annotated: whether THIS autonomous source keeps running when its owning sess
};

// ---- channel_roles (tstr wire values) -----------------------------
export const CHANNEL_ROLE = {
  events_anomaly: 'events.anomaly',  // §9.4
  anomaly_summary: 'anomaly.summary',  // §9.4
  osc_drive: 'osc.drive',  // §9.7
};

// ---- action_tags (tstr wire values) -------------------------------
export const ACTION_TAG = {
  move: 'move',  // the primary positional command: usually already the axis archetype's own binding, rarely a separ
  safety: 'safety',  // a safety-adjacent action outside the law-bound stop archetype and the three safety pairs themsel
  home: 'home',  // a homing-cycle trigger
  calibrate: 'calibrate',  // a calibration-cycle trigger; commonly the entry point to a `wizard` widget pattern
  reset: 'reset',  // aspect-group reset linkage (value_aspects/RENDERING.md §5.4); co-located with the group it reset
  save: 'save',  // persist current state (settings, not a preset item)
  persist: 'persist',  // commit a value past a reboot: distinct from `setting_flags.restart_required`, which is about WHE
  pair: 'pair',  // enters a pairing ceremony affordance
  identify: 'identify',  // blink-to-find: every device ecosystem needs one
  admin: 'admin',  // a generic administrative action not covered by a more specific tag
  reboot: 'reboot',  // firmware reboot; SHOULD always confirm (cbor_keys.reboot_in_ms)
  accessory: 'accessory',  // RFC-076: the accessory-admin op select on core channel 0x0012 (§8.10), options index-aligned wit
  provision: 'provision',  // RFC-069: the provisioning op select on core channel 0x000F (§13.9), options index-aligned with `
  trial: 'trial',  // RFC-099: the settings-trial op select on core channel 0x0016 (§9.3), options index-aligned with 
  store: 'store',  // RFC-067: the store CRUD op select (§8.7): options index-aligned with `store_ops`; no options bey
};

// ---- limits --------------------------------------------------------------
export const LIMITS = {
  header_bytes: 8,
  min_transport_payload: 242,
  catalog_chunk_payload: 192,
  blob_chunks_in_flight: 4,
  bundle_max_samples: 32,
  bundle_max_span_ms: 20,
  segment_t_off_unit_us: 100,
  seq_width_bits: 16,
  seq_newer_window: 32768,
  frag_reassembly_timeout_ms: 5000,
  frag_max_concurrent_per_session: 2,
  idempotency_ring_depth: 32,
  intent_ingress_default_per_s: 50,
  stream_ingress_overage_nack_per_s: 5,
  event_queue_depth_per_subscriber: 16,
  never_shed_stall_eviction_ms: 2000,
  catalog_chunk_gap_timeout_ms: 500,
  busy_retry_after_default_ms: 2000,
  ping_interval_holding_control_ms: 200,
  ping_interval_idle_ms: 1000,
  deadman_default_ms: 600,
  deadman_min_ms: 250,
  deadman_max_ms: 5000,
  stream_quiet_release_ms: 500,
  pairing_window_default_s: 120,
  pairing_pin_digits: 4,
  pairing_gesture_boot_count: 3,
  pairing_gesture_max_uptime_ms: 10000,
  token_bytes: 16,
  instance_id_bytes: 8,
  etag_bytes: 8,
  conformance_min_clients: 4,
  default_max_clients_ws: 8,
  default_max_clients_espnow: 4,
  default_max_clients_ble: 1,
  default_max_clients_serial: 1,
  estop_repeat_interval_ms: 50,
  estop_repeat_max: 20,
  clock_resync_interval_s: 10,
  probe_default_bytes: 8192,
  probe_max_duration_ms: 1500,
  catalog_max_entries: 256,
  catalog_max_entry_bytes: 4096,
  max_subscriptions_per_session: 64,
  max_subscriptions_per_frame: 16,
  max_frame_ws: 512,
  max_frame_espnow: 250,
  max_frame_ble: 244,
  max_frame_serial: 512,
  catalog_ready_timeout_ms: 15000,
  idle_reap_multiplier: 3,
  schedule_horizon_max_ms: 1000,
  max_future_schedule_ms: 250,
  max_burst_multiple: 4,
  segment_end_vel_unspecified: -32768,
  segment_dwell_span: 0.02,
  desc_max_bytes: 128,
  nack_detail_max_bytes: 48,
  option_label_max_bytes: 24,
  preset_capacity_min: 32,
  preset_item_max_bytes: 4096,
  paired_devices_max: 8,
  trust_ledger_max_bytes: 1900,
  pairing_pending_max: 4,
  client_ver_max_bytes: 24,
  trust_ledger_name_max_bytes: 16,
  trust_ledger_kind_max_bytes: 16,
  hub_sig_timeout_ms: 3000,
  auth_attempts_max: 3,
  provision_join_timeout_ms: 20000,
  log_replay_depth_default: 32,
  spoke_beacon_interval_ms: 1000,
  spoke_deadman_ms: 5000,
  accessory_slice_ids: 32,
  relationships_max: 16,
  accessory_declaration_max_bytes: 4096,
  spoke_scan_dwell_ms: 150,
  ws_subprotocol: 'valence.v1',
  group_section_separator: ' / ',
};

// ---- udp_discovery --------------------------------------------------------------
export const UDP_DISCOVERY = {
  port: 22096,
  magic: 'VLNC',
  reply_rate_limit_per_source_s: 1,
};
