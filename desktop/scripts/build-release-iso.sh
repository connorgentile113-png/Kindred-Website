#!/usr/bin/env bash
# Download and verify the current official Debian amd64 netinst image, then
# assemble the files needed to install Kindred after Debian is installed.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
version=${DEBIAN_VERSION:-13.7.0}
mirror=${DEBIAN_MIRROR:-https://cdimage.debian.org/cdimage/release/${version}/amd64/iso-cd}
iso_name="debian-${version}-amd64-netinst.iso"
release_dir="$root/artifacts/kindred-debian-${version}"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/kindred-release.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT

mkdir -p "$release_dir"
if [[ -n ${DEBIAN_ISO_PATH:-} ]]; then
  cp "$DEBIAN_ISO_PATH" "$work_dir/$iso_name"
else
  curl --fail --http1.1 --location --retry 3 --max-time 900 --output "$work_dir/$iso_name" "$mirror/$iso_name"
fi
curl --fail --http1.1 --location --retry 3 --max-time 120 --output "$work_dir/SHA512SUMS" "$mirror/SHA512SUMS"
expected=$(awk -v name="$iso_name" '$2 == name || $2 == "*" name {print $1}' "$work_dir/SHA512SUMS")
[[ -n "$expected" ]] || { echo "No SHA512 entry for $iso_name" >&2; exit 1; }
printf '%s  %s\n' "$expected" "$work_dir/$iso_name" | sha512sum --check --status

output_iso="$release_dir/kindred-debian-${version}-amd64-netinst.iso"
mv "$work_dir/$iso_name" "$output_iso"
cp "$work_dir/SHA512SUMS" "$release_dir/debian-SHA512SUMS"
printf '%s  %s\n' "$expected" "$(basename "$output_iso")" > "$release_dir/SHA512SUMS"

source_archive="$release_dir/kindred-source.tar.gz"
tar --exclude='./.git' --exclude='./.vm' --exclude='./artifacts' -C "$root" -czf "$source_archive" .
cat >"$release_dir/install-kindred.sh" <<'INSTALLER'
#!/usr/bin/env bash
set -euo pipefail
if [[ ${EUID} -ne 0 ]]; then
  echo 'Run as root: sudo bash install-kindred.sh' >&2
  exit 1
fi
bundle_dir=$(cd "$(dirname "$0")" && pwd)
archive="$bundle_dir/kindred-source.tar.gz"
[[ -f "$archive" ]] || { echo "Missing $archive" >&2; exit 1; }
install -d /opt/kindred
tar -xzf "$archive" -C /opt/kindred
exec bash /opt/kindred/scripts/install-kindred.sh
INSTALLER
chmod 755 "$release_dir/install-kindred.sh"

cat >"$release_dir/README.txt" <<README
Kindred OS Debian ${version} amd64 installer bundle

The ISO is the official Debian ${version} amd64 netinst image. Write it directly
to a USB drive, install Debian, then copy this bundle to the installed system
and run:

  sudo bash install-kindred.sh

That installs the Kindred desktop, its curated apps, PackageKit app store,
voice tools, and the validated GRUB configuration. A network connection is
needed while Debian installs packages.

Chromebook boot notes for Lenovo 100e Gen 2 (PHASER):
  - RW_LEGACY: boot the USB from the ChromeOS developer screen with Ctrl+L.
  - UEFI Full ROM: select the USB from the UEFI boot menu. This replaces
    ChromeOS, so back up the Chromebook first and follow MrChromebox's guide.

The source archive is included so the installer does not depend on GitHub.
See Debian's installation guide and docs.mrchromebox.tech before changing
firmware or partitioning the internal drive.
README

(cd "$release_dir" && sha256sum \
  "$(basename "$output_iso")" \
  "$(basename "$source_archive")" \
  install-kindred.sh README.txt > SHA256SUMS)
printf 'Release bundle ready: %s\n' "$release_dir"
