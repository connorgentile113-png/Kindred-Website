#!/bin/bash
# Install the Kindred UEFI boot path inside the installed system: systemd-boot
# plus a bundled kernel/initrd EFI executable (UKI). This matches the validated
# USB boot path and keeps shim and GRUB out of the UEFI path.
#
# Safe to re-run. It is also used as a kernel and initramfs update hook, so a
# new kernel or initrd always produces a fresh EFI executable.
set -euo pipefail

esp=${KINDRED_ESP:-/boot/efi}
stub=/usr/lib/systemd/boot/efi/linuxx64.efi.stub
loader=/usr/lib/systemd/boot/efi/systemd-bootx64.efi
ukify=/usr/bin/ukify

if [[ ! -d $esp ]]; then
  echo 'No EFI system partition; this is not a UEFI installation.' >&2
  exit 0
fi
for tool in "$stub" "$loader" "$ukify"; do
  if [[ ! -e $tool ]]; then
    echo "Missing $tool; install systemd-boot-efi and systemd-ukify." >&2
    exit 1
  fi
done

root_uuid=$(findmnt -no UUID /)
if [[ -z $root_uuid ]]; then
  echo 'Cannot determine the root filesystem UUID.' >&2
  exit 1
fi
# The firmware-selected console mode is preserved; quiet keeps the handoff
# identical to the USB image that booted on the Chromebook.
cmdline="root=UUID=$root_uuid ro quiet loglevel=3"

install -d -m 755 "$esp/EFI/systemd" "$esp/EFI/BOOT" "$esp/EFI/Linux" "$esp/loader"
install -m 644 "$loader" "$esp/EFI/systemd/systemd-bootx64.efi"
install -m 644 "$loader" "$esp/EFI/BOOT/BOOTX64.EFI"
cat >"$esp/loader/loader.conf" <<'CONF'
timeout 3
console-mode keep
editor no
auto-entries yes
auto-firmware no
CONF

# Build for the newest kernel plus one recovery kernel, newest first.
versions=()
while read -r kernel; do
  versions+=("${kernel#/boot/vmlinuz-}")
done < <(find /boot -maxdepth 1 -name 'vmlinuz-*-amd64' ! -name '*cloud*' | sort -Vr)
if [[ ${#versions[@]} -eq 0 ]]; then
  echo 'No installed amd64 kernel found.' >&2
  exit 1
fi
built=0
for version in "${versions[@]:0:2}"; do
  initrd="/boot/initrd.img-$version"
  if [[ ! -f $initrd ]]; then
    continue
  fi
  "$ukify" build --config=/dev/null --stub="$stub" --efi-arch=x64 \
    --linux="/boot/vmlinuz-$version" --initrd="$initrd" --cmdline="$cmdline" \
    --os-release=@/etc/os-release \
    --output="$esp/EFI/Linux/kindred-$version.efi"
  built=$((built + 1))
done
if [[ $built -eq 0 ]]; then
  echo 'No kernel with a matching initrd was found.' >&2
  exit 1
fi

# Remove EFI executables whose kernel is no longer installed.
for uki in "$esp"/EFI/Linux/kindred-*.efi; do
  [[ -e $uki ]] || continue
  version=${uki##*/kindred-}
  version=${version%.efi}
  [[ -f /boot/vmlinuz-$version ]] || rm -f "$uki"
done

# systemd-boot is the only UEFI loader, including when firmware still holds a
# stale shim entry: those binaries are moved out of every firmware-scanned path
# (they are kept, not deleted, for manual rescue). The BIOS path uses the MBR
# and /boot/grub and is unaffected.
disabled="$esp/EFI/kindred-disabled"
for file in \
  "$esp/EFI/BOOT/shimx64.efi" "$esp/EFI/BOOT/grubx64.efi" "$esp/EFI/BOOT/grub.cfg" \
  "$esp/EFI/BOOT/mmx64.efi" "$esp/EFI/BOOT/fbx64.efi" "$esp/EFI/BOOT/BOOTX64.CSV" \
  "$esp/EFI/debian/shimx64.efi" "$esp/EFI/debian/grubx64.efi" "$esp/EFI/debian/mmx64.efi" \
  "$esp/EFI/debian/fbx64.efi" "$esp/EFI/debian/BOOTX64.CSV"; do
  if [[ -e $file ]]; then
    install -d -m 755 "$disabled"
    mv -f "$file" "$disabled/$(basename "$file")"
  fi
done

# Prefer the Kindred loader in firmware NVRAM when the firmware keeps entries.
# Failures here are not fatal: the removable fallback above still boots.
if [[ -d /sys/firmware/efi ]] && command -v efibootmgr >/dev/null 2>&1; then
  source=$(findmnt -no SOURCE "$esp" || true)
  disk=${source:+$(lsblk -no PKNAME "$source" 2>/dev/null || true)}
  part=${source:+$(lsblk -no PARTN "$source" 2>/dev/null || true)}
  if [[ -n ${disk:-} && -n ${part:-} && -b /dev/$disk ]]; then
    efibootmgr --create --disk "/dev/$disk" --part "$part" --label 'Kindred OS' \
      --loader '\EFI\systemd\systemd-bootx64.efi' >/dev/null || \
      echo 'Warning: could not add a Kindred OS firmware boot entry.' >&2
    ids=$(efibootmgr | sed -n 's/^Boot\([0-9A-F]\{4\}\)[ *]\(.*\)$/\1 \2/p' || true)
    kindred=$(printf '%s\n' "$ids" | awk '/Kindred OS$/ {print $1; exit}')
    # The Debian entry boots shim then GRUB, which resets on this firmware.
    printf '%s\n' "$ids" | awk '/ debian$/ {print $1}' | while read -r id; do
      efibootmgr --delete-bootnum --bootnum "$id" >/dev/null 2>&1 || true
    done
    if [[ -n $kindred ]]; then
      order=$(efibootmgr | sed -n 's/^Boot\([0-9A-F]\{4\}\)[ *].*$/\1/p' |
        awk -v k="$kindred" 'BEGIN{printf "%s", k} $0 != k {printf ",%s", $0}')
      efibootmgr --bootorder "$order" >/dev/null 2>&1 || \
        echo 'Warning: could not set the firmware boot order.' >&2
    fi
  fi
fi

# Keep the EFI executables current when the kernel or initramfs changes.
cat >/etc/kernel/postinst.d/zzz-kindred-uki <<'HOOK'
#!/bin/sh
set -e
exec bash /opt/kindred/scripts/install-efi-boot.sh
HOOK
install -d -m 755 /etc/initramfs/post-update.d
cat >/etc/initramfs/post-update.d/zzz-kindred-uki <<'HOOK'
#!/bin/sh
set -e
exec bash /opt/kindred/scripts/install-efi-boot.sh
HOOK
chmod 755 /etc/kernel/postinst.d/zzz-kindred-uki /etc/initramfs/post-update.d/zzz-kindred-uki

echo "Kindred UEFI boot path ready: systemd-boot plus $(ls "$esp"/EFI/Linux/kindred-*.efi | wc -l) EFI kernel image(s)."
