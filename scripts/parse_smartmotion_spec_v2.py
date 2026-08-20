#!/usr/bin/env python3
"""
Parses SmartMotion_App_22_Programme_Claude_MasterSpec_v2_126_Uebungen.md
into structured JSON seed data. This supersedes scripts/parse_smartmotion_
spec.py (v1) now that the spec covers the full 126-exercise library and
gives full 12-week block/session data for ALL 22 products (v1 only had
this for the 10 launch products; v2's own "V2-Änderung" section confirms
all 45 originally-planned + 10 new forearm exercises are integrated
across all 22 programs, and specifically that P21/P22 -- Tennis-/
Golferellenbogen -- are now fully programmable thanks to the new forearm
exercises even though they stay unpublished at launch per product
strategy).

Output (overwrites the v1-produced files -- v2 fully supersedes v1):
  - prisma/seed-data/smartmotion-exercise-registry.json  (all 126 E-codes)
  - prisma/seed-data/smartmotion-products-catalog.json   (all 22 products,
    catalog-level fields)
  - prisma/seed-data/smartmotion-programs.json           (full 12-week
    block/session/exercise structure for ALL 22 products)

Same mechanical-parsing rationale as v1: the source spec is large
(~2500 lines, ~1400 structured exercise references across 22 products)
and highly regular -- a script is far less error-prone than manual
re-typing at this scale, and reproducible if the spec is edited again.
"""
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = Path(os.environ.get(
    "SPEC_PATH",
    "/root/.claude/uploads/cecd8f7b-dfeb-561d-9bcd-46072e292b69/cf1fec49-SmartMotion_App_22_Programme_Claude_MasterSpec_v2_126_Uebungen.md",
))
OUT_DIR = ROOT / "prisma" / "seed-data"

LAUNCH_IDS = ["P01", "P02", "P03", "P04", "P05", "P06", "P08", "P09", "P15", "P18"]

PHASE_MAP = {
    "MoveFlexRelax": "INHIBIT",
    "MoveFlexStretch": "LENGTHEN",
    "MoveSyncActivation": "ACTIVATE",
    "MoveSyncIntegration": "INTEGRATE",
}


def phase_from_heading(heading: str) -> str:
    key = heading.split("–")[0].strip()
    if key not in PHASE_MAP:
        raise ValueError(f"Unknown phase heading: {heading!r}")
    return PHASE_MAP[key]


def phase_from_registry_column(raw: str) -> str:
    first = re.split(r"\s*/\s*", raw.strip())[0].strip()
    if first not in PHASE_MAP:
        raise ValueError(f"Unknown registry phase: {raw!r}")
    return PHASE_MAP[first]


def parse_registry(text: str):
    section = text.split("# 8. Exercise Master Registry", 1)[1].split("# 9. Coverage-Audit", 1)[0]
    rows = {}
    for line in section.splitlines():
        m = re.match(r"\|\s*(E\d{3})\s*\|\s*([^|]+?)\s*\|\s*(existing|planned_video)\s*\|\s*(.+?)\s*\|\s*$", line)
        if not m:
            continue
        code, phase_raw, status, name = m.groups()
        rows[code] = {
            "code": code,
            "phaseRaw": phase_raw,
            "phase": phase_from_registry_column(phase_raw),
            "status": status,
            "name": name.strip(),
        }
    assert len(rows) == 126, f"expected 126 registry rows, got {len(rows)}"
    return rows


# v1's tag was always exactly `[BESTEHEND]` or `[GEPLANT/NOCH ZU FILMEN]`.
# v2 additionally uses richer per-exercise annotations in a few places
# (mostly P21/P22, the two forearm programs) -- e.g. `[BESTEHEND, optional]`,
# `[GEPLANT/NOCH ZU FILMEN, sehr leichte Last]`, or just `[optional]` with
# no status at all on repeat Session A/B mentions. The bracket tag is
# captured generically here and classified in parse_exercise_refs()
# against BESTEHEND/GEPLANT substrings, falling back to the exercise
# registry's existing/planned_video status by code when the tag carries
# no status info (e.g. bare `[optional]`) or is absent entirely.
EXERCISE_REF_RE = re.compile(r"\*\*(E\d{3})\s*–\s*(.+?)\*\*(?:\s*`\[([^\]]*)\]`)?")


def parse_exercise_refs(line: str, registry: dict):
    refs = []
    for code, name, tag in EXERCISE_REF_RE.findall(line):
        tag = tag or ""
        if "GEPLANT" in tag:
            raw_status = "GEPLANT/NOCH ZU FILMEN"
        elif "BESTEHEND" in tag:
            raw_status = "BESTEHEND"
        else:
            # No (usable) inline tag -- fall back to the registry's
            # authoritative status for this code.
            reg = registry.get(code)
            if reg is None:
                raw_status = None
            else:
                raw_status = "BESTEHEND" if reg["status"] == "existing" else "GEPLANT/NOCH ZU FILMEN"
        refs.append({"code": code, "name": name.strip(), "raw_status": raw_status, "tagRaw": tag or None})
    return refs


def parse_session_block(block_text: str, registry: dict):
    result = {}
    for line in block_text.splitlines():
        line = line.strip()
        if not line.startswith("- **"):
            continue
        heading, _, rest = line[3:].partition(":**")
        heading = heading.strip("* ")
        phase = phase_from_heading(heading)
        refs = parse_exercise_refs(rest, registry)
        result[phase] = refs
    return result


def parse_product_section(pid: str, title: str, body: str, registry: dict):
    def field(name):
        m = re.search(rf"\*\*{name}:\*\*\s*(.+)", body)
        return m.group(1).strip() if m else None

    kategorie = field("Kategorie")
    slug = field("Slug")
    if slug:
        slug = slug.strip("`")
    launch = field("Launch")
    status = field("Status")
    if status:
        status = status.strip("`")
    preis = field("Preis")

    hook_m = re.search(r"\*\*Hook:\*\*\s*(.+)", body)
    hook = hook_m.group(1).strip() if hook_m else None

    desc_m = re.search(r"\*\*Hook:\*\*.+?\n\n(.+?)\n\n\*\*Für dich, wenn:\*\*", body, re.S)
    description = desc_m.group(1).strip() if desc_m else None

    for_you_m = re.search(r"\*\*Für dich, wenn:\*\*\s*(.+)", body)
    for_you = for_you_m.group(1).strip() if for_you_m else None

    cta_m = re.search(r"\*\*CTA:\*\*\s*`(.+?)`", body)
    cta = cta_m.group(1).strip() if cta_m else None

    freq_m = re.search(r"\*\*Trainingsfrequenz:\*\*\s*(.+)", body)
    frequency = freq_m.group(1).strip() if freq_m else None

    tr_m = re.search(r"### Test & Re-Test\s*\n(.+?)(?=\n###|\n## |\Z)", body, re.S)
    test_retest_raw = tr_m.group(1).strip() if tr_m else None
    special_logic = None
    test_retest = test_retest_raw
    if test_retest_raw:
        # Most products label this "Speziallogik"; P21/P22 (the two
        # forearm/tendon programs) instead use "Progressionsregel speziell
        # für dieses Programm" -- same role (a product-specific
        # safety/progression-gating note beyond the global rules), just a
        # different label, so both are captured into specialLogicNote.
        sl_m = re.search(
            r"\*\*(?:Speziallogik|Progressionsregel speziell für dieses Programm):\*\*\s*(.+)",
            test_retest_raw,
            re.S,
        )
        if sl_m:
            special_logic = sl_m.group(1).strip()
            test_retest = test_retest_raw[: sl_m.start()].strip()

    product = {
        "id": pid,
        "title": title,
        "category": "HALTUNG" if kategorie == "Haltung" else "BESCHWERDEN_RETURN_TO_MOVEMENT",
        "slug": slug,
        "launch": launch == "JA",
        "contentStatus": status,
        "priceRaw": preis,
        "hook": hook,
        "description": description,
        "forYou": for_you,
        "cta": cta,
        "frequency": frequency,
        "testRetestProtocol": test_retest,
        "specialLogicNote": special_logic,
    }

    # v2: EVERY product now has full 12-week block/session data (not just
    # launch products, unlike v1) -- see module docstring.
    blocks = []
    # Week-block headings are normally bare ("#### W1-4") but a few
    # products (P21/P22) append a descriptive suffix on the same line
    # ("#### W1-4 – Reiz kontrollieren & Belastung wieder zulassen") --
    # [^\n]* absorbs that instead of requiring a bare newline right after
    # the week range.
    for wm in re.finditer(
        r"#### W(\d+)-(\d+)[^\n]*\n(.+?)(?=\n#### W|\n\*\*Abschluss:|\Z)", body, re.S
    ):
        week_start, week_end, block_body = int(wm.group(1)), int(wm.group(2)), wm.group(3)

        prog_m = re.search(r"\*\*Progressionskriterium[^:]*:\*\*\s*(.+)", block_body)
        progression_rule = prog_m.group(1).strip() if prog_m else None

        sessions = {}
        for label in ("A", "B"):
            sm = re.search(
                rf"\*\*Session {label}:\*\*\s*\n(.+?)(?=\n\*\*Session|\n\*\*Progressionskriterium|\n\*\*Dosierung|\Z)",
                block_body,
                re.S,
            )
            if sm:
                sessions[label] = parse_session_block(sm.group(1), registry)

        blocks.append(
            {
                "weekStart": week_start,
                "weekEnd": week_end,
                "progressionRule": progression_rule,
                "sessions": sessions,
            }
        )

    abschluss_m = re.search(r"\*\*Abschluss:\*\*\s*(.+)", body)
    program = {
        "id": pid,
        "blocks": blocks,
        "abschluss": abschluss_m.group(1).strip() if abschluss_m else None,
    } if blocks else None

    return product, program


def main():
    text = SPEC.read_text(encoding="utf-8")

    registry = parse_registry(text)

    catalog_section = text.split("# 7. Produktkatalog", 1)[1].split("# 8. Exercise Master Registry", 1)[0]
    product_sections = re.split(r"\n## (P\d{2}) – (.+?)\n", catalog_section)
    products = {}
    programs = {}
    it = iter(product_sections[1:])
    for pid, title, body in zip(it, it, it):
        product, program = parse_product_section(pid, title.strip(), body, registry)
        products[pid] = product
        if program:
            programs[pid] = program

    assert len(products) == 22, f"expected 22 products, got {len(products)}"
    assert len(programs) == 22, f"expected all 22 products to have full block/session data, got {len(programs)}"
    launch_from_field = {pid for pid, p in products.items() if p["launch"]}
    assert launch_from_field == set(LAUNCH_IDS), (
        f"launch flags don't match expected launch set: spec says {sorted(launch_from_field)}, expected {sorted(LAUNCH_IDS)}"
    )

    # Preserve matchedSeedName/matchedSeedSource provenance from the
    # existing registry file (written by scripts/match_smartmotion_
    # exercises.py in Round 2) for codes that already have it -- this
    # v2 parser only re-derives code/phase/status/name from the spec's
    # own table and would otherwise silently drop that enrichment.
    existing_registry_path = OUT_DIR / "smartmotion-exercise-registry.json"
    existing_by_code = {}
    if existing_registry_path.exists():
        try:
            existing_by_code = {r["code"]: r for r in json.loads(existing_registry_path.read_text(encoding="utf-8"))}
        except (json.JSONDecodeError, KeyError):
            existing_by_code = {}
    registry_out = []
    for code, row in registry.items():
        prior = existing_by_code.get(code, {})
        registry_out.append({
            **row,
            "matchedSeedName": prior.get("matchedSeedName"),
            "matchedSeedSource": prior.get("matchedSeedSource"),
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "smartmotion-exercise-registry.json").write_text(
        json.dumps(registry_out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT_DIR / "smartmotion-products-catalog.json").write_text(
        json.dumps(list(products.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (OUT_DIR / "smartmotion-programs.json").write_text(
        json.dumps(list(programs.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"Parsed {len(registry)} registry rows, {len(products)} products, {len(programs)} full programs.")

    unknown = set()
    ref_count = 0
    for program in programs.values():
        for block in program["blocks"]:
            for session in block["sessions"].values():
                for refs in session.values():
                    for ref in refs:
                        ref_count += 1
                        if ref["code"] not in registry:
                            unknown.add(ref["code"])
                        elif ref["name"] != registry[ref["code"]]["name"]:
                            print(
                                f"  WARN name mismatch {ref['code']}: session says {ref['name']!r}, registry says {registry[ref['code']]['name']!r}"
                            )
    print(f"{ref_count} total exercise references across all 22 programs' sessions.")
    if unknown:
        print(f"UNKNOWN CODES referenced but not in registry: {sorted(unknown)}")
    else:
        print("All referenced E-codes resolve against the registry. OK.")


if __name__ == "__main__":
    main()
