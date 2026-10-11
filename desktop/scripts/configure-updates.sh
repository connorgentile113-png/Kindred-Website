#!/usr/bin/env bash
# Install the fixed update service in the Kindred guest, never on the build host.
set -euo pipefail
[[ $EUID == 0 && -f /usr/share/xsessions/kindred.desktop && -f /opt/kindred/native/main.js ]]
case "${1:---enable}" in --enable|--disable) ;; *) exit 2;; esac
install -m 644 /opt/kindred/scripts/kindred-update.service /etc/systemd/system/kindred-update.service
install -m 644 /opt/kindred/scripts/kindred-update.timer /etc/systemd/system/kindred-update.timer
install -d /etc/polkit-1/rules.d
cat >/etc/polkit-1/rules.d/49-kindred-update.rules <<'RULE'
polkit.addRule(function(action, subject) {
    if (action.id === 'org.freedesktop.systemd1.manage-units' &&
        action.lookup('unit') === 'kindred-update.service' &&
        action.lookup('verb') === 'start' &&
        subject.user === 'kindred' && subject.local && subject.active) {
        return polkit.Result.YES;
    }
});
RULE
systemctl daemon-reload
if [[ "${1:---enable}" == --enable ]]; then
  systemctl enable --now kindred-update.timer
else
  systemctl disable --now kindred-update.timer
fi
