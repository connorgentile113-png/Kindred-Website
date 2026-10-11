# Confidence improvements: validation

The website and recovered desktop source now help people take small steps,
understand what a choice will do, and recover from a mistake.

## Website

- Larger default body copy and targets, three reading sizes, stronger contrast,
  browser-persisted appearance choices, and a visible reset.
- A gentle practice page with sample replies, notes, Save, removal confirmation,
  Cancel, and Undo. Notes remain in memory and are cleared when leaving/reloading.
- Reassuring guidance distinguishes exploring and downloading from installation.
  Installation can erase a disk; the website does not claim every action is safe.
- Reading controls and practice also work with blocked local storage. The site
  retains useful no-JavaScript and failed-release-metadata fallbacks.

Passed `tests/website.py`: five pages at 320, 390, 768 and 1440 pixels, including
largest text without horizontal overflow; preference persistence/reset; note
Save/Cancel/removal/Undo and focus; sample replies; reload isolation; screenshot
switching; download metadata; storage denial; metadata failure; no JavaScript.

Passed `tests/accessibility.py`: 13 page/state audits using axe-core WCAG 2 A/AA,
WCAG 2.1 A/AA and best-practice rules. No violations were reported. This is an
automated audit, rather than certification or a substitute for older adults'
usability feedback and assistive-technology testing.

Practice and reading controls were also exercised with the production Firebase
Content-Security-Policy applied. The practice requests only local static content;
no messages or sample notes are transmitted.

## Desktop

The 0.5.2 source archive was verified against its published SHA-256 before use;
see `desktop/SOURCE.md`. The source now builds unreleased version 0.5.3.

- Home has a gentle introduction with a separate, temporary practice note.
- Real document removal asks first and defaults to keeping the document.
- Immediate Undo saves the restored document. Recently removed remains available.
- Reading settings can be reset; failed setting saves roll back in memory.
- The six Home activities fit the reviewed 980×900 desktop window. Large text
  remains supported, with wrapping labels and scrollable content.

Passed 27 unit checks: 9 model/practice, 7 updater, 5 installer-package,
4 installer-boot configuration, and 2 webapp-launcher checks.

Passed native storage, platform and live-weather suites. Passed the GTK4 smoke
suite using temporary storage and simulated power: introduction, practice
isolation, confirmation/Cancel, persistent Undo, reading reset, navigation,
assistant local actions, app pins, developer-mode toggle, autosave, document
import/export data, recovery, calendar, shutdown confirmation and network status.

The application archive was built, SHA-256 checked, and passed the actual updater's
staging/activation path against a temporary copy of 0.5.2. A previous-version
backup and local configuration extras were preserved. The built package's model,
updater and storage suites also passed. All Python, shell, JavaScript and JSON
source syntax checks passed.

Local artifact: `desktop/artifacts/kindred-update-0.5.3.tar.gz`, with adjacent
`.sha256`. Runtime packages and generated artifacts are ignored by Git.

## Release boundaries

The private `CE-CODE-official/Kindred-OS` Git repository returned HTTP 403. The
publicly distributed source is retained under `desktop/` in the accessible
website repository so both requested changes can be reviewed and reproduced.

No replacement ISO, live update channel, GitHub Release, or Firebase deployment
was published. The published 0.5.2 release/checksums remain unchanged. Physical
installation, media/DRM playback, external accounts, paid online assistant
responses, hardware peripherals and actual shutdown were not tested here.
