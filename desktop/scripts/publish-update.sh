#!/usr/bin/env bash
# Build in the OS checkout; release files and metadata go to the public website repo.
set -euo pipefail
cd "$(dirname "$0")/.."
repo=connorgentile113-png/Kindred-Website
site="${KINDRED_WEBSITE_CHECKOUT:-$PWD/../Kindred-Website}"
[[ -f "$site/public/release.json" ]] || { echo 'Clone Kindred-Website beside this checkout or set KINDRED_WEBSITE_CHECKOUT.' >&2; exit 1; }
[[ -z "$(git status --porcelain)" && -z "$(git -C "$site" status --porcelain)" ]] || { echo 'Commit both checkouts before publishing.' >&2; exit 1; }
[[ "$(git -C "$site" remote get-url origin)" == "https://github.com/$repo.git" ]] || { echo 'Unexpected website origin.' >&2; exit 1; }
version=$(cat VERSION)
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
npm test
python3 -m unittest discover -s tests -p update_test.py
python3 tests/installer-packages.py
python3 tests/installer-boot.py
python3 tests/webapp-launcher.py
bash scripts/run-native.sh --storage-test
bash scripts/run-native.sh --smoke-test
git fetch origin main
git -C "$site" fetch origin main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" && "$(git -C "$site" rev-parse HEAD)" == "$(git -C "$site" rev-parse origin/main)" ]] || { echo 'Push both tested checkouts to main first.' >&2; exit 1; }
if gh release view "v$version" --repo "$repo" >/dev/null 2>&1; then
  echo 'This version already has a release. Bump VERSION for a new update.' >&2; exit 1
fi
python3 scripts/build-update.py
if ! git diff --quiet -- web/updates/version.json; then
  git add web/updates/version.json
  git commit -m "Prepare Kindred $version update metadata"
  git push origin HEAD:main
fi
gh release create "v$version" --repo "$repo" --target "$(git -C "$site" rev-parse HEAD)" --draft \
  --title "Kindred $version application update" --notes "Verified application update. Keeps user documents and settings; sign in again when ready." \
  "artifacts/kindred-update-$version.tar.gz" "artifacts/kindred-update-$version.tar.gz.sha256"
python3 - "$version" "$repo" <<'VERIFY'
import hashlib,json,subprocess,sys
from pathlib import Path
version,repo=sys.argv[1:]
releases=json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/releases']))
release=next(item for item in releases if item['tag_name']==f'v{version}')
for name in [f'kindred-update-{version}.tar.gz',f'kindred-update-{version}.tar.gz.sha256']:
    asset=next(item for item in release['assets'] if item['name']==name)
    path=Path('artifacts')/name
    with path.open('rb') as source: digest=hashlib.file_digest(source,'sha256').hexdigest()
    if asset['size']!=path.stat().st_size or asset.get('digest')!='sha256:'+digest:
        raise ValueError('Uploaded release differs from verified local file')
VERIFY
gh release edit "v$version" --repo "$repo" --draft=false --latest
archive="https://github.com/$repo/releases/download/v$version/kindred-update-$version.tar.gz"
download=$(mktemp)
trap 'rm -f -- "$download"' EXIT
curl --disable --fail --silent --show-error --location "$archive" -o "$download"
python3 - "$download" <<'VERIFY'
import hashlib,json,sys
with open(sys.argv[1],'rb') as source: digest=hashlib.file_digest(source,'sha256').hexdigest()
with open('web/updates/version.json') as source: expected=json.load(source)['sha256']
if digest!=expected: raise ValueError('Anonymous archive download checksum mismatch')
VERIFY
# Advance public metadata only after a verified anonymous download succeeds.
python3 - "$site" "$version" "$archive" <<'METADATA'
import json,shutil,sys
from pathlib import Path
site=Path(sys.argv[1]);version,archive=sys.argv[2:]
shutil.copyfile('web/updates/version.json',site/'public/updates/version.json')
path=site/'public/release.json'; release=json.loads(path.read_text())
release['application']={'version':version,'url':archive,'checksumUrl':archive+'.sha256','sha256':json.loads(Path('web/updates/version.json').read_text())['sha256']}
path.write_text(json.dumps(release,indent=2)+'\n')
METADATA
git -C "$site" add public/release.json public/updates/version.json
git -C "$site" commit -m "Publish Kindred $version application update"
git -C "$site" push origin HEAD:main
KINDRED_WEBSITE_CHECKOUT="$site" bash scripts/deploy-firebase.sh
echo "Update $version published. Kindred 0.5.2+ desktops can discover it automatically; older versions need the one-time upgrade."
