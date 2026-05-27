#!/usr/bin/env python3
"""Send a prompt file to a local or DeepSeek AI agent and print the response.

Usage:
  call_agent.py <prompt_file>             # local agent
  call_agent.py <prompt_file> --deepseek  # DeepSeek API (requires DEEPSEEK_API_KEY env var)
"""

import json
import os
import sys
import urllib.request
from pathlib import Path


def load_env(path):
    env = {}
    try:
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    except FileNotFoundError:
        pass
    return env


LOCAL_URL = "http://192.168.31.49:8081/v1/chat/completions"
DEEPSEEK_URL = "https://api.deepseek.com/chat/completions"

prompt_path = sys.argv[1]
use_deepseek = "--deepseek" in sys.argv

prompt = open(prompt_path).read()

if use_deepseek:
    env = load_env(Path(__file__).parent.parent / ".env")
    api_key = env.get("DEEPSEEK_API_KEY") or os.environ.get("DEEPSEEK_API_KEY", "")
    if not api_key:
        print(
            "Error: DEEPSEEK_API_KEY environment variable is not set", file=sys.stderr
        )
        sys.exit(1)
    payload = json.dumps(
        {
            "model": "deepseek-v4-pro",
            "messages": [{"role": "user", "content": prompt}],
            "thinking": {"type": "enabled"},
            "reasoning_effort": "high",
        }
    ).encode()
    req = urllib.request.Request(
        DEEPSEEK_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
else:
    payload = json.dumps({"messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(
        LOCAL_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

with urllib.request.urlopen(req) as resp:
    data = json.load(resp)
print(data["choices"][0]["message"]["content"])
