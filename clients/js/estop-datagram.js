/**
 * estop-datagram.js -- RFC-053's connectionless ESTOP: the §5.5 frame sent as
 * a datagram by a sender that holds no session (a shell, a fob).
 *
 * Constraints:
 * - The datagram IS the §5.5 frame, byte for byte (encodeEstopFrame): no
 *   header, no trailer. A hub honoring RFC-053 matches it on the §13.8 port by
 *   its E5 magic and CRC-32.
 * - No socket, no address and no port here: a page cannot send UDP, so
 *   broadcastEstop() takes `send`, the native sender, which owns the
 *   destination (registry udp_discovery.port).
 * - Every broadcastEstop() is ONE initiation: a fresh seq that all of its
 *   repeats share (§5.5). A sessionless sender cannot observe the latch
 *   (RFC-053 item 6), so it spends the whole §11.2 budget, estop_repeat_max
 *   sends estop_repeat_interval_ms apart, and never stops early.
 * - origin is the initiator's access tier (§5.5); a sender with no session
 *   on the hub it reaches is `watch`.
 */

import { encodeEstopFrame, SAFETY_CAUSE, ACCESS, LIMITS } from './frames.js';

const SEQ_SPAN = 0x10000;

// A random start, so two senders on one host rarely share a seq; one sender
// never repeats a seq until the 16-bit wrap.
let lastSeq = (() => {
  const c = globalThis.crypto;
  return c && c.getRandomValues ? c.getRandomValues(new Uint16Array(1))[0] : Math.floor(Math.random() * SEQ_SPAN);
})();

/** The next initiation's seq: 16 bits, never 0. */
export function nextEstopSeq() {
  lastSeq = (lastSeq + 1) % SEQ_SPAN || 1;
  return lastSeq;
}

/**
 * The 12-byte datagram: E5 E5 E5 E5 | cause:u8 | origin:u8 | seq:u16 | crc32:u32, LE.
 * @param {Object} [o]
 * @param {number} [o.cause] a SAFETY_CAUSE value (default user)
 * @param {number} [o.origin] an ACCESS value (default watch)
 * @param {number} [o.seq] default nextEstopSeq()
 * @returns {Uint8Array}
 */
export function encodeEstopDatagram({ cause = SAFETY_CAUSE.user, origin = ACCESS.watch, seq = nextEstopSeq() } = {}) {
  return encodeEstopFrame(cause, origin, seq);
}

/**
 * One initiation over the whole §11.2 repeat budget.
 * @param {Object} o
 * @param {(bytes: Uint8Array) => unknown} o.send the native sender; a throw or a
 *   rejection counts as a failed send and the repeats go on
 * @param {number} [o.cause] a SAFETY_CAUSE value (default user)
 * @param {number} [o.origin] an ACCESS value (default watch)
 * @param {(ms: number) => Promise<void>} [o.sleep] the wait between sends
 * @returns {Promise<{seq: number, sent: number, failed: number}>} sent 0 is a
 *   loud local failure for the caller to surface (§11.2)
 */
export async function broadcastEstop({ send, cause, origin, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const seq = nextEstopSeq();
  const bytes = encodeEstopDatagram({ cause, origin, seq });
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < LIMITS.estop_repeat_max; i++) {
    if (i > 0) await sleep(LIMITS.estop_repeat_interval_ms);
    try {
      await send(bytes);
      sent++;
    } catch (e) {
      failed++;
    }
  }
  return { seq, sent, failed };
}
