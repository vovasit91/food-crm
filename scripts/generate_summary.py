#!/usr/bin/env python3
"""Generate a recipe summary via DeepSeek from stdin recipe text.

Usage:
  python3 get_recipe.py <recipe-id> | python3 generate_summary.py

Requires DEEPSEEK_API_KEY in .env or environment.
"""

import sys
import json
import os
import urllib.request
from pathlib import Path

DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

SYSTEM_PROMPT = """\
You are a food writer for a modern cooking app. Write a short recipe summary — \
2-4 sentences — that explains what makes the dish special and what to pay \
attention to when cooking it. Write in an impersonal cookbook voice. \
No fluff, no generic phrases like "delicious" or "perfect for any occasion". \
Focus on technique, texture, and what sets this recipe apart.

Output only the summary text, nothing else."""


def load_env():
    env_path = Path(__file__).parent / ".env"
    try:
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k.strip() == "DEEPSEEK_API_KEY":
                    return v.strip()
    except FileNotFoundError:
        pass
    return ""


def main():
    recipe_text = sys.stdin.read().strip()
    if not recipe_text:
        print("Error: no input received on stdin", file=sys.stderr)
        sys.exit(1)

    api_key = os.environ.get("DEEPSEEK_API_KEY") or load_env()
    if not api_key:
        print("Error: DEEPSEEK_API_KEY not set in .env or environment", file=sys.stderr)
        sys.exit(1)

    payload = json.dumps({
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": recipe_text},
        ],
        "temperature": 0.7,
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

    print(data["choices"][0]["message"]["content"].strip())


if __name__ == "__main__":
    main()
