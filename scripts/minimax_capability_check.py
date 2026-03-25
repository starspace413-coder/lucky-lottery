#!/usr/bin/env python3
import json
import os
import sys
import requests

API_HOST = os.environ.get("MINIMAX_API_HOST", "https://api.minimax.io").rstrip("/")
API_KEY = os.environ.get("MINIMAX_API_KEY")

if not API_KEY:
    print(json.dumps({"error": "MINIMAX_API_KEY is not set"}, ensure_ascii=False, indent=2))
    sys.exit(1)

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

results = {}

# 1) Text model test (OpenAI-compatible chat completions)
text_url = f"{API_HOST}/v1/text/chatcompletion_v2"
text_payload = {
    "model": "MiniMax-M2.7",
    "messages": [
        {"role": "system", "content": "You are a concise assistant."},
        {"role": "user", "content": "Reply with exactly: OK"}
    ],
    "tokens_to_generate": 16,
    "temperature": 0.1,
}
try:
    r = requests.post(text_url, headers=headers, json=text_payload, timeout=120)
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text[:1000]}
    base = data.get("base_resp") or {}
    reply = None
    if isinstance(data, dict):
        reply = data.get("reply") or data.get("choices")
    results["text_MiniMax-M2.7"] = {
        "http_status": r.status_code,
        "status_code": base.get("status_code"),
        "status_msg": base.get("status_msg"),
        "has_reply": bool(reply),
        "reply_preview": str(reply)[:200] if reply else None,
    }
except Exception as e:
    results["text_MiniMax-M2.7"] = {"error": str(e)}

# 2) Image generation test
image_url = f"{API_HOST}/v1/image_generation"
image_payload = {
    "model": "image-01",
    "prompt": "simple blue circle on white background",
    "aspect_ratio": "1:1",
    "response_format": "url",
    "n": 1,
}
try:
    r = requests.post(image_url, headers=headers, json=image_payload, timeout=180)
    try:
        data = r.json()
    except Exception:
        data = {"raw": r.text[:1000]}
    base = data.get("base_resp") or {}
    image_urls = (data.get("data") or {}).get("image_urls") or []
    results["image_image-01"] = {
        "http_status": r.status_code,
        "status_code": base.get("status_code"),
        "status_msg": base.get("status_msg"),
        "has_image": bool(image_urls),
        "image_url_preview": image_urls[0][:200] if image_urls else None,
    }
except Exception as e:
    results["image_image-01"] = {"error": str(e)}

print(json.dumps({
    "api_host": API_HOST,
    "results": results,
}, ensure_ascii=False, indent=2))
