#!/usr/bin/env python3
"""Verified, staged Kindred application updates. Never reboots or edits user data."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

REPO = 'connorgentile113-png/Kindred-Website'
TRUSTED_REPOS = (REPO, 'CE-CODE-official/Kindred-OS')
MANIFEST = 'https://kindredos.web.app/updates/version'
MEMBERS = {'native', 'scripts', 'tests', 'docs', 'installer', 'README.md', 'package.json', 'VERSION', 'web', 'app.js'}


def version(value):
    if not isinstance(value, str) or not re.fullmatch(r'\d+\.\d+\.\d+', value):
        raise ValueError('Invalid stable version')
    return tuple(map(int, value.split('.')))


def read_url(url, limit=2_000_000):
    request = urllib.request.Request(url, headers={'User-Agent': 'Kindred-Updater', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Response exceeds size limit')
    return data


def verified_url(url):
    # Only the project release can supply privileged application code.
    repositories = '|'.join(re.escape(repo) for repo in TRUSTED_REPOS)
    pattern = rf'https://github.com/(?:{repositories})/releases/download/v(\d+\.\d+\.\d+)/kindred-update-\1\.tar\.gz'
    if not isinstance(url, str) or not re.fullmatch(pattern, url):
        raise ValueError('Update must be a versioned Kindred GitHub release asset')
    return url


def extract_payload(archive, target, expected):
    with tarfile.open(archive, 'r:gz') as source:
        entries = source.getmembers()
        if len(entries) > 10000 or sum(e.size for e in entries) > 100_000_000:
            raise ValueError('Archive exceeds size limit')
        for entry in entries:
            path = PurePosixPath(entry.name)
            if path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] not in MEMBERS:
                raise ValueError('Archive contains an unexpected path')
            if not (entry.isfile() or entry.isdir()):
                raise ValueError('Archive contains links or special files')
            if entry.mode & 0o6000:
                raise ValueError('Archive contains privileged file permissions')
        source.extractall(target, members=entries, filter='data')
    for name in ['native/main.js', 'native/store.js', 'native/assistant.js', 'scripts/run-native.sh', 'scripts/update-engine.py', 'VERSION']:
        if not (target / name).is_file():
            raise ValueError(f'Archive is missing {name}')
    if (target / 'VERSION').read_text().strip() != expected:
        raise ValueError('Archive version does not match manifest')
    for script in (target / 'scripts').glob('*.sh'):
        subprocess.run(['bash', '-n', str(script)], check=True, capture_output=True)


def install(archive, install_dir, backup_dir, latest, checksum, activate=None):
    if not re.fullmatch(r'[a-f0-9]{64}', checksum or ''):
        raise ValueError('A SHA-256 checksum is required')
    with open(archive, 'rb') as source:
        if hashlib.file_digest(source, 'sha256').hexdigest() != checksum:
            raise ValueError('Update checksum mismatch')
    install_dir, backup_dir = Path(install_dir), Path(backup_dir)
    if install_dir.is_symlink() or not install_dir.is_dir():
        raise ValueError('Installation must be an existing directory')
    # Stage on the same filesystem so renames are atomic. Keep local config extras.
    with tempfile.TemporaryDirectory(prefix='.kindred-stage-', dir=install_dir.parent) as temporary:
        work = Path(temporary)
        payload = work / 'payload'; payload.mkdir()
        extract_payload(archive, payload, latest)
        stage = work / 'installation'
        shutil.copytree(install_dir, stage, symlinks=True)
        for member in MEMBERS:
            src, dst = payload / member, stage / member
            if not src.exists():
                continue
            if dst.is_symlink() or dst.is_file():
                dst.unlink()
            elif dst.is_dir():
                shutil.rmtree(dst)
            if src.is_dir():
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)
        backup_dir.mkdir(parents=True, exist_ok=True)
        current = (install_dir / 'VERSION').read_text().strip() if (install_dir / 'VERSION').exists() else '0.4.1'
        backup = backup_dir / f'kindred-{current}-{os.getpid()}.tar.gz'
        with tarfile.open(backup, 'w:gz') as saved:
            saved.add(install_dir, arcname=install_dir.name)
        previous = work / 'previous'
        install_dir.rename(previous)
        try:
            stage.rename(install_dir)
            if activate:
                activate()
        except BaseException:
            failed = work / 'failed'
            if install_dir.exists():
                install_dir.rename(failed)
            previous.rename(install_dir)
            raise
    return backup


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['--check', '--apply'], nargs='?', default='--check')
    # Bash forwards a mode beginning with -- after the argument delimiter.
    args = parser.parse_args()
    install_dir = Path('/opt/kindred')
    current = (install_dir / 'VERSION').read_text().strip() if (install_dir / 'VERSION').exists() else '0.4.1'
    release = json.loads(read_url(MANIFEST))
    latest = release['latest']
    if version(latest) <= version(current):
        print(f'Kindred is up to date ({current}).'); return
    if args.mode == '--check':
        print(f'Kindred {latest} is available (installed: {current}).'); return
    if os.geteuid() != 0:
        raise PermissionError('Start kindred-update.service to install updates')
    lock_dir = Path('/var/lib/kindred'); lock_dir.mkdir(parents=True, exist_ok=True)
    with (lock_dir / 'update.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        url = verified_url(release['archive'])
        if f'/v{latest}/' not in url:
            raise ValueError('Release URL does not match version')
        with tempfile.TemporaryDirectory(prefix='kindred-download-') as temporary:
            archive = Path(temporary) / 'update.tar.gz'
            archive.write_bytes(read_url(url, 50_000_000))
            # Install service changes without enabling a timer the user disabled.
            enabled = subprocess.run(['systemctl', 'is-enabled', '--quiet', 'kindred-update.timer']).returncode == 0
            def activate():
                subprocess.run(['bash', '/opt/kindred/scripts/configure-media.sh'], check=True)
                subprocess.run(['bash', '/opt/kindred/scripts/configure-updates.sh', '--enable' if enabled else '--disable'], check=True)
            backup = install(archive, install_dir, lock_dir / 'backups', latest, release['sha256'], activate)
            print(f'Updated Kindred to {latest}. Previous version: {backup}. Sign in again when ready.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Kindred update did not finish: {error}', file=__import__('sys').stderr)
        raise SystemExit(1)
