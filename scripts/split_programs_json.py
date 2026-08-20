"""
Splits prisma/seed-data/smartmotion-programs.json (the full 22-product,
~200KB output of parse_smartmotion_spec_v2.py) into 4 roughly-equal parts:
smartmotion-programs-1.json .. smartmotion-programs-4.json.

This exists purely for GitHub-web-upload commit-size reasons: the single
combined ~200KB file repeatedly failed to commit ("Commit failed - Failed
to fetch") via the browser upload flow used to deploy this app in the
Round 5 sandbox (no direct git push access to the repo), while individual
files under ~60KB committed reliably. Content-wise the split is a pure
partition -- no data is changed, just chunked -- and prisma/seed.ts
imports all 4 parts and concatenates them back into one array at seed
time. See seed.ts's import block for smartMotionProgramsData.

Usage: python3 scripts/split_programs_json.py
(re-run after any regeneration of smartmotion-programs.json, e.g. after
re-running parse_smartmotion_spec_v2.py)
"""

import json
import os

SEED_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "prisma", "seed-data")
SOURCE = os.path.join(SEED_DATA_DIR, "smartmotion-programs.json")
NUM_PARTS = 4


def main():
    with open(SOURCE, encoding="utf-8") as f:
        programs = json.load(f)

    n = len(programs)
    size_each = (n + NUM_PARTS - 1) // NUM_PARTS
    parts = [programs[i : i + size_each] for i in range(0, n, size_each)]

    assert sum(len(p) for p in parts) == n, "split lost or duplicated a program"

    for i, part in enumerate(parts, 1):
        fname = os.path.join(SEED_DATA_DIR, f"smartmotion-programs-{i}.json")
        with open(fname, "w", encoding="utf-8") as f:
            json.dump(part, f, indent=2, ensure_ascii=False)
        size = os.path.getsize(fname)
        ids = [p["id"] for p in part]
        print(f"{fname}: {len(part)} programs, {size} bytes, ids={ids}")

    print(f"\nTotal: {n} programs across {len(parts)} parts")


if __name__ == "__main__":
    main()
