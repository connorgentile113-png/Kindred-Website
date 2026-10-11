#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec ssh -i .vm/id_ed25519 -p 2227 -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=.vm/known_hosts debian@127.0.0.1 "$@"
