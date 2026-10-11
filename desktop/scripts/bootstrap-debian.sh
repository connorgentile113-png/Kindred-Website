#!/usr/bin/env bash
set -euo pipefail
if ! command -v apt-get >/dev/null; then
  echo "Install GJS, GTK4 and libadwaita introspection packages for your distribution." >&2
  exit 1
fi
if [[ $EUID -eq 0 ]]; then
  apt-get update
  apt-get install -y gjs gir1.2-gtk-4.0 gir1.2-adw-1 librsvg2-common gir1.2-soup-3.0 gir1.2-webkit2-4.1
else
  sudo apt-get update
  sudo apt-get install -y gjs gir1.2-gtk-4.0 gir1.2-adw-1 librsvg2-common gir1.2-soup-3.0 gir1.2-webkit2-4.1
fi
printf 'Setup complete. Run ./scripts/run-native.sh\n'
