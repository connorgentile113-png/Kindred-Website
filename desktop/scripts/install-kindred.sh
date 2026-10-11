#!/usr/bin/env bash
# Install Kindred onto a normal Debian installation. Run this as root from a
# checkout, or from the release bundle after extracting its source archive.
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo 'Run this installer as root (for example: sudo bash scripts/install-kindred.sh).' >&2
  exit 1
fi

install -d /var/log/kindred
exec > >(tee -a /var/log/kindred/install.log) 2>&1
trap 'status=$?; echo "Kindred installation failed at line $LINENO (exit $status): $BASH_COMMAND"; exit "$status"' ERR

source_dir=$(cd "$(dirname "$0")/.." && pwd)
if [[ ! -f "$source_dir/native/main.js" || ! -f "$source_dir/scripts/guest-setup.sh" ]]; then
  echo "Kindred source is incomplete: $source_dir" >&2
  exit 1
fi

if ! id -u kindred >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash --user-group kindred
  passwd --lock kindred >/dev/null
fi
for group in audio video netdev; do groupadd -f "$group"; done
usermod -aG audio,video,netdev kindred

install -d /opt/kindred
if [[ "$source_dir" != /opt/kindred ]]; then
  tar -C "$source_dir" -cf - native scripts tests docs installer README.md package.json VERSION | tar -C /opt/kindred -xf -
fi
chown -R root:root /opt/kindred
bash /opt/kindred/scripts/guest-setup.sh

echo
echo 'Kindred is installed. Reboot, then sign in to the Kindred desktop.'
