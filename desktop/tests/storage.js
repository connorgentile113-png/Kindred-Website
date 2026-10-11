import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {Store} from '../native/store.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
if (ARGV.includes('--live')) {
    const live = new Store();
    live.save();
    print('PASS: live Kindred state was rewritten safely.');
} else {
const directoryPath = GLib.dir_make_tmp('kindred-storage-XXXXXX');
const directory = Gio.File.new_for_path(directoryPath);
try {
    const initial = new Store(directoryPath);
    initial.state.largeText = true;
    initial.save();
    assert(new Store(directoryPath).state.largeText, 'A valid state did not persist');
    // Existing files gain opt-in preferences without changing documents.
    const stateFile = directory.get_child('state.json');
    stateFile.replace_contents(JSON.stringify({documents: [{id: 'old', title: 'Letter', text: 'Keep this'}], largeText: true}), null, false, Gio.FileCreateFlags.NONE, null);
    const migrated = new Store(directoryPath);
    assert(!migrated.state.developerMode && migrated.state.pinnedApps.length === 0 && migrated.state.documents[0].text === 'Keep this', 'Old state migration lost data or enabled developer mode');
    migrated.setPreference('pinnedApps', ['YouTube']); migrated.setPreference('developerMode', true);
    const reread = new Store(directoryPath);
    assert(reread.state.pinnedApps[0] === 'YouTube' && reread.state.developerMode && reread.state.documents[0].text === 'Keep this', 'New preferences did not persist independently');
    reread.setReading(false, true);
    assert(!new Store(directoryPath).state.largeText && new Store(directoryPath).state.contrast, 'Reading preferences did not persist');
    reread.setReading(false, false);
    assert(!new Store(directoryPath).state.contrast && new Store(directoryPath).state.documents[0].text === 'Keep this', 'Reading reset lost documents');
    const broken = new Store(`${directoryPath}/state.json/blocked`);
    const pins = broken.state.pinnedApps;
    try { broken.setPreference('pinnedApps', ['YouTube']); throw new Error('Broken save accepted'); }
    catch (error) { assert(broken.state.pinnedApps === pins, 'Failed preference save was not rolled back'); }
    try { broken.setReading(true, true); throw new Error('Broken reading save accepted'); }
    catch (error) { assert(!broken.state.largeText && !broken.state.contrast, 'Failed reading save was not rolled back'); }

    stateFile.replace_contents('{broken', null, false, Gio.FileCreateFlags.NONE, null);
    const recovered = new Store(directoryPath);
    assert(!recovered.error && recovered.warning && recovered.recoveryPath, 'An empty state was not recovered');
    const backupPath = recovered.recoveryPath;
    recovered.state.contrast = true;
    recovered.save();
    assert(!recovered.warning && new Store(directoryPath).state.contrast, 'Recovered state did not persist');
    assert(Gio.File.new_for_path(backupPath).query_exists(null), 'The unreadable state was not backed up');
    print('PASS: valid, empty, and corrupt state files remain saveable.');
} finally {
    const entries = directory.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let entry;
    while ((entry = entries.next_file(null))) directory.get_child(entry.get_name()).delete(null);
    entries.close(null);
    directory.delete(null);
}
}
