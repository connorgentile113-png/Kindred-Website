#!/usr/bin/env python3
"""Audit website pages and practice states using an installed axe-core script."""
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

axe_path = os.environ.get('KINDRED_AXE_SCRIPT')
if not axe_path:
    raise SystemExit('Set KINDRED_AXE_SCRIPT to the installed axe-core/axe.min.js file.')
axe = Path(axe_path).read_text()
base = os.environ.get('KINDRED_TEST_URL', 'http://127.0.0.1:8080')
with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=os.environ.get('KINDRED_BROWSER_EXECUTABLE') or shutil.which('chromium'),
        headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    def audit(name):
        page.add_script_tag(content=axe)
        result = page.evaluate("""async () => await axe.run(document, {
            runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']}
        })""")
        failures = [(v['id'], [n['target'] for n in v['nodes']]) for v in result['violations']]
        assert not failures, (name, failures)
        print('PASS accessibility audit:', name)
    for route in ('/', '/practice', '/install', '/guide', '/404.html'):
        page.goto(base + route)
        audit(route)
        page.locator('.reading-controls summary').click()
        page.locator('[data-reading-size="largest"]').click()
        page.locator('button[data-reading-contrast]').click()
        audit(route + ' with reading options expanded and largest text')
        page.locator('[data-reading-reset]').click()
    page.goto(base + '/practice')
    page.locator('[data-practice-open="note"]').click()
    audit('practice editor')
    page.locator('[data-practice-remove]').click()
    audit('practice confirmation dialog')
    page.locator('#practice-confirm button[value="remove"]').click()
    page.locator('[data-practice-undo]').wait_for()
    audit('practice Undo')
    browser.close()
