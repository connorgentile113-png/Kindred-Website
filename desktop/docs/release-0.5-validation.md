# Kindred 0.5 release validation

Date: 2026-10-09. Baseline: v0.4.1 published UI and proven installer media.

## Passed before packaging

- Seven Node model tests: search, storage recovery, app catalog, version ordering,
  and update decisions.
- Seven updater tests: successful staging/backup/config retention, checksum failure,
  version mismatch, path traversal and unexpected files, link rejection, failed
  activation recovery, and fixed release origin/stable version validation.
- Five installer package tests: CD-ROM source removal, idempotence, backups,
  interactive/fail-closed preseed, and setup ordering.
- Native GTK4 smoke test on host and installed Debian guest: navigation, app list,
  Help→Assistant, local assistant larger-text action, document persistence,
  autosave, search, import/export data, removal/restore, corrupt state recovery,
  calendar, power confirmation/cancel and network status.
- Native platform tests: permission denial, interactive authentication, missing
  services and simulated-power safety. Storage tests and live Boston weather
  lookup/three-day forecast pass.
- Firefox website checks at 1440, 768 and 390px: no horizontal overflow, download
  navigation, visible Back, expandable migration instructions and no page errors.
- Inspected actual 1280×800 guest screenshots of Home and chat. All six activities
  are visible; chat input and Send fit. Navigation is 96px tall and the application
  starts at y=96, avoiding overlap.
- WebKit and GNOME Software Flatpak dependencies install in Debian 13 without
  removals. Host system packages are unchanged.

## Release safeguards

Native store.js and the state.json format are unchanged from the released source.
User data and API keys are outside /opt/kindred. Application updates use a fixed
system service, pinned release URLs, checksums, bounded archive extraction,
version checks, staging and a backup. They do not restart the running session.
Malformed releases fail closed. Desktop timer controls require authentication;
only starting the exact Kindred update service is allowed for the active local user.

The ISO is based on the verified v0.4.1 SHA-256 and changes only its bundled
application payload. Bootloader, EFI partition, UKIs and disk prompts are retained.
Installer boot/payload and guest migration results are appended after packaging.

This is regression testing, not a guarantee of zero bugs or a new physical
Chromebook installation. Real account sign-in, DRM, microphone quality, printers,
Bluetooth and physical Wi-Fi require user hardware/accounts. See ui-research.md
for the app-wrapper and update-transaction boundaries.

## Guest migration and wrapper

The packaged app migration ran successfully in the installed Debian VM, created
a previous-installation archive and enabled the timer. Starting the fixed service
completed with “Kindred is up to date (0.5.0).” The embedded WebKit smoke test
loaded a local blank page and exercised first-page Back to close the wrapper.
Virtual GPU EGL warnings were present but did not prevent that test.


## Installer boot acceptance

UEFI USB: Install, Repair, Power Off pass. Installer command line is
`auto=true priority=high panic=0 ---`; rescue is
`rescue/enable=true priority=low panic=0 ---`.

BIOS USB: Install, Repair, Power Off pass. Installer receives `auto=true`,
`priority=high`, the install initrd and `vga=788`; rescue receives the rescue
initrd and `rescue/enable=true`, without automatic installation.

The initial BIOS test failed because its assertion selected systemd-boot labels
for a BIOS menu. That test condition was corrected to apply only to UEFI, then
all BIOS stages passed. The media itself was unchanged by that correction.

The final package is regenerated after documentation/script finalization and
checked again for unchanged firmware payload, correct media checksum and version.
No new disk partitioning or physical Chromebook installation was performed.
