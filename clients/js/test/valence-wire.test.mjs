/**
 * valence-wire.test.mjs — golden-byte + round-trip test for valence-js.
 *
 * Golden hex is lifted verbatim from clients/mfp/WireSelfTest.cs, whose
 * expected values are themselves derived by RUNNING tools/valence_probe.py's
 * builders (the live-verified reference). If valence-js produces byte-identical
 * output, it is on the same wire as the probe and the C# plugin.
 *
 * Run:  node clients/js/test/valence-wire.test.mjs   (exits 1 on any failure)
 *
 * The HELLO below is rebuilt from cbor.js primitives to match the C# golden;
 * the session's own publish-wish HELLO is checked byte-exact against the C++
 * encoder in valence-publish.test.mjs. SUBSCRIBE / GOODBYE / PING / CLOCK use
 * the real builders.
 */

import { readFileSync, existsSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  cbUint, cbF32, cbTstr, cbBstr, cbBool, cbInt, cbNull, cbArray, cbMap,
  cbDecodeFull, concatBytes,
} from '../cbor.js';
import {
  K, PRIORITY, FRAME, ACCESS, PACKED, PACKED_SIZE, GOODBYE_CODE, NACK,
  SAFETY_OP, SAFETY_OP_ROLE_EXEMPT, SAFETY_EVENT_KIND, BLOB_NS, CH_SAFETY, LIMITS,
  UI_CATEGORY, UI_RANK, VALUE_ASPECT, VALUE_SCOPE, VALUE_PROVENANCE, UNIT_ID,
  UI_NAV_TIER, UI_CATEGORY_TIER, UI_NAV_TIER_CATEGORIES, SOURCE_KIND, SOURCE_KIND_NAME,
  encodeFrame, encodeEstopFrame, crc32, ESTOP_FRAME_BYTES,
} from '../frames.js';
import {
  buildBlobReq, buildCatalogRequest, buildCatalogRepair,
  parseBlobChunk, BlobReassembler, BLOB_CHUNK_HEADER_BYTES,
  decodeCatalog, catalogChannelMap, decodePacked, decodeEventBody,
  schemaByKey, optionAccessFor, canUseOption, storeItemDigestOk, decodeControlOwner,
} from '../catalog.js';
import { sha256, catalogEtag, toHex, bytesEqual } from '../sha256.js';

let failures = 0;

function hex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function check(name, actual, expectedHex) {
  const got = hex(actual);
  const want = expectedHex.replace(/\s+/g, '').toUpperCase();
  const ok = got === want;
  console.log('  [' + (ok ? 'PASS' : 'FAIL') + '] ' + name);
  if (!ok) {
    console.log('        expected: ' + want);
    console.log('        actual:   ' + got);
    failures++;
  }
}
function assert(name, cond) {
  console.log('  [' + (cond ? 'PASS' : 'FAIL') + '] ' + name);
  if (!cond) failures++;
}

console.log('valence-js wire self-test (golden bytes from WireSelfTest.cs / valence_probe.py):');

const inst = Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7);

// ---- HELLO (with publish wish) — CBOR codec proof --------------------------
// keys ascending 1<2<3<4<11; publishes array element {12:rate, 15:channel}.
function buildHelloWithPublish(kind, name, instanceId, ch, rate) {
  return cbMap([
    [K.proto_ver, cbUint(1)],
    [K.client_kind, cbTstr(kind)],
    [K.client_name, cbTstr(name)],
    [K.instance_id, cbBstr(instanceId)],
    [K.publishes, cbArray([cbMap([[K.rate_hz, cbF32(rate)], [K.channel_id, cbUint(ch)]])])],
  ]);
}
// RFC-047 (Phase C2): the probe wishes for motion-input, now 0x2100 (was
// 0x0084) — golden bytes cross-checked byte-for-byte against
// clients/mfp/WireSelfTest.cs's own regenerated golden (same
// payload string), which is itself derived by running valence_probe.py's
// builders. 0x2100 needs CBOR's 2-byte uint form (0x19 0x21 0x00) where
// 0x0084 fit in the 1-byte form (0x18 0x84) — the payload grows 1 byte.
const hello = buildHelloWithPublish('probe', 'valence_probe.py', inst, 0x2100, 100.0);
check('HELLO payload (CBOR)', hello,
  'A50101026570726F6265037076616C656E63655F70726F62652E7079044800010203040506070B81A20CFA42C800000F192100');
check('HELLO frame', encodeFrame(FRAME.HELLO, 0, hello, 0),
  '0000000000003300A50101026570726F6265037076616C656E63655F70726F62652E7079044800010203040506070B81A20CFA42C800000F192100');

// ---- SUBSCRIBE — the real browser builder ----------------------------------
// {10:[{12:rate,13:prio,15:channel}]} keys ascending 12<13<15.
function buildSubscribe(wishes) {
  const entries = wishes.map(([ch, rate, prio]) =>
    cbMap([[K.rate_hz, cbF32(rate)], [K.priority, cbUint(prio)], [K.channel_id, cbUint(ch)]]));
  return cbMap([[K.subscriptions, cbArray(entries)]]);
}
// RFC-047 (Phase C2): motion is now 0x1100 (was 0x0080) -- CBOR needs its
// 3-byte uint form (0x19 0x11 0x00) where 0x0080 fit the 2-byte form
// (0x18 0x80).
const sub = buildSubscribe([[0x0003, 0.0, PRIORITY.critical], [0x1100, 20.0, PRIORITY.elevated]]);
check('SUBSCRIBE payload (CBOR)', sub, 'A10A82A30CFA000000000D030F03A30CFA41A000000D020F191100');

// ---- GOODBYE (NORMAL_CLOSURE 0x0107) ---------------------------------------
// RFC-022.2: GOODBYE has NO code space of its own — its codes are DRAWN FROM
// nack_codes, which is why GOODBYE_CODE is an alias table and not new numbers.
// (Two clients had independently hand-written this literal before it existed.)
check('GOODBYE payload (CBOR)', cbMap([[K.code, cbUint(GOODBYE_CODE.NORMAL_CLOSURE)]]), 'A110190107');
assert('GOODBYE_CODE.NORMAL_CLOSURE is nack_codes 0x0107', GOODBYE_CODE.NORMAL_CLOSURE === NACK.NORMAL_CLOSURE);
assert('v1.0 NACK codes present (REBOOTING/READY_TIMEOUT/NOT_READY)',
  NACK.REBOOTING === 0x0109 && NACK.READY_TIMEOUT === 0x010a && NACK.NOT_READY === 0x010b);

// ---- CLOCK request (raw u32 LE) --------------------------------------------
const clk = new Uint8Array(4);
new DataView(clk.buffer).setUint32(0, 0x11223344, true);
check('CLOCK request (raw u32 LE)', clk, '44332211');

// ---- PING frame (raw, empty payload; §6.5) ---------------------------------
check('PING frame (raw, empty)', encodeFrame(FRAME.PING, 0, new Uint8Array(0), 0), '0300000000000000');

// ---- STREAM bundle payload (packed, §5.4) — proves the packed layout -------
// [t_base:u32 LE][n:u8][rsv:u8][off:u16 LE]  then {target u16 ×10000, vel i16 ×1000}
function buildStreamBundle(tBase, samples) {
  const n = samples.length;
  const buf = new Uint8Array(6 + n * 2 + n * 4);
  const dv = new DataView(buf.buffer);
  let p = 0;
  dv.setUint32(p, tBase, true); p += 4;
  dv.setUint8(p++, n); dv.setUint8(p++, 0);
  for (const [off] of samples) { dv.setUint16(p, off, true); p += 2; }
  for (const [, target, vel] of samples) {
    dv.setUint16(p, Math.max(0, Math.min(65535, Math.round(target * 10000))), true); p += 2;
    dv.setInt16(p, Math.max(-32768, Math.min(32767, Math.round(vel * 1000))), true); p += 2;
  }
  return buf;
}
check('STREAM bundle payload (packed)', buildStreamBundle(0x00010203, [[0, 0.5, 1.7592918]]),
  '03020100010000008813DF06');

// ---- CBOR round-trip (encode → decode → compare) ---------------------------
const roundtrip = cbMap([
  [1, cbUint(1)],
  [6, cbUint(0xdeadbeef)],       // u32 session-id-scale value
  [9, cbInt(-42)],               // negative int
  [12, cbF32(100.0)],            // f32
  [16, cbBool(true)],
  [17, cbTstr('valence.v1')],
  [19, cbBstr(Uint8Array.of(0x21, 0xcb, 0x26, 0xc9))], // etag-like bstr
  [20, cbArray([cbUint(3), cbBool(false), cbNull()])],
  [22, cbMap([[1, cbUint(242)], [2, cbUint(64)]])],     // nested map (welcome-limits shape)
]);
const dec = cbDecodeFull(roundtrip);
assert('round-trip: is a Map', dec instanceof Map);
assert('round-trip: uint key 1', dec.get(1) === 1);
assert('round-trip: u32 key 6', dec.get(6) === 0xdeadbeef);
assert('round-trip: negative int key 9', dec.get(9) === -42);
assert('round-trip: f32 key 12 ≈ 100', Math.abs(dec.get(12) - 100.0) < 1e-4);
assert('round-trip: bool key 16', dec.get(16) === true);
assert('round-trip: tstr key 17', dec.get(17) === 'valence.v1');
assert('round-trip: bstr key 19', hex(dec.get(19)) === '21CB26C9');
assert('round-trip: array key 20 [3,false,null]',
  Array.isArray(dec.get(20)) && dec.get(20)[0] === 3 && dec.get(20)[1] === false && dec.get(20)[2] === null);
assert('round-trip: nested map key 22', dec.get(22) instanceof Map && dec.get(22).get(1) === 242 && dec.get(22).get(2) === 64);

// f32 exact round-trip through the wire
const f = cbDecodeFull(cbF32(1.7592918));
assert('round-trip: f32 1.7592918 (within f32 eps)', Math.abs(f - 1.7592918) < 1e-6);

// map ascending-key guard fires
let guardFired = false;
try { cbMap([[2, cbUint(0)], [1, cbUint(0)]]); } catch (e) { guardFired = true; }
assert('cbMap enforces ascending keys (§5.3)', guardFired);

// concatBytes sanity
assert('concatBytes joins', hex(concatBytes([Uint8Array.of(0xaa), Uint8Array.of(0xbb, 0xcc)])) === 'AABBCC');

// ============================================================================
// v1.0 wire additions (M5c)
// ============================================================================
console.log('');
console.log('v1.0 framing (BLOB transfer, readiness gate, estop, packed strings):');

// ---- Frame numbers ---------------------------------------------------------
assert('new frame types (PUBLISH/CATALOG_READY/BLOB_REQ/BLOB_CHUNK/AUTH/HUB_SIG)',
  FRAME.PUBLISH === 0x18 && FRAME.CATALOG_READY === 0x19 && FRAME.BLOB_REQ === 0x1a &&
  FRAME.BLOB_CHUNK === 0x1b && FRAME.AUTH === 0x1c && FRAME.HUB_SIG === 0x1d);
assert('CATALOG_REQ/CATALOG_CHUNK are RETIRED (absent, never reused)',
  FRAME.CATALOG_REQ === undefined && FRAME.CATALOG_CHUNK === undefined);
// registry safety_intent_ops (RFC-085): three pairs; 2/3/9/10 retired as gaps.
assert('safety_intent_ops: release 1, pause 4, resume 5, estop 6, override 7, return_op 8',
  SAFETY_OP.release === 1 && SAFETY_OP.pause === 4 && SAFETY_OP.resume === 5 &&
  SAFETY_OP.estop === 6 && SAFETY_OP.override === 7 && SAFETY_OP.return_op === 8);
assert('safety_intent_ops: retired stop/hold/bypass and the old pair names are absent',
  ['stop', 'hold', 'bypass_on', 'bypass_off', 'override_on', 'override_off', 'estop_clear']
    .every((n) => SAFETY_OP[n] === undefined) &&
  [2, 3, 9, 10].every((v) => !Object.values(SAFETY_OP).includes(v)));
assert('role-exempt safety ops are exactly pause and estop',
  SAFETY_OP_ROLE_EXEMPT.size === 2 && SAFETY_OP_ROLE_EXEMPT.has(SAFETY_OP.pause) &&
  SAFETY_OP_ROLE_EXEMPT.has(SAFETY_OP.estop));
assert('safety_event_kinds: pause_latched 3, pause_cleared 4 (RFC-085)',
  SAFETY_EVENT_KIND.pause_latched === 3 && SAFETY_EVENT_KIND.pause_cleared === 4 &&
  SAFETY_EVENT_KIND.stop_latched === undefined);
assert('access tiers renamed, wire values unchanged (watch0/control1/configure2)',
  ACCESS.watch === 0 && ACCESS.control === 1 && ACCESS.configure === 2);

// ---- u64 integers (rfc-0oj): exact both ways, never a rounded Number -------
const U64 = 0x5e95c1a7d3b2f00dn; // past 2^53: a Number would drop its low bits
check('cbUint(BigInt u64) -> 8-byte head', cbUint(U64), '1B5E95C1A7D3B2F00D');
assert('8-byte uint decodes to the exact BigInt', cbDecodeFull(cbUint(U64)) === U64);
assert('u64 max round-trips', cbDecodeFull(cbUint(0xffffffffffffffffn)) === 0xffffffffffffffffn);
check('a small BigInt still encodes shortest form', cbUint(1000n), '1903E8');
assert('a <= u32 value decodes to a Number, as before', cbDecodeFull(cbUint(0xffffffff)) === 0xffffffff);
assert('a non-shortest 8-byte small value decodes to a Number',
  cbDecodeFull(Uint8Array.of(0x1b, 0, 0, 0, 0, 0, 0, 0, 7)) === 7);
check('cbInt(negative BigInt past -2^32)', cbInt(-0x100000001n), '3B0000000100000000');
assert('negative 8-byte int decodes to the exact BigInt', cbDecodeFull(cbInt(-0x100000001n)) === -0x100000001n);
assert('a Number past 2^53 is refused on encode, never guessed',
  (() => { try { cbUint(2 ** 60); return false; } catch (e) { return e instanceof RangeError; } })());
check('a safe Number past u32 still encodes exactly', cbUint(2 ** 40), '1B0000010000000000');
assert('an 8-byte string length is rejected, not allocated',
  (() => { try { cbDecodeFull(Uint8Array.of(0x5b, 0, 0, 0, 1, 0, 0, 0, 0)); return false; } catch (e) { return true; } })());

// ---- BLOB_REQ (0x1A) — the ONE transfer verb -------------------------------
// A bare catalog request is the EMPTY map: namespace 0 is the default and
// store_id/slot are absent by rule, so generalizing transfer cost the common
// case exactly zero bytes (blob_req.hpp's own worked example).
check('BLOB_REQ full catalog (empty map)', buildCatalogRequest(), 'A0');
check('BLOB_REQ catalog repair {27:[4,9]}', buildCatalogRepair([4, 9]), 'A1181B820409');
// {38: {1:1, 2:3, 3:7}} -> full transfer of store 3, slot 7
check('BLOB_REQ store 3 slot 7 {38:{1:1,2:3,3:7}}',
  buildBlobReq({ ns: BLOB_NS.store, storeId: 3, slot: 7 }), 'A11826A3010102030307');
// {27:[4,9], 38:{...}} -> repair of that item; keys ascending 27 < 38
check('BLOB_REQ store repair {27:[4,9],38:{1:1,2:3,3:7}}',
  buildBlobReq({ ns: BLOB_NS.store, storeId: 3, slot: 7, chunks: [4, 9] }),
  'A2181B8204091826A3010102030307');
let blobGuard = 0;
try { buildBlobReq({ chunks: [] }); } catch (e) { blobGuard++; }           // RFC-022.6
try { buildBlobReq({ storeId: 1 }); } catch (e) { blobGuard++; }            // catalog ns takes no store
assert('BLOB_REQ refuses an empty repair and a catalog-ns store_id', blobGuard === 2);

// ---- BLOB_CHUNK (0x1B) — 14-byte binary identity header --------------------
// ns|store_id|slot|reserved | generation:u16 | chunk_index:u16 | chunk_count:u16
// | total_bytes:u32, all LE. The header GREW 4 -> 14 bytes at v1.0.
assert('BLOB_CHUNK header is 14 bytes', BLOB_CHUNK_HEADER_BYTES === 14);
function buildBlobChunk(ns, storeId, slot, generation, index, count, total, body) {
  const out = new Uint8Array(14 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint8(0, ns); dv.setUint8(1, storeId); dv.setUint8(2, slot); dv.setUint8(3, 0);
  dv.setUint16(4, generation, true);
  dv.setUint16(6, index, true);
  dv.setUint16(8, count, true);
  dv.setUint32(10, total, true);
  out.set(body, 14);
  return out;
}
const chunk0 = buildBlobChunk(0, 0, 0, 0, 0, 2, 5, Uint8Array.of(0xaa, 0xbb, 0xcc));
check('BLOB_CHUNK header bytes (catalog, chunk 0 of 2, total 5)',
  chunk0.subarray(0, 14), '00000000000000000200 05000000');
const ph = parseBlobChunk(chunk0);
assert('parseBlobChunk: ns/index/count/total',
  ph.ns === 0 && ph.chunkIndex === 0 && ph.chunkCount === 2 && ph.totalBytes === 5);
assert('parseBlobChunk: body slice', hex(ph.bytes) === 'AABBCC');
assert('parseBlobChunk: rejects a short payload', parseBlobChunk(new Uint8Array(13)) === null);

// Reassembly out of order, with a duplicate. Chunk payloads are 192 B except
// the last (blob_chunks.hpp: per-chunk offset = index * catalog_chunk_payload),
// so a 195-byte blob is exactly two chunks.
const wholeBlob = new Uint8Array(195);
for (let i = 0; i < wholeBlob.length; i++) wholeBlob[i] = (i * 31 + 7) & 0xff;
const c0 = parseBlobChunk(buildBlobChunk(0, 0, 0, 0, 0, 2, 195, wholeBlob.subarray(0, 192)));
const c1 = parseBlobChunk(buildBlobChunk(0, 0, 0, 0, 1, 2, 195, wholeBlob.subarray(192)));
const ra = new BlobReassembler();
ra.begin(c1, 0); // begun from whichever chunk arrives first — it declares total_bytes
ra.insert(c1, 1);
assert('BlobReassembler: incomplete with a hole', !ra.complete());
assert('BlobReassembler: missingIndices names the hole', ra.missingIndices().join(',') === '0');
ra.insert(c0, 2);
ra.insert(c0, 3); // duplicate is idempotent
assert('BlobReassembler: complete after the hole is filled', ra.complete());
assert('BlobReassembler: assembled bytes in index order', hex(ra.assembled()) === hex(wholeBlob));
assert('BlobReassembler: rejects another blob\'s chunk',
  !ra.insert(parseBlobChunk(buildBlobChunk(1, 3, 7, 0, 0, 2, 195, wholeBlob.subarray(0, 192))), 4));
const raRefuse = new BlobReassembler(1024);
assert('BlobReassembler: refuses a transfer larger than its capacity (RFC-028)',
  raRefuse.begin({ ns: 0, storeId: 0, slot: 0, chunkCount: 9999, totalBytes: 4000000 }, 0) === false &&
  raRefuse.missingIndices().length === 0);

// ---- CATALOG_READY (0x19) — raw plane, the 8 etag bytes, nothing else ------
const etagDemo = Uint8Array.of(0xf4, 0xa2, 0x8f, 0xbb, 0x58, 0xce, 0xd1, 0x6a);
check('CATALOG_READY frame (raw 8-byte etag)',
  encodeFrame(FRAME.CATALOG_READY, 0, etagDemo, 0), '19000000000008 00 F4A28FBB58CED16A');
assert('etag is limits::etag_bytes (8)', LIMITS.etag_bytes === 8 && etagDemo.length === 8);

// ---- SHA-256 (etag verification, §8.3) -------------------------------------
// NIST FIPS 180-4 published vectors — an INDEPENDENT check that the hand-rolled
// hash is right, because crypto.subtle is unavailable on a plain-http LAN page.
check('SHA-256("abc") — NIST vector', sha256(new TextEncoder().encode('abc')),
  'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD');
check('SHA-256("") — NIST vector', sha256(new Uint8Array(0)),
  'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855');
check('SHA-256 448-bit vector', sha256(new TextEncoder().encode(
  'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
  '248D6A61D20638B8E5C026930C3E6039A33CE45964FF2167F6ECEDD419DB06C1');
// A 1 KB pseudo-random blob cross-checked against node's own WebCrypto.
const blobBytes = new Uint8Array(1024);
for (let i = 0; i < blobBytes.length; i++) blobBytes[i] = (i * 167 + 13) & 0xff;
const nodeDigest = new Uint8Array(await webcrypto.subtle.digest('SHA-256', blobBytes));
assert('SHA-256 agrees with node WebCrypto over 1 KB', hex(sha256(blobBytes)) === hex(nodeDigest));
assert('catalogEtag truncates to 8 bytes of the digest',
  bytesEqual(catalogEtag(blobBytes), sha256(blobBytes).subarray(0, 8)));

// ---- CRC-32 + the raw ESTOP frame (§5.5) -----------------------------------
assert('CRC-32/IEEE("123456789") = 0xCBF43926',
  crc32(new TextEncoder().encode('123456789')) === 0xcbf43926);
const est = encodeEstopFrame(0 /* cause=user */, 1 /* origin=control */, 0x0102);
assert('ESTOP frame is 12 bytes', est.length === ESTOP_FRAME_BYTES);
assert('ESTOP magic is 4x0xE5 (recognizable WITHOUT deframing)',
  est[0] === 0xe5 && est[1] === 0xe5 && est[2] === 0xe5 && est[3] === 0xe5);
assert('ESTOP cause/origin/seq (LE)', est[4] === 0 && est[5] === 1 && est[6] === 0x02 && est[7] === 0x01);
const estCrc = new DataView(est.buffer).getUint32(8, true);
assert('ESTOP crc32 covers bytes [0,8)', estCrc === crc32(est.subarray(0, 8)));

// ---- packed decode: RFC-026 str16 + the 9-byte RFC-025c safety snapshot ----
assert('str16/str32/str64 wire sizes', PACKED_SIZE[PACKED.str16] === 16 &&
  PACKED_SIZE[PACKED.str32] === 32 && PACKED_SIZE[PACKED.str64] === 64);
const strPayload = new Uint8Array(16 + 4);
new TextEncoder().encodeInto('ValenceDrive', strPayload.subarray(0, 16)); // zero-padded
new DataView(strPayload.buffer).setFloat32(16, 12.5, true);
const strDec = decodePacked(strPayload, [
  { name: 'hub_name', type: PACKED.str16, scale: 1 },
  { name: 'volts', type: PACKED.f32, scale: 1 },
]);
assert('decodePacked: str16 strips zero padding', strDec.hub_name === 'ValenceDrive');
assert('decodePacked: field after a str16 is at the right offset', strDec.volts === 12.5);

// safety 0x0003 (RFC-085): word bit0 estop, bit3 pause, bits 1/2 retired;
// appended modes byte bit0 override, bit1 home_required. 8 -> 9 B.
const safetyLayout = [
  { name: 'word', type: PACKED.bitfield8, scale: 1, bits: ['estop', '', '', 'pause'] },
  { name: 'cause', type: PACKED.u8, scale: 1 },
  { name: 'owner_session', type: PACKED.u32, scale: 1 },
  { name: 'estop_seq', type: PACKED.u16, scale: 1 },
  { name: 'modes', type: PACKED.bitfield8, scale: 1, bits: ['override', 'home_required'] },
];
const safety9 = Uint8Array.of(0x09, 0x00, 0xef, 0xbe, 0xad, 0xde, 0x07, 0x00, 0x03);
const sd = decodePacked(safety9, safetyLayout);
assert('safety decode: word bits (estop+pause latched)',
  sd.word_bits.estop === true && sd.word_bits.pause === true);
assert('safety decode: owner_session u32 LE', sd.owner_session === 0xdeadbeef);
assert('safety decode: estop_seq', sd.estop_seq === 7);
assert('safety decode: modes byte (override+home_required)',
  sd.modes_bits.override === true && sd.modes_bits.home_required === true);
// An OLD 8-byte snapshot must still parse its prefix (append-only evolution).
const sd8 = decodePacked(safety9.subarray(0, 8), safetyLayout);
assert('safety decode: 8-byte prefix still decodes, modes simply absent',
  sd8.owner_session === 0xdeadbeef && sd8.modes === undefined);

// ---- control-owner 0x0004 (SPEC §11.4, RFC-098): 216 B, registry layout ----
// Built by hand at the spec's offsets: pair i at 5i {src u8, owner u32}; slot
// i's names at 20 + 49i {kind u8, client_kind str16, client_name str32}.
{
  const enc = new TextEncoder();
  const p = new Uint8Array(216);
  const dv = new DataView(p.buffer);
  for (let i = 0; i < 4; i++) p[5 * i] = i;
  dv.setUint32(1 + 5 * 1, 0x01020304, true);  // stream owned
  dv.setUint32(1 + 5 * 2, 7, true);           // classic owned
  const kinds = [SOURCE_KIND.jog, SOURCE_KIND.stream, SOURCE_KIND.classic, SOURCE_KIND.reserved];
  for (let i = 0; i < 4; i++) p[20 + 49 * i] = kinds[i];
  enc.encodeInto('MultiFunPlayer', p.subarray(70, 86));
  enc.encodeInto('ATLANTIC-PC', p.subarray(86, 118));
  enc.encodeInto('0123456789abcdef', p.subarray(119, 135));                   // full str16
  enc.encodeInto('0123456789abcdefghijklmnopqrstuv', p.subarray(135, 167));   // full str32
  const slots = decodeControlOwner(p);
  assert('control-owner: four slots in order', slots.length === 4 && slots.every((s, i) => s.src === i));
  assert('control-owner: owners u32 LE, 0 unowned',
    slots[0].owner === 0 && slots[1].owner === 0x01020304 && slots[2].owner === 7 && slots[3].owner === 0);
  assert('control-owner: each slot names its source kind',
    slots.map((s) => SOURCE_KIND_NAME[s.kind]).join() === 'jog,stream,classic,reserved');
  assert('control-owner: owner client_kind and client_name',
    slots[1].clientKind === 'MultiFunPlayer' && slots[1].clientName === 'ATLANTIC-PC');
  assert('control-owner: full-width str16/str32 decode whole, no terminator',
    slots[2].clientKind === '0123456789abcdef' && slots[2].clientName === '0123456789abcdefghijklmnopqrstuv');
  assert('control-owner: unowned slots read empty names',
    slots[0].clientName === '' && slots[3].clientKind === '');
  const old = decodeControlOwner(p.subarray(0, 20));
  assert('control-owner: a pre-RFC-098 20 B payload keeps its pairs, kind null',
    old.length === 4 && old[1].owner === 0x01020304 && old[1].kind === null && old[1].clientName === '');
}

// ---- catalog decode: RFC-009 annotations + option_access -------------------
// A hand-built entry in the exact shape catalog_codec.hpp emits: one INTENT
// channel whose enum-valued `op` field carries options (10) and an
// index-aligned per-option minimum role (17).
const miniCatalog = cbArray([
  cbMap([
    [1, cbUint(CH_SAFETY + 2)], // 0x0005 safety-intents
    [2, cbTstr('safety-intents')],
    [3, cbUint(2)],             // class INTENT
    [4, cbUint(1)],             // dir c2h
    [5, cbUint(ACCESS.watch)],  // access floor: watch — and that is the point
    [6, cbF32(20.0)],
    [7, cbUint(PRIORITY.critical)],
    [9, cbMap([[1, cbMap([
      [1, cbTstr('op')],
      [2, cbUint(0)],           // cbor type uint_t
      [3, cbTstr('')],
      [10, cbArray([cbTstr('reserved'), cbTstr('release'), cbTstr(''),
        cbTstr(''), cbTstr('pause'), cbTstr('resume'), cbTstr('estop')])],
      [12, cbTstr('What to do about safety.')],
      [17, cbArray([cbUint(1), cbUint(1), cbUint(1), cbUint(1), cbUint(0), cbUint(1), cbUint(0)])],
      // RFC-048 keys 19..23 on a SCHEMA field — rare but legal, and the reason
      // decodeSharedAnnotations owns them rather than decodeLayoutField.
      [19, cbUint(UI_RANK.hero)],
      [20, cbUint(VALUE_ASPECT.peak)],
      [21, cbUint(VALUE_SCOPE.lifetime)],
      [22, cbUint(VALUE_PROVENANCE.demand)],
      [23, cbUint(UNIT_ID.mm_s)],
    ])]])],
    // ui_categories, NOT the tombstoned setting_categories: `limits` is 4 here.
    // This fixture said 2 with a `// category: limits` comment beside it, which
    // was true only under the retired vocabulary — 2 is `motion` now.
    [10, cbUint(UI_CATEGORY.limits)],
    [16, cbUint(UI_RANK.control)],   // entry rank (key 16)
  ]),
]);
const miniEntries = decodeCatalog(miniCatalog);
const miniMap = catalogChannelMap(miniEntries);
const si = miniMap.get(0x0005);
assert('catalog decode: entry basics', si && si.name === 'safety-intents' && si.clsName === 'INTENT');
assert('catalog decode: access floor is watch', si.access === ACCESS.watch && si.accessName === 'watch');
assert('catalog decode: category resolves to a registry name',
  si.category === UI_CATEGORY.limits && si.categoryName === 'limits' && si.categoryKnown === true);
assert('catalog decode: entry rank (key 16)',
  si.rank === UI_RANK.control && si.rankName === 'control');
const opField = schemaByKey(si).get(1);
assert('catalog decode: field keys 19..23 on a schema field',
  opField.rankName === 'hero' && opField.aspectName === 'peak' &&
  opField.scopeName === 'lifetime' && opField.provenanceName === 'demand' &&
  opField.unitIdName === 'mm_s');
assert('catalog decode: schema field options[6] === estop', opField.options[6] === 'estop');
assert('catalog decode: desc annotation', opField.desc === 'What to do about safety.');

// ---- RFC-048 absent-defaults and the unknown-code rule ---------------------
// The paths that decide whether an UNTAUGHT machine renders. A field that says
// nothing must still answer "what rank are you?", and a category id this client
// has never heard of must land in the DEFINED overflow rather than on the floor
// (§8.8 item 8 / §8.9 rule 8) — while keeping its raw id, so two unknown
// categories stay two tabs instead of fusing into one.
const bareCatalog = cbArray([
  cbMap([
    [1, cbUint(0x0081)], [2, cbTstr('bare')], [3, cbUint(0)], [4, cbUint(0)],
    [5, cbUint(ACCESS.watch)], [6, cbF32(1.0)], [7, cbUint(PRIORITY.normal)],
    [8, cbArray([cbMap([[1, cbTstr('plain')], [2, cbUint(PACKED.u8)], [3, cbTstr('mm')], [4, cbF32(1.0)]])])],
    [10, cbUint(200)],   // a device-defined category id, outside the vocabulary
  ]),
]);
const bare = decodeCatalog(bareCatalog)[0];
assert('absent rank defaults to detail, entry and field alike',
  bare.rank === UI_RANK.detail && bare.rankName === 'detail' &&
  bare.layout[0].rank === UI_RANK.detail && bare.layout[0].rankName === 'detail');
assert('absent aspect/scope/provenance take their vocabulary defaults',
  bare.layout[0].aspectName === 'live' && bare.layout[0].scopeName === 'session' &&
  bare.layout[0].provenanceName === 'actual');
assert('absent unit_id stays null so the tstr unit renders verbatim',
  bare.layout[0].unitId === null && bare.layout[0].unitIdName === null &&
  bare.layout[0].unit === 'mm');
assert('unknown category id -> `other` name, raw id PRESERVED (never dropped)',
  bare.category === 200 && bare.categoryName === 'other' && bare.categoryKnown === false);

// RFC-094: retired ids 5 and 9 are not vocabulary, so they take the overflow
// path; tiers are a per-category attribute and an iterable table that agree.
assert('retired categories 5 and 9 are absent from the vocabulary',
  !('library' in UI_CATEGORY) && !('tuning' in UI_CATEGORY) && UI_CATEGORY.generator === 1);
assert('tier attribute and tier table agree, in registry order',
  Object.entries(UI_NAV_TIER_CATEGORIES).every(([t, ids]) =>
    ids.every((id) => UI_CATEGORY_TIER[id] === Number(t))) &&
  UI_CATEGORY_TIER[UI_CATEGORY.session] === UI_NAV_TIER.link &&
  UI_NAV_TIER_CATEGORIES[UI_NAV_TIER.link].join() === '11,12' &&
  UI_NAV_TIER_CATEGORIES[UI_NAV_TIER.client].length === 0);

const wildCatalog = cbArray([
  cbMap([
    [1, cbUint(0x0082)], [2, cbTstr('wild')], [3, cbUint(0)], [4, cbUint(0)],
    [5, cbUint(ACCESS.watch)], [6, cbF32(1.0)], [7, cbUint(PRIORITY.normal)],
    [8, cbArray([cbMap([
      [1, cbTstr('futuristic')], [2, cbUint(PACKED.u8)], [3, cbTstr('mm')], [4, cbF32(1.0)],
      [19, cbUint(99)], [20, cbUint(99)], [21, cbUint(99)], [22, cbUint(99)], [23, cbUint(99)],
    ])])],
    [16, cbUint(99)],
  ]),
]);
const wild = decodeCatalog(wildCatalog)[0];
assert('unrecognized annotation codes fall back to the vocabulary default, never throw',
  wild.rankName === 'detail' && wild.layout[0].rankName === 'detail' &&
  wild.layout[0].aspectName === 'live' && wild.layout[0].scopeName === 'session' &&
  wild.layout[0].provenanceName === 'actual' && wild.layout[0].unitIdName === null);
assert('catalog decode: option_access decoded (key 17)', Array.isArray(opField.optionAccess));
assert('option_access: pause(4) and estop(6) are ROLE-EXEMPT (watch)',
  optionAccessFor(si, 1, SAFETY_OP.pause) === ACCESS.watch &&
  optionAccessFor(si, 1, SAFETY_OP.estop) === ACCESS.watch);
assert('option_access: resume(5) needs control',
  optionAccessFor(si, 1, SAFETY_OP.resume) === ACCESS.control);
assert('gray-never-hide: a watch session may pause but not resume',
  canUseOption(si, 1, SAFETY_OP.pause, ACCESS.watch) === true &&
  canUseOption(si, 1, SAFETY_OP.resume, ACCESS.watch) === false &&
  canUseOption(si, 1, SAFETY_OP.resume, ACCESS.control) === true);

// ---- EVENT `body` (key 40) decoded against the channel's OWN schema --------
// v1.0 moved kind-specific fields OFF the global key space into this scoped
// sub-map; without it every device-authored EVENT channel would need a registry
// PR to name its own fields.
const evtEntry = decodeCatalog(cbArray([cbMap([
  [1, cbUint(0x0089)], [2, cbTstr('motion-anomaly')], [3, cbUint(3)], [4, cbUint(0)],
  [5, cbUint(ACCESS.watch)], [6, cbF32(0)], [7, cbUint(PRIORITY.normal)],
  [9, cbMap([
    [1, cbMap([[1, cbTstr('kind')], [2, cbUint(0)], [3, cbTstr('')]])],
    [2, cbMap([[1, cbTstr('detail')], [2, cbUint(0)], [3, cbTstr('')]])],
  ])],
])]))[0];
const body = decodeEventBody(new Map([[1, 5], [2, 42], [9, 'unknown']]), evtEntry);
assert('EVENT body: schema field names resolved', body.kind === 5 && body.detail === 42);
assert('EVENT body: unknown key kept, never dropped (§4.3)', body.key9 === 'unknown');

// ---- RFC-063/065/066/070/076: catalog keys ruled 2026-10-01 -----------------
// Entry keys 17-20, field keys 24-25 and the destructive flag, decoded into the
// entry and field objects decodeCatalog already returns.
{
  const head = (id, name, cls, dir) => [[1, cbUint(id)], [2, cbTstr(name)], [3, cbUint(cls)], [4, cbUint(dir)],
    [5, cbUint(ACCESS.watch)], [6, cbF32(0)], [7, cbUint(PRIORITY.normal)]];
  const field = (name, extra = []) => cbMap([[1, cbTstr(name)], [2, cbUint(0)], [3, cbTstr('')], ...extra]);
  const [roster, writer, events, mod] = decodeCatalog(cbArray([
    cbMap([...head(0x0091, 'presets-roster', 0, 0),
      [8, cbArray([cbMap([[1, cbTstr('generation')], [2, cbUint(PACKED.u16)], [3, cbTstr('')], [4, cbF32(1)],
        [25, cbUint(0)]])])],
      [17, cbUint(3)]]),
    cbMap([...head(0x0092, 'presets-write', 2, 1),
      [9, cbMap([
        [1, field('op', [[10, cbArray(['none', 'save', 'load', 'delete', 'rename'].map(cbTstr))],
          [13, cbTstr('action.store')], [24, cbUint(1 << 3)]])],
        [2, field('wipe', [[15, cbUint(1 << 3)]])],
      ])],
      [17, cbUint(3)]]),
    cbMap([...head(0x0093, 'anomalies', 3, 0), [9, cbMap([[1, field('count')]])],
      [18, cbTstr('events.anomaly')], [19, cbMap([[1, cbTstr('clamped')], [3, cbTstr('fallback')]])]]),
    cbMap([...head(0x0094, 'stroke-mod', 0, 0),
      [8, cbArray([cbMap([[1, cbTstr('amount')], [2, cbUint(PACKED.u8)], [3, cbTstr('%')], [4, cbF32(1)]])])],
      [20, cbArray([cbUint(0x0095), cbUint(1)])]]),
  ]));
  assert('store_id (17) on roster and writer', roster.storeId === 3 && writer.storeId === 3 && events.storeId === null);
  assert('channel role (18)', events.role === 'events.anomaly' && roster.role === null);
  assert('event_kinds (19) label by kind', events.eventKinds[1] === 'clamped' && events.eventKinds[3] === 'fallback' &&
    events.eventKinds[2] === undefined && roster.eventKinds === null);
  assert('mod_target (20)', mod.modTarget && mod.modTarget.channel === 0x0095 && mod.modTarget.field === 1 &&
    roster.modTarget === null);
  const op = writer.schema.find((f) => f.key === 1);
  const wipe = writer.schema.find((f) => f.key === 2);
  assert('destructive_options (24) index-aligned with options',
    JSON.stringify(op.destructiveOptions) === JSON.stringify([false, false, false, true, false]));
  assert('destructive flag bit3 -> flagBits.destructive', wipe.flagBits.destructive === true && wipe.destructiveOptions === undefined);
  assert('safe (25) on a layout field', roster.layout[0].safe === 0 && mod.layout[0].safe === undefined);
}

// ---- RFC-073: a store item's digest picks BLOB_DONE status 0 or 1 -----------
{
  const payload = new Uint8Array([1, 2, 3, 4, 5]);
  const item = (digest) => cbMap([[3, cbUint(7)], [5, cbTstr('warmup')], [6, cbTstr('pattern.frayd')],
    [7, cbBstr(payload)], ...(digest ? [[11, cbBstr(digest)]] : [])]);
  const good = sha256(payload);
  const bad = good.slice();
  bad[0] ^= 0xff;
  assert('store item: matching digest verifies', storeItemDigestOk(item(good)) === true);
  assert('store item: mismatched digest is status 1', storeItemDigestOk(item(bad)) === false);
  assert('store item: no digest has nothing to check', storeItemDigestOk(item(null)) === true);
  assert('store item: non-map bytes are not judged', storeItemDigestOk(new Uint8Array([0x01])) === true);
}

// ---- Golden fixture: the REAL catalog fetched from valencesim ------------------
// Captured by Valence Drive's webui/test/valence-sim.mjs (machine repo, not
// here) from its device-fidelity simulator. Hashing the real hub's real
// catalog bytes and matching the etag IT declared is a cross-implementation
// check of this file's SHA-256 against lib/valence's C++ Sha256.
const FIXTURE = new URL('./fixtures/valencesim-catalog.bin', import.meta.url);
const FIXTURE_ETAG = new URL('./fixtures/valencesim-catalog.etag', import.meta.url);
if (existsSync(FIXTURE) && existsSync(FIXTURE_ETAG)) {
  const catBytes = new Uint8Array(readFileSync(FIXTURE));
  const hubEtag = readFileSync(FIXTURE_ETAG, 'utf8').trim();
  assert('fixture: JS SHA-256 etag == the etag the hub declared (' + hubEtag + ')',
    toHex(catalogEtag(catBytes)) === hubEtag);
  const realEntries = decodeCatalog(catBytes);
  const realMap = catalogChannelMap(realEntries);
  assert('fixture: real catalog decodes (' + realEntries.length + ' channels)', realEntries.length > 5);
  const safety = realMap.get(0x0003);
  assert('fixture: 0x0003 safety carries the APPENDED modes bitfield (8 -> 9 B)',
    !!safety && safety.layout.some((f) => f.name === 'modes'));
  const realSi = realMap.get(0x0005);
  assert('fixture: 0x0005 advertises option_access with pause and estop role-exempt (RFC-085)',
    optionAccessFor(realSi, 1, SAFETY_OP.pause) === ACCESS.watch &&
    optionAccessFor(realSi, 1, SAFETY_OP.estop) === ACCESS.watch &&
    optionAccessFor(realSi, 1, SAFETY_OP.resume) === ACCESS.control);

  // ---- GAP CLOSED (Phosphor milestone 1, sim fidelity) -------------------
  // Was an [SKIP-EXPECTED-GAP]: sim/valencesim's DEFAULT catalog used to be
  // benchrig::buildDivergentCatalog() (a deliberately different third-party
  // catalog, ValenceSimCatalog.h), which never had a channel shaped like the
  // real device's motion telemetry (0x1100, RFC-047; was 0x0080). DESIGN.md's
  // catalog-profiles ruling made benchrig `--profile alien` instead and
  // restored `--profile device` (now the default) to literal device-catalog
  // fidelity — buildValenceDriveCatalog() from include/comms/ValenceCatalog.h,
  // the SAME definition the firmware ships — so this fixture (captured from
  // the `device` profile) now always carries the real 0x1100 shape.
  const motion = realMap.get(0x1100);
  assert('fixture: 0x1100 motion carries the raw_10um field (7 -> 9 B)',
    !!motion && motion.layout.some((f) => f.name === 'raw_10um'));
} else {
  console.log('  [SKIP] real-catalog fixture (regenerate via Valence Drive\'s webui/test/valence-sim.mjs)');
}

console.log('');
if (failures === 0) { console.log('ALL PASS'); process.exit(0); }
console.log(failures + ' FAILED');
process.exit(1);
