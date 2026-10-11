import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gdk from 'gi://Gdk?version=4.0';
import Pango from 'gi://Pango';
import System from 'system';
import {catalog, webApps} from './catalog.js';
import {availableApps} from './apps.js';
import {checkForUpdate, applyUpdate, automaticUpdates, setAutomaticUpdates} from './update.js';
import {assistantPage, stopAssistant} from './assistant.js';
import {Store} from './store.js';
import {PracticeNote} from './practice.mjs';
import {LinuxPlatform, PreviewPlatform} from './platform.js';
import {findPlaces, forecast} from './weather.js';

const smoke = ARGV.includes('--smoke-test');
const preview = smoke || ARGV.includes('--preview');
const platform = preview ? new PreviewPlatform() : new LinuxPlatform();
let pageGeneration = 0, powerPending = false, autosaveTimer = 0;
const testDirectory = smoke ? GLib.dir_make_tmp('kindred-test-XXXXXX') : null;
const store = testDirectory ? new Store(testDirectory) : new Store();
const sessionMode = ARGV.includes('--session');
const app = new Adw.Application({application_id: smoke ? 'org.kindred.Desktop.Test' : 'org.kindred.Desktop', flags: smoke ? Gio.ApplicationFlags.NON_UNIQUE : Gio.ApplicationFlags.FLAGS_NONE});
let window, page, heading, notice, back, editor, titleEntry, saveButton, searchEntry;
let route = 'Home', history = [], dirty = false, failed = false;
let pageScroll, undoRemoval, lastRemoved = null, activeConfirmation = null, practiceEditor;
const practiceNote = new PracticeNote();
let allApps = availableApps();
const buttons = new Map();
function button(label, action) {
    const widget = new Gtk.Button({label, hexpand: true});
    widget.get_child().wrap = true;
    widget.get_child().wrap_mode = Pango.WrapMode.WORD_CHAR;
    widget.get_child().xalign = 0.5;
    widget.connect('clicked', action);
    if (smoke) buttons.set(label, widget);
    return widget;
}
function label(text) { return new Gtk.Label({label: text, wrap: true, wrap_mode: Pango.WrapMode.WORD_CHAR, xalign: 0, selectable: false}); }
function clear() { if (activeConfirmation) { activeConfirmation.destroy(); activeConfirmation = null; } stopAssistant(true); pageGeneration++; while (page.get_first_child()) page.remove(page.get_first_child()); }
function save() {
    if (autosaveTimer) { GLib.source_remove(autosaveTimer); autosaveTimer = 0; }
    try { store.save(); dirty = false; notice.label = 'Saved on this computer.'; return true; }
    catch (error) {
        logError(error);
        notice.label = 'We could not save your changes. Keep this window open and try Save again. Your earlier saved file has not been replaced.';
        return false;
    }
}
function scheduleSave() {
    if (autosaveTimer) GLib.source_remove(autosaveTimer);
    autosaveTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => { autosaveTimer = 0; save(); return GLib.SOURCE_REMOVE; });
}
function pinApp(name, pinned) {
    if (!allApps.some(item => item.name === name)) return 'That app is not available in Kindred.';
    const names = store.state.pinnedApps.filter(value => value !== name);
    if (pinned && names.length >= 40) return 'Home already has 40 apps. Unpin an app before adding another.';
    if (pinned) names.push(name);
    try {
        store.setPreference('pinnedApps', names);
        const result = pinned ? `${name} is pinned to Home.` : `${name} was removed from Home. The app is still in Apps.`;
        notice.label = result;
        return result;
    } catch (_) { return 'The Home shortcut could not be saved. Please try again.'; }
}
function openTerminal() {
    if (!store.state.developerMode) return 'Turn on Developer mode in Settings first.';
    if (smoke) return 'Terminal is available in Developer mode.';
    launchTool(['xterm', '-fa', 'DejaVu Sans Mono', '-fs', '16'], 'Linux terminal');
    return 'The Linux terminal is opening.';
}
function assistantContext() {
    const persistReading = (larger, contrast, message) => {
        try {
            store.setReading(larger, contrast); appearance(); notice.label = message;
            return message;
        } catch (error) {
            logError(error); notice.label = 'The setting could not be saved. Your earlier settings are unchanged.';
            return notice.label;
        }
    };
    const audioCommand = (argv, message) => {
        try {
            if (!GLib.find_program_in_path(argv[0])) return 'Audio controls are not available on this computer.';
            Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
            notice.label = message; return message;
        } catch (error) { logError(error); return 'The audio setting could not be changed. Open Sound settings to try again.'; }
    };
    return {
        pinApp,
        appNames: allApps.map(item => item.name),
        setTextSize: larger => persistReading(larger, store.state.contrast, larger ? 'Text is now larger.' : 'Text is now smaller.'),
        setContrast: enabled => persistReading(store.state.largeText, enabled, enabled ? 'High contrast is now on.' : 'High contrast is now off.'),
        setVolume: percent => {
            const value = Math.max(0, Math.min(100, Number(percent)));
            if (!Number.isFinite(value)) return 'Please choose a volume from 0 to 100 percent.';
            return audioCommand(['wpctl', 'set-volume', '@DEFAULT_AUDIO_SINK@', `${value}%`], `Speaker volume set to ${value} percent.`);
        },
        changeVolume: points => {
            const value = Math.max(-50, Math.min(50, Number(points)));
            if (!Number.isFinite(value)) return 'Please choose a volume change from minus 50 to plus 50.';
            return audioCommand(['wpctl', 'set-volume', '@DEFAULT_AUDIO_SINK@', `${value > 0 ? '+' : ''}${value}%`], value >= 0 ? 'Speaker volume raised.' : 'Speaker volume lowered.');
        },
        setMute: muted => audioCommand(['wpctl', 'set-mute', '@DEFAULT_AUDIO_SINK@', muted ? '1' : '0'], muted ? 'Speakers muted.' : 'Speakers unmuted.'),
        openSoundSettings: () => { launchTool(['pavucontrol'], 'Sound settings'); return 'I opened Sound settings.'; },
        openBluetoothSettings: () => { launchTool(['blueman-manager'], 'Bluetooth settings'); return 'I opened Bluetooth settings.'; },
        openApp: name => {
            if (name === 'Social media') name = 'Facebook';
            const item = allApps.find(entry => entry.name === name);
            return item ? openCatalogItem(item) : 'That app is not available in Kindred.';
        },
        installApp: name => {
            const packages = {Solitaire: 'aisleriot', Chess: 'gnome-chess', Sudoku: 'gnome-sudoku', Music: 'rhythmbox', Podcasts: 'gpodder', Movies: 'vlc', 'App store': 'gnome-software'};
            const packageName = packages[name];
            if (!packageName) return 'That app cannot be installed from Kindred.';
            try {
                if (!GLib.find_program_in_path('pkcon')) return 'The app installer is unavailable. I opened the App store instead.';
                const process = Gio.Subprocess.new(['pkcon', '--noninteractive', 'install', packageName], Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE);
                notice.label = `Installing ${name}…`;
                process.wait_async(null, (_process, result) => {
                    try { process.wait_finish(result); notice.label = process.get_successful() ? `${name} is installed.` : `${name} could not be installed. Open the App store for details.`; }
                    catch (error) { logError(error); notice.label = `${name} could not be installed. Open the App store for details.`; }
                });
                return `I started installing ${name}.`;
            } catch (error) { logError(error); return `I could not start installing ${name}.`; }
        },
    };
}
function confirmRemoval(title, description, action) {
    const dialog = new Adw.MessageDialog({transient_for: window, modal: true, heading: title, body: description});
    dialog.add_response('keep', 'Keep it');
    dialog.add_response('remove', 'Yes, remove it');
    dialog.set_response_appearance('remove', Adw.ResponseAppearance.DESTRUCTIVE);
    dialog.set_default_response('keep');
    dialog.set_close_response('keep');
    activeConfirmation = dialog;
    dialog.connect('response', (_dialog, response) => {
        activeConfirmation = null;
        if (response === 'remove') action();
    });
    const wrapLabels = widget => {
        if (widget instanceof Gtk.Label) { widget.wrap = true; widget.wrap_mode = Pango.WrapMode.WORD_CHAR; }
        for (let child = widget.get_first_child(); child; child = child.get_next_sibling()) wrapLabels(child);
    };
    wrapLabels(dialog);
    dialog.present();
}
function showPractice() {
    page.append(label('Practice only. This example never changes your own documents or sends anything. It is forgotten when Kindred closes.'));
    if (practiceNote.removed) {
        page.append(label('The practice note was removed. Try Undo to bring it back.'));
        page.append(button('Undo practice removal', () => {
            practiceNote.undo(); navigate('Practice', false); notice.label = 'The sample note is back, exactly as you left it.';
        }));
    } else {
        page.append(label('1. Type a few words. 2. Try Save. 3. Try removing the sample and using Undo.'));
        practiceEditor = new Gtk.TextView({wrap_mode: Gtk.WrapMode.WORD_CHAR, top_margin: 16, bottom_margin: 16, left_margin: 16, right_margin: 16});
        practiceEditor.buffer.text = practiceNote.text;
        practiceEditor.update_property([Gtk.AccessibleProperty.LABEL], ['Practice note — sample only']);
        practiceEditor.buffer.connect('changed', () => practiceNote.edit(practiceEditor.buffer.text));
        page.append(new Gtk.ScrolledWindow({child: practiceEditor, min_content_height: 180}));
        page.append(button('Save practice note', () => {
            practiceNote.save(); notice.label = 'Practice note kept while Kindred is open. Your own documents are unchanged.';
        }));
        page.append(button('Remove practice note', () => confirmRemoval('Remove this practice note?', 'Only this sample is affected. You can bring it back with Undo.', () => {
            practiceNote.remove(true); navigate('Practice', false); notice.label = 'Sample removed. Choose Undo practice removal to bring it back.';
        })));
    }
    page.append(button('Back to the introduction', () => navigate('Start here')));
}
function navigate(next, remember = true) {
    if (next === 'Help') next = 'Assistant';
    if (dirty && !save()) return;
    if (remember && next !== route) history.push(route);
    route = next;
    heading.label = next;
    heading.visible = next !== 'Assistant';
    heading.halign = next === 'Home' ? Gtk.Align.CENTER : Gtk.Align.START;
    back.sensitive = true;
    clear();
    if (['Home', 'Apps', 'Assistant'].includes(next)) allApps = availableApps();
    page.set_css_classes(next === 'Assistant' ? ['chat-page'] : []);
    pageScroll.get_vadjustment().set_value(0);
    page.spacing = next === 'Assistant' ? 12 : 16;
    pageScroll.set_policy(Gtk.PolicyType.NEVER, next === 'Assistant' ? Gtk.PolicyType.NEVER : Gtk.PolicyType.AUTOMATIC);
    if (next === 'Start here') {
        page.append(label('Welcome. You do not have to learn everything today. Start with one thing that matters to you.'));
        for (const [title, description] of [
            ['Find your way back', 'Home brings you back to your familiar choices. Back returns to the previous Kindred page.'],
            ['Take a small step', 'Try a sample note in Practice. It stays separate from your own documents, so you can explore freely.'],
            ['Know what happens next', 'Kindred asks before removing a document or turning off. Removed Kindred documents stay in Recently removed. Other apps have their own controls.'],
        ]) { const caption = label(title); caption.add_css_class('section-title'); page.append(caption); page.append(label(description)); }
        page.append(button('Try a practice note', () => navigate('Practice')));
        page.append(button('Make text easier to read', () => navigate('Settings')));
        page.append(button('Go Home — choose an activity', () => navigate('Home')));
    } else if (next === 'Practice') {
        showPractice();
    } else if (next === 'Assistant') {
        assistantPage(page, button, label, assistantContext());
    } else if (next === 'Apps') {
        page.append(label('Choose an app. Your familiar Back and Home buttons stay at the top.'));
        const search = new Gtk.SearchEntry({placeholder_text: 'Find an app', hexpand: true});
        search.update_property([Gtk.AccessibleProperty.LABEL], ['Find an app']); page.append(search);
        const results = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 14}); page.append(results);
        const renderApps = () => {
            while (results.get_first_child()) results.remove(results.get_first_child());
            const query = search.text.trim().toLowerCase();
            const items = allApps.filter(item => `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(query));
            for (const category of [...new Set(items.map(item => item.category))]) {
                const title = label(category); title.add_css_class('section-title'); results.append(title);
                const grid = new Gtk.FlowBox({selection_mode: Gtk.SelectionMode.NONE, max_children_per_line: 2, min_children_per_line: 1, homogeneous: true, column_spacing: 14, row_spacing: 14});
                for (const item of items.filter(item => item.category === category)) {
                    const tile = button(item.name, () => openCatalogItem(item)); tile.add_css_class('app-card');
                    const content = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8});
                    const name = label(item.name); name.add_css_class('section-title'); content.append(name);
                    const description = label(item.description); description.add_css_class('app-description'); content.append(description);
                    const kind = label(item.url ? 'Official website · Internet needed' : 'On this computer'); kind.add_css_class('app-description'); content.append(kind);
                    tile.set_child(content); tile.update_property([Gtk.AccessibleProperty.LABEL], [item.name]);
                    const card = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6}); card.append(tile);
                    const pinned = store.state.pinnedApps.includes(item.name);
                    const pin = button(`${pinned ? 'Unpin' : 'Pin'} ${item.name} ${pinned ? 'from' : 'to'} Home`, () => {
                        pinApp(item.name, !store.state.pinnedApps.includes(item.name)); renderApps();
                    }); const pinCaption = label(pin.label); pinCaption.xalign = 0.5; pin.set_child(pinCaption); pin.add_css_class('pin-action'); card.append(pin); grid.append(card);
                }
                results.append(grid);
            }
            if (!items.length) results.append(label('No matching apps. Try another name.'));
        };
        search.connect('search-changed', renderApps); renderApps();
        page.append(button('Explore Flathub apps', () => openCatalogItem({name: 'Flathub', url: 'https://flathub.org'})));
        page.append(label('YouTube and Instagram above open their official websites. Sign in with your own account. Some services need a subscription. Flathub also offers Linux apps; check the publisher before installing.'));
    } else if (next === 'Hearing & sound') {
        page.append(label('Choose sound, microphone, hearing aids, and captions.'));
        page.append(button('Sound settings', () => launchTool(['pavucontrol'], 'Sound settings')));
        page.append(button('Bluetooth and hearing aids', () => launchTool(['blueman-manager'], 'Bluetooth settings')));
        page.append(label('For captions, look for CC or Subtitles in the player.'));
    } else if (next === 'Home') {
        const now = GLib.DateTime.new_now_local();
        const hour = now.get_hour();
        const name = store.state.displayName || GLib.get_real_name();
        heading.label = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}${name && name !== 'Unknown' ? `, ${name.split(' ')[0]}` : ''}.`;
        const welcome = button('Start here · A gentle introduction', () => navigate('Start here'));
        welcome.add_css_class('quick-action'); welcome.add_css_class('home-introduction'); page.append(welcome);
        const date = label(now.format('%A, %B %e'));
        date.halign = Gtk.Align.CENTER; date.add_css_class('date'); page.append(date);
        const pinnedItems = store.state.pinnedApps.map(name => allApps.find(item => item.name === name)).filter(Boolean);
        if (pinnedItems.length || store.state.developerMode) {
            const shelf = new Gtk.Box({spacing: 14}); const title = label('Your apps'); title.wrap = false; title.valign = Gtk.Align.CENTER; title.add_css_class('section-title'); shelf.append(title);
            const pins = new Gtk.FlowBox({selection_mode: Gtk.SelectionMode.NONE, max_children_per_line: 3, min_children_per_line: 1, homogeneous: true, row_spacing: 10, column_spacing: 10});
            for (const item of pinnedItems) { const shortcut = button(item.name, () => openCatalogItem(item)); const caption = label(item.name); caption.xalign = 0.5; shortcut.set_child(caption); shortcut.add_css_class('home-pin'); pins.append(shortcut); }
            if (store.state.developerMode) { const terminal = button('Linux terminal', openTerminal); terminal.add_css_class('home-pin'); pins.append(terminal); }
            pins.hexpand = true; shelf.append(pins); page.append(shelf);
        }
        const compactPins = Math.min(window.get_height() || 900, window.get_display().get_monitors().get_item(0).get_geometry().height) < 1100;
        const grid = new Gtk.Grid({column_spacing: 22, row_spacing: 18, column_homogeneous: true, row_homogeneous: true, halign: Gtk.Align.FILL, hexpand: true});
        const activities = [
            ['Internet', 'web-browser-symbolic', 'internet'],
            ['Email', 'mail-unread-symbolic', 'email'],
            ['Photos', 'folder-pictures-symbolic', 'photos'],
            ['Documents', 'text-x-generic-symbolic', 'documents'],
            ['Calendar', 'x-office-calendar-symbolic', 'calendar'],
            ['Weather', 'weather-clear-symbolic', 'weather'],
        ];
        activities.forEach(([name, icon, color], index) => {
            const tile = button(name, () => navigate(name));
            tile.add_css_class('activity'); tile.add_css_class(color); if (compactPins) tile.add_css_class('with-pins');
            tile.update_property([Gtk.AccessibleProperty.LABEL], [name]);
            const content = new Gtk.Box({orientation: compactPins ? Gtk.Orientation.HORIZONTAL : Gtk.Orientation.VERTICAL, spacing: 12, valign: Gtk.Align.CENTER, halign: Gtk.Align.CENTER});
            content.append(new Gtk.Image({file: GLib.build_filenamev([GLib.get_current_dir(), 'native', 'icons', `${color}.svg`]), pixel_size: compactPins ? 32 : 42}));
            const title = label(name); title.halign = Gtk.Align.CENTER; content.append(title);
            tile.set_child(content);
            grid.attach(tile, index % 2, Math.floor(index / 2), 1, 1);
        });
        page.append(grid);
        const homeActions = new Gtk.Box({spacing: 12, homogeneous: true});
        homeActions.append(button('Find', () => navigate('Find something')));
        homeActions.append(button('Apps', () => navigate('Apps')));
        const power = button('Turn off computer', () => navigate('Turn off computer'));
        power.set_child(label('Turn off')); power.update_property([Gtk.AccessibleProperty.LABEL], ['Turn off computer']); power.add_css_class('power');
        homeActions.append(power); page.append(homeActions);
    } else if (next === 'Internet' || next === 'Email' || next === 'Photos') {
        const descriptions = {Internet: 'Browse the web.', Email: 'Write an email.', Photos: 'View your pictures.'};
        page.append(label(descriptions[next]));
        if (next === 'Internet') page.append(button('Check Internet connection', () => navigate('Internet connection')));
        page.append(button(`Open ${next.toLowerCase()}`, () => {
            try {
                let uri = next === 'Internet' ? 'https://www.google.com' : 'mailto:';
                if (next === 'Photos') {
                    const directory = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES) || GLib.build_filenamev([GLib.get_home_dir(), 'Pictures']);
                    if (GLib.mkdir_with_parents(directory, 0o700) !== 0) throw new Error('Pictures folder unavailable');
                    uri = Gio.File.new_for_path(directory).get_uri();
                }
                if (next === 'Internet') launchTool([GLib.build_filenamev([GLib.get_current_dir(), 'scripts', 'kindred-webapp.sh']), uri, 'Internet'], 'Internet');
                else Gio.AppInfo.launch_default_for_uri(uri, window.get_display().get_app_launch_context());
                notice.label = 'Opened in your usual application. Kindred is still here when you return.';
            } catch (error) {
                logError(error);
                notice.label = `We could not open ${next.toLowerCase()}. Your documents are unchanged. Ask someone you trust to help set up an application, or return Home.`;
            }
        }));
    } else if (next === 'Calendar') {
        const calendar = new Gtk.Calendar({halign: Gtk.Align.CENTER}); page.append(calendar);
        const selectedDate = () => calendar.get_date().format('%Y-%m-%d');
        let date = selectedDate();
        const caption = label(`Notes for ${date}`); page.append(caption);
        const notes = new Gtk.Entry({placeholder_text: 'Add an appointment or reminder', text: store.state.calendar[date] || ''});
        notes.update_property([Gtk.AccessibleProperty.LABEL], ['Notes for the selected date']); page.append(notes);
        let loading = false;
        notes.connect('changed', () => {
            if (loading) return;
            store.state.calendar[date] = notes.text; dirty = true; scheduleSave();
        });
        calendar.connect('day-selected', () => {
            date = selectedDate(); caption.label = `Notes for ${date}`;
            loading = true; notes.text = store.state.calendar[date] || ''; loading = false;
        });
        page.append(label('Notes save on this computer. They do not send reminders or sync to an online calendar.'));
    } else if (next === 'Weather') {
        const generation = pageGeneration;
        page.append(label('Find your city.'));
        const city = new Gtk.Entry({placeholder_text: 'City or town', hexpand: true});
        city.update_property([Gtk.AccessibleProperty.LABEL], ['City or town']); page.append(city);
        const results = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12});
        const status = label('');
        const show = async place => {
            store.state.weatherPlace = {name: place.name, latitude: place.latitude, longitude: place.longitude};
            dirty = true;
            save();
            status.label = `Getting the forecast for ${place.name}…`;
            while (results.get_first_child()) results.remove(results.get_first_child());
            try {
                const days = await forecast(place);
                if (generation !== pageGeneration) return;
                status.label = place.name;
                days.forEach((day, i) => results.append(label(`${['Today', 'Tomorrow', 'The next day'][i]} · ${day.date}\n${day.summary} · High ${day.high}°F / Low ${day.low}°F`)));
            } catch (error) {
                if (generation === pageGeneration) status.label = `Saved ${place.name}. Forecast unavailable right now.`;
            }
        };
        const search = button('Find city', async () => {
            if (city.text.trim().length < 2) { status.label = 'Enter at least two letters of your city.'; return; }
            search.sensitive = false; status.label = 'Finding your city…';
            while (results.get_first_child()) results.remove(results.get_first_child());
            try {
                const places = await findPlaces(city.text);
                if (generation !== pageGeneration) return;
                status.label = places.length ? 'Choose your city:' : 'No city found. Try a nearby town.';
                places.forEach(place => results.append(button(place.name, () => show(place))));
            } catch (error) { if (generation === pageGeneration) status.label = 'We could not find cities right now. Check the Internet connection and try again.'; }
            finally { if (generation === pageGeneration) search.sensitive = true; }
        });
        page.append(search); page.append(status); page.append(results);
        page.append(label('Forecasts use Fahrenheit.'));
        if (store.state.weatherPlace && !smoke) show(store.state.weatherPlace);
    } else if (next === 'Turn off computer') {
        const generation = pageGeneration;
        page.append(label('Turn off this computer? Save any work in other applications before continuing.'));
        page.append(button('Keep using Kindred', () => navigate('Home')));
        const status = label('Checking whether the computer can turn off…');
        page.append(status);
        const confirm = button('Yes, turn off computer', async () => {
            if (powerPending || (dirty && !save())) return;
            powerPending = true; confirm.sensitive = false;
            status.label = 'Asking the computer to turn off…';
            try {
                await platform.powerOff(true);
                if (pageGeneration === generation) status.label = preview
                    ? 'Test complete. The computer has not been turned off.'
                    : 'The computer accepted the request to turn off.';
            } catch (error) {
                logError(error);
                if (pageGeneration === generation) {
                    status.label = 'The computer could not turn off. Your saved Kindred documents are safe. Try again, or use your desktop’s power menu.';
                    confirm.sensitive = true;
                }
            } finally { powerPending = false; }
        });
        confirm.sensitive = false; confirm.add_css_class('destructive-action'); page.append(confirm);
        platform.canPowerOff().then(available => {
            if (pageGeneration !== generation) return;
            confirm.sensitive = available && !powerPending;
            status.label = available ? 'Your saved Kindred documents will be here when you return.' : 'Turn off is unavailable here. You can use your desktop’s power menu.';
        }).catch(error => {
            logError(error);
            if (pageGeneration === generation) status.label = 'Power controls are unavailable. You can use your desktop’s power menu.';
        });
        if (!sessionMode) page.append(button('Close Kindred', () => window.close()));
    } else if (next === 'Internet connection') {
        const generation = pageGeneration;
        const status = label('Checking your connection…'); page.append(status);
        const detail = label(''); page.append(detail);
        const check = button('Check again', async () => {
            check.sensitive = false;
            try {
                const result = await platform.networkStatus();
                if (generation !== pageGeneration) return;
                status.label = result.status; detail.label = result.detail;
            } catch (error) {
                logError(error);
                if (generation !== pageGeneration) return;
                status.label = 'Connection status unavailable';
                detail.label = 'We could not check the Internet connection. Your saved documents are safe. Check your Wi-Fi or cable, or try opening a website.';
            } finally { if (generation === pageGeneration) check.sensitive = true; }
        });
        page.append(check);
        page.append(button('Open Internet', () => navigate('Internet')));
        page.append(button('Choose a network', () => launchTool(['nm-connection-editor'], 'Internet settings')));
        page.append(label('Choose or edit a connection in Internet settings. A virtual machine uses its shared cable connection; Wi-Fi is managed by the host computer.'));
        check.emit('clicked');
    } else if (next === 'Documents') {
        page.append(button('Create a document', () => {
            try { openDocument(store.create()); } catch (error) { logError(error); notice.label = 'A new document could not be saved. Your existing documents are unchanged. Check available storage and try again.'; }
        }));
        if (!store.state.documents.length) page.append(label('Your documents will appear here. Start with Create a document.'));
        page.append(button('Import a text document', importDocument));
        page.append(label('Changes save as you type. Removed Kindred documents can be restored from Recently removed.'));
        page.append(button('Recently removed', () => navigate('Recently removed')));
        for (const document of store.state.documents.filter(d => !d.deleted)) page.append(button(document.title || 'Untitled document', () => openDocument(document)));
    } else if (next === 'Recently removed') {
        page.append(label('Removed documents stay here until you restore them.'));
        if (!store.state.documents.some(document => document.deleted)) page.append(label('There are no removed documents. Your current documents are in Documents.'));
        for (const document of store.state.documents.filter(d => d.deleted))
            page.append(button(`Restore ${document.title}`, () => {
                try { store.setDeleted(document, false); navigate('Documents'); notice.label = 'Document restored.'; }
                catch (error) { notice.label = 'We could not restore the document. It is still here. Try again.'; }
            }));
    } else if (next === 'Find something') {
        searchEntry = new Gtk.SearchEntry({placeholder_text: 'Find a document or activity', hexpand: true});
        page.append(searchEntry);
        const results = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12});
        page.append(results);
        const update = () => {
            while (results.get_first_child()) results.remove(results.get_first_child());
            const query = searchEntry.text.trim().toLowerCase();
            for (const name of ['Home', 'Internet', 'Email', 'Photos', 'Documents', 'Calendar', 'Weather', 'Settings', 'Help', 'Apps', 'Assistant', 'Start here', 'Practice', 'Hearing & sound', ...allApps.map(a => a.name)])
                if (name.toLowerCase().includes(query)) {
                    const item = allApps.find(entry => entry.name === name);
                    results.append(button(name, () => item ? openCatalogItem(item) : navigate(name)));
                }
            for (const d of store.state.documents)
                if (!d.deleted && `${d.title} ${d.text}`.toLowerCase().includes(query)) results.append(button(`Document: ${d.title}`, () => openDocument(d)));
            if (!results.get_first_child()) results.append(label('Nothing found. Try another word, or open Documents.'));
        };
        searchEntry.connect('search-changed', update);
        update();
    } else if (next === 'Settings') {
        page.append(label('What would you like us to call you?'));
        const name = new Gtk.Entry({text: store.state.displayName || '', placeholder_text: 'Your first name', max_length: 80});
        name.update_property([Gtk.AccessibleProperty.LABEL], ['Your first name']);
        name.connect('changed', () => { store.state.displayName = name.text.trim(); dirty = true; scheduleSave(); });
        page.append(name);
        for (const [key, text] of [['largeText', 'Bigger text'], ['contrast', 'Stronger contrast']]) {
            const toggle = new Gtk.CheckButton({label: text, active: store.state[key]});
            let reverting = false;
            toggle.connect('toggled', () => {
                if (reverting) return;
                try {
                    store.setReading(key === 'largeText' ? toggle.active : store.state.largeText, key === 'contrast' ? toggle.active : store.state.contrast);
                    appearance(); notice.label = 'Reading setting saved. You can change it back or choose Reset text & contrast.';
                } catch (error) {
                    reverting = true; toggle.active = store.state[key]; reverting = false;
                    notice.label = 'The setting could not be saved. Your earlier reading settings are unchanged.';
                }
            });
            page.append(toggle);
            if (smoke) buttons.set(key, toggle);
        }
        page.append(button('Reset text & contrast', () => {
            try {
                store.setReading(false, false); appearance(); navigate('Settings', false);
                notice.label = 'Original text size and contrast restored. Your documents are unchanged.';
            } catch (error) { notice.label = 'Reading settings could not reset. Your earlier settings are unchanged. Try again.'; }
        }));
        page.append(button('Hearing aids, captions & sound', () => navigate('Hearing & sound')));
        page.append(button('Internet settings', () => navigate('Internet connection')));
        page.append(button('Sound settings', () => launchTool(['pavucontrol'], 'Sound settings')));
        page.append(button('Printer — add or fix a printer', () => launchTool(['system-config-printer'], 'Printer settings')));
        page.append(button('Advanced computer settings', () => navigate('Advanced computer settings')));
        const developer = new Gtk.Switch({active: store.state.developerMode});
        developer.update_property([Gtk.AccessibleProperty.LABEL], ['Developer mode']);
        const devRow = new Gtk.Box({spacing: 16}); const devLabel = label('Developer mode'); devLabel.hexpand = true; devRow.append(devLabel); devRow.append(developer); page.append(devRow);
        page.append(label('Shows a Linux terminal on Home and in Advanced settings. Terminal commands run as your normal user.'));
        let revertingDeveloper = false;
        developer.connect('notify::active', () => {
            if (revertingDeveloper) return;
            try { store.setPreference('developerMode', developer.active); notice.label = developer.active ? 'Developer mode is on. Linux terminal is available on Home.' : 'Developer mode is off.'; }
            catch (_) { revertingDeveloper = true; developer.active = store.state.developerMode; revertingDeveloper = false; notice.label = 'Developer mode could not be saved.'; }
        });
        if (smoke) buttons.set('developerMode', developer);
        const updateStatus = label('Updates keep Kindred current. Your documents stay on this computer.');
        const auto = new Gtk.Switch({active: automaticUpdates(), halign: Gtk.Align.END});
        const autoRow = new Gtk.Box({spacing: 16}); const autoLabel = label('Automatic Kindred updates'); autoLabel.hexpand = true; autoRow.append(autoLabel); autoRow.append(auto); page.append(autoRow);
        auto.update_property([Gtk.AccessibleProperty.LABEL], ['Automatic Kindred updates']);
        let changing = false;
        auto.connect('notify::active', async () => {
            if (changing || preview) return;
            const requested = auto.active; auto.sensitive = false;
            const ok = await setAutomaticUpdates(requested);
            changing = true; auto.active = automaticUpdates(); changing = false; auto.sensitive = true;
            updateStatus.label = ok ? (requested ? 'Automatic updates are on. No restart happens while you are working.' : 'Automatic updates are off. You can still check manually.') : 'The setting could not change. Try again with your administrator.';
        });
        page.append(button('Check for updates', async () => {
            if (preview) { updateStatus.label = 'Updates are simulated in preview mode.'; return; }
            updateStatus.label = 'Checking for updates…';
            const result = await checkForUpdate();
            updateStatus.label = result.error ? 'Could not check. Check your Internet connection and try again.' : result.update ? `Kindred ${result.latest} is available. Choose Install updates now.` : `Up to date: Kindred ${result.current}.`;
        }));
        const installUpdate = button('Install updates now', async () => {
            if (preview) { updateStatus.label = 'Preview: your computer has not been changed.'; return; }
            installUpdate.sensitive = false; updateStatus.label = 'Checking and installing… Keep using your computer.';
            const installed = await applyUpdate(); installUpdate.sensitive = true;
            updateStatus.label = installed ? 'Update check finished. Any new version will appear next time you sign in. Your work stays open.' : 'The update could not finish. Your previous version is kept. Try again, or ask your administrator.';
        }); page.append(installUpdate); page.append(updateStatus);

    } else if (next === 'Advanced computer settings') {
        page.append(label('These tools can change how the computer works. Open them when you know what you want to change, or with help from someone you trust.'));
        if (store.state.developerMode) page.append(button('Open terminal', openTerminal));
        else page.append(label('To use the Linux terminal, turn on Developer mode in Settings.'));
        page.append(button('Back to Settings', () => navigate('Settings')));

    }
}
function openDocument(document) {
    if (dirty && !save()) return;
    history.push(route === 'Document' ? 'Documents' : route);
    route = 'Document'; heading.label = 'Document'; back.sensitive = true; clear();
    heading.visible = true;
    page.append(label('Document name'));
    titleEntry = new Gtk.Entry({text: document.title, hexpand: true});
    titleEntry.update_property([Gtk.AccessibleProperty.LABEL], ['Document name']);
    page.append(titleEntry);
    editor = new Gtk.TextView({wrap_mode: Gtk.WrapMode.WORD_CHAR, vexpand: true, top_margin: 16, bottom_margin: 16, left_margin: 16, right_margin: 16});
    editor.update_property([Gtk.AccessibleProperty.LABEL], ['Document text']);
    editor.buffer.text = document.text;
    page.append(new Gtk.ScrolledWindow({child: editor, vexpand: true, min_content_height: 240}));
    titleEntry.connect('changed', () => { document.title = titleEntry.text; dirty = true; notice.label = 'Saving your changes…'; scheduleSave(); });
    editor.buffer.connect('changed', () => { document.text = editor.buffer.text; dirty = true; notice.label = 'Saving your changes…'; scheduleSave(); });
    saveButton = button('Save', save);
    page.append(saveButton);
    page.append(button('Export a copy', () => exportDocument(document)));
    page.append(button('Remove document', () => {
        if (dirty && !save()) return;
        confirmRemoval('Move this document to Recently removed?', `“${document.title || 'Untitled document'}” will leave your document list. Its words will be kept, and you can restore it.`, () => {
            try {
                store.setDeleted(document, true); lastRemoved = document; undoRemoval.visible = true;
                navigate('Documents'); notice.label = 'Document moved to Recently removed. Choose Undo removal to bring it back.';
            } catch (error) { notice.label = 'The document could not be removed. Your saved copy is unchanged. Try again.'; }
        });
    }));
}
function launchTool(argv, name) {
    try { Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE); notice.label = `${name} is opening…`; }
    catch (error) { notice.label = `${name} could not open. Your documents are safe. Return Home or ask someone you trust to check the installed applications.`; }
}
function commandIsInstalled(command) {
    return command.startsWith('/') ? Gio.File.new_for_path(command).query_exists(null) : !!GLib.find_program_in_path(command);
}
function openCatalogItem(item) {
    if (!item) return 'That app is not available in Kindred.';
    if (smoke) { notice.label = `Ready to open ${item.name}.`; return `I opened ${item.name}.`; }
    if (item.desktop) {
        try { item.desktop.launch([], window.get_display().get_app_launch_context()); return `${item.name} is opening.`; }
        catch (_) { return `${item.name} could not open. Try again from Apps.`; }
    }
    if (item.url) {
        launchTool([GLib.build_filenamev([GLib.get_current_dir(), 'scripts', 'kindred-webapp.sh']), item.url, item.name], item.name);
        return `I started opening ${item.name}.`;
    }
    if (commandIsInstalled(item.command)) {
        launchTool([item.command], item.name);
        return `I opened ${item.name}.`;
    }
    if (commandIsInstalled('gnome-software')) {
        launchTool(['gnome-software', '--search', item.name], 'App store');
        notice.label = `${item.name} is not installed yet. The App store is opening its page.`;
        return `${item.name} is not installed. I opened its App store page.`;
    }
    return `${item.name} is not installed, and the App store is unavailable.`;
}
function importDocument() {
    const chooser = new Gtk.FileChooserNative({title: 'Import a text document', transient_for: window, action: Gtk.FileChooserAction.OPEN, accept_label: 'Import', cancel_label: 'Cancel'});
    const filter = new Gtk.FileFilter(); filter.set_name('Text documents'); filter.add_mime_type('text/plain'); filter.add_pattern('*.txt'); chooser.add_filter(filter);
    chooser.connect('response', (_dialog, response) => {
        if (response === Gtk.ResponseType.ACCEPT) {
            try {
                const file = chooser.get_file();
                if (file.query_info('standard::size', Gio.FileQueryInfoFlags.NONE, null).get_size() > 2_000_000) throw new Error('Too large');
                const [, bytes] = file.load_contents(null);
                const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
                openDocument(store.importText(file.get_basename().replace(/\.txt$/i, ''), text));
            } catch (error) { notice.label = 'This document could not be imported. Choose a UTF-8 text file smaller than 2 MB. The original file is unchanged.'; }
        }
        chooser.destroy();
    }); chooser.show();
}
function exportDocument(document) {
    const chooser = new Gtk.FileChooserNative({title: 'Export a copy', transient_for: window, action: Gtk.FileChooserAction.SAVE, accept_label: 'Save copy', cancel_label: 'Cancel'});
    chooser.set_current_name(`${(document.title || 'Document').replace(/[\/\\]/g, '-')}.txt`);
    chooser.connect('response', (_dialog, response) => {
        if (response === Gtk.ResponseType.ACCEPT) {
            try {
                chooser.get_file().replace_contents(document.text, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
                notice.label = 'A text copy was saved. Your Kindred document is still here.';
            } catch (error) { notice.label = 'The copy could not be saved. Your document is still in Kindred. Try another folder.'; }
        }
        chooser.destroy();
    }); chooser.show();
}
function createHomeBar() {
    const geometry = window.get_display().get_monitors().get_item(0).get_geometry();
    const panel = new Gtk.ApplicationWindow({application: app, title: 'Kindred Navigation', decorated: false, resizable: false, default_width: geometry.width, default_height: 96});
    panel.add_css_class('session-navigation');
    const row = new Gtk.Box({spacing: 14, margin_start: 18, margin_end: 18, margin_top: 8, margin_bottom: 8, homogeneous: true});
    for (const [name, target] of [['Back', 'Back'], ['Home', 'Home'], ['Apps', 'Apps'], ['Help', 'Assistant'], ['Settings', 'Settings']]) {
        const control = new Gtk.Button({label: name, hexpand: true});
        control.connect('clicked', () => { if (target === 'Back') { if (dirty && !save()) return; const previous = history.pop(); navigate(previous || 'Home', false); } else navigate(target); window.present(); }); row.append(control);
    }
    panel.set_child(row); panel.connect('close-request', () => true); panel.present();
    const pin = () => {
        const geometry = window.get_display().get_monitors().get_item(0).get_geometry();
        const panelHeight = Math.max(96, panel.get_height());
        const run = argv => { const process = Gio.Subprocess.new(argv, Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE); process.wait_check(null); };
        try {
            run(['xprop', '-name', 'Kindred Navigation', '-f', '_NET_WM_WINDOW_TYPE', '32a', '-set', '_NET_WM_WINDOW_TYPE', '_NET_WM_WINDOW_TYPE_DOCK']);
            run(['xprop', '-name', 'Kindred Navigation', '-f', '_NET_WM_STRUT_PARTIAL', '32c', '-set', '_NET_WM_STRUT_PARTIAL', `0, 0, ${panelHeight}, 0, 0, 0, 0, 0, 0, ${geometry.width - 1}, 0, 0`]);
            run(['wmctrl', '-r', 'Kindred Navigation', '-b', 'remove,maximized_vert,maximized_horz']);
            run(['wmctrl', '-r', 'Kindred Navigation', '-e', `0,0,0,${geometry.width},${panelHeight}`]);
            run(['wmctrl', '-r', 'Kindred Navigation', '-b', 'add,above,sticky,skip_taskbar,skip_pager']);
        } catch (error) { logError(error); }
    };
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 3000, () => { pin(); return GLib.SOURCE_CONTINUE; });
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { pin(); return GLib.SOURCE_REMOVE; });
}
const css = new Gtk.CssProvider();
function appearance() {
    const compact = Math.min(window.get_height() || 900, window.get_display().get_monitors().get_item(0).get_geometry().height) < 1100;
    css.load_from_data(`
        window { font-size: ${store.state.largeText ? 34 : 27}px; background: #f3f5f2; color: #233e3b; }
        label, entry, textview, checkbutton { font-size: ${store.state.largeText ? 34 : 27}px; }
        button, checkbutton, entry, searchentry { min-height: 68px; padding: 16px 26px; }
        button { min-width: 150px; border-radius: 18px; font-size: ${store.state.largeText ? 34 : 27}px; }
        button:focus-visible, entry:focus-visible, checkbutton:focus-visible { outline: 4px solid #174f86; outline-offset: 3px; }
        .title { font-size: ${store.state.largeText ? 50 : 42}px; font-weight: bold; }
        .date { color: #526863; margin-bottom: 6px; }
        .activity { min-height: ${compact ? 80 : 150}px; padding: 12px 16px; border-radius: 26px; border: 1px solid alpha(#233e3b, 0.12); box-shadow: 0 3px 6px alpha(#233e3b, 0.07); font-weight: bold; font-size: 30px; }
        .activity:hover { box-shadow: 0 5px 10px alpha(#233e3b, 0.18); }
        .internet { background: #dcecfb; color: #204d78; }
        .email { background: #e7e0f5; color: #58417c; }
        .photos { background: #fbe3d8; color: #86472b; }
        .documents { background: #dceee3; color: #285b41; }
        .calendar { background: #f7dfE6; color: #813e56; }
        .weather { background: #faedc8; color: #725515; }
        .power { background: transparent; color: #9b3535; margin-top: 8px; }
        .session-navigation button { min-height: 48px; padding: 10px 16px; font-size: ${store.state.largeText ? 30 : 26}px; }
        .home-introduction { min-height: 44px; padding: 8px 16px; font-size: ${store.state.largeText ? 28 : 24}px; }
        .desktop-bar button { min-height: 44px; padding: 10px 16px; }
        messagedialog .heading { font-size: 30px; }
        messagedialog .body { font-size: 24px; }
        .desktop-bar { padding-bottom: 14px; border-bottom: 1px solid #d4ded8; }
        .section-title { font-size: 28px; font-weight: bold; }
        .app-description { font-size: 21px; }
        .app-card { background: #fff; border: 1px solid #b8cbc0; min-width: 180px; padding: 20px; }
        .bubble { padding: 18px 22px; border-radius: 20px; background: #fff; border: 1px solid #d3ded6; }
        .bubble-user { background: #244e43; color: #fff; border-color: #244e43; }
        .speaker { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
        .assistant-scroll { background: #edf1eb; border: 1px solid #d3ded6; border-radius: 22px; }
        .assistant-intro { padding: 2px 4px 8px; }
        .chat-title { font-family: 'DejaVu Serif'; font-size: ${store.state.largeText ? 38 : 34}px; font-weight: bold; }
        .chat-subtitle, .assistant-status, .chat-page expander > box > title { font-size: ${store.state.largeText ? 25 : 20}px; color: #526863; }
        .chat-composer { background: #fff; padding: 10px; border: 1px solid #c0d0c4; border-radius: 20px; }
        .chat-page button { min-width: 64px; min-height: 48px; padding: 8px 16px; font-size: ${store.state.largeText ? 28 : 23}px; }
        .chat-page entry { min-height: 48px; padding: 8px 12px; font-size: ${store.state.largeText ? 28 : 23}px; }
        .chat-page .suggested-action { background: #244e43; color: #fff; }
        .chat-page .assistant-options { background: transparent; border: none; box-shadow: none; min-height: 36px; padding: 0 8px; color: #244e43; }
        .pin-action { min-height: 44px; padding: 8px 12px; font-size: 20px; }
        .pin-action label { font-size: 20px; }
        .home-pin { min-height: 44px; padding: 8px 16px; background: #e2eee8; }
        .activity.with-pins { min-height: 64px; padding: 8px 16px; }
        .assistant-transcript { background: #fff; border: 1px solid #d4ded8; border-radius: 20px; }
        .assistant-input { background: #fff; border: 2px solid #9bb4a4; }
        .assistant-status { color: #526863; }
        .quick-action { background: #e9eee2; }
        ${store.state.contrast ? 'window, textview text, entry, button, button.activity, .chat-page .suggested-action, .home-pin { background: #fff; color: #111; } button { border: 2px solid #111; } .date, .assistant-status, .chat-subtitle { color: #111; } .bubble, .bubble-user, .assistant-scroll, .chat-composer, .assistant-intro, .app-card, .quick-action { background: #fff; color: #111; border: 2px solid #111; }' : ''}
    `, -1);
}
app.connect('activate', () => {
    if (window) { navigate('Home'); window.present(); return; }
    window = new Adw.ApplicationWindow({application: app, title: 'Kindred', default_width: 980, default_height: 900});
    const root = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 16, margin_top: 20, margin_bottom: 20, margin_start: 24, margin_end: 24});
    const nav = new Gtk.Box({spacing: 12, homogeneous: true});
    nav.append(button('Home', () => navigate('Home')));
    back = button('Back', () => {
        if (dirty && !save()) return;
        const previous = history.pop();
        navigate(previous ? (previous === 'Document' ? 'Documents' : previous) : 'Home', false);
    });
    nav.prepend(back);
    nav.append(button('Help', () => navigate('Help')));
    nav.append(button('Settings', () => navigate('Settings')));
    nav.add_css_class('desktop-bar');
    root.append(nav);
    heading = label('Home'); heading.add_css_class('title'); root.append(heading);
    notice = label(store.warning || (store.error ? 'Saved documents could not be read. They have not been changed. Close Kindred and ask someone you trust to help recover them.' : ''));
    notice.visible = notice.label.length > 0;
    notice.connect('notify::label', () => { notice.visible = notice.label.length > 0; });
    root.append(notice);
    undoRemoval = button('Undo removal', () => {
        if (!lastRemoved) return;
        try {
            store.setDeleted(lastRemoved, false); lastRemoved = null; undoRemoval.visible = false;
            navigate('Documents'); notice.label = 'Your document is back, with all its words.';
        } catch (error) { notice.label = 'The document could not be restored yet. It is kept in Recently removed. Try again.'; }
    });
    undoRemoval.visible = false; root.append(undoRemoval);
    page = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 16, vexpand: true});
    const clamp = new Adw.Clamp({child: page, maximum_size: 820, tightening_threshold: 620, vexpand: true});
    pageScroll = new Gtk.ScrolledWindow({child: clamp, hscrollbar_policy: Gtk.PolicyType.NEVER, vexpand: true});
    root.append(pageScroll);
    page.connect('notify::css-classes', () => { pageScroll.get_vadjustment().set_value(0); });

    window.set_content(root);
    if (ARGV.includes('--fullscreen')) window.fullscreen();
    const escape = new Gio.SimpleAction({name: 'leave-fullscreen'});
    escape.connect('activate', () => window.unfullscreen());
    app.add_action(escape);
    app.set_accels_for_action('app.leave-fullscreen', ['Escape']);
    window.connect('close-request', () => {
        if (dirty && !save()) return true;
        if (sessionMode) { navigate('Home'); return true; }
        return false;
    });
    Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    appearance(); navigate('Home', false); window.present();
    if (sessionMode) { nav.visible = false; window.maximize(); createHomeBar(); }
    if (smoke) GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        (async () => {
        try {
            const assert = (condition, message) => { if (!condition) throw new Error(message); };
            navigate('Apps');
            for (const item of [...catalog, ...webApps]) {
                assert(buttons.get(item.name), `Missing curated app: ${item.name}`);
                buttons.get(item.name).emit('clicked');
            }
            assert(!Array.from(buttons.keys()).includes('Open application'), 'Apps page exposed a second open button');
            navigate('Assistant'); assert(page.get_first_child(), 'Assistant page empty');
            let assistantInput = null;
            const findInput = widget => {
                if (widget instanceof Gtk.Entry && widget.placeholder_text === 'Type what you need') assistantInput = widget;
                for (let child = widget.get_first_child(); child; child = child.get_next_sibling()) findInput(child);
            }; findInput(page);
            assert(assistantInput && buttons.get('Send'), 'Assistant controls missing');
            assistantInput.text = 'make the text bigger'; buttons.get('Send').emit('clicked');
            assert(new Store(testDirectory).state.largeText, 'Assistant did not change text size');
            await new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => { resolve(); return GLib.SOURCE_REMOVE; }));
            const [inputMeasured, inputBounds] = assistantInput.compute_bounds(window);
            assert(inputMeasured && inputBounds.get_y() + inputBounds.get_height() <= window.get_height(), 'Assistant input is below the window');
            buttons.get('Voice & chat options').emit('clicked'); buttons.get('Back to chat').emit('clicked');
            buttons.get('Voice & chat options').emit('clicked'); buttons.get('Stop listening / speaking / request').emit('clicked'); buttons.get('Back to chat').emit('clicked');
            assistantInput.text = 'pin YouTube to Home'; buttons.get('Send').emit('clicked');
            assert(new Store(testDirectory).state.pinnedApps.includes('YouTube'), 'Assistant pin did not persist');
            assistantInput.text = 'unpin YouTube from Home'; buttons.get('Send').emit('clicked');
            assert(!new Store(testDirectory).state.pinnedApps.includes('YouTube'), 'Assistant unpin did not persist');
            assistantInput.text = 'pin YouTube to Home'; buttons.get('Send').emit('clicked');
            navigate('Home'); assert(buttons.get('YouTube').get_root() === window, 'Pinned app missing on Home');
            navigate('Apps'); buttons.get('Unpin YouTube from Home').emit('clicked');
            assert(!new Store(testDirectory).state.pinnedApps.includes('YouTube'), 'Manual unpin failed');
            buttons.get('Pin YouTube to Home').emit('clicked');
            assert(new Store(testDirectory).state.pinnedApps.includes('YouTube'), 'Manual pin failed');
            const previousPins = store.state.pinnedApps.slice();
            assert(pinApp('Unknown app', true).includes('not available') && JSON.stringify(store.state.pinnedApps) === JSON.stringify(previousPins), 'Unknown app accepted');
            assert(openTerminal().includes('Turn on Developer mode'), 'Terminal allowed with Developer mode off');
            navigate('Settings'); buttons.get('developerMode').active = true;
            assert(new Store(testDirectory).state.developerMode && openTerminal().includes('available'), 'Developer mode did not persist');
            navigate('Home'); assert(buttons.get('Linux terminal').get_root() === window, 'Terminal missing on Home');
            navigate('Settings'); buttons.get('developerMode').active = false;
            assert(!new Store(testDirectory).state.developerMode, 'Developer mode did not turn off');
            navigate('Hearing & sound'); assert(page.get_first_child(), 'Hearing settings empty');
            navigate('Home'); assert(back.sensitive, 'Back must always be available');
            buttons.get('Documents').emit('clicked');
            buttons.get('Create a document').emit('clicked');
            titleEntry.text = 'A letter'; editor.buffer.text = 'Hello from Kindred'; saveButton.emit('clicked');
            assert(new Store(testDirectory).state.documents[0].text === 'Hello from Kindred', 'Document did not persist');
            buttons.get('Back').emit('clicked'); assert(route === 'Documents', 'Back failed');
            buttons.get('Home').emit('clicked'); assert(route === 'Home', 'Home failed');
            assert(platform.requests === 0, 'Power action ran without confirmation');
            for (const activity of ['Internet', 'Email', 'Photos', 'Calendar', 'Weather', 'Turn off computer']) {
                buttons.get(activity)?.emit('clicked');
                assert(route === activity, `Activity failed: ${activity}`);
                buttons.get('Home').emit('clicked');
            }
            const settle = (delay = 20) => new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => { resolve(); return GLib.SOURCE_REMOVE; }));
            navigate('Turn off computer'); await settle();
            buttons.get('Keep using Kindred').emit('clicked');
            assert(route === 'Home' && platform.requests === 0, 'Cancel requested shutdown');
            navigate('Turn off computer'); await settle();
            assert(buttons.get('Yes, turn off computer').sensitive, 'Confirmation unavailable');
            buttons.get('Yes, turn off computer').emit('clicked'); await settle();
            assert(platform.requests === 1, 'Confirmed preview shutdown not recorded');
            assert(!buttons.get('Yes, turn off computer').sensitive, 'Shutdown can be submitted twice');
            navigate('Internet connection'); await settle();
            assert(page.get_first_child().label === 'Internet connected', 'Internet status not rendered');
            navigate('Settings'); buttons.get('largeText').active = true; buttons.get('contrast').active = true;
            const settings = new Store(testDirectory).state;
            assert(settings.largeText && settings.contrast, 'Settings did not persist');
            buttons.get('Reset text & contrast').emit('clicked');
            assert(!new Store(testDirectory).state.largeText && !new Store(testDirectory).state.contrast, 'Reading reset did not persist');
            buttons.get('Help').emit('clicked'); assert(route === 'Assistant', 'Help must open chat');
            navigate('Find something');
            searchEntry.text = 'A letter'; searchEntry.emit('search-changed');
            assert(page.get_last_child().get_first_child().label === 'Document: A letter', 'Search failed');
            const imported = store.importText('Imported note', 'A portable note');
            store.setDeleted(imported, true);
            assert(new Store(testDirectory).state.documents.find(d => d.id === imported.id).deleted === true, 'Removal did not persist');
            store.setDeleted(imported, false);
            assert(new Store(testDirectory).state.documents.find(d => d.id === imported.id).deleted === false, 'Restore did not persist');
            openDocument(imported); editor.buffer.text = 'Autosaved note'; await settle(1200);
            assert(new Store(testDirectory).state.documents.find(d => d.id === imported.id).text === 'Autosaved note', 'Autosave did not persist');
            navigate('Calendar'); page.get_first_child().get_next_sibling().get_next_sibling().text = 'Lunch with a friend';
            await settle(1200);
            assert(Object.values(new Store(testDirectory).state.calendar).includes('Lunch with a friend'), 'Calendar note did not persist');
            const exportFile = Gio.File.new_for_path(`${testDirectory}/copy.txt`);
            exportFile.replace_contents(imported.text, null, false, Gio.FileCreateFlags.NONE, null);
            assert(new TextDecoder().decode(exportFile.load_contents(null)[1]) === imported.text, 'Export text changed');
            exportFile.delete(null);
            const beforePractice = JSON.stringify(store.state);
            navigate('Start here'); buttons.get('Try a practice note').emit('clicked');
            assert(route === 'Practice', 'Introduction did not open practice');
            practiceEditor.buffer.text = 'Sample only — café'; buttons.get('Save practice note').emit('clicked');
            buttons.get('Remove practice note').emit('clicked');
            assert(activeConfirmation && !practiceNote.removed, 'Practice removed without confirmation');
            activeConfirmation.response('keep'); assert(!practiceNote.removed, 'Practice cancellation removed note');
            buttons.get('Remove practice note').emit('clicked'); activeConfirmation.response('remove');
            assert(practiceNote.removed, 'Confirmed practice removal failed');
            buttons.get('Undo practice removal').emit('clicked');
            assert(practiceNote.text === 'Sample only — café' && !practiceNote.removed, 'Practice Undo lost text');
            assert(JSON.stringify(store.state) === beforePractice, 'Practice modified real storage');
            openDocument(imported); buttons.get('Remove document').emit('clicked');
            assert(activeConfirmation && !imported.deleted, 'Document removed before confirmation');
            activeConfirmation.response('keep'); assert(!imported.deleted, 'Cancel removed document');
            buttons.get('Remove document').emit('clicked'); activeConfirmation.response('remove');
            assert(imported.deleted && undoRemoval.visible, 'Confirmed removal or Undo missing');
            undoRemoval.emit('clicked');
            assert(!imported.deleted && !undoRemoval.visible && new Store(testDirectory).state.documents.find(d => d.id === imported.id).text === 'Autosaved note', 'Undo did not durably restore the document');
            const broken = new Store(`${testDirectory}/state.json/blocked`);
            let rejected = false; try { broken.create(); } catch (_) { rejected = true; }
            assert(rejected && broken.state.documents.length === 0, 'Failed creation was not rolled back');
            store.file.replace_contents('{broken', null, false, Gio.FileCreateFlags.NONE, null);
            const corrupt = new Store(testDirectory);
            assert(corrupt.error === null && corrupt.warning && corrupt.recoveryPath, 'Corrupt storage was not recovered');
            const backupPath = corrupt.recoveryPath;
            corrupt.state.contrast = true;
            corrupt.save();
            assert(!corrupt.warning && new Store(testDirectory).state.contrast, 'Recovered storage could not be saved');
            assert(Gio.File.new_for_path(backupPath).query_exists(null), 'Corrupt storage backup was not kept');
            print('PASS: GTK4 introduction, isolated practice, removal confirmation/cancel, durable Undo, navigation, document persistence, search, accessibility, autosave, import/export, recovery, calendar, shutdown confirmation/cancel and Internet status.');
        } catch (error) { logError(error); failed = true; }
        window.destroy(); app.quit();
        })();
        return GLib.SOURCE_REMOVE;
    });
});
app.run([]);
if (testDirectory) {
    const directory = Gio.File.new_for_path(testDirectory);
    const entries = directory.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
    let entry;
    while ((entry = entries.next_file(null))) directory.get_child(entry.get_name()).delete(null);
    entries.close(null);
    directory.delete(null);
}
if (failed) System.exit(1);
