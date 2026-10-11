# Kindred 0.5 UI research and implementation

Baseline: published Kindred v0.4.1, repository commit 8a99460. The unreleased
Deepseek changes were compared with this baseline and the native main and
assistant UI restored before focused improvements. The released six activity
cards, palette, document storage, import/export, calendar and weather remain.
Previously local installer fixes that produced the proven v0.4.1 image remain.

## Evidence and decisions

The review combines source inspection, native GTK smoke tests, an installed
Debian VM at 1280×800, and Firefox website checks at 1440, 768 and 390 pixels.
This is an expert review with functional testing, not a study with older users.

| Finding | Impact | Change | Verification |
| --- | --- | --- | --- |
| Seven large navigation controls exceed the original window width | More scanning and horizontal pressure, especially with bigger text | Four controls in standalone mode; five in the desktop session; Find on Home | Native smoke test, VM screenshot |
| Back is disabled on Home and has no effect on a fresh web-app window | User loses a predictable escape route | Always available; Home fallback; fresh web app closes to Kindred | GTK route checks, source review, wrapper launch |
| Separate Help menu adds another choice before assistance | More decisions before receiving help | Help opens Assistant directly | Native test asserts Help route |
| Long list of app names has little context | Difficult to choose; online requirements unclear | Searchable grouped cards, descriptions, official-website badges, Flathub link | Native app catalog test, VM screenshot |
| Chat settings and voice controls crowd out the conversation | Reply and Send need too much scrolling | Scrollable transcript, named speakers, persistent composer, separate scrollable voice/setup options window | Native test and 1280×800 chat screenshot |
| Submitted message appears only after a reply arrives | Unclear whether Send worked | Immediate transcript entry, thinking status, restore failed messages | Code review; offline quick action exercised |
| First wrapper Back does nothing; Home goes to Google | Navigation violates labels | Back closes when no history; Home returns to Kindred | Wrapper source and VM launch |
| 96px reserved space mismatches actual panel size | Navigation can overlap app content | Measure actual panel height and reserve it; smaller navigation padding | VM reports panel 96px, app starts at y=96 |
| Large Home cards and four stacked actions overflow 800px screen | Common actions are below the fold | Compact cards on shorter screens; one action row | All six activities visible in VM screenshot |
| Update runs without privilege and overwrites live files | Updates fail, or leave a partly written installation | Fixed authenticated systemd service; verify, stage, back up, rename, recover on activation error | Seven adversarial updater tests plus guest migration |
| Firebase home is an interactive prototype | Confuses downloading an OS with running one | Informational website with download, requirements, FAQ, and upgrade instructions | Firefox responsive navigation and error checks |

## Research sources

- [W3C: Developing websites for older people](https://www.w3.org/WAI/older-users/developing/)
  connects older users' needs to text size, contrast, keyboard access, adequate
  time, clear language, navigation, and error recovery. Applied as large targets,
  familiar labels, readable defaults, preserved contrast controls, and recoverable
  user data. Native GTK differs from a website; these are design principles,
  not a claim of WCAG certification.
- [W3C: Clear and understandable page structure](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o2p03-page-structure/)
  supports grouping, visual hierarchy and recognizable message treatment.
  Applied to app categories, transcript speakers and separate optional controls.
- [W3C: Consistent navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)
  informs a stable Back/Home/Help location across the shell and web wrappers.
- [Flathub](https://flathub.org/en) provides a Linux app catalog. Its YouTube
  clients are third-party applications, not proof of official YouTube or
  Instagram desktop packages. Kindred therefore offers official websites directly,
  with Flathub as an additional discovery source rather than pretending every
  listed app is official or installed.
- [systemd service documentation](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)
  and [polkit rules](https://www.freedesktop.org/software/polkit/docs/latest/polkit.8.html)
  inform a fixed service and narrowly scoped authorization.

## Boundaries and remaining validation

Native apps retain their own functionality and UI; Kindred surrounds them with
shared navigation and provides readable GTK defaults. It does not reimplement
Thunderbird, VLC or every third-party program. Fullscreen video may still cover
navigation; Super+H returns Home. External authentication or DRM may require
Firefox rather than the embedded browser; a visible fallback is provided.

Online assistant responses require an NVIDIA key and may be mistaken. Real
account sign-in, DRM subscriptions, microphone quality, and physical printer,
Bluetooth and Wi-Fi compatibility require user hardware/accounts and are not
claimed as tested here. Tests cannot guarantee zero regressions on all hardware.

Application updates preserve state.json format and user directories, install only missing required media packages and do not upgrade kernels, and never restart LightDM. The migration
script installs missing embedded-browser, media and Flatpak support and enables the timer.
Normal Debian security maintenance remains separate. Release payload hashes
use HTTPS hosting; signed metadata and power-loss-safe filesystem transactions
are future work. A previous installation backup is retained for recovery.

## 0.5.1 follow-up

The embedded player lacked the GStreamer codec packages under the installer's
`--no-install-recommends` policy. YouTube, Netflix and Spotify now open in
Firefox. Fresh installs and app update activation install missing media support
with apt `--no-remove`; activation failure preserves the previous app tree.
The VM decodes H.264/AAC and VP9/Opus test clips to end of stream. A separate
Firefox browser check played a public YouTube video. This is not a claim that
paid DRM content or every video has been tested in the guest.

- [Mozilla: H.264 playback and OpenH264](https://support.mozilla.org/en-US/kb/open-h264-plugin-firefox)
  distinguishes web-video codec support from the OpenH264 WebRTC plugin.
- [WebKitGTK media capabilities](https://www.webkitgtk.org/2026/09/16/webkitgtk-2.54-highlights.html)
  documents decoder-dependent media support. The installed guest uses Debian's
  own WebKit version; this source explains the dependency, not its exact build.

Home shortcuts are an additive saved preference. Apps discovers visible installed
Linux desktop entries and launches them with Gio. Pinning is limited to listed
apps and never takes a shell command. Developer mode is a user-operated switch,
off by default, that exposes a normal-user terminal; it is a UI preference,
not an OS security sandbox. The assistant has no terminal execution tool.
