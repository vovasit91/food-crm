#!/usr/bin/env python3
"""Print a recipe in plain text.

Usage:
  get_recipe.py <recipe-id> [--locale en|uk]
"""

import sys
import sqlite3
from pathlib import Path

DB = Path("/Users/v-sitdikov/iOS/Food/assets/db/food.db")


def fetch(cur, entity_type, entity_id, locale):
    cur.execute(
        "SELECT value FROM translations WHERE locale=? AND entity_type=? AND entity_id=?",
        (locale, entity_type, entity_id),
    )
    row = cur.fetchone()
    return row[0] if row else None


def main():
    recipe_id = None
    locale = "en"
    for arg in sys.argv[1:]:
        if arg.startswith("--locale="):
            locale = arg.split("=", 1)[1]
        elif arg in ("--locale", "-l"):
            pass  # next arg handled below
        elif sys.argv[sys.argv.index(arg) - 1] in ("--locale", "-l"):
            locale = arg
        else:
            recipe_id = arg

    if not recipe_id:
        print("Usage: get_recipe.py <recipe-id> [--locale en|uk]", file=sys.stderr)
        sys.exit(1)

    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    cur.execute("SELECT id FROM recipes WHERE id=?", (recipe_id,))
    if not cur.fetchone():
        print(f"Recipe '{recipe_id}' not found.", file=sys.stderr)
        sys.exit(1)

    name = fetch(cur, "recipe_name", recipe_id, locale) or recipe_id
    summary = fetch(cur, "recipe_summary", recipe_id, locale)

    cur.execute("""
        SELECT tg.id, tr.value
        FROM recipe_tag rt
        JOIN tags tg ON rt.tag_id = tg.id
        LEFT JOIN translations tr ON tr.entity_type='tag' AND tr.entity_id=tg.id AND tr.locale=?
        WHERE rt.recipe_id=?
        ORDER BY tg.id
    """, (locale, recipe_id))
    tags = [row[1] or row[0] for row in cur.fetchall()]

    cur.execute("""
        SELECT rcs.sort_order, tr_t.value, tr_d.value
        FROM recipe_cooking_step rcs
        LEFT JOIN translations tr_t ON tr_t.entity_type='step_title'       AND tr_t.entity_id=rcs.step AND tr_t.locale=?
        LEFT JOIN translations tr_d ON tr_d.entity_type='step_description'  AND tr_d.entity_id=rcs.step AND tr_d.locale=?
        WHERE rcs.recipe_id=?
        ORDER BY rcs.sort_order
    """, (locale, locale, recipe_id))
    steps = cur.fetchall()
    conn.close()

    print(f"# {name}\n")
    if summary:
        print(f"{summary}\n")
    if tags:
        print(f"Tags: {', '.join(tags)}\n")
    print("## Steps\n")
    for order, title, desc in steps:
        print(f"{order + 1}. **{title or '—'}**")
        if desc:
            print(f"   {desc}")
        print()


if __name__ == "__main__":
    main()
