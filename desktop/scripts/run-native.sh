#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v gjs >/dev/null 2>&1; then
  runtime=gjs
elif [[ -x .runtime/usr/bin/gjs ]]; then
  runtime="$PWD/.runtime/usr/bin/gjs"
  export LD_LIBRARY_PATH="$PWD/.runtime/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  export GI_TYPELIB_PATH="$PWD/.runtime/usr/lib/x86_64-linux-gnu/girepository-1.0:$PWD/.runtime/usr/lib/x86_64-linux-gnu/gjs/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
else
  echo "Run ./scripts/bootstrap-debian.sh to install the native runtime." >&2
  exit 1
fi
if [[ ${1:-} == --weather-test ]]; then
  exec "$runtime" -m tests/weather.js
fi
if [[ ${1:-} == --platform-test ]]; then
  shift
  exec "$runtime" -m tests/platform.js "$@"
fi
if [[ ${1:-} == --storage-test ]]; then
  shift
  exec "$runtime" -m tests/storage.js "$@"
fi
exec "$runtime" -m native/main.js "$@"
