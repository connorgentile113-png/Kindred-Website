#!/bin/bash
# Run inside the Debian guest only, as root.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# d-i can leave the remastered netinst CD enabled until finish-install's
# later cleanup. It is unavailable to apt in-target and aborts update (100).
# Also handle older media when repairing an incomplete Kindred installation.
python3 /opt/kindred/scripts/prepare-apt.py
apt-get -o APT::Update::Error-Mode=any -o Acquire::Retries=3 update
apt-get install -y --no-install-recommends systemd-boot-efi systemd-ukify efibootmgr gjs gir1.2-gtk-4.0 gir1.2-adw-1 librsvg2-common gir1.2-soup-3.0 gir1.2-webkit2-4.1 at-spi2-core linux-image-amd64 xserver-xorg xinit openbox lightdm lightdm-gtk-greeter dbus-x11 dbus-user-session network-manager network-manager-gnome lxpolkit firefox-esr thunderbird thunar ristretto xdg-utils xdg-user-dirs x11-utils x11-xserver-utils wmctrl fonts-dejavu-core adwaita-icon-theme pipewire-audio wireplumber alsa-utils ca-certificates python3 pavucontrol system-config-printer xterm aisleriot gnome-chess stockfish gnome-sudoku gnome-mahjongg rhythmbox gpodder vlc gnome-software flatpak gnome-software-plugin-flatpak packagekit packagekit-tools appstream blueman espeak-ng python3-gi gir1.2-gstreamer-1.0 gstreamer1.0-pocketsphinx pocketsphinx-en-us gstreamer1.0-pulseaudio gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad ffmpeg
usermod -aG netdev kindred
install -d /opt/kindred /home/kindred/.config/openbox /home/kindred/Pictures /home/kindred/Documents /etc/lightdm/lightdm.conf.d
cat >/usr/share/xsessions/kindred.desktop <<'EOF'
[Desktop Entry]
Name=Kindred
Comment=Kindred desktop
Exec=/opt/kindred/scripts/session.sh
Type=Application
DesktopNames=Kindred
EOF
cat >/etc/lightdm/lightdm.conf.d/50-kindred.conf <<'EOF'
[Seat:*]
autologin-user=kindred
autologin-user-timeout=0
user-session=kindred
EOF
cat >/home/kindred/.config/openbox/rc.xml <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<openbox_config xmlns="http://openbox.org/3.4/rc">
 <focus><focusNew>yes</focusNew><followMouse>no</followMouse></focus>
 <desktops><number>1</number></desktops>
 <keyboard>
  <keybind key="W-h"><action name="Execute"><command>/opt/kindred/scripts/run-native.sh</command></action></keybind>
  <keybind key="W-Escape"><action name="Execute"><command>/opt/kindred/scripts/run-native.sh</command></action></keybind>
  <keybind key="A-Tab"><action name="NextWindow"/></keybind>
  <keybind key="A-F4"><action name="Close"/></keybind>
 </keyboard>
 <applications>
  <application type="normal"><maximized>yes</maximized></application>
  <application name="Kindred Navigation">
   <decor>no</decor><layer>above</layer><desktop>all</desktop>
   <skip_pager>yes</skip_pager><skip_taskbar>yes</skip_taskbar><focus>no</focus>
  </application>
 </applications>
</openbox_config>
EOF
chown -R kindred:kindred /home/kindred
runuser -u kindred -- xdg-user-dirs-update
runuser -u kindred -- xdg-mime default firefox-esr.desktop x-scheme-handler/http x-scheme-handler/https text/html
runuser -u kindred -- xdg-mime default thunderbird.desktop x-scheme-handler/mailto
runuser -u kindred -- xdg-mime default thunar.desktop inode/directory
runuser -u kindred -- xdg-mime default org.xfce.ristretto.desktop image/png image/jpeg
# QEMU Ethernet remains DHCP-managed by NetworkManager, including after reboot.
cat >/etc/NetworkManager/conf.d/10-kindred.conf <<'EOF'
[ifupdown]
managed=true
EOF
# Retain cloud DHCP configuration while switching its renderer to NetworkManager.
install -d /etc/netplan
cat >/etc/netplan/90-kindred.yaml <<'EOF'
network:
  version: 2
  renderer: NetworkManager
EOF
chmod 600 /etc/netplan/90-kindred.yaml
if command -v netplan >/dev/null 2>&1; then netplan generate; fi
# Prefer the general-purpose kernel with virtual display drivers.
normal_kernel=$(find /boot -maxdepth 1 -name 'vmlinuz-*-amd64' ! -name '*cloud*' | sort -V | tail -1)
if [[ -n "$normal_kernel" ]]; then
  printf 'GRUB_TOP_LEVEL="%s"\n' "$normal_kernel" >/etc/default/grub.d/99-kindred.cfg
  update-grub
fi
systemctl enable NetworkManager lightdm
systemctl set-default graphical.target
apt-get clean
systemctl disable systemd-networkd.service systemd-networkd.socket || true
bash /opt/kindred/scripts/repair-grub.sh
bash /opt/kindred/scripts/configure-app-store.sh
bash /opt/kindred/scripts/configure-kindred.sh
bash /opt/kindred/scripts/configure-app-experience.sh
bash /opt/kindred/scripts/configure-updates.sh --enable
touch /var/lib/kindred-installed
printf 'KINDRED_INSTALL_COMPLETE\n'
