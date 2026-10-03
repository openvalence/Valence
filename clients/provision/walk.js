/**
 * walk.js -- the setup walk (RFC-079): the catalog's `setup` category as
 * wizard steps (RENDERING §10), and the wifi_join form (SPEC §13.9). Pure: the
 * page and the node suite share it.
 *
 * Constraints:
 * - Never a channel found by name (RENDERING §13 law 6). Steps come from
 *   `category`; the network step from core id 0x000F, which is how SPEC §13.9
 *   says a first-run client binds it.
 * - One step per setup entry, in catalog (authoring) order (SPEC §8.9 item 4).
 *   A STATE entry writes through its `setting_channel`: its fields are the
 *   layout fields carrying a `setting_key` that the writer's schema declares.
 *   An INTENT entry writes its own schema. A step with nothing writable is no
 *   step.
 * - A field shows the hub's reported value (STATE), never the request (SPEC
 *   §1.2 ground truth); the write's ECHO is what moves it.
 * - Secret fields are never stored, logged or echoed back into a form.
 */

import {
  CORE_CHANNEL, UI_CATEGORY, CHANNEL_CLASS, PROVISIONING_OP, NACK, SETTING_FLAG, LIMITS,
} from '../js/generated/registry_vocab.js';
import { CBOR_FIELD } from '../js/frames.js';

export const CH_PROVISIONING = CORE_CHANNEL.provisioning;

// The 0x000F schema keys (registry.yaml core_channels 0x000F).
const KEY = { op: 1, ssid: 2, passphrase: 3, ipv4: 4, wsPort: 5 };


/** A catalog name as a label: "max_rail" -> "Max rail". */
export function labelOf(name) {
  const s = String(name || '').replace(/[_-]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function fieldOf(layout, schema) {
  const src = schema || layout;
  const flags = src.flags ?? layout?.flags ?? 0;
  return {
    key: schema.key,
    name: schema.name,
    label: labelOf(layout ? layout.name : schema.name),
    desc: src.desc || layout?.desc || '',
    type: schema.type,
    unit: schema.unit || layout?.unit || '',
    min: schema.min ?? layout?.min,
    max: schema.max ?? layout?.max,
    step: schema.step ?? layout?.step,
    options: schema.options || layout?.options || null,
    secret: (flags & SETTING_FLAG.secret) !== 0,
    readName: layout ? layout.name : null,
  };
}

/**
 * The setup category as steps, in catalog order.
 * @param {Array<Object>} entries decoded catalog entries (catalog.js)
 * @returns {Array<{id:number, kind:'network'|'settings', title:string,
 *   state:number|null, writer:number, fields:Array<Object>}>}
 */
export function setupSteps(entries) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const steps = [];
  for (const e of entries) {
    if (e.category !== UI_CATEGORY.setup) continue;
    if (e.id === CH_PROVISIONING) {
      if (e.cls === CHANNEL_CLASS.INTENT) {
        steps.push({ id: e.id, kind: 'network', title: 'Network', state: null, writer: e.id, fields: [] });
      }
      continue;
    }
    if (e.cls === CHANNEL_CLASS.STATE && e.settingChannel != null && e.layout) {
      const writer = byId.get(e.settingChannel);
      const schema = new Map((writer && writer.schema ? writer.schema : []).map((f) => [f.key, f]));
      const fields = e.layout.filter((f) => f.settingKey != null && schema.has(f.settingKey))
        .map((f) => fieldOf(f, schema.get(f.settingKey)));
      if (fields.length) {
        steps.push({ id: e.id, kind: 'settings', title: labelOf(e.categoryLabel || e.name), state: e.id,
          writer: e.settingChannel, fields });
      }
    } else if (e.cls === CHANNEL_CLASS.INTENT && e.schema && e.schema.length) {
      steps.push({ id: e.id, kind: 'settings', title: labelOf(e.name), state: null, writer: e.id,
        fields: e.schema.map((f) => fieldOf(null, f)) });
    }
  }
  return steps;
}

/**
 * Typed intent values for one step from raw form strings; only the keys the
 * user changed. Throws on a value the field cannot hold.
 * @param {Object} step a setupSteps() step
 * @param {Object<number, string|boolean>} raw form values by field key
 * @returns {Object<number, number|boolean|string>}
 */
export function stepValues(step, raw) {
  const out = {};
  for (const f of step.fields) {
    if (!(f.key in raw)) continue;
    const v = raw[f.key];
    switch (f.type) {
      case CBOR_FIELD.bool_t: out[f.key] = !!v; break;
      case CBOR_FIELD.tstr_t: out[f.key] = String(v); break;
      case CBOR_FIELD.uint_t:
      case CBOR_FIELD.int_t: {
        const n = Number(v);
        if (!Number.isInteger(n) || (f.type === CBOR_FIELD.uint_t && n < 0)) throw new Error(f.label + ': a whole number');
        out[f.key] = n;
        break;
      }
      case CBOR_FIELD.f32_t: {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(f.label + ': a number');
        out[f.key] = n;
        break;
      }
      default: throw new Error(f.label + ': this page cannot write that type');
    }
  }
  return out;
}

const utf8 = (s) => new TextEncoder().encode(s).length;

/**
 * The wifi_join value map, checked the way the hub checks it (SPEC §13.9:
 * SSID 1..32 octets; passphrase empty, 8..63 printable, or 64 hex digits).
 * Throws with a short reason on a refusal-to-be.
 */
export function wifiJoinValues(ssid, passphrase) {
  const s = String(ssid ?? '');
  const p = String(passphrase ?? '');
  if (utf8(s) < 1 || utf8(s) > 32) throw new Error('Network name: 1 to 32 bytes');
  const hex = p.length === 64 && /^[0-9a-fA-F]+$/.test(p);
  const ascii = /^[\x20-\x7e]*$/.test(p);
  if (p.length && !hex && (!ascii || p.length < 8 || p.length > 63)) {
    throw new Error('Passphrase: 8 to 63 characters, or none for an open network');
  }
  return { [KEY.op]: PROVISIONING_OP.wifi_join, [KEY.ssid]: s, [KEY.passphrase]: p };
}

/** How long a join may take to answer: the hub's own bound plus slack. */
export const JOIN_TIMEOUT_MS = LIMITS.provision_join_timeout_ms + 5000;

/** 0xC0A80132 -> "192.168.1.50" (cbor_keys 47's packing). */
export function ipv4Text(v) {
  return [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');
}

/**
 * The join's outcome as one line for the page.
 * @param {{applied:Object}|null} echo the resolved sendIntent value
 * @param {Error & {code?:number, detail?:string}|null} err the rejection
 */
export function joinOutcome(echo, err) {
  if (echo) {
    const ip = echo.applied[KEY.ipv4];
    const port = echo.applied[KEY.wsPort];
    return { ok: true, address: ip ? ipv4Text(ip) : null, port: port || null,
      text: ip ? 'Joined: ' + ipv4Text(ip) + (port ? ', Valence port ' + port : '') : 'Joined' };
  }
  const code = err && err.code;
  const detail = err && err.detail ? ' (' + err.detail + ')' : '';
  switch (code) {
    case NACK.NETWORK_JOIN_FAILED: return { ok: false, text: 'Did not join' + detail + '. The machine kept its network.' };
    case NACK.ACCESS_DENIED: return { ok: false, text: 'Press PAIR on the machine, then Join again.' };
    case NACK.BUSY: return { ok: false, text: 'A join is already running.' };
    case NACK.NOT_READY: return { ok: false, text: 'Still syncing; try again.' };
    case NACK.UNKNOWN_CHANNEL: return { ok: false, text: 'This machine takes no network setup.' };
    case NACK.INVALID_VALUE: return { ok: false, text: 'Refused' + detail + '.' };
    default: return { ok: false, text: (err && err.message) || 'No answer.' };
  }
}
