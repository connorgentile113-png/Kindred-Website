"""Video routing and lookalike-host regression checks without opening a browser."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='kindred-launch-test-')
        self.bin = Path(self.temporary.name)
        for name in ['firefox-esr', 'gjs']:
            stub = self.bin / name
            stub.write_text('#!/usr/bin/python3\nimport json,sys\nfrom pathlib import Path\n'
                            'if "-c" not in sys.argv: print(json.dumps([Path(sys.argv[0]).name]+sys.argv[1:]))\n')
            stub.chmod(0o755)
        self.env = {**os.environ, 'PATH': f'{self.bin}:/usr/bin:/bin'}

    def tearDown(self):
        self.temporary.cleanup()

    def launch(self, url):
        result = subprocess.run(['bash', str(ROOT / 'scripts/kindred-webapp.sh'), url, 'Test app'],
                                env=self.env, check=True, capture_output=True, text=True)
        return json.loads(result.stdout)

    def test_video_services_use_full_browser(self):
        for url in ['https://www.youtube.com', 'https://www.youtube.com/watch?v=example',
                    'https://youtu.be/example', 'https://www.netflix.com', 'https://open.spotify.com/track/example']:
            with self.subTest(url=url):
                self.assertEqual(self.launch(url), ['firefox-esr', '--new-window', url])

    def test_other_sites_and_lookalike_hosts_keep_wrapper(self):
        for url in ['https://www.instagram.com', 'https://www.youtube.com.evil.example/watch',
                    'https://www.wikipedia.org']:
            with self.subTest(url=url):
                self.assertEqual(self.launch(url), ['gjs', 'native/webapp.js', url, 'Test app'])

if __name__ == '__main__':
    unittest.main()
