#!/usr/bin/env python3
"""Local VM diagnostics. Examples: status; screenshot /tmp/kindred.ppm; powerdown."""
import json
from pathlib import Path
import socket
import sys
root = Path(__file__).resolve().parent.parent
sock = socket.socket(socket.AF_UNIX)
sock.settimeout(10)
sock.connect(str(root / '.vm/qmp.sock'))
stream = sock.makefile('rwb')
stream.readline()
def call(command, arguments=None):
    message = {'execute': command}
    if arguments is not None: message['arguments'] = arguments
    stream.write((json.dumps(message) + '\n').encode()); stream.flush()
    while True:
        reply = json.loads(stream.readline())
        if 'error' in reply: raise RuntimeError(reply['error'])
        if 'return' in reply: return reply['return']
call('qmp_capabilities')
action = sys.argv[1] if len(sys.argv) > 1 else 'status'
if action == 'screenshot':
    path = str(Path(sys.argv[2]).resolve())
    call('screendump', {'filename': path})
    print(path)
elif action == 'click':
    x, y = int(sys.argv[2]), int(sys.argv[3])
    if not (0 <= x <= 32767 and 0 <= y <= 32767): raise SystemExit('Coordinates must be 0..32767')
    call('input-send-event', {'events': [
        {'type':'abs', 'data':{'axis':'x', 'value':x}},
        {'type':'abs', 'data':{'axis':'y', 'value':y}},
        {'type':'btn', 'data':{'button':'left', 'down':True}}]})
    call('input-send-event', {'events':[{'type':'btn', 'data':{'button':'left', 'down':False}}]})
elif action == 'home':
    call('human-monitor-command', {'command-line':'sendkey meta_l-h'})
elif action == 'powerdown':
    call('system_powerdown')
elif action == 'status':
    print(json.dumps(call('query-status')))
else:
    raise SystemExit('Use status, screenshot PATH, or powerdown')
