# Installer boot handoff investigation

The original 0.4.0 ISO was inspected and booted before source changes. Its
Debian 6.12.107 kernel and installer initrd paths exist, and both El Torito
entries and the hybrid EFI partition point to the original Debian boot images.
The menu does not reboot, exit, or chainload firmware. Preseed does not select
a disk or confirm partitioning; rescue uses an untouched Debian initrd.

## Reproduced defect

SeaBIOS reaches the installer. OVMF UEFI displays the Kindred menu but loses
visible output after Install. The custom GRUB configuration dropped Debian's
`set gfxpayload=keep`. On the same original ISO, setting that variable at the
GRUB console and executing the original kernel/initrd commands reaches the
installer password prompt. This isolates a firmware framebuffer handoff defect.
The legacy `vga=788` parameter is also restricted to BIOS in the fix.

This is not a reproduction of the physical PHASER returning to MrChromebox's
boot picker: that exact hardware behavior cannot be established with OVMF.
The fix addresses the verified UEFI defect; PHASER still needs a hardware test.

## Safety and attribution

QEMU is given only ISO files, private OVMF variable files, and no writable guest
disk. No host block device is attached. No partitioning or installation to a
physical disk is performed. No USB is flashed during these tests.
The Debian kernel, signed EFI binaries, package metadata and licenses remain
unchanged. Kindred's source bundle excludes `.vm`, `.runtime` and artifacts.

## Verification

Run `python3 tests/installer-boot.py`, `grub-script-check installer/grub.cfg`,
`python3 -m py_compile scripts/build-kindred-iso.py tests/installer-boot.py`,
and `npm test`. Rebuild with the SHA-512-verified Debian netinst and matching
Debian syslinux-common BIOS modules (the builder rejects mismatched libraries).
Verify the delivered ISO with `sha256sum -c` from its artifacts directory.

Boot the rebuilt image using SeaBIOS and OVMF, both as a CD-ROM and a read-only
USB mass-storage disk. Select the actual menu entries, not a direct kernel
boot. Save menu/installer screenshots and inspect `/proc/cmdline` from the
installer's Alt-F2 shell. Verify repair uses `rescue/enable=true` without
`auto=true`, and verify power-off stops the VM. All menus must contain exactly
install, repair and power off, with no desktop choices.

## 2026-10-08 physical boot report and compatibility image

The user tested the checksum-verified framebuffer-fixed image on their
Chromebook. The Kindred menu appeared, but selecting Install returned
immediately to the firmware menu. Thus the earlier framebuffer fix did not
resolve that physical machine's failure. There is no captured firmware error
or kernel log establishing the root cause.

The separate `kindred-os-0.4.0-efi-compat-amd64.iso` tests an alternate handoff:
GRUB chainloads unified kernel images built by systemd ukify. Their embedded
Debian kernel and initrds are byte-identical to the ISO's normal install/repair
files. This uses the kernel's EFI entry point instead of GRUB's Linux loader.
It also preserves the firmware-selected resolution, removes quiet boot, holds
kernel panics on screen, and waits for Enter if the EFI executable returns.
No Chromebook firmware changes are performed. Secure Boot must be disabled
for the unsigned bundled EFI executables.

OVMF booted this image as a read-only USB disk: Install reached the password
prompt, Repair reached rescue mode, both `/proc/cmdline` values matched their
embedded configuration, and power-off terminated QEMU. Evidence is under
`artifacts/boot-validation/compat/`. These results validate the alternate path
in OVMF, not a fix on physical hardware. The Chromebook must be retested.
SeaBIOS USB boot also passed Install, Repair, their kernel command-line checks,
and power-off; evidence is under `artifacts/boot-validation/compat-bios/`.

Delivered ISO SHA-256:
`79980049e078014acc567e822da40e4d2048dda85df949e0f03672862eed7f38`.

The reusable VM check accepts an ISO and an output directory:

```sh
python3 tests/installer-boot-qemu.py artifacts/kindred-os-0.4.0-efi-compat-amd64.iso artifacts/boot-validation/compat --mode uefi --medium usb
```

Use a fresh output directory on each run. It requires QEMU/KVM, OVMF, Pillow
and Tesseract. It attaches no writable guest disk and never installs to host
storage. The same check accepts `--mode bios` and `--medium cd`.

UKI format reference: https://uapi-group.org/specifications/specs/unified_kernel_image/

## USB test 3: no shim or GRUB on the UEFI path

The user reported the same return to firmware with the compatibility image,
including when selecting Power Off. They confirmed the ChromeOS developer
screen and Ctrl+L/Alternative Firmware sequence, identifying RW_LEGACY.
No loader status text was observed. The exact firmware failure remains
unidentified, so a third diagnostic image removes the remaining common
shim/GRUB path entirely.

`scripts/build-direct-efi-iso.py` puts systemd-boot and the same verified UKIs
on an appended FAT32 ESP, with a non-overlapping GPT layout. The UEFI menu
says `USB test 3` and preserves the firmware console mode. It has no countdown
and needs no persistent firmware boot entry. BIOS retains Syslinux.

Both OVMF USB and SeaBIOS USB tests passed the kernel-command-line, repair,
and power-off checks. The `run-vm.sh --installer --headless` preview also
reached the password prompt, confirmed visually. Test evidence is under
`artifacts/boot-validation/test3-uefi/` and `test3-bios/`.

ISO SHA-256:
`3187bf17ee949e78773f95f528dc3acf8900749f81d350cae7e4f4acc1093945`.
The actual RW_LEGACY Chromebook still needs a physical test; OVMF is not a
substitute for that firmware.

## Development VM is a different boot target

`run-vm.sh` previously booted `.vm/kindred.qcow2` with QEMU's default BIOS,
not any installer ISO. Selecting its installed-OS entry reproduced a stall
with both virtio-vga and standard VGA. With the same disk in a temporary
snapshot and OVMF UEFI instead, SSH became available, LightDM was active, and
the Kindred Home desktop appeared. The saved guest disk was not modified by
these diagnostics. `run-vm.sh` now uses OVMF and a private variable store.
Screenshot: `artifacts/boot-validation/development-vm-uefi-desktop.png`.

`run-vm.sh --installer` now explicitly previews the current USB ISO as a
read-only USB device under UEFI, without an installation target. Its menu
and disk differ intentionally from the installed development VM. Neither VM
test establishes the cause of the physical RW_LEGACY return-to-firmware issue.
