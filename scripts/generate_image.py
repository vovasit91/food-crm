#!/usr/bin/env python3
"""Generate images via Google Gemini (Nano Banana) or NVIDIA FLUX.1-dev.

Requires API keys in .env:
  GEMINI_API_KEY — https://aistudio.google.com/apikey
  NIM_API_KEY    — https://build.nvidia.com/

Usage:
  ./generate_image.sh --provider gemini "A bowl of borscht"
  ./generate_image.sh --provider nvidia "A bowl of borscht"
  ./generate_image.sh --recipe-photo --provider nvidia "Chicken julienne in creamy sauce..."
  ./generate_image.sh --recipe-photo --print-prompt "Chicken julienne..."

First-time setup:
  python3 -m venv .venv && .venv/bin/pip install -r requirements-image.txt
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_DIR / ".env"
DEFAULT_STYLE_PATH = PROJECT_DIR / "data" / "recipe_photo_prompt.json"

GEMINI_DEFAULT_MODEL = "gemini-3.1-flash-image-preview"
GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-image"
FLUX_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-dev"
# FLUX_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell"

ASPECT_SIZES = {
    "1/2:1/2": (768, 768),
    "1:1": (1024, 1024),
    "16:9": (1344, 768),
    "9:16": (768, 1344),
    "4:3": (1152, 896),
    "3:4": (896, 1152),
    "3:2": (1216, 832),
    "2:3": (832, 1216),
}


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    try:
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip()
    except FileNotFoundError:
        pass
    return env


def apply_env(path: Path = ENV_PATH) -> None:
    """Load .env into os.environ (does not override existing vars)."""
    for key, value in load_env(path).items():
        if value:
            os.environ.setdefault(key, value)


apply_env()


def require_env(name: str, hint: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        print(f"Error: set {name} in .env or the environment.\n{hint}", file=sys.stderr)
        sys.exit(1)
    return value


def slugify(text: str, max_len: int = 48) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:max_len] or "image"


def default_output_path(prompt: str) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return Path.cwd() / f"{stamp}-{slugify(prompt)}.png"


def load_prompt_template(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"Error: style file not found: {path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        print(f"Error: invalid JSON in {path}: {exc}", file=sys.stderr)
        sys.exit(1)
    if not isinstance(data, dict):
        print(f"Error: expected JSON object in {path}", file=sys.stderr)
        sys.exit(1)
    return data


def build_recipe_photo_prompt(recipe_text: str, style_path: Path = DEFAULT_STYLE_PATH) -> str:
    template = load_prompt_template(style_path)
    payload: dict = {"recipe": recipe_text.strip()}
    if "style_guide" in template:
        payload["style_guide"] = template["style_guide"]
    for key, value in template.items():
        if key != "style_guide":
            payload[key] = value
    return json.dumps(payload, ensure_ascii=False, indent=2)


def read_recipe_text(
    inline: str | None,
    recipe_file: Path | None,
    read_stdin: bool,
) -> str:
    if recipe_file:
        try:
            text = recipe_file.read_text(encoding="utf-8").strip()
        except OSError as exc:
            print(f"Error: cannot read {recipe_file}: {exc}", file=sys.stderr)
            sys.exit(1)
        if recipe_file.suffix == ".json":
            try:
                data = json.loads(text)
            except json.JSONDecodeError:
                return text
            for key in ("title", "name", "recipe", "description", "prompt"):
                if isinstance(data.get(key), str) and data[key].strip():
                    return data[key].strip()
            return json.dumps(data, ensure_ascii=False, indent=2)
        return text

    if inline and inline != "-":
        return inline.strip()

    if read_stdin or inline == "-":
        if sys.stdin.isatty():
            print("Recipe text (end with Ctrl-D):", file=sys.stderr)
        text = sys.stdin.read().strip()
        if text:
            return text

    return ""


def decode_base64_image(data: str) -> bytes:
    if data.startswith("data:"):
        _, data = data.split(",", 1)
    return base64.b64decode(data)


def save_bytes(image_bytes: bytes, output: Path) -> None:
    output.write_bytes(image_bytes)
    print(f"Saved: {output.resolve()}")


def generate_gemini(prompt: str, output: Path, args: argparse.Namespace) -> None:
    try:
        from google import genai
        from google.genai import types
    except ModuleNotFoundError:
        print(
            "Missing dependency: google-genai (required for --provider gemini)\n"
            "  .venv/bin/pip install -r requirements-image.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    require_env("GEMINI_API_KEY", "Get a key: https://aistudio.google.com/apikey")
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(aspect_ratio=args.aspect),
    )

    try:
        response = client.models.generate_content(
            model=args.model,
            contents=[prompt],
            config=config,
        )
    except Exception as exc:
        if args.model == GEMINI_DEFAULT_MODEL:
            print(f"Note: {GEMINI_DEFAULT_MODEL} failed ({exc}); trying {GEMINI_FALLBACK_MODEL}...")
            response = client.models.generate_content(
                model=GEMINI_FALLBACK_MODEL,
                contents=[prompt],
                config=config,
            )
        else:
            raise

    for part in response.parts:
        if part.text:
            print(part.text)
        if part.inline_data is not None:
            part.as_image().save(output)
            print(f"Saved: {output.resolve()}")
            return

    print("Error: Gemini returned no image.", file=sys.stderr)
    sys.exit(1)


def generate_nvidia(prompt: str, output: Path, args: argparse.Namespace) -> None:
    try:
        import requests
    except ModuleNotFoundError:
        print(
            "Missing dependency: requests (required for --provider nvidia)\n"
            "  .venv/bin/pip install -r requirements-image.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    api_key = require_env("NIM_API_KEY", "Get a key: https://build.nvidia.com/")

    width = args.width
    height = args.height
    if args.aspect in ASPECT_SIZES and not args.size_set:
        width, height = ASPECT_SIZES[args.aspect]

    payload = {
        "prompt": prompt,
        "mode": args.flux_mode,
        "cfg_scale": args.cfg_scale,
        "width": width,
        "height": height,
        "seed": args.seed,
        "steps": args.steps,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }

    print(f"NVIDIA FLUX: {width}x{height}, steps={args.steps}, seed={args.seed}", file=sys.stderr)
    response = requests.post(FLUX_URL, headers=headers, json=payload, timeout=300)
    try:
        response.raise_for_status()
    except requests.HTTPError:
        print(f"Error: NVIDIA API {response.status_code}: {response.text}", file=sys.stderr)
        sys.exit(1)

    body = response.json()
    artifacts = body.get("artifacts") or []
    if not artifacts:
        print(f"Error: no artifacts in response: {body}", file=sys.stderr)
        sys.exit(1)

    b64 = artifacts[0].get("base64")
    if not b64:
        print(f"Error: no base64 image in response: {body}", file=sys.stderr)
        sys.exit(1)

    save_bytes(decode_base64_image(b64), output)
    finish = artifacts[0].get("finishReason")
    if finish:
        print(f"finishReason: {finish}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate images with Google Gemini or NVIDIA FLUX."
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        help="Free-form prompt, or recipe text when using --recipe-photo",
    )
    parser.add_argument(
        "--provider",
        choices=["gemini", "nvidia"],
        default="gemini",
        help="Image backend (default: gemini)",
    )
    parser.add_argument(
        "--recipe-photo",
        action="store_true",
        help="Build prompt from recipe_photo_prompt.json + recipe text",
    )
    parser.add_argument(
        "--style",
        type=Path,
        default=DEFAULT_STYLE_PATH,
        help=f"Style JSON for --recipe-photo (default: {DEFAULT_STYLE_PATH.name})",
    )
    parser.add_argument(
        "--recipe-file",
        type=Path,
        help="Recipe text from a .txt or .json file (used with --recipe-photo)",
    )
    parser.add_argument(
        "--model",
        default=GEMINI_DEFAULT_MODEL,
        help=f"Gemini model (default: {GEMINI_DEFAULT_MODEL})",
    )
    parser.add_argument(
        "--aspect",
        default="1:1",
        help='Aspect ratio: "1:1", "16:9", "3:4", etc. (Gemini + NVIDIA)',
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1024,
        help="Image width for NVIDIA FLUX (default: 1024)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=1024,
        help="Image height for NVIDIA FLUX (default: 1024)",
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=50,
        help="Diffusion steps for NVIDIA FLUX (default: 50)",
    )
    parser.add_argument(
        "--cfg-scale",
        type=float,
        default=3.5,
        help="CFG scale for NVIDIA FLUX (default: 3.5)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=0,
        help="Seed for NVIDIA FLUX, 0 = random (default: 0)",
    )
    parser.add_argument(
        "--flux-mode",
        choices=["base", "canny", "depth"],
        default="base",
        help="NVIDIA FLUX mode (default: base)",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output file path (default: timestamped name in cwd)",
    )
    parser.add_argument(
        "--print-prompt",
        action="store_true",
        help="Print the final prompt and exit (no API call)",
    )
    args = parser.parse_args()
    args.size_set = "--width" in sys.argv or "--height" in sys.argv

    recipe_text = ""
    if args.recipe_photo:
        recipe_text = read_recipe_text(
            args.prompt,
            args.recipe_file,
            read_stdin=not args.prompt and not args.recipe_file,
        )
        if not recipe_text:
            recipe_text = input("Recipe: ").strip()
        if not recipe_text:
            print("Error: provide recipe text inline, via --recipe-file, or stdin.", file=sys.stderr)
            sys.exit(1)
        prompt = build_recipe_photo_prompt(recipe_text, args.style)
    else:
        prompt = args.prompt
        if not prompt:
            prompt = input("Prompt: ").strip()
        if not prompt:
            print("Error: empty prompt.", file=sys.stderr)
            sys.exit(1)

    if args.print_prompt:
        print(prompt)
        return

    name_seed = recipe_text or prompt
    output = args.output or default_output_path(name_seed)
    output.parent.mkdir(parents=True, exist_ok=True)

    if args.provider == "gemini":
        generate_gemini(prompt, output, args)
    else:
        generate_nvidia(prompt, output, args)


if __name__ == "__main__":
    main()
