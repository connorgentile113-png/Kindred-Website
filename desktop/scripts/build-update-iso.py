#!/usr/bin/env python3
"""Update the application payload on proven v0.4.1 media, preserving its boot path."""
import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
ROOT = Path(__file__).resolve().parents[1]
EXPECTED = 'ffe7c541112aa060f6aa59b49912bfdeb8c046b09daadcae350342dd9316f5fb'
p = argparse.ArgumentParser(); p.add_argument('source', type=Path); p.add_argument('output', type=Path); args = p.parse_args()
with args.source.open('rb') as source:
    if hashlib.file_digest(source,'sha256').hexdigest() != EXPECTED: raise SystemExit('Base release checksum mismatch')
if args.output.exists(): raise SystemExit('Refusing to overwrite output')
with tempfile.TemporaryDirectory(prefix='kindred-release-media-') as tmp:
    source_archive = Path(tmp) / 'source.tar.gz'
    with tarfile.open(source_archive,'w:gz') as archive:
        for name in ['native','scripts','tests','docs','installer','web','app.js','README.md','package.json','VERSION']:
            archive.add(ROOT/name,arcname=name,filter=lambda info: None if info.name == 'web/release.json' or info.name == 'web/updates' or info.name.startswith('web/updates/') or '__pycache__' in info.name or info.name.endswith('.pyc') else info)
    xorriso = os.environ.get('XORRISO', 'xorriso')
    checksums = Path(tmp) / 'md5sum.txt'
    subprocess.run([xorriso, '-osirrox', 'on', '-indev', str(args.source.resolve()), '-extract', '/md5sum.txt', str(checksums)], check=True)
    old = checksums.read_text().splitlines()
    new = hashlib.md5(source_archive.read_bytes()).hexdigest() + '  ./kindred/source.tar.gz'
    if not any(line.endswith('  ./kindred/source.tar.gz') for line in old): raise SystemExit('Base media is missing the payload checksum')
    checksums.chmod(0o644)
    checksums.write_text('\n'.join(new if line.endswith('  ./kindred/source.tar.gz') else line for line in old) + '\n')
    subprocess.run([os.environ.get('XORRISO','xorriso'), '-indev',str(args.source.resolve()), '-outdev','stdio:'+str(args.output.resolve()),
        '-map',str(source_archive),'/kindred/source.tar.gz', '-map',str(checksums),'/md5sum.txt', '-boot_image','any','replay','-commit','-end'],check=True)
# Make the verified output read-only before hashing and publishing.
args.output.chmod(0o444)
with args.output.open('rb') as source: checksum=hashlib.file_digest(source,'sha256').hexdigest()
args.output.with_suffix('.iso.sha256').write_text(f'{checksum}  {args.output.name}\n')
print(args.output,checksum)
