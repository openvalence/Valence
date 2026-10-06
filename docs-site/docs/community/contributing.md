---
title: Contributing to the documentation
description: >-
  How to build the Valence documentation site, the writing rules, and the rule
  that wire numbers are generated, never typed.
---

# Contributing to the documentation

This page covers the documentation site. For protocol changes, see
[the RFC process](rfc-process.md).

## Site build

```bash
cd docs-site
python -m venv .venv
.venv/bin/pip install -r requirements.txt      # Windows: .venv\Scripts\pip
python tools/gen_docs_tables.py                # refresh generated pages
mkdocs build --strict                          # or: mkdocs serve
```

Run `mkdocs` from `docs-site/`. The glossary include resolves against the
working directory, and the build fails when run from another directory.

Review builds use `--strict`, which fails the build on a dead cross-reference.

## Writing rules

Guides and reference pages follow rules influenced by ASD-STE100:

- One idea per sentence.
- Active voice. Present tense.
- An instruction is 20 words or fewer.
- No noun stack longer than three words.
- One term, one meaning, used consistently.

The specification is generated from `spec/SPEC.md` and uses numbered clauses,
RFC 2119 keywords (MUST, MUST NOT, SHALL, SHOULD, MAY) and exact
cross-references.

!!! danger "Technical terms"

    *Quintic*, *deadman*, *token bucket*, *etag*, *jerk*, *arbiter*,
    *conflation* and *catalog* are precise vocabulary. Do not replace them with
    plain-language substitutes.

    The STE rule "one term, one meaning, used consistently" applies to these
    words: define each in [the Dictionary](../reference/dictionary.md), then use
    it everywhere.

## Generated wire numbers

Every frame type, CBOR key, NACK code, channel id, field role, setting
category, safety cause, stream kind, packed field type and limit on this site
is generated from `registry.yaml`.

The project has shipped the same hand-copied-constant drift bug four separate
times: a stale JavaScript intent-schema table, a hand-rolled safety-cause enum,
a hardcoded interface layout table, and a duplicated build caveat.

To change a number:

1. Change the number in `registry.yaml`, the only source of wire numbers.
2. Run `python tools/gen_docs_tables.py`.
3. Commit the registry and the generated output together.

CI runs `python tools/gen_docs_tables.py --check` and fails the build when a
generated file has drifted. Hand edits to a generated page are overwritten by
the next run, and CI rejects them.

A generated page carries a `generated: true` badge and a DO-NOT-EDIT banner.

A new registry section needs a documenting page. The generator refuses to run
until one is named.

## Generated Specification pages

Every page under **Specification** except [Errata](../spec/errata.md) is
produced from `spec/SPEC.md` by `tools/gen_spec_pages.py`. That file
is the normative source, and it is the only place to change a clause.

The site holds no hand-maintained copy of normative text.

The generator copies normative text verbatim. It adds the split, the
clause-derived anchors (`§6.4` → `#s6-4`), and the links that make `§n.m`
cross-references work across page boundaries. It refuses to run on a clause no
page claims and on a cross-reference that resolves to nothing.

## Generated Dictionary

Do not edit `docs/reference/dictionary.md`. Edit `dictionary.yaml` and
regenerate.

One source produces both the Dictionary page and the hover definitions
appended to every other page. The generator refuses two different definitions for the same written form, and
refuses a `see` cross-reference to a term that does not exist.

## Stub pages

A page whose content is deferred is marked as a stub. A stub:

- declares `status: stub` in front matter, which renders a badge;
- states what belongs on the page;
- links to the source material an author should read first.

A stub contains no draft prose for the deferred content. Its badge and warning
admonition mark it as unwritten.

Normative content describes what shipped at the v1.0 tag.

## New pages

1. Create the file under `docs/`.
2. Add `title` and `description` to its front matter. The
   `description` becomes the page's meta description and search snippet.
3. Add it to `nav:` in `mkdocs.yml`. A page outside the nav fails the strict
   build.
4. Build with `--strict`.

## See also

- [Governance](governance.md)
- [The RFC process](rfc-process.md)
- `docs-site/README.md`: layout, the one outside path, and how to extract
  this directory into its own repository.
