/**
 * valence-discover-sim.test.mjs -- SPEC §13.8 against a live valencesim: the
 * board's own responder (Nucleus flagship_p4/src/hub/ValenceDiscovery.cpp)
 * answers a node probe on the loopback with the identity WELCOME serves, drops
 * a datagram that is not a probe, throttles a second probe from the same source
 * inside the window, and stays silent under --no-discovery.
 *
 * Needs a built valencesim (Nucleus/sim/valencesim/README.md); override the
 * path with VALENCESIM. Spare ports, never 82/80: WS 8583, /uitoken 8590,
 * discovery 22197 (the sim's --discovery-port, so a twin already holding the
 * registry port cannot answer for this one).
 *
 * Run:  node clients/js/test/valence-discover-sim.test.mjs   (exits 1 on any failure)
 */

import dgram from 'node:dgram';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSession } from '../session.js';
import { toHex } from '../sha256.js';
import { discover, encodeDiscoverProbe, decodeDiscoverReply, DISCOVERY_REPLY_INTERVAL_MS } from '../discover.js';

const SIM = process.env.VALENCESIM ||
  new URL('../../../../Nucleus/sim/valencesim/build/valencesim.exe', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WS_PORT = 8583;
const HTTP_PORT = 8590;
const DISC_PORT = 22197;
const IID = '5eed0000c0ffee01'; // seeded into the twin's identity file, read back over UDP

let failures = 0;
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function startSim(stateDir, extra) {
  return spawn(SIM, ['--port', String(WS_PORT), '--http', String(HTTP_PORT), '--duration', '60',
    '--discovery-port', String(DISC_PORT), '--state', join(stateDir, 'sim'), ...extra],
  { stdio: 'ignore', windowsHide: true });
}

async function untilListening() {
  for (let i = 0; i < 80; i++) {
    const ok = await new Promise((r) => {
      const p = new WebSocket('ws://127.0.0.1:' + WS_PORT + '/', ['valence.v1']);
      p.onopen = () => { p.close(); r(true); };
      p.onerror = () => r(false);
    });
    if (ok) return true;
    await delay(100);
  }
  return false;
}

// Every datagram that reaches one socket within `ms` of sending `bytes`.
async function sendAndCollect(bytes, ms) {
  const sock = dgram.createSocket('udp4');
  const got = [];
  sock.on('message', (m) => got.push(new Uint8Array(m)));
  await new Promise((r) => sock.bind(0, '127.0.0.1', r));
  sock.send(bytes, DISC_PORT, '127.0.0.1');
  await delay(ms);
  sock.close();
  return got;
}

async function welcomeOf() {
  const s = createSession({ host: '127.0.0.1', port: WS_PORT, clientName: 'discover-test', autoReconnect: false });
  try {
    return await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('no WELCOME in 8 s')), 8000);
      s.on('welcome', (w) => { clearTimeout(t); resolve(w); });
      s.connect();
    });
  } finally {
    s.close();
  }
}

if (!existsSync(SIM)) {
  console.log('valencesim not found at ' + SIM + ' (set VALENCESIM)');
  process.exit(1);
}
const stateDir = mkdtempSync(join(tmpdir(), 'valence-discover-'));
// PREFIX.iid is the twin's NVS hub_iid: 8 bytes, little-endian (sim README).
writeFileSync(join(stateDir, 'sim.iid'), Buffer.from(IID, 'hex').reverse());

console.log('valencesim discovery: probe and reply on 127.0.0.1:' + DISC_PORT + ' (WS :' + WS_PORT + ')');
let sim = startSim(stateDir, ['--pairing-window']);
try {
  assert('the twin listens', await untilListening());

  const junk = await sendAndCollect(Uint8Array.from([0x56, 0x4c, 0x4e, 0x58, 1, 0, 0, 0, 0]), 300);
  assert('a datagram with a foreign magic gets no reply', junk.length === 0, junk.length + ' datagram(s)');

  const probedAt = Date.now();
  const hubs = await discover({ createSocket: dgram.createSocket, address: '127.0.0.1', port: DISC_PORT, timeoutMs: 600 });
  const h = hubs[0] || {};
  assert('exactly one hub answers (the junk cost no slot)', hubs.length === 1, JSON.stringify(hubs));
  assert('hub_instance_id is the identity store\'s', h.hub_instance_id === IID, h.hub_instance_id);
  assert('ws_port is the listening WS port', h.ws_port === WS_PORT, String(h.ws_port));
  assert('hub_name and the replying address', h.hub_name === 'valencesim' && h.ip === '127.0.0.1', h.hub_name + ' @ ' + h.ip);
  assert('pairing_window_open follows the presence window', h.pairing_window_open === true);

  // The reply left within a tick of probedAt, so this lands inside its window.
  const again = await sendAndCollect(encodeDiscoverProbe(0x0badf00d), 250);
  assert('a second probe from the same source inside the window is throttled', again.length === 0, again.length + ' datagram(s)');

  const w = await welcomeOf();
  assert('reply and WELCOME carry one hub_instance_id (RFC-072)', w.identity && w.identity.hub_instance_id === h.hub_instance_id,
    w.identity && w.identity.hub_instance_id);
  assert('reply and WELCOME carry one catalog etag', w.catalogEtag && toHex(w.catalogEtag) === h.catalog_etag, h.catalog_etag);
  assert('reply and WELCOME carry one fw_version and proto_ver', w.identity && w.identity.fw_version === h.fw_version && h.proto_ver === 1,
    h.fw_version + ' / ' + h.proto_ver);

  await delay(Math.max(0, probedAt + DISCOVERY_REPLY_INTERVAL_MS + 150 - Date.now()));
  const later = await sendAndCollect(encodeDiscoverProbe(0x0badf00d), 400);
  const r = later.length === 1 ? decodeDiscoverReply(later[0]) : null;
  assert('past the window the same source is answered once, nonce echoed', r && r.nonce === 0x0badf00d, later.length + ' datagram(s)');
} catch (e) {
  assert('discovery run completed', false, e.message);
} finally {
  sim.kill();
  await delay(300);
}

console.log('valencesim --no-discovery: the port stays quiet');
sim = startSim(stateDir, ['--no-discovery']);
try {
  assert('the twin listens', await untilListening());
  const quiet = await discover({ createSocket: dgram.createSocket, address: '127.0.0.1', port: DISC_PORT, timeoutMs: 600 });
  assert('no reply under --no-discovery', quiet.length === 0, JSON.stringify(quiet));
} catch (e) {
  assert('--no-discovery run completed', false, e.message);
} finally {
  sim.kill();
  await delay(300);
  try { rmSync(stateDir, { recursive: true, force: true }); } catch (e) { /* sim may still hold it */ }
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall passed');
process.exit(failures ? 1 : 0);
