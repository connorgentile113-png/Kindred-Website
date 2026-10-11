import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {catalog, webApps} from './catalog.js';

// Desktop entries are launched through Gio, never by parsing Exec as a shell
// command. Refresh this list when opening Apps so store-installed apps appear.
export function availableApps() {
    const items = [...webApps, ...catalog];
    const names = new Set(items.map(item => item.name.toLowerCase()));
    const commands = new Set(catalog.map(item => GLib.path_get_basename(item.command)));
    for (const desktop of Gio.AppInfo.get_all().sort((a, b) => a.get_name().localeCompare(b.get_name()))) {
        if (!desktop.should_show()) continue;
        const name = desktop.get_name();
        const executable = GLib.path_get_basename(desktop.get_executable() || '');
        const categories = desktop.get_categories?.() || '';
        if (names.has(name.toLowerCase()) || commands.has(executable)) continue;
        // Terminal access has its own explicit Developer mode entry point.
        if (categories.includes('TerminalEmulator') || /terminal|xterm|uxterm/i.test(`${name} ${executable}`)) continue;
        names.add(name.toLowerCase());
        items.push({name, desktop, category: 'Installed apps', description: desktop.get_description() || `Open ${name} on this computer.`});
    }
    return items;
}
