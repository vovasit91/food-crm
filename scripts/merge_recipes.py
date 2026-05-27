#!/usr/bin/env python3
"""Merge all recipe JSON files from results/ into a single recipes.json."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
RESULTS_DIR = ROOT / "results"
OUT_DIR = ROOT / "for_import"
OUT_DIR.mkdir(exist_ok=True)

recipes = {}
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
    except Exception as e:
        print(f"  SKIP  {path.name}: {e}", file=sys.stderr)

if duplicates:
    print("Duplicate IDs found — keeping first occurrence:", file=sys.stderr)
    for recipe_id, filename in duplicates:
        print(f"  {recipe_id} ({filename})", file=sys.stderr)

out = OUT_DIR / "recipes.json"
out.write_text(json.dumps(list(recipes.values()), ensure_ascii=False, indent=2))
print(f"✓ for_import/recipes.json")
print(f"\n  {len(recipes)} recipe(s) processed")
