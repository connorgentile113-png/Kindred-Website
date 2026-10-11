#!/usr/bin/env bash
# Guest-only setup for readable apps and an official Flathub remote.
set -euo pipefail
[[ $EUID == 0 && -f /usr/share/xsessions/kindred.desktop && -f /opt/kindred/native/main.js ]]
install -d -o kindred -g kindred /home/kindred/.config/gtk-3.0 /home/kindred/.config/gtk-4.0
for toolkit in gtk-3.0 gtk-4.0; do
  settings="/home/kindred/.config/$toolkit/settings.ini"
  if [[ ! -f "$settings" ]]; then
    cat >"$settings" <<'SETTINGS'
[Settings]
gtk-font-name=DejaVu Sans 16
gtk-theme-name=Adwaita
gtk-double-click-time=600
SETTINGS
    chown kindred:kindred "$settings"
  fi
done
if [[ ! -f /home/kindred/.config/gtk-3.0/gtk.css ]]; then
  cat >/home/kindred/.config/gtk-3.0/gtk.css <<'CSS'
button { min-height: 40px; padding: 8px 14px; }
entry { min-height: 40px; }
CSS
  chown kindred:kindred /home/kindred/.config/gtk-3.0/gtk.css
fi
# Connectivity failure must not prevent a successful desktop installation.
if command -v flatpak >/dev/null; then
  timeout 60 runuser -u kindred -- flatpak --user remote-add --if-not-exists flathub \
    https://dl.flathub.org/repo/flathub.flatpakrepo || echo 'Flathub setup will need to be retried when online.' >&2
fi
