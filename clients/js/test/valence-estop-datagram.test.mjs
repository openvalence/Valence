/**
 * valence-estop-datagram.test.mjs -- RFC-053's connectionless ESTOP sender.
 *
 * The datagram must be the §5.5 frame byte for byte. The pinned vectors are
 * hex: E-01 is lib/valence's own golden (test/native/test_valence_wire), the
 * others were computed with Python's zlib.crc32 and are re-derived here with
 * node:zlib, so a wrong CRC in this client fails against two independent
 * implementations.
 *
 * Run: node clients/js/test/valence-estop-datagram.test.mjs   (exits 1 on any failure)
 */

import { crc32 as zlibCrc32 } from 'node:zlib';
import dgram from 'node:dgram';
import { encodeEstopDatagram, broadcastEstop, nextEstopSeq } from '../estop-datagram.js';
import { encodeEstopDatagram as fromIndex, broadcastEstop as broadcastFromIndex } from '../index.js';
import { SAFETY_CAUSE, ACCESS, LIMITS } from '../frames.js';

let failures = 0;
function assert(name, cond, extra = '') {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (extra ? '  ' + extra : ''));
  if (!cond) failures++;
}
const hex = (b) => Buffer.from(b).toString('hex');

console.log('RFC-053 ESTOP datagram:');

// ---- pinned vectors ------------------------------------------------------------
const VECTORS = [
  // [label, {cause, origin, seq}, hex]
  ['E-01 twin: user, control, seq 1', { cause: SAFETY_CAUSE.user, origin: ACCESS.control, seq: 1 },
    'e5e5e5e50001010034e4ee41'],
  ['user, watch, seq 0xBEEF', { cause: SAFETY_CAUSE.user, origin: ACCESS.watch, seq: 0xbeef },
    'e5e5e5e50000efbeeace08ac'],
  ['fault, configure, seq 0xFFFF', { cause: SAFETY_CAUSE.fault, origin: ACCESS.configure, seq: 0xffff },
    'e5e5e5e50202ffff58b19c4e'],
];
for (const [label, args, want] of VECTORS) {
  const got = encodeEstopDatagram(args);
  assert(label, hex(got) === want, hex(got));
  assert(label + ': CRC agrees with node:zlib',
    zlibCrc32(got.subarray(0, 8)) === new DataView(got.buffer).getUint32(8, true));
}
assert('index.js exports the same encoder', fromIndex === encodeEstopDatagram && broadcastFromIndex === broadcastEstop);

// ---- defaults and the seq --------------------------------------------------------
const d = encodeEstopDatagram();
assert('12 bytes, the §5.5 frame', d.length === 12);
assert('default cause user, origin watch', d[4] === SAFETY_CAUSE.user && d[5] === ACCESS.watch);
const a = nextEstopSeq();
const b = nextEstopSeq();
assert('seq advances by one per initiation', b === ((a + 1) % 0x10000 || 1), a + ' -> ' + b);
let zero = false;
for (let i = 0; i < 0x10001; i++) if (nextEstopSeq() === 0) zero = true;
assert('seq is never 0 across a full wrap', !zero);

// ---- the repeat budget -----------------------------------------------------------
const sent = [];
const waits = [];
const r1 = await broadcastEstop({ send: (bytes) => { sent.push(hex(bytes)); }, sleep: async (ms) => { waits.push(ms); } });
assert('estop_repeat_max sends', sent.length === LIMITS.estop_repeat_max && r1.sent === LIMITS.estop_repeat_max,
  sent.length + ' of ' + LIMITS.estop_repeat_max);
assert('every repeat is the same initiation (same bytes, same seq)', new Set(sent).size === 1);
assert('the seq on the wire is the one returned', Buffer.from(sent[0], 'hex').readUInt16LE(6) === r1.seq);
assert('estop_repeat_interval_ms between sends, none before the first',
  waits.length === LIMITS.estop_repeat_max - 1 && waits.every((ms) => ms === LIMITS.estop_repeat_interval_ms));
const r2 = await broadcastEstop({ send: () => {}, sleep: async () => {} });
assert('the next press is a new initiation', r2.seq !== r1.seq);

let calls = 0;
const r3 = await broadcastEstop({
  send: async () => { calls++; if (calls % 2) throw new Error('no route'); },
  sleep: async () => {},
});
assert('a failed send does not stop the repeats', calls === LIMITS.estop_repeat_max
  && r3.failed === Math.ceil(LIMITS.estop_repeat_max / 2) && r3.sent === Math.floor(LIMITS.estop_repeat_max / 2));
const r4 = await broadcastEstop({ send: () => { throw new Error('down'); }, sleep: async () => {} });
assert('every send failing reports sent 0', r4.sent === 0 && r4.failed === LIMITS.estop_repeat_max);

// ---- through a real socket -------------------------------------------------------
// `send` over node:dgram on the loopback: the bytes a hub's listener receives.
const rx = dgram.createSocket('udp4');
await new Promise((res) => rx.bind(0, '127.0.0.1', res));
const got = [];
rx.on('message', (m) => got.push(hex(m)));
const tx = dgram.createSocket('udp4');
const port = rx.address().port;
const r5 = await broadcastEstop({
  cause: SAFETY_CAUSE.user,
  send: (bytes) => new Promise((res, rej) => tx.send(bytes, port, '127.0.0.1', (e) => (e ? rej(e) : res()))),
  sleep: async () => {},
});
for (let i = 0; i < 50 && got.length < r5.sent; i++) await new Promise((res) => setTimeout(res, 10));
tx.close();
rx.close();
assert('the loopback listener received every send', got.length === LIMITS.estop_repeat_max, got.length + ' datagrams');
assert('each one is a valid §5.5 frame', got.every((h) => {
  const f = Buffer.from(h, 'hex');
  return f.length === 12 && f.readUInt32LE(0) === 0xe5e5e5e5 && zlibCrc32(f.subarray(0, 8)) === f.readUInt32LE(8);
}));

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall estop-datagram checks pass');
process.exit(failures ? 1 : 0);
