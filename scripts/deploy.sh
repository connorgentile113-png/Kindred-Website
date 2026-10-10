#!/usr/bin/env bash
# Credentials stay outside this public repository.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${KINDRED_FIREBASE_CREDENTIALS:?Set this to a Firebase service-account file outside this repository.}"
[[ -f "$KINDRED_FIREBASE_CREDENTIALS" ]] || { echo 'Firebase credential file not found.' >&2; exit 1; }
export GOOGLE_APPLICATION_CREDENTIALS="$KINDRED_FIREBASE_CREDENTIALS"
# Only Hosting is needed: release metadata and updates are static JSON.
npx --yes firebase-tools@latest deploy --only hosting --project kindredos --non-interactive
