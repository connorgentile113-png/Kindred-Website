#!/bin/bash
# Invoked inside the installed target, never on the build host.
set -euo pipefail
[[ $EUID == 0 && -f /opt/kindred/native/main.js && -f /usr/share/xsessions/kindred.desktop ]]
install -d /usr/share/kindred/sessions /etc/lightdm/lightdm.conf.d
install -m 644 /usr/share/xsessions/kindred.desktop /usr/share/kindred/sessions/kindred.desktop
cat >/etc/lightdm/lightdm.conf.d/90-kindred-only.conf <<'EOF'
[LightDM]
sessions-directory=/usr/share/kindred/sessions
[Seat:*]
user-session=kindred
autologin-session=kindred
greeter-hide-users=true
allow-guest=false
EOF
cat >/etc/os-release <<'EOF'
NAME="Kindred OS"
PRETTY_NAME="Kindred OS 0.4"
ID=kindred
ID_LIKE=debian
VERSION_ID="0.4"
VERSION="0.4 (Home)"
VERSION_CODENAME=trixie
HOME_URL="https://github.com/connorgentile113-png/Kindred-OS"
EOF
printf 'Kindred OS\\n\\l\n' >/etc/issue
printf 'Kindred OS\n' >/etc/issue.net
printf 'Welcome to Kindred OS.\n' >/etc/motd
install -d /boot/grub/themes/kindred
install -m 644 /opt/kindred/installer/theme.txt /boot/grub/themes/kindred/theme.txt
grub-mkfont -s 28 -o /boot/grub/themes/kindred/kindred.pf2 /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
cat >/etc/default/grub.d/zz-kindred-brand.cfg <<'EOF'
GRUB_DISTRIBUTOR="Kindred OS"
GRUB_DISABLE_OS_PROBER=true
GRUB_DISABLE_RECOVERY=true
GRUB_TIMEOUT_STYLE=menu
GRUB_TIMEOUT=5
GRUB_CMDLINE_LINUX=""
GRUB_CMDLINE_LINUX_DEFAULT="quiet"
GRUB_BACKGROUND=""
GRUB_TERMINAL="gfxterm"
GRUB_TERMINAL_INPUT="console"
GRUB_TERMINAL_OUTPUT="gfxterm"
GRUB_GFXMODE="1024x768,auto"
GRUB_THEME="/boot/grub/themes/kindred/theme.txt"
GRUB_COLOR_NORMAL="light-gray/black"
GRUB_COLOR_HIGHLIGHT="black/light-green"
EOF
# Keep the previous-kernel submenu for recovery, using Kindred names.
update-grub
grub-script-check /boot/grub/grub.cfg
# UEFI boot uses systemd-boot plus a bundled kernel/initrd EFI executable, the
# same handoff validated on the Chromebook's USB image. GRUB's Linux loader
# resets that firmware, and a shim/GRUB removable fallback reproduces it, so the
# UEFI path is rebuilt here instead. GRUB stays installed for BIOS and repair.
bash /opt/kindred/scripts/install-efi-boot.sh
# Wireless/audio firmware for the Intel Chromebook; repository packages retain their licenses.
cat >/etc/apt/sources.list.d/kindred-firmware.sources <<'EOF'
Types: deb
URIs: https://deb.debian.org/debian
Suites: trixie trixie-updates
Components: non-free-firmware
Signed-By: /usr/share/keyrings/debian-archive-keyring.gpg
EOF
apt-get update
apt-get install -y --no-install-recommends firmware-iwlwifi firmware-sof-signed alsa-ucm-conf
apt-get clean
