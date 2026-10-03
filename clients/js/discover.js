/**
 * discover.js -- SPEC §13.8 UDP discovery: the DISCOVER_PROBE (0x1E) and
 * DISCOVER_REPLY (0x1F) codec, and discover(), a probe loop that collects
 * replies and keeps one entry per hub.
 *
 * Constraints:
 * - The datagram IS the raw payload: magic first, no §5.1 header. Both
 *   layouts are fixed, a probe 9 bytes and a reply 76; any other datagram is
 *   not a reply (decodeDiscoverReply returns null). The C++ twin is
 *   lib/valence/include/valence/wire/messages/discover.hpp, and
 *   test/valence-discover.test.mjs pins both to its golden vectors.
 * - hub_instance_id is 16 lowercase hex digits, the form session.js gives
 *   WELCOME identity: a u64 does not survive a JS number. 0 on the wire means
 *   the hub has none, read as null, and such a hub is keyed by its endpoint.
 * - No node import, so a browser bundle can import this file. A page cannot
 *   send UDP, so discover() takes the socket factory (node:
 *   dgram.createSocket).
 * - HAND-COPIED REGISTRY NUMBERS: the codegen emits no `udp_discovery`
 *   section, so DISCOVERY_PORT, DISCOVERY_MAGIC and DISCOVERY_REPLY_INTERVAL_MS
 *   copy it; the test pins them to registry.yaml.
 * - Discovery is untrusted input (§13.7): a reply names a candidate endpoint
 *   and is never a reason to connect on its own.
 */

import { PROTO_VER } from './generated/registry_vocab.js';
import { toHex, fromHex } from './sha256.js';

export const DISCOVERY_PORT = 22096;              // registry udp_discovery.port
export const DISCOVERY_MAGIC = 'VLNC';            // registry udp_discovery.magic
export const DISCOVERY_REPLY_INTERVAL_MS = 1000;  // registry udp_discovery.reply_rate_limit_per_source_s
export const DISCOVER_PROBE_BYTES = 9;
export const DISCOVER_REPLY_BYTES = 76;
export const DISCOVER_FLAG_PAIRING_WINDOW_OPEN = 0x01; // reply flags bit0; bits 1-7 are zero

const MAGIC = Uint8Array.from(DISCOVERY_MAGIC, (c) => c.charCodeAt(0));
const NAME_BYTES = 32; // str32
const FW_BYTES = 16;   // str16
const utf8 = new TextDecoder();
const utf8Out = new TextEncoder();

const view = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const hasMagic = (b) => MAGIC.every((m, i) => b[i] === m);
const asBytes = (x) => (x instanceof Uint8Array ? x : new Uint8Array(x));

function readFixed(b) {
  const end = b.indexOf(0);
  return utf8.decode(end < 0 ? b : b.subarray(0, end));
}

// Byte-wise truncation, the RFC-026 str16/str32 rule the C++ encoder follows.
function writeFixed(out, offset, width, text) {
  out.set(utf8Out.encode(String(text || '')).subarray(0, width), offset);
}

/** magic(4) | proto_ver:u8 @4 | nonce:u32 @5 */
export function encodeDiscoverProbe(nonce, protoVer = PROTO_VER) {
  const b = new Uint8Array(DISCOVER_PROBE_BYTES);
  b.set(MAGIC);
  view(b).setUint8(4, protoVer);
  view(b).setUint32(5, nonce >>> 0, true);
  return b;
}

/** {proto_ver, nonce}, or null for anything that is not a probe. */
export function decodeDiscoverProbe(bytes) {
  const b = asBytes(bytes);
  if (b.length !== DISCOVER_PROBE_BYTES || !hasMagic(b)) return null;
  return { proto_ver: b[4], nonce: view(b).getUint32(5, true) };
}

/**
 * magic(4) @0 | nonce:u32 @4 | hub_name:str32 @8 | hub_instance_id:u64 @40 |
 * proto_ver:u8 @48 | ws_port:u16 @49 | fw_version:str16 @51 |
 * catalog_etag:8B @67 | flags:u8 @75. Takes decodeDiscoverReply's shape.
 */
export function encodeDiscoverReply({ nonce = 0, hub_name = '', hub_instance_id = null, proto_ver = PROTO_VER,
  ws_port = 0, fw_version = '', catalog_etag = '', flags = 0 } = {}) {
  const b = new Uint8Array(DISCOVER_REPLY_BYTES);
  const dv = view(b);
  b.set(MAGIC);
  dv.setUint32(4, nonce >>> 0, true);
  writeFixed(b, 8, NAME_BYTES, hub_name);
  dv.setBigUint64(40, hub_instance_id ? BigInt('0x' + hub_instance_id) : 0n, true);
  dv.setUint8(48, proto_ver);
  dv.setUint16(49, ws_port, true);
  writeFixed(b, 51, FW_BYTES, fw_version);
  b.set(fromHex(catalog_etag).subarray(0, 8), 67);
  dv.setUint8(75, flags);
  return b;
}

/** The reply's fields, or null for anything that is not a 76-byte reply. */
export function decodeDiscoverReply(bytes) {
  const b = asBytes(bytes);
  if (b.length !== DISCOVER_REPLY_BYTES || !hasMagic(b)) return null;
  const dv = view(b);
  const id = dv.getBigUint64(40, true);
  return {
    nonce: dv.getUint32(4, true),
    hub_name: readFixed(b.subarray(8, 40)),
    hub_instance_id: id ? id.toString(16).padStart(16, '0') : null,
    proto_ver: b[48],
    ws_port: dv.getUint16(49, true),
    fw_version: readFixed(b.subarray(51, 67)),
    catalog_etag: toHex(b.subarray(67, 75)),
    flags: b[75],
    pairing_window_open: (b[75] & DISCOVER_FLAG_PAIRING_WINDOW_OPEN) !== 0,
  };
}

/** One entry per hub: its durable id, else its endpoint. */
export const discoveredKey = (h) => h.hub_instance_id || h.ip + ':' + h.ws_port;

/**
 * Broadcast a probe, re-send it every `resendMs` and collect replies for
 * `timeoutMs`. Resolves to [{ip, ...decodeDiscoverReply}] in first-heard order, one
 * per discoveredKey (the first reply wins). Only replies echoing this probe's
 * nonce count. A send failure does not end the scan: an earlier probe may
 * still be answered.
 *
 * The default re-send lands past the hub's per-source reply window, so a
 * re-send after a lost reply is never the probe the hub throttles.
 */
export function discover({ createSocket, address = '255.255.255.255', port = DISCOVERY_PORT,
  timeoutMs = 1500, resendMs = DISCOVERY_REPLY_INTERVAL_MS + 100, nonce } = {}) {
  if (typeof createSocket !== 'function') return Promise.reject(new TypeError('discover: createSocket is required'));
  const n = (nonce ?? Math.random() * 0x100000000) >>> 0;
  const probe = encodeDiscoverProbe(n);
  const found = new Map();
  return new Promise((resolve, reject) => {
    const sock = createSocket('udp4');
    let timer = null;
    let tick = null;
    const finish = (err) => {
      clearTimeout(timer);
      clearInterval(tick);
      try { sock.close(); } catch (e) { /* already closed */ }
      if (err) reject(err); else resolve([...found.values()]);
    };
    sock.on('error', finish);
    sock.on('message', (msg, rinfo) => {
      const r = decodeDiscoverReply(msg);
      if (!r || r.nonce !== n) return;
      const hub = { ip: rinfo.address, ...r };
      const key = discoveredKey(hub);
      if (!found.has(key)) found.set(key, hub);
    });
    sock.bind(0, () => {
      sock.setBroadcast(true);
      const send = () => sock.send(probe, port, address, () => { /* per-probe failure is not a scan failure */ });
      send();
      tick = setInterval(send, resendMs);
      timer = setTimeout(() => finish(null), timeoutMs);
    });
  });
}
