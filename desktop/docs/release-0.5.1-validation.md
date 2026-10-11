# Kindred 0.5.1 validation

Date: 2026-10-09. Follow-up to the released 0.5.0 application and the proven
0.4.1 installer boot payload. No installer partition or bootloader logic changes.

## Changes

- YouTube, Netflix and Spotify launch in Firefox. The installer includes missing
  GStreamer codecs and FFmpeg; existing-system migration and update activation
  install missing dependencies using signed Debian repositories, `--no-remove`.
- Assistant has an uncluttered header, distinct message bubbles, a flexible
  transcript and a persistent input/Talk/Send bar. Voice, setup and conversation
  controls live in a separate scrollable window with Back to chat.
- Apps discovers visible installed desktop entries and offers Pin/Unpin to Home.
  Home shortcuts are saved locally. The assistant supports allowlisted pin tools
  plus offline pin/unpin commands. Unknown apps are rejected.
- Developer mode is off by default. The user switch exposes a normal-user Linux
  terminal on Home and in Advanced settings. AI has no terminal execution tool
  or capability to enable Developer mode. This is a UI preference, not a sandbox.
- Existing state files gain default pin/developer preferences. Documents, calendar,
  accessibility settings and private AI keys keep their locations.
- Publishing checks anonymous archive access before advancing Firebase. Private
  release assets cannot be installed automatically; repository visibility is
  unchanged pending the owner's public-delivery decision.

## Checks completed

- Seven Node model tests, seven adversarial updater tests, five installer package
  tests and four installer boot logic tests pass.
- Launcher regression tests check full-browser video routing and preservation of
  the embedded wrapper for other sites, including a lookalike YouTube host.
- Native GTK smoke tests pass on the host and Debian VM, including 1280×800
  fullscreen: manual pins, offline AI pins/unpins, persistence, unknown app
  rejection, developer-mode defaults/enabling/disabling, terminal gating,
  reopening chat options, input visibility with larger text, plus prior document,
  autosave, calendar, search, import/export, recovery and navigation checks.
- Storage checks verify old-state migration retains a document, defaults developer
  mode off, persists new preferences and rolls back failed preference saves.
- Media package setup succeeds in the guest and a second run changes no packages.
  GStreamer finds H.264, AAC, VP9 and Opus decoders. Generated MP4 and WebM clips
  decode to end of stream. LightDM remains available.
- A separate Firefox browser check played a public YouTube video: readyState 4,
  no media error, time advancing and paused=false. This is browser-service
  verification, not proof of YouTube playback in the guest itself.
- VM visual review of the assistant, including a single-row composer and separate
  options window. No online AI service, real microphone or subscription tested.
- Shell syntax and Git whitespace checks pass. Release-media check verifies the
  entire EFI system partition, installer kernel/initrds and BIOS menu remain
  identical to the proven base, plus source VERSION and payload checksum.

## Limits

No new physical machine installation, paid DRM playback or external account login
was tested. The source repository is private and anonymous GitHub downloads fail;
public automatic updates remain blocked until public delivery is configured.
No claim of zero regressions across all hardware or every website is made.
