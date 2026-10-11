"""Validate the application update and preserved firmware payload on release media."""
import argparse
import hashlib
import io
import os
from pathlib import Path
import struct
import subprocess
import tarfile
import tempfile
p=argparse.ArgumentParser();p.add_argument('base',type=Path);p.add_argument('release',type=Path);args=p.parse_args()
def esp(path):
    with path.open('rb') as disk:
        disk.seek(512); header=disk.read(92)
        assert header[:8]==b'EFI PART','Missing GPT'
        entries, count, size=struct.unpack_from('<QII',header,72)
        disk.seek(entries*512)
        for _ in range(count):
            entry=disk.read(size)
            if entry[:16]==bytes.fromhex('28732ac11ff8d211ba4b00a0c93ec93b'):
                start,end=struct.unpack_from('<QQ',entry,32)
                disk.seek(start*512); return hashlib.sha256(disk.read((end-start+1)*512)).hexdigest()
        raise AssertionError('Missing EFI system partition')
assert esp(args.base)==esp(args.release),'EFI partition changed'
with tempfile.TemporaryDirectory(prefix='kindred-media-check-') as tmp:
    root=Path(tmp); xorriso=os.environ.get('XORRISO','xorriso')
    for label,path in [('base',args.base),('release',args.release)]:
        folder=root/label;folder.mkdir()
        for name in ['kindred/source.tar.gz','md5sum.txt','install.amd/vmlinuz','install.amd/initrd.gz','install.amd/rescue.gz','isolinux/menu.cfg']:
            out=folder/name;out.parent.mkdir(parents=True,exist_ok=True)
            subprocess.run([xorriso,'-osirrox','on','-indev',str(path.resolve()),'-extract','/'+name,str(out)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    for name in ['install.amd/vmlinuz','install.amd/initrd.gz','install.amd/rescue.gz','isolinux/menu.cfg']:
        assert (root/'base'/name).read_bytes()==(root/'release'/name).read_bytes(),f'Boot payload changed: {name}'
    source=root/'release/kindred/source.tar.gz';checksum=hashlib.md5(source.read_bytes()).hexdigest()
    assert checksum+'  ./kindred/source.tar.gz' in (root/'release/md5sum.txt').read_text(),'Media checksum mismatch'
    with tarfile.open(source,'r:gz') as archive:
        assert archive.extractfile('VERSION').read().strip()==Path('VERSION').read_bytes().strip()
        assert 'scripts/configure-updates.sh' in archive.getnames()
        assert not any(name.startswith(('firebase/','.vm/','.git/')) for name in archive.getnames())
print('PASS: identical EFI partition/kernel/initrds/BIOS menu; valid media checksum and current release payload.')
