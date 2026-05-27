#!/usr/bin/env bash
# Run generate_image.py with the project venv (auto-installs deps).
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi

.venv/bin/pip install -q -r requirements-image.txt
exec .venv/bin/python generate_image.py "$@"
