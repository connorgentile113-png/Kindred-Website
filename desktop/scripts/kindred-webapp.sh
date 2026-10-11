#!/usr/bin/env bash
# Open a real web app (YouTube, Instagram, Facebook…) inside Kindred's friendly
# wrapper window, which keeps a large Back button at the top.
set -euo pipefail
cd "$(dirname "$0")/.."
# Video services use the installed full browser. WebKit's embedded player
# cannot provide every media/DRM capability those services expect.
case "${1:-}" in
  https://www.youtube.com|https://www.youtube.com/*|https://youtu.be/*|https://www.netflix.com|https://www.netflix.com/*|https://open.spotify.com|https://open.spotify.com/*)
    if command -v firefox-esr >/dev/null 2>&1; then
      exec firefox-esr --new-window "$1"
    elif command -v firefox >/dev/null 2>&1; then
      exec firefox --new-window "$1"
    else
      exec xdg-open "$1"
    fi
    ;;
esac
if command -v gjs >/dev/null 2>&1; then
  runtime=gjs
elif [[ -x .runtime/usr/bin/gjs ]]; then
  runtime="$PWD/.runtime/usr/bin/gjs"
  export LD_LIBRARY_PATH="$PWD/.runtime/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
  export GI_TYPELIB_PATH="$PWD/.runtime/usr/lib/x86_64-linux-gnu/girepository-1.0:$PWD/.runtime/usr/lib/x86_64-linux-gnu/gjs/girepository-1.0${GI_TYPELIB_PATH:+:$GI_TYPELIB_PATH}"
else
  echo "Kindred's web wrapper needs GJS, which is not installed." >&2
  exit 1
fi
if ! "$runtime" -c 'imports.gi.versions.WebKit2="4.1"; imports.gi.WebKit2;' >/dev/null 2>&1; then
  # No embedded browser available: open the site in the usual browser instead.
  xdg-open "$1"
  exit 0
fi
exec "$runtime" native/webapp.js "$@"
