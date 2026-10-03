/**
 * app.js -- the provisioning page: pick a link, walk the setup category, push
 * WiFi credentials (SPEC §13.9). DOM glue only; the protocol is the JS
 * client's session, the pipes are link.js, the walk is walk.js.
 *
 * Constraints:
 * - Every string from the hub is untrusted (SPEC §13.7): it reaches the page
 *   through textContent and attributes, never innerHTML.
 * - The passphrase is read from its input at the moment of the send, the
 *   input is cleared at once, and nothing persists it: no form submit (so no
 *   password-manager save), no storage, no log. The catalog cache is in memory
 *   too; this page writes nothing to the browser.
 * - A field shows what the hub reports and changes only on its STATE or ECHO.
 */

import { createSession } from '../js/session.js';
import { ACCESS, BLE_ADV_FLAG, PRIORITY } from '../js/generated/registry_vocab.js';
import { CBOR_FIELD } from '../js/frames.js';
import { serialSocket, bleSocket, readAdvFlags, BLE_SERVICE, MSD_COMPANY_ID } from './link.js';
import {
  setupSteps, stepValues, wifiJoinValues, joinOutcome, ipv4Text, CH_PROVISIONING, JOIN_TIMEOUT_MS,
} from './walk.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) n.append(k);
  return n;
};

const hasSerial = 'serial' in navigator;
const hasBle = 'bluetooth' in navigator;

let session = null;
let steps = [];
let at = 0;
let advFlags = null;
let via = '';
const reported = new Map(); // state channel -> decoded sample

function status(text) { $('status').textContent = text; }

function memoryStore() {
  let held = null;
  return { load: () => held, save(h, etag, bytes) { held = { etag, bytes }; }, clear() { held = null; } };
}

function setupModeText() {
  if (advFlags == null) return via === 'usb' ? 'not advertised over USB' : 'unknown (this browser cannot read it)';
  return (advFlags & BLE_ADV_FLAG.config_mode) ? 'yes' : 'no';
}

function showHub(w) {
  const id = w.identity || {};
  $('hub-name').textContent = id.hub_name || '(unnamed)';
  $('hub-fw').textContent = [id.product, id.fw_version].filter(Boolean).join(' ') || '-';
  $('hub-net').textContent = w.ipv4 && w.wsPort ? ipv4Text(w.ipv4) + ', Valence port ' + w.wsPort : 'not joined';
  $('hub-setup').textContent = setupModeText();
  $('hub').hidden = false;
}

function role() { return (session && session.state.roles) || ACCESS.watch; }

function knock() {
  status('Asking for setup access. Press PAIR on the machine if nothing happens.');
  session.sendPairReq();
}

function start(Socket, how, flags) {
  if (session) session.close();
  via = how;
  advFlags = flags;
  steps = [];
  reported.clear();
  $('steps').hidden = true;
  status('Connecting...');
  session = createSession({
    host: 'provision-' + how,
    clientKind: 'provision',
    clientName: 'Valence Provision',
    WebSocketImpl: Socket,
    autoReconnect: false,
    catalogStore: memoryStore(),
  });
  session.on('welcome', showHub);
  session.on('live', onLive);
  session.on('pairGrant', () => { status('Setup access granted.'); render(); });
  session.on('state', (ch, sample) => {
    if (!steps.some((s) => s.state === ch)) return;
    reported.set(ch, sample);
    render();
  });
  session.on('close', (c) => status('Disconnected' + (c && c.reason ? ': ' + c.reason : '') + '.'));
  session.connect();
}

function onLive() {
  steps = setupSteps(session.catalog || []);
  at = 0;
  const wishes = steps.filter((s) => s.state != null).map((s) => [s.state, 1, PRIORITY.normal]);
  if (wishes.length) session.subscribe(wishes);
  status(steps.length ? 'Connected.' : 'Connected. This machine offers no setup steps.');
  if (role() < ACCESS.configure) knock();
  render();
}

// ---- rendering ---------------------------------------------------------------

function render() {
  const box = $('steps');
  box.replaceChildren();
  if (!steps.length) { box.hidden = true; return; }
  box.hidden = false;
  const step = steps[Math.min(at, steps.length - 1)];

  const rail = el('ol', { className: 'rail' });
  steps.forEach((s, i) => {
    const b = el('button', { type: 'button', textContent: s.title });
    if (i === at) b.setAttribute('aria-current', 'step');
    b.addEventListener('click', () => { at = i; render(); });
    rail.append(el('li', {}, b));
  });
  box.append(el('h2', { textContent: 'Setup' }), rail,
    el('h3', { textContent: 'Step ' + (at + 1) + ' of ' + steps.length + ': ' + step.title }));
  box.append(step.kind === 'network' ? networkStep() : settingsStep(step));

  const nav = el('div', { className: 'acts' });
  if (at > 0) nav.append(el('button', { type: 'button', textContent: 'Back', onclick: () => { at--; render(); } }));
  if (at < steps.length - 1) nav.append(el('button', { type: 'button', textContent: 'Next', onclick: () => { at++; render(); } }));
  box.append(nav);
}

function gated() {
  return role() < ACCESS.configure
    ? el('p', { className: 'note', textContent: 'Setup needs the machine\'s PAIR button: press it, then Ask again.' },
      ' ', el('button', { type: 'button', textContent: 'Ask again', onclick: knock }))
    : null;
}

function networkStep() {
  const ssid = el('input', { id: 'ssid', type: 'text', autocomplete: 'off', spellcheck: false, maxLength: 32 });
  const pass = el('input', { id: 'pass', type: 'password', autocomplete: 'off', maxLength: 64 });
  const out = el('p', { className: 'result', role: 'status' });
  const go = el('button', { type: 'button', className: 'primary', textContent: 'Join' });
  go.addEventListener('click', async () => {
    let values;
    try {
      values = wifiJoinValues(ssid.value, pass.value);
    } catch (e) {
      out.textContent = e.message;
      return;
    }
    pass.value = '';
    go.disabled = true;
    out.textContent = 'Joining... this can take up to ' + Math.round(JOIN_TIMEOUT_MS / 1000) + ' s.';
    let echo = null;
    let err = null;
    try {
      echo = await session.sendIntent(CH_PROVISIONING, values, { timeoutMs: JOIN_TIMEOUT_MS });
    } catch (e) {
      err = e;
    }
    values = null;
    const o = joinOutcome(echo, err);
    out.textContent = o.text;
    if (o.ok && o.address) {
      $('hub-net').textContent = o.address + (o.port ? ', Valence port ' + o.port : '');
      // SPEC §13.1: serving a page is optional, so the link is an offer.
      const url = 'http://' + o.address + (o.port && o.port !== 80 ? ':' + o.port : '') + '/';
      out.append(' ', el('a', { href: url, target: '_blank', rel: 'noopener', textContent: 'Open the machine\'s page, if it serves one' }));
    }
    go.disabled = false;
  });
  return el('div', { className: 'body' },
    gated() || '',
    el('label', { htmlFor: 'ssid', textContent: 'Network name' }), ssid,
    el('label', { htmlFor: 'pass', textContent: 'Passphrase (empty for an open network)' }), pass,
    go, out);
}

function inputFor(f, current) {
  if (f.options) {
    const s = el('select', { id: 'f' + f.key });
    f.options.forEach((o, i) => s.append(el('option', { value: String(i), textContent: o, selected: i === current })));
    return s;
  }
  if (f.type === CBOR_FIELD.bool_t) return el('input', { id: 'f' + f.key, type: 'checkbox', checked: !!current });
  const n = el('input', { id: 'f' + f.key, type: f.secret ? 'password' : (f.type === CBOR_FIELD.tstr_t ? 'text' : 'number'),
    autocomplete: 'off' });
  if (f.min != null) n.min = String(f.min);
  if (f.max != null) n.max = String(f.max);
  n.step = f.step != null ? String(f.step) : 'any';
  if (current != null && !f.secret) n.value = String(current);
  return n;
}

function settingsStep(step) {
  const sample = step.state != null ? reported.get(step.state) : null;
  const inputs = new Map();
  const body = el('div', { className: 'body' }, gated() || '');
  for (const f of step.fields) {
    const current = sample && f.readName ? sample[f.readName] : null;
    const input = inputFor(f, current);
    inputs.set(f.key, input);
    body.append(el('label', { htmlFor: input.id, textContent: f.label + (f.unit ? ' (' + f.unit + ')' : ''),
      title: f.desc }), input);
  }
  const out = el('p', { className: 'result', role: 'status' });
  const apply = el('button', { type: 'button', className: 'primary', textContent: 'Apply' });
  apply.addEventListener('click', async () => {
    const raw = {};
    for (const f of step.fields) {
      const i = inputs.get(f.key);
      const v = i.type === 'checkbox' ? i.checked : i.value;
      if (v === '' || (f.secret && !v)) continue;
      raw[f.key] = v;
      if (f.secret) i.value = '';
    }
    try {
      const values = stepValues(step, raw);
      if (!Object.keys(values).length) { out.textContent = 'Nothing to apply.'; return; }
      apply.disabled = true;
      await session.sendIntent(step.writer, values);
      out.textContent = 'Applied.';
    } catch (e) {
      out.textContent = e.code != null ? 'Refused: ' + e.name + (e.detail ? ' (' + e.detail + ')' : '') + '.' : e.message;
    }
    apply.disabled = false;
  });
  body.append(apply, out);
  return body;
}

// ---- start -------------------------------------------------------------------

if (!window.isSecureContext) {
  $('banner').textContent = 'Open this page over https: browsers allow USB and Bluetooth only there.';
  $('banner').hidden = false;
} else if (!hasSerial && !hasBle) {
  $('banner').textContent = 'This browser has neither Web Serial nor Web Bluetooth. Use Chrome or Edge on a computer, or Chrome on Android for Bluetooth.';
  $('banner').hidden = false;
}
$('usb').disabled = !hasSerial || !window.isSecureContext;
$('ble').disabled = !hasBle || !window.isSecureContext;

$('usb').addEventListener('click', async () => {
  let port;
  try { port = await navigator.serial.requestPort(); } catch (e) { return; } // chooser dismissed
  start(serialSocket(port), 'usb', null);
});

$('ble').addEventListener('click', async () => {
  let device;
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLE_SERVICE] }],
      optionalManufacturerData: [MSD_COMPANY_ID],
    });
  } catch (e) { return; } // chooser dismissed
  status('Reading the advertisement...');
  start(bleSocket(device), 'ble', await readAdvFlags(device));
});
