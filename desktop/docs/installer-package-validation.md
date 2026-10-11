# Installer package failure repair — 2026-10-08

## Reproduced cause

Booted the original USB test 3 ISO, SHA-256
`3187bf17ee949e78773f95f528dc3acf8900749f81d350cae7e4f4acc1093945`,
under OVMF/KVM with a new 14 GiB qcow2 disk. Selected the virtual disk and
confirmed erasure through the actual installer UI. No host block devices were
attached. The late command reproduced exit 100 before installing LightDM:

```
Ign:1 cdrom://Kindred OS 0.4.0 USB test 3 (direct EFI) trixie InRelease
Err:2 cdrom://Kindred OS 0.4.0 USB test 3 (direct EFI) trixie Release
Please use apt-cdrom to make this CD-ROM recognized by APT.
E: The repository 'cdrom://Kindred OS 0.4.0 USB test 3 (direct EFI) trixie Release' does not have a Release file.
```

The signed network repositories succeeded. A separate fresh Debian cloud guest
also resolved the complete desktop package list successfully. This is an
unavailable installation-media repository, not a missing LightDM package.
The CD entry remains enabled during d-i's late command, before later cleanup.

## Repair

- Preseed requests disabled CD-ROM entries; target setup defensively disables
  active media entries before apt update (legacy `.list` and deb822 `.sources`).
  Network URIs/signing fields are retained; changed sources have backups.
- Apt update fails on any repository error and retries downloads three times.
- Late command uses `&&`, so extraction failures cannot proceed to installation.
- `/var/log/kindred/install.log` persists output and failures. Completion marker
  is written only after desktop, boot configuration and firmware setup succeed.
- Builders explicitly identify temporary images as regular files with `stdio:`.
- No disk choice or destructive partition confirmation is preseeded.
- USB test 3 systemd-boot, separate FAT32 ESP and install/repair UKIs are retained.
  The ESP bootloader matches the original systemd-boot binary byte-for-byte;
  no shim/GRUB exists in the USB UEFI path. Installed Debian still uses GRUB,
  as before; the installer boot-path constraint does not replace its bootloader.

## Delivered image

`artifacts/kindred-os-0.4.0-installer-fixed-amd64.iso` (1,141,190,656 bytes)

SHA-256:
`aff2ae86e41e4a533bf69aa55ef9ba0e7648cfd6d45203533140ae99bfd4d964`

Built from the SHA-512-verified Debian 13.7 netinst, matching Debian Syslinux
modules and the same systemd stub/bootloader tooling as USB test 3. The image
retains 0.4.0 branding and the working USB test 3 menu intentionally.

## Full installation validation

Installed the corrected ISO to a second new disposable 14 GiB disk via its
systemd-boot USB menu, not a direct kernel boot. Password, disk selection and
write confirmation were handled through the interactive installer UI.
The unmodified image completed the late command and rebooted:

```
Oct 8 19:53:12 preseed: running preseed command preseed/late_command: mkdir -p /target/opt/kindred && tar -xzf /cdrom/kindred/source.tar.gz -C /target/opt/kindred && in-target bash /opt/kindred/scripts/install-kindred.sh
Oct 8 19:59:17 in-target: KINDRED_INSTALL_COMPLETE
```

Restarted QEMU with **no installation media**, fresh OVMF variables and the
installed virtual disk explicitly first in boot order. LightDM automatically
opened Kindred Home, without a login action. Subsequently checked at tty2:

- `systemctl is-active lightdm`: `active`
- `systemctl get-default`: `graphical.target`
- `loginctl`: active `kindred` seat0 user session
- `pgrep -a gjs`: `gjs -m native/main.js --session`
- `/var/log/kindred/install.log`: ends with `KINDRED_INSTALL_COMPLETE`
- `/var/lib/kindred-installed`: exists after firmware setup

The first media-free launch reused installer firmware boot preferences and
reached the UEFI shell; specifying the installed disk's bootindex with fresh
variables validated automatic removable-fallback boot without manual EFI
execution. No guest filesystem or bootloader repair was needed.

Evidence: `artifacts/install-validation/` contains original apt error/source
screenshots, interactive partitioning screenshots, `installer-syslog`,
`kindred-install.log`, `media-free-auto-desktop.png`, `installed-services.png`,
`late-command-success.png`, build logs, ESP contents and ISO layout. Guest disks
are `original-failed.qcow2` and `fixed.qcow2`. Both guests were shut down.
This validates OVMF, not physical Chromebook firmware or its Wi-Fi hardware.

Checks passed: five package/safety regressions, two boot regressions, all three
npm model tests, shell syntax and Python compilation checks, delivered ISO
SHA-256, FAT32/GPT layout and systemd-boot binary comparison. No separate
project typecheck command exists.

## 2026-10-08 second report: pressing Enter at the Kindred menu reboots

The user reported that booting reaches a `Kindred GNU/Linux` screen and that
pressing Enter immediately reboots the machine. That title is GRUB's, built from
`GRUB_DISTRIBUTOR="Kindred OS"`; the USB image instead shows
`Install Kindred OS - USB test 3`. The screen therefore came from an **installed
disk** booting shim, then GRUB. This is the same firmware defect already recorded
for the ISO menus: this Chromebook resets on GRUB's Linux handoff, and only the
systemd-boot plus bundled kernel/initrd EFI executable path (USB test 3) has ever
reached an OS on it.

The installer had reproduced that defect on the internal disk: Debian's
`grub-installer` left shim and GRUB in the firmware-scanned ESP paths, so the
installed system inherited the handoff that resets this hardware.

### Repair: the installed system now uses the validated handoff

`scripts/install-efi-boot.sh` runs from `configure-kindred.sh` inside the target
and makes the installed system boot the same way the USB image does:

- builds a UKI per kernel with `ukify` from the installed kernel and initrd and
  the kernel's own EFI entry point (`linuxx64.efi.stub`), up to two kernels so a
  recovery entry remains, and removes images whose kernel is gone;
- the embedded command line is generated on the target as
  `root=UUID=<root fs uuid> ro quiet loglevel=3`, so d-i's `auto=true` installer
  command line can never reach the installed system;
- installs `systemd-boot` to `EFI/systemd/systemd-bootx64.efi` and to the
  removable fallback `EFI/BOOT/BOOTX64.EFI`, with `loader/loader.conf`;
- moves shim, GRUB and MokManager binaries out of every firmware-scanned path
  (`EFI/BOOT` and `EFI/debian`) into `EFI/kindred-disabled`, so a stale shim boot
  entry cannot execute GRUB; the files are kept for manual rescue, and Debian's
  GRUB remains installed for BIOS boot and `repair-grub.sh`;
- prefers a `Kindred OS` firmware entry and drops the `debian` (shim) entry when
  the firmware keeps NVRAM entries;
- installs kernel and initramfs hooks so a later kernel or initrd update always
  regenerates the EFI executable.

### Verified

Full installation of this ISO to a disposable qcow2 disk through its
systemd-boot USB menu, with disk selection and erasure confirmed in the installer
UI and no host block device attached. The install log records
`Kindred UEFI boot path ready: systemd-boot plus 2 EFI kernel image(s).` and ends
with `KINDRED_INSTALL_COMPLETE`.

Booting the installed disk **alone**, with no installation media and fresh OVMF
variables, reached Kindred Home automatically. Checked inside the booted system:

- `/proc/cmdline` is `root=UUID=… ro quiet loglevel=3` (no `auto=true`)
- `EFI/BOOT` contains only `BOOTX64.EFI`, byte-identical to `systemd-boot`
- `EFI/Linux/` holds `kindred-6.12.107+deb13-amd64.efi` and
  `kindred-6.12.111+deb13-amd64.efi`
- `EFI/kindred-disabled/` holds the moved `shimx64.efi`, `grubx64.efi`,
  `mmx64.efi`, `fbx64.efi` and `BOOTX64.CSV`
- `systemctl is-active lightdm` is `active`

Because no GRUB or shim binary remains in any firmware path, this boot can only
have come through systemd-boot and the UKI.

### Deliverable and limitations

`artifacts/kindred-os-0.4.0-uki-boot-fixed-amd64.iso` (supersedes
`kindred-os-0.4.0-installer-fixed-amd64.iso`, which contained the apt repair but
the old GRUB-based internal-disk boot path).

SHA-256:
`ffe7c541112aa060f6aa59b49912bfdeb8c046b09daadcae350342dd9316f5fb`

The USB test 3 path is unchanged: its ESP fallback is byte-identical to
`systemd-boot`, with the install and repair UKIs, and no shim or GRUB.

OVMF cannot reproduce this firmware's GRUB reset, so the reason the UKI path is
required on the physical machine is inference from the recorded Chromebook
tests, not a reproduction. How this firmware falls through a now-dangling shim
boot entry is also unverified. The Chromebook still needs a hardware
re-test after reinstalling, and its existing internal installation should be
replaced by a fresh install from this image (an install that aborted at the apt
failure has no desktop to boot into).

## USB flash: first attempts blocked, then completed after authentication

Reconfirmed authorized device before attempting access:

- `/dev/disk/by-id/usb-ADATA_USB_Flash_Drive_26C0223460220066-0:0`
- resolved `/dev/sdb`, vendor ADATA, serial `26C0223460220066`
- removable USB, 7,759,462,400 bytes

UDisks `OpenForRestore` failed with an authentication timeout on both attempts.
The polkit journal explicitly records failure to authenticate for
`org.freedesktop.udisks2.open-device`; `sudo -n` also requires a password.
No device file descriptor was obtained and **no ISO bytes were written**.
No authentication bypass was attempted and the USB was safely ejected unchanged.
The cause of the repeated failures was that no polkit authentication agent was
running in the desktop session, so the authorization dialog could never be
answered. Starting the standard agent
(`/usr/lib/policykit-1-gnome/polkit-gnome-authentication-agent-1`) let the user
authenticate interactively; polkit then granted temporary `open-device`
authorization to the flashing script.

The corrected image was written and verified:

```
Writing kindred-os-0.4.0-uki-boot-fixed-amd64.iso to /dev/disk/by-id/usb-ADATA_USB_Flash_Drive_26C0223460220066-0:0 (7759462400 bytes)
Write finished. Reading the USB back for verification…
PASS: USB read-back SHA-256 matches the release ISO.
```

Identity was reconfirmed immediately before writing (ADATA, serial
`26C0223460220066`, removable USB, 7,759,462,400 bytes), the device was
unmounted first, and `udisksctl power-off --no-user-interaction` then removed it
cleanly. Logs: `usb-flash.log`, `usb-flash-retry.log`, `usb-flash-uki.log`,
`usb-eject.log`.
