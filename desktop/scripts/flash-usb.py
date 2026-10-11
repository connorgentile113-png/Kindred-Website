#!/usr/bin/python3
"""Flash an explicitly identified removable USB using the desktop's UDisks service."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import gi
gi.require_version('Gio', '2.0')
from gi.repository import Gio, GLib

parser = argparse.ArgumentParser()
parser.add_argument('iso', type=Path)
parser.add_argument('device', help='Stable /dev/disk/by-id/usb-... path')
parser.add_argument('--sha256', required=True)
args = parser.parse_args()
if not args.device.startswith('/dev/disk/by-id/usb-') or '-part' in args.device:
    raise SystemExit('Use the stable by-id path for the whole USB drive.')
with args.iso.open('rb') as source:
    if hashlib.file_digest(source, 'sha256').hexdigest() != args.sha256:
        raise SystemExit('ISO checksum mismatch; nothing written.')
device = Path(args.device).resolve(strict=True)
info = json.loads(subprocess.check_output(['lsblk', '--json', '-b', '-o', 'PATH,SIZE,TRAN,RM,MOUNTPOINTS', str(device)]))['blockdevices'][0]
if info['tran'] != 'usb' or not info['rm'] or int(info['size']) < args.iso.stat().st_size:
    raise SystemExit('Target must be a removable USB large enough for the ISO.')
for child in [info, *info.get('children', [])]:
    if any(child.get('mountpoints') or []):
        subprocess.run(['udisksctl', 'unmount', '-b', child['path']], check=True)
bus = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
object_path = '/org/freedesktop/UDisks2/block_devices/' + device.name
def open_device(method):
    result, descriptors = bus.call_with_unix_fd_list_sync(
        'org.freedesktop.UDisks2', object_path, 'org.freedesktop.UDisks2.Block', method,
        GLib.Variant('(a{sv})', ({},)), GLib.VariantType.new('(h)'),
        Gio.DBusCallFlags.ALLOW_INTERACTIVE_AUTHORIZATION, -1, None, None)
    fd = descriptors.get(result.unpack()[0])
    opened = os.fstat(fd)
    if not stat.S_ISBLK(opened.st_mode) or opened.st_rdev != device.stat().st_rdev:
        os.close(fd)
        raise SystemExit('Device identity changed; aborting.')
    return fd

print(f'Writing {args.iso.name} to {args.device} ({info["size"]} bytes)', flush=True)
fd = open_device('OpenForRestore')
try:
    with args.iso.open('rb') as source:
        while chunk := source.read(4 * 1024 * 1024):
            remaining = memoryview(chunk)
            while remaining:
                count = os.write(fd, remaining)
                if count <= 0:
                    raise OSError('USB write stopped')
                remaining = remaining[count:]
    os.fsync(fd)
finally:
    os.close(fd)
print('Write finished. Reading the USB back for verification…', flush=True)
fd = open_device('OpenForBackup')
try:
    remaining = args.iso.stat().st_size
    checksum = hashlib.sha256()
    while remaining:
        chunk = os.read(fd, min(4 * 1024 * 1024, remaining))
        if not chunk:
            raise OSError('USB read ended early')
        checksum.update(chunk)
        remaining -= len(chunk)
    if checksum.hexdigest() != args.sha256:
        raise SystemExit('USB verification failed.')
finally:
    os.close(fd)
print('PASS: USB read-back SHA-256 matches the release ISO.', flush=True)
