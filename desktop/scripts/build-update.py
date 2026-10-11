#!/usr/bin/env python3
"""Package only public application files; credentials and VM data are excluded."""
import hashlib
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
version = (ROOT / 'VERSION').read_text().strip()
output = ROOT / 'artifacts' / f'kindred-update-{version}.tar.gz'
output.parent.mkdir(exist_ok=True)
with tarfile.open(output, 'w:gz') as archive:
    for name in ['native', 'scripts', 'tests', 'docs', 'installer', 'web', 'app.js', 'README.md', 'package.json', 'VERSION']:
        archive.add(ROOT / name, arcname=name, filter=lambda info: None if info.name == 'web/release.json' or info.name == 'web/updates' or info.name.startswith('web/updates/') or '__pycache__' in info.name or info.name.endswith('.pyc') else info)
checksum = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix('.gz.sha256').write_text(f'{checksum}  {output.name}\n')
# Manifest is deliberately outside the application payload to avoid a checksum cycle.
manifest = {'latest': version, 'minimum': '0.4.0', 'url': f'https://github.com/connorgentile113-png/Kindred-Website/releases/tag/v{version}',
            'archive': f'https://github.com/connorgentile113-png/Kindred-Website/releases/download/v{version}/{output.name}',
            'sha256': checksum, 'notes': 'Confidence-focused introduction and isolated practice; removal confirmation, durable Undo, and reading controls. Existing 0.5.1 and earlier installations require the one-time administrator upgrade.'}
(ROOT / 'web/updates').mkdir(parents=True, exist_ok=True)
(ROOT / 'web/updates/version.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(output, checksum)
