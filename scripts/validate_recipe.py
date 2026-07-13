#!/usr/bin/env python3
"""Validate parsed recipe JSON files against DB IDs and schema rules."""

import sys
import json
import re
import sqlite3
from pathlib import Path

DB = Path("/Users/v-sitdikov/iOS/Food/assets/db/food.db")
TS_EN = Path("/Users/v-sitdikov/iOS/Food/src/i18n/locales/en/recipes.ts")
RESULTS_DIR = Path(__file__).parent.parent / "results"

VALID_DIFFICULTIES = {"easy", "medium", "hard"}
VALID_UNITS = {"g", "ml", "tbsp", "tsp", "cup", "cloves", "to-taste", None}
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
URL_RE = re.compile(r"^https?://")


def load_db_ids():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    ids = {
        "ingredients": {r[0] for r in cur.execute("SELECT id FROM ingredients")},
        "tags":        {r[0] for r in cur.execute("SELECT id FROM tags")},
        "kitchen":     {r[0] for r in cur.execute("SELECT id FROM kitchen_items")},
    }
    conn.close()
    return ids


def load_step_ids():
    content = TS_EN.read_text()
    m = re.search(r"steps:\s*\{(.*?)\n  \},", content, re.DOTALL)
    if not m:
        return set()
    return {sid for sid, _ in re.findall(r"'([^']+)':\s*\{\s*title:\s*'([^']+)'", m.group(1))}


class Validator:
    def __init__(self, db_ids, step_ids):
        self.db_ids = db_ids
        self.step_ids = step_ids
        self.errors = []
        self.warnings = []

    def err(self, msg):
        self.errors.append(f"  ERROR   {msg}")

    def warn(self, msg):
        self.warnings.append(f"  WARNING {msg}")

    def check_slug(self, value, field):
        if not isinstance(value, str) or not SLUG_RE.match(value):
            self.err(f"{field}: '{value}' is not a valid kebab-case slug")

    def validate(self, data):
        if not isinstance(data, list) or len(data) != 1:
            self.err("Top-level must be a JSON array with exactly 1 object")
            return
        r = data[0]
        # Build the full known step set: global library + steps declared in this recipe
        local_step_ids = {s["id"] for s in r.get("newCookingSteps", []) if isinstance(s, dict) and "id" in s}
        self.known_steps = self.step_ids | local_step_ids
        self.validate_recipe(r)
        self.validate_new_steps(r)

    def validate_recipe(self, r):
        # ── Top-level required fields ──────────────────────────────────────────
        required = ["id", "image", "title", "timeMinutes", "difficulty",
                    "tags", "kitchen", "variations",
                    "tldrSteps", "ingredients", "cookingSteps"]
        for f in required:
            if f not in r:
                self.err(f"Missing required field: '{f}'")

        # id
        if "id" in r:
            self.check_slug(r["id"], "id")

        # image
        if "image" in r:
            if not isinstance(r["image"], str) or not URL_RE.match(r["image"]):
                self.err(f"image: not a valid URL — '{r['image']}'")

        # title
        if "title" in r:
            t = r["title"]
            if not isinstance(t, dict):
                self.err("title: must be an object with 'en' and 'uk' keys")
            else:
                for lang in ("en", "uk"):
                    if lang not in t:
                        self.err(f"title: missing '{lang}'")
                    elif not isinstance(t[lang], str) or not t[lang].strip():
                        self.err(f"title.{lang}: must be a non-empty string")

        # timeMinutes
        if "timeMinutes" in r:
            if not isinstance(r["timeMinutes"], int) or r["timeMinutes"] <= 0:
                self.err(f"timeMinutes: must be a positive integer, got {r['timeMinutes']!r}")

        # difficulty
        if "difficulty" in r:
            if r["difficulty"] not in VALID_DIFFICULTIES:
                self.err(f"difficulty: '{r['difficulty']}' not in {VALID_DIFFICULTIES}")

        # variations
        if "variations" in r and r["variations"] != []:
            self.warn("variations: expected empty array, got non-empty")

        # ── tags ──────────────────────────────────────────────────────────────
        if "tags" in r:
            if not isinstance(r["tags"], list):
                self.err("tags: must be an array")
            else:
                if len(r["tags"]) == 0:
                    self.warn("tags: empty — at least one tag expected")
                for t in r["tags"]:
                    if t not in self.db_ids["tags"]:
                        self.err(f"tags: unknown tag id '{t}'")
                if len(r["tags"]) != len(set(r["tags"])):
                    self.err("tags: contains duplicates")

        # ── kitchen ───────────────────────────────────────────────────────────
        if "kitchen" in r:
            if not isinstance(r["kitchen"], list):
                self.err("kitchen: must be an array")
            else:
                if len(r["kitchen"]) == 0:
                    self.warn("kitchen: empty — at least one kitchen item expected")
                for k in r["kitchen"]:
                    if k not in self.db_ids["kitchen"]:
                        self.err(f"kitchen: unknown kitchen item id '{k}'")
                if len(r["kitchen"]) != len(set(r["kitchen"])):
                    self.err("kitchen: contains duplicates")

        # ── ingredients ───────────────────────────────────────────────────────
        if "ingredients" in r:
            if not isinstance(r["ingredients"], list):
                self.err("ingredients: must be an array")
            elif len(r["ingredients"]) == 0:
                self.err("ingredients: must not be empty")
            else:
                seen_ids = []
                for i, ing in enumerate(r["ingredients"]):
                    prefix = f"ingredients[{i}]"
                    if not isinstance(ing, dict):
                        self.err(f"{prefix}: must be an object"); continue

                    for f in ["ingredientId", "quantity", "unit", "optional", "substitutes"]:
                        if f not in ing:
                            self.err(f"{prefix}: missing field '{f}'")

                    if "ingredientId" in ing:
                        iid = ing["ingredientId"]
                        if iid not in self.db_ids["ingredients"]:
                            self.err(f"{prefix}: unknown ingredientId '{iid}'")
                        seen_ids.append(iid)

                    if "quantity" in ing:
                        q = ing["quantity"]
                        if q is not None and not isinstance(q, (int, float)):
                            self.err(f"{prefix}: quantity must be a number or null, got {q!r}")
                        if isinstance(q, (int, float)) and q <= 0:
                            self.err(f"{prefix}: quantity must be > 0")

                    if "unit" in ing:
                        u = ing["unit"]
                        if u not in VALID_UNITS:
                            self.warn(f"{prefix}: unrecognised unit '{u}' (expected one of {VALID_UNITS})")

                    if "optional" in ing and not isinstance(ing["optional"], bool):
                        self.err(f"{prefix}: optional must be a boolean")

                    if "substitutes" in ing and not isinstance(ing["substitutes"], list):
                        self.err(f"{prefix}: substitutes must be an array")

                if len(seen_ids) != len(set(seen_ids)):
                    dupes = [x for x in set(seen_ids) if seen_ids.count(x) > 1]
                    self.err(f"ingredients: duplicate ingredientId(s): {dupes}")

        # ── cookingSteps ──────────────────────────────────────────────────────
        if "cookingSteps" in r:
            if not isinstance(r["cookingSteps"], list):
                self.err("cookingSteps: must be an array")
            elif len(r["cookingSteps"]) == 0:
                self.err("cookingSteps: must not be empty")
            else:
                seen_step_ids = []
                for i, step in enumerate(r["cookingSteps"]):
                    prefix = f"cookingSteps[{i}]"
                    if not isinstance(step, dict):
                        self.err(f"{prefix}: must be an object"); continue

                    for f in ["stepId", "duration", "showTimer", "tags"]:
                        if f not in step:
                            self.err(f"{prefix}: missing field '{f}'")

                    if "stepId" in step:
                        sid = step["stepId"]
                        self.check_slug(sid, f"{prefix}.stepId")
                        seen_step_ids.append(sid)
                        if self.known_steps and sid not in self.known_steps:
                            self.err(f"{prefix}: stepId '{sid}' not in translations or newCookingSteps")

                    if "duration" in step:
                        d = step["duration"]
                        if not isinstance(d, (int, float)) or d < 0:
                            self.err(f"{prefix}: duration must be a non-negative number, got {d!r}")

                    if "showTimer" in step and not isinstance(step["showTimer"], bool):
                        self.err(f"{prefix}: showTimer must be a boolean")

                    if "tags" in step and not isinstance(step["tags"], list):
                        self.err(f"{prefix}: tags must be an array")

                if len(seen_step_ids) != len(set(seen_step_ids)):
                    dupes = [x for x in set(seen_step_ids) if seen_step_ids.count(x) > 1]
                    self.err(f"cookingSteps: duplicate stepId(s): {dupes}")

        # ── tldrSteps ─────────────────────────────────────────────────────────
        if "tldrSteps" in r:
            if not isinstance(r["tldrSteps"], list):
                self.err("tldrSteps: must be an array")
            elif len(r["tldrSteps"]) == 0:
                self.err("tldrSteps: must not be empty")
            else:
                seen_tldr_ids = []
                for i, step in enumerate(r["tldrSteps"]):
                    prefix = f"tldrSteps[{i}]"
                    if not isinstance(step, dict):
                        self.err(f"{prefix}: must be an object"); continue

                    for f in ["stepId", "minutes"]:
                        if f not in step:
                            self.err(f"{prefix}: missing field '{f}'")

                    if "stepId" in step:
                        sid = step["stepId"]
                        self.check_slug(sid, f"{prefix}.stepId")
                        seen_tldr_ids.append(sid)
                        if self.known_steps and sid not in self.known_steps:
                            self.err(f"{prefix}: stepId '{sid}' not in translations or newCookingSteps")

                    if "minutes" in step:
                        m = step["minutes"]
                        if not isinstance(m, (int, float)) or m <= 0:
                            self.err(f"{prefix}: minutes must be a positive number, got {m!r}")

                if len(seen_tldr_ids) != len(set(seen_tldr_ids)):
                    dupes = [x for x in set(seen_tldr_ids) if seen_tldr_ids.count(x) > 1]
                    self.err(f"tldrSteps: duplicate stepId(s): {dupes}")

                # tldr minutes sum sanity check vs timeMinutes
                if "timeMinutes" in r and isinstance(r["timeMinutes"], int):
                    tldr_total = sum(
                        s["minutes"] for s in r["tldrSteps"]
                        if isinstance(s.get("minutes"), (int, float))
                    )
                    ratio = tldr_total / r["timeMinutes"] if r["timeMinutes"] else 0
                    if ratio < 0.5 or ratio > 2.0:
                        self.warn(
                            f"tldrSteps total time ({tldr_total} min) differs significantly "
                            f"from timeMinutes ({r['timeMinutes']})"
                        )

    def validate_new_steps(self, r):
        new_steps = r.get("newCookingSteps", [])
        if not isinstance(new_steps, list):
            self.err("newCookingSteps: must be an array")
            return
        seen_ids = []
        for i, s in enumerate(new_steps):
            prefix = f"newCookingSteps[{i}]"
            if not isinstance(s, dict):
                self.err(f"{prefix}: must be an object"); continue
            if "id" not in s:
                self.err(f"{prefix}: missing field 'id'")
            else:
                self.check_slug(s["id"], f"{prefix}.id")
                seen_ids.append(s["id"])
            for lang in ("en", "uk"):
                if lang not in s:
                    self.err(f"{prefix}: missing '{lang}' translation block")
                else:
                    block = s[lang]
                    if not isinstance(block, dict):
                        self.err(f"{prefix}.{lang}: must be an object")
                    else:
                        for f in ("title", "description"):
                            if f not in block:
                                self.err(f"{prefix}.{lang}: missing field '{f}'")
                            elif not isinstance(block[f], str) or not block[f].strip():
                                self.err(f"{prefix}.{lang}.{f}: must be a non-empty string")
        if len(seen_ids) != len(set(seen_ids)):
            dupes = [x for x in set(seen_ids) if seen_ids.count(x) > 1]
            self.err(f"newCookingSteps: duplicate id(s): {dupes}")


def validate_file(path: Path, db_ids: dict, step_ids: set) -> bool:
    print(f"\n{'─'*60}")
    print(f"  {path.name}")
    print(f"{'─'*60}")

    try:
        data = json.loads(path.read_text())
    except json.JSONDecodeError as e:
        print(f"  ERROR   Invalid JSON: {e}")
        return False

    v = Validator(db_ids, step_ids)
    v.validate(data)

    if v.errors:
        for msg in v.errors:
            print(msg)
    if v.warnings:
        for msg in v.warnings:
            print(msg)

    if not v.errors and not v.warnings:
        print("  OK      All checks passed")
    elif not v.errors:
        print(f"  OK      No errors ({len(v.warnings)} warning(s))")
    else:
        print(f"\n  FAILED  {len(v.errors)} error(s), {len(v.warnings)} warning(s)")

    return len(v.errors) == 0


def main():
    db_ids = load_db_ids()
    step_ids = load_step_ids()

    # Accept file args or default to all files in results/
    if len(sys.argv) > 1:
        paths = [Path(p) for p in sys.argv[1:]]
    else:
        paths = sorted(RESULTS_DIR.glob("*.json"))

    if not paths:
        print("No JSON files found to validate.")
        sys.exit(0)

    results = [validate_file(p, db_ids, step_ids) for p in paths]

    total = len(results)
    passed = sum(results)
    failed = total - passed

    print(f"\n{'═'*60}")
    print(f"  {passed}/{total} passed" + (f", {failed} failed" if failed else ""))
    print(f"{'═'*60}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
