# Desktop expansion validation — 2026-10-07

Applied to the existing Debian guest in `.vm/kindred.qcow2`.

- GRUB configuration regenerated and passed `grub-script-check`.
- Guest rebooted into `6.12.111+deb13-amd64`; LightDM active and the updated
  `gjs -m native/main.js --session` running.
- Node tests passed.
- Native GTK smoke test passed, including rendering Apps, Assistant, hearing
  settings, social media and all curated application wrappers, plus existing
  persistence, navigation, accessibility and shutdown checks.
- Native platform tests passed.
- Requested Debian game/media/store/Bluetooth/speech packages installed.
- GNOME Software service starts successfully. App-install authorization returns
  success for the active Kindred session.
- Solitaire opens its Klondike window and Chess opens its board without errors.
- PipeWire reports a default stereo output and microphone input.
- Offline English speech models installed; ten-second capture completed without
  errors (silence returned no transcription). Real spoken recognition and actual
  hearing-aid hardware have not been verified.
- NVIDIA key installed in a mode-0600 guest configuration file, outside source.
- Live NVIDIA chat checks timed out on both host and guest. Model response and
  credentials cannot be claimed verified. Retry explicitly with
  `sudo -u kindred python3 /opt/kindred/tests/nim-live.py` inside the guest.

The assistant now targets `nvidia/nemotron-3.5-lightning-30b-a3b`, disables
reasoning for concise replies, and sends validated tool definitions for the
allowlisted device actions. Common text, contrast, volume, mute, and settings
requests are applied locally before a network request so those actions remain
usable during a temporary NVIDIA outage. App buttons launch the curated app
directly; the desktop no longer enumerates every installed application. The
assistant can start PackageKit installs for the curated app names through fixed
package mappings.

Physical audio audibility, hearing-aid pairing, website account sign-in, and
media subscription playback require the user’s devices/accounts. No host GRUB
configuration was changed.
