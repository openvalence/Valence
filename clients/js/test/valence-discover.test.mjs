/**
 * valence-discover.test.mjs -- discover.js, the SPEC §13.8 UDP discovery
 * codec and probe loop, with no hub: registry pins, the golden vectors
 * shared with lib/valence/include/valence/wire/messages/discover.hpp, the
 * reject rules, and discover() against fake responders on the loopback.
 *
 * Run:  node clients/js/test/valence-discover.test.mjs   (exits 1 on any failure)
 */

import dgram from 'node:dgram';
import { readFileSync } from 'node:fs';
import {
  DISCOVERY_PORT, DISCOVERY_MAGIC, DISCOVERY_REPLY_INTERVAL_MS, DISCOVER_PROBE_BYTES, DISCOVER_REPLY_BYTES,
  encodeDiscoverProbe, decodeDiscoverProbe, encodeDiscoverReply, decodeDiscoverReply, discover,
} from '../discover.js';
import * as index from '../index.js';

let failures = 0;
function assert(name, cond, detail) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name + (detail ? '  (' + detail + ')' : ''));
  if (!cond) failures++;
}
const hex = (b) => Buffer.from(b).toString('hex');
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

console.log('discover.js: registry pins');
// `key: value` pairs of the top-level `udp_discovery:` block.
const reg = read('../../../spec/registry/registry.yaml');
const block = /^udp_discovery:\n((?:[ \t]+.*\n)+)/m.exec(reg);
const udp = Object.fromEntries([...(block ? block[1] : '').matchAll(/^\s+(\w+):\s*("?)([^"#\n]*?)\2\s*(?:#.*)?$/gm)]
  .map((m) => [m[1], m[3]]));
assert('registry has the udp_discovery block', block && udp.port && udp.magic && udp.reply_rate_limit_per_source_s, JSON.stringify(udp));
assert('DISCOVERY_PORT matches udp_discovery.port', DISCOVERY_PORT === Number(udp.port), DISCOVERY_PORT + ' vs ' + udp.port);
assert('DISCOVERY_MAGIC matches udp_discovery.magic', DISCOVERY_MAGIC === udp.magic, DISCOVERY_MAGIC + ' vs ' + udp.magic);
assert('DISCOVERY_REPLY_INTERVAL_MS matches the per-source limit',
  DISCOVERY_REPLY_INTERVAL_MS === Number(udp.reply_rate_limit_per_source_s) * 1000, String(DISCOVERY_REPLY_INTERVAL_MS));

const hpp = read('../../../lib/valence/include/valence/wire/messages/discover.hpp');

console.log('discover.js: golden vectors from discover.hpp');
const vector = (name) => {
  const m = new RegExp(name + ' = \\{([^}]*)\\}').exec(hpp);
  return m ? Uint8Array.from(m[1].match(/0x[0-9A-Fa-f]{2}/g), (x) => parseInt(x, 16)) : new Uint8Array(0);
};
const U01 = vector('kU01Probe');
const U02 = vector('kU02Reply');
const U02_IN = {
  nonce: 0xA1A2A3A4, hub_name: 'valence-fixture', hub_instance_id: '0102030405060708', proto_ver: 1,
  ws_port: 82, fw_version: '1.0.0', catalog_etag: '8c5d68f41ad0325e', flags: 1, pairing_window_open: true,
};
assert('U-01 parsed at DISCOVER_PROBE_BYTES', U01.length === DISCOVER_PROBE_BYTES, String(U01.length));
assert('U-02 parsed at DISCOVER_REPLY_BYTES', U02.length === DISCOVER_REPLY_BYTES, String(U02.length));
assert('U-01: encodeDiscoverProbe is byte-identical to the C++ vector', hex(encodeDiscoverProbe(0xA1A2A3A4, 1)) === hex(U01), hex(encodeDiscoverProbe(0xA1A2A3A4, 1)));
assert('U-01: decodeDiscoverProbe reads it back', JSON.stringify(decodeDiscoverProbe(U01)) === JSON.stringify({ proto_ver: 1, nonce: 0xA1A2A3A4 }));
assert('U-02: encodeDiscoverReply is byte-identical to the C++ vector', hex(encodeDiscoverReply(U02_IN)) === hex(U02), hex(encodeDiscoverReply(U02_IN)));
assert('U-02: decodeDiscoverReply reads every field', JSON.stringify(decodeDiscoverReply(U02)) === JSON.stringify(U02_IN), JSON.stringify(decodeDiscoverReply(U02)));

console.log('discover.js: rejects and edge values');
const bad = U02.slice();
bad[3] = 0x58;
assert('U-03: short, long and wrong-magic probes are not probes',
  decodeDiscoverProbe(U01.subarray(0, 8)) === null && decodeDiscoverProbe(Uint8Array.from([...U01, 0])) === null
  && decodeDiscoverProbe(Uint8Array.from(U01, (x, i) => (i === 0 ? 0 : x))) === null);
assert('a reply of 75 or 77 bytes, or a foreign magic, is not a reply',
  decodeDiscoverReply(U02.subarray(0, 75)) === null && decodeDiscoverReply(Uint8Array.from([...U02, 0])) === null && decodeDiscoverReply(bad) === null);
assert('a probe is not a reply and a reply is not a probe', decodeDiscoverReply(U01) === null && decodeDiscoverProbe(U02) === null);
const top = decodeDiscoverReply(encodeDiscoverReply({ hub_instance_id: 'ffffffffffffffff' }));
assert('a u64 id with the top bit set survives (no float rounding)', top.hub_instance_id === 'ffffffffffffffff', top.hub_instance_id);
assert('id 0 reads as no durable identity', decodeDiscoverReply(encodeDiscoverReply({})).hub_instance_id === null);
const long = decodeDiscoverReply(encodeDiscoverReply({ hub_name: 'x'.repeat(40), fw_version: '0123456789abcdefXYZ' }));
assert('strings truncate byte-wise to str32 and str16', long.hub_name === 'x'.repeat(32) && long.fw_version === '0123456789abcdef',
  long.hub_name.length + ' / ' + long.fw_version);
assert('index.js exports the discovery surface', ['discover', 'encodeDiscoverProbe', 'decodeDiscoverReply', 'DISCOVERY_PORT'].every((k) => k in index));

console.log('discover(): fake responders on the loopback');
// Answers every probe with: hub A twice (the dedupe case), hub B with no
// durable id, a reply to someone else's nonce, and a datagram that is not a
// reply at all. Only A once and B may come back.
const fake = dgram.createSocket('udp4');
const probes = [];
fake.on('message', (msg, rinfo) => {
  const p = decodeDiscoverProbe(msg);
  if (!p) return;
  probes.push(p);
  const to = (b) => fake.send(b, rinfo.port, rinfo.address);
  to(encodeDiscoverReply({ nonce: p.nonce, hub_name: 'hub A', hub_instance_id: '00000000000000aa', ws_port: 82 }));
  to(encodeDiscoverReply({ nonce: p.nonce, hub_name: 'hub A again', hub_instance_id: '00000000000000aa', ws_port: 82 }));
  to(encodeDiscoverReply({ nonce: p.nonce, hub_name: 'hub B', ws_port: 8282 }));
  to(encodeDiscoverReply({ nonce: (p.nonce + 1) >>> 0, hub_name: 'not for us', hub_instance_id: '00000000000000cc' }));
  to(Buffer.from('VLNC garbage'));
});
await new Promise((r) => fake.bind(0, '127.0.0.1', r));
const t0 = Date.now();
const hubs = await discover({ createSocket: dgram.createSocket, address: '127.0.0.1', port: fake.address().port,
  timeoutMs: 400, nonce: 0x12345678 });
const took = Date.now() - t0;
fake.close();
assert('the probe carried our nonce and proto_ver', probes.length >= 1 && probes[0].nonce === 0x12345678 && probes[0].proto_ver === 1,
  JSON.stringify(probes[0]));
assert('one entry per hub, first reply wins, foreign nonce and garbage dropped',
  hubs.map((h) => h.hub_name).join(',') === 'hub A,hub B', hubs.map((h) => h.hub_name).join(','));
assert('each hub carries the replying address', hubs.every((h) => h.ip === '127.0.0.1'));
assert('the endpoint-keyed hub keeps its own port', hubs[1] && hubs[1].hub_instance_id === null && hubs[1].ws_port === 8282);
assert('the scan ends on its timeout', took >= 380 && took < 1500, took + ' ms');
let threw = null;
try { await discover({}); } catch (e) { threw = e; }
assert('discover() without a socket factory rejects', threw instanceof TypeError);

console.log(failures ? '\n' + failures + ' FAILURE(S)' : '\nall passed');
process.exit(failures ? 1 : 0);
