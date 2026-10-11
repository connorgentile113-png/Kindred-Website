import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time

import argparse

parser = argparse.ArgumentParser(description="Boot installer media in QEMU without a writable guest disk")
parser.add_argument("iso", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--mode", choices=["uefi", "bios"], default="uefi")
parser.add_argument("--medium", choices=["cd", "usb"], default="usb")
parser.add_argument("--loader", choices=["grub", "systemd-boot"], default="grub")
args = parser.parse_args()
ROOT = args.output.resolve()
ROOT.mkdir(parents=True, exist_ok=True)
ISO = args.iso.resolve()

def run(mode, medium):
    name = f'fixed-{mode}-{medium}'
    sockpath = ROOT / f'{name}.sock'
    cmd = ['qemu-system-x86_64', '-enable-kvm', '-m', '1024', '-display', 'none',
           '-qmp', f'unix:{sockpath},server=on,wait=off', '-serial', f'file:{ROOT / (name + ".serial")}', '-boot', 'menu=on']
    if mode == 'uefi':
        variables = ROOT / f'{name}-vars.fd'
        shutil.copy('/usr/share/OVMF/OVMF_VARS_4M.fd', variables)
        cmd += ['-drive', 'if=pflash,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd',
                '-drive', f'if=pflash,format=raw,file={variables}']
    if medium == 'cd':
        cmd += ['-cdrom', str(ISO), '-boot', 'd']
    else:
        cmd += ['-device', 'qemu-xhci', '-drive', f'if=none,id=usb,format=raw,readonly=on,file={ISO}',
                '-device', 'usb-storage,drive=usb,bootindex=1']
    log = (ROOT / f'{name}.log').open('w')
    process = subprocess.Popen(cmd, stdout=log, stderr=log)
    try:
        for _ in range(100):
            if sockpath.exists(): break
            if process.poll() is not None: raise RuntimeError('QEMU failed: ' + name)
            time.sleep(.1)
        s = socket.socket(socket.AF_UNIX); s.settimeout(10); s.connect(str(sockpath))
        f = s.makefile('rwb'); f.readline()
        def call(c, a=None):
            f.write((json.dumps({'execute': c, **({'arguments': a} if a else {})}) + '\n').encode()); f.flush()
            while True:
                r = json.loads(f.readline())
                if 'return' in r: return r['return']
                if 'error' in r: raise RuntimeError(r)
        def key(k):
            call('human-monitor-command', {'command-line': 'sendkey ' + k}); time.sleep(.15)
        def text(t):
            for ch in t: key({' ': 'spc', '/': 'slash', '.': 'dot', '=': 'equal', '-': 'minus'}.get(ch, ch))
            key('ret')
        def shot(stage):
            path = ROOT / f'{name}-{stage}.ppm'
            call('screendump', {'filename': str(path)})
            from PIL import Image
            ocr = ROOT / f'{name}-{stage}-ocr.png'
            im = Image.open(path)
            im.resize((im.width * 2, im.height * 2)).save(ocr)
            result = subprocess.check_output(['tesseract', str(ocr), 'stdout'],
                      env={**os.environ, 'OMP_THREAD_LIMIT': '1'}, stderr=subprocess.DEVNULL).decode()
            (ROOT / f'{name}-{stage}.txt').write_text(result)
            print(name, stage, result, flush=True)
            return result
        call('qmp_capabilities')
        time.sleep(15)
        menu = shot('menu')
        if mode == 'uefi' and args.loader == 'systemd-boot':
            assert 'USB test 3' in menu and 'Power Off The System' in menu, menu
        else:
            assert 'Install Kindred' in menu and 'Turn off computer' in menu, menu
        key('ret'); time.sleep(50)
        shot('installer')
        key('alt-f2'); time.sleep(2); key('ret'); time.sleep(1)
        text('cat /proc/cmdline'); time.sleep(1)
        line = shot('cmdline')
        assert 'auto=true' in line and 'priority=high' in line, line
        if mode == 'uefi': assert 'vga=788' not in line, line
        call('system_reset'); time.sleep(15); key('down'); key('ret'); time.sleep(30)
        shot('repair'); key('alt-f2'); time.sleep(2); key('ret'); time.sleep(1)
        text('cat /proc/cmdline'); time.sleep(1)
        line = shot('rescue-cmdline')
        assert 'rescue/enable=true' in line and 'auto=true' not in line, line
        call('system_reset'); time.sleep(15); key('down'); key('down'); key('ret'); time.sleep(5)
        if process.poll() is None:
            raise RuntimeError('Power-off did not stop VM: ' + name)
        print(name, 'PASS install, repair, poweroff', flush=True)
    finally:
        if process.poll() is None: process.terminate(); process.wait(timeout=10)
        log.close()

run(args.mode, args.medium)
