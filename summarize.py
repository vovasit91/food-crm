#!/usr/bin/env python3
"""Generate and save recipe summaries for one or more locales.

Usage:
  summarize.py <recipe-id> [--locales en,ua]

Defaults to --locales en.
"""

import sys
import subprocess
from pathlib import Path

SCRIPTS = Path(__file__).parent
LANGUAGE_NAMES = {"en": "English", "ua": "Ukrainian"}


def run_pipeline(recipe_id, locale):
    get = subprocess.run(
        ["python3", SCRIPTS / "get_recipe.py", recipe_id, f"--locale={locale}"],
        capture_output=True, text=True,
    )
    if get.returncode != 0:
        print(f"  error: get_recipe failed — {get.stderr.strip()}", file=sys.stderr)
        return False

    language = LANGUAGE_NAMES.get(locale, locale)
    recipe_text = get.stdout.rstrip() + f"\n\nWrite the summary in {language}."

    gen = subprocess.run(
        ["python3", SCRIPTS / "generate_summary.py"],
        input=recipe_text, capture_output=True, text=True,
    )
    if gen.returncode != 0:
        print(f"  error: generate_summary failed — {gen.stderr.strip()}", file=sys.stderr)
        return False

    upd = subprocess.run(
        ["python3", SCRIPTS / "update_summary.py", recipe_id, f"--locale={locale}"],
        input=gen.stdout, capture_output=True, text=True,
    )
    print(upd.stdout.strip())
    if upd.returncode != 0:
        print(upd.stderr.strip(), file=sys.stderr)
        return False

    return True


def main():
    recipe_id = None
    locales = ["en"]
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i].startswith("--locales="):
            locales = args[i].split("=", 1)[1].split(",")
            i += 1
        else:
            recipe_id = args[i]
            i += 1

    if not recipe_id:
        print("Usage: summarize.py <recipe-id> [--locales en,ua]", file=sys.stderr)
        sys.exit(1)

    ok = all(run_pipeline(recipe_id, locale.strip()) for locale in locales)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
