#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v gjs >/dev/null 2>&1; then
  exec gjs app.js "$@"
elif [[ -x .runtime/usr/bin/gjs ]]; then
  export LD_LIBRARY_PATH="$PWD/.runtime/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  export GI_TYPELIB_PATH="$PWD/.runtime/usr/lib/x86_64-linux-gnu/gjs/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
  exec .runtime/usr/bin/gjs app.js "$@"
else
  echo 'Install GJS (sudo apt-get install gjs gir1.2-soup-3.0 gir1.2-webkit2-4.1), then run npm start.' >&2
  exit 1
fi
