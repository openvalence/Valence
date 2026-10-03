/**
 * valence-estop-datagram-sim.test.mjs -- RFC-053 end to end against a live
 * valencesim: a node sender's ESTOP datagram on the sim's §13.8 port latches
 * the hub exactly as a raw 0xE5 over WS does, and nothing else on the port
 * changes.
 *
 * In order: a DISCOVER_PROBE on the port is still answered (one listener per
 * port) with the reply's bit1 datagram_estop set; a bad CRC latches nothing; broadcastEstop() latches with its seq as
 * estop_seq and draws no answer; after a release the same initiation's bytes
 * do not re-latch and a fresh seq does; started with --no-estop-udp, a valid
 * datagram latches nothing and the reply clears bit1.
 *
 * Needs a valencesim whose §13.8 listener offers each datagram to the hub's
 * ValenceEstopDatagram first (Nucleus bd val-yvt). Override the path with
 * VALENCESIM. Picks free ports; state lives in a temp dir.
 *
 * Run:  node clients/js/test/valence-estop-datagram-sim.test.mjs   (exits 1 on any failure)
 */

import { spawn } from 'node:child_process';
import dgram from 'node:dgram';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSession } from '../session.js';
import { acquireToken } from '../credentials.js';
import { CH_SAFETY, PRIORITY, SAFETY_OP, SAFETY_CAUSE, ACCESS } from '../frames.js';
import { broadcastEstop, encodeEstopDatagram, nextEstopSeq } from '../estop-datagram.js';
import { DISCOVER_REPLY_FLAG } from '../generated/registry_vocab.js';

const SIM = process.env.VALENCESIM ||
  new URL('../../../../Nucleus/sim/valencesim/build/valencesim.exe', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

let failures = 0;
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(pred, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return true;
    await delay(10);
  }
  return pred();
}

const freeTcp = () => new Promise((res) => {
  const srv = createServer().listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => res(p)); });
});
const freeUdp = () => new Promise((res) => {
  const s = dgram.createSocket('udp4');
  s.bind(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});

if (!existsSync(SIM)) {
  console.log('valencesim not found at ' + SIM + ' (set VALENCESIM)');
  process.exit(1);
}

async function startSim(extra = []) {
  const ws = await freeTcp();
  const http = await freeTcp();
  const udp = await freeUdp();
  const dir = mkdtempSync(join(tmpdir(), 'valence-estop-udp-'));
  const out = [];
  const proc = spawn(SIM, ['machine', '--headless', '--duration', '60', '--port', String(ws), '--http', String(http),
    '--discovery-port', String(udp), '--state', join(dir, 'sim'), ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', (b) => out.push(String(b)));
  proc.stderr.on('data', (b) => out.push(String(b)));
  await delay(1500);
  return { ws, http, udp, dir, proc, out };
}

function stopSim(sim) {
  sim.proc.kill();
  try { rmSync(sim.dir, { recursive: true, force: true }); } catch (e) { /* the sim may still hold a file */ }
}

async function connect(sim, withToken) {
  const s = createSession({
    host: '127.0.0.1', port: sim.ws, clientKind: 'test', clientName: 'estop-udp-sim', autoReconnect: false,
    token: withToken ? () => acquireToken('127.0.0.1:' + sim.http) : null,
    subscriptions: [[CH_SAFETY, 0, PRIORITY.critical]],
  });
  const state = { safety: null };
  s.on('safety', (snap) => { state.safety = snap; });
  const live = new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('no LIVE in 8 s')), 8000);
    s.on('live', () => { clearTimeout(t); res(); });
  });
  s.connect();
  await live;
  await until(() => state.safety !== null, 2000);
  return { s, state };
}

// A §13.8 probe on its own socket: the reply's flags byte, or null when unanswered.
async function probeFlags(port) {
  const sock = dgram.createSocket('udp4');
  await new Promise((res) => sock.bind(0, '127.0.0.1', res));
  const nonce = 0x5eed1234;
  const probe = Buffer.alloc(9);
  probe.write('VLNC', 0, 'latin1');
  probe.writeUInt8(1, 4);
  probe.writeUInt32LE(nonce, 5);
  let reply = null;
  sock.on('message', (m) => { if (m.length === 76 && m.toString('latin1', 0, 4) === 'VLNC') reply = m; });
  for (let i = 0; i < 3 && !reply; i++) {
    sock.send(probe, port, '127.0.0.1');
    await until(() => reply !== null, 1100);
  }
  sock.close();
  return reply && reply.readUInt32LE(4) === nonce ? reply[75] : null;
}

const sender = dgram.createSocket('udp4');
await new Promise((res) => sender.bind(0, '127.0.0.1', res));
let answers = 0;
sender.on('message', () => { answers++; });
const sendTo = (port) => (bytes) => new Promise((res, rej) => sender.send(bytes, port, '127.0.0.1', (e) => (e ? rej(e) : res())));

let sim = null;
let session = null;
try {
  console.log('RFC-053 ESTOP datagram against valencesim:');
  sim = await startSim();
  session = await connect(sim, true);
  const latched = () => !!(session.state.safety && session.state.safety.estopLatched);
  assert('the session is live and the hub starts unlatched', !latched());
  const flags = await probeFlags(sim.udp);
  assert('a DISCOVER_PROBE on the port is answered', flags !== null);
  assert('the reply sets bit1 datagram_estop', flags !== null && (flags & DISCOVER_REPLY_FLAG.datagram_estop) !== 0,
    'flags ' + flags);

  const bad = encodeEstopDatagram({ seq: nextEstopSeq() });
  bad[11] ^= 0xff;
  await sendTo(sim.udp)(bad);
  await delay(300);
  assert('a datagram with a bad CRC latches nothing', !latched());

  const r = await broadcastEstop({ cause: SAFETY_CAUSE.user, origin: ACCESS.watch, send: sendTo(sim.udp) });
  assert('broadcastEstop spent its whole budget', r.sent === 20, r.sent + ' sent');
  assert('a valid datagram latches the hub', await until(latched, 2000));
  assert('estop_seq is the datagram\'s seq', session.state.safety.estopSeq === r.seq,
    session.state.safety.estopSeq + ' vs ' + r.seq);
  assert('the hub answered no datagram', answers === 0, answers + ' answers');

  await session.s.sendSafetyIntent(SAFETY_OP.release);
  assert('release clears the latch', await until(() => !latched(), 2000));

  // One initiation by hand, so its release lands inside the replay window.
  const seq = nextEstopSeq();
  const one = encodeEstopDatagram({ seq });
  await sendTo(sim.udp)(one);
  assert('a single datagram latches', await until(() => latched() && session.state.safety.estopSeq === seq, 2000));
  await session.s.sendSafetyIntent(SAFETY_OP.release);
  assert('released again', await until(() => !latched(), 2000));
  await sendTo(sim.udp)(one);
  await delay(300);
  assert('the released initiation\'s repeat does not re-latch', !latched());
  const fresh = nextEstopSeq();
  await sendTo(sim.udp)(encodeEstopDatagram({ seq: fresh }));
  assert('a fresh seq re-latches', await until(() => latched() && session.state.safety.estopSeq === fresh, 2000));
  assert('still no answer on UDP', answers === 0, answers + ' answers');
  session.s.close();
  session = null;
  stopSim(sim);
  sim = null;

  sim = await startSim(['--no-estop-udp']);
  session = await connect(sim, false);
  await sendTo(sim.udp)(encodeEstopDatagram({ seq: nextEstopSeq() }));
  await delay(500);
  assert('--no-estop-udp: a valid datagram latches nothing', !(session.state.safety && session.state.safety.estopLatched));
  const off = await probeFlags(sim.udp);
  assert('--no-estop-udp: the probe is still answered', off !== null);
  assert('--no-estop-udp: the reply clears bit1', off !== null && (off & DISCOVER_REPLY_FLAG.datagram_estop) === 0,
    'flags ' + off);
} catch (e) {
  assert('no exception', false, e && e.message);
} finally {
  if (session) session.s.close();
  if (failures && sim) console.log('--- sim output (tail) ---\n' + sim.out.join('').split('\n').slice(-25).join('\n'));
  if (sim) stopSim(sim);
  sender.close();
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall estop-datagram sim checks pass');
process.exit(failures ? 1 : 0);
