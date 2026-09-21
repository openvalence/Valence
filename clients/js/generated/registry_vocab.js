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
export const MDNS_SERVICE = '_valence._tcp';

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
  BEACON: 0x17,  // §13.7
  PUBLISH: 0x18,  // §6.6
  CATALOG_READY: 0x19,  // §8.4
  BLOB_REQ: 0x1a,  // §8.4
  BLOB_CHUNK: 0x1b,  // §8.4
  AUTH: 0x1c,  // §12.2
  HUB_SIG: 0x1d,  // §12.2
  DISCOVER_PROBE: 0x1e,  // §13.8
  DISCOVER_REPLY: 0x1f,  // §13.8
  BLOB_DONE: 0x20,  // §8.4
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
  catalog: 0x0001,  // catalog meta: etag, chunk count, entry count
  session_roster: 0x0002,  // RFC-047 §3: allocated and specified (RFC-018), NOT implemented: no reference catalog builder dec
  safety: 0x0003,  // latched safety word: estop/stop/hold/pause + cause + owner (§11.1); RFC-025 appends manual_overr
  control_owner: 0x0004,  // active arbiter source + owning session per source (§11.4)
  safety_intents: 0x0005,  // STOP/HOLD/PAUSE/RESUME/ESTOP_CLEAR/ESTOP/TAKEOVER + override/bypass (§11, safety_intent_ops)
  hub_status: 0x0006,  // boot_id, heap, uptime, transport stats. NO fw version: RFC-016 puts identity in WELCOME `identit
  session_events: 0x0007,  // join/leave/takeover/eviction notifications
  log: 0x0008,  // RFC-017: device log in-band: {level u8, tag, hub-ms, message <=128 B} via the `body` sub-map. Bo
  session_admin: 0x0009,  // RFC-018: {op: evict, session_id} -> hub GOODBYEs the target with SESSION_EVICTED. `configure` ac
  pending_pairing: 0x000a,  // RFC-027(a) knock-and-approve: the bounded pending list (pairing_pending_max) as protocol state: 
  pairing_events: 0x000b,  // RFC-027: knock arrived / approved / denied / expired, plus pairing-window open/close. EVENT twin
  paired_devices: 0x000c,  // trust-ledger store descriptor: {store_id, kind 'trust.ledger', capacity paired_devices_max, per_
  paired_devices_roster: 0x000d,  // the 0x000C store's roster: {generation u16, count u8, capacity u8}. On-change, tiny; a generatio
  safety_events: 0x000e,  // RFC/§9.4 duality: the EVENT TWIN of the `safety` STATE channel (0x0003). Kinds in `safety_event_
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
};

// ---- cbor_keys -----------------------------------------------------
export const K = {
  proto_ver: 1,  // HELLO/WELCOME: protocol major version
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
  blob: 38,  // BLOB_REQ / BLOB_CHUNK / store CRUD intents: which blob, and its item fields (RFC-021): sub-keys 
  trust: 39,  // HELLO + WELCOME + AUTH: identity proof, signature material, token presentation, pairing modes (R
  body: 40,  // EVENT: the kind-specific fields. Integer keys come from the CHANNEL'S CATALOG `schema`, exactly 
  intent_seq: 41,  // NACK: seq of the frame being rejected (RFC-001). Hubs SHOULD populate it whenever a specific inb
  burst: 42,  // publishes / granted_publishes ENTRY maps: token-bucket capacity in samples, decoupled from rate 
  reboot_in_ms: 43,  // ECHO `applied` (19): this accepted intent commits by rebooting, in about this many ms (RFC-020).
  deadman_wish_ms: 44,  // HELLO: requested deadman window (RFC-038). The hub clamps into [deadman_min_ms, deadman_max_ms] 
  curve_family: 45,  // publishes / granted_publishes ENTRY maps: which `curve_families` smoothness class the segment st
  ws_port: 46,  // WELCOME: the hub's own WebSocket listening port (RFC-046 §3). Present on every binding but load-
  ipv4: 47,  // WELCOME: the hub's own IPv4 address (RFC-046 §3), packed big-endian into one u32 (e.g. 192.168.1
  requested_curve_family: 48,  // publishes / granted_publishes ENTRY maps (RFC-049b): echoes the client's `curve_family` (45) WIS
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
  45: 'curve_family',
  46: 'ws_port',
  47: 'ipv4',
  48: 'requested_curve_family',
};

// ---- welcome_limits_keys -------------------------------------------
export const WELCOME_LIMITS_K = {
  max_frame: 1,  // largest frame this hub accepts, bytes
  max_subscriptions: 2,  // per-session subscription cap
  retained_pending: 3,  // count of retained STATE pushes that will follow WELCOME
  max_subscriptions_per_frame: 4,  // RFC-033.3: most subscription wishes one SUBSCRIBE (or HELLO) frame may carry. Before this was ad
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
  fw_version: 2,  // tstr: hub firmware version, e.g. '2.1.47' (<=24 B). Retires the mDNS-TXT-only exposure that made
  hub_name: 3,  // tstr: operator-assigned machine name (<=32 B). Writable as a str16/str32 setting (RFC-026) where
  info: 4,  // map: OPTIONAL device-defined extras (hardware rev, build date...). Keys are device-defined tstr;
  hub_instance_id: 5,  // uint (u64): RFC-048, operator veto of an RFC-046 decision. DURABLE hub identity: generated once 
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
};

// ---- safety_event_kinds --------------------------------------------
export const SAFETY_EVENT_KIND = {
  estop_latched: 1,  // the ESTOP bit went 0 -> 1 (§5.5). `body` carries word/cause/owner_session/estop_seq. Cause is a 
  estop_cleared: 2,  // the ESTOP bit went 1 -> 0 via §11.2's guarded clear (`safety_ops::estop_clear` + the hub's and d
  stop_latched: 3,  // one or more of STOP / HOLD / PAUSE went 0 -> 1. `body.level` is the bitmask of the bits that NEW
  stop_cleared: 4,  // one or more of STOP / HOLD / PAUSE went 1 -> 0 (`resume`, or a STOP cleared by an accepted new m
};
export const SAFETY_EVENT_KIND_NAME = {
  1: 'estop_latched',
  2: 'estop_cleared',
  3: 'stop_latched',
  4: 'stop_cleared',
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
  estop_clear: 1,  // clear the ESTOP latch (§11.2 conditions apply; NACK CLEAR_REFUSED otherwise). Requires `control`
  stop: 2,  // controlled decel stop (§11.1). ROLE-EXEMPT.
  hold: 3,  // position hold (§11.1). Requires `control`. The HUB latches all four levels in 0x0003: delegate a
  pause: 4,  // pattern pause (§11.1). Requires `control`.
  resume: 5,  // resume from HOLD/PAUSE (§11.1). Requires `control`.
  estop: 6,  // ASSERT e-stop (RFC-010). ROLE-EXEMPT. The hub treats it exactly as a valid 0xE5 frame: latch, ca
  override_on: 7,  // engage manual override (RFC-025c). Requires `control`. Override/bypass are SAFETY-domain state, 
  override_off: 8,  // release manual override. Requires `control`.
  bypass_on: 9,  // engage limit bypass (RFC-025c). Requires `control`. The per-move `bypass` key on a motion INTENT
  bypass_off: 10,  // release limit bypass. Requires `control`.
};
export const SAFETY_OP_NAME = {
  1: 'estop_clear',
  2: 'stop',
  3: 'hold',
  4: 'pause',
  5: 'resume',
  6: 'estop',
  7: 'override_on',
  8: 'override_off',
  9: 'bypass_on',
  10: 'bypass_off',
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
  user: 0,  // operator-initiated (physical button, UI, safety-intents `estop`/`stop`): §5.5
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
  unspecified: 0,  // the compatible default: the hub behaves exactly as it did before RFC-030. What every pre-RFC-030
  c1_cubic: 1,  // velocity-continuous cubic (Linear/Pchip/Makima/monotone-cubic senders). Acceleration lawfully ST
  c2_quintic: 2,  // curvature-continuous; the sender means the smoothness. A follow-client hub may use its C2 recons
  step: 3,  // held value with instantaneous transitions (step/none interpolation). The family says intent, the
};
export const CURVE_FAMILY_NAME = {
  0: 'unspecified',
  1: 'c1_cubic',
  2: 'c2_quintic',
  3: 'step',
};

// ---- nack_codes ----------------------------------------------------
export const NACK = {
  MALFORMED: 0x0000,  // undecodable frame/CBOR
  UNSUPPORTED_VERSION: 0x0001,  // HELLO proto_ver not servable
  FRAME_TOO_LARGE: 0x0002,  // exceeds negotiated max_frame
  PROFILE_VIOLATION: 0x0003,  // CBOR not in deterministic profile
  BUSY: 0x0100,  // client limit reached; carries retry_after_ms
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
  SLOT_RECLAIMED: 0x010d,  // RFC-042: a HELLO that would otherwise NACK BUSY instead evicted a STALE session to make room (lo
  UNKNOWN_CHANNEL: 0x0200,  // channel id not in catalog
  ACCESS_DENIED: 0x0201,  // channel access level above session role
  CLASS_MISMATCH: 0x0202,  // e.g. SUBSCRIBE to an INTENT channel
  SUB_LIMIT: 0x0203,  // per-session subscription cap reached
  SUBSCRIBE_REJECTED: 0x0204,  // RFC-033.2: the SUBSCRIBE frame as a WHOLE could not be processed (undecodable, or more wishes th
  CONFLICT: 0x0300,  // precondition (cfg_gen CAS) failed
  RATE_LIMITED: 0x0301,  // ingress intent rate exceeded
  INVALID_VALUE: 0x0302,  // outside schema min/max or wrong type; also a store import whose kind or size the hub refuses (RF
  UNSUPPORTED_OP: 0x0303,  // intent op not implemented on this hub
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
  0x0200: 'UNKNOWN_CHANNEL',
  0x0201: 'ACCESS_DENIED',
  0x0202: 'CLASS_MISMATCH',
  0x0203: 'SUB_LIMIT',
  0x0204: 'SUBSCRIBE_REJECTED',
  0x0300: 'CONFLICT',
  0x0301: 'RATE_LIMITED',
  0x0302: 'INVALID_VALUE',
  0x0303: 'UNSUPPORTED_OP',
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
  control: 1,  // driving the machine now: move, pattern run/speed/depth, streams
  motion: 2,  // live physical telemetry
  safety: 3,  // faults, interlocks, e-stop state: the stop affordance itself is rank-pinned (ui_ranks), not a me
  limits: 4,  // window + ceilings
  library: 5,  // stored content: presets, patterns, scripts, positions, profiles
  playback: 6,  // hub-local content transport: play/pause/seek/queue
  auxiliary: 7,  // secondary actuators: heat, lube, suction, inflation
  automation: 8,  // routines, schedules, scenes
  tuning: 9,  // engine internals, calibration
  hardware: 10,  // geometry, drive config, sensors, homing
  network: 11,  // WiFi/BLE state, endpoints, provisioning
  session: 12,  // clients, roles, ownership, pairing/trust
  system: 13,  // power, thermals, memory, firmware, logs
  other: 14,  // the defined overflow: every unrecognized category id (including an untaught vendor id) renders h
};
export const UI_CATEGORY_NAME = {
  1: 'control',
  2: 'motion',
  3: 'safety',
  4: 'limits',
  5: 'library',
  6: 'playback',
  7: 'auxiliary',
  8: 'automation',
  9: 'tuning',
  10: 'hardware',
  11: 'network',
  12: 'session',
  13: 'system',
  14: 'other',
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
};

// ---- ui_archetypes -------------------------------------------------
export const UI_ARCHETYPE = {
  readout: 0,  // display of a value; bounds present -> bar/gauge projection
  indicator: 1,  // status lamp; never the sole carrier of a safety fact
  slider: 2,  // bounded numeric intent; commit-on-release
  stepper: 3,  // precision numeric, increments in `step`-sized ticks
  toggle: 4,  // boolean
  select: 5,  // enum + options; wire value is the array index
  trigger: 6,  // payload-less intent (button); destructive flag -> mandatory confirm on every class
  axis: 7,  // 1-D positional hero control (role command.position) with commanded-vs-actual overlay
  chart: 8,  // time-series; glance degrades to sparkline/value; missing samples render as gaps
  list: 9,  // roster/store items + item actions; pending is a THIRD state distinct from success/failure
  text: 10,  // constrained string; glance projects a digit/char wheel: the pairing-PIN path
  stop: 11,  // the safety stop affordance: bound BY LAW to safety-op identity, never derived from annotation; r
  pad2d: 12,  // two-axis control: the multi-axis runway
  color: 13,  // chromatic actuator setpoint (lighting/glow accessories)
  datetime: 14,  // moment/interval input (automation schedules)
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
  generator_advanced: 10,  // the fray-d surface: master controls + the four modifier lanes rendered as parallel lane groups +
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
};
export const SETTING_FLAG_NAME = {
  1: 'advanced',
  2: 'restart_required',
  4: 'secret',
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
};
export const BLE_ADV_FLAG_NAME = {
  1: 'pairing_window_open',
  2: 'ws_available',
};

// ---- field_roles (tstr wire values) -------------------------------
export const FIELD_ROLE = {
  limit_user_speed: 'limit.user.speed',  // speed ceiling of the USER (manual) limit set. CEILING, never a target.
  limit_user_accel: 'limit.user.accel',  // accel ceiling of the user limit set
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
  meta_reset_gen: 'meta.reset_gen',  // RFC-019: increments on every applied reset in this counter group, so ALL subscribers observe the
  pattern_running: 'pattern.running',  // whether the built-in pattern generator is currently driving the machine
  pattern_select: 'pattern.select',  // which built-in pattern the generator plays; options are the device's pattern names, index-aligne
  pattern_speed: 'pattern.speed',  // pattern generator speed knob, as a percentage of its own range
  pattern_depth: 'pattern.depth',  // pattern generator depth knob: how far into the stroke window it reaches
  pattern_stroke: 'pattern.stroke',  // pattern generator stroke-length knob, as a percentage of the available depth
  pattern_sensation: 'pattern.sensation',  // pattern generator character knob; what it changes depends on the selected pattern
  command_position: 'command.position',  // RFC-032: INTENT field carrying a commanded ABSOLUTE target position in the channel's own unit. A
  plan_start: 'plan.start',  // normalized start position of the segment in flight
  plan_end: 'plan.end',  // normalized end position of the segment in flight
  plan_current: 'plan.current',  // normalized current position along the plan
  plan_velocity: 'plan.velocity',  // current planned velocity
  plan_elapsed: 'plan.elapsed',  // elapsed time within the segment in flight
  plan_duration: 'plan.duration',  // total duration of the segment in flight
  plan_style: 'plan.style',  // which planning style produced the segment; options are the device's style names, index-aligned w
  source_background_run: 'source.background_run',  // bool, `setting_key`-annotated: whether THIS autonomous source keeps running when its owning sess
};

// ---- action_tags (tstr wire values) -------------------------------
export const ACTION_TAG = {
  move: 'move',  // the primary positional command: usually already the axis archetype's own binding, rarely a separ
  safety: 'safety',  // a safety-adjacent action outside the law-bound stop archetype itself (e.g. an override/bypass to
  home: 'home',  // a homing-cycle trigger
  calibrate: 'calibrate',  // a calibration-cycle trigger; commonly the entry point to a `wizard` widget pattern
  reset: 'reset',  // aspect-group reset linkage (value_aspects/RENDERING.md §5.4); co-located with the group it reset
  save: 'save',  // persist current state (settings, not a preset item)
  persist: 'persist',  // commit a value past a reboot: distinct from `setting_flags.restart_required`, which is about WHE
  pair: 'pair',  // enters a pairing ceremony affordance
  identify: 'identify',  // blink-to-find: every device ecosystem needs one
  admin: 'admin',  // a generic administrative action not covered by a more specific tag
  reboot: 'reboot',  // firmware reboot; SHOULD always confirm (cbor_keys.reboot_in_ms)
  preset_save: 'preset_save',  // save-to-store, part of the generator-advanced preset roster
  preset_recall: 'preset_recall',  // load-from-store, same roster
};

// ---- limits --------------------------------------------------------------
export const LIMITS = {
  header_bytes: 8,
  min_transport_payload: 242,
  catalog_chunk_payload: 192,
  blob_chunks_in_flight: 4,
  bundle_max_samples: 32,
  bundle_max_span_ms: 20,
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
  max_future_schedule_ms: 250,
  max_burst_multiple: 4,
  segment_handoff_k: 1.5,
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
  log_replay_depth_default: 32,
  ws_subprotocol: 'valence.v1',
  mdns_service: '_valence._tcp',
};
