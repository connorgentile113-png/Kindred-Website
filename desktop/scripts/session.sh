#!/bin/bash
set -euo pipefail
export XDG_CURRENT_DESKTOP=Kindred
export GDK_BACKEND=x11
export GSK_RENDERER=cairo
xsetroot -solid '#f3f5f2'
openbox --config-file "$HOME/.config/openbox/rc.xml" &
wm_pid=$!
trap 'kill "$wm_pid" 2>/dev/null || true' EXIT
lxpolkit &
# Restart the shell if it fails; documents are stored outside the installation.
while kill -0 "$wm_pid" 2>/dev/null; do
  /opt/kindred/scripts/run-native.sh --session || true
  sleep 2
done
