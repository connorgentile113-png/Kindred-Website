# Kindred OS

A calm, readable Debian desktop for everyday life, built with GJS, GTK4 and
libadwaita. This source builds unreleased Kindred 0.5.3, based on the verified 0.5.2 public
application archive. It preserves the six-activity Home and document format, and
adds a gentle introduction, an isolated practice note, confirmation before
removal, immediate Undo, and a reset for text size and contrast.

See [source provenance and release status](SOURCE.md). The available source
handoff is part of the website checkout; the live website is in `../public/`.
No 0.5.3 update channel or replacement ISO has been published.

- Website and downloads: https://kindredos.web.app/
- Public website/download repository: https://github.com/connorgentile113-png/Kindred-Website
- Releases: https://github.com/CE-CODE-official/Kindred-OS/releases
- The OS build repository remains private. Website files and release downloads
  have a separate public repository. Kindred 0.5.1 and earlier need one manual
  application upgrade to 0.5.2 before accepting the new public update source.
- [USB installation guide](docs/usb-install.md)
- [UI research and review](docs/ui-research.md)
- [Release validation](docs/release-0.5.2-validation.md)

## Everyday use

Home has Internet, Email, Photos, Documents, Calendar and Weather. Back and Home
stay at the top. Help opens the assistant chat. In the Kindred desktop session,
a shared navigation bar surrounds native apps, and Super+H returns Home even
when video is fullscreen. External programs keep their own interfaces; readable
GTK defaults improve their controls without rewriting their functionality.

Apps offers searchable cards for official YouTube, Instagram, Facebook, WhatsApp,
Gmail, Maps, Spotify, Netflix and other websites. YouTube, Netflix and Spotify
open in Firefox for broader video support. Other sites open in an embedded
browser with Back, Home, Reload and Close. Back on the first page closes the window; Home
returns to Kindred. A visible Firefox fallback handles sites that need browser
features or DRM. Accounts, Internet and any subscriptions are your own.

GNOME Software offers Debian packages and, on new installations or after the
one-time migration, Flatpak support with the official Flathub remote. Check the
publisher and permissions of third-party clients. The Apps page also links to
Flathub for discovery. A failed network connection during remote setup does not
block desktop installation; an administrator can retry
`sudo bash /opt/kindred/scripts/configure-app-experience.sh` when online.

Start here on Home explains the basic controls and opens Practice. Practice
uses an in-memory example, never your documents, and is forgotten when Kindred
closes. There is no timer, score, or online requirement.

Documents autosave, support UTF-8 text import/export up to 2 MB, and retain removed
documents for recovery. Removal now asks for confirmation, with Keep it as the
default. Undo removal restores the most recently removed document immediately.
Recently removed remains available after restarting Kindred. Calendar notes are local and do not send notifications.
Weather uses Open-Meteo with the selected city and Fahrenheit temperatures.

Choose Pin to Home on any Apps card to add a saved Home shortcut. Apps also
includes installed desktop applications; newly installed apps appear when you
reopen Apps. Unpin removes only the shortcut. The assistant understands “pin
YouTube to Home” and “unpin YouTube from Home” locally, and supports online tools
for pinning any listed app. Settings → Developer mode adds a Linux terminal to
Home and Advanced settings. It is off by default and runs as the normal user.
The assistant cannot enable Developer mode or execute terminal commands.

The assistant can change text size, contrast and sound, or open listed apps.
Settings requests work locally; online answers require an NVIDIA API key stored
privately in `~/.config/kindred/nim-key` or `NVIDIA_API_KEY`. Messages and recent
conversation go to NVIDIA. Replies may be mistaken. Voice input uses local
PocketSphinx; review the words before sending. Speech playback is optional.
The assistant has fixed allowlisted actions, not arbitrary shell access.

## Updates

Settings → Check for updates reports the release. Install updates now starts a
fixed system service. Automatic Kindred updates can be switched on or off; daily
checks do not restart the session or close work. New installations enable the
Kindred timer by default. Changing its setting requires administrator authentication.
The active local `kindred` user can start only this fixed update service through
polkit; there is no general sudo access.

The updater reads `https://kindredos.web.app/updates/version`, downloads the exact
versioned GitHub asset, verifies SHA-256 and archive paths, checks its VERSION,
stages a complete application tree beside `/opt/kindred`, backs up the previous
installation, and recovers it if activation fails. It never touches documents,
calendar data, the NVIDIA key, partitions or bootloader. Sign in again when ready.
Application updates install missing required media packages through signed Debian
repositories with `--no-remove`. General Debian package and kernel maintenance
is separate from these application updates.
HTTPS protects metadata transport; signed metadata and full power-loss-safe
filesystem transactions are not implemented.

### One-time migration from 0.5.1 and earlier

Download `kindred-update-0.5.2.tar.gz` and its `.sha256` from the public website/download repository release. In the
download directory verify before extracting:

```sh
sha256sum -c kindred-update-0.5.2.tar.gz.sha256
mkdir kindred-upgrade
tar xzf kindred-update-0.5.2.tar.gz -C kindred-upgrade
cd kindred-upgrade
sudo bash scripts/upgrade-existing.sh
```

This app-only migration keeps a backup and enables the timer. It installs missing
embedded-browser/Flatpak support and media codecs through signed Debian repositories, without
removing packages. It does not run the full installer or change the bootloader.
Keep a backup before upgrading. Sign in again to load the new shell.

## Development and tests

```sh
npm test
npm run test:updates
./scripts/run-native.sh --smoke-test
./scripts/run-native.sh --platform-test
./scripts/run-native.sh --storage-test
./scripts/run-native.sh --weather-test
python3 tests/installer-packages.py
python3 tests/webapp-launcher.py
python3 tests/media.py            # installed Debian guest with media packages
```

Smoke tests use isolated temporary storage and simulated power actions. Normal
native runs use real system services, including confirmed shutdown. Use
`./scripts/run-native.sh --preview` for simulated power/network controls.

```sh
./scripts/bootstrap-debian.sh
npm run native
npm start                       # informational website at localhost:8080
./scripts/run-vm.sh --headless   # installed development VM, VNC localhost:5905
./scripts/ssh-vm.sh
./scripts/sync-vm.sh
```

The VM uses Debian 13, QEMU, OVMF, a sparse guest overlay and shared networking.
Keep `.vm/kindred.qcow2` and its Debian base image together. Do not run two VMs
using the same disk. The VM SSH key is local in `.vm/`, port 2227 binds only to
loopback. Guest `kindred` is the desktop user; `debian` is the maintenance account.
See [VM validation](docs/vm-validation.md) for preparation and platform details.

Native data stays at `$XDG_DATA_HOME/kindred-native/state.json`, normally
`~/.local/share/kindred-native/state.json`. The document format is unchanged; pins and developer mode are additive preferences.
The old web prototype's model is retained for compatibility tests; the Firebase
root now serves the informational website, not an OS preview.

## Release and website deployment

`python3 scripts/build-update.py` packages only public application files and
writes the versioned archive, checksum and Firebase update manifest. Credentials,
VM disks, Git metadata, generated artifacts and both release metadata files are excluded
from the application payload. Publish the matching asset before deploying its
manifest.

`python3 scripts/build-update-iso.py <verified-v0.4.1.iso> <new.iso>` replaces only
the application payload on the proven v0.4.1 installer. It preserves systemd-boot,
its appended EFI system partition, UKIs, BIOS loader and interactive disk prompts.
It does not claim a new physical hardware installation test.

`bash scripts/deploy-firebase.sh` delegates to the standalone public website checkout
at `../Kindred-Website` (override with `KINDRED_WEBSITE_CHECKOUT`).
Service account credentials are read from an ignored local `firebase/` file or
`KINDRED_FIREBASE_CREDENTIALS`; never publish them. Firebase Hosting is the official
website. The public repository uses only static Hosting, with no Cloud Functions.

After bumping VERSION and package.json, commit and push both checkouts to main, then run
`npm run release:update` to test, publish a new application update on GitHub,
verify the anonymous archive, commit its public metadata, and deploy it to Firebase.
The command requires both checkouts to be clean,
refuses to replace an existing release, and publishes the asset before advancing
the update channel. For an interrupted website deploy, retry `npm run deploy`.
Installer media remains a separately tested artifact. Application-only releases
advance the public update channel without falsely relabelling the older installer.
