#!/bin/bash
# Only run inside the Kindred guest. Never write a host bootloader.
set -euo pipefail
[[ $(id -u) == 0 && -f /usr/share/xsessions/kindred.desktop ]] || { echo "Run as root after the Kindred desktop files are installed." >&2; exit 1; }
install -d /etc/default/grub.d
[[ -e /etc/default/grub.kindred-backup ]] || cp -a /etc/default/grub /etc/default/grub.kindred-backup
kernel=$(find /boot -maxdepth 1 -name "vmlinuz-*-amd64" ! -name "*cloud*" | sort -V | tail -1)
[[ -n "$kernel" ]] || { echo "Install linux-image-amd64 first." >&2; exit 1; }
cat >/etc/default/grub.d/99-kindred.cfg <<CFG
# Keep boot visible on the VM display and retain serial diagnostics.
GRUB_DEFAULT=0
GRUB_TIMEOUT_STYLE=menu
GRUB_TIMEOUT=3
GRUB_RECORDFAIL_TIMEOUT=3
GRUB_TERMINAL="console"
GRUB_TERMINAL_INPUT="console"
GRUB_TERMINAL_OUTPUT="console"
GRUB_CMDLINE_LINUX="console=ttyS0,115200 console=tty0"
GRUB_CMDLINE_LINUX_DEFAULT="quiet"
GRUB_TOP_LEVEL="$kernel"
CFG
update-grub
grub-script-check /boot/grub/grub.cfg
echo "Kindred boot menu updated and validated."
