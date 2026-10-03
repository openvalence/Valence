/**
 * link.js -- the two byte pipes this page speaks Valence over, each shaped as
 * the WebSocket subset createSession drives (its WebSocketImpl seam), so the
 * session code is the JS client's own and nothing here knows the protocol.
 *
 * Constraints:
 * - Serial is SPEC §13.5: COBS, delimiter 0x00. A frame leaves as
 *   0x00 + COBS(frame) + 0x00. Inbound, a chunk that is not exactly one frame
 *   is dropped: a hub's console text may share the pipe (Nucleus logs on the
 *   same USB-Serial/JTAG CDC).
 * - BLE GATT is SPEC §13.4: one characteristic value is one frame each way.
 * - Writes chain on one promise so frame order holds (HELLO before INTENT).
 * - The serial port drops RTS before DTR. On an ESP USB-Serial/JTAG port, DTR
 *   low with RTS high resets the chip, and a reset leaves config mode
 *   (SPEC §13.4.1).
 * - The BLE identity is registry.yaml `ble_identity`, transcribed because the
 *   codegen emits no JS for it; test/provision.test.mjs checks it against the
 *   registry.
 */

import { HEADER_BYTES } from '../js/generated/registry_vocab.js';

export const BLE_SERVICE = '56414c45-4e43-4531-8000-000000000001';
export const BLE_WRITE = '56414c45-4e43-4531-8000-000000000002';
export const BLE_NOTIFY = '56414c45-4e43-4531-8000-000000000003';
export const MSD_COMPANY_ID = 0xffff;

const ESTOP_BYTES = 12;
const MAX_FRAME = 512;
// The longest COBS body one MAX_FRAME frame encodes to (lib serial_cobs.hpp).
const MAX_CHUNK = MAX_FRAME + Math.floor(MAX_FRAME / 254) + 1;

/** COBS-encode `src` (no delimiters), byte-identical to the C++ library. */
export function cobsEncode(src) {
  const out = new Uint8Array(src.length + Math.floor(src.length / 254) + 1);
  let w = 1;
  let codeAt = 0;
  let code = 1;
  let owed = true; // a final code byte is owed unless a full run just closed
  for (let i = 0; i < src.length; i++) {
    if (src[i] === 0) {
      out[codeAt] = code;
      owed = true;
      code = 1;
      codeAt = w++;
    } else {
      out[w++] = src[i];
      if (++code === 0xff) {
        out[codeAt] = code;
        owed = false;
        code = 1;
        codeAt = w++;
      }
    }
  }
  if (owed || code !== 1) out[codeAt] = code;
  else w--;
  return out.slice(0, w);
}

/** COBS-decode one chunk (delimiters stripped); null when malformed. */
export function cobsDecode(src) {
  const out = new Uint8Array(src.length);
  let r = 0;
  let w = 0;
  while (r < src.length) {
    const code = src[r++];
    if (code === 0) return null;
    for (let i = 1; i < code; i++) {
      if (r >= src.length) return null;
      out[w++] = src[r++];
    }
    if (code !== 0xff && r < src.length) out[w++] = 0;
  }
  return out.slice(0, w);
}

/** One frame as it goes on the serial wire. */
export function serialFrame(frame) {
  const body = cobsEncode(frame);
  const out = new Uint8Array(body.length + 2);
  out.set(body, 1);
  return out;
}

/** A whole frame: a 12-byte ESTOP, or a header whose len covers the rest. */
export function frameShaped(f) {
  if (f.length === ESTOP_BYTES && f[0] === 0xe5 && f[1] === 0xe5 && f[2] === 0xe5 && f[3] === 0xe5) return true;
  return f.length >= HEADER_BYTES && (f[6] | (f[7] << 8)) === f.length - HEADER_BYTES;
}

/** The serial receiver: bytes in, whole frames out, everything else counted. */
export class Deframer {
  constructor() {
    this.buf = new Uint8Array(MAX_CHUNK);
    this.len = 0;
    this.over = false;
    this.dropped = 0;
  }

  push(bytes) {
    const frames = [];
    for (const b of bytes) {
      if (b === 0) {
        this.end(frames);
        continue;
      }
      if (this.len === MAX_CHUNK) {
        this.over = true;
        this.len = 0;
      }
      this.buf[this.len++] = b;
    }
    return frames;
  }

  end(frames) {
    const n = this.len;
    const over = this.over;
    this.len = 0;
    this.over = false;
    if (n === 0 && !over) return; // a frame's leading delimiter after the last one's trailing one
    const f = over ? null : cobsDecode(this.buf.subarray(0, n));
    if (f && frameShaped(f)) frames.push(f);
    else this.dropped++;
  }
}

const asBytes = (buf) =>
  buf instanceof ArrayBuffer ? new Uint8Array(buf)
    : ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      : null;

/** The common half of both ducks: state, events, ordered writes, one close. */
class Duck {
  constructor() {
    this.binaryType = 'arraybuffer';
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this._q = Promise.resolve();
  }

  _opened() {
    this.readyState = 1;
    if (this.onopen) this.onopen();
  }

  _deliver(frame) {
    if (this.readyState === 1 && this.onmessage) this.onmessage({ data: frame.slice().buffer });
  }

  _closed(code, reason) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    if (this.onclose) this.onclose({ code, reason });
  }

  _fail(e) {
    if (this.readyState === 3) return;
    if (this.onerror) this.onerror(e);
    this._teardown();
    this._closed(1006, String(e && e.message ? e.message : e));
  }

  send(buf) {
    const bytes = asBytes(buf);
    if (this.readyState !== 1) return;
    if (!bytes) {
      this._fail(new Error('link: non-binary send'));
      return;
    }
    const copy = bytes.slice();
    this._q = this._q.then(() => this._write(copy)).catch((e) => this._fail(e));
  }

  close() {
    if (this.readyState >= 2) return;
    this.readyState = 2;
    this._q.finally(() => this._teardown()).then(() => this._closed(1000, 'client close'));
  }
}

/**
 * A WebSocket duck over a Web Serial port (SPEC §13.5). The port is opened
 * here if it is not already; closing the duck closes the port.
 */
export function serialSocket(port) {
  return class SerialSocket extends Duck {
    constructor() {
      super();
      this._reader = null;
      this._writer = null;
      this._open().catch((e) => this._fail(e));
    }

    async _open() {
      if (!port.readable) await port.open({ baudRate: 115200 });
      await port.setSignals({ requestToSend: false });
      await port.setSignals({ dataTerminalReady: false });
      this._writer = port.writable.getWriter();
      this._opened();
      this._pump();
    }

    async _pump() {
      const deframer = new Deframer();
      this._reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this._reader.read();
          if (done) break;
          for (const f of deframer.push(value)) this._deliver(f);
        }
      } catch (e) {
        // the port went away; the close below says so
      }
      if (this.readyState >= 2) return; // close() ends the read and reports itself
      this._teardown();
      this._closed(1006, 'serial link lost');
    }

    _write(bytes) {
      return this._writer.write(serialFrame(bytes));
    }

    async _teardown() {
      const reader = this._reader;
      const writer = this._writer;
      this._reader = null;
      this._writer = null;
      try { if (reader) { await reader.cancel(); reader.releaseLock(); } } catch (e) { /* already released */ }
      try { if (writer) writer.releaseLock(); } catch (e) { /* already released */ }
      try { if (port.readable || port.writable) await port.close(); } catch (e) { /* already closed */ }
    }
  };
}

/**
 * A WebSocket duck over a Web Bluetooth device carrying the Valence GATT
 * service (SPEC §13.4).
 */
export function bleSocket(device) {
  return class BleSocket extends Duck {
    constructor() {
      super();
      this._tx = null;
      this._rx = null;
      this._onValue = (ev) => {
        const v = ev.target.value;
        this._deliver(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
      };
      this._onDrop = () => { if (this.readyState < 2) this._closed(1006, 'ble link lost'); };
      this._open().catch((e) => this._fail(e));
    }

    async _open() {
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE);
      this._tx = await service.getCharacteristic(BLE_WRITE);
      this._rx = await service.getCharacteristic(BLE_NOTIFY);
      this._rx.addEventListener('characteristicvaluechanged', this._onValue);
      await this._rx.startNotifications();
      device.addEventListener('gattserverdisconnected', this._onDrop);
      this._opened();
    }

    _write(bytes) {
      return this._tx.writeValueWithoutResponse ? this._tx.writeValueWithoutResponse(bytes)
        : this._tx.writeValue(bytes);
    }

    async _teardown() {
      device.removeEventListener('gattserverdisconnected', this._onDrop);
      if (this._rx) this._rx.removeEventListener('characteristicvaluechanged', this._onValue);
      try { if (device.gatt.connected) device.gatt.disconnect(); } catch (e) { /* already gone */ }
    }
  };
}

/**
 * The advertisement's `ble_adv_flags` byte (SPEC §13.4, scan response,
 * company 0xFFFF), or null when this browser cannot watch advertisements
 * (Chrome ships watchAdvertisements behind a flag) or none came in `ms`.
 */
export function readAdvFlags(device, ms = 3000) {
  if (typeof device.watchAdvertisements !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      device.removeEventListener('advertisementreceived', onAdv);
      resolve(v);
    };
    const onAdv = (ev) => {
      const d = ev.manufacturerData && ev.manufacturerData.get(MSD_COMPANY_ID);
      if (d && d.byteLength >= 1) finish(d.getUint8(0));
    };
    const timer = setTimeout(() => finish(null), ms);
    device.addEventListener('advertisementreceived', onAdv);
    device.watchAdvertisements().catch(() => finish(null));
  });
}
