/**
 * valence-retained-sim.test.mjs -- WELCOME limits.retained_pending and the
 * SYNCING->LIVE gate, fresh vs RFC-042 reattach, against a live valencesim.
 *
 * retained_pending counts WELCOME's own grants only (registry.yaml limits key
 * 3, SPEC §6.3). A fresh session's grants come from HELLO's wishes and a
 * reattach's from the retained session (§6.6 path B), so the two agree only
 * when the client carries its wishes in HELLO (bd val-fjx).
 *
 * Needs a built valencesim (Nucleus/sim/valencesim/README.md); override the
 * path with VALENCESIM. Uses ports 8482 (WS) and 8489 (/uitoken).
 *
 * Run:  node clients/js/test/valence-retained-sim.test.mjs   (exits 1 on any failure)
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSession } from '../session.js';
import { CH_SAFETY, CH_CONTROL_OWNER, CH_HUB_STATUS, PRIORITY } from '../frames.js';

const SIM = process.env.VALENCESIM ||
  new URL('../../../../Nucleus/sim/valencesim/build/valencesim.exe', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WS_PORT = 8482;
const HTTP_PORT = 8489;
const WISHES = [
  [CH_SAFETY, 0, PRIORITY.critical],
  [CH_CONTROL_OWNER, 0, PRIORITY.critical],
  [CH_HUB_STATUS, 1, PRIORITY.background],
];

let failures = 0;
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function waitFor(s, ev, ms, what) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { off(); reject(new Error('timeout waiting for ' + what)); }, ms);
    const off = s.on(ev, (...a) => { clearTimeout(t); off(); resolve(a); });
  });
}

if (!existsSync(SIM)) {
  console.log('valencesim not found at ' + SIM + ' (set VALENCESIM)');
  process.exit(1);
}
const stateDir = mkdtempSync(join(tmpdir(), 'valence-retained-'));
const sim = spawn(SIM, ['--port', String(WS_PORT), '--http', String(HTTP_PORT), '--duration', '60',
  '--state', join(stateDir, 'sim')], { stdio: 'ignore', windowsHide: true });

// The socket of the CURRENT connect, so the test can drop it without a GOODBYE.
class TapWS extends WebSocket {
  constructor(url, protocols) { super(url, protocols); TapWS.last = this; }
}

console.log('valence-js retained_pending: fresh HELLO-with-wishes vs RFC-042 reattach (valencesim :' + WS_PORT + ')');
let s = null;
try {
  for (let i = 0; i < 50; i++) { // the sim takes a moment to listen
    const ok = await new Promise((r) => {
      const p = new WebSocket('ws://127.0.0.1:' + WS_PORT + '/', ['valence.v1']);
      p.onopen = () => { p.close(); r(true); };
      p.onerror = () => r(false);
    });
    if (ok) break;
    await delay(100);
  }

  s = createSession({
    host: '127.0.0.1', port: WS_PORT, clientName: 'retained-test',
    autoReconnect: true, subscriptions: WISHES, WebSocketImpl: TapWS,
  });

  // Per WELCOME: what it promised, which of its grants pushed STATE, and what
  // had landed when LIVE fired (read after the triggering STATE's own emit).
  const epochs = [];
  s.on('welcome', (w) => epochs.push({
    sessionId: w.sessionId, retained: w.limits.retained_pending,
    granted: new Set(s.state.grants.keys()), adopted: new Set(), atLive: null,
  }));
  s.on('state', (ch) => { const e = epochs.at(-1); if (e && e.granted.has(ch)) e.adopted.add(ch); });
  s.on('live', () => setTimeout(() => { const e = epochs.at(-1); e.atLive = e.adopted.size; }, 0));

  const live1 = waitFor(s, 'live', 8000, 'fresh LIVE');
  s.connect();
  await live1;
  await delay(50);
  const fresh = epochs[0];
  assert('fresh: WELCOME grants every HELLO wish', WISHES.every(([ch]) => fresh.granted.has(ch)),
    'granted ' + [...fresh.granted].map((c) => '0x' + c.toString(16)).join(','));
  assert('fresh: retained_pending > 0 (wishes rode HELLO)', fresh.retained > 0, 'retained_pending=' + fresh.retained);
  assert('fresh: gate passed with every promised retained push adopted', fresh.atLive >= fresh.retained,
    'adopted ' + fresh.atLive + ' of ' + fresh.retained);

  // Drop the transport with no GOODBYE: the hub parks the session STALE and
  // the autoReconnect HELLO (same instance_id) reattaches to it.
  const live2 = waitFor(s, 'live', 8000, 'reattach LIVE');
  TapWS.last.close();
  await live2;
  await delay(50);
  const re = epochs[1];
  assert('reattach: same session_id (RFC-042 path B, not a new session)', re && re.sessionId === fresh.sessionId,
    re && ('0x' + (re.sessionId >>> 0).toString(16) + ' vs 0x' + (fresh.sessionId >>> 0).toString(16)));
  assert('retained_pending identical for fresh and reattach', re && re.retained === fresh.retained,
    re && ('fresh=' + fresh.retained + ' reattach=' + re.retained));
  assert('reattach: gate passed with every promised retained push adopted', re && re.atLive >= re.retained,
    re && ('adopted ' + re.atLive + ' of ' + re.retained));
} catch (e) {
  assert('session ran to completion', false, e.message);
} finally {
  if (s) s.close();
  sim.kill();
  await delay(200);
  try { rmSync(stateDir, { recursive: true, force: true }); } catch (e) { /* sim may still hold it */ }
}

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall passed');
process.exit(failures ? 1 : 0);
