#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
tar czf - native scripts tests docs installer README.md package.json VERSION | ./scripts/ssh-vm.sh 'sudo tar xzf - -C /opt/kindred'
echo 'Application updated. Restart the guest to load the updated session.'
