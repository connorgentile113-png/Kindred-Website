#!/usr/bin/env python3
"""Build test media with a separate FAT ESP and systemd-boot, without shim/GRUB."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def sha256(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def build(source, output, expected, bootloader):
    if sha256(source) != expected:
        raise SystemExit('Source ISO checksum mismatch')
    if output.exists():
        raise SystemExit(f'Refusing to overwrite {output}')
    xorriso = os.environ.get('XORRISO', 'xorriso')
    with tempfile.TemporaryDirectory(prefix='kindred-direct-efi-') as temp:
        work = Path(temp)
        tree = work / 'iso'
        run(xorriso, '-osirrox', 'on', '-indev', 'stdio:' + str(source), '-extract', '/', tree)
        for directory, _, _ in os.walk(tree):
            Path(directory).chmod(0o755)
        for item in tree.rglob('*'):
            if item.is_file() and not item.is_symlink():
                item.chmod(item.stat().st_mode | 0o200)

        esp = work / 'esp'
        for name in ['EFI/BOOT', 'EFI/Kindred', 'loader/entries']:
            (esp / name).mkdir(parents=True, exist_ok=True)
        shutil.copy(bootloader, esp / 'EFI/BOOT/BOOTX64.EFI')
        (esp / 'loader/loader.conf').write_text(
            'default kindred-install.conf\ntimeout menu-force\nconsole-mode keep\n'
            'editor no\nauto-entries no\nauto-firmware no\n'
            'auto-poweroff yes\nauto-reboot no\n')
        for name, title in [('install', 'Install Kindred OS - USB test 3'),
                            ('repair', 'Repair Kindred OS - USB test 3')]:
            shutil.copy(tree / 'kindred' / (name + '.efi'), esp / 'EFI/Kindred' / (name + '.efi'))
            (esp / 'loader/entries' / ('kindred-' + name + '.conf')).write_text(
                f'title {title}\nsort-key kindred-{name}\nefi /EFI/Kindred/{name}.efi\n')
        fat = work / 'efi.img'
        with fat.open('wb') as file:
            file.truncate(128 * 1024 * 1024)
        run('mformat', '-i', fat, '-F', '-v', 'KINDRED_T3', '::')
        run('mcopy', '-i', fat, '-s', esp / 'EFI', esp / 'loader', '::/')

        # The firmware now reads a normal FAT32 ESP. No ISO9660 EFI loader,
        # signed shim, or GRUB is involved in the UEFI path.
        for relative in ['EFI', 'boot/grub']:
            path = tree / relative
            if path.exists():
                shutil.rmtree(path)
        for name in ['install.efi', 'repair.efi']:
            (tree / 'kindred' / name).unlink()
        (tree / '.disk/info').write_text('Kindred OS 0.4.0 USB test 3 (direct EFI)\n')
        excluded = {'md5sum.txt', 'isolinux/boot.cat', 'isolinux/isolinux.bin'}
        lines = []
        for path in sorted(tree.rglob('*')):
            relative = str(path.relative_to(tree))
            if path.is_file() and not path.is_symlink() and relative not in excluded:
                with path.open('rb') as file:
                    checksum = hashlib.file_digest(file, 'md5').hexdigest()
                lines.append(f'{checksum}  ./{relative}\n')
        (tree / 'md5sum.txt').write_text(''.join(lines))
        mbr = work / 'isohybrid.bin'
        with source.open('rb') as file:
            mbr.write_bytes(file.read(432))
        run(xorriso, '-as', 'mkisofs', '-r', '-J', '-V', 'KINDRED_USB_T3',
            '-o', output, '-isohybrid-mbr', mbr, '-partition_offset', '16',
            '-append_partition', '2', '0xef', fat, '-appended_part_as_gpt',
            '-c', 'isolinux/boot.cat', '-b', 'isolinux/isolinux.bin',
            '-no-emul-boot', '-boot-load-size', '4', '-boot-info-table',
            '-eltorito-alt-boot', '-e', '--interval:appended_partition_2:all::',
            '-no-emul-boot', tree)
    output.with_suffix('.iso.sha256').write_text(f'{sha256(output)}  {output.name}\n')
    print(f'Built {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--bootloader', type=Path, required=True)
    args = parser.parse_args()
    build(args.source.resolve(), args.output.resolve(), args.sha256, args.bootloader.resolve())
