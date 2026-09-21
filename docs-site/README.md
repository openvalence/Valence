# Valence documentation site

Material for MkDocs → GitHub Pages, versioned with `mike`.

This directory is **self-contained**. It builds, tests and deploys on its own.
It was designed to be lifted out of the Nucleus firmware repository into
Valence's own repository — this repository is that move, already done. See
[Extraction history](#extraction-history) for how it actually happened.

---

## Build it

```bash
cd docs-site
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt     # Windows
# .venv/bin/pip install -r requirements.txt       # POSIX

.venv/Scripts/python tools/gen_docs_tables.py     # refresh generated tables
.venv/Scripts/python tools/gen_spec_pages.py      # refresh the Specification tier
.venv/Scripts/python -m mkdocs build --strict     # build
.venv/Scripts/python -m mkdocs serve              # or preview at :8000
```

**Run `mkdocs` from this directory.** The glossary include resolves against the
working directory. `check_paths: true` in `mkdocs.yml` turns a wrong directory
into a loud failure rather than a site that silently loses every tooltip.

`--strict` promotes every warning to an error: a dead link, a missing anchor, a
page left out of the nav. Use it. Implementers follow the links in a protocol
specification, and a dead one is a defect.

---

## Layout

```
docs-site/
├── mkdocs.yml            site config and nav; points nowhere outside this dir
├── site.config.yml       THE ONE outside path: where registry.yaml lives
├── requirements.txt      documentation dependencies, floored not pinned
├── dictionary.yaml       source of truth for every defined term
├── VENDORED.md           provenance of the one third-party asset
├── tools/
│   ├── gen_docs_tables.py    registry + dictionary -> Markdown; has --check
│   └── gen_spec_pages.py     SPEC.md -> the Specification tier; has --check
├── includes/
│   └── abbreviations.md      GENERATED glossary tooltips, appended site-wide
├── hooks/
│   └── spec_no_glossary.py   strips tooltips from the normative tier only
├── overrides/
│   └── main.html             renders the front-matter register badge
└── docs/
    ├── index.md
    ├── understand/           STE register — the "why" tier
    ├── build/                STE register — the "how" tier
    ├── spec/                 IEEE register — GENERATED from SPEC.md
    ├── reference/
    │   ├── dictionary.md     GENERATED from dictionary.yaml
    │   └── registry/         GENERATED from registry.yaml
    ├── community/
    └── assets/
        ├── stylesheets/datasheet.css
        └── javascripts/mermaid.min.js   VENDORED, byte-identical upstream
```

### Two deliberate deviations from a stock Material site

**Mermaid is vendored, not fetched.** Material loads `mermaid.min.js` from a
CDN by default. A LAN-first, offline-first protocol must not phone a CDN to
draw its own diagrams, and a blocked network turns every figure into raw text.
The asset is in `docs/assets/javascripts/`, its provenance is in
`VENDORED.md`, and nothing on this site requests anything from the network.

**Tooltips stop at the Specification.** Guides get the glossary; `spec/**`
does not. In a normative document every word is normative or visibly marked
otherwise, so a hover definition over "hub" inside a MUST clause is a second,
invisible source of meaning. `hooks/spec_no_glossary.py` removes them, and
warns if Material's markup ever changes underneath it.

### Why `docs-site/` and not `spec/site/`

Three reasons, all still true post-extraction:

1. **A directory should contain everything it needs and nothing it doesn't.**
   `docs-site/` is that. Nesting the site under `spec/` would put it inside a
   directory that also holds the working specification, the registry and the
   RFC queue — which are *source material* for the site, not part of it.
2. **The site must not own the registry.** The registry is also read directly
   by the C++ code generator (`tools/gen_registry_header.py`) and every
   language client, not just the docs build. If the site sat under `spec/`,
   "inside the site" and "outside the site" would be a judgment call rather
   than a directory boundary.
3. **A top-level name says what it is.** Someone cloning this repository can
   tell in one `ls` that `spec/` is documents and `docs-site/` is a website.

---

## The one path that reaches outside

Exactly one thing in this directory refers to anything above it: the location
of the protocol registry.

It lives in **`site.config.yml`**:

```yaml
registry_path: ../spec/registry/registry.yaml
```

The path is resolved relative to that file. It can be overridden, highest
precedence first:

1. `python tools/gen_docs_tables.py --registry PATH`
2. `VALENCE_REGISTRY=PATH`
3. `registry_path` in `site.config.yml`

Nothing else — not `mkdocs.yml`, not a page, not a script — refers to anything
outside `docs-site/`. There are no absolute paths anywhere, and nothing assumes
what the parent repository is called.

---

## Generated files

**Never edit these by hand.** The next generator run overwrites them, and CI
fails before that happens.

| File | Generated from | Generator |
|---|---|---|
| `docs/reference/registry/*.md` (10 pages) | `registry.yaml` | `gen_docs_tables.py` |
| `docs/reference/dictionary.md` | `dictionary.yaml` | `gen_docs_tables.py` |
| `includes/abbreviations.md` | `dictionary.yaml` | `gen_docs_tables.py` |
| `docs/spec/*.md` (18 pages, all but `errata.md`) | `SPEC.md`, `examples/session-traces.md` | `gen_spec_pages.py` |

```bash
python tools/gen_docs_tables.py            # write
python tools/gen_docs_tables.py --check    # exit 1 if any file is stale
python tools/gen_docs_tables.py --list     # print the file list

python tools/gen_spec_pages.py             # write
python tools/gen_spec_pages.py --check     # exit 1 if any file is stale
python tools/gen_spec_pages.py --list      # print the file list
python tools/gen_spec_pages.py --nav       # print the mkdocs.yml nav block
```

Both `--check`s run in CI. A stale page fails the docs build.

Why the gate exists: this project has shipped the same hand-copied-constant
drift bug four separate times. A wrong NACK code in documentation is worse
than a wrong NACK code in source, because implementers trust documentation and
nothing compiles it — and a stale copy of the **specification** is the worst
instance of that, because an implementer trusts a specification absolutely.

Each generator also refuses to run on an unclaimed source: `registry.yaml`
growing a section no page documents, or `SPEC.md` growing a clause no page
publishes. Silence is the failure mode both gates exist to prevent.

Editing the Dictionary means editing `dictionary.yaml`. One source produces
both the Dictionary page and the site-wide hover definitions, so a term cannot
acquire a second definition.

### The Specification tier

`docs/spec/**` is a **build product**. The editable source is `spec/SPEC.md`
in this repository, and normative text is copied into the site verbatim.
What the generator adds is structure, not words:

- **the split.** 1544 lines become one page per concern. Clause numbering is
  untouched — §6.4 is §6.4 wherever it is published.
- **number-derived anchors.** `§n` → `#sn`, `§n.m` → `#sn-m`, Appendix X →
  `#appendix-x`, trace En → `#en`. Nothing is slugified from heading text, so
  rewording a heading cannot break an inbound citation.
- **cross-reference rewriting.** Every `§n.m` in the prose becomes a link to
  wherever that clause landed. An unresolvable reference is a hard error at
  generation time; every emitted link is anchor-checked by
  `mkdocs build --strict`.
- **companion links.** Repo-relative links in SPEC.md resolve through the
  generator's `SOURCE_LINKS` table. An unlisted target is a hard error, so a
  new companion artifact cannot silently ship as a 404.

Appendices A, B and G reproduce registry tables as frozen at the v1.0 tag. They
are kept verbatim, so the specification still reads standalone, and each gains
a pointer to the live generated table under Reference.

---

## Deploying

CI does this on a push to the default branch. See
`.github/workflows/docs.yml`.

```bash
mike deploy --push --update-aliases 1.0 latest
mike set-default --push latest
```

`mike` publishes each tagged specification version as its own tree, plus a
`latest` alias, and adds the version selector to the header. Readers of a
protocol specification must be able to pin to the version they implemented.

### `site_url` and why it matters

`mkdocs.yml` reads `site_url` from `$VALENCE_SITE_URL`, defaulting to
`https://valence.invalid/`. `.invalid` is the reserved placeholder TLD
(RFC 2606): if you ever see it in a deployed sitemap, the deploy forgot to set
the variable.

CI computes the correct GitHub Pages origin from the repository context, so it
needs no configuration. Set the repository variable `VALENCE_SITE_URL` to
override it with a custom domain.

---

## Extraction history

This directory was designed for exactly the move that produced this
repository. What actually happened, for the record (operator ruling,
"Valence repo split"): a plain file copy into a fresh-history repository
(`git subtree split`/filter-repo surgery was explicitly ruled out — see the
top-level README's provenance line), not the `git subtree split` procedure
this section used to describe step-by-step. The three-line
`site.config.yml` change and the workflow move (below) are exactly what this
directory's own design anticipated; both landed as planned.

One thing this directory's own design did NOT fully anticipate: the docs
site's **channel-grid page** (`docs/reference/channel-grid.md`) used to be
generated by `docs-site/tools/gen_channel_grid_page.py`, which imports two
repository-root generators (`tools/gen_channel_map.py`, `tools/gen_channel_grid.py`)
that parse a live device's catalog — those stay in Nucleus by design
(the device-channel allocations are that machine's, not the protocol's). This
generator and its huge generated page were NOT brought over; the page is now
a small static reference derived from `spec/CHANNEL-GRID.md`. Rebuilding an
interactive grid visualization on the protocol side (reading a
hub-agnostic catalog, e.g. from Valence Bench, instead of one machine's) is a
parked work item, not done in this pass.

### The workflow

`.github/workflows/docs.yml` did not live under this prefix in Nucleus,
so `git subtree split` alone would not have brought it along — moot here,
since the actual extraction was a plain copy: the file was copied in and had
its `working-directory: docs-site` block and `docs-site/`-prefixed `paths`
entries deleted (it is marked with a comment at each spot, same idea, past
tense now).

### Keep the URLs alive — use a custom domain

**Do this before the first public deploy, not after.**

Publishing straight to `https://<org>.github.io/<repo>/` welds every URL on the
site to an organization name and a repository name. Renaming either one after
people have linked to the site, cited a clause, or pinned a specification
version breaks every one of those links. A protocol specification is exactly
the kind of document people deep-link and cite, so link rot is a real cost, not
a hypothetical one.

Serve it from a custom domain from day one:

1. Register a domain and point a `CNAME` record at `<org>.github.io`. For an
   apex domain, use the `A`/`AAAA` records GitHub publishes instead.
2. Put the bare hostname in `docs/CNAME` — one line, no scheme, no trailing
   slash. `mkdocs build` copies anything in `docs/` into the site, so the file
   survives every deploy. With `mike`, confirm it lands at the root of the
   `gh-pages` branch and not inside a version directory.
3. Set `VALENCE_SITE_URL` to the same origin, so canonical links and
   `sitemap.xml` agree with reality.
4. Enable **Enforce HTTPS** in the repository's Pages settings.

Then, if the repository ever moves, only the DNS record changes. Every
published URL keeps working, including the version trees.

---

## See also

- `docs/community/contributing.md` — the two writing registers, and the rules
  for stubs and generated pages.
- `docs/community/governance.md` — the stance.
