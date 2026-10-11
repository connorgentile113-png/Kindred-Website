#!/usr/bin/python3
"""Offline microphone transcription; only the reviewed text goes to NVIDIA."""
import json
import gi
gi.require_version("Gst", "1.0")
from gi.repository import Gst, GLib
Gst.init(None)
pipeline = Gst.parse_launch("autoaudiosrc ! audioconvert ! audioresample ! audio/x-raw,format=S16LE,rate=16000,channels=1 ! pocketsphinx name=recognizer hmm=/usr/share/pocketsphinx/model/en-us/en-us lm=/usr/share/pocketsphinx/model/en-us/en-us.lm.bin dict=/usr/share/pocketsphinx/model/en-us/cmudict-en-us.dict ! fakesink")
loop = GLib.MainLoop()
words = []
error = None
def message(bus, msg):
    global error
    if msg.type == Gst.MessageType.ERROR:
        error = "Microphone unavailable. Check Sound settings."
        loop.quit()
    elif msg.type == Gst.MessageType.ELEMENT:
        s = msg.get_structure()
        if s and s.get_name() == "pocketsphinx" and s.get_value("final"):
            words.append(s.get_value("hypothesis"))
def finish():
    loop.quit()
    return False
bus = pipeline.get_bus()
bus.add_signal_watch()
bus.connect("message", message)
pipeline.set_state(Gst.State.PLAYING)
GLib.timeout_add_seconds(10, finish)
try:
    loop.run()
finally:
    pipeline.set_state(Gst.State.NULL)
print(json.dumps({"error": error} if error else {"text": " ".join(words)}), flush=True)
