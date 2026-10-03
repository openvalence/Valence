/**
 * valence-trial-sim.test.mjs -- RFC-099 trial writes (SPEC §9.3) against a
 * live valencesim: a trial is live and marked, a second session is refused
 * TRIAL_CONFLICT, revert and a session's end restore, commit stores, and a
 * trial never reaches the state file. Then the same walk against
 * createLocalHub over the catalog the sim served.
 *
 * Needs a built valencesim (Nucleus/sim/valencesim/README.md); override the
 * path with VALENCESIM. Spare ports, never 82/80: WS 8586, /uitoken 8593.
 * The sim runs on a private --state and is stopped before exit.
 *
 * Run:  node clients/js/test/valence-trial-sim.test.mjs   (exits 1 on any failure)
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSession } from '../session.js';
import { createLocalHub } from '../localhub.js';
import { CH_SAFETY, CH_SETTINGS_TRIAL, NACK, PRIORITY, TRIAL_OP } from '../frames.js';
import { FIELD_ROLE } from '../generated/registry_vocab.js';
import { fromHex } from '../sha256.js';

const SIM = process.env.VALENCESIM ||
  new URL('../../../../Nucleus/sim/valencesim/build/valencesim.exe', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const WS_PORT = 8586;
const HTTP_PORT = 8593;
const CFG = 0x1000, CFG_SET = 0x3000, JOG_SPEED_KEY = 3;

let failures = 0;
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = (p) => p.then((v) => ({ v }), (e) => ({ e }));

if (!existsSync(SIM)) {
  console.log('valencesim not found at ' + SIM + ' (set VALENCESIM)');
  process.exit(1);
}
const stateDir = mkdtempSync(join(tmpdir(), 'valence-trial-'));
let sim = null;
function startSim() {
  sim = spawn(SIM, ['--port', String(WS_PORT), '--http', String(HTTP_PORT), '--duration', '120',
    '--no-discovery', '--no-estop-udp', '--state', join(stateDir, 'sim')], { stdio: 'ignore', windowsHide: true });
}
async function stopSim() {
  if (!sim) return;
  const done = new Promise((r) => sim.once('exit', r));
  sim.kill();
  await done;
  sim = null;
}

async function uiToken() {
  for (let i = 0; i < 8; i++) {
    try {
      const j = await (await fetch('http://127.0.0.1:' + HTTP_PORT + '/uitoken')).json();
      if (j && j.ok) return fromHex(j.token);
    } catch (e) { /* not up yet */ }
    await delay(300);
  }
  return null;
}

async function open(control, local = null) {
  const s = createSession({
    host: local ? 'virtual' : '127.0.0.1', port: WS_PORT, autoReconnect: false,
    token: control && !local ? uiToken : undefined,
    WebSocketImpl: local ? local.WebSocket : undefined,
    subscriptions: [[CH_SAFETY, 0, PRIORITY.critical], [CFG, 0, PRIORITY.normal]],
  });
  s.states = [];
  s.on('state', (ch, smp) => { if (ch === CFG) s.states.push(smp); });
  const live = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('no LIVE')), 15000);
    s.on('live', () => { clearTimeout(t); resolve(); });
  });
  s.connect();
  await live;
  return s;
}

const cfgOf = (s) => s.states.at(-1) || {};

console.log('valence-js trial writes against valencesim :' + WS_PORT);
startSim();
await delay(800);
let a = null, b = null, served = null;
try {
  a = await open(true);
  b = await open(true);
  const entry = a.catalog.find((e) => e.id === CFG);
  const markField = entry.layout.find((f) => f.role === FIELD_ROLE.meta_trial_pending);
  const jog = entry.layout.find((f) => f.settingKey === JOG_SPEED_KEY);
  const bit = entry.layout.filter((f) => f.settingKey != null).indexOf(jog);
  assert('the catalog declares settings-trial and a trial mark on machine-config',
    a.catalog.some((e) => e.id === CH_SETTINGS_TRIAL) && !!markField && bit >= 0);
  await delay(300);
  const stored = cfgOf(a)[jog.name];
  served = a.catalogBytes;

  const t1 = stored + 11;
  const echo = await a.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: t1 }, { trial: true });
  await delay(300);
  assert('a trial write echoes its applied value', echo.applied[JOG_SPEED_KEY] === t1, echo.applied[JOG_SPEED_KEY]);
  assert('STATE carries the trial value', cfgOf(b)[jog.name] === t1, cfgOf(b)[jog.name]);
  assert('every client sees the trial mark', (cfgOf(b)[markField.name] & (1 << bit)) !== 0, cfgOf(b)[markField.name]);

  const clash = await settle(b.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: stored + 3 }));
  assert('a second session is refused TRIAL_CONFLICT', clash.e && clash.e.code === NACK.TRIAL_CONFLICT,
    clash.e && clash.e.message);

  await a.sendTrialOp(TRIAL_OP.revert);
  await delay(300);
  assert('revert restores the stored value', cfgOf(b)[jog.name] === stored, cfgOf(b)[jog.name]);
  assert('revert clears the mark', (cfgOf(b)[markField.name] & (1 << bit)) === 0);

  await a.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: stored + 21 }, { trial: true });
  await delay(200);
  a.close();
  a = null;
  await delay(500);
  assert('a session ending reverts its trial', cfgOf(b)[jog.name] === stored, cfgOf(b)[jog.name]);

  const kept = stored + 31;
  await b.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: kept }, { trial: true });
  await b.sendTrialOp(TRIAL_OP.commit);
  await delay(300);
  assert('commit keeps the value and clears the mark',
    cfgOf(b)[jog.name] === kept && (cfgOf(b)[markField.name] & (1 << bit)) === 0, cfgOf(b)[jog.name]);
  await delay(2600);   // past the persist debounce

  // A trial after the commit, given the same debounce, must not reach the file.
  await b.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: kept + 7 }, { trial: true });
  await delay(2600);
  b.close();
  b = null;
  await delay(200);
  await stopSim();

  startSim();
  await delay(800);
  const c = await open(false);
  await delay(300);
  assert('after a restart the committed value is stored, the trial is not', cfgOf(c)[jog.name] === kept,
    cfgOf(c)[jog.name]);
  c.close();
} catch (e) {
  assert('no exception', false, e && e.message);
} finally {
  if (a) a.close();
  if (b) b.close();
  await delay(100);
  await stopSim();
  rmSync(stateDir, { recursive: true, force: true });
}

if (served) {
  console.log('valence-js trial writes against createLocalHub (the catalog the sim served)');
  const hub = createLocalHub({ catalogBytes: served });
  const x = await open(true, hub);
  const y = await open(true, hub);
  const entry = x.catalog.find((e) => e.id === CFG);
  const markField = entry.layout.find((f) => f.role === FIELD_ROLE.meta_trial_pending);
  const jog = entry.layout.find((f) => f.settingKey === JOG_SPEED_KEY);
  const bit = entry.layout.filter((f) => f.settingKey != null).indexOf(jog);
  await delay(50);
  const stored = cfgOf(y)[jog.name];
  await x.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: stored + 5 }, { trial: true });
  await delay(50);
  assert('local: the trial is live and marked',
    cfgOf(y)[jog.name] === stored + 5 && (cfgOf(y)[markField.name] & (1 << bit)) !== 0, cfgOf(y)[jog.name]);
  const clash = await settle(y.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: stored + 1 }, { trial: true }));
  assert('local: TRIAL_CONFLICT for a second session', clash.e && clash.e.code === NACK.TRIAL_CONFLICT);
  await x.sendTrialOp(TRIAL_OP.revert);
  await delay(50);
  assert('local: revert restores and unmarks',
    cfgOf(y)[jog.name] === stored && (cfgOf(y)[markField.name] & (1 << bit)) === 0, cfgOf(y)[jog.name]);
  await x.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: stored + 9 }, { trial: true });
  x.close();
  await delay(50);
  assert('local: a session ending reverts', cfgOf(y)[jog.name] === stored, cfgOf(y)[jog.name]);
  await y.sendIntent(CFG_SET, { [JOG_SPEED_KEY]: stored + 4 }, { trial: true });
  await y.sendTrialOp(TRIAL_OP.commit);
  await delay(50);
  assert('local: commit keeps the value', cfgOf(y)[jog.name] === stored + 4 && cfgOf(y)[markField.name] === 0);
  y.close();
}

console.log(failures ? failures + ' FAILED' : 'all passed');
process.exit(failures ? 1 : 0);
