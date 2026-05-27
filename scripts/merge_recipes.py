#!/usr/bin/env python3
"""Merge all recipe JSON files from results/ into recipes.json and separate asset files."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
RESULTS_DIR = ROOT / "results"
OUT_DIR = ROOT / "for_import"
OUT_DIR.mkdir(exist_ok=True)

recipes = {}
cooking_steps = {}
tldr_steps = {}
used_ingredient_ids = []
titles = {}
duplicates = []

for path in sorted(RESULTS_DIR.glob("*.json")):
    try:
        data = json.loads(path.read_text())
        obj = data[0] if isinstance(data, list) else data
        recipe_id = obj["id"]
        if recipe_id in recipes:
            duplicates.append((recipe_id, path.name))
            continue
        recipes[recipe_id] = obj
        if title := obj.get("title"):
            titles[recipe_id] = title.get("en", "")
        for step in obj.get("newCookingSteps", []):
            cooking_steps.setdefault(step["id"], step)
        for step in obj.get("newTldrSteps", []):
            tldr_steps.setdefault(step["id"], step)
        for ing in obj.get("ingredients", []):
            iid = ing["ingredientId"]
            if iid not in used_ingredient_ids:
                used_ingredient_ids.append(iid)
    except Exception as e:
        print(f"  SKIP  {path.name}: {e}", file=sys.stderr)


if duplicates:
    print("Duplicate IDs found — keeping first occurrence:", file=sys.stderr)
    for recipe_id, filename in duplicates:
        print(f"  {recipe_id} ({filename})", file=sys.stderr)

def write(filename, data):
    path = OUT_DIR / filename
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"✓ for_import/{filename}")

STRIP_KEYS = {"newCookingSteps", "newTldrSteps", "newIngredients", "title"}
clean_recipes = [{k: v for k, v in r.items() if k not in STRIP_KEYS} for r in recipes.values()]
write("recipes.json", clean_recipes)
write("titles.json", {"en": titles})
write("new-cooking-steps.json", {"en": {s["id"]: s["en"] for s in cooking_steps.values()}})
write("new-tldr-steps.json", {"en": {s["id"]: s["en"]["title"] for s in tldr_steps.values()}})
write("new-ingredients.json", used_ingredient_ids)
print(f"\n  {len(recipes)} recipe(s) processed")
