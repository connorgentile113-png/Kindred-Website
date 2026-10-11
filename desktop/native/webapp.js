#!/usr/bin/env gjs
// A friendly wrapper for real web apps (YouTube, Instagram, Facebook, Gmail…).
// It gives every site the same large, familiar controls, so no one has to learn
// a new page layout. Usage: gjs native/webapp.js <url> [title]
imports.gi.versions.Gtk = '3.0';
imports.gi.versions.WebKit2 = '4.1';
const {Gtk, Gdk, WebKit2} = imports.gi;

const smoke = ARGV.includes('--smoke-test');
let url = ARGV[0] || 'https://www.wikipedia.org';
const title = ARGV[1] || url;
if (smoke) url = 'about:blank';
else if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

Gtk.init(null);

const provider = new Gtk.CssProvider();
provider.load_from_data(`
  window { background: #f3f5f2; color: #233e3b; font-size: 26px; }
  button { min-height: 64px; padding: 12px 26px; border-radius: 16px; font-size: 26px; }
  button:focus { outline: 4px solid #174f86; outline-offset: 3px; }
  label.title { font-size: 30px; font-weight: bold; }
`);
Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);

const window = new Gtk.Window({title: `Kindred — ${title}`, default_width: 1200, default_height: 850});
window.maximize();

const root = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin: 16});
const bar = new Gtk.Box({spacing: 12});
const back = new Gtk.Button({label: '◀  Back'});
const home = new Gtk.Button({label: 'Home'});
const reload = new Gtk.Button({label: 'Reload'});
const close = new Gtk.Button({label: 'Close'});
const browser = new Gtk.Button({label: 'Open in Firefox'});
const status = new Gtk.Label({label: '', wrap: true});
browser.connect('clicked', () => { imports.gi.Gio.AppInfo.launch_default_for_uri(view.get_uri() || url, null); });
const heading = new Gtk.Label({label: title});
heading.get_style_context().add_class('title');
heading.set_hexpand(true);

const view = new WebKit2.WebView();
const scrolled = new Gtk.ScrolledWindow({vexpand: true, hexpand: true});
scrolled.add(view);

back.connect('clicked', () => { if (view.can_go_back()) view.go_back(); else window.close(); });
home.connect('clicked', () => {
    const launcher = imports.gi.GLib.build_filenamev([imports.gi.GLib.get_current_dir(), 'scripts', 'run-native.sh']);
    try { imports.gi.Gio.Subprocess.new([launcher], imports.gi.Gio.SubprocessFlags.NONE); } catch (_) {}
    window.close();
});
reload.connect('clicked', () => view.reload());
close.connect('clicked', () => window.close());

bar.pack_start(back, false, false, 0);
bar.pack_start(home, false, false, 0);
bar.pack_start(reload, false, false, 0);
bar.pack_start(heading, true, true, 0);
bar.pack_start(close, false, false, 0);
const tools = new Gtk.Box({spacing: 12}); tools.pack_start(status, true, true, 0); tools.pack_start(browser, false, false, 0);
root.pack_start(bar, false, false, 0);
root.pack_start(scrolled, true, true, 0);
root.pack_start(tools, false, false, 0);
window.add(root);

window.connect('destroy', () => Gtk.main_quit());
view.connect('load-failed', () => { status.label = 'This page could not load. Check your connection or try Firefox.'; return false; });
view.connect('load-changed', (_view, event) => { if (event === WebKit2.LoadEvent.STARTED) status.label = 'Loading…'; if (event === WebKit2.LoadEvent.FINISHED) status.label = ''; });
view.connect('create', (_view, action) => {
    const uri = action.get_request().get_uri();
    if (/^https?:\/\//i.test(uri)) imports.gi.Gio.AppInfo.launch_default_for_uri(uri, null);
    return null;
});
view.set_zoom_level(1.25);
if (smoke) {
    view.connect('load-changed', (_view, event) => {
        if (event === WebKit2.LoadEvent.FINISHED) {
            if (view.can_go_back()) throw new Error('Unexpected initial history');
            print('PASS: embedded browser loaded; initial Back returns to Kindred.');
            back.clicked();
        }
    });
    imports.gi.GLib.timeout_add_seconds(imports.gi.GLib.PRIORITY_DEFAULT, 30, () => { printerr('Web wrapper test timed out'); imports.system.exit(1); });
}
view.load_uri(url);
window.show_all();
Gtk.main();
