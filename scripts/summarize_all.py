#!/usr/bin/env python3
"""Run summarize.py for every recipe in the DB.

Usage:
  summarize_all.py [--locales en,ua] [--skip-existing]
"""

import sys
import json
import os
import sqlite3
import subprocess
import urllib.request
from pathlib import Path

DB = Path("/Users/v-sitdikov/iOS/Food/assets/db/food.db")
SCRIPTS = Path(__file__).parent


def load_env():
    env = {}
    try:
        for line in (SCRIPTS.parent / ".env").read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    except FileNotFoundError:
        pass
    return env


def get_recipe_ids():
    conn = sqlite3.connect(DB)
    ids = [r[0] for r in conn.execute("SELECT id FROM recipes ORDER BY id")]
    conn.close()
    return ids


def fetch_existing_summaries(url, token, locales):
    placeholders = ",".join(f"'{l}'" for l in locales)
    sql = f"SELECT entity_id, locale FROM translations WHERE entity_type='recipe_summary' AND locale IN ({placeholders})"
    payload = json.dumps({
        "requests": [
            {"type": "execute", "stmt": {"sql": sql}},
            {"type": "close"},
        ]
    }).encode()
    req = urllib.request.Request(
        f"{url}/v2/pipeline",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)
    rows = data["results"][0]["response"]["result"]["rows"]
    return {(r[0]["value"], r[1]["value"]) for r in rows}


def main():
    locales = ["en", "ua"]
    skip_existing = False

    for arg in sys.argv[1:]:
        if arg.startswith("--locales="):
            locales = arg.split("=", 1)[1].split(",")
        elif arg == "--skip-existing":
            skip_existing = True

    ids = get_recipe_ids()
    total = len(ids)
    failed = []

    existing = set()
    if skip_existing:
        env = load_env()
        url = os.environ.get("TURSO_URL") or env.get("TURSO_URL")
        token = os.environ.get("TURSO_AUTH_TOKEN") or env.get("TURSO_AUTH_TOKEN")
        print("Fetching existing summaries from Turso...")
        existing = fetch_existing_summaries(url.replace("libsql://", "https://"), token, [l.strip() for l in locales])
        print(f"Found {len(existing)} existing summaries.\n")

    for i, recipe_id in enumerate(ids, 1):
        if skip_existing:
            missing = [l for l in locales if (recipe_id, l.strip()) not in existing]
            if not missing:
                print(f"[{i}/{total}] skip {recipe_id} (already has summaries)")
                continue
            run_locales = ",".join(missing)
        else:
            run_locales = ",".join(locales)

        print(f"[{i}/{total}] {recipe_id} ({run_locales})")
        result = subprocess.run(
            ["python3", SCRIPTS / "summarize.py", recipe_id, f"--locales={run_locales}"],
            capture_output=True, text=True,
        )
        for line in result.stdout.splitlines():
            print(f"  {line}")
        if result.returncode != 0:
            print(f"  FAILED: {result.stderr.strip()}", file=sys.stderr)
            failed.append(recipe_id)

    print(f"\nDone: {total - len(failed)}/{total} succeeded" + (f", {len(failed)} failed: {failed}" if failed else ""))
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
