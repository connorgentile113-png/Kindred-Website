import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

// The deployed Firebase service answers this endpoint with the newest release.
const UPDATE_URL = GLib.getenv('KINDRED_UPDATE_URL') || 'https://kindredos.web.app/updates/version';
const session = new Soup.Session({timeout: 20});

export function parseVersion(value) {
    return String(value ?? '').trim().replace(/^v/i, '').split(/[.+-]/).map(part => Number.parseInt(part, 10) || 0);
}
export function compareVersions(a, b) {
    const left = parseVersion(a), right = parseVersion(b);
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i++) {
        const x = left[i] || 0, y = right[i] || 0;
        if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
}
export function updateDecision(current, release = {}) {
    const latest = release.latest || release.version || null;
    if (!latest) return {update: false, required: false, latest: null, current: String(current), unknown: true};
    return {
        update: compareVersions(latest, current) > 0,
        required: compareVersions(release.minimum || '0.0.0', current) > 0,
        latest, current: String(current), url: release.url || null, notes: release.notes || ''
    };
}
export function currentVersion() {
    for (const path of ['/opt/kindred/VERSION', GLib.build_filenamev([GLib.get_current_dir(), 'VERSION'])]) {
        try { return new TextDecoder().decode(Gio.File.new_for_path(path).load_contents(null)[1]).trim(); } catch (_) { /* try next */ }
    }
    return '0.0.0';
}
export function checkForUpdate() {
    return new Promise(resolve => {
        const message = Soup.Message.new('GET', `${UPDATE_URL}?version=${encodeURIComponent(currentVersion())}`);
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_s, result) => {
            try {
                const bytes = session.send_and_read_finish(result);
                if (message.status_code !== 200) throw new Error(`HTTP ${message.status_code}`);
                const release = JSON.parse(new TextDecoder().decode(bytes.get_data()));
                resolve({...updateDecision(currentVersion(), release), error: null});
            } catch (error) {
                resolve({current: currentVersion(), update: false, required: false, latest: null, error: error.message});
            }
        });
    });
}
function run(argv) {
    return new Promise(resolve => {
        try {
            const process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
            process.wait_async(null, (_p, result) => {
                try { process.wait_finish(result); resolve(process.get_successful()); } catch (_) { resolve(false); }
            });
        } catch (_) { resolve(false); }
    });
}
export function automaticUpdates() {
    try {
        const process = Gio.Subprocess.new(['systemctl', 'is-enabled', '--quiet', 'kindred-update.timer'], Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
        process.wait(null); return process.get_successful();
    } catch (_) { return false; }
}
export async function setAutomaticUpdates(enabled) {
    return run(['pkexec', '/usr/bin/bash', '/opt/kindred/scripts/configure-updates.sh', enabled ? '--enable' : '--disable']);
}
export async function applyUpdate() {
    if (!GLib.file_test('/etc/systemd/system/kindred-update.service', GLib.FileTest.EXISTS)) {
        // Migration for 0.4 installations. Authentication is handled by polkit.
        if (!await run(['pkexec', '/usr/bin/bash', '/opt/kindred/scripts/configure-updates.sh', '--enable'])) return false;
    }
    return run(['systemctl', 'start', 'kindred-update.service']);
}
