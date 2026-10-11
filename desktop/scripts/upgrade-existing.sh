#!/usr/bin/env bash
# One-time app-only migration on an existing Kindred machine. No boot changes.
set -euo pipefail
[[ $EUID == 0 && -f /opt/kindred/native/main.js && -f /usr/share/xsessions/kindred.desktop ]] || {
  echo 'Run as administrator on an existing Kindred installation.' >&2; exit 1;
}
bash "$(dirname "$0")/configure-media.sh"
cd "$(dirname "$0")/.."
python3 - <<'PY'
import importlib.util
import hashlib
from pathlib import Path
import subprocess
import tarfile
import tempfile
spec = importlib.util.spec_from_file_location('engine', 'scripts/update-engine.py')
engine = importlib.util.module_from_spec(spec); spec.loader.exec_module(engine)
latest = Path('VERSION').read_text().strip(); engine.version(latest)
with tempfile.TemporaryDirectory(prefix='kindred-migration-') as temporary:
    archive = Path(temporary) / 'application.tar.gz'
    with tarfile.open(archive, 'w:gz') as out:
        for name in sorted(engine.MEMBERS):
            if Path(name).exists():
                out.add(name, arcname=name, filter=lambda info: None if '__pycache__' in info.name or info.name.endswith('.pyc') else info)
    checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
    def activate():
        subprocess.run(['bash', '/opt/kindred/scripts/configure-app-experience.sh'], check=True)
        subprocess.run(['bash', '/opt/kindred/scripts/configure-updates.sh', '--enable'], check=True)
    backup = engine.install(archive, '/opt/kindred', '/var/lib/kindred/backups', latest, checksum, activate)
    print('Kindred updated. Previous installation:', backup)
    print('Sign in again when ready. Your work has not been closed.')
PY
