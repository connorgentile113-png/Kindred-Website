import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
export class Store {
    constructor(directory = GLib.build_filenamev([GLib.get_user_data_dir(), 'kindred-native'])) {
        this.directory = directory;
        this.file = Gio.File.new_for_path(`${directory}/state.json`);
        this.state = {documents: [], largeText: false, contrast: false, weatherPlace: null, calendar: {}, displayName: '', pinnedApps: [], developerMode: false};
        this.error = null;
        this.warning = null;
        this.recoveryPath = null;
        let bytes;
        try {
            [, bytes] = this.file.load_contents(null);
        } catch (error) {
            if (!error.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)) this.error = error;
            return;
        }
        try {
            const data = JSON.parse(new TextDecoder().decode(bytes));
            if (!data || !Array.isArray(data.documents) || data.documents.some(d =>
                !d || typeof d.id !== 'string' || typeof d.title !== 'string' || typeof d.text !== 'string'))
                throw new Error('Invalid saved documents');
            this.state = {documents: data.documents, largeText: data.largeText === true, contrast: data.contrast === true, displayName: typeof data.displayName === 'string' ? data.displayName.slice(0, 80) : '', calendar: data.calendar && typeof data.calendar === 'object' && !Array.isArray(data.calendar) && Object.values(data.calendar).every(value => typeof value === 'string') ? data.calendar : {}, weatherPlace: data.weatherPlace && typeof data.weatherPlace.name === 'string' && Number.isFinite(data.weatherPlace.latitude) && Number.isFinite(data.weatherPlace.longitude) ? data.weatherPlace : null};
            this.state.pinnedApps = Array.isArray(data.pinnedApps) ? [...new Set(data.pinnedApps.filter(name => typeof name === 'string' && name.length <= 80))].slice(0, 40) : [];
            this.state.developerMode = data.developerMode === true;
        } catch (error) {
            // A blank or partially written state file must not lock the user out of saving.
            // Keep the original so it can be recovered if it contains useful data.
            this.warning = 'An unreadable saved file was kept as a backup. New changes can be saved.';
            this.recoveryPath = `${this.file.get_path()}.corrupt-${GLib.get_real_time()}`;
        }
    }
    save() {
        if (this.error) throw this.error;
        if (GLib.mkdir_with_parents(this.directory, 0o700) !== 0) throw new Error('Cannot create storage');
        if (this.recoveryPath) {
            this.file.copy(Gio.File.new_for_path(this.recoveryPath), Gio.FileCopyFlags.NONE, null, null);
        }
        this.file.replace_contents(JSON.stringify(this.state), null, true,
            Gio.FileCreateFlags.PRIVATE | Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        this.recoveryPath = null;
        this.warning = null;
    }
    setDeleted(document, deleted) {
        const previous = document.deleted;
        document.deleted = deleted;
        try { this.save(); } catch (error) { document.deleted = previous; throw error; }
    }
    setReading(largeText, contrast) {
        const previous = {largeText: this.state.largeText, contrast: this.state.contrast};
        this.state.largeText = largeText === true;
        this.state.contrast = contrast === true;
        try { this.save(); }
        catch (error) { Object.assign(this.state, previous); throw error; }
    }
    setPreference(key, value) {
        if (!['pinnedApps', 'developerMode'].includes(key)) throw new Error('Unknown preference');
        const previous = this.state[key];
        this.state[key] = value;
        try { this.save(); } catch (error) { this.state[key] = previous; throw error; }
    }
    importText(title, text) {
        if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('Document too large');
        const document = {id: GLib.uuid_string_random(), title, text};
        this.state.documents.push(document);
        try { this.save(); } catch (error) { this.state.documents.pop(); throw error; }
        return document;
    }
    create() {
        const document = {id: GLib.uuid_string_random(), title: 'Untitled document', text: ''};
        this.state.documents.push(document);
        try { this.save(); } catch (error) { this.state.documents.pop(); throw error; }
        return document;
    }
}
