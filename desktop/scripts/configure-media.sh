#!/usr/bin/env bash
# Install missing media support only inside an existing Kindred guest.
set -euo pipefail
[[ $EUID == 0 && -f /usr/share/xsessions/kindred.desktop && -f /opt/kindred/native/main.js ]]
packages=(firefox-esr ffmpeg gir1.2-webkit2-4.1 flatpak gnome-software-plugin-flatpak gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad)
missing=()
for package in "${packages[@]}"; do
  status=$(dpkg-query -W -f='${Status}' "$package" 2>/dev/null || true)
  [[ $status == 'install ok installed' ]] || missing+=("$package")
done
if ((${#missing[@]})); then
  apt-get update
  apt-get install -y --no-remove --no-install-recommends "${missing[@]}"
fi
