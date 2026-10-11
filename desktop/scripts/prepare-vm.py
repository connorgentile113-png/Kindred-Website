#!/usr/bin/env python3
"""Prepare an isolated Debian 13 VM. Never overwrites an existing guest disk."""
import base64
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import urllib.request

root = Path(__file__).resolve().parent.parent
vm = root / '.vm'
vm.mkdir(mode=0o700, exist_ok=True)
vm.chmod(0o700)
image = vm / 'debian-13-genericcloud-amd64.qcow2'
base_url = 'https://cloudfront.debian.net/cdimage/cloud/trixie/latest/'
for command in ['qemu-img', 'qemu-system-x86_64', 'genisoimage', 'ssh-keygen']:
    if not shutil.which(command):
        raise SystemExit(f'Missing {command}. Install qemu-system-x86 qemu-utils genisoimage openssh-client.')
if (vm / 'kindred.qcow2').exists():
    raise SystemExit('Guest already exists. Run scripts/run-vm.sh; use scripts/sync-vm.sh for app changes.')
for name in ['SHA512SUMS', image.name]:
    target = vm / name
    if not target.exists():
        print(f'Downloading {name}', flush=True)
        with urllib.request.urlopen(base_url + name, timeout=60) as response, target.with_suffix(target.suffix + '.part').open('wb') as output:
            shutil.copyfileobj(response, output)
        target.with_suffix(target.suffix + '.part').rename(target)
expected = next(line.split()[0] for line in (vm / 'SHA512SUMS').read_text().splitlines() if line.split()[-1].lstrip('*') == image.name)
with image.open('rb') as source:
    actual = hashlib.file_digest(source, 'sha512').hexdigest()
if actual != expected:
    raise SystemExit('Debian checksum mismatch; remove the incomplete image and download again.')
print('Debian SHA512 verified.', flush=True)
key = vm / 'id_ed25519'
if not key.exists():
    subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-f', str(key), '-C', 'kindred-vm-local'], check=True)
# Include only application sources, never local runtimes, private keys or VM disks.
payload = io.BytesIO()
with tarfile.open(fileobj=payload, mode='w:gz') as archive:
    for name in ['native', 'scripts', 'tests', 'docs', 'installer', 'README.md', 'package.json']:
        archive.add(root / name, arcname=name)
config = {
 'hostname': 'kindred', 'manage_etc_hosts': True,
 'users': ['default', {'name':'kindred', 'gecos':'Kindred', 'groups':['audio','video'], 'shell':'/bin/bash', 'lock_passwd':True}],
 'ssh_authorized_keys': [key.with_suffix('.pub').read_text().strip()],
 'ssh_pwauth':False, 'disable_root':True,
 'write_files': [{'path':'/var/tmp/kindred.tar.gz', 'encoding':'b64', 'content':base64.b64encode(payload.getvalue()).decode()}],
 'power_state': {'mode':'reboot', 'delay':'now', 'timeout':60, 'condition':['test','-f','/var/lib/kindred-installed']},
 'runcmd': [['mkdir','-p','/opt/kindred'], ['tar','-xzf','/var/tmp/kindred.tar.gz','-C','/opt/kindred'], ['bash','/opt/kindred/scripts/guest-setup.sh'], ['systemctl','start','lightdm']],
}
(vm / 'user-data').write_text('#cloud-config\n' + json.dumps(config))
(vm / 'meta-data').write_text('instance-id: kindred-debian-13-v1\nlocal-hostname: kindred\n')
subprocess.run(['genisoimage','-quiet','-output',str(vm/'seed.iso'),'-volid','cidata','-joliet','-rock',str(vm/'user-data'),str(vm/'meta-data')],check=True)
subprocess.run(['qemu-img','create','-f','qcow2','-F','qcow2','-b',str(image),str(vm/'kindred.qcow2'),'16G'],check=True)
print('Ready. Run ./scripts/run-vm.sh; first boot installs the desktop and applications.')
