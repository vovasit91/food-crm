#!/usr/bin/env python3
"""Run translate_one.py in a loop until all UA translations are complete.

Usage:
  python3 translate_all.py [--entity-type <type>] [--dry-run]
"""

import sys
import subprocess

args = sys.argv[1:]
done = 0

while True:
    result = subprocess.run(
        ["python3", "translate_one.py"] + args,
        capture_output=True,
        text=True,
    )
    print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    if result.returncode != 0:
        sys.exit(result.returncode)
    if "Nothing to translate" in result.stdout:
        print(f"Done — {done} record(s) translated.")
        break
    done += 1
