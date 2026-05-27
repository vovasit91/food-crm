#!/usr/bin/env python3
"""Translate one untranslated UA record using DeepSeek, then upsert into Turso.

Usage:
  python3 translate_one.py [--entity-type <type>] [--dry-run]

Finds the first translation that exists for locale='en' but not locale='ua',
calls DeepSeek to translate it, and writes the result to the Turso DB.

Requires DEEPSEEK_API_KEY, TURSO_URL, and TURSO_AUTH_TOKEN in .env or environment.
"""

import sys
import json
import os
import sqlite3
import urllib.request
from pathlib import Path

LOCAL_DB = Path("/Users/v-sitdikov/iOS/Food/assets/db/food.db")
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

SYSTEM_PROMPT = """\
You are a professional translator specialising in food and cooking content.
The text you receive is from a food database — it may be a dish name, ingredient, cuisine category, cooking technique, allergen, or dietary tag.
Use precise culinary Ukrainian terminology. Preserve proper nouns (e.g. "Caesar", "Parmesan") as-is. Do not generalise or paraphrase.
Translate the given text from English to Ukrainian.
Use infinitive verb forms (e.g. "додати", "змішати", "обсмажити"), not imperative (not "додайте", "змішайте").
When "rest" means letting food sit/stand, translate it as "дати відпочити", not "відпочити" or "відпочинок".
Output only the translated text — no explanations, no quotes, no punctuation changes."""


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


def find_untranslated(entity_type_filter=None):
    conn = sqlite3.connect(LOCAL_DB)
    cur = conn.cursor()
    if entity_type_filter:
        cur.execute(
            """
            SELECT en.entity_type, en.entity_id, en.value
            FROM translations en
            LEFT JOIN translations ua
              ON ua.locale = 'ua'
             AND ua.entity_type = en.entity_type
             AND ua.entity_id = en.entity_id
            WHERE en.locale = 'en'
              AND en.entity_type = ?
              AND (ua.value IS NULL OR ua.value = en.value)
            ORDER BY en.entity_type, en.entity_id
            LIMIT 1
            """,
            (entity_type_filter,),
        )
    else:
        cur.execute(
            """
            SELECT en.entity_type, en.entity_id, en.value
            FROM translations en
            LEFT JOIN translations ua
              ON ua.locale = 'ua'
             AND ua.entity_type = en.entity_type
             AND ua.entity_id = en.entity_id
            WHERE en.locale = 'en'
              AND (ua.value IS NULL OR ua.value = en.value)
            ORDER BY en.entity_type, en.entity_id
            LIMIT 1
            """
        )
    row = cur.fetchone()
    conn.close()
    return row  # (entity_type, entity_id, en_value) or None


def translate(api_key, text):
    payload = json.dumps({
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "temperature": 0.3,
    }).encode()

    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)
    return data["choices"][0]["message"]["content"].strip()


def turso_upsert(url, token, entity_type, entity_id, value):
    payload = json.dumps({
        "requests": [
            {
                "type": "execute",
                "stmt": {
                    "sql": "INSERT OR REPLACE INTO translations (locale, entity_type, entity_id, value) VALUES (?, ?, ?, ?)",
                    "args": [
                        {"type": "text", "value": "ua"},
                        {"type": "text", "value": entity_type},
                        {"type": "text", "value": entity_id},
                        {"type": "text", "value": value},
                    ],
                },
            },
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


def local_upsert(entity_type, entity_id, value):
    conn = sqlite3.connect(LOCAL_DB)
    conn.execute(
        "INSERT OR REPLACE INTO translations (locale, entity_type, entity_id, value) VALUES ('ua', ?, ?, ?)",
        (entity_type, entity_id, value),
    )
    conn.commit()
    conn.close()


def main():
    entity_type_filter = None
    dry_run = False
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] in ("--entity-type", "-t") and i + 1 < len(args):
            entity_type_filter = args[i + 1]
            i += 2
        elif args[i].startswith("--entity-type="):
            entity_type_filter = args[i].split("=", 1)[1]
            i += 1
        elif args[i] == "--dry-run":
            dry_run = True
            i += 1
        else:
            print(f"Unknown argument: {args[i]}", file=sys.stderr)
            sys.exit(1)

    env = load_env()
    api_key = os.environ.get("DEEPSEEK_API_KEY") or env.get("DEEPSEEK_API_KEY")
    turso_url = os.environ.get("TURSO_URL") or env.get("TURSO_URL")
    turso_token = os.environ.get("TURSO_AUTH_TOKEN") or env.get("TURSO_AUTH_TOKEN")

    if not api_key:
        print("Error: DEEPSEEK_API_KEY not set", file=sys.stderr)
        sys.exit(1)
    if not turso_url or not turso_token:
        print("Error: TURSO_URL and TURSO_AUTH_TOKEN must be set", file=sys.stderr)
        sys.exit(1)

    row = find_untranslated(entity_type_filter)
    if not row:
        print("Nothing to translate — all UA records are up to date.")
        return

    entity_type, entity_id, en_value = row
    print(f"Translating [{entity_type}] {entity_id}")
    print(f"  EN: {en_value}")

    ua_value = translate(api_key, en_value)
    print(f"  UA: {ua_value}")

    if dry_run:
        print("  (dry-run, not written)")
        return

    result = turso_upsert(turso_url, turso_token, entity_type, entity_id, ua_value)
    if result["results"][0]["type"] == "error":
        print(f"Error writing to Turso: {result['results'][0]['error']}", file=sys.stderr)
        sys.exit(1)

    local_upsert(entity_type, entity_id, ua_value)
    print(f"  OK — written to Turso + local DB")


if __name__ == "__main__":
    main()
