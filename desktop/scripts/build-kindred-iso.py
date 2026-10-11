#!/usr/bin/env python3
"""Remaster a verified Debian 13.7 netinst with integrated Kindred installation."""
import argparse
import gzip
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BASE_SHA512 = 'ef04d0276850d70e4aaec0b55003628660e9631b26e35215a70ab3c8c707294a4b12731bc73c75a932902f703a7c278310ca99df28d6b36fb06d5618d8d0f678'

def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def digest(path, algorithm):
    with path.open('rb') as source:
        return hashlib.file_digest(source, algorithm).hexdigest()

def build(base, output, efi_stub=None, ukify=None):
    assert digest(base, 'sha512') == BASE_SHA512, 'Base ISO does not match verified Debian 13.7 amd64'
    if output.exists():
        raise SystemExit(f'Refusing to overwrite {output}')
    output.parent.mkdir(parents=True, exist_ok=True)
    xorriso = os.environ.get('XORRISO', 'xorriso')
    with tempfile.TemporaryDirectory(prefix='kindred-iso-') as temporary:
        work = Path(temporary)
        tree = work / 'iso'
        run(xorriso, '-osirrox', 'on', '-indev', str(base), '-extract', '/', str(tree))
        for directory, _, _ in os.walk(tree):
            Path(directory).chmod(0o755)
        for item in tree.rglob('*'):
            if item.is_file() and not item.is_symlink():
                item.chmod(item.stat().st_mode | 0o200)
        (tree / 'kindred').mkdir()
        with tarfile.open(tree / 'kindred/source.tar.gz', 'w:gz') as archive:
            for name in ['native', 'scripts', 'tests', 'docs', 'installer', 'README.md', 'package.json']:
                archive.add(ROOT / name, arcname=name, filter=lambda info: None if '__pycache__' in info.name or info.name.endswith('.pyc') else info)
        grub_config = 'grub-compat.cfg' if efi_stub else 'grub.cfg'
        shutil.copy(ROOT / 'installer' / grub_config, tree / 'boot/grub/grub.cfg')
        shutil.copy(ROOT / 'installer/theme.txt', tree / 'boot/grub/kindred-theme.txt')
        for name in ['isolinux.cfg', 'menu.cfg']:
            shutil.copy(ROOT / 'installer' / name, tree / 'isolinux' / name)
        # Use a BIOS COM32 module matching the libraries on the Debian media.
        bios_modules = Path(os.environ.get('SYSLINUX_BIOS_MODULES', '/usr/lib/syslinux/modules/bios'))
        for name in ['libcom32.c32', 'libutil.c32']:
            if (bios_modules / name).read_bytes() != (tree / 'isolinux' / name).read_bytes():
                raise SystemExit(f'Syslinux module version mismatch: {name}')
        shutil.copy(bios_modules / 'poweroff.c32', tree / 'isolinux/poweroff.c32')
        run('grub-mkfont', '-s', '28', '-o', str(tree / 'boot/grub/kindred.pf2'), '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        # Retain the original rescue initrd, without installation automation.
        shutil.copy(tree / 'install.amd/initrd.gz', tree / 'install.amd/rescue.gz')
        overlay = work / 'overlay'
        overlay.mkdir()
        shutil.copy(ROOT / 'installer/preseed.cfg', overlay / 'preseed.cfg')
        unpack = work / 'unpack'
        unpack.mkdir()
        raw = gzip.decompress((tree / 'install.amd/initrd.gz').read_bytes())
        # Extract only presentation templates; leave all device nodes and program data intact.
        run('cpio', '-id', '--quiet', 'var/lib/dpkg/info/main-menu.templates', 'etc/lsb-release', input=raw, cwd=unpack)
        for relative in ['var/lib/dpkg/info/main-menu.templates', 'etc/lsb-release']:
            source = unpack / relative
            target = overlay / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            text = source.read_text()
            if relative.endswith('templates'):
                text = '\n'.join(line.replace('Debian', 'Kindred OS') if line.startswith('Description') else line for line in text.split('\n'))
            else:
                # Keep DISTRIB_ID for installer functionality, customize the displayed title.
                text = text.replace('Debian GNU/Linux installer', 'Kindred OS installer')
            target.write_text(text)
        names = '\n'.join(str(p.relative_to(overlay)) for p in sorted(overlay.rglob('*'))) + '\n'
        archive = subprocess.check_output(['cpio', '-o', '-H', 'newc', '--quiet'], input=names.encode(), cwd=overlay)
        (tree / 'install.amd/initrd.gz').write_bytes(gzip.compress(raw + archive, mtime=0))
        if efi_stub:
            # Use the kernel's EFI entry point instead of GRUB's Linux loader.
            # Keep diagnostic options before --- so d-i does not persist them.
            for name, initrd, cmdline in [
                ('install', 'initrd.gz', 'auto=true priority=high panic=0 ---'),
                ('repair', 'rescue.gz', 'rescue/enable=true priority=low panic=0 ---'),
            ]:
                run('/usr/bin/python3', str(ukify), 'build', '--config=/dev/null',
                    '--stub=' + str(efi_stub), '--efi-arch=x64',
                    '--linux=' + str(tree / 'install.amd/vmlinuz'),
                    '--initrd=' + str(tree / 'install.amd' / initrd),
                    '--cmdline=' + cmdline,
                    '--os-release=ID=kindred\nNAME="Kindred OS"\nVERSION_ID=0.4.0\n',
                    '--output=' + str(tree / 'kindred' / (name + '.efi')))
        (tree / '.disk/info').write_text('Kindred OS 0.4.0 amd64 installer\n')
        # Regenerate media checksums for modified content. Bootloader patch areas are excluded.
        excluded = {'md5sum.txt', 'isolinux/boot.cat', 'isolinux/isolinux.bin'}
        lines = [f'{digest(p, "md5")}  ./{p.relative_to(tree)}\n' for p in sorted(tree.rglob('*'))
                 if p.is_file() and not p.is_symlink() and str(p.relative_to(tree)) not in excluded]
        (tree / 'md5sum.txt').write_text(''.join(lines))
        command = [xorriso, '-indev', str(base), '-outdev', 'stdio:' + str(output)]
        # Leave original boot image extents intact so replay can preserve hybrid EFI boot.
        for relative in ['kindred', 'boot/grub/grub.cfg', 'boot/grub/kindred.pf2', 'boot/grub/kindred-theme.txt',
                         'isolinux/isolinux.cfg', 'isolinux/menu.cfg', 'isolinux/poweroff.c32', 'install.amd/initrd.gz',
                         'install.amd/rescue.gz', '.disk/info', 'md5sum.txt']:
            command.extend(['-map', str(tree / relative), '/' + relative])
        run(*command, '-volid', 'KINDRED_OS_040', '-boot_image', 'any', 'replay', '-commit', '-end')
    output.with_suffix('.iso.sha256').write_text(f'{digest(output, "sha256")}  {output.name}\n')
    print(f'Built {output}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('base', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--efi-stub', type=Path, help='Build UEFI compatibility image using this systemd EFI stub (Secure Boot off)')
    parser.add_argument('--ukify', type=Path, help='Path to the ukify Python program; required with --efi-stub')
    args = parser.parse_args()
    if bool(args.efi_stub) != bool(args.ukify):
        parser.error('--efi-stub and --ukify must be supplied together')
    build(args.base.resolve(), args.output.resolve(),
          args.efi_stub.resolve() if args.efi_stub else None,
          args.ukify.resolve() if args.ukify else None)
