/**
 * session.js — Valence browser session state machine (read + write plane).
 *
 * Owns ONE WebSocket to ws://<host>:82 (subprotocol valence.v1, binary), and
 * drives the full v1.0 session choreography that the reference clients
 * (lib/valence/.../client/client_impl.hpp, tools/valence_probe.py) implement:
 *
 *   connect → HELLO [+ cached catalog etag, subscription/publish wishes]
 *           → WELCOME (session id, roles, deadman, grants, hub identity,
 *             catalog etag)
 *   → READINESS GATE (§8.4 / RFC-015):
 *       etag MATCHED  ⇒ ready already, ZERO extra frames (the 99% reconnect)
 *       otherwise     ⇒ BLOB_REQ → BLOB_CHUNK reassembly → verify the SHA-256
 *                       LOCALLY → CATALOG_READY carrying the etag we now
 *                       operate against, re-declared on the chunk-repair
 *                       cadence until the first STATE proves the gate opened
 *   → CLOCK 0x05 NTP-style offset sync
 *   → SUBSCRIBE → GRANT for catalog-resolved channels (rate = min(wish, catalog rate))
 *   → retained STATE on grant, live STATE pushes (packed-decoded per the
 *     CATALOG'S layout — there is no fallback table, by design)
 *   → PING keepalive on TX silence (< deadman window)
 *   → intents (c2h) encoded from the catalog's own schema, correlated to their
 *     post-clamp ECHO 0x0E and to NACKs by intent_id / intent_seq
 *   → NACK handling, GOODBYE, reconnect-with-backoff; an admission refusal
 *     (HUB_AT_CAPACITY / HUB_SHEDDING, §6.3) waits out retry_after_ms plus jitter.
 *
 * THE GATE IS WHY THERE IS NO FALLBACK LAYOUT TABLE. The hub emits NO
 * data-plane frame and NACKs every INTENT `NOT_READY` until this client has
 * declared which catalog it operates against, so a STATE frame can no longer
 * arrive before its decoder ring. See catalog.js's header.
 *
 * GROUND TRUTH (SPEC.md §1.2, "Ground truth, hub-authoritative"): this layer never fabricates device state. STATE
 * events carry the device's reported values; ECHO carries post-clamp APPLIED
 * values. Intents are ONLY sent when the integrator calls a sender — nothing
 * here auto-commands motion.
 *
 * Events (register with .on(name, cb)):
 *   'open'         ()                              — socket connected
 *   'welcome'      (welcomeInfo)                   — handshake complete
 *   'catalog'      (entries, channelMap, meta)     — catalog adopted (cached or fetched)
 *   'ready'        ({etag, cached})                — readiness declared/inherited
 *   'live'         ()                              — SYNCING → LIVE (§2.2)
 *   'grant'        (grants[])                      — subscription grants applied
 *                                                      (WELCOME or GRANT)
 *   'publishGrant' (grantedPublishes[])            -- publish grants applied
 *                                                      (WELCOME, a PUBLISH
 *                                                      answer, or an
 *                                                      unsolicited re-grant)
 *   'state'        (channelId, decodedSample, tsMs)— a STATE push (packed-decoded)
 *   'echo'         (decodedEcho)                    — intent APPLIED echo
 *   'nack'         ({code, name, channel, detail, intentId, intentSeq})
 *   'event'        (evt)                            — an EVENT frame, `body` decoded
 *   'sessionEvent' (evt)                            — join/leave/takeover/goodbye
 *   'clock'        ({offsetUs, rttUs})              — a CLOCK sync result
 *   'pairGrant'    ({token, role, trust})            — RFC-027 §12.2: this
 *                                                      SESSION was just granted
 *                                                      a tier (knock-and-approve,
 *                                                      PIN, or push-to-pair —
 *                                                      PAIR_GRANT is unicast to
 *                                                      the granted session only,
 *                                                      so receiving it always
 *                                                      means "us"). `role` is
 *                                                      adopted into state.roles
 *                                                      immediately, mirroring
 *                                                      the hub's own in-place
 *                                                      upgrade (hub_impl.hpp) —
 *                                                      no reconnect required.
 *                                                      Persisting `token` is the
 *                                                      caller's job (identity.js
 *                                                      setPairedToken).
 *   'error'        ({kind, code, codeName, detail, ...})  — a loud, visible
 *                                                      client-side failure that
 *                                                      also tore the session
 *                                                      down (RFC-039.2: today
 *                                                      this is only the blob-
 *                                                      refusal case — see
 *                                                      refuseBlob() below)
 *   'close'        ({code, reason, willReconnect})  — socket closed
 */

import {
  cbUint, cbInt, cbBool, cbF32, cbTstr, cbBstr, cbMap, cbArray, cbDecodeFull,
} from './cbor.js';
import {
  FRAME, FRAME_NAME, K, IDENTITY_K, TRUST_K, WELCOME_LIMITS_K, PRIORITY, WS_SUBPROTOCOL,
  PROTO_VER, LIMITS, nackName, GOODBYE_CODE,
  CBOR_FIELD, CHANNEL_CLASS, SAFETY_OP, SAFETY_CAUSE,
  CH_SAFETY, CH_SAFETY_INTENTS,
  CH_MOVE, CH_CONFIG_SET, CH_PATTERN_CMD, CH_MODES_SET, CH_HOME,
  encodeFrame, parseFrames, encodeEstopFrame, ESTOP_FRAME_BYTES,
  STREAM_KIND, HEADER_BYTES, encodeBundle, BLOB_NS, NACK, decodeSafetySnapshot,
} from './frames.js';
import {
  buildBlobReq, buildCatalogRequest, buildCatalogRepair, buildBlobDone, BLOB_DONE_STATUS,
  BlobReassembler, parseBlobChunk,
  decodeCatalog, catalogChannelMap, decodePacked, decodeEventBody, schemaByKey,
  optionAccessFor, canUseOption, encodePacked, storeItemDigestOk,
} from './catalog.js';
import { catalogEtag, bytesEqual, toHex, fromHex } from './sha256.js';

const DEFAULT_BACKOFF_MS = [500, 1000, 2000, 5000];

// §6.3 (RFC-055): HELLO refusals that carry retry_after_ms and bind the reconnect.
const ADMISSION_CODES = new Set([NACK.HUB_AT_CAPACITY, NACK.HUB_SHEDDING]);

// RFC-087: the schedule horizons a grant may advertise; anything else is the default.
const SCHEDULE_HORIZONS_MS = new Set([250, 500, LIMITS.schedule_horizon_max_ms]);

/** Why a fetchBlob() rejected. Every failure rejects with a BlobError carrying one of these. */
export const BLOB_ERROR = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST', // ns 0 (use requestCatalog), or ns/storeId/slot not a u8
  NOT_READY: 'NOT_READY', // socket not open, or no catalog adopted yet to resolve the store against
  UNKNOWN_STORE: 'UNKNOWN_STORE', // ns 1 and no STORE entry in this hub's catalog declares storeId
  UNAVAILABLE: 'UNAVAILABLE', // NACK CHUNK_UNAVAILABLE: empty slot, or the item moved mid-transfer
  REFUSED: 'REFUSED', // any other NACK (ACCESS_DENIED, BUSY + retryAfterMs, INVALID_NAMESPACE); `nack` attached
  HASH_MISMATCH: 'HASH_MISMATCH', // reassembled whole but not the caller's expectDigest; `bytes` attached
  TIMEOUT: 'TIMEOUT', // not reassembled within frag_reassembly_timeout_ms of the request (§8.4)
  ABORTED: 'ABORTED', // caller's AbortSignal, a catalog transfer superseding it, or the socket closed
});

export class BlobError extends Error {
  constructor(code, id, message, extra = {}) {
    super(code + ' ns=' + id.ns + ' store=' + id.storeId + ' slot=' + id.slot + ': ' + message);
    this.name = 'BlobError';
    this.code = code;
    this.ns = id.ns;
    this.storeId = id.storeId;
    this.slot = id.slot;
    Object.assign(this, extra);
  }
}

/** Session states, mirroring ClientSessionState in client/client.hpp (§2.2). */
export const SESSION_STATE = {
  CLOSED: 'CLOSED',
  HELLO_SENT: 'HELLO_SENT',
  SYNCING: 'SYNCING',
  LIVE: 'LIVE',
};

/** Why a STREAM send was refused. Every refusal throws; nothing is dropped silently. */
export const PUBLISH_ERROR = Object.freeze({
  NOT_LIVE: 'NOT_LIVE', // session not LIVE: the hub drops pre-ready bundles without a word (§9.2)
  UNKNOWN_CHANNEL: 'UNKNOWN_CHANNEL', // not in this hub's catalog
  NOT_PUBLISHABLE: 'NOT_PUBLISHABLE', // not a c2h STREAM channel
  WRONG_STREAM_KIND: 'WRONG_STREAM_KIND', // publishSamples on a segments channel or vice versa
  NOT_GRANTED: 'NOT_GRANTED', // no granted_publishes entry for the channel (§6.2)
  NO_CLOCK: 'NO_CLOCK', // no CLOCK reply yet, so no anchor can be expressed in hub time (§7.1)
  BAD_SAMPLE: 'BAD_SAMPLE', // a sample does not encode against the catalog layout
  BAD_BUNDLE: 'BAD_BUNDLE', // violates a §5.4 cap or the negotiated max_frame
  SCHEDULE_TOO_FAR: 'SCHEDULE_TOO_FAR', // a segment start beyond the grant's schedule horizon: the hub drops it
  RATE_EXCEEDED: 'RATE_EXCEEDED', // would overdraw the granted-rate token bucket (§10.5)
  NOT_SENT: 'NOT_SENT', // socket not open
});

export class PublishError extends Error {
  constructor(code, channel, message) {
    super(code + ' ch=0x' + (channel >>> 0).toString(16) + ': ' + message);
    this.name = 'PublishError';
    this.code = code;
    this.channel = channel;
  }
}

/** monotonic microsecond clock, truncated to u32 (CLOCK t0/t3 domain, §7.1). */
function clientNowUs() {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 1000;
  return Math.floor(now) >>> 0;
}

/** windowed signed u32 difference a-b (util/serial_arithmetic.hpp timeDelta). */
function wrapDiff(a, b) {
  let d = (a - b) >>> 0;
  if (d >= 0x80000000) d -= 0x100000000;
  return d;
}

/** 8 random bytes for instance_id (§6.1). */
function newInstanceId() {
  const b = new Uint8Array(LIMITS.instance_id_bytes);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = (Math.random() * 256) | 0;
  return b;
}

// ---- catalog cache ---------------------------------------------------------
// The whole point of the etag: a client that already HOLDS the catalog proves
// possession in its HELLO and the hub opens the data plane with zero extra
// frames. That requires caching the BYTES, not just the tag — the tag alone
// would let us claim readiness for a catalog we cannot decode.
//
// Backed by localStorage in a browser; a module-level Map otherwise (node
// tests, workers), which is also what makes the second of two back-to-back
// test sessions exercise the fast path.
const _memCatalogCache = new Map();

function defaultCatalogStore() {
  const ls = (() => {
    try {
      if (typeof localStorage === 'undefined') return null;
      // Touch it: node defines the global but THROWS on access without
      // --localstorage-file, and a browser in private mode can too. A probe
      // read is the only honest availability test.
      localStorage.getItem('valence.probe');
      return localStorage;
    } catch (e) { return null; }
  })();
  const keyFor = (host) => 'valence.catalog.' + host;
  return {
    load(host) {
      if (ls) {
        try {
          const raw = ls.getItem(keyFor(host));
          if (raw) {
            const o = JSON.parse(raw);
            return { etag: fromHex(o.etag), bytes: fromHex(o.bytes) };
          }
        } catch (e) { /* corrupt entry: treat as absent */ }
        return null;
      }
      return _memCatalogCache.get(host) || null;
    },
    save(host, etag, bytes) {
      if (ls) {
        try {
          ls.setItem(keyFor(host), JSON.stringify({ etag: toHex(etag), bytes: toHex(bytes) }));
        } catch (e) { /* quota/private mode: caching is an optimization, never a requirement */ }
        return;
      }
      _memCatalogCache.set(host, { etag, bytes });
    },
    clear(host) {
      if (ls) { try { ls.removeItem(keyFor(host)); } catch (e) { /* ignore */ } return; }
      _memCatalogCache.delete(host);
    },
  };
}

/**
 * Create a Valence session.
 * @param {Object} opts
 * @param {string} opts.host device host/IP (default 192.168.1.229)
 * @param {number} [opts.port] hub WS port (default 82)
 * @param {string} [opts.clientKind] HELLO client_kind (default 'webui')
 * @param {string} [opts.clientName] HELLO client_name
 * @param {Uint8Array} [opts.instanceId] stable 8-byte identity (default random)
 * @param {Uint8Array} [opts.token] 16-byte pairing token (absent = watch)
 * @param {number|null} [opts.deadmanWishMs] HELLO key 44 (RFC-038): this
 *        client's requested deadman window, in ms. Default 2000 — a browser
 *        tab's liveness cadence is coarse (background-tab timer throttling),
 *        so asking for a window well above the hub's 600 ms default cuts down
 *        on spurious alt-tab evictions without flooding PINGs. The hub clamps
 *        into [deadman_min_ms, deadman_max_ms] and ALWAYS echoes the APPLIED
 *        value on WELCOME key 24 (deadmanMs) — this wish is never adopted
 *        directly, only the echo is (see handleWelcome). Pass null/false to
 *        omit the key entirely (pre-RFC-038 hub compatibility needs nothing
 *        special; absent just means "hub default").
 * @param {Array<[number, number, number]>} [opts.subscriptions] [ch, rateHz, priority]
 *        wishes carried in every HELLO (key 10, §6.2), at most
 *        LIMITS.max_subscriptions_per_frame. WELCOME's limits.retained_pending
 *        counts only WELCOME's own grants, so a channel subscribed later is
 *        not part of the LIVE gate on a fresh session. Catalog-resolved
 *        channels call subscribe() once the catalog lands.
 * @param {Array<[number, number, number?, number?]>} [opts.publishes] [ch, rateHz, burst?, curveFamily?]
 *        STREAM publish wishes carried in HELLO (key 11, §6.2). The ids must
 *        be known before the catalog is; a client that finds its channel in
 *        the catalog calls publish() once LIVE instead.
 * @param {boolean} [opts.autoCatalog] fetch the catalog when the etag misses (default true)
 * @param {boolean} [opts.autoReconnect] reconnect with backoff on drop (default true)
 * @param {Object} [opts.catalogStore] {load(host), save(host, etag, bytes), clear(host)}
 * @param {Function} [opts.WebSocketImpl] WebSocket constructor (default global WebSocket)
 * @param {Function} [opts.log] optional (level, ...args) logger
 * @returns {Object} session handle
 */
export function createSession(opts = {}) {
  const host = opts.host || '192.168.1.229';
  const port = opts.port || 82;
  const clientKind = opts.clientKind || 'webui';
  const clientName = opts.clientName || 'valence-js';
  const instanceId = opts.instanceId || newInstanceId();
  // `token` may be BYTES or a PROVIDER. The provider form exists because the
  // device's /uitoken credential is single-use and short-lived: bytes captured
  // once at construction authorize the first connect and silently demote every
  // reconnect to `watch`, which presents as "connected, but every control is
  // dead" after any blip. A provider is re-asked per connect, so a fresh
  // credential is fetched exactly when one is needed. May return a promise.
  const tokenProvider = typeof opts.token === 'function' ? opts.token : null;
  let liveToken = tokenProvider ? null : (opts.token || null);
  // RFC-038: default 2000ms — see the JSDoc above for why a browser wants this.
  // `opts.deadmanWishMs` explicitly null/false omits the key (pre-RFC-038 hubs
  // need nothing special; §4.3 forward-compat ignores an unknown HELLO key
  // just as readily as an absent one).
  const deadmanWishMs = opts.deadmanWishMs === undefined ? 2000 : opts.deadmanWishMs;
  const autoCatalog = opts.autoCatalog !== false;
  const autoReconnect = opts.autoReconnect !== false;
  const catalogStore = opts.catalogStore || defaultCatalogStore();
  const WSImpl = opts.WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
  const log = opts.log || (() => {});
  const subscribeWishes = opts.subscriptions || [];
  if (subscribeWishes.length > LIMITS.max_subscriptions_per_frame) {
    throw new RangeError('createSession: ' + subscribeWishes.length + ' subscription wishes, HELLO carries at most ' +
      LIMITS.max_subscriptions_per_frame + '; subscribe() the rest once LIVE');
  }
  const publishWishes = opts.publishes || [];

  // ---- listener registry --------------------------------------------------
  const listeners = new Map();
  function on(name, cb) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(cb);
    return () => off(name, cb);
  }
  function off(name, cb) {
    const s = listeners.get(name);
    if (s) s.delete(cb);
  }
  function emit(name, ...args) {
    const s = listeners.get(name);
    if (s) for (const cb of s) { try { cb(...args); } catch (e) { log('error', 'listener', name, e); } }
  }

  // ---- session state ------------------------------------------------------
  let ws = null;
  let intentionalClose = false;
  let backoffIdx = 0;
  let reconnectTimer = null;
  let retryNotBeforeMs = 0; // §6.3: earliest reconnect after an admission refusal (jitter included)

  const state = {
    phase: SESSION_STATE.CLOSED,
    connected: false,
    welcomed: false,
    sessionId: null,
    bootId: null,
    cfgGen: null,
    catalogEtag: null, // the HUB's etag from WELCOME
    readyEtag: null, // what WE declared we operate against
    ready: false, // RFC-015: is our data plane open?
    identity: null, // {product, fw_version, hub_name, info, hub_instance_id, estop_cuts_power}
    safety: null, // latest 0x0003 snapshot by registry bits (decodeSafetySnapshot); also emitted as 'safety'
    // §6.3: the last admission refusal {code, name, retryAfterMs, reconnectInMs, atMs}; null once WELCOMEd
    admission: null,
    roles: null,
    // RFC-027 §12.2: WELCOME `trust.pairing_modes` (TRUST_K.pairing_modes,
    // key 8) — bitmask of PAIRING_MODE bits this hub offers RIGHT NOW,
    // re-evaluated per session so a transient push-to-pair window is only
    // advertised while it is actually open. 0 (no bits) when the hub sent no
    // `trust` map at all (pre-RFC-027 hub, or nothing on offer).
    pairingModes: 0,
    deadmanMs: LIMITS.deadman_default_ms,
    deadmanPolicy: null,
    limits: {}, // WELCOME limits by WELCOME_LIMITS_K name (max_sessions / sessions_in_use: 0 = unknown)
    grants: new Map(), // channelId -> {rate, priority}
    grantedPublishes: new Map(), // channelId -> {channel, rate, burst, curveFamily, requestedCurveFamily, scheduleLatencyUs, scheduleHorizonMs}
    clockOffsetUs: 0,
    clockSynced: false, // a CLOCK reply has landed this session, so anchors mean something
  };

  let catalogEntries = null;
  let channelMap = null; // Map<id, entry>
  let catalogBytes = null;
  const blob = new BlobReassembler();
  let catalogInFlight = false; // BLOB_REQ ns 0 sent, not yet reassembled: the hub's one cursor is the catalog's

  // RFC-015 readiness bookkeeping (mirrors Client::pumpCatalogReady)
  let readyPending = false;
  let readyAttempts = 0;
  let lastReadySendMs = 0;
  const READY_MAX_ATTEMPTS =
    Math.floor(LIMITS.catalog_ready_timeout_ms / LIMITS.catalog_chunk_gap_timeout_ms);

  // §6.8 snapshot adoption: LIVE once the catalog is adopted and the retained
  // pushes WELCOME promised have landed. Only WELCOME's own grants count, the
  // set retained_pending is computed over; a later SUBSCRIBE's push does not.
  let requiredRetained = 0;
  let welcomeGrants = new Set();
  let adoptedChannels = new Set();

  // pending intents awaiting ECHO/NACK correlation (by intent_id)
  let intentSeq = 0; // session-scoped u16 idempotency id (§9.3), starts at 1
  const pending = new Map(); // intent_id -> {channelId, resolve, reject, timer}

  // §11.2 repeat-until-latch for the RAW estop path
  let estopActive = false;
  let estopSentSeq = 0;
  let estopNextSeq = 1;
  let estopAttempts = 0;
  let lastEstopSendMs = 0;

  // STREAM sender bookkeeping per granted channel: the u16 seq (per channel per
  // direction, §7.3) and a token bucket mirroring the hub's (§10.5).
  const pubTx = new Map(); // channelId -> {seq, tokens, lastMs}
  const pendingPublish = []; // FIFO of {resolve, reject, timer}
  let lastClockSyncMs = 0;

  // TX-silence PING keepalive (§6.5)
  let lastTxMs = 0;
  let pumpTimer = null;
  let pendingClock = null; // {t0, resolve}

  function pingIntervalMs() {
    // stay well under the deadman window; ~60% of it, clamped to [150, 400]ms
    return Math.max(150, Math.min(400, Math.floor(state.deadmanMs * 0.6)));
  }

  function setPhase(p) {
    if (state.phase === p) return;
    state.phase = p;
    if (p === SESSION_STATE.LIVE) emit('live');
  }

  // ---- low-level send -----------------------------------------------------
  function sendFrame(type, channel, payload, seq = 0, flags = 0) {
    if (!ws || ws.readyState !== 1) return false;
    ws.send(encodeFrame(type, channel, payload || new Uint8Array(0), seq, flags));
    lastTxMs = Date.now();
    return true;
  }

  function sendRaw(bytes) {
    if (!ws || ws.readyState !== 1) return false;
    ws.send(bytes);
    lastTxMs = Date.now();
    return true;
  }

  // ---- HELLO --------------------------------------------------------------
  let cachedCatalog = null; // {etag, bytes} loaded at connect()

  function buildHello() {
    // keys ascending: proto_ver(1) < client_kind(2) < client_name(3) <
    // instance_id(4) < [token(5)] < [catalog_etag(8)] < [subscriptions(10)] <
    // [publishes(11)] < [deadman_wish_ms(44)].
    //
    // catalog_etag is RFC-015's fast path: presenting an etag the hub agrees
    // with IS proof of possession, so the hub marks us ready in WELCOME and
    // pushes retained state immediately — no fetch, no CATALOG_READY, no
    // round trip. This is the 99% reconnect case and it stays zero-latency.
    const pairs = [
      [K.proto_ver, cbUint(PROTO_VER)],
      [K.client_kind, cbTstr(clientKind)],
      [K.client_name, cbTstr(clientName)],
      [K.instance_id, cbBstr(instanceId)],
    ];
    if (liveToken) pairs.push([K.token, cbBstr(liveToken)]);
    if (cachedCatalog) pairs.push([K.catalog_etag, cbBstr(cachedCatalog.etag)]);
    if (subscribeWishes.length) pairs.push([K.subscriptions, encodeSubscriptionWishes(subscribeWishes)]);
    if (publishWishes.length) pairs.push([K.publishes, encodePublishWishes(publishWishes)]);
    // RFC-038: ask for a browser-honest deadman window. The hub clamps into
    // [deadman_min_ms, deadman_max_ms] and echoes the APPLIED value on the
    // EXISTING WELCOME key 24 — handleWelcome() adopts ONLY that echo, never
    // this wish, so a hub that clamps tighter (or predates RFC-038 entirely
    // and ignores the key) is handled correctly with no special-casing here.
    if (deadmanWishMs != null && deadmanWishMs !== false) {
      pairs.push([K.deadman_wish_ms, cbUint(deadmanWishMs)]);
    }
    return cbMap(pairs);
  }

  // ---- SUBSCRIBE ----------------------------------------------------------
  /**
   * @param {Array<[number, number, number]>} wishes [channelId, rateHz, priority]
   */
  function subscribe(wishes) {
    sendFrame(FRAME.SUBSCRIBE, 0, cbMap([[K.subscriptions, encodeSubscriptionWishes(wishes)]]));
  }

  // [{12:rate_hz, 13:priority, 15:channel_id}], keys ascending 12<13<15; the
  // same entries ride HELLO key 10 and SUBSCRIBE (§6.2, §6.7).
  function encodeSubscriptionWishes(wishes) {
    return cbArray(wishes.map(([ch, rate, prio]) =>
      cbMap([
        [K.rate_hz, cbF32(rate)],
        [K.priority, cbUint(prio == null ? PRIORITY.normal : prio)],
        [K.channel_id, cbUint(ch)],
      ])));
  }

  // ---- PUBLISH (§6.2 / §6.7) ----------------------------------------------
  // Entry keys ascending: rate_hz(12) < channel_id(15) < [burst(42)] <
  // [curve_family(45)]. rate_hz and burst are f32 on the wire; the hub's
  // decoder rejects an integer there.
  function encodePublishWishes(wishes) {
    return cbArray(wishes.map(([ch, rate, burst, family]) => {
      const pairs = [[K.rate_hz, cbF32(rate)], [K.channel_id, cbUint(ch)]];
      if (burst != null) pairs.push([K.burst, cbF32(burst)]);
      if (family != null) pairs.push([K.curve_family, cbUint(family)]);
      return cbMap(pairs);
    }));
  }

  /**
   * Add, change or drop (rate 0) STREAM publications mid-session (§6.7).
   * Resolves with the applied grants from the answering GRANT. A wished
   * channel absent from the answer was refused and is no longer publishable
   * from this client.
   * @param {Array<[number, number, number?, number?]>} wishes [ch, rateHz, burst?, curveFamily?]
   * @param {Object} [o] {timeoutMs}
   * @returns {Promise<Array<Object>>} the granted publish records
   */
  function publish(wishes, o = {}) {
    if (!state.welcomed) return Promise.reject(new Error('publish: no session (WELCOME not received)'));
    return new Promise((resolve, reject) => {
      const req = { channels: wishes.map((w) => w[0]), resolve, reject, timer: null };
      req.timer = setTimeout(() => {
        const i = pendingPublish.indexOf(req);
        if (i >= 0) pendingPublish.splice(i, 1);
        reject(new Error('publish: no GRANT answered the PUBLISH'));
      }, o.timeoutMs || 3000);
      pendingPublish.push(req);
      if (!sendFrame(FRAME.PUBLISH, 0, cbMap([[K.publishes, encodePublishWishes(wishes)]]))) {
        clearTimeout(req.timer);
        pendingPublish.splice(pendingPublish.indexOf(req), 1);
        reject(new Error('publish: not sent (socket not open)'));
      }
    });
  }

  function adoptPublishGrant(e) {
    const ch = e.get(K.channel_id);
    const rec = {
      channel: ch,
      rate: e.get(K.granted_rate_hz),
      burst: e.has(K.burst) ? e.get(K.burst) : null,
      curveFamily: e.has(K.curve_family) ? e.get(K.curve_family) : null,
      requestedCurveFamily: e.has(K.requested_curve_family) ? e.get(K.requested_curve_family) : null,
      // RFC-059: the hub's committed delay from a sample's time to its execution
      // (on samples kind, the chase-planning budget). Lead media by this; never
      // hardcode it. null = unspecified (absent or 0).
      scheduleLatencyUs: e.get(K.schedule_latency_us) || null,
      // RFC-087: how far ahead a segment's START may be stamped, and the span
      // cap of a c2h segments bundle. A cap, never a delay. Absent or off-step
      // reads as the 250 ms default.
      scheduleHorizonMs: SCHEDULE_HORIZONS_MS.has(e.get(K.schedule_horizon_ms))
        ? e.get(K.schedule_horizon_ms) : LIMITS.max_future_schedule_ms,
    };
    state.grantedPublishes.set(ch, rec);
    // The hub rebuilds this channel's bucket full on every grant (session.hpp
    // addPublishGrant); mirror it. The seq keeps counting: same session.
    const tx = pubTx.get(ch);
    pubTx.set(ch, { seq: tx ? tx.seq : 0, tokens: bucketCapacity(rec), lastMs: Date.now() });
    return rec;
  }

  // The hub meters samples at uint32(granted_rate) floored at 1, with capacity
  // = burst when echoed, else the rate (session.hpp addPublishGrant).
  function bucketRate(rec) { return Math.max(1, Math.floor(rec.rate)); }
  function bucketCapacity(rec) { return rec.burst != null ? rec.burst : bucketRate(rec); }

  // ---- STREAM sender (§5.4 / §9.2) ----------------------------------------
  function refuse(code, ch, msg) { throw new PublishError(code, ch, msg); }

  // Validates, encodes and sends ONE bundle. Every refusal throws PublishError;
  // the seq advances only for a bundle that reached the socket.
  function sendStream(channelId, kind, values, tOffsUs, anchorUs) {
    if (state.phase !== SESSION_STATE.LIVE) refuse(PUBLISH_ERROR.NOT_LIVE, channelId, 'session is ' + state.phase);
    const entry = channelMap && channelMap.get(channelId);
    if (!entry) refuse(PUBLISH_ERROR.UNKNOWN_CHANNEL, channelId, 'not in this hub\'s catalog');
    if (entry.cls !== CHANNEL_CLASS.STREAM || entry.dirName !== 'c2h') {
      refuse(PUBLISH_ERROR.NOT_PUBLISHABLE, channelId, entry.clsName + ' ' + entry.dirName + ', not a c2h STREAM');
    }
    if (entry.streamKind !== kind) {
      refuse(PUBLISH_ERROR.WRONG_STREAM_KIND, channelId, 'channel stream_kind is ' + entry.streamKind + ', sender needs ' + kind);
    }
    const grant = state.grantedPublishes.get(channelId);
    if (!grant) refuse(PUBLISH_ERROR.NOT_GRANTED, channelId, 'no granted publish; call publish() first');
    if (!state.clockSynced) refuse(PUBLISH_ERROR.NO_CLOCK, channelId, 'no CLOCK reply yet');

    // §5.4 (RFC-087): c2h segments count t_off in 100 us units and span up to
    // the grant's horizon; samples keep 1 us units and the 20 ms span cap.
    const seg = kind === STREAM_KIND.segments;
    const bundleOpts = seg ? { unitUs: LIMITS.segment_t_off_unit_us, spanCapUs: grant.scheduleHorizonMs * 1000 } : {};
    let payload;
    try {
      payload = encodeBundle(anchorUs, tOffsUs, values.map((v) => encodePacked(v, entry.layout || [])), bundleOpts);
    } catch (e) {
      refuse(e instanceof RangeError && /^bundle/.test(e.message) ? PUBLISH_ERROR.BAD_BUNDLE : PUBLISH_ERROR.BAD_SAMPLE,
        channelId, e.message);
    }
    const maxFrame = state.limits.max_frame;
    if (maxFrame && HEADER_BYTES + payload.length > maxFrame) {
      refuse(PUBLISH_ERROR.BAD_BUNDLE, channelId, (HEADER_BYTES + payload.length) + ' B frame exceeds max_frame ' + maxFrame);
    }
    if (seg) {
      // The hub tests the LAST start against its horizon, so that is the one checked.
      const aheadUs = wrapDiff((anchorUs + tOffsUs[tOffsUs.length - 1]) >>> 0, hubNowUs());
      if (aheadUs > grant.scheduleHorizonMs * 1000) {
        refuse(PUBLISH_ERROR.SCHEDULE_TOO_FAR, channelId, 'last start is ' + aheadUs + ' us ahead, horizon ' + grant.scheduleHorizonMs + ' ms');
      }
    }

    const tx = pubTx.get(channelId);
    const nowMs = Date.now();
    const cap = bucketCapacity(grant);
    tx.tokens = Math.min(cap, tx.tokens + Math.max(0, nowMs - tx.lastMs) / 1000 * bucketRate(grant));
    tx.lastMs = nowMs;
    if (tx.tokens < values.length) {
      refuse(PUBLISH_ERROR.RATE_EXCEEDED, channelId, values.length + ' sample(s) against ' + tx.tokens.toFixed(2) +
        ' tokens at the granted ' + grant.rate + ' Hz');
    }
    const seq = tx.seq;
    if (!sendFrame(FRAME.STREAM, channelId, payload, seq)) refuse(PUBLISH_ERROR.NOT_SENT, channelId, 'socket not open');
    tx.tokens -= values.length;
    tx.seq = (seq + 1) & 0xffff;
    return { seq, n: values.length };
  }

  /**
   * Send dense samples on a `samples`-kind c2h STREAM channel (§9.2). Each
   * sample is {layoutFieldName: physicalValue}, scaled per the catalog layout.
   * Timestamps are OBSERVATIONAL: sample i describes hub time anchor + t_off[i].
   * @param {number} channelId
   * @param {Object|Object[]} samples 1..bundle_max_samples samples
   * @param {Object} [o] {anchor: u32 hub-µs of sample[0] (default hubNowUs()),
   *        offsetsUs: explicit t_off[] | periodUs: spacing (default 1/granted rate)}
   * @returns {{seq:number, n:number}} the bundle's frame seq and sample count
   * @throws {PublishError}
   */
  function publishSamples(channelId, samples, o = {}) {
    const values = Array.isArray(samples) ? samples : [samples];
    let offs = o.offsetsUs;
    if (!offs) {
      const grant = state.grantedPublishes.get(channelId);
      const period = o.periodUs != null ? o.periodUs : (grant ? Math.round(1e6 / grant.rate) : 0);
      offs = values.map((_, i) => i * period);
    }
    const anchor = o.anchor != null ? o.anchor : hubNowUs();
    return sendStream(channelId, STREAM_KIND.samples, values, offs, anchor);
  }

  /**
   * Send timed segments on a `segments`-kind c2h STREAM channel (§9.2/§9.6).
   * Each segment is {layoutFieldName: physicalValue}. anchor + offsetsUs[i] is
   * segment i's EXECUTION START in hub time (§5.4). A bundle may fill toward
   * the grant's scheduleHorizonMs (RFC-087, 250 ms when the grant carries no
   * key 50): every start must lie within it, and offsets are multiples of
   * segment_t_off_unit_us (100 us). A newly accepted bundle supersedes every
   * not-yet-started segment at or after its first start (the flush).
   * @param {number} channelId
   * @param {Object|Object[]} segments one segment, or 1..bundle_max_samples
   * @param {Object} [o] {anchor: u32 hub-µs first start (default hubNowUs()),
   *        offsetsUs: per-segment start offsets in µs (required for more than one)}
   * @returns {{seq:number, n:number}}
   * @throws {PublishError}
   */
  function publishSegment(channelId, segments, o = {}) {
    const values = Array.isArray(segments) ? segments : [segments];
    const offs = o.offsetsUs || (values.length === 1 ? [0] : null);
    if (!offs) refuse(PUBLISH_ERROR.BAD_BUNDLE, channelId, values.length + ' segments need offsetsUs');
    const anchor = o.anchor != null ? o.anchor : hubNowUs();
    return sendStream(channelId, STREAM_KIND.segments, values, offs, anchor);
  }

  // ---- CATALOG (BLOB namespace 0) -----------------------------------------
  function requestCatalog() {
    blob.reset();
    catalogInFlight = true; // before the abort below, so it cannot start the next store fetch
    if (storeFetches.length && storeFetches[0].seqs.size) {
      abortFetch(storeFetches[0], 'superseded by a catalog transfer'); // the hub's cursor moves to ns 0
    }
    sendFrame(FRAME.BLOB_REQ, 0, buildCatalogRequest());
  }

  /** Adopt decoded catalog bytes as this session's decoder ring. */
  function adoptCatalog(bytes, { cached, verified, etag }) {
    catalogEntries = decodeCatalog(bytes);
    channelMap = catalogChannelMap(catalogEntries);
    catalogBytes = bytes;
    emit('catalog', catalogEntries, channelMap, { cached, verified, etag });
  }

  /**
   * §8.4/RFC-015: the hash IS the acknowledgment. Declare which catalog we now
   * operate against so the hub opens our data plane. Mirrors
   * Client::sendCatalogReady, including the honest-degraded case: on a transfer
   * that did NOT verify we declare the digest of the bytes we ACTUALLY hold, so
   * the hub can flag the session rather than be misled.
   */
  function sendCatalogReady(etag) {
    state.readyEtag = etag;
    if (sendFrame(FRAME.CATALOG_READY, 0, etag)) {
      readyPending = true;
      lastReadySendMs = Date.now();
      readyAttempts++;
      emit('ready', { etag, cached: false });
    }
  }

  function pumpCatalogReady(nowMs) {
    if (!readyPending) return;
    // Bounded by the hub's own catalog_ready_timeout_ms: past that the hub has
    // already GOODBYE'd us (READY_TIMEOUT), so re-declaring is pure noise.
    if (readyAttempts >= READY_MAX_ATTEMPTS) { readyPending = false; return; }
    if (nowMs - lastReadySendMs < LIMITS.catalog_chunk_gap_timeout_ms) return;
    // Idempotent on the hub side by design — re-declaring is a flag-set, so a
    // lossy binding costs nothing but 16 bytes per repair interval.
    sendFrame(FRAME.CATALOG_READY, 0, state.readyEtag);
    lastReadySendMs = nowMs;
    readyAttempts++;
  }

  /**
   * §8.4/RFC-050: this client is the RECEIVER of the catalog blob, so it owes
   * the hub one BLOB_DONE per concluded reassembly. Best-effort and idempotent
   * by contract -- nothing upstream blocks on it, so a failed send needs no
   * retry timer. It reports an outcome and never asks for a resend; wanting one
   * means a fresh BLOB_REQ, which is what requestCatalog() below already does.
   */
  function sendBlobDone(status, id) {
    try { sendFrame(FRAME.BLOB_DONE, 0, buildBlobDone(status, id)); } catch (e) { /* gone */ }
  }

  function pumpBlobRepair(nowMs) {
    if (!blob.active || blob.complete()) return;
    if (blob.timedOut(nowMs)) {
      sendBlobDone(BLOB_DONE_STATUS.ABORTED); // say so before starting over (sd-3qu)
      requestCatalog();
      return; // abandon → restart from scratch
    }
    if (!blob.gapElapsed(nowMs)) return;
    const missing = blob.missingIndices();
    if (missing.length) {
      sendFrame(FRAME.BLOB_REQ, 0, buildCatalogRepair(missing.slice(0, 32)));
      blob.noteRepairSent(nowMs); // one repair per gap interval
    }
  }

  /**
   * RFC-039.2: this client's reassembler refuses a declared blob whose
   * `total_bytes` exceeds its cap. The old behavior — silently returning
   * from handleBlobChunk() — is BlobReassembler's own documented failure: the
   * session went LIVE WITH NO CATALOG, every STATE frame after it arrived
   * undecodable, and nothing said why until READY_TIMEOUT killed the session
   * 15 s later and blamed the client in every log. Refusal is legal; SILENT
   * refusal is not. So instead: GOODBYE with BLOB_REFUSED (a real reason code,
   * not idling in a half-session) and an 'error' event so the integrator can
   * show it — never a bare console.warn that a headless integrator won't see.
   */
  function refuseBlob(declaredTotalBytes) {
    const info = {
      kind: 'blob_refused',
      code: GOODBYE_CODE.BLOB_REFUSED,
      codeName: 'BLOB_REFUSED',
      declaredTotalBytes,
      capBytes: blob.maxTotalBytes,
      detail: 'declared blob total_bytes ' + declaredTotalBytes +
        ' exceeds this client\'s ' + blob.maxTotalBytes + '-byte reassembly cap',
    };
    log('error', 'blob refused — GOODBYE BLOB_REFUSED', info);
    emit('error', info);
    try {
      if (ws && ws.readyState === 1) {
        sendFrame(FRAME.GOODBYE, 0, cbMap([[K.code, cbUint(GOODBYE_CODE.BLOB_REFUSED)]]));
      }
    } catch (e) { /* gone */ }
    try { if (ws) ws.close(); } catch (e) { /* gone */ }
    // Deliberately NOT `intentionalClose = true`: this is a real failure, not a
    // voluntary teardown, so the normal autoReconnect/backoff policy still
    // applies (§6.9 — every teardown path is otherwise ordinary). A device
    // whose catalog genuinely outgrows this cap will hit this every reconnect,
    // which is the point: loud and repeated beats a session that quietly
    // never lights up.
  }

  function handleBlobChunk(payload) {
    const h = parseBlobChunk(payload);
    if (!h) return;
    // Each transfer owns its reassembler: ns 0 is `blob`, every other
    // namespace routes to the store fetch it belongs to (or is dropped).
    if (h.ns !== BLOB_NS.catalog) { handleStoreChunk(h); return; }
    if (h.chunkCount === 0 || h.chunkIndex >= h.chunkCount) return;

    const now = Date.now();
    if (!blob.active || blob.chunkCount !== h.chunkCount || blob.totalBytes !== h.totalBytes) {
      if (h.totalBytes > blob.maxTotalBytes) { refuseBlob(h.totalBytes); return; }
      if (!blob.begin(h, now)) return; // malformed header (chunkCount/totalBytes 0): not a cap refusal
    }
    if (!blob.insert(h, now)) return;
    if (!blob.complete()) return;

    const bytes = blob.assembled().slice();
    blob.reset();
    catalogInFlight = false;

    const digest = catalogEtag(bytes, LIMITS.etag_bytes);
    const verified = !!state.catalogEtag && bytesEqual(digest, state.catalogEtag);
    // BEFORE adoption, and deliberately: BLOB_DONE closes the TRANSFER ("what
    // arrived, and did it verify"), CATALOG_READY declares ADOPTION. A decode
    // failure below returns without a READY, so reporting the transfer here is
    // also the only way that case is ever reported at all.
    sendBlobDone(verified ? BLOB_DONE_STATUS.VERIFIED_COMPLETE : BLOB_DONE_STATUS.HASH_MISMATCH);
    try {
      adoptCatalog(bytes, { cached: false, verified, etag: verified ? state.catalogEtag : digest });
    } catch (e) {
      log('error', 'catalog decode failed', e);
      return; // undecodable: do NOT declare readiness for something we cannot read
    }
    // Only cache what actually verified (a mismatch means we hold something the
    // hub did not send; caching it would poison every later fast path).
    if (verified) catalogStore.save(host, state.catalogEtag, bytes);
    sendCatalogReady(verified ? state.catalogEtag : digest);
    checkLiveTransition();
  }

  // ---- STORE items and other non-catalog blobs (§8.7) ---------------------
  // The hub runs ONE blob transfer per session and a newer BLOB_REQ supersedes
  // the one in flight (Hub::handleBlobReq), so fetches queue here: only the
  // head is on the wire, and never while the catalog transfer owns the cursor.
  // That, plus repairs capped at 32 indices once per gap interval, is all the
  // receiver can do for the sender's blob_chunks_in_flight budget.
  const storeFetches = []; // FIFO; [0] is on the wire once its seqs is non-empty

  const isU8 = (v) => Number.isInteger(v) && v >= 0 && v <= 0xff;

  /**
   * Fetch one blob item: BLOB_REQ -> BLOB_CHUNK reassembly -> BLOB_DONE.
   * Resolves {ns, storeId, slot, generation, bytes}; `bytes` is the item's
   * OPAQUE encoding (§8.7), never decoded here. Rejects with a BlobError.
   * @param {Object} o
   * @param {number} [o.ns] BLOB_NS.store (default) or a device-defined 128..255
   * @param {number} o.storeId the store descriptor's storeId (catalog entry `.store.storeId`)
   * @param {number} o.slot item index
   * @param {number} [o.generation] roster generation to send in the request
   * @param {Uint8Array} [o.expectDigest] leading bytes of the item's SHA-256,
   *   checked in addition to the item's own RFC-073 `digest` when it carries one
   * @param {AbortSignal} [o.signal]
   * @returns {Promise<{ns:number,storeId:number,slot:number,generation:number,bytes:Uint8Array}>}
   */
  function fetchBlob(o = {}) {
    const f = {
      ns: o.ns == null ? BLOB_NS.store : o.ns, storeId: o.storeId, slot: o.slot,
      reqGeneration: o.generation, generation: null, expectDigest: o.expectDigest || null,
      rx: new BlobReassembler(), seqs: new Set(), startMs: 0, resolve: null, reject: null,
    };
    return new Promise((resolve, reject) => {
      f.resolve = resolve;
      f.reject = reject;
      const fail = (code, msg) => reject(new BlobError(code, f, msg));
      if (f.ns === BLOB_NS.catalog) return fail(BLOB_ERROR.BAD_REQUEST, 'the catalog is requestCatalog(), not fetchBlob()');
      if (![f.ns, f.storeId, f.slot].every(isU8)) return fail(BLOB_ERROR.BAD_REQUEST, 'ns, storeId and slot must be integers 0..255');
      if (!ws || ws.readyState !== 1 || !catalogEntries) return fail(BLOB_ERROR.NOT_READY, 'no open session with an adopted catalog');
      if (f.ns === BLOB_NS.store && !catalogEntries.some((e) => e.store && e.store.storeId === f.storeId)) {
        return fail(BLOB_ERROR.UNKNOWN_STORE, 'no STORE entry in this catalog declares that store_id');
      }
      if (o.signal) {
        if (o.signal.aborted) return fail(BLOB_ERROR.ABORTED, 'aborted by caller');
        o.signal.addEventListener('abort', () => abortFetch(f, 'aborted by caller'), { once: true });
      }
      storeFetches.push(f);
      pumpStoreFetch(Date.now());
    });
  }

  function blobIdOf(f) {
    const generation = f.generation != null ? f.generation : (f.reqGeneration || 0);
    return { ns: f.ns, storeId: f.storeId, slot: f.slot, generation };
  }

  /** Conclude a fetch exactly once; `doneStatus` null sends no BLOB_DONE. */
  function finishFetch(f, doneStatus, err, value) {
    const i = storeFetches.indexOf(f);
    if (i < 0) return;
    storeFetches.splice(i, 1);
    if (doneStatus != null) sendBlobDone(doneStatus, blobIdOf(f));
    if (err) f.reject(err); else f.resolve(value);
    pumpStoreFetch(Date.now());
  }

  function abortFetch(f, why) {
    // A request never sent armed nothing on the hub, so it has no transfer to report.
    finishFetch(f, f.seqs.size ? BLOB_DONE_STATUS.ABORTED : null, new BlobError(BLOB_ERROR.ABORTED, f, why));
  }

  function sendStoreReq(f, chunks) {
    intentSeq = (intentSeq % 0xffff) + 1; // shared with intents so a NACK's intent_seq names one request
    f.seqs.add(intentSeq);
    sendFrame(FRAME.BLOB_REQ, 0, buildBlobReq({
      ns: f.ns, storeId: f.storeId, slot: f.slot, generation: f.reqGeneration, chunks,
    }), intentSeq);
  }

  function pumpStoreFetch(nowMs) {
    const f = storeFetches[0];
    if (!f) return;
    if (!f.seqs.size) {
      if (catalogInFlight || !ws || ws.readyState !== 1) return;
      f.startMs = nowMs;
      sendStoreReq(f, null);
      return;
    }
    if (nowMs - f.startMs >= LIMITS.frag_reassembly_timeout_ms) {
      finishFetch(f, BLOB_DONE_STATUS.ABORTED, new BlobError(BLOB_ERROR.TIMEOUT, f,
        'not reassembled within ' + LIMITS.frag_reassembly_timeout_ms + ' ms'));
      return;
    }
    if (!f.rx.gapElapsed(nowMs)) return;
    const missing = f.rx.missingIndices();
    if (missing.length) {
      sendStoreReq(f, missing.slice(0, 32));
      f.rx.noteRepairSent(nowMs);
    }
  }

  function handleStoreChunk(h) {
    const f = storeFetches[0];
    // Not the head's identity: a superseded or stray transfer, never mixed in.
    if (!f || !f.seqs.size || h.ns !== f.ns || h.storeId !== f.storeId || h.slot !== f.slot) return;
    if (h.chunkCount === 0 || h.chunkIndex >= h.chunkCount) return;
    const now = Date.now();
    const rx = f.rx;
    if (!rx.active || rx.chunkCount !== h.chunkCount || rx.totalBytes !== h.totalBytes || f.generation !== h.generation) {
      if (h.totalBytes > rx.maxTotalBytes) { refuseBlob(h.totalBytes); return; }
      if (!rx.begin(h, now)) return;
      f.generation = h.generation;
    }
    if (!rx.insert(h, now) || !rx.complete()) return;

    const bytes = rx.assembled().slice();
    if (f.expectDigest && !bytesEqual(catalogEtag(bytes, f.expectDigest.length), f.expectDigest)) {
      finishFetch(f, BLOB_DONE_STATUS.HASH_MISMATCH, new BlobError(BLOB_ERROR.HASH_MISMATCH, f,
        'reassembled bytes do not match expectDigest', { generation: f.generation, bytes }));
      return;
    }
    if (!storeItemDigestOk(bytes)) {
      finishFetch(f, BLOB_DONE_STATUS.HASH_MISMATCH, new BlobError(BLOB_ERROR.HASH_MISMATCH, f,
        'item payload does not match its RFC-073 digest', { generation: f.generation, bytes }));
      return;
    }
    finishFetch(f, BLOB_DONE_STATUS.VERIFIED_COMPLETE, null, { ...blobIdOf(f), bytes });
  }

  /** A NACK for a fetch's BLOB_REQ ends it; the hub has already dropped the transfer. */
  function nackStoreFetch(info) {
    const f = storeFetches[0];
    if (!f || info.intentSeq == null || !f.seqs.has(info.intentSeq)) return false;
    const code = info.code === NACK.CHUNK_UNAVAILABLE ? BLOB_ERROR.UNAVAILABLE : BLOB_ERROR.REFUSED;
    finishFetch(f, null, new BlobError(code, f, 'NACK ' + info.name, { nack: info }));
    return true;
  }

  // ---- CLOCK sync (§7.1) --------------------------------------------------
  /**
   * Fire one CLOCK exchange. Resolves {offsetUs, rttUs} or null on timeout.
   * @param {number} [timeoutMs]
   * @returns {Promise<{offsetUs:number, rttUs:number}|null>}
   */
  function syncClock(timeoutMs = 2000) {
    return new Promise((resolve) => {
      const t0 = clientNowUs();
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setUint32(0, t0, true);
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; pendingClock = null; resolve(null); } }, timeoutMs);
      pendingClock = {
        t0,
        resolve: (reply) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          pendingClock = null;
          const t3 = clientNowUs();
          const offset = Math.floor((wrapDiff(reply.t1, reply.t0e) + wrapDiff(reply.t2, t3)) / 2);
          const rtt = wrapDiff(t3, reply.t0e) - wrapDiff(reply.t2, reply.t1);
          state.clockOffsetUs = offset;
          state.clockSynced = true;
          emit('clock', { offsetUs: offset, rttUs: rtt });
          resolve({ offsetUs: offset, rttUs: rtt });
        },
      };
      lastClockSyncMs = Date.now();
      sendFrame(FRAME.CLOCK, 0, buf);
    });
  }

  /** current hub-time estimate in µs (u32). */
  function hubNowUs() {
    return (clientNowUs() + state.clockOffsetUs) >>> 0;
  }

  // ---- PAIRING (RFC-027 §12.2) --------------------------------------------

  /**
   * Send a bare PAIR_REQ knock: {instance_id(4): bstr}, nothing else. Mirrors
   * tools/valence_probe.py's build_pair_knock() byte-for-byte.
   *
   * A bare knock (no `pin_proof`) is mode (a) knock-and-approve or mode (c)
   * push-to-pair — hub_impl.hpp::handleKnock decides which by whether a
   * presence window is open RIGHT NOW. This client never types or shows a
   * PIN, so a bare knock is the only ceremony it can initiate; the PIN path
   * (mode (b)) would add a `pin_proof` (28) key this function deliberately
   * never sends.
   *
   * DELIBERATELY FIRE-AND-FORGET, NOT A PROMISE: hub_impl.hpp is explicit
   * that a queued knock-and-approve is answered with NO FRAME AT ALL — the
   * eventual answer is a PAIR_GRANT (this session's 'pairGrant' event), a
   * NACK (PAIRING_REQUIRED / PAIRING_DENIED / BUSY, via the ordinary 'nack'
   * event) if the hub refuses outright, or silence for as long as an
   * operator takes to approve or the ~120s pending-knock window takes to
   * expire (visible as a `pairing-events` `expired` EVENT, if the caller is
   * subscribed to 0x000B). A caller that wants a bounded wait races this
   * against its own timer against those events; this function only reports
   * whether the frame actually went out.
   *
   * Gated on `state.welcomed`, not `isLive`: hub_impl.hpp gates PAIR_REQ on
   * `slot.session.occupied()` (true as soon as WELCOME is sent), NOT on the
   * RFC-015 readiness gate that INTENT is held behind — a knock needs no
   * catalog.
   *
   * @returns {boolean} true iff the frame was actually written to the socket
   */
  function sendPairReq() {
    if (!state.welcomed) return false;
    return sendFrame(FRAME.PAIR_REQ, 0, cbMap([[K.instance_id, cbBstr(instanceId)]]));
  }

  /**
   * PAIR_GRANT (h2c): {token(5): bstr16, roles(23): uint, [trust(39)]}.
   * ALWAYS about THIS session — hub_impl.hpp::issuePairGrant/handleKnock send
   * it unicast to the granted session's own transport, never broadcast, so
   * there is no instance_id to check on the way in.
   *
   * Adopts `role` into state.roles IMMEDIATELY, mirroring
   * "THE SESSION IS UPGRADED IN PLACE" in hub_impl.hpp — the hub does not
   * require a reconnect for the tier bump to take effect, so neither does
   * this client's own idea of its roles (canUse()/sendIntent gating reads
   * state.roles fresh on every call). Persisting the token for the NEXT
   * connect is deliberately left to the caller (identity.js setPairedToken)
   * rather than done here, so this library layer stays free of localStorage
   * policy.
   */
  function handlePairGrant(payload) {
    const g = cbDecodeFull(payload);
    const token = g.get(K.token) || null;
    const role = g.has(K.roles) ? g.get(K.roles) : null;
    if (role != null) state.roles = role;
    let trust = null;
    const tm = g.get(K.trust);
    if (tm instanceof Map) {
      trust = { hubPubkey: tm.get(TRUST_K.hub_pubkey) || null };
    }
    emit('pairGrant', { token, role, trust });
  }

  // ---- INTENT senders (c2h) — ONLY sent when the integrator calls them ----

  /**
   * Encode one intent field FROM THE CATALOG's declared CBOR type. There is no
   * hand-copied schema table: the device publishes a per-key type on every
   * INTENT channel and this reads it. (The table that used to live here had
   * drifted — it encoded a float as an integer for months.)
   */
  function encodeIntentValue(field, v, channelId, key) {
    if (!field) {
      throw new Error('sendIntent: channel 0x' + channelId.toString(16) +
        ' declares no schema field for key ' + key + ' (catalog is authoritative)');
    }
    switch (field.type) {
      case CBOR_FIELD.uint_t: return cbUint(v);
      case CBOR_FIELD.int_t: return cbInt(v);
      case CBOR_FIELD.f32_t: return cbF32(v);
      case CBOR_FIELD.bool_t: return cbBool(!!v);
      case CBOR_FIELD.tstr_t: return cbTstr(String(v));
      case CBOR_FIELD.bstr_t: return cbBstr(v);
      default:
        throw new Error('sendIntent: unknown CBOR field type ' + field.type + ' for key ' + key);
    }
  }

  /**
   * Send an INTENT and resolve when its post-clamp ECHO (or a NACK) returns.
   *
   * REQUIRES LIVE, mirroring Client::sendIntent's `_state != LIVE -> nullopt`:
   * a pre-READY intent is refused NOT_READY by the hub anyway (§11.5(2) — a
   * client that has not adopted the retained safety latch must not act), so
   * refusing it here is the same answer without the wire noise.
   *
   * @param {number} channelId an INTENT channel from the catalog
   * @param {Object<number, (number|boolean|string)>} valueMap field key -> value
   * @param {Object} [o] {timeoutMs, precondition (cfg_gen CAS), takeover}
   * @returns {Promise<{applied:Object, intentId:number, cfgGen:number}>}
   */
  function sendIntent(channelId, valueMap, o = {}) {
    if (state.phase !== SESSION_STATE.LIVE) {
      return Promise.reject(new Error('sendIntent: session is ' + state.phase +
        ', not LIVE — the hub would refuse this NOT_READY (§11.5(2))'));
    }
    const entry = channelMap && channelMap.get(channelId);
    if (!entry) {
      return Promise.reject(new Error('sendIntent: channel 0x' + channelId.toString(16) +
        ' is not in this hub\'s catalog'));
    }
    if (entry.cls !== CHANNEL_CLASS.INTENT) {
      return Promise.reject(new Error('sendIntent: channel 0x' + channelId.toString(16) +
        ' is ' + entry.clsName + ', not INTENT'));
    }

    intentSeq = (intentSeq % 0xffff) + 1; // 1..65535, session-scoped (§9.3)
    const intentId = intentSeq;

    let valuePairs;
    try {
      const byKey = schemaByKey(entry);
      const keys = Object.keys(valueMap).map(Number).sort((a, b) => a - b);
      valuePairs = keys.map((key) =>
        [key, encodeIntentValue(byKey.get(key), valueMap[key], channelId, key)]);
    } catch (e) {
      return Promise.reject(e);
    }

    // intent map: keys ascending — channel_id(15) < intent_id(18) < value(20)
    // [< precondition(30)] [< takeover(32)].
    const intentPairs = [
      [K.channel_id, cbUint(channelId)],
      [K.intent_id, cbUint(intentId)],
      [K.value, cbMap(valuePairs)],
    ];
    if (o.precondition != null) intentPairs.push([K.precondition, cbUint(o.precondition)]);
    if (o.takeover != null) intentPairs.push([K.takeover, cbBool(!!o.takeover)]);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(intentId);
        reject(new Error('intent ' + intentId + ' timeout (no ECHO/NACK)'));
      }, o.timeoutMs || 3000);
      pending.set(intentId, { channelId, resolve, reject, timer });
      // header.channel = target channel id for INTENT (redundant-but-authoritative);
      // header.seq = the intent id, so RFC-001's NACK `intent_seq` (the seq of
      // the frame being refused) correlates to the SAME number `intent_id` does.
      // A NACK that carries only one of the two still lands on the right promise.
      const okSent = sendFrame(FRAME.INTENT, channelId, cbMap(intentPairs), intentId);
      if (!okSent) {
        clearTimeout(timer);
        pending.delete(intentId);
        reject(new Error('intent ' + intentId + ' not sent (socket not open)'));
      }
    });
  }

  // convenience wrappers (all still explicit calls — nothing auto-fires)
  const sendMove = (positionMm, bypass = false, o) => sendIntent(CH_MOVE, { 1: positionMm, 2: bypass }, o);
  const sendConfigSet = (fields, o) => sendIntent(CH_CONFIG_SET, fields, o); // {1:window_min,...}
  const sendPatternCmd = (fields, o) => sendIntent(CH_PATTERN_CMD, fields, o);
  // M5b 0x3030 {1:blend_mode, 2:transport, 3:stream_speed_mode, 4:overshoot_clamp}.
  // Every key optional; the ECHO carries what the machine ACTUALLY took, which
  // for these is re-read post-apply rather than assumed (the hub clamps blend
  // and may refuse a transport this build cannot enter).
  const sendModesSet = (fields, o) => sendIntent(CH_MODES_SET, fields, o);
  const sendHome = (op = 1, o) => sendIntent(CH_HOME, { 1: op }, o);
  const sendSafetyIntent = (op, o) => sendIntent(CH_SAFETY_INTENTS, { 1: op }, o);

  /**
   * ASSERT E-STOP (RFC-010). `safety_ops::estop` (6) on 0x0005: the hub treats
   * it exactly as a valid 0xE5 frame — latch, cause=user, publish 0x0003 — so
   * this is a real e-stop and not the decel-stop the red button used to
   * silently degrade to.
   *
   * PRE-LIVE, IT FALLS BACK TO THE RAW 0xE5 FRAME, deliberately. The op rides
   * the INTENT plane, which the readiness gate holds shut; the raw frame is
   * matched by the hub BEFORE header decode and before any readiness or
   * occupancy gate (hub_impl.hpp::pumpSlot), so "the person in the room can
   * always stop the machine" survives a session that is still SYNCING. The raw
   * path repeats until the safety snapshot shows the latch (§11.2).
   *
   * @returns {Promise<Object>} resolves on ECHO (op path) or immediately (raw path)
   */
  function assertEstop() {
    if (state.phase === SESSION_STATE.LIVE) {
      return sendSafetyIntent(SAFETY_OP.estop).catch((e) => {
        // The op was refused/lost — do NOT let a red button end in a rejected
        // promise and nothing else. Escalate to the raw plane.
        assertEstopRaw();
        throw e;
      });
    }
    assertEstopRaw();
    return Promise.resolve({ raw: true });
  }

  /** §5.5/§11.2: the raw 12-byte ESTOP frame, repeated until the latch is observed. */
  function assertEstopRaw(cause = SAFETY_CAUSE.user) {
    estopActive = true;
    estopSentSeq = estopNextSeq++;
    if (estopNextSeq === 0) estopNextSeq = 1;
    estopAttempts = 1;
    lastEstopSendMs = Date.now();
    sendRaw(encodeEstopFrame(cause, state.roles || 0, estopSentSeq));
  }

  function pumpEstopRepeat(nowMs) {
    if (!estopActive) return;
    if (estopAttempts >= 20) { estopActive = false; return; } // limits::estop_repeat_max
    if (nowMs - lastEstopSendMs < 50) return; // limits::estop_repeat_interval_ms
    sendRaw(encodeEstopFrame(SAFETY_CAUSE.user, state.roles || 0, estopSentSeq));
    estopAttempts++;
    lastEstopSendMs = nowMs;
  }

  // ---- STATE decode dispatch ---------------------------------------------
  function layoutFor(channelId) {
    if (!channelMap) return null;
    const e = channelMap.get(channelId);
    return (e && e.layout) ? e.layout : null;
  }

  // ---- frame dispatch -----------------------------------------------------
  function handleWelcome(payload) {
    const w = cbDecodeFull(payload);
    state.welcomed = true;
    state.admission = null;
    retryNotBeforeMs = 0;
    state.sessionId = w.get(K.session_id);
    state.bootId = w.get(K.boot_id);
    state.cfgGen = w.get(K.cfg_gen);
    state.catalogEtag = w.get(K.catalog_etag) || null;
    state.roles = w.get(K.roles);
    // RFC-038: this is the ONLY place state.deadmanMs is ever assigned. We sent
    // a `deadman_wish_ms` wish in HELLO, but the wish itself is never read back
    // here or anywhere else — the hub may clamp tighter than asked, or ignore
    // the key entirely on a pre-RFC-038 build, and either way key 24 (echoed
    // exactly as it always was) is the only APPLIED truth. pingIntervalMs()
    // downstream derives its cadence from this adopted value, not the wish.
    state.deadmanMs = w.get(K.deadman_ms) ?? LIMITS.deadman_default_ms;
    state.deadmanPolicy = w.get(K.deadman_policy);
    const lim = w.get(K.limits);
    state.limits = {};
    if (lim instanceof Map) for (const [name, key] of Object.entries(WELCOME_LIMITS_K)) state.limits[name] = lim.get(key);

    // RFC-027 §12.2: `trust` (39) is OPTIONAL — absent means a pre-RFC-027 hub
    // or simply nothing on offer this session, either way 0 bits is the
    // honest default (see PAIRING_MODE in frames.js for what each bit means).
    const trustMap = w.get(K.trust);
    state.pairingModes = (trustMap instanceof Map) ? (trustMap.get(TRUST_K.pairing_modes) || 0) : 0;

    // RFC-016: hub identity in band. `fw_version` is why a client no longer has
    // to label a device "boot 0x…" from an mDNS TXT record.
    const idm = w.get(K.identity);
    state.identity = null;
    if (idm instanceof Map) {
      state.identity = {
        product: idm.get(IDENTITY_K.product) || null,
        fw_version: idm.get(IDENTITY_K.fw_version) || null,
        hub_name: idm.get(IDENTITY_K.hub_name) || null,
        info: idm.get(IDENTITY_K.info) || null,
        // RFC-048: durable hub identity (u64, survives reboots) — the value a
        // client keys "have I met this hub before" on, never boot_id.
        hub_instance_id: idm.get(IDENTITY_K.hub_instance_id) ?? null,
        // RFC-085 (§11.2): true renders E-Stop, false or absent renders Halt.
        estop_cuts_power: idm.get(IDENTITY_K.estop_cuts_power) === true,
      };
    }

    // RFC-046: the WS endpoint advertised in band. A session that arrived over
    // BLE (or any non-WS binding) reads these to find the WS upgrade path;
    // absent/0 means the hub has none to offer right now.
    state.endpoint = {
      wsPort: w.get(K.ws_port) ?? null,
      ipv4: w.get(K.ipv4) ?? null,
    };

    // §6.7: snapshot adoption is mandatory — discard everything and rebuild it
    // only from what follows this WELCOME.
    state.grants.clear();
    state.grantedPublishes.clear();
    pubTx.clear();
    state.clockSynced = false;
    adoptedChannels = new Set();
    requiredRetained = state.limits.retained_pending || 0;
    for (const g of (w.get(K.grants) || [])) {
      const ch = g.get(K.channel_id);
      state.grants.set(ch, { channel: ch, rate: g.get(K.granted_rate_hz), priority: g.get(K.priority) });
    }
    welcomeGrants = new Set(state.grants.keys());
    const welcomePublishes = (w.get(K.granted_publishes) || []).map(adoptPublishGrant);

    const info = {
      sessionId: state.sessionId,
      bootId: state.bootId,
      cfgGen: state.cfgGen,
      catalogEtag: state.catalogEtag,
      identity: state.identity,
      roles: state.roles,
      deadmanMs: state.deadmanMs,
      deadmanPolicy: state.deadmanPolicy,
      limits: state.limits,
      pairingModes: state.pairingModes,
      endpoint: state.endpoint,
    };
    setPhase(SESSION_STATE.SYNCING);
    emit('welcome', info);
    if (state.grants.size) emit('grant', [...state.grants.values()]);
    if (welcomePublishes.length) emit('publishGrant', welcomePublishes);

    // ---- RFC-015 readiness gate -------------------------------------------
    readyPending = false;
    readyAttempts = 0;
    blob.reset();
    const matched = !!(cachedCatalog && state.catalogEtag &&
      bytesEqual(cachedCatalog.etag, state.catalogEtag));
    if (matched) {
      // Proof of possession one round trip earlier: the hub already flipped our
      // ready bit when it read the HELLO etag, so retained STATE is already on
      // its way. NO CATALOG_READY frame — the zero-latency reconnect path.
      state.ready = true;
      state.readyEtag = cachedCatalog.etag;
      try {
        adoptCatalog(cachedCatalog.bytes, { cached: true, verified: true, etag: cachedCatalog.etag });
      } catch (e) {
        // A cached blob that no longer decodes is worse than none: drop it and
        // fetch, rather than operate against a decoder ring we cannot build.
        log('warn', 'cached catalog failed to decode — refetching', e);
        catalogStore.clear(host);
        cachedCatalog = null;
        state.ready = false;
        if (autoCatalog) requestCatalog();
      }
      if (state.ready) emit('ready', { etag: state.readyEtag, cached: true });
    } else {
      state.ready = false;
      if (cachedCatalog) catalogStore.clear(host); // stale firmware/catalog: forget it
      cachedCatalog = null;
      if (autoCatalog) requestCatalog();
    }

    // start the deadman-defeating PING/pump loop now that we know the window
    startPump();

    // read-plane bring-up (safe, no intents). The wishes rode HELLO; a reattach
    // keeps the session's own grants instead (§6.6 path B), so nothing here
    // re-SUBSCRIBEs them.
    syncClock().catch(() => {});

    checkLiveTransition();
  }

  function checkLiveTransition() {
    if (state.phase !== SESSION_STATE.SYNCING) return;
    if (!catalogEntries) return;
    if (adoptedChannels.size < requiredRetained) return;
    setPhase(SESSION_STATE.LIVE);
  }

  function handleGrant(payload) {
    const g = cbDecodeFull(payload);
    const arr = g.get(K.grants) || [];
    const applied = [];
    for (const entry of arr) {
      const ch = entry.get(K.channel_id);
      const rec = { channel: ch, rate: entry.get(K.granted_rate_hz), priority: entry.get(K.priority) };
      state.grants.set(ch, rec);
      applied.push(rec);
    }
    // The hub may re-issue `roles` (an AUTH upgrade); adopt it as ground truth.
    if (g.has(K.roles)) state.roles = g.get(K.roles);
    emit('grant', applied);

    // §10.2: a PUBLISH is answered by a GRANT whose `granted_publishes` may be
    // empty. Hubs built on lib/valence before rfc-3t4 omit an empty key 36,
    // leaving a bare `grants: []`, so either shape answers the oldest pending
    // PUBLISH; a key-36 GRANT with nothing pending is an unsolicited re-grant.
    const pubs = g.has(K.granted_publishes) ? g.get(K.granted_publishes).map(adoptPublishGrant) : null;
    const req = (pubs || (!arr.length && !g.has(K.roles))) ? pendingPublish.shift() : null;
    if (req) {
      clearTimeout(req.timer);
      const got = new Set((pubs || []).map((r) => r.channel));
      for (const ch of req.channels) {
        if (!got.has(ch)) { state.grantedPublishes.delete(ch); pubTx.delete(ch); }
      }
      req.resolve(pubs || []);
    }
    if (pubs || req) emit('publishGrant', pubs || []);
  }

  function handleState(header, payload) {
    // §8.4/RFC-015: STATE arriving is proof the hub opened our data plane, so
    // the CATALOG_READY re-declaration loop stops here.
    readyPending = false;
    state.ready = true;

    const layout = layoutFor(header.channel);
    let decoded;
    if (layout) {
      try { decoded = decodePacked(payload, layout); }
      catch (e) { log('warn', 'STATE decode failed ch=0x' + header.channel.toString(16), e); decoded = { _raw: payload }; }
    } else {
      // With the readiness gate this means an id the catalog does not describe
      // — pass the bytes through rather than guess a layout.
      decoded = { _raw: payload };
    }

    // §11.2 repeat-until-latched: the latched ESTOP bit in the safety snapshot
    // is the acknowledgment assertEstopRaw() is waiting for.
    if (header.channel === CH_SAFETY) {
      state.safety = decodeSafetySnapshot(payload);
      if (state.safety && state.safety.estopLatched) estopActive = false;
      emit('safety', state.safety);
    }

    if (welcomeGrants.has(header.channel) && !adoptedChannels.has(header.channel)) {
      adoptedChannels.add(header.channel);
      checkLiveTransition();
    }
    emit('state', header.channel, decoded, Date.now());
  }

  function handleEcho(payload) {
    const e = cbDecodeFull(payload);
    const intentId = e.get(K.intent_id);
    const appliedMap = e.get(K.applied);
    const applied = {};
    if (appliedMap instanceof Map) for (const [k, v] of appliedMap) applied[k] = v;
    const cfgGen = e.get(K.cfg_gen);
    if (cfgGen != null) state.cfgGen = cfgGen;
    const result = { intentId, cfgGen, applied, rebootInMs: applied[K.reboot_in_ms] };
    emit('echo', result);
    const p = pending.get(intentId);
    if (p) { clearTimeout(p.timer); pending.delete(intentId); p.resolve(result); }
  }

  function handleNack(header, payload) {
    const n = cbDecodeFull(payload);
    const code = n.get(K.code);
    const ch = n.has(K.channel_id) ? n.get(K.channel_id) : header.channel;
    const info = {
      code,
      name: nackName(code),
      channel: ch,
      detail: n.get(K.detail) || null,
      intentId: n.has(K.intent_id) ? n.get(K.intent_id) : null,
      intentSeq: n.has(K.intent_seq) ? n.get(K.intent_seq) : null,
      retryAfterMs: n.has(K.retry_after_ms) ? n.get(K.retry_after_ms) : null,
    };
    emit('nack', info);
    if (isAdmissionRefusal(code)) { admissionRefused(code, info.retryAfterMs); return; }
    if (nackStoreFetch(info)) return;

    // ---- correlation, best evidence first ---------------------------------
    // 1) intent_id (18): the hub sets it whenever a decodable INTENT provoked
    //    the refusal — exact by construction.
    // 2) intent_seq (41, RFC-001): the header seq of the refused frame. We send
    //    intents with seq == intent_id, so this resolves the same promise; it
    //    also covers refusals raised before `intent_id` could be read.
    // 3) FALLBACK, documented and imprecise: the oldest pending intent on this
    //    channel. Correct for a one-at-a-time UI, wrong the moment anyone
    //    pipelines — kept only for a hub that populates neither key.
    let id = null;
    if (info.intentId != null && pending.has(info.intentId)) id = info.intentId;
    else if (info.intentSeq != null && pending.has(info.intentSeq)) id = info.intentSeq;
    else {
      for (const [pid, p] of pending) { if (p.channelId === ch) { id = pid; break; } }
    }
    if (id != null && pending.has(id)) {
      const p = pending.get(id);
      clearTimeout(p.timer);
      pending.delete(id);
      p.reject(Object.assign(new Error('intent NACK ' + info.name), info));
    }
  }

  function handleEvent(header, payload) {
    let decoded = null;
    try { decoded = cbDecodeFull(payload); } catch (e) { log('warn', 'EVENT decode failed', e); return; }
    if (!(decoded instanceof Map)) return;
    const entry = channelMap ? channelMap.get(header.channel) : null;
    // v1.0: kind-specific fields ride the SCOPED `body` (40) sub-map, keyed by
    // the channel's OWN catalog schema — exactly as INTENT's `value` (20) is.
    // With them at the top level, every device-authored EVENT channel would
    // have needed a registry PR to name its own fields.
    const evt = {
      channel: header.channel,
      channelName: entry ? entry.name : null,
      kind: decoded.get(K.event_kind),
      seqOfState: decoded.has(K.seq_of_state) ? decoded.get(K.seq_of_state) : null,
      timestamp: decoded.has(K.timestamp) ? decoded.get(K.timestamp) : null,
      body: decodeEventBody(decoded.get(K.body), entry),
    };
    // 'event' alone carries this: machine.svelte.js routes by channel name
    // (log/anomaly/else) off that single emit. Do not also emit
    // 'sessionEvent' here — that name is reserved for genuine session-
    // lifecycle frames outside this generic dispatch (GOODBYE below, the
    // out-of-band ESTOP frame) and double-emitting duplicated every log
    // and anomaly entry into machine.events.session.
    emit('event', evt);
  }

  function handleClock(payload) {
    if (payload.length < 12 || !pendingClock) return;
    const dv = new DataView(payload.buffer, payload.byteOffset, 12);
    pendingClock.resolve({ t0e: dv.getUint32(0, true), t1: dv.getUint32(4, true), t2: dv.getUint32(8, true) });
  }

  function dispatch(header, payload) {
    switch (header.type) {
      case FRAME.WELCOME: handleWelcome(payload); break;
      case FRAME.BLOB_CHUNK: handleBlobChunk(payload); break;
      case FRAME.GRANT: handleGrant(payload); break;
      case FRAME.STATE: handleState(header, payload); break;
      case FRAME.STREAM: /* device does not stream to us on read channels */ break;
      case FRAME.ECHO: handleEcho(payload); break;
      case FRAME.EVENT: handleEvent(header, payload); break;
      case FRAME.NACK: handleNack(header, payload); break;
      case FRAME.CLOCK: handleClock(payload); break;
      case FRAME.PING: sendFrame(FRAME.PONG, header.channel, payload); break; // §6.5 echo
      case FRAME.PONG: break;
      case FRAME.BEACON: break; // §13.7 discovery beacon: nothing to do on WS
      case FRAME.PAIR_GRANT: handlePairGrant(payload); break;
      case FRAME.HUB_SIG: // hub-signature verification (bearer + unverified) is
        // still out of scope — PAIR_GRANT's `trust.hub_pubkey` is stored on the
        // 'pairGrant' event for a future caller, but nothing here VERIFIES a
        // later WELCOME's `welcome_sig` against it yet.
        log('debug', 'trust-plane frame ignored', FRAME_NAME[header.type]);
        break;
      case FRAME.GOODBYE: {
        let code = null;
        let retryAfterMs = null;
        try {
          const g = cbDecodeFull(payload);
          code = g.get(K.code);
          retryAfterMs = g.has(K.retry_after_ms) ? g.get(K.retry_after_ms) : null;
        } catch (e) { /* empty/none */ }
        emit('sessionEvent', { channel: header.channel, kind: 'goodbye', code, codeName: nackName(code), retryAfterMs });
        if (isAdmissionRefusal(code)) admissionRefused(code, retryAfterMs);
        break;
      }
      default:
        log('debug', 'unhandled frame', FRAME_NAME[header.type] || header.type);
    }
  }

  // ---- periodic pump: PING keepalive + READY / repair / estop cadences -----
  function startPump() {
    stopPump();
    pumpTimer = setInterval(() => {
      if (!ws || ws.readyState !== 1) return;
      const now = Date.now();
      pumpCatalogReady(now);
      pumpBlobRepair(now);
      pumpStoreFetch(now);
      pumpEstopRepeat(now);
      // §7.1: a publisher resyncs the clock every clock_resync_interval_s.
      if (state.grantedPublishes.size && !pendingClock &&
          now - lastClockSyncMs >= LIMITS.clock_resync_interval_s * 1000) {
        syncClock().catch(() => {});
      }
      if (now - lastTxMs >= pingIntervalMs()) sendFrame(FRAME.PING, 0, new Uint8Array(0));
    }, 50);
  }
  function stopPump() {
    if (pumpTimer) { clearInterval(pumpTimer); pumpTimer = null; }
  }

  // ---- socket lifecycle ---------------------------------------------------
  function connect() {
    if (!WSImpl) throw new Error('no WebSocket implementation available');
    intentionalClose = false;
    // §6.3: retry_after_ms binds every reconnect, the caller's own included.
    const waitMs = retryNotBeforeMs - Date.now();
    if (waitMs > 0) {
      if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, waitMs);
      return;
    }
    if (!tokenProvider) { openSocket(); return; }
    // Resolve the credential BEFORE the socket opens, not inside onopen. The
    // hub starts a HELLO timer the instant the socket is accepted, and an async
    // onopen would spend that budget on an HTTP round trip. Fetching first
    // costs nothing (we are not connected yet) and keeps HELLO immediate.
    //
    // A provider that throws or hangs must not strand the session, so failure
    // degrades to a tokenless HELLO — the hub answers `watch` and the UI comes
    // up as a viewer, which is a working state.
    Promise.resolve()
      .then(() => tokenProvider(host))
      .then((t) => { liveToken = t || null; })
      .catch((e) => { log('warn', 'token provider failed — connecting as viewer', e); liveToken = null; })
      .then(() => {
        if (intentionalClose) return; // closed while we were fetching
        openSocket();
      });
  }

  function openSocket() {
    cachedCatalog = null;
    try {
      const c = catalogStore.load(host);
      // Re-verify the cache before trusting it: the etag we are about to CLAIM
      // in HELLO must actually be the hash of the bytes we hold, or readiness
      // would be a lie.
      if (c && c.bytes && c.etag && bytesEqual(catalogEtag(c.bytes, LIMITS.etag_bytes), c.etag)) {
        cachedCatalog = c;
      } else if (c) {
        catalogStore.clear(host);
      }
    } catch (e) { log('warn', 'catalog cache unreadable', e); }

    const url = 'ws://' + host + ':' + port + '/';
    log('info', 'connecting', url);
    ws = new WSImpl(url, [WS_SUBPROTOCOL]);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      state.connected = true;
      backoffIdx = 0;
      lastTxMs = Date.now();
      setPhase(SESSION_STATE.HELLO_SENT);
      emit('open');
      sendFrame(FRAME.HELLO, 0, buildHello());
    };
    ws.onmessage = (ev) => {
      const data = ev.data;
      if (!(data instanceof ArrayBuffer)) return; // §13.2: text is a protocol error — ignore (§4.3)
      const buf = new Uint8Array(data);
      // §5.5: the ESTOP frame is matched BEFORE header decode — it is
      // deliberately outside the 8-byte header discipline.
      if (buf.length === ESTOP_FRAME_BYTES &&
          buf[0] === 0xe5 && buf[1] === 0xe5 && buf[2] === 0xe5 && buf[3] === 0xe5) {
        emit('sessionEvent', { kind: 'estop', cause: buf[4], origin: buf[5] });
        return;
      }
      for (const { header, payload } of parseFrames(buf)) {
        try { dispatch(header, payload); }
        catch (e) { log('warn', 'dropping frame type=' + header.type, e); } // §4.3 tolerance
      }
    };
    ws.onerror = (e) => log('warn', 'ws error', e && e.message);
    ws.onclose = (ev) => {
      state.connected = false;
      state.welcomed = false;
      state.ready = false;
      setPhase(SESSION_STATE.CLOSED);
      stopPump();
      estopActive = false;
      // fail every in-flight intent (§6.7: the library NEVER blind-retransmits;
      // the app reconciles against the truth the next session reports).
      for (const [id, p] of pending) { clearTimeout(p.timer); p.reject(new Error('socket closed')); pending.delete(id); }
      for (const req of pendingPublish.splice(0)) { clearTimeout(req.timer); req.reject(new Error('socket closed')); }
      for (const f of storeFetches.splice(0)) f.reject(new BlobError(BLOB_ERROR.ABORTED, f, 'socket closed'));
      catalogInFlight = false;
      state.grantedPublishes.clear();
      pubTx.clear();
      const willReconnect = autoReconnect && !intentionalClose;
      emit('close', { code: ev && ev.code, reason: ev && ev.reason, willReconnect });
      if (willReconnect) scheduleReconnect();
    };
  }

  // §6.3: BUSY on a HELLO comes from a hub predating RFC-055 and means HUB_AT_CAPACITY.
  function isAdmissionRefusal(code) {
    return ADMISSION_CODES.has(code) || (code === NACK.BUSY && state.phase === SESSION_STATE.HELLO_SENT);
  }

  /**
   * §6.3: the hub refused this session. Never retry sooner than retry_after_ms
   * (absent: busy_retry_after_default_ms), and add jitter so refused clients do
   * not return as a herd. Closing here hands off to the ordinary reconnect path.
   */
  function admissionRefused(code, retryAfterMs) {
    const asCode = ADMISSION_CODES.has(code) ? code : NACK.HUB_AT_CAPACITY;
    const waitMs = retryAfterMs ?? LIMITS.busy_retry_after_default_ms;
    const reconnectInMs = Math.ceil(waitMs + Math.random() * Math.max(waitMs / 2, 250));
    retryNotBeforeMs = Date.now() + reconnectInMs;
    state.admission = { code: asCode, name: nackName(asCode), retryAfterMs: waitMs, reconnectInMs, atMs: Date.now() };
    log('warn', 'admission refused', state.admission.name, 'retry in', reconnectInMs, 'ms');
    emit('admission', state.admission);
    try { if (ws && ws.readyState < 2) ws.close(); } catch (e) { /* gone */ }
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    const backoff = DEFAULT_BACKOFF_MS[Math.min(backoffIdx, DEFAULT_BACKOFF_MS.length - 1)];
    const delay = Math.max(backoff, retryNotBeforeMs - Date.now());
    backoffIdx++;
    log('info', 'reconnect in', delay, 'ms');
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay);
  }

  /**
   * Close the session. Sends a courtesy GOODBYE (§6.8) so the hub releases this
   * session's source ownership promptly (field bug #3 — every teardown path
   * runs the same §11.3 loss policy, but a clean one is instant).
   * @param {number} [code] a GOODBYE_CODE (drawn from nack_codes, RFC-022.2)
   */
  function close(code = GOODBYE_CODE.NORMAL_CLOSURE) {
    intentionalClose = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    stopPump();
    try { if (ws && ws.readyState === 1) sendFrame(FRAME.GOODBYE, 0, cbMap([[K.code, cbUint(code)]])); } catch (e) { /* gone */ }
    try { if (ws) ws.close(); } catch (e) { /* gone */ }
  }

  return {
    // lifecycle
    connect,
    close,
    // events
    on,
    off,
    // read-plane actions
    subscribe,
    // c2h STREAM publishing (explicit; never auto-fired). Senders throw PublishError.
    publish,
    publishSamples,
    publishSegment,
    requestCatalog,
    fetchBlob,
    syncClock,
    hubNowUs,
    // pairing (RFC-027 §12.2) — fire-and-forget; outcome arrives via 'pairGrant'/'nack'/'event'
    sendPairReq,
    // write-plane (explicit; never auto-fired)
    sendIntent,
    sendMove,
    sendConfigSet,
    sendPatternCmd,
    sendModesSet,
    sendHome,
    sendSafetyIntent,
    assertEstop,
    assertEstopRaw,
    // catalog introspection (RFC-009 helpers, resolved against THIS hub)
    schemaFor: (channelId) => schemaByKey(channelMap && channelMap.get(channelId)),
    optionAccessFor: (channelId, key, value) =>
      optionAccessFor(channelMap && channelMap.get(channelId), key, value),
    /**
     * May this session use `value` on field `key` of `channelId`? RFC-009's
     * gray-never-hide input. NOTE there is deliberately NO channel-id special
     * case here for the role-exempt safety ops: 0x0005 advertises
     * `option_access` (catalog key 17) with `pause` and `estop` at `watch`, and
     * the hub gates on that SAME data (Hub::requiredAccessFor), so the client's
     * graying and the hub's enforcement cannot disagree. Hardcoding the
     * exemption here would reintroduce exactly the drift the catalog removes.
     */
    canUse: (channelId, key, value) =>
      canUseOption(channelMap && channelMap.get(channelId), key, value, state.roles || 0),
    // introspection
    get state() { return state; },
    get phase() { return state.phase; },
    get isLive() { return state.phase === SESSION_STATE.LIVE; },
    get catalog() { return catalogEntries; },
    get catalogBytes() { return catalogBytes; },
    get channelMap() { return channelMap; },
    get instanceId() { return instanceId; },
    get identity() { return state.identity; },
    // The host this session dials — the SAME key identity.js's per-hub token
    // store (getPairedToken/setPairedToken) uses, so a caller that just
    // received a PAIR_GRANT can persist it without re-deriving the host.
    get host() { return host; },
  };
}
