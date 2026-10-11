import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('updater', Path(__file__).resolve().parents[1] / 'scripts/update-engine.py')
updater = importlib.util.module_from_spec(spec); spec.loader.exec_module(updater)

class UpdateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name); self.current = self.root / 'kindred'; self.current.mkdir()
        (self.current / 'VERSION').write_text('0.4.1\n'); (self.current / 'local-config').write_text('keep')
        self.home = self.root / 'home'; self.home.mkdir(); (self.home / 'state.json').write_text('saved documents')
    def archive(self, extra=None, ver='0.5.0'):
        path = self.root / 'update.tar.gz'
        with tarfile.open(path, 'w:gz') as out:
            for name in ['native/main.js', 'native/store.js', 'native/assistant.js', 'scripts/run-native.sh', 'scripts/update-engine.py', 'VERSION']:
                data = (ver if name == 'VERSION' else '# content\n').encode()
                info = tarfile.TarInfo(name); info.size = len(data); info.mode = 0o755 if name.endswith('.sh') else 0o644
                out.addfile(info, io.BytesIO(data))
            if extra: out.addfile(extra, io.BytesIO(b'') if extra.isfile() else None)
        return path, hashlib.sha256(path.read_bytes()).hexdigest()
    def install(self, archive, checksum, activate=None):
        return updater.install(archive, self.current, self.root / 'backups', '0.5.0', checksum, activate)
    def unchanged(self):
        self.assertEqual((self.current / 'VERSION').read_text(), '0.4.1\n')
        self.assertEqual((self.home / 'state.json').read_text(), 'saved documents')
    def test_success_preserves_local_config_user_data_and_backup(self):
        archive, checksum = self.archive(); backup = self.install(archive, checksum)
        self.assertEqual((self.current / 'VERSION').read_text(), '0.5.0')
        self.assertEqual((self.current / 'local-config').read_text(), 'keep')
        self.assertEqual((self.home / 'state.json').read_text(), 'saved documents')
        with tarfile.open(backup) as saved: self.assertEqual(saved.extractfile('kindred/VERSION').read(), b'0.4.1\n')
    def test_bad_checksum_does_not_change_install(self):
        archive, _ = self.archive()
        with self.assertRaises(ValueError): self.install(archive, '0' * 64)
        self.unchanged()
    def test_version_mismatch_does_not_change_install(self):
        archive, checksum = self.archive(ver='9.9.9')
        with self.assertRaises(ValueError): self.install(archive, checksum)
        self.unchanged()
    def test_traversal_absolute_and_unexpected_paths_rejected(self):
        for name in ['../escaped', '/tmp/escaped', 'native/../../escaped', 'firebase/key.json']:
            archive, checksum = self.archive(tarfile.TarInfo(name))
            with self.assertRaises(ValueError): self.install(archive, checksum)
            self.unchanged()
    def test_links_rejected(self):
        for kind in [tarfile.SYMTYPE, tarfile.LNKTYPE]:
            info = tarfile.TarInfo('native/link'); info.type = kind; info.linkname = '/etc/passwd'
            archive, checksum = self.archive(info)
            with self.assertRaises(ValueError): self.install(archive, checksum)
            self.unchanged()
    def test_activation_failure_rolls_back(self):
        archive, checksum = self.archive()
        def fail(): raise RuntimeError('service migration failed')
        with self.assertRaises(RuntimeError): self.install(archive, checksum, fail)
        self.unchanged()
    def test_fixed_release_origin(self):
        with self.assertRaises(ValueError): updater.verified_url('https://example.org/update.tar.gz')
        for repo in ['connorgentile113-png/Kindred-Website', 'CE-CODE-official/Kindred-OS']:
            url=f'https://github.com/{repo}/releases/download/v0.5.2/kindred-update-0.5.2.tar.gz'
            self.assertEqual(updater.verified_url(url), url)
        for url in ['https://github.com/evil/Kindred-Website/releases/download/v0.5.2/update.tar.gz',
                    'https://github.com/connorgentile113-png/Kindred-Website.evil/releases/download/v0.5.2/update.tar.gz',
                    'https://github.com/connorgentile113-png/Kindred-Website/releases/download/v0.5.2/update.tar.gz?extra=1',
                    'https://github.com/connorgentile113-png/Kindred-Website/releases/download/v0.5.2/../../../other.tar.gz',
                    'https://github.com/connorgentile113-png/Kindred-Website/releases/download/v0.5.2/kindred-update-0.5.1.tar.gz']:
            with self.assertRaises(ValueError): updater.verified_url(url)
        self.assertEqual(updater.version('0.10.0'), (0,10,0))
        for value in ['latest', '../1', 'v0.5.0', '0.5.0-rc1']:
            with self.assertRaises(ValueError): updater.version(value)
