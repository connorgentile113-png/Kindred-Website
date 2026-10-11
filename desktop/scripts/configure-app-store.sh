#!/bin/bash
# Permit this single-user desktop to install signed repository applications.
set -euo pipefail
[[ $(id -u) == 0 && -f /usr/share/xsessions/kindred.desktop ]] || exit 1
install -d -m 755 /etc/polkit-1/rules.d
cat >/etc/polkit-1/rules.d/50-kindred-store.rules <<RULE
polkit.addRule(function(action, subject) {
    if (subject.user === "kindred" && subject.local && subject.active &&
        (action.id === "org.freedesktop.packagekit.package-install" ||
         action.id === "org.freedesktop.packagekit.system-sources-refresh")) {
        return polkit.Result.YES;
    }
});
RULE
chmod 644 /etc/polkit-1/rules.d/50-kindred-store.rules
