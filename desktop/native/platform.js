import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const LOGIN = ['org.freedesktop.login1', '/org/freedesktop/login1', 'org.freedesktop.login1.Manager'];
const NETWORK = ['org.freedesktop.NetworkManager', '/org/freedesktop/NetworkManager'];

// Fixed D-Bus endpoints and methods; no shell command construction.
export function systemCall(destination, path, iface, method, parameters = null) {
    return new Promise((resolve, reject) => {
        Gio.bus_get(Gio.BusType.SYSTEM, null, (_source, result) => {
            let bus;
            try { bus = Gio.bus_get_finish(result); } catch (error) { reject(error); return; }
            bus.call(destination, path, iface, method, parameters, null,
                Gio.DBusCallFlags.NONE, 15000, null, (_bus, response) => {
                    try { resolve(bus.call_finish(response).deep_unpack()); }
                    catch (error) { reject(error); }
                });
        });
    });
}

export function describeNetwork(state, connectivity) {
    if (connectivity === 2) return {status: 'Sign-in needed', detail: 'This network needs you to sign in. Open Internet to finish connecting.'};
    if (state === 40) return {status: 'Connecting', detail: 'The computer is connecting. Wait a moment, then check again.'};
    if (state === 70 && connectivity === 4) return {status: 'Internet connected', detail: 'The network reports that Internet access is working.'};
    if (state >= 50) return {status: 'Network connected', detail: 'You are connected to a network, but Internet access has not been confirmed. Try opening a website.'};
    if (state === 20 || state === 30 || connectivity === 1) return {status: 'Not connected', detail: 'Check your Wi-Fi or cable. Your saved documents are still on this computer.'};
    return {status: 'Connection status unavailable', detail: 'We cannot check the connection right now. You can try opening a website or check your desktop’s Internet settings.'};
}

export class LinuxPlatform {
    constructor(call = systemCall) { this.call = call; }
    async networkStatus() {
        const [properties] = await this.call(...NETWORK, 'org.freedesktop.DBus.Properties', 'GetAll', new GLib.Variant('(s)', ['org.freedesktop.NetworkManager']));
        return describeNetwork(properties.State?.deep_unpack(), properties.Connectivity?.deep_unpack());
    }
    async canPowerOff() {
        const [answer] = await this.call(...LOGIN, 'CanPowerOff');
        return answer === 'yes' || answer === 'challenge';
    }
    async powerOff(confirmed) {
        if (confirmed !== true) throw new Error('Power off requires confirmation');
        if (!await this.canPowerOff()) throw new Error('Power off is unavailable');
        await this.call(...LOGIN, 'PowerOff', new GLib.Variant('(b)', [true]));
    }
}

export class PreviewPlatform {
    constructor() { this.requests = 0; }
    async networkStatus() { return describeNetwork(70, 4); }
    async canPowerOff() { return true; }
    async powerOff(confirmed) {
        if (confirmed !== true) throw new Error('Power off requires confirmation');
        this.requests++;
    }
}
