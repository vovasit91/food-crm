#!/usr/bin/env python3
"""Upsert a recipe summary into Turso translations table from stdin.

Usage:
  python3 get_recipe.py <id> | python3 generate_summary.py | python3 update_summary.py <recipe-id> [--locale en|ua]

Requires TURSO_URL and TURSO_AUTH_TOKEN in .env or environment.
"""

import sys
import json
import os
import urllib.request
from pathlib import Path


def load_env():
    env = {}
    try:
        for line in (Path(__file__).parent / ".env").read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip("'\"")
    except FileNotFoundError:
        pass
    return env


def turso_execute(url, token, sql, args):
    payload = json.dumps({
        "requests": [
            {"type": "execute", "stmt": {"sql": sql, "args": [{"type": "text", "value": v} for v in args]}},
            {"type": "close"},
        ]
    }).encode()

    https_url = url.replace("libsql://", "https://")
    req = urllib.request.Request(
        f"{https_url}/v2/pipeline",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def main():
    recipe_id = None
    locale = "en"
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] in ("--locale", "-l") and i + 1 < len(args):
            locale = args[i + 1]
            i += 2
        elif args[i].startswith("--locale="):
            locale = args[i].split("=", 1)[1]
            i += 1
        else:
            recipe_id = args[i]
            i += 1

    if not recipe_id:
        print("Usage: update_summary.py <recipe-id> [--locale en|ua]", file=sys.stderr)
        sys.exit(1)

    summary = sys.stdin.read().strip()
    if not summary:
        print("Error: no summary received on stdin", file=sys.stderr)
        sys.exit(1)

    env = load_env()
    url = os.environ.get("TURSO_URL") or env.get("TURSO_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN") or env.get("TURSO_AUTH_TOKEN")

    if not url or not token:
        print("Error: TURSO_URL and TURSO_AUTH_TOKEN must be set in .env or environment", file=sys.stderr)
        sys.exit(1)

    result = turso_execute(
        url, token,
        "INSERT OR REPLACE INTO translations (locale, entity_type, entity_id, value) VALUES (?, ?, ?, ?)",
        [locale, "recipe_summary", recipe_id, summary],
    )

    if result["results"][0]["type"] == "error":
        print(f"Error: {result['results'][0]['error']}", file=sys.stderr)
        sys.exit(1)

    print(f"OK  [{locale}] {recipe_id}")
    print(f"    {summary}")


if __name__ == "__main__":
    main()
