/**
 * provision.test.mjs -- the provisioning page's frame codec and setup walk,
 * driven through the real createSession over fake Web Serial and Web
 * Bluetooth objects bridged to createLocalHub.
 *
 * What it cannot prove: Web Bluetooth and Web Serial do not run headless, so
 * the browser APIs themselves (choosers, DTR/RTS on a real CDC port, GATT MTU)
 * are faked here and owed on hardware. The fakes are the APIs' shapes, not
 * their behavior.
 *
 * The fake hub answers 0x000F the way SPEC §13.9 says a hub answers: ECHO with
 * `true` for both secrets plus ipv4 and ws_port, or NACK NETWORK_JOIN_FAILED.
 *
 * Run:  node clients/provision/test/provision.test.mjs   (exits 1 on any failure)
 */

import { readFileSync } from 'node:fs';
import { createSession } from '../../js/session.js';
import { createLocalHub } from '../../js/localhub.js';
import { cbMap, cbArray, cbUint, cbTstr, cbF32, cbBool, cbDecodeFull } from '../../js/cbor.js';
import { encodeFrame, parseFrames } from '../../js/frames.js';
import { decodeCatalog } from '../../js/catalog.js';
import {
  FRAME, K, NACK, ACCESS, PRIORITY, CHANNEL_CLASS, PACKED, UI_CATEGORY, SETTING_FLAG, PROVISIONING_OP,
} from '../../js/generated/registry_vocab.js';
import {
  cobsEncode, cobsDecode, serialFrame, Deframer, serialSocket, bleSocket,
  BLE_SERVICE, BLE_WRITE, BLE_NOTIFY, MSD_COMPANY_ID,
} from '../link.js';
import {
  setupSteps, stepValues, wifiJoinValues, joinOutcome, ipv4Text, CH_PROVISIONING, JOIN_TIMEOUT_MS,
} from '../walk.js';

let failures = 0;
function check(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const bytes = (...xs) => Uint8Array.from(xs);
const te = new TextEncoder();
function waitFor(s, ev, ms = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { off(); reject(new Error('timeout waiting for ' + ev)); }, ms);
    const off = s.on(ev, (...a) => { clearTimeout(t); off(); resolve(a); });
  });
}
const settle = (p) => p.then((v) => ({ v }), (e) => ({ e }));
const memStore = () => { let h = null; return { load: () => h, save(x, etag, b) { h = { etag, bytes: b }; }, clear() { h = null; } }; };

// ---- the codec -------------------------------------------------------------------

console.log('provision: COBS (SPEC 13.5), byte-identical to lib/valence serial_cobs.hpp');
check('11 22 00 33', hex(cobsEncode(bytes(0x11, 0x22, 0x00, 0x33))) === '0311220233');
check('one zero', hex(cobsEncode(bytes(0))) === '0101');
check('empty', hex(cobsEncode(bytes())) === '01');
const run254 = new Uint8Array(254).fill(1);
check('254-byte run ends without a trailing code (the library\'s edge case)',
  hex(cobsEncode(run254)) === 'ff' + '01'.repeat(254));
const run255 = new Uint8Array(255).fill(1);
check('255-byte run', hex(cobsEncode(run255)) === 'ff' + '01'.repeat(254) + '0201');
check('delimiters outside the body', hex(serialFrame(bytes(0x11, 0x22, 0x00, 0x33))) === '000311220233' + '00');

let seed = 7;
const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed >>> 24; };
let roundTrips = 0;
for (const len of [1, 7, 253, 254, 255, 256, 509, 512]) {
  for (let k = 0; k < 4; k++) {
    const src = Uint8Array.from({ length: len }, () => (k % 2 ? rand() : rand() & 3));
    const back = cobsDecode(cobsEncode(src));
    if (back && hex(back) === hex(src) && !cobsEncode(src).includes(0)) roundTrips++;
  }
}
check('round trip, 32 frames from 1 to 512 bytes, no zero inside a body', roundTrips === 32, roundTrips);
check('a zero code byte is malformed', cobsDecode(bytes(0x02, 0x11, 0x00)) === null);
check('a code past the end is truncated', cobsDecode(bytes(0x05, 0x11)) === null);

console.log('provision: the serial deframer');
{
  const a = encodeFrame(FRAME.WELCOME, 0, bytes(0xa0));
  const b = encodeFrame(FRAME.ECHO, CH_PROVISIONING, new Uint8Array(20));
  const d = new Deframer();
  const stream = [te.encode('I (1234) wifi: connected\r\n'), serialFrame(a),
    te.encode('[    12.345 I1 hub       ] persisted cfg\n'), serialFrame(b)];
  const got = [];
  for (const chunk of stream) got.push(...d.push(chunk));
  check('console text between frames dropped, frames kept', got.length === 2 && hex(got[0]) === hex(a) && hex(got[1]) === hex(b));
  check('two text chunks counted', d.dropped === 2, d.dropped);

  const d2 = new Deframer();
  d2.push(new Uint8Array(3000).fill(0x55));
  const after = d2.push(serialFrame(a));
  check('resync after 3 KB with no delimiter', after.length === 1 && hex(after[0]) === hex(a));
  const torn = serialFrame(b).slice();
  torn.copyWithin(5, 6); // lose a byte: the header's len no longer covers the body
  check('a torn frame is not a frame', d2.push(torn.subarray(0, torn.length - 1)).length === 0);
  let one = [];
  for (const x of serialFrame(b)) one = one.concat(d2.push(bytes(x)));
  check('byte-at-a-time feed', one.length === 1 && hex(one[0]) === hex(b));
}

// ---- the registry ------------------------------------------------------------------

console.log('provision: the transcribed BLE identity matches registry.yaml');
{
  const yaml = readFileSync(new URL('../../../spec/registry/registry.yaml', import.meta.url), 'utf8');
  const pick = (k) => (yaml.match(new RegExp('^\\s*' + k + ':\\s*"?([0-9A-Fa-fx-]+)"?', 'm')) || [])[1];
  check('service_uuid', pick('service_uuid').toLowerCase() === BLE_SERVICE);
  check('write_char_uuid', pick('write_char_uuid').toLowerCase() === BLE_WRITE);
  check('notify_char_uuid', pick('notify_char_uuid').toLowerCase() === BLE_NOTIFY);
  check('msd_company_id', Number(pick('msd_company_id')) === MSD_COMPANY_ID);
}

// ---- the walk on the recorded machine catalog ----------------------------------------

console.log('provision: the setup walk on the recorded valencesim catalog');
{
  const cat = decodeCatalog(new Uint8Array(readFileSync(new URL('../../js/test/fixtures/valencesim-catalog.bin', import.meta.url))));
  const steps = setupSteps(cat);
  check('setup steps found', steps.length > 0, steps.map((s) => s.title).join(', '));
  check('every step is a setup entry, in catalog order',
    steps.every((s, i) => cat.find((e) => e.id === s.id).category === UI_CATEGORY.setup &&
      (i === 0 || cat.findIndex((e) => e.id === steps[i - 1].id) < cat.findIndex((e) => e.id === s.id))));
  check('every field is writable through its writer', steps.every((s) => s.fields.length > 0 &&
    s.fields.every((f) => (cat.find((e) => e.id === s.writer).schema || []).some((x) => x.key === f.key))));
  check('no network step: this catalog does not declare 0x000F yet (Nucleus val-9u0.21)',
    !steps.some((s) => s.kind === 'network'));
}

// ---- a machine to talk to ------------------------------------------------------------

const m = (pairs) => cbMap(pairs.slice().sort((a, b) => a[0] - b[0]));
const opts = (names) => cbArray(names.map((n) => cbTstr(n)));
const CATALOG = cbArray([
  // core 0x000F as registry.yaml core_channels describes it
  m([[1, cbUint(CH_PROVISIONING)], [2, cbTstr('provisioning')], [3, cbUint(CHANNEL_CLASS.INTENT)], [4, cbUint(1)],
    [5, cbUint(ACCESS.configure)], [6, cbF32(1)], [7, cbUint(PRIORITY.normal)], [10, cbUint(UI_CATEGORY.setup)],
    [9, m([
      [1, m([[1, cbTstr('op')], [2, cbUint(0)], [3, cbTstr('')], [10, opts(['reserved', 'wifi_join'])], [13, cbTstr('action.provision')]])],
      [2, m([[1, cbTstr('ssid')], [2, cbUint(4)], [3, cbTstr('')], [15, cbUint(SETTING_FLAG.secret)]])],
      [3, m([[1, cbTstr('passphrase')], [2, cbUint(4)], [3, cbTstr('')], [15, cbUint(SETTING_FLAG.secret)]])],
      [4, m([[1, cbTstr('ipv4')], [2, cbUint(0)], [3, cbTstr('')]])],
      [5, m([[1, cbTstr('ws_port')], [2, cbUint(0)], [3, cbTstr('')]])],
    ])]]),
  m([[1, cbUint(0x1000)], [2, cbTstr('machine-config')], [3, cbUint(CHANNEL_CLASS.STATE)], [4, cbUint(0)],
    [5, cbUint(ACCESS.watch)], [6, cbF32(0)], [7, cbUint(PRIORITY.normal)], [10, cbUint(UI_CATEGORY.setup)],
    [14, cbUint(0x3000)],
    [8, cbArray([
      m([[1, cbTstr('max_rail')], [2, cbUint(PACKED.u16)], [3, cbTstr('mm')], [4, cbF32(1)], [5, cbUint(0)], [6, cbUint(2000)], [8, cbUint(1)], [9, cbUint(250)]]),
    ])]]),
  m([[1, cbUint(0x3000)], [2, cbTstr('config-set')], [3, cbUint(CHANNEL_CLASS.INTENT)], [4, cbUint(1)],
    [5, cbUint(ACCESS.control)], [6, cbF32(10)], [7, cbUint(PRIORITY.normal)],
    [9, m([[1, m([[1, cbTstr('max_rail')], [2, cbUint(2)], [3, cbTstr('mm')], [5, cbUint(0)], [6, cbUint(2000)]])]])]]),
]);

const JOINED_IP = 0xc0a80132;

/**
 * A fake hub on the far side of a byte pipe: createLocalHub for the session,
 * plus SPEC 13.9's answer to wifi_join, which localhub does not implement.
 * Records every byte it sent and every wifi_join it took.
 */
function machine(join = 'ok') {
  const hub = createLocalHub({ catalogBytes: CATALOG, identity: { product: 'Nucleus', fw_version: '0.1.7', hub_name: 'Bench' } });
  const sock = new hub.WebSocket('ws://virtual/');
  const out = { sent: [], joins: [], toClient: null, held: [] };
  sock.onopen = () => { for (const f of out.held.splice(0)) sock.send(f); };
  sock.onmessage = (ev) => out.toClient(new Uint8Array(ev.data));
  out.fromClient = (f) => {
    const [fr] = parseFrames(f);
    if (fr && fr.header.type === FRAME.INTENT && fr.header.channel === CH_PROVISIONING) {
      const intent = cbDecodeFull(fr.payload);
      const value = intent.get(K.value);
      out.joins.push({ ssid: value.get(2), pass: value.get(3) });
      const id = intent.get(K.intent_id);
      const reply = join === 'ok'
        ? encodeFrame(FRAME.ECHO, CH_PROVISIONING, m([[K.cfg_gen, cbUint(1)], [K.intent_id, cbUint(id)],
          [K.applied, m([[1, cbUint(PROVISIONING_OP.wifi_join)], [2, cbBool(true)], [3, cbBool(true)], [4, cbUint(JOINED_IP)], [5, cbUint(82)]])]]))
        : encodeFrame(FRAME.NACK, 0, m([[K.code, cbUint(NACK.NETWORK_JOIN_FAILED)], [K.channel_id, cbUint(CH_PROVISIONING)],
          [K.intent_id, cbUint(id)], [K.detail, cbTstr('authentication failed')]]));
      setTimeout(() => out.toClient(reply), 20); // the join takes a while
      return;
    }
    if (sock.readyState === 1) sock.send(f); else out.held.push(f);
  };
  return out;
}

/** A Web Serial port shape whose far end is `mach`, with console noise on it. */
function fakePort(mach) {
  const port = { readable: null, writable: null, signals: [] };
  const deframer = new Deframer();
  port.open = async () => {
    let ctl;
    port.readable = new ReadableStream({ start(c) { ctl = c; } });
    port.writable = new WritableStream({ write(chunk) { for (const f of deframer.push(chunk)) mach.fromClient(f); } });
    mach.toClient = (f) => {
      const noise = te.encode('I (42) hub: console text\r\n');
      const wire = serialFrame(f);
      mach.sent.push(...noise, ...wire);
      ctl.enqueue(noise);
      ctl.enqueue(wire);
    };
  };
  port.setSignals = async (s) => { port.signals.push(s); };
  port.close = async () => { port.readable = null; port.writable = null; };
  return port;
}

/** A Web Bluetooth device shape carrying the Valence service, far end `mach`. */
function fakeDevice(mach) {
  const listeners = new Map();
  const on = (map) => (type, fn) => { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); };
  const off = (map) => (type, fn) => map.get(type)?.delete(fn);
  const notifyL = new Map();
  const notify = {
    addEventListener: on(notifyL), removeEventListener: off(notifyL),
    startNotifications: async () => {},
  };
  const write = {
    writeValueWithoutResponse: async (b) => { mach.fromClient(new Uint8Array(b)); },
  };
  mach.toClient = (f) => {
    mach.sent.push(...f);
    const value = new DataView(f.slice().buffer);
    for (const fn of notifyL.get('characteristicvaluechanged') || []) fn({ target: { value } });
  };
  const service = {
    getCharacteristic: async (u) => (u === BLE_WRITE ? write : u === BLE_NOTIFY ? notify : Promise.reject(new Error(u))),
  };
  const device = {
    gatt: {
      connected: false,
      connect: async () => { device.gatt.connected = true; return { getPrimaryService: async (u) => { if (u !== BLE_SERVICE) throw new Error(u); return service; } }; },
      disconnect: () => { device.gatt.connected = false; },
    },
    addEventListener: on(listeners), removeEventListener: off(listeners),
  };
  return device;
}

async function open(Socket) {
  const s = createSession({ host: 'provision-test', clientKind: 'provision', clientName: 'Valence Provision',
    WebSocketImpl: Socket, autoReconnect: false, catalogStore: memStore() });
  const live = waitFor(s, 'live');
  s.connect();
  await live;
  return s;
}

// ---- end to end ------------------------------------------------------------------------

console.log('provision: the walk and a join over the serial duck');
{
  const mach = machine('ok');
  const port = fakePort(mach);
  const s = await open(serialSocket(port));
  check('LIVE over COBS with console text on the pipe', s.state.phase === 'LIVE');
  check('RTS dropped before DTR (an ESP USB-Serial/JTAG reset otherwise)',
    port.signals.length === 2 && port.signals[0].requestToSend === false && port.signals[1].dataTerminalReady === false);

  const steps = setupSteps(s.catalog);
  check('the walk: network, then machine-config, in catalog order',
    steps.map((x) => x.kind + ':' + x.id.toString(16)).join(',') === 'network:f,settings:1000');
  const cfg = steps[1];
  check('a settings step writes through its setting channel', cfg.writer === 0x3000 && cfg.fields[0].readName === 'max_rail');

  const state = waitFor(s, 'state');
  s.subscribe([[0x1000, 1, PRIORITY.normal]]);
  const [, sample] = await state;
  check('the reported value comes from STATE', sample.max_rail === 250, sample.max_rail);
  const r = await settle(s.sendIntent(cfg.writer, stepValues(cfg, { 1: '300' })));
  check('a setting applies through its writer, echoed', r.v && r.v.applied[1] === 300, JSON.stringify(r.v && r.v.applied));

  const pass = 'correct horse battery';
  const values = wifiJoinValues('HomeNet-5G', pass);
  const join = await settle(s.sendIntent(CH_PROVISIONING, values, { timeoutMs: JOIN_TIMEOUT_MS }));
  check('wifi_join reached the hub with both fields', mach.joins.length === 1 && mach.joins[0].ssid === 'HomeNet-5G' && mach.joins[0].pass === pass);
  check('the ECHO carries true for both secrets', join.v && join.v.applied[2] === true && join.v.applied[3] === true);
  const o = joinOutcome(join.v, join.e);
  check('the outcome names the address and port', o.ok && o.address === '192.168.1.50' && o.port === 82, o.text);
  check('nothing the hub sent carries the passphrase', !hex(Uint8Array.from(mach.sent)).includes(hex(te.encode(pass))));
  s.close();
}

console.log('provision: a failed join over the BLE duck');
{
  const mach = machine('fail');
  const s = await open(bleSocket(fakeDevice(mach)));
  check('LIVE over GATT, one value per frame', s.state.phase === 'LIVE');
  check('the same walk over the other pipe', setupSteps(s.catalog).length === 2);
  const join = await settle(s.sendIntent(CH_PROVISIONING, wifiJoinValues('HomeNet-5G', 'wrong horse battery'), { timeoutMs: JOIN_TIMEOUT_MS }));
  const o = joinOutcome(join.v, join.e);
  check('NETWORK_JOIN_FAILED reads as a refusal that kept the network', !o.ok && join.e.code === NACK.NETWORK_JOIN_FAILED, o.text);
  s.close();
}

console.log('provision: the form checks what the hub checks');
{
  const refused = (ssid, p) => { try { wifiJoinValues(ssid, p); return false; } catch (e) { return true; } };
  check('empty SSID refused', refused('', 'correct horse'));
  check('33-byte SSID refused', refused('x'.repeat(33), 'correct horse'));
  check('7-character passphrase refused', refused('Net', 'short12'));
  check('64 non-hex refused', refused('Net', 'z'.repeat(64)));
  check('open network allowed', !refused('Net', ''));
  check('64 hex digits allowed', !refused('Net', 'a'.repeat(64)));
  check('op is wifi_join', wifiJoinValues('Net', '')[1] === PROVISIONING_OP.wifi_join);
  check('ipv4 text', ipv4Text(0xc0a801e5) === '192.168.1.229');
  check('a refused join for want of a window asks for PAIR', joinOutcome(null, { code: NACK.ACCESS_DENIED }).text.includes('PAIR'));
}

console.log(failures ? '\n' + failures + ' FAILED' : '\nall passed');
process.exit(failures ? 1 : 0);
