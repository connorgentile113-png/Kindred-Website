#!/usr/bin/env python3
"""Install or remove the current user's Kindred launcher; no root required."""
import argparse
import os
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--autostart', action='store_true', help='Also start fullscreen at login')
parser.add_argument('--remove', action='store_true', help='Remove Kindred launcher and autostart entry; keep documents')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
apps = Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'applications'
autostart = Path(os.environ.get('XDG_CONFIG_HOME', str(Path.home() / '.config'))) / 'autostart'
entries = [apps / 'org.kindred.Desktop.desktop', autostart / 'org.kindred.Desktop.desktop']
if args.remove:
    for entry in entries:
        entry.unlink(missing_ok=True)
    print('Removed Kindred launcher and autostart. Documents were kept.')
else:
    # Desktop Entry Exec quoting is separate from shell quoting. Escape percent field codes.
    executable = str(root / 'scripts/run-native.sh')
    if any(c in executable for c in '\n\r'):
        raise SystemExit('Project path cannot contain line breaks')
    executable = executable.replace('\\', '\\\\\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$').replace('%', '%%')
    text = ('[Desktop Entry]\nType=Application\nName=Kindred\n'
            'Comment=A calm place for your everyday activities\n'
            f'Exec="{executable}" --fullscreen\n'
            'Icon=user-home\nTerminal=false\nCategories=Utility;\nStartupNotify=true\n')
    entries[0].parent.mkdir(parents=True, exist_ok=True)
    entries[0].write_text(text)
    if args.autostart:
        entries[1].parent.mkdir(parents=True, exist_ok=True)
        entries[1].write_text(text)
    print('Kindred is available in your application menu. Press Escape to leave fullscreen.')
    if args.autostart:
        print('Kindred will also open at your next login.')
