# Valence documentation site

This directory holds the Valence documentation site. It is built with Material for MkDocs, versioned with `mike` and deployed to GitHub Pages.

This directory is **self-contained**. It builds, tests and deploys without files from the rest of the repository except the registry (see External path).

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
into a build failure instead of a site that loses every tooltip.

`--strict` promotes every warning to an error: a dead link, a missing anchor, a
page left out of the nav.

---

## Layout

```
docs-site/
├── mkdocs.yml            site config and nav; points nowhere outside this dir
├── site.config.yml       the outside path: where registry.yaml lives
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
│   └── main.html             renders the generated / stub badges
└── docs/
    ├── index.md
    ├── understand/           the "why" tier
    ├── build/                the "how" tier
    ├── spec/                 GENERATED from SPEC.md
    ├── reference/
    │   ├── dictionary.md     GENERATED from dictionary.yaml
    │   └── registry/         GENERATED from registry.yaml
    ├── community/
    └── assets/
        ├── stylesheets/datasheet.css
        └── javascripts/mermaid.min.js   VENDORED, byte-identical upstream
```

### Differences from a stock Material site

**Mermaid is vendored.** Material loads `mermaid.min.js` from a
CDN by default. The site makes no network requests. With the CDN copy, a reader
without internet access would see each diagram as raw Mermaid source. The asset
is in `docs/assets/javascripts/` and its provenance is in `VENDORED.md`.

**No tooltips in the Specification.** Pages under `spec/**` carry no glossary
tooltips, because a hover definition inside a normative clause would add meaning
the clause text does not show. `hooks/spec_no_glossary.py` removes them and
warns if Material's markup changes.

### Directory boundary

The site lives in `docs-site/`, not `spec/site/`, for three reasons:

1. `docs-site/` holds everything the site build needs. Nesting the site under
   `spec/` would put it inside a directory that also holds the working
   specification, the registry and the RFC queue, which are *source material*
   for the site, not part of it.
2. **The registry stays outside the site.** The registry is also read directly
   by the C++ code generator (`tools/gen_registry_header.py`) and every
   language client, not just the docs build. If the site sat under `spec/`,
   "inside the site" and "outside the site" would be a judgment call rather
   than a directory boundary.
3. The top-level names separate documents (`spec/`) from the website
   (`docs-site/`).

---

## External path

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

No other file in `docs-site/`, including `mkdocs.yml`, the pages and the
scripts, refers to a path outside it. There are no absolute paths anywhere, and nothing assumes
what the parent repository is called.

---

## Generated files

Do not edit these files. The generator overwrites them, and CI fails on a
hand-edited copy.

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

The gate exists because this project has shipped the same hand-copied-constant
drift bug four separate times. A wrong NACK code in documentation does more
harm than one in source: implementers trust documentation and nothing compiles
it, and a stale copy of the specification is the most trusted instance.

Each generator also refuses to run on an unclaimed source: `registry.yaml`
growing a section no page documents, or `SPEC.md` growing a clause no page
publishes.

Editing the Dictionary means editing `dictionary.yaml`. One source produces
both the Dictionary page and the site-wide hover definitions.

### The Specification tier

`docs/spec/**` is a **build product**. The editable source is `spec/SPEC.md`
in this repository, and normative text is copied into the site verbatim.
The generator adds the following:

- **the split.** The 1991 lines of SPEC.md become one page per concern. Clause
  numbering is untouched, so §6.4 is §6.4 on every page that publishes it.
- **number-derived anchors.** `§n` → `#sn`, `§n.m` → `#sn-m`, Appendix X →
  `#appendix-x`, trace En → `#en`. Nothing is slugified from heading text, so
  rewording a heading cannot break an inbound citation.
- **cross-reference rewriting.** Every `§n.m` in the prose becomes a link to
  wherever that clause landed. An unresolvable reference is a hard error at
  generation time; every emitted link is anchor-checked by
  `mkdocs build --strict`.
- **companion links.** Repo-relative links in SPEC.md resolve through the
  generator's `SOURCE_LINKS` table. An unlisted target is a hard error, so a
  new companion artifact cannot be published as a dead link.

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
`latest` alias, and adds the version selector to the header. A reader can
link to the exact version they implemented.

### `site_url`

`mkdocs.yml` reads `site_url` from `$VALENCE_SITE_URL`, defaulting to
`https://valence.invalid/`. `.invalid` is the reserved placeholder TLD
(RFC 2606): if it appears in a deployed sitemap, the deploy did not set the
variable.

CI computes the correct GitHub Pages origin from the repository context, so it
needs no configuration. Set the repository variable `VALENCE_SITE_URL` to
override it with a custom domain.

---

## Channel-grid page

`docs/reference/channel-grid.md` is a static summary of `spec/CHANNEL-GRID.md`.
An interactive grid is a planned addition. It would read a hub-agnostic
catalog, such as one from Valence Bench, instead of one machine's.

The page was previously generated by `docs-site/tools/gen_channel_grid_page.py`.
That script imports the repository-root generators `tools/gen_channel_map.py`
and `tools/gen_channel_grid.py`, which parse a live device's catalog. Those
generators stay in Nucleus, because the device-channel allocations belong to
that machine and not to the protocol. Neither the script nor its generated page
exists in this repository.

## Extraction history

This directory was extracted from the Nucleus repository by a plain file copy
into a fresh-history repository. `git subtree split` and filter-repo were ruled
out. The extraction needed a three-line `site.config.yml` change and a workflow
move: `.github/workflows/docs.yml` was copied in, and its
`working-directory: docs-site` block and `docs-site/`-prefixed `paths` entries
were deleted.

---

## Custom domain

Set up the custom domain before the first public deploy.

Publishing straight to `https://<org>.github.io/<repo>/` ties every URL on the
site to an organization name and a repository name. Renaming either one after
people have linked to the site, cited a clause, or pinned a specification
version breaks every one of those links.

Serve the site from a custom domain from the first deploy:

1. Register a domain and point a `CNAME` record at `<org>.github.io`. For an
   apex domain, use the `A`/`AAAA` records GitHub publishes instead.
2. Put the bare hostname in `docs/CNAME`: one line, no scheme, no trailing
   slash. `mkdocs build` copies anything in `docs/` into the site, so the file
   survives every deploy. With `mike`, confirm it lands at the root of the
   `gh-pages` branch and not inside a version directory.
3. Set `VALENCE_SITE_URL` to the same origin, so canonical links and
   `sitemap.xml` match the served origin.
4. Enable **Enforce HTTPS** in the repository's Pages settings.

If the repository moves, only the DNS record changes, and every published URL,
including the version trees, keeps working.

---

## See also

- `docs/community/contributing.md`: the writing rules, stubs and generated pages.
- `docs/community/governance.md`: the governance policy.
