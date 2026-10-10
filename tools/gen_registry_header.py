#!/usr/bin/env python3
"""Generate the committed C++ and JS vocabulary artifacts from
spec/registry/registry.yaml — the single source of truth.

    lib/valence/include/valence/generated/registry_constants.hpp
    clients/js/generated/registry_vocab.js

Usage:
    python tools/gen_registry_header.py           # (re)write both artifacts
    python tools/gen_registry_header.py --check   # exit 1 if either is stale

Run with PlatformIO's bundled python (has PyYAML):
    %USERPROFILE%\\.platformio\\penv\\Scripts\\python.exe tools/gen_registry_header.py

Both artifacts are COMMITTED: ESP32/Arduino builds must never need python, and
neither must a browser loading clients/js — the module is imported directly, so
a build step is not available to generate it on the fly (RFC-052(c)).
SPEC.md rule: on any conflict, registry.yaml wins — this script is how it wins.
"""
import sys
import io
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "spec" / "registry" / "registry.yaml"
OUT = ROOT / "lib" / "valence" / "include" / "valence" / "generated" / "registry_constants.hpp"
OUT_JS = ROOT / "clients" / "js" / "generated" / "registry_vocab.js"


# Registry names become C++ identifiers, so they may not collide with a
# keyword. Caught here with a pointed message rather than 200 lines later as
# "expected unqualified-id before 'namespace'".
CPP_KEYWORDS = {
    "alignas", "alignof", "and", "asm", "auto", "bool", "break", "case", "catch",
    "char", "class", "concept", "const", "consteval", "constexpr", "constinit",
    "const_cast", "continue", "co_await", "co_return", "co_yield", "decltype",
    "default", "delete", "do", "double", "dynamic_cast", "else", "enum",
    "explicit", "export", "extern", "false", "float", "for", "friend", "goto",
    "if", "inline", "int", "long", "mutable", "namespace", "new", "noexcept",
    "not", "nullptr", "operator", "or", "private", "protected", "public",
    "register", "reinterpret_cast", "requires", "return", "short", "signed",
    "sizeof", "static", "static_assert", "static_cast", "struct", "switch",
    "template", "this", "thread_local", "throw", "true", "try", "typedef",
    "typeid", "typename", "union", "unsigned", "using", "virtual", "void",
    "volatile", "wchar_t", "while", "xor",
}


def ident(name: str) -> str:
    """Sanitize a registry name into a C++ identifier.

    Dashes and dots both become underscores: `session-roster` -> session_roster,
    `limit.jog.speed` -> limit_jog_speed (field_roles are dotted tstr values).
    """
    out = name.replace("-", "_").replace(".", "_")
    if out in CPP_KEYWORDS:
        raise SystemExit(
            f"registry name '{name}' generates the C++ keyword '{out}' — "
            f"pick a different name in registry.yaml (the wire number is "
            f"unaffected; only the generated identifier changes)."
        )
    return out


def esc(text: str) -> str:
    """Escape a registry string for a C++ string literal."""
    return text.replace("\\", "\\\\").replace('"', '\\"')


def emit_bits(p, section: dict, ns: str) -> None:
    """Emit a bit-flag section (`bitN: {name, note|ref}`) as a namespace."""
    p(f"namespace {ns} {{\n")
    for bit in sorted(section, key=lambda b: int(b.removeprefix("bit"))):
        e = section[bit]
        shift = int(bit.removeprefix("bit"))
        why = e.get("ref") or e.get("note", "")
        p(f"inline constexpr uint8_t {ident(e['name'])} = 1u << {shift};  // {why}\n")
    p(f"}}  // namespace {ns}\n\n")


def retired(entry: dict) -> bool:
    """A `status: retired` row is burned: listed in the registry, never emitted
    as a usable identifier, so no generated code can send it."""
    return entry.get("status") == "retired"


def live_categories(reg: dict) -> list:
    """(id, row) for every live `ui_categories` row, in registry order."""
    cats = reg["ui_categories"]
    return [(k, cats[k]) for k in sorted(cats) if not retired(cats[k])]


def emit_category_tiers(p, reg: dict) -> None:
    """RFC-094: tier membership as a per-category attribute and as an
    iterable table (RENDERING.md §3)."""
    cats = live_categories(reg)
    tiers = reg["ui_nav_tiers"]
    p("namespace ui_category_tiers {\n")
    for k, e in cats:
        p(f"inline constexpr uint8_t {ident(e['name'])} = {e['tier']};  // {tiers[e['tier']]['name']}\n")
    p("}  // namespace ui_category_tiers\n\n")
    p("struct UiCategoryTier {\n    uint8_t category;\n    uint8_t tier;\n};\n\n")
    p("// Registry order: tiers draw in id order, categories in this order within a tier.\n")
    p("inline constexpr UiCategoryTier kUiCategoryTiers[] = {\n")
    for k, e in cats:
        p(f"    {{{k}, {e['tier']}}},  // {e['name']}\n")
    p("};\n\n")
    p("// Vendor, retired and unrecognized ids are tier 1: they render under `other`.\n")
    p("constexpr uint8_t uiCategoryTier(uint8_t category) {\n")
    p("    for (const UiCategoryTier& e : kUiCategoryTiers) {\n")
    p("        if (e.category == category) return e.tier;\n")
    p("    }\n")
    p("    return ui_nav_tiers::machine;\n")
    p("}\n\n")


def gen(reg: dict) -> str:
    w = io.StringIO()
    p = w.write
    meta = reg["meta"]

    p("// ============================================================================\n")
    p("// GENERATED FILE — DO NOT EDIT.\n")
    p("// Source of truth: spec/registry/registry.yaml\n")
    p("// Regenerate:      python tools/gen_registry_header.py   (--check in CI)\n")
    p("// ============================================================================\n")
    p("#pragma once\n\n")
    p("#include <cstdint>\n#include <string_view>\n\n")
    p("namespace valence {\n\n")

    p(f"inline constexpr uint8_t  kProtocolVersion = {meta['protocol_version']};\n")
    p(f"inline constexpr uint8_t  kHeaderBytes     = {meta['header_bytes']};\n\n")

    # ---- Frame types --------------------------------------------------------
    p("enum class FrameType : uint8_t {\n")
    for code in sorted(reg["frame_types"]):
        e = reg["frame_types"][code]
        p(f"    {e['name']} = 0x{code:02X},  // {e['dir']}, {e['plane']}, {e['ref']}\n")
    p("};\n\n")

    # ---- Header flags -------------------------------------------------------
    emit_bits(p, reg["header_flags"], "flags")

    # ---- Simple u8 enums ----------------------------------------------------
    for section, cpp in (("channel_classes", "ChannelClass"),
                         ("access_levels", "AccessLevel"),
                         ("priority_classes", "Priority"),
                         ("packed_field_types", "PackedFieldType")):
        p(f"enum class {cpp} : uint8_t {{\n")
        for code in sorted(reg[section]):
            p(f"    {ident(reg[section][code]['name'])} = {code},\n")
        p("};\n\n")

    # ---- Core channels ------------------------------------------------------
    p("namespace channels {\n")
    for cid in sorted(reg["core_channels"]):
        e = reg["core_channels"][cid]
        p(f"inline constexpr uint16_t {ident(e['name'])} = 0x{cid:04X};  // {e['class']}: {note_text(e)}\n")
    p("}  // namespace channels\n\n")

    # ---- CBOR keys ----------------------------------------------------------
    p("enum class CborKey : uint8_t {\n")
    for k in sorted(reg["cbor_keys"]):
        e = reg["cbor_keys"][k]
        if retired(e):
            p(f"    // {k} {e['name']}: {e['note']}\n")
            continue
        p(f"    {ident(e['name'])} = {k},  // {e['type']}: {e['note']}\n")
    p("};\n\n")

    # ---- Scoped sub-map key spaces (not the global cbor_keys space) --------
    #      ...plus the small u8 enums that are values inside those spaces.
    for section, ns in (("welcome_limits_keys", "welcome_limits"),
                        ("probe_result_keys", "probe_result"),
                        ("identity_keys", "identity"),
                        ("blob_keys", "blob"),
                        ("trust_keys", "trust"),
                        ("trust_ledger_keys", "trust_ledger"),
                        ("trust_states", "trust_states"),
                        ("presentation_modes", "presentation_modes"),
                        ("blob_namespaces", "blob_ns"),
                        ("session_event_kinds", "session_events"),
                        ("log_event_kinds", "log_events"),
                        ("pairing_event_kinds", "pairing_events"),
                        ("safety_event_kinds", "safety_events"),
                        ("log_levels", "log_levels"),
                        ("safety_intent_ops", "safety_ops"),
                        ("session_admin_ops", "session_admin_ops"),
                        ("safety_causes", "safety_causes"),
                        ("source_kinds", "source_kinds"),
                        ("stream_kinds", "stream_kinds"),
                        ("procedure_phases", "procedure_phases"),
                        ("curve_families", "curve_families"),
                        ("osc_shapes", "osc_shapes"),
                        ("osc_drives", "osc_drives"),
                        # ---- RFC-047/048 rendering metamodel (Phase C2) ----
                        # setting_categories is RETIRED (tombstoned in registry.yaml);
                        # ui_categories is its wire-key-10 successor vocabulary.
                        ("ui_categories", "ui_categories"),
                        ("ui_nav_tiers", "ui_nav_tiers"),
                        ("ui_ranks", "ui_ranks"),
                        ("value_aspects", "value_aspects"),
                        ("value_scopes", "value_scopes"),
                        ("value_provenance", "value_provenance"),
                        ("unit_ids", "unit_ids"),
                        ("store_ops", "store_ops"),
                        ("provisioning_ops", "provisioning_ops"),
                        ("accessory_admin_ops", "accessory_admin_ops"),
                        ("trial_ops", "trial_ops"),
                        ("join_results", "join_results"),
                        ("accessory_record_keys", "accessory_record"),
                        ("accessory_states", "accessory_states"),
                        ("relationship_maps", "relationship_maps"),
                        ("relationship_keys", "relationship")):
        p(f"namespace {ns} {{\n")
        for k in sorted(reg[section]):
            e = reg[section][k]
            if retired(e):
                p(f"// {k} {e['name']}: {e['note']}\n")
                continue
            p(f"inline constexpr uint8_t {ident(e['name'])} = {k};  // {e['note']}\n")
        p(f"}}  // namespace {ns}\n\n")

    emit_category_tiers(p, reg)

    # ---- Bit-flag spaces ----------------------------------------------------
    emit_bits(p, reg["setting_flags"], "setting_flags")
    emit_bits(p, reg["pairing_modes"], "pairing_modes")
    emit_bits(p, reg["beacon_flags"], "beacon_flags")
    emit_bits(p, reg["discover_reply_flags"], "discover_reply_flags")
    emit_bits(p, reg["plan_flags"], "plan_flags")

    # ---- Field roles --------------------------------------------------------
    # These are TSTR values on the wire (dotted namespace, device-extensible),
    # not an integer enum — RFC-019's `action.<name>` roles carry a
    # device-chosen suffix that no enum can express.
    for section in ("field_roles", "channel_roles"):
        p(f"namespace {section} {{\n")
        for role in reg[section]:  # registry order
            e = reg[section][role] or {}
            p(f'inline constexpr std::string_view {ident(role)} = "{esc(role)}";  // {e.get("note", "")}\n')
        p(f"}}  // namespace {section}\n\n")

    # ---- NACK codes ---------------------------------------------------------
    p("enum class NackCode : uint16_t {\n")
    for code in sorted(reg["nack_codes"]):
        e = reg["nack_codes"][code]
        p(f"    {e['name']} = 0x{code:04X},  // {e['note']}\n")
    p("};\n\n")

    # ---- Limits and the UDP discovery constants -----------------------------
    for section in ("limits", "udp_discovery"):
        p(f"namespace {section} {{\n")
        for key in reg[section]:  # preserve registry order — it groups related values
            v = reg[section][key]
            if isinstance(v, str):
                p(f'inline constexpr std::string_view {ident(key)} = "{v}";\n')
            elif isinstance(v, float):
                p(f"inline constexpr float {ident(key)} = {v}f;\n")
            elif v < 0:
                p(f"inline constexpr int32_t {ident(key)} = {v};\n")
            else:
                p(f"inline constexpr uint32_t {ident(key)} = {v};\n")
        p(f"}}  // namespace {section}\n\n")

    p("}  // namespace valence\n")
    return w.getvalue()


# ============================================================================
# JS vocabulary emitter (RFC-052(c))
# ============================================================================
#
# Export names are chosen to MATCH what clients/js/frames.js already published,
# so adopting this module is a deletion on the consumer side and no downstream
# import changes. The one deliberate rename is SETTING_CATEGORY* -> UI_CATEGORY*:
# `setting_categories` is tombstoned in registry.yaml and its hand-copy was the
# stale table that motivated this RFC (a 5-entry 0-based array standing in for a
# 14-entry 1-based vocabulary — every category name it produced was wrong).

# (JS export, registry section, reverse-map?, hex nibbles or 0 for decimal)
JS_CODE_TABLES = (
    ("FRAME",              "frame_types",         True,  2),
    ("CHANNEL_CLASS",      "channel_classes",     True,  0),
    ("ACCESS",             "access_levels",       True,  0),
    ("PRIORITY",           "priority_classes",    True,  0),
    ("PACKED",             "packed_field_types",  True,  0),
    ("CORE_CHANNEL",       "core_channels",       True,  4),
    ("K",                  "cbor_keys",           True,  0),
    ("WELCOME_LIMITS_K",   "welcome_limits_keys", False, 0),
    ("PROBE_RESULT_K",     "probe_result_keys",   False, 0),
    ("IDENTITY_K",         "identity_keys",       False, 0),
    ("BLOB_K",             "blob_keys",           False, 0),
    ("TRUST_K",            "trust_keys",          False, 0),
    ("TRUST_LEDGER_K",     "trust_ledger_keys",   False, 0),
    ("TRUST_STATE",        "trust_states",        True,  0),
    ("PRESENTATION_MODE",  "presentation_modes",  True,  0),
    ("BLOB_NS",            "blob_namespaces",     True,  0),
    ("SESSION_EVENT_KIND", "session_event_kinds", True,  0),
    ("LOG_EVENT_KIND",     "log_event_kinds",     True,  0),
    ("PAIRING_EVENT_KIND", "pairing_event_kinds", True,  0),
    ("SAFETY_EVENT_KIND",  "safety_event_kinds",  True,  0),
    ("LOG_LEVEL",          "log_levels",          True,  0),
    ("SAFETY_OP",          "safety_intent_ops",   True,  0),
    ("SESSION_ADMIN_OP",   "session_admin_ops",   True,  0),
    ("SAFETY_CAUSE",       "safety_causes",       True,  0),
    ("SOURCE_KIND",        "source_kinds",        True,  0),
    ("STREAM_KIND",        "stream_kinds",        True,  0),
    ("PROCEDURE_PHASE",    "procedure_phases",    True,  0),
    ("CURVE_FAMILY",       "curve_families",      True,  0),
    ("OSC_SHAPE",          "osc_shapes",          True,  0),
    ("OSC_DRIVE",          "osc_drives",          True,  0),
    ("NACK",               "nack_codes",          True,  4),
    # ---- RFC-047/048 rendering metamodel: the vocabularies a renderer needs --
    ("UI_CATEGORY",        "ui_categories",       True,  0),
    ("UI_NAV_TIER",        "ui_nav_tiers",        True,  0),
    ("UI_RANK",            "ui_ranks",            True,  0),
    ("VALUE_ASPECT",       "value_aspects",       True,  0),
    ("VALUE_SCOPE",        "value_scopes",        True,  0),
    ("VALUE_PROVENANCE",   "value_provenance",    True,  0),
    ("UNIT_ID",            "unit_ids",            True,  0),
    ("STORE_OP",           "store_ops",           True,  0),
    ("PROVISIONING_OP",    "provisioning_ops",    True,  0),
    ("ACCESSORY_ADMIN_OP", "accessory_admin_ops", True,  0),
    ("TRIAL_OP",           "trial_ops",           True,  0),
    ("JOIN_RESULT",        "join_results",        True,  0),
    ("ACCESSORY_RECORD_K", "accessory_record_keys", False, 0),
    ("ACCESSORY_STATE",    "accessory_states",    True,  0),
    ("RELATIONSHIP_MAP",   "relationship_maps",   True,  0),
    ("RELATIONSHIP_K",     "relationship_keys",   False, 0),
    ("UI_ARCHETYPE",       "ui_archetypes",       True,  0),
    ("UI_REGION",          "ui_regions",          True,  0),
    ("RENDERER_CLASS",     "renderer_classes",    True,  0),
    ("WIDGET_PATTERN",     "widget_patterns",     True,  0),
)

# (JS export, registry section) — `bitN: {name, note|ref}` bit-flag spaces.
JS_BIT_TABLES = (
    ("SETTING_FLAG", "setting_flags"),
    ("PAIRING_MODE", "pairing_modes"),
    ("BLE_ADV_FLAG", "ble_adv_flags"),
    ("BEACON_FLAG",  "beacon_flags"),
    ("DISCOVER_REPLY_FLAG", "discover_reply_flags"),
    ("PLAN_FLAG", "plan_flags"),
)

# (JS export, registry section) — tstr-keyed spaces: the KEY is the wire value.
JS_TSTR_TABLES = (
    ("FIELD_ROLE", "field_roles"),
    ("CHANNEL_ROLE", "channel_roles"),
    ("ACTION_TAG", "action_tags"),
)


def js_ident(name: str) -> str:
    """Sanitize a registry name into a JS object-key identifier.

    Same dash/dot flattening as ident(); JS has no keyword collision problem
    here because reserved words are legal property names, so no keyword set.
    """
    return name.replace("-", "_").replace(".", "_")


def js_str(text: str) -> str:
    """A registry string as a single-quoted JS literal."""
    body = str(text).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{body}'"


def js_num(code: int, hex_nibbles: int) -> str:
    return f"0x{code:0{hex_nibbles}x}" if hex_nibbles else str(code)


def note_text(entry: dict) -> str:
    # A `layout:` key (the packed wire layout, RFC-097) leads the note so it
    # survives the JS one-liner's cut.
    note = entry.get("ref") or entry.get("note") or ""
    return f"layout {entry['layout']}; {note}" if entry.get("layout") else str(note)


def js_note(entry: dict) -> str:
    # Generated one-liners: a note that wraps stops being scannable, and the
    # authoritative prose lives in registry.yaml regardless.
    note = " ".join(note_text(entry).split())
    return f"  // {note[:96]}" if note else ""


def emit_category_tiers_js(p, reg: dict) -> None:
    """RFC-094: UI_CATEGORY_TIER is the per-category attribute (category id ->
    tier id); UI_NAV_TIER_CATEGORIES is the iterable table (tier id -> category
    ids in registry order). Vendor, retired and unrecognized ids are tier 1."""
    cats = live_categories(reg)
    p("// ---- ui_categories tier (RFC-094, RENDERING.md §3) " + "-" * 22 + "\n")
    p("export const UI_CATEGORY_TIER = {\n")
    for k, e in cats:
        p(f"  {k}: {e['tier']},  // {e['name']}\n")
    p("};\n")
    p("export const UI_NAV_TIER_CATEGORIES = {\n")
    for t in sorted(reg["ui_nav_tiers"]):
        ids = ", ".join(str(k) for k, e in cats if e["tier"] == t)
        p(f"  {t}: [{ids}],\n")
    p("};\n\n")


def gen_js(reg: dict) -> str:
    w = io.StringIO()
    p = w.write
    meta = reg["meta"]
    limits = reg["limits"]

    p("// ============================================================================\n")
    p("// GENERATED FILE — DO NOT EDIT.\n")
    p("// Source of truth: spec/registry/registry.yaml\n")
    p("// Regenerate:      python tools/gen_registry_header.py   (--check in CI)\n")
    p("//\n")
    p("// The JS twin of generated/registry_constants.hpp (RFC-052(c)). Committed\n")
    p("// because clients/js is imported directly by browsers — there is no build\n")
    p("// step available to generate it on demand.\n")
    p("// ============================================================================\n\n")

    p(f"export const PROTO_VER = {meta['protocol_version']};\n")
    p(f"export const HEADER_BYTES = {meta['header_bytes']};\n")
    p(f"export const WS_SUBPROTOCOL = {js_str(limits['ws_subprotocol'])};\n\n")

    for export, section, reverse, hexn in JS_CODE_TABLES:
        entries = reg[section]
        p(f"// ---- {section} " + "-" * max(1, 62 - len(section)) + "\n")
        live = [code for code in sorted(entries) if not retired(entries[code])]
        p(f"export const {export} = {{\n")
        for code in sorted(entries):
            e = entries[code]
            if retired(e):
                p(f"  // {js_num(code, hexn)} {e['name']}: {js_note(e)[5:]}\n")
                continue
            p(f"  {js_ident(e['name'])}: {js_num(code, hexn)},{js_note(e)}\n")
        p("};\n")
        if reverse:
            p(f"export const {export}_NAME = {{\n")
            for code in live:
                p(f"  {js_num(code, hexn)}: {js_str(entries[code]['name'])},\n")
            p("};\n")
        p("\n")
        if section == "ui_categories":
            emit_category_tiers_js(p, reg)

    for export, section in JS_BIT_TABLES:
        entries = reg[section]
        p(f"// ---- {section} (bit flags) " + "-" * max(1, 50 - len(section)) + "\n")
        bits = sorted(entries, key=lambda b: int(b.removeprefix("bit")))
        p(f"export const {export} = {{\n")
        for bit in bits:
            e = entries[bit]
            shift = int(bit.removeprefix("bit"))
            p(f"  {js_ident(e['name'])}: 1 << {shift},{js_note(e)}\n")
        p("};\n")
        # Keyed by the flag VALUE, not the bit index: callers hold a mask and
        # want the name of a bit they already isolated.
        p(f"export const {export}_NAME = {{\n")
        for bit in bits:
            shift = int(bit.removeprefix("bit"))
            p(f"  {1 << shift}: {js_str(entries[bit]['name'])},\n")
        p("};\n\n")

    for export, section in JS_TSTR_TABLES:
        entries = reg[section]
        p(f"// ---- {section} (tstr wire values) " + "-" * max(1, 42 - len(section)) + "\n")
        p(f"export const {export} = {{\n")
        for key in entries:  # registry order
            e = entries[key] or {}
            p(f"  {js_ident(key)}: {js_str(key)},{js_note(e)}\n")
        p("};\n\n")

    for section, export in (("limits", "LIMITS"), ("udp_discovery", "UDP_DISCOVERY")):
        p(f"// ---- {section} " + "-" * 62 + "\n")
        p(f"export const {export} = {{\n")
        for key in reg[section]:  # registry order — it groups related values
            v = reg[section][key]
            val = f"'{esc(v)}'" if isinstance(v, str) else repr(v)
            p(f"  {js_ident(key)}: {val},\n")
        p("};\n" if export == "UDP_DISCOVERY" else "};\n\n")
    return w.getvalue()


def check_or_write(path: Path, text: str, label: str) -> int:
    if "--check" in sys.argv:
        current = path.read_text(encoding="utf-8") if path.exists() else ""
        if current != text:
            print(f"STALE: {path} does not match {REGISTRY} — regenerate.", file=sys.stderr)
            return 1
        print(f"{label} up to date")
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {path}")
    return 0


def main() -> int:
    reg = yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))
    # Both artifacts are evaluated even if the first is stale, so one run reports
    # every regeneration owed instead of one per invocation.
    rc = check_or_write(OUT, gen(reg), "registry header")
    rc |= check_or_write(OUT_JS, gen_js(reg), "registry JS vocabulary")
    return rc


if __name__ == "__main__":
    sys.exit(main())
