import GLib from 'gi://GLib';
import System from 'system';
import {LinuxPlatform, PreviewPlatform, describeNetwork} from '../native/platform.js';
const assert = (value, message) => { if (!value) throw new Error(message); };
const loop = new GLib.MainLoop(null, false);
let failed = false;
async function test() {
    const calls = [];
    let permission = 'yes';
    const adapter = new LinuxPlatform(async (...args) => {
        calls.push(args);
        if (args[3] === 'CanPowerOff') return [permission];
        if (args[3] === 'PowerOff') return [];
        return [{State: new GLib.Variant('u', 70), Connectivity: new GLib.Variant('u', 4)}];
    });
    let rejected = false;
    try { await adapter.powerOff(false); } catch (_) { rejected = true; }
    assert(rejected && calls.length === 0, 'Unconfirmed shutdown reached D-Bus');
    permission = 'no'; rejected = false;
    try { await adapter.powerOff(true); } catch (_) { rejected = true; }
    assert(rejected && !calls.some(c => c[3] === 'PowerOff'), 'Denied shutdown reached PowerOff');
    permission = 'challenge'; await adapter.powerOff(true);
    const request = calls.find(c => c[3] === 'PowerOff');
    assert(request[0] === 'org.freedesktop.login1' && request[4].deep_unpack()[0] === true, 'Wrong shutdown request');
    assert((await adapter.networkStatus()).status === 'Internet connected', 'Network properties not decoded');
    assert(describeNetwork(70, 0).status === 'Network connected', 'Unverified network called online');
    assert(describeNetwork(50, 2).status === 'Sign-in needed', 'Portal state lost');
    assert(describeNetwork(20, 1).status === 'Not connected', 'Offline state lost');
    const unavailable = new LinuxPlatform(async () => { throw new Error('Service missing'); });
    rejected = false; try { await unavailable.powerOff(true); } catch (_) { rejected = true; }
    assert(rejected, 'Missing service swallowed');
    const preview = new PreviewPlatform(); await preview.powerOff(true);
    assert(preview.requests === 1, 'Preview did not record request');
    if (ARGV.includes('--live-read')) {
        const live = new LinuxPlatform();
        print(JSON.stringify({network: await live.networkStatus(), canPowerOff: await live.canPowerOff()}));
    }
    print('PASS: power confirmation, denied permission, interactive authorization, missing services, preview safety, network status mapping.');
}
test().catch(error => { logError(error); failed = true; }).finally(() => loop.quit());
loop.run();
if (failed) System.exit(1);
