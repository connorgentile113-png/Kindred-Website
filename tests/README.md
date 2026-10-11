# Website checks

From the repository root, start the existing server in one terminal:

```sh
python3 scripts/serve.py --port 8080
```

In another terminal, run:

```sh
python3 tests/website.py
```

The browser checks require Python Playwright and Chromium. The cloud development
machine already provides both. Elsewhere, install Playwright in a virtual
environment and run `python -m playwright install chromium`. Set
`KINDRED_BROWSER_EXECUTABLE` for a custom browser executable and `KINDRED_TEST_URL`
for a different local server address. Neither is a credential.

These checks exercise every website page at 320, 390, 768, and 1440 pixels with
the largest text setting, persisted reading preferences, blocked browser storage,
failed release metadata, no JavaScript, screenshot choices, and the practice
note's Save, Cancel, removal, and Undo. They verify focus placement and that
practice notes are cleared on reload. Screenshots go into ignored
`artifacts/website-tests/`.

Optional automated accessibility checks use axe-core's WCAG 2 A/AA, WCAG 2.1
A/AA, and best-practice rules. Supply the installed axe.min.js location:

```sh
KINDRED_AXE_SCRIPT=/path/to/axe-core/axe.min.js python3 tests/accessibility.py
```

These checks cannot certify accessibility for every person or assistive device.
Manual keyboard navigation, reading, and visual review complement them.

Desktop checks are separate; see `desktop/README.md` and `desktop/SOURCE.md`.
Do not execute publishing, disk-writing, or installer scripts as tests.
