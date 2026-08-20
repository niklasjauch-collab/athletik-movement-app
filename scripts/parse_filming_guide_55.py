#!/usr/bin/env python3
"""
Parses SmartMotionApproach_Filming_Guide_55_Uebungen.md into structured JSON,
one record per exercise (#01-#55), mapping to Exercise model fields.

Guide exercise # -> smartMotionCode mapping (confirmed against existing
seed-data): guide #1-45 => E072-E116 (linear, code = E{71+n}); guide #46-55
(new elbow/forearm additions) => E117-E126 (linear continuation).

Usage: python3 scripts/parse_filming_guide_55.py > prisma/seed-data/filming-guide-parsed.json
"""
import json
import re
import sys

GUIDE_PATH = "/root/.claude/uploads/cecd8f7b-dfeb-561d-9bcd-46072e292b69/04341850-SmartMotionApproach_Filming_Guide_55_Uebungen.md"

PHASE_MAP = {
    "MoveFlexRelax": "INHIBIT",
    "MoveFlexStretch": "LENGTHEN",
    "MoveSyncActivation": "ACTIVATE",
    "MoveSyncIntegration": "INTEGRATE",
}

SAFETY_FLAGGED = {10, 11, 23, 25, 26, 27}
SAFETY_NOTES = {
    23: "Subscapularis Release: kein direkter Druck tief in die Achselhöhle.",
    27: "First Rib Self-Mobilization: kein Druck auf Halsvorderseite, Gefäße oder Nervenstrukturen.",
    10: "Shoulder/Hip Band Mobilization: Band immer gelenknah und kontrolliert; keine aggressive Traktion.",
    11: "Shoulder/Hip Band Mobilization: Band immer gelenknah und kontrolliert; keine aggressive Traktion.",
    25: "Shoulder/Hip Band Mobilization: Band immer gelenknah und kontrolliert; keine aggressive Traktion.",
    26: "Shoulder/Hip Band Mobilization: Band immer gelenknah und kontrolliert; keine aggressive Traktion.",
}
SAFETY_PREFIX = (
    "⚠️ Vor Veröffentlichung durch qualifizierte Fachperson gegen die "
    "originale Fachquelle prüfen (Technik, Bandposition/Griff, "
    "Kontraindikationen) -- siehe Filming Guide Sicherheitsprüfung. "
)

def split_equipment(raw):
    raw = raw.strip().rstrip(".")
    # naive split on top-level commas; keep "z. B." fragments intact
    parts = [p.strip() for p in re.split(r",\s*(?![Bb]\.)", raw) if p.strip()]
    return parts if parts else ([raw] if raw else [])

VALIDATION_REMINDER_RE = re.compile(r"\*\*(.+?)\*\*\s*$")

def split_bullets(block):
    """Returns (items, validation_reminder). A few flagged exercises embed
    a bolded validation reminder at the end of their last 'Nicht so
    filmen' bullet (e.g. '... starke Schmerzen. **Vor Veröffentlichung
    Technik nochmals fachlich validieren.**') -- pulled out separately so
    commonMistakes stays clean bullet text and the reminder can be folded
    into contraindicationNote instead."""
    items = []
    reminder = None
    for line in block.splitlines():
        line = line.strip()
        if line.startswith("- "):
            text = line[2:].strip().rstrip(".").strip()
            m = VALIDATION_REMINDER_RE.search(text)
            if m:
                reminder = m.group(1).strip().rstrip(".").strip()
                text = VALIDATION_REMINDER_RE.sub("", text).strip().rstrip(".").strip()
            if text:
                items.append(text)
    return items, reminder

def guess_unit(execution_text, coaching_text):
    hold_markers = ["halten", "Halten", "sekunden", "Sekunden"]
    rep_markers = ["Wiederholungen", "wiederholungen"]
    has_rep_count = bool(re.search(r"\d+[–-]\d+\s*Wiederholungen", execution_text))
    if has_rep_count:
        return "Wiederholungen"
    if re.search(r"\d+[–-]\d+\s*Sekunden", execution_text) and not has_rep_count:
        return "Sekunden"
    return "Wiederholungen"

def main():
    with open(GUIDE_PATH, encoding="utf-8") as f:
        text = f.read()

    # Isolate exercise sections: split on "## NN. " headings for NN 01-55
    heading_re = re.compile(r"^## (\d{2})\. (.+)$", re.MULTILINE)
    matches = list(heading_re.finditer(text))
    exercises = []

    for i, m in enumerate(matches):
        num = int(m.group(1))
        if num < 1 or num > 55:
            continue
        title = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        block = text[start:end]

        phase_m = re.search(r"\*\*Phase:\*\*\s*(.+)", block)
        equip_m = re.search(r"\*\*Equipment:\*\*\s*(.+)", block)
        camera_m = re.search(r"\*\*Kamera:\*\*\s*(.+)", block)

        start_pos_m = re.search(
            r"\*\*Ausgangsposition\*\*\s*\n(.+?)\n\n", block, re.DOTALL
        )
        execution_m = re.search(
            r"\*\*Durchführung für den Take\*\*\s*\n(.+?)\n\n", block, re.DOTALL
        )
        cues_m = re.search(
            r"\*\*Coaching-Cues\*\*\n(.+?)\n\n\*\*Nicht so filmen\*\*", block, re.DOTALL
        )
        mistakes_m = re.search(
            r"\*\*Nicht so filmen\*\*\n(.+?)(?:\n\n---|\Z)", block, re.DOTALL
        )

        phase_raw = phase_m.group(1).strip() if phase_m else None
        # "MoveFlexStretch / Mobilize" -> take the MoveXxx token
        phase_token = None
        if phase_raw:
            phase_token = phase_raw.split("/")[0].strip()
        phase = PHASE_MAP.get(phase_token)

        equipment_raw = equip_m.group(1).strip() if equip_m else ""
        camera = camera_m.group(1).strip() if camera_m else None
        start_position = start_pos_m.group(1).strip() if start_pos_m else None
        execution = execution_m.group(1).strip() if execution_m else None
        coaching_cues, _ = split_bullets(cues_m.group(1)) if cues_m else ([], None)
        common_mistakes, validation_reminder = split_bullets(mistakes_m.group(1)) if mistakes_m else ([], None)

        # name split: "German / English" for #46-55, else guide heading is
        # itself the registry (mostly-English) name used consistently in
        # the existing seed-data for #1-45.
        name_de = None
        name_en = None
        if " / " in title:
            left, right = title.split(" / ", 1)
            name_de = left.strip()
            name_en = right.strip()

        code_num = 71 + num
        code = f"E{code_num:03d}"

        contraindication_note = None
        if num in SAFETY_NOTES:
            contraindication_note = SAFETY_PREFIX + SAFETY_NOTES[num]
        if validation_reminder:
            extra = f"Take-Reminder aus dem Filming Guide: {validation_reminder}"
            contraindication_note = (contraindication_note + " " + extra) if contraindication_note else (SAFETY_PREFIX + extra)

        rec = {
            "guideNumber": num,
            "title": title,
            "nameDe": name_de,
            "nameEn": name_en,
            "smartMotionCode": code,
            "phaseRaw": phase_token,
            "correctivePhase": phase,
            "equipment": split_equipment(equipment_raw),
            "camera": camera,
            "startPosition": start_position,
            "execution": execution,
            "coachingCues": coaching_cues,
            "commonMistakes": common_mistakes,
            "unit": guess_unit(execution or "", " ".join(coaching_cues)),
            "safetyFlagged": num in SAFETY_FLAGGED,
            "contraindicationNote": contraindication_note,
        }
        exercises.append(rec)

    assert len(exercises) == 55, f"expected 55 exercises, got {len(exercises)}"
    json.dump(exercises, sys.stdout, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
