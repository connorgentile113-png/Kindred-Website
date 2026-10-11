#!/usr/bin/python3
"""Explicit network check; never logs credentials or server error bodies."""
import json
import os
from pathlib import Path
import urllib.request
import urllib.error
key = os.environ.get("NVIDIA_API_KEY") or (Path.home() / ".config/kindred/nim-key").read_text().strip()
request = urllib.request.Request("https://integrate.api.nvidia.com/v1/chat/completions", data=json.dumps({"model": "nvidia/nemotron-3.5-lightning-30b-a3b", "messages": [{"role": "user", "content": "Say hello in one short sentence."}], "max_tokens": 2048, "temperature": 0.2, "stream": False, "chat_template_kwargs": {"enable_thinking": False}}).encode(), headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
try:
    with urllib.request.urlopen(request, timeout=90) as response:
        data = json.load(response)
        assert data["choices"][0]["message"].get("content"), "No reply text returned"
        print("PASS: NVIDIA returned a text reply using the requested model.")
except urllib.error.HTTPError as error:
    raise SystemExit(f"NVIDIA returned HTTP {error.code}")
except (TimeoutError, urllib.error.URLError):
    raise SystemExit("NVIDIA request timed out or could not connect.")
