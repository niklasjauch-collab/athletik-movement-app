#!/usr/bin/env python3
"""
Merges prisma/seed-data/filming-guide-parsed.json (55 exercises, see
scripts/parse_filming_guide_55.py) into:

  - prisma/seed-data/draft-exercises.json   (guide #1-3  -> E072-E074, enrich in place)
  - prisma/seed-data/smartmotion-stub-exercises.json
        (guide #4-45 minus #41 -> E075-E116 except E112, enrich in place;
         guide #41              -> E112, new entry;
         guide #46-55           -> E117-E126, new entries)
  - prisma/seed-data/smartmotion-exercise-registry.json (append E117-E126)

Run once: python3 scripts/merge_filming_guide_into_seed_data.py
"""
import json
import math

SEED_DIR = "prisma/seed-data"

with open(f"{SEED_DIR}/filming-guide-parsed.json", encoding="utf-8") as f:
    guide = {d["smartMotionCode"]: d for d in json.load(f)}

# ---------------------------------------------------------------
# 1. Enrich draft-exercises.json (E072-E074)
# ---------------------------------------------------------------
with open(f"{SEED_DIR}/draft-exercises.json", encoding="utf-8") as f:
    draft = json.load(f)

draft_by_code_order = ["E072", "E073", "E074"]
assert len(draft) == 3
for entry, code in zip(draft, draft_by_code_order):
    g = guide[code]
    entry["startPosition"] = entry.get("startPosition") or g["startPosition"]
    entry["execution"] = entry.get("execution") or g["execution"]
    if not entry.get("coachingCues"):
        entry["coachingCues"] = g["coachingCues"]
    if not entry.get("commonMistakes"):
        entry["commonMistakes"] = g["commonMistakes"]
    if g["camera"]:
        cam_note = f"Kamera (Filming Guide): {g['camera']}"
        entry["notes"] = (entry["notes"] + " " + cam_note) if entry.get("notes") else cam_note
    entry.setdefault("productionRound", math.ceil(g["guideNumber"] / 3))

with open(f"{SEED_DIR}/draft-exercises.json", "w", encoding="utf-8") as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)
    f.write("\n")

# ---------------------------------------------------------------
# 2. Enrich smartmotion-stub-exercises.json (E075-E116 except E112),
#    add E112, add E117-E126
# ---------------------------------------------------------------
with open(f"{SEED_DIR}/smartmotion-stub-exercises.json", encoding="utf-8") as f:
    stubs = json.load(f)

stub_by_code = {s["smartMotionCode"]: s for s in stubs}

DEFAULT_PLACEHOLDER = dict(sets=[10, 10], pauseSeconds=30, intensity="medium")


def enrich_common_fields(entry, g):
    entry["nameEn"] = g["nameEn"] if g["nameEn"] else entry.get("nameEn")
    if g["nameDe"]:
        entry["name"] = g["nameDe"]
    entry["startPosition"] = g["startPosition"]
    entry["execution"] = g["execution"]
    entry["coachingCues"] = g["coachingCues"]
    entry["commonMistakes"] = g["commonMistakes"]
    if g["contraindicationNote"]:
        entry["contraindicationNote"] = g["contraindicationNote"]
    if g["equipment"]:
        entry["equipment"] = g["equipment"]
    entry["productionRound"] = 16 if g["guideNumber"] > 45 else math.ceil(g["guideNumber"] / 3)
    cam_note = f"Kamera (Filming Guide): {g['camera']}" if g["camera"] else None
    base_note = entry.get("notes") or ""
    if cam_note and cam_note not in base_note:
        entry["notes"] = (base_note + " " + cam_note).strip()
    return entry


enriched = 0
for code, entry in stub_by_code.items():
    if code not in guide:
        continue
    enrich_common_fields(entry, guide[code])
    enriched += 1

# E112 is missing from the stub file entirely (guide #41) -- add it,
# matching the field shape/placeholder-dosage convention of its siblings
# E111 ("Split Squat + Contralateral Press") / E113 ("Step-Up + ...").
if "E112" not in stub_by_code:
    g = guide["E112"]
    new_entry = {
        "smartMotionCode": "E112",
        "name": g["nameDe"] or g["title"],
        "nameEn": g["nameEn"],
        "correctivePhase": g["correctivePhase"],
        "unit": "Wiederholungen",
        **DEFAULT_PLACEHOLDER,
        "muscleGroups": [],
        "equipment": g["equipment"],
        "targetMuscles": [],
        "taggingSource": None,
        "isPublished": False,
        "notes": (
            "Platzhalter aus der SmartMotion-Programmspezifikation (E112, Registry Abschnitt 8) -- "
            "Name und Phase sind verbindlich, aber Video und exakte Dosierung stammen noch nicht aus der "
            "SmartMotionApproach-Produktionspipeline (siehe README). sets/unit/pauseSeconds hier sind ein "
            "vorläufiger Platzhalter aus der globalen Wochen-1-4-Dosierung (Spec Abschnitt 3), nicht "
            "exercise-spezifisch validiert."
        ),
        "startPosition": g["startPosition"],
        "execution": g["execution"],
        "coachingCues": g["coachingCues"],
        "commonMistakes": g["commonMistakes"],
        "contraindicationNote": g["contraindicationNote"],
        "productionRound": math.ceil(g["guideNumber"] / 3),
    }
    stub_by_code["E112"] = new_entry
    stubs.append(new_entry)

# E117-E126: 10 brand-new elbow/forearm exercises, not previously in any
# seed file at all.
new_forearm_count = 0
for code, g in sorted(guide.items()):
    if g["guideNumber"] <= 45:
        continue
    if code in stub_by_code:
        continue
    entry = {
        "smartMotionCode": code,
        "name": g["nameDe"] or g["title"],
        "nameEn": g["nameEn"],
        "correctivePhase": g["correctivePhase"],
        "unit": g["unit"],
        **DEFAULT_PLACEHOLDER,
        "muscleGroups": ["Unterarm"],
        "equipment": g["equipment"],
        "targetMuscles": [],
        "taggingSource": "manual",
        "isPublished": False,
        "notes": (
            f"Platzhalter aus dem SmartMotionApproach Filming Guide ({code}, neue Ellenbogen-/"
            f"Unterarm-Ergänzung Nr. {g['guideNumber']}, siehe 'Ergänzung – 10 neue Ellenbogen-/"
            "Unterarmübungen'). Name, Phase, Ausgangsposition, Ausführung, Coaching-Cues und 'Nicht so "
            "filmen' stammen aus dem Filming Guide; Video steht noch aus. sets/unit/pauseSeconds hier sind "
            "ein vorläufiger Platzhalter, nicht exercise-spezifisch validiert. Diese 10 Übungen tragen "
            "u. a. P21 (Tennisellenbogen) und P22 (Golferellenbogen) zur Content-Vollständigkeit."
        ),
        "startPosition": g["startPosition"],
        "execution": g["execution"],
        "coachingCues": g["coachingCues"],
        "commonMistakes": g["commonMistakes"],
        "contraindicationNote": g["contraindicationNote"],
        "productionRound": 16,
    }
    if g["camera"]:
        entry["notes"] += f" Kamera (Filming Guide): {g['camera']}"
    stubs.append(entry)
    new_forearm_count += 1

with open(f"{SEED_DIR}/smartmotion-stub-exercises.json", "w", encoding="utf-8") as f:
    json.dump(stubs, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"draft-exercises.json: enriched 3 entries (E072-E074)")
print(f"smartmotion-stub-exercises.json: enriched {enriched} existing entries, added E112, added {new_forearm_count} new (E117-E126)")
print(f"smartmotion-stub-exercises.json total entries now: {len(stubs)}")

# ---------------------------------------------------------------
# 3. Append E117-E126 to smartmotion-exercise-registry.json for
#    documentation completeness (not imported by seed.ts, but kept in
#    sync with the other 116 registry entries).
# ---------------------------------------------------------------
with open(f"{SEED_DIR}/smartmotion-exercise-registry.json", encoding="utf-8") as f:
    registry = json.load(f)

existing_codes = {r["code"] for r in registry}
appended = 0
for code, g in sorted(guide.items()):
    if g["guideNumber"] <= 45 or code in existing_codes:
        continue
    registry.append({
        "code": code,
        "phaseRaw": g["phaseRaw"],
        "phase": g["correctivePhase"],
        "status": "planned_video",
        "name": g["nameDe"] or g["title"],
        "matchedSeedName": None,
        "matchedSeedSource": None,
    })
    appended += 1

with open(f"{SEED_DIR}/smartmotion-exercise-registry.json", "w", encoding="utf-8") as f:
    json.dump(registry, f, ensure_ascii=False, indent=2)
    f.write("\n")

print(f"smartmotion-exercise-registry.json: appended {appended} entries (E117-E126), total now {len(registry)}")
