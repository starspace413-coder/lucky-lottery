#!/usr/bin/env python3
import argparse
import base64
import json
import os
import re
import sys
import time
from pathlib import Path

import requests

DEFAULT_HOST = "https://api.minimax.io"
DEFAULT_MODEL = "image-01"
DEFAULT_RATIO = "16:9"
DEFAULT_OUTPUT_DIR = "/home/starspace413/.openclaw/workspace/output/minimax-images"
DEFAULT_PREFIX = "minimax_image"


def slugify(text: str, max_len: int = 40) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text[:max_len] or "image"


def build_payload(args):
    payload = {
        "model": args.model,
        "prompt": args.prompt,
        "response_format": args.response_format,
        "n": args.n,
        "prompt_optimizer": args.prompt_optimizer,
    }

    if args.aspect_ratio:
        payload["aspect_ratio"] = args.aspect_ratio
    if args.width and args.height:
        payload["width"] = args.width
        payload["height"] = args.height
    if args.seed is not None:
        payload["seed"] = args.seed
    return payload


def save_base64_images(images_b64, output_dir: Path, prefix: str, prompt: str):
    output_dir.mkdir(parents=True, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    prompt_slug = slugify(prompt)
    saved = []
    for idx, b64 in enumerate(images_b64, start=1):
        filename = f"{prefix}_{ts}_{prompt_slug}_{idx}.png"
        path = output_dir / filename
        path.write_bytes(base64.b64decode(b64))
        saved.append(str(path))
    return saved


def main():
    parser = argparse.ArgumentParser(description="Generate images via MiniMax official image_generation API")
    parser.add_argument("prompt", help="Text prompt for image generation")
    parser.add_argument("--aspect-ratio", default=DEFAULT_RATIO, help="Aspect ratio, e.g. 1:1, 16:9, 9:16")
    parser.add_argument("--width", type=int, help="Width in px (512-2048, divisible by 8)")
    parser.add_argument("--height", type=int, help="Height in px (512-2048, divisible by 8)")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Output directory")
    parser.add_argument("--filename-prefix", default=DEFAULT_PREFIX, help="Filename prefix")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="MiniMax image model")
    parser.add_argument("--response-format", default="base64", choices=["base64", "url"], help="Response format")
    parser.add_argument("--n", type=int, default=1, help="Number of images [1-9]")
    parser.add_argument("--seed", type=int, help="Random seed")
    parser.add_argument("--prompt-optimizer", action="store_true", help="Enable MiniMax prompt optimizer")
    args = parser.parse_args()

    api_key = os.environ.get("MINIMAX_API_KEY")
    api_host = os.environ.get("MINIMAX_API_HOST", DEFAULT_HOST).rstrip("/")
    if not api_key:
        print(json.dumps({"error": "MINIMAX_API_KEY is not set"}, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

    url = f"{api_host}/v1/image_generation"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = build_payload(args)

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=180)
        resp.raise_for_status()
    except requests.RequestException as e:
        detail = None
        try:
            detail = resp.text  # type: ignore[name-defined]
        except Exception:
            pass
        print(json.dumps({
            "error": "request_failed",
            "message": str(e),
            "detail": detail,
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(2)

    data = resp.json()
    base_resp = data.get("base_resp") or {}
    status_code = base_resp.get("status_code", 0)
    status_msg = base_resp.get("status_msg", "success")

    if status_code != 0:
        print(json.dumps({
            "error": "minimax_api_error",
            "status_code": status_code,
            "status_msg": status_msg,
            "response": data,
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(3)

    data_obj = data.get("data") or {}
    output_dir = Path(args.output_dir)

    if args.response_format == "url":
        result = {
            "urls": data_obj.get("image_urls", []),
            "count": len(data_obj.get("image_urls", [])),
            "model": args.model,
            "aspect_ratio": args.aspect_ratio,
            "prompt": args.prompt,
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    images = data_obj.get("image_base64", [])
    if not images:
        print(json.dumps({
            "error": "no_image_base64_returned",
            "response": data,
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(4)

    saved = save_base64_images(images, output_dir, args.filename_prefix, args.prompt)
    result = {
        "saved": saved,
        "count": len(saved),
        "model": args.model,
        "aspect_ratio": args.aspect_ratio,
        "prompt": args.prompt,
        "output_dir": str(output_dir),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
