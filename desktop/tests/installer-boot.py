"""Static regressions for the installer boot handoff; also run QEMU on the ISO."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class InstallerBoot(unittest.TestCase):
    def test_efi_framebuffer_and_bios_video(self):
        grub = (ROOT / 'installer/grub.cfg').read_text()
        self.assertIn('set gfxpayload=keep', grub)
        self.assertIn('if [ "$grub_platform" = "pc" ]; then\n    set installer_video=vga=788\nfi', grub)
        self.assertNotRegex(grub, r'(?m)^\s*(reboot|chainloader|exit)\b')
        self.assertEqual(grub.count('$installer_video ---'), 2)

    def test_only_three_entries_and_correct_initrds(self):
        grub = (ROOT / 'installer/grub.cfg').read_text()
        bios = (ROOT / 'installer/menu.cfg').read_text()
        titles = ['Install Kindred OS', 'Kindred OS - repair an existing installation', 'Turn off computer']
        self.assertEqual(re.findall(r"menuentry '([^']+)'", grub), titles)
        self.assertEqual(re.findall(r'(?m)^  menu label (.+)$', bios), titles)
        for text in [grub, bios]:
            self.assertIn('/install.amd/vmlinuz', text)
            self.assertIn('/install.amd/initrd.gz', text)
            self.assertIn('/install.amd/rescue.gz', text)
        self.assertIn('com32 /isolinux/poweroff.c32', bios)
        self.assertNotIn('auto=true', bios.split('label rescue')[1])
        self.assertEqual((ROOT / 'installer/isolinux.cfg').read_text(), 'path\ninclude menu.cfg\ndefault vesamenu.c32\nprompt 0\ntimeout 0\n')

    def test_installed_system_boots_through_systemd_boot_uki(self):
        """The Chromebook's firmware resets when GRUB hands off the kernel."""
        setup = (ROOT / 'scripts/install-efi-boot.sh').read_text()
        self.assertIn('/usr/lib/systemd/boot/efi/linuxx64.efi.stub', setup)
        self.assertIn('systemd-bootx64.efi', setup)
        self.assertIn('--linux="/boot/vmlinuz-$version"', setup)
        self.assertIn('--initrd="$initrd"', setup)
        self.assertIn('--output="$esp/EFI/Linux/kindred-$version.efi"', setup)
        # The installed kernel must receive its own root UUID, never d-i's
        # installer cmdline (which carries auto=true).
        self.assertIn('cmdline="root=UUID=$root_uuid ro quiet loglevel=3"', setup)
        self.assertIn('findmnt -no UUID /', setup)
        self.assertNotIn('auto=true', setup)
        # No shim or GRUB may survive in any firmware-scanned UEFI path, even
        # when firmware still holds a stale shim boot entry.
        self.assertIn('disabled="$esp/EFI/kindred-disabled"', setup)
        for directory in ['BOOT', 'debian']:
            for name in ['shimx64.efi', 'grubx64.efi', 'mmx64.efi', 'fbx64.efi']:
                self.assertIn('"$esp/EFI/%s/%s"' % (directory, name), setup)
        self.assertIn("mv -f \"$file\" \"$disabled/$(basename \"$file\")\"", setup)
        # Kernel and initramfs changes must regenerate the EFI executable.
        self.assertIn('/etc/kernel/postinst.d/zzz-kindred-uki', setup)
        self.assertIn('/etc/initramfs/post-update.d/zzz-kindred-uki', setup)
        # A missing kernel must fail loudly rather than leave no boot path.
        self.assertIn('No installed amd64 kernel found.', setup)

    def test_installer_wires_and_packages_the_uefi_path(self):
        configure = (ROOT / 'scripts/configure-kindred.sh').read_text()
        self.assertIn('bash /opt/kindred/scripts/install-efi-boot.sh', configure)
        # The previous shim/GRUB removable fallback reproduced the reset.
        self.assertNotIn('shimx64.efi', configure)
        self.assertNotIn('EFI/BOOT/grubx64.efi', configure)
        guest_setup = (ROOT / 'scripts/guest-setup.sh').read_text()
        for package in ['systemd-boot-efi', 'systemd-ukify', 'efibootmgr']:
            self.assertIn(package, guest_setup)
        # The helper must reach the installed system with the rest of the source.
        install = (ROOT / 'scripts/install-kindred.sh').read_text()
        self.assertIn('native scripts tests docs installer README.md package.json', install)


if __name__ == '__main__':
    unittest.main()
