#!/bin/bash
# Preview the actual USB image with UEFI; no installation target is attached.
set -euo pipefail
cd "$(dirname "$0")/.."
visual=(-display gtk,gl=off)
if [[ ${1:-} == --headless ]]; then
  shift
  visual=(-display none -vnc 127.0.0.1:6)
fi
iso=${1:-artifacts/kindred-os-0.4.0-usb-test3-amd64.iso}
[[ -f "$iso" ]] || { echo "Installer ISO not found: $iso" >&2; exit 1; }
iso=$(realpath "$iso")
firmware=/usr/share/OVMF/OVMF_CODE_4M.fd
variables=/usr/share/OVMF/OVMF_VARS_4M.fd
[[ -f "$firmware" && -f "$variables" ]] || { echo 'Install the ovmf package first.' >&2; exit 1; }
vm_work=$(mktemp -d /tmp/kindred-installer-preview.XXXXXX)
trap 'rm -rf -- "$vm_work"' EXIT
cp "$variables" "$vm_work/vars.fd"
accel=(-accel tcg -cpu max)
if [[ -r /dev/kvm && -w /dev/kvm ]]; then accel=(-accel kvm -cpu host); fi
echo "Installer preview: $iso" >&2
echo 'No target disk is attached. Close the window or select Power Off The System when finished.' >&2
qemu-system-x86_64 -name 'Kindred USB installer preview' -machine q35 "${accel[@]}" \
  -m "${KINDRED_VM_MEMORY:-2048}" -smp 2 \
  -drive "if=pflash,format=raw,readonly=on,file=$firmware" \
  -drive "if=pflash,format=raw,file=$vm_work/vars.fd" \
  -device qemu-xhci -device usb-tablet \
  -drive "if=none,id=installer,format=raw,readonly=on,file=$iso" \
  -device usb-storage,drive=installer,bootindex=1 \
  -netdev user,id=net0 -device virtio-net-pci,netdev=net0 \
  -qmp "unix:$vm_work/qmp.sock,server=on,wait=off" \
  -serial "file:$vm_work/serial.log" "${visual[@]}"
