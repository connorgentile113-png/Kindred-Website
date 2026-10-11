#!/usr/bin/env python3
"""Disable installer-media apt entries, including legacy and deb822 formats."""
from pathlib import Path
import re


def disable_media(text, deb822=False):
    if not deb822:
        return re.sub(r'(?m)^(\s*deb(?:-src)?\s+(?:\[[^\]\n]*\]\s+)?cdrom:.*)$',
                      r'# Disabled by Kindred (installation media): \1', text)
    # Preserve unrelated fields and network URIs, including mixed stanzas.
    def stanza(match):
        block = match.group()
        uri = re.search(r'(?mi)^URIs:[^\n]*(?:\n[ \t]+[^\n]*)*', block)
        if not uri:
            return block
        values = uri.group().split(':', 1)[1].split()
        kept = [value for value in values if not value.lower().startswith('cdrom:')]
        if kept == values:
            return block
        if kept:
            return block[:uri.start()] + 'URIs: ' + ' '.join(kept) + block[uri.end():]
        if re.search(r'(?mi)^Enabled:', block):
            return re.sub(r'(?mi)^Enabled:.*$', 'Enabled: no', block)
        return 'Enabled: no\n' + block
    return re.sub(r'[^\n]+(?:\n(?!\n)[^\n]+)*', stanza, text)


def prepare(directory):
    paths = [directory / 'sources.list']
    sources = directory / 'sources.list.d'
    paths += sorted(sources.glob('*.list')) + sorted(sources.glob('*.sources'))
    for path in paths:
        if not path.exists():
            continue
        original = path.read_text()
        updated = disable_media(original, path.suffix == '.sources')
        if updated != original:
            backup = path.with_name(path.name + '.kindred-backup')
            if not backup.exists():
                backup.write_text(original)
            path.write_text(updated)
            print(f'Disabled installer-media apt source in {path}')


if __name__ == '__main__':
    prepare(Path('/etc/apt'))
