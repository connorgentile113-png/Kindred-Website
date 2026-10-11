# Kindred 0.5.2 — public download handoff

The public website and download releases live at
https://github.com/connorgentile113-png/Kindred-Website.
The OS build repository and its history remain separate and private.

## Scope

- New website with actual Home/assistant screenshots, responsive layout, a clear
  download page, installation guide, readable FAQ, and a stable top Back link.
- New public repository contains only static pages, three image/vector assets,
  release metadata, Hosting configuration, preview/deployment scripts and README.
  OS binaries are GitHub Release attachments, never Git blobs. No keys, VM images,
  OS checkout history, prototype app or Cloud Functions are in the new repository.
- Updater accepts the exact public release repository plus the existing legacy
  repository. URLs must name the versioned Kindred application archive exactly;
  other owners, lookalike repositories, traversal, query strings and mismatched
  filenames are rejected. SHA-256 and archive checks remain required.
- Existing 0.5.1 and earlier clients need one administrator application migration
  to accept the public origin. The website states this explicitly. Future 0.5.2+
  clients can download public archives without a GitHub login.
- Publication checks remote asset digests and an anonymous archive download before
  updating public metadata. Application-only releases retain the older installer
  version instead of inventing a newer ISO download.
- Output ISO is made read-only before hashing. Its boot payload is preserved from
  the tested 0.4.1 base. Release metadata is excluded from packaged source to avoid
  self-referential checksums.

## Verification

Firefox checks Home, Download and Guide at 1440, 768, 390 and 320 pixels: no
horizontal overflow; Back remains visible. Home/Assistant screenshot switching,
FAQ opening, checksum disclosure and versioned upgrade commands are checked.
Local website preview smoke loads the screenshot and download link correctly.
The existing model, installer, updater, launcher, storage and native smoke checks
are required before publication.

After uploads, the public ISO/application assets are checked against local size
and SHA-256, with anonymous downloads checked before Firebase is advanced. The
Debian VM starts on 0.5.1 for a manual migration test; then a service-driven public
archive installation checks downloader/staging/activation while retaining user
state and the private AI key. These final integration results are recorded in the
release notes after completion.

No new physical install, paid DRM playback or account login is claimed. HTTPS
metadata remains unsigned and two-directory activation is not fully power-loss
safe. General Debian package/kernel maintenance remains separate.
