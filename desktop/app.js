#!/usr/bin/env gjs
imports.gi.versions.Soup = '3.0';
const {GLib, Gio, Soup} = imports.gi;
const ByteArray = imports.byteArray;
const root = GLib.get_current_dir();
const port = Number(GLib.getenv('PORT') || 8080);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535');
const server = new Soup.Server();
const assets = {'/guide':['guide.html','text/html'], '/guide.html':['guide.html','text/html'], '/release.json':['release.json','application/json'], '/assets/home.png':['assets/home.png','image/png'], '/assets/assistant.png':['assets/assistant.png','image/png'], '/assets/mark.svg':['assets/mark.svg','image/svg+xml'], '/': ['index.html','text/html'], '/index.html':['index.html','text/html'], '/install.html':['install.html','text/html'], '/install':['install.html','text/html'], '/site.js':['site.js','text/javascript'], '/site.css':['site.css','text/css'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css'], '/model.mjs':['model.mjs','text/javascript'], '/updates/version':['updates/version.json','application/json']};
server.add_handler(null, (_server, message, path) => {
    if (message.get_method() !== 'GET') { message.set_status(405, null); return; }
    const asset = assets[path];
    if (!asset) { message.set_status(404, null); return; }
    try {
        const [, bytes] = GLib.file_get_contents(`${root}/web/${asset[0]}`);
        message.get_response_headers().append('X-Content-Type-Options', 'nosniff');
        message.get_response_headers().append('Cache-Control', 'no-cache');
        message.set_status(200, null);
        message.set_response(asset[1], Soup.MemoryUse.COPY, bytes);
    } catch (e) {
        logError(e);
        message.set_status(500, null);
    }
});
server.listen_local(port, Soup.ServerListenOptions.IPV4_ONLY);
print(`Kindred OS — http://localhost:${port} (GJS / Soup)`);
if (ARGV.includes('--native')) {
    imports.gi.versions.Gtk = '3.0';
    imports.gi.versions.WebKit2 = '4.1';
    const {Gtk, WebKit2} = imports.gi;
    Gtk.init(null);
    const window = new Gtk.Window({title:'Kindred OS', default_width:1320, default_height:900});
    const view = new WebKit2.WebView();
    if (ARGV.includes('--smoke-test')) {
        view.connect('load-changed', (_view, event) => {
            if (event === WebKit2.LoadEvent.FINISHED) {
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                view.evaluate_javascript('JSON.stringify({title:document.title,download:Array.from(document.querySelectorAll("a.button")).some(link=>link.getAttribute("href")==="/install"),screenshot:document.querySelector(".screen-frame img")?.naturalWidth>0})', -1, null, null, null, (_view, result) => {
                    try {
                        const value = view.evaluate_javascript_finish(result);
                        const resultState = JSON.parse(value.to_string());
                        if (!resultState.download || !resultState.screenshot || !resultState.title.includes("Kindred OS")) throw new Error(`Website download or screenshot did not load: ${JSON.stringify(resultState)}`);
                        print('Website preview smoke passed: download page and real desktop screenshot loaded.');
                    } catch (error) { logError(error); imports.system.exit(1); }
                    window.destroy();
                });
                return GLib.SOURCE_REMOVE;
                });
            }
        });
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 20, () => {
            printerr('Native smoke test timed out.');
            imports.system.exit(1);
        });
    }
    view.load_uri(`http://localhost:${port}`);
    window.add(view);
    window.connect('destroy', () => {server.disconnect(); Gtk.main_quit();});
    window.show_all();
    Gtk.main();
} else {
    const loop = new GLib.MainLoop(null, false);
    GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 2, () => {server.disconnect(); loop.quit(); return GLib.SOURCE_REMOVE;});
    GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, 15, () => {server.disconnect(); loop.quit(); return GLib.SOURCE_REMOVE;});
    loop.run();
}
