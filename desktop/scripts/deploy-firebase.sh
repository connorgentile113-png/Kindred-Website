#!/usr/bin/env bash
# Deploy only the standalone public website. Credentials remain in this checkout.
set -euo pipefail
cd "$(dirname "$0")/.."
credentials="${KINDRED_FIREBASE_CREDENTIALS:-firebase/kindredos-firebase-adminsdk-fbsvc-4c7ff1ab61.json}"
[[ -f "$credentials" ]] || { echo 'Set KINDRED_FIREBASE_CREDENTIALS to a service-account file.' >&2; exit 1; }
credentials=$(realpath "$credentials")
site="${KINDRED_WEBSITE_CHECKOUT:-$PWD/../Kindred-Website}"
[[ -f "$site/scripts/deploy.sh" ]] || { echo 'Clone the public Kindred-Website repository beside this checkout or set KINDRED_WEBSITE_CHECKOUT.' >&2; exit 1; }
KINDRED_FIREBASE_CREDENTIALS="$credentials" bash "$site/scripts/deploy.sh"
