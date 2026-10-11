# Debian VM validation

Validated October 7, 2026 on the configured x86-64 QEMU/KVM guest.

- Official Debian 13 genericcloud image verified against Debian's SHA-512 manifest.
- General-purpose Debian kernel installed for virtual graphics; cloud-init reports done.
- Graphical target boots LightDM and automatically starts the Kindred session.
- Native Home visible at 1280 × 800; all six bundled icons render.
- Openbox maximizes external applications below the persistent native navigation bar.
- Photos → Open photos opens the Pictures directory in Thunar.
- Clicking the persistent Home button and pressing Super+H both return from Thunar to Kindred (active-window readback verified).
- Native smoke tests passed inside Debian with its actual GTK4/libadwaita runtime, including navigation, document persistence, autosave, accessibility preferences, search, import/export data, recovery and local calendar notes.
- Linux adapter tests passed. Read-only live checks report Internet connected and shutdown available.
- Live Open-Meteo city lookup and three-day forecast passed inside Debian.
- NetworkManager, LightDM, PipeWire and WirePlumber active.
- Default browser/mail handlers are Firefox ESR and Thunderbird.
- Debian package audit reports no unfinished packages.
- Native host smoke tests, adapter tests and the existing three web model tests pass.
- Screenshot: `artifacts/debian-kindred.png`.

The configured guest has been rebooted successfully several times. Finally, the real native Turn off computer → Yes, turn off computer flow shut down the Debian guest through logind; QEMU exited with status 0. The VM is left powered off, ready for scripts/run-vm.sh.

Not tested with real email credentials, physical printers, Wi-Fi hardware passthrough, or a screen reader. Multi-monitor sessions and ARM guests are outside this VM configuration. Third-party applications retain their own controls and dialogs. Calendar notes have no cloud synchronization or alarms. The file picker flows use native GTK dialogs; automated import/export checks cover the stored text rather than every picker interaction.
