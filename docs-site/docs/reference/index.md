---
title: Reference
description: >-
  Lookup material: the Valence Dictionary, the generated registry tables, and the channel catalog reference.
---

# Reference

This section holds the Dictionary, the generated registry tables, the channel catalog reference and the channel grid.

| Page | Contains |
|---|---|
| [The Dictionary](dictionary.md) | Defined terms and their definitions |
| [Registry reference](registry/index.md) | Every wire number, generated from `registry.yaml` |
| [Channel catalog](channel-catalog.md) | What a real device's catalog looks like, entry by entry |
| [Channel grid](channel-grid.md) | The 0xCDSS channel numbering convention: class, domain, family, and member |

## Generated registry pages

The registry pages are generated from `registry.yaml` by `gen_docs_tables.py`.
Where a generated table and prose disagree, the table is correct and the prose
has a defect. CI fails the build when a generated table is out of date.

## Dictionary tooltips

A term defined in the Dictionary shows its definition on hover wherever it
appears on this site. The tooltips and the Dictionary page are both
generated from `dictionary.yaml`. The generator refuses two definitions for one
written form.

## Quick lookups

- [Frame types](registry/frames.md): every `type` byte
- [NACK codes](registry/errors.md): every refusal reason
- [Limits and defaults](registry/limits.md): sizes, rates and timeouts
- [CBOR keys](registry/cbor-keys.md): every integer key
