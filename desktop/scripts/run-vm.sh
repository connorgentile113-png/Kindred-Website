#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ${1:-} == --installer ]]; then
  shift
  exec bash scripts/run-installer-vm.sh "$@"
fi
vm_dir="$PWD/.vm"
[[ -f "$vm_dir/kindred.qcow2" ]] || { echo 'Run python3 scripts/prepare-vm.py first.' >&2; exit 1; }
firmware=/usr/share/OVMF/OVMF_CODE_4M.fd
variables=/usr/share/OVMF/OVMF_VARS_4M.fd
[[ -r "$firmware" && -r "$variables" ]] || { echo 'Install the ovmf package for UEFI boot.' >&2; exit 1; }
[[ -f "$vm_dir/OVMF_VARS.fd" ]] || cp "$variables" "$vm_dir/OVMF_VARS.fd"
accel=(-accel tcg -cpu max)
if [[ -r /dev/kvm && -w /dev/kvm ]]; then accel=(-accel kvm -cpu host); fi
visual=(-display gtk,gl=off)
if [[ ${1:-} == --headless ]]; then
  shift
  visual=(-display none -vnc 127.0.0.1:5)
fi
echo 'Starting the installed development VM. To preview the USB installer, use: ./scripts/run-vm.sh --installer' >&2
exec qemu-system-x86_64 -name Kindred-Debian -machine q35 "${accel[@]}" \
  -m "${KINDRED_VM_MEMORY:-2048}" -smp 2 \
  -drive "if=pflash,format=raw,readonly=on,file=$firmware" \
  -drive "if=pflash,format=raw,file=$vm_dir/OVMF_VARS.fd" \
  -drive "file=$vm_dir/kindred.qcow2,if=virtio,format=qcow2,discard=unmap" \
  -drive "file=$vm_dir/seed.iso,media=cdrom,readonly=on" \
  -device virtio-vga -device qemu-xhci -device usb-tablet \
  -device intel-hda -device hda-duplex \
  -netdev user,id=net0,hostfwd=tcp:127.0.0.1:2227-:22 -device virtio-net-pci,netdev=net0 \
  -serial "file:$vm_dir/serial.log" \
  -qmp "unix:$vm_dir/qmp.sock,server=on,wait=off" "${visual[@]}" "$@"
