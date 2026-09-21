---
title: Specification
description: >-
  The normative Valence v1.0 protocol specification: reading guide, clause
  map, and the generated clause pages.
register: IEEE
generated: true
---

<!-- ==========================================================
     GENERATED FILE — DO NOT EDIT.
     Source of truth: spec/SPEC.md
     Generator:       docs-site/tools/gen_spec_pages.py
     Regenerate:      python docs-site/tools/gen_spec_pages.py
     CI gate:         python docs-site/tools/gen_spec_pages.py --check
     Normative text is copied verbatim. Hand edits are overwritten
     and fail the docs build. Edit the specification instead.
     ========================================================== -->

# Valence Protocol Specification

!!! danger "This tier is generated. Edit the specification, not these pages."

    Every page under **Specification** is produced from `spec/SPEC.md`
    by `docs-site/tools/gen_spec_pages.py`. That file is the normative source and the only
    place to make a change. A hand edit here is overwritten by the next
    build, and `--check` fails the build before that happens.

    There is deliberately no second copy of the normative text on this
    site. An implementer trusts a specification absolutely, so a
    specification that can drift from its source is a defect, not a
    convenience.

**Protocol:** `valence/1`  
**Document version:** v1.0-draft (public, **not yet pinned** — see Freeze state)  
**Status:** Normative in content; the numbers are NOT frozen.  
**Registry of record:** [`registry/registry.yaml`](../reference/registry/index.md) — Appendices [A](appendices.md#appendix-a), [B](appendices.md#appendix-b) and [G](appendices.md#appendix-g) are generated *views* of it. **On any conflict between this document and the registry, the registry wins** ([§5.7](wire-format.md#s5-7)).  
**Companion normative artifacts:** [`schema/catalog.cddl`](schema.md) ([Appendix C](appendices.md#appendix-c)), `vectors/manifest.yaml` ([Appendix F](appendices.md#appendix-f)), `RENDERING.md` (client-rendering conformance, [§19](rendering.md#s19)).  
**Non-normative companions:** `RFC-QUEUE.md` (change history and rationale), `V1-READINESS.md`, [`examples/session-traces.md`](traces.md) ([Appendix E](appendices.md#appendix-e)).

**FREEZE STATE — read this before building against any number here.** Clauses throughout this document and RENDERING.md bind "from the v1.0 tag forward": the never-reuse/never-renumber rule ([§5.7](wire-format.md#s5-7)), the conformance fixture freeze ([§16](errors.md#s16)), and RENDERING.md's enumerable-vocabulary freeze ([§14](transports.md#s14)). **That event has not occurred.** It is the **release pin** — one commit the operator locks once the protocol has been put through its paces, after which only documentation, clients, and tools move. Until the pin exists, every one of those clauses describes a future state and binds nothing: numbers, frozen fixtures, and vocabularies MAY still change, and a registry regeneration is explicitly planned to happen *at* the pin (RFC-QUEUE.md). Implement against this document freely — that is what it is for — but treat no number as stable yet, and pin by **commit sha**, never by this document's version string. This notice is deleted at the pin, and its deletion is the announcement.

## 0. Reading this document {#s0}

Clause numbering is `§<section>.<subsection>`. Every section header carries `*(normative)*` or `*(informative)*`; where a section is mixed, the exception is named in its header. Numbered lists inside a normative section are normative. Tables are normative unless the section says otherwise.

**Honesty clauses** are normative statements about what this protocol does **not** protect against or does **not** guarantee. They are marked **HONESTY CLAUSE** inline and indexed in [§1.5](foundations.md#s1-5). They are requirements, not caveats: an implementation that presents a protected-sounding UI over one of them is non-conformant.

## The clause pages {#clause-pages}

The document is split by concern. Clause numbering is unchanged: §6.4 is
§6.4 wherever it is published.

| Page | Clauses |
|---|---|
| [Foundations](foundations.md) | [§1 Introduction](foundations.md#s1) · [§2 Terminology, Roles, and State Machines](foundations.md#s2) · [§3 Architecture Overview](foundations.md#s3) · [§4 Versioning and Compatibility Model](foundations.md#s4) |
| [Wire format](wire-format.md) | [§5 Wire Format](wire-format.md#s5) |
| [Session layer](session.md) | [§6 Session Layer](session.md#s6) |
| [Time and sequencing](time.md) | [§7 Time and Sequencing](time.md#s7) |
| [Catalog](catalog.md) | [§8 Catalog](catalog.md#s8) |
| [Channel classes](channels.md) | [§9 Channel Classes](channels.md#s9) |
| [QoS and congestion](qos.md) | [§10 QoS, Flow Control, Congestion](qos.md#s10) |
| [Safety](safety.md) | [§11 Safety](safety.md#s11) |
| [Security and trust](security.md) | [§12 Security and Trust](security.md#s12) |
| [Transports and relays](transports.md) | [§13 Transport Bindings](transports.md#s13) · [§14 Relay Role](transports.md#s14) |
| [Legacy interop](legacy.md) | [§15 Legacy Interop](legacy.md#s15) |
| [Errors and diagnostics](errors.md) | [§16 Errors and Diagnostics](errors.md#s16) |
| [Conformance](conformance.md) | [§17 Conformance](conformance.md#s17) |
| [Known limitations](limitations.md) | [§18 Known Limitations at v1.0](limitations.md#s18) |
| [Rendering](rendering.md) | [§19 Rendering](rendering.md#s19) |
| [Appendices A-G](appendices.md) | [Appendix A — Frame type table](appendices.md#appendix-a) · [Appendix B — CBOR key registry](appendices.md#appendix-b) · [Appendix C — Catalog schema](appendices.md#appendix-c) · [Appendix D — Worked catalog sketch](appendices.md#appendix-d) · [Appendix E — Worked traces](appendices.md#appendix-e) · [Appendix F — Golden vector index](appendices.md#appendix-f) · [Appendix G — Limits and defaults](appendices.md#appendix-g) |
| [Rationale and history](rationale.md) | [Appendix H — Design rationale and rejected alternatives](rationale.md#appendix-h) · [Appendix I — Design-review gap closure map](rationale.md#appendix-i) · [Appendix J — What changed since v1-draft](rationale.md#appendix-j) |
| [Worked session traces](traces.md) | Appendix [E](appendices.md#appendix-e), in full |
| [Catalog schema (CDDL)](schema.md) | Appendix [C](appendices.md#appendix-c), in full |

## Citing a clause {#citing}

Anchors are derived from clause numbers, never from heading text. A
reworded heading therefore cannot break a citation made from a bug
report or another repository.

| Clause | Anchor | Example |
|---|---|---|
| Section §n | `#sn` | [§11](safety.md#s11) |
| Subsection §n.m | `#sn-m` | [§6.4](session.md#s6-4) |
| Appendix X | `#appendix-x` | [Appendix G](appendices.md#appendix-g) |
| Trace En | `#en` | [E4](traces.md#e4) |

Numbered items and lettered paragraphs inside a clause — §5.8-4, §12.3a —
resolve to their parent clause, which is where they are read from.

## Companion artifacts {#companions}

The specification's companions live beside it in the source repository.
Three of them are published on this site, generated the same way these
pages are:

| Artifact | Where |
|---|---|
| `registry/registry.yaml` — every wire number | [Registry reference](../reference/registry/index.md), generated |
| `examples/session-traces.md` — Appendix E | [Worked session traces](traces.md), generated |
| `schema/catalog.cddl` — Appendix C, the normative catalog encoding | [Catalog schema (CDDL)](schema.md), generated |
| `vectors/manifest.yaml` — Appendix F, golden-vector coverage | source repository |
| `RFC-QUEUE.md`, `V1-READINESS.md` — change history and rationale | source repository |

## The register {#register}

This tier is written in the IEEE and RFC normative register. Numbered
clauses. RFC 2119 keywords. Exact cross-references. It is permitted to be
dense: implementers need exactness more than approachability.

Glossary tooltips are stripped from every page in this tier. In a
normative document every word is normative or visibly marked otherwise,
so a hover definition over a term inside a MUST clause would be a second,
invisible source of meaning. [The Dictionary](../reference/dictionary.md)
stays one click away.

Everything outside this tier is written in the STE register. See
[Contributing](../community/contributing.md).
