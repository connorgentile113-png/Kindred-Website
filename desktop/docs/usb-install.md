# Kindred 0.5.2 downloads

The current installer is `kindred-os-0.5.2-amd64.iso`, available at
https://github.com/connorgentile113-png/Kindred-Website/releases/tag/v0.5.2.
Verify its adjacent SHA-256 file before writing the USB. It retains the working
0.4.1 boot path and interactive disk selection. Back up the disk you plan to
install onto. Secure Boot must be off; Internet is needed during installation.

Existing Kindred users should use the app-only migration in [README](../README.md)
instead of reinstalling. Updates preserve the document format and do not alter
the bootloader.

The earlier build notes below explain the original installer and Chromebook
validation. Their older artifact names are historical.

# Kindred OS 0.4 USB installer

Flash `kindred-os-0.4.0-amd64.iso` as a disk image. It contains the Kindred
source and an integrated installer: no second download or bootstrap command
is needed. Internet is required to install the desktop packages.

Choose **Install Kindred OS** in the startup menu. US English, the US keyboard,
Eastern time, software selection, the Kindred desktop, automatic desktop login,
the app store and firmware packages are preconfigured. Supply your network
credentials, choose an administrator password, and select the installation disk.
Disk erasure is never preconfirmed. The `owner` account handles administration;
the automatically logged-in `kindred` account runs the desktop.

Kindred is the only session offered at login. GNOME desktop is not installed;
individual GNOME games and the software store remain available as applications.
Boot and login branding use Kindred. Package names, repository metadata, licenses
and upstream attribution remain intact. This is an independent Debian derivative.

For the Intel Lenovo 100e Gen 2 **PHASER**, boot the USB with MrChromebox's
edk2 UEFI payload (RW_LEGACY/Alternative Firmware or UEFI Full ROM).
With RW_LEGACY, the ChromeOS "OS verification is OFF" screen remains: use
Ctrl+L, choose **TianoCore**, then select the USB in its Boot Menu. Do not rely
on a fixed numbered entry or saved boot order. RW_LEGACY has no persistent
UEFI NVRAM for boot entries. With Full ROM, use the UEFI boot menu directly.
Firmware support does not guarantee all peripherals work; audio,
Bluetooth hearing aids and Wi-Fi still need checking on the physical Chromebook.
The installer supplies Intel wireless, SOF audio firmware and ALSA profiles.
It installs the EFI fallback loader for firmware without persistent boot entries.

No NVIDIA API key is included in this publicly downloadable image. Enter your
key in the assistant after installation. Weather location and personal accounts
also require first-use setup.

Build from the SHA-512-verified Debian 13.7 amd64 netinst:

```sh
python3 scripts/build-kindred-iso.py base.iso artifacts/kindred-os-0.4.0-amd64.iso
```

Build dependencies: Python 3, xorriso, cpio, grub-mkfont, DejaVu Sans and
syslinux-common (BIOS power-off module). Its COM32 libraries must match Debian's
media; use `SYSLINUX_BIOS_MODULES` to select matching modules if necessary.
The builder refuses to overwrite an existing ISO and publishes a SHA-256 file.

The branded startup menu contains only install, repair and power off. UEFI
preserves the GOP framebuffer with `gfxpayload=keep`; only BIOS uses `vga=788`.
Repair uses the original Debian initrd without Kindred's installation preseed.
See `docs/installer-boot-validation.md` for boot-test evidence and limitations.

## UEFI compatibility image

`kindred-os-0.4.0-efi-compat-amd64.iso` provides an alternate UEFI handoff for
machines that return immediately to firmware after selecting Install. Its
three-entry menu launches bundled kernel/initrd EFI executables through the
Linux EFI stub, rather than GRUB's Linux loader. BIOS still uses the normal
installer. This image requires Secure Boot to be off; its bundled EFI images
are unsigned. It does not modify Chromebook firmware.

Build it with the same verified Debian base plus `systemd-ukify`, its Python
dependencies, and `systemd-boot-efi`:

```sh
python3 scripts/build-kindred-iso.py base.iso artifacts/kindred-os-0.4.0-efi-compat-amd64.iso \
  --efi-stub /usr/lib/systemd/boot/efi/linuxx64.efi.stub \
  --ukify /usr/lib/systemd/ukify
```

The firmware display mode is retained, boot messages are visible, and a kernel
panic stays on screen. A loader error that returns to GRUB waits for Enter so
it can be photographed. Disk selection and erasure confirmation remain
interactive. Passing a virtual-machine test does not establish that the
physical Chromebook's firmware issue is resolved.

## USB test 3: direct EFI menu

After both GRUB-based images returned to firmware on the user's RW_LEGACY
Chromebook (including the power-off entry), the next diagnostic image is
`kindred-os-0.4.0-usb-test3-amd64.iso`. It uses systemd-boot from a separate,
non-overlapping FAT32 EFI partition. Neither shim nor GRUB is on its UEFI
boot path. The kernel, installer initrd, and interactive disk-erasure policy
are unchanged. It uses the current firmware console mode and does not need
a stored firmware boot entry.

The UEFI menu must visibly say **Install Kindred OS - USB test 3**, with
Repair and **Power Off The System** below it. If the old green Kindred menu
appears instead, the new UEFI loader has not been selected. Select the ADATA
USB explicitly from TianoCore's Boot Menu. The menu waits for selection.

This is a diagnostic compatibility attempt, not a confirmed hardware fix.
Secure Boot must be disabled. `scripts/build-direct-efi-iso.py` builds it from
the checksum-verified compatibility ISO and a systemd-boot EFI binary.

Firmware references: [MrChromebox firmware types](https://docs.mrchromebox.tech/docs/firmware/types.html),
[MrChromebox boot menus](https://docs.mrchromebox.tech/docs/firmware/booting.html).

References: [Debian preseeding](https://www.debian.org/releases/trixie/amd64/apbs04.en.html),
[bootable ISO remastering](https://wiki.debian.org/RepackBootableISO),
[MrChromebox PHASER support](https://docs.mrchromebox.tech/docs/supported-devices.html).
