---
paths:
  - "lib/**"
  - "spec/schema/**"
  - "spec/vectors/**"
  - "clients/**"
  - "hub/**"
---

# Wire format constraints (SPEC §5; citations are the law, this is the pointer)

## CBOR profile (control plane, §5.3)

- Deterministic RFC 8949 subset: definite-length only, shortest-form integers,
  map keys sorted ascending, floats are binary32 only, no tags, no bignums,
  no simple values beyond false/true/null.
- Max nesting depth 4 per decoded document. The catalog is the one structure
  legally exceeding it as a whole, via independently decodable entry
  documents (§8.1).
- An absent optional key is simply not emitted. Never "null means absent".
- Scoped sub-map key conservation: one global key per feature (`limits`,
  `probe_result`, `identity`, `blob`, `trust`, `body`), each with its own
  local key space.

## Packed layouts (data plane, §5.4)

- STATE/STREAM payloads are packed little-endian structs; the catalog entry's
  `layout` array IS the wire format. No separate encoder.
- Append-only evolution: a released layout grows only at the tail. Readers
  parse the known prefix and ignore trailing bytes. Removing or changing a
  field means a NEW channel id, never an edit.
- STREAM sample layouts never contain string fields.
- STREAM bundle: `t_base:u32 + n:u8 (1..32) + reserved:u8 + t_off[n]:u16 +
  samples`. Malformed bundles are rejected whole, never part-parsed.

## Framing and safety

- Frame header is 8 bytes: type, flags, channel:u16, seq:u16, len:u16.
- ESTOP is the sanctioned exception to header discipline: fixed 12 bytes,
  `E5 E5 E5 E5 | cause origin seq:u16 | crc32`, recognizable by a raw byte
  scanner without deframing (§5.5). COBS passes a zero-free 0xE5 run through
  unchanged; that property is load-bearing (§13.5).
- Fragmentation exists only for control-plane frames over binding MTU (§5.6);
  data-plane frames never fragment.
- Parser totality (§5.8): every parser maps any byte string to accept-or-reject
  with no OOB access, no unbounded allocation or recursion. Validate length as
  `declared <= remaining`, never `start + declared <= size`.

## Where numbers live

Every wire number comes from `spec/registry/registry.yaml` via the generated
headers (`lib/slopsync/include/slopsync/generated/registry_constants.hpp`,
`clients/js/generated/registry_vocab.js`). A hand-typed wire constant in
library or client code is a defect even when its value is currently correct.
