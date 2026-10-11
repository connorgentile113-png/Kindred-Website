"""Decode local H.264/AAC and VP9/Opus clips in the installed Debian guest."""
from pathlib import Path
import subprocess
import tempfile
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gst

Gst.init(None)
with tempfile.TemporaryDirectory(prefix='kindred-media-test-') as directory:
    for filename, video, audio in [('clip.mp4', 'libx264', 'aac'), ('clip.webm', 'libvpx-vp9', 'libopus')]:
        clip = Path(directory) / filename
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=10',
                        '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '1', '-c:v', video,
                        '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', audio, str(clip)], check=True, timeout=30)
        player = Gst.ElementFactory.make('playbin')
        player.set_property('uri', clip.as_uri())
        player.set_property('video-sink', Gst.ElementFactory.make('fakesink'))
        player.set_property('audio-sink', Gst.ElementFactory.make('fakesink'))
        try:
            player.set_state(Gst.State.PLAYING)
            message = player.get_bus().timed_pop_filtered(30 * Gst.SECOND, Gst.MessageType.EOS | Gst.MessageType.ERROR)
            if message is None:
                raise AssertionError(f'{filename}: decode timed out')
            if message.type == Gst.MessageType.ERROR:
                raise AssertionError(f'{filename}: {message.parse_error()[0].message}')
            print(f'PASS: {filename} decoded to end of stream.')
        finally:
            player.set_state(Gst.State.NULL)
