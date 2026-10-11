#!/usr/bin/env python3
"""Preview the static website with Firebase-style clean URLs. No build step."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parents[1] / 'public'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/updates/version': self.path = '/updates/version.json'
        elif path in ['/install', '/guide', '/practice']: self.path = path + '.html'
        super().do_GET()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
parser = argparse.ArgumentParser(); parser.add_argument('--port', type=int, default=8080)
args = parser.parse_args()
print(f'Kindred website: http://127.0.0.1:{args.port}', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
