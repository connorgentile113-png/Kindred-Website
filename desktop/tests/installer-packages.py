"""Run with python3 tests/installer-packages.py; no host apt files are changed."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('prepare_apt', ROOT / 'scripts/prepare-apt.py')
apt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(apt)


class InstallerPackages(unittest.TestCase):
    def test_legacy_sources_and_idempotence(self):
        text = ('deb cdrom:[Kindred OS USB test 3]/ trixie main\n'
                'deb-src [trusted=no] cdrom:[Kindred OS]/ trixie main\n'
                '# deb cdrom:[already disabled]/ trixie main\n'
                'deb https://deb.debian.org/debian trixie main non-free-firmware\n')
        updated = apt.disable_media(text)
        self.assertNotRegex(updated, r'(?m)^deb(?:-src)? .*cdrom:')
        self.assertIn(text.splitlines()[-1], updated)
        self.assertEqual(apt.disable_media(updated), updated)

    def test_deb822_sources(self):
        network = 'Types: deb\nURIs: https://deb.debian.org/debian\nSuites: trixie\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\n'
        media = 'Types: deb\nURIs: cdrom:[Kindred]/\nSuites: trixie\nComponents: main\n'
        updated = apt.disable_media(media + '\n' + network, True)
        self.assertIn('Enabled: no\n' + media, updated)
        self.assertIn(network, updated)
        self.assertEqual(apt.disable_media(updated, True), updated)
        mixed = media.replace('cdrom:[Kindred]/', 'cdrom:[Kindred]/ https://deb.debian.org/debian')
        self.assertIn('URIs: https://deb.debian.org/debian', apt.disable_media(mixed, True))

    def test_file_backup(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            path = directory / 'sources.list'
            original = 'deb cdrom:[Kindred]/ trixie main\n'
            path.write_text(original)
            apt.prepare(directory)
            apt.prepare(directory)
            self.assertEqual(path.with_name('sources.list.kindred-backup').read_text(), original)
            self.assertTrue(path.read_text().startswith('# Disabled'))

    def test_preseed_remains_interactive_and_fails_closed(self):
        text = (ROOT / 'installer/preseed.cfg').read_text()
        self.assertIn('apt-setup/disable-cdrom-entries boolean true', text)
        self.assertNotRegex(text, r'(?m)^d-i partman[^\n]*(?:confirm|choose_recipe|/disk)')
        late = next(line for line in text.splitlines() if 'preseed/late_command' in line)
        self.assertIn(' && tar ', late)
        self.assertIn(' && in-target ', late)

    def test_cleanup_precedes_update_and_success_follows_configuration(self):
        text = (ROOT / 'scripts/guest-setup.sh').read_text()
        self.assertLess(text.index('prepare-apt.py'), text.index('apt-get'))
        self.assertLess(text.index('configure-kindred.sh'), text.index('touch /var/lib/kindred-installed'))
        self.assertIn('APT::Update::Error-Mode=any', text)


if __name__ == '__main__':
    unittest.main()
