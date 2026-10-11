import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {catalog, webApps} from './catalog.js';

const model = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const session = new Soup.Session({timeout: 90});
const keyPath = GLib.build_filenamev([GLib.get_user_config_dir(), 'kindred', 'nim-key']);
const systemPrompt = `You are Kindred, a calm and practical assistant for older adults. Use short, friendly sentences and explain one step at a time. You can change only the device settings and install only the apps exposed by the tools below. Use a tool whenever the user asks to change text size, contrast, sound volume, mute, open a supported settings page or app, install a listed app, or pin or unpin an app on Home. Never claim a device change or installation happened until the tool result says it did. Never invent an app, command, account, appointment, or setting. Developer mode can only be enabled by the user in Settings; you cannot run terminal commands.`;
const toolDefinitions = [
    {type: 'function', function: {name: 'pin_app', description: 'Pin an app to Home or remove its Home shortcut without uninstalling it.', parameters: {type: 'object', properties: {name: {type: 'string', enum: [...catalog, ...webApps].map(app => app.name)}, pinned: {type: 'boolean'}}, required: ['name', 'pinned']}}},
    {type: 'function', function: {name: 'set_text_size', description: 'Make Kindred text larger or smaller and save that preference.', parameters: {type: 'object', properties: {larger: {type: 'boolean'}}, required: ['larger']}}},
    {type: 'function', function: {name: 'set_high_contrast', description: 'Turn Kindred high contrast on or off and save that preference.', parameters: {type: 'object', properties: {enabled: {type: 'boolean'}}, required: ['enabled']}}},
    {type: 'function', function: {name: 'set_volume', description: 'Set the default speaker volume from 0 to 100 percent.', parameters: {type: 'object', properties: {percent: {type: 'integer', minimum: 0, maximum: 100}}, required: ['percent']}}},
    {type: 'function', function: {name: 'change_volume', description: 'Raise or lower the default speaker volume by a number of percentage points.', parameters: {type: 'object', properties: {points: {type: 'integer', minimum: -50, maximum: 50}}, required: ['points']}}},
    {type: 'function', function: {name: 'set_mute', description: 'Mute or unmute the default speakers.', parameters: {type: 'object', properties: {muted: {type: 'boolean'}}, required: ['muted']}}},
    {type: 'function', function: {name: 'open_sound_settings', description: 'Open the sound and microphone settings window.', parameters: {type: 'object', properties: {}}}},
    {type: 'function', function: {name: 'open_bluetooth_settings', description: 'Open Bluetooth settings for hearing aids or other devices.', parameters: {type: 'object', properties: {}}}},
    {type: 'function', function: {name: 'open_app', description: 'Open one of the small set of Kindred apps shown in Apps.', parameters: {type: 'object', properties: {name: {type: 'string', enum: ['Solitaire', 'Chess', 'Sudoku', 'Music', 'Podcasts', 'Movies', 'App store', 'YouTube', 'Instagram', 'Facebook', 'WhatsApp', 'Gmail', 'Google Maps', 'Wikipedia', 'Amazon', 'BBC News', 'Netflix', 'Spotify']}}, required: ['name']}}},
    {type: 'function', function: {name: 'install_app', description: 'Install one listed Kindred app using the signed system app installer.', parameters: {type: 'object', properties: {name: {type: 'string', enum: ['Solitaire', 'Chess', 'Sudoku', 'Music', 'Podcasts', 'Movies', 'App store']}}, required: ['name']}}},
];

let conversation = [], activeCancel = null, voice = null, speech = null, activeOptions = null;

export function stopAssistant(closeOptions = false) {
    if (closeOptions) { activeOptions?.destroy(); activeOptions = null; }
    activeCancel?.cancel(); activeCancel = null;
    voice?.force_exit(); voice = null;
    speech?.force_exit(); speech = null;
}

function readKey() {
    const key = GLib.getenv('NVIDIA_API_KEY');
    if (key) return key.trim();
    try { return new TextDecoder().decode(Gio.File.new_for_path(keyPath).load_contents(null)[1]).trim(); }
    catch (_) { return ''; }
}

function parseArguments(raw) {
    try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); }
    catch (_) { return {}; }
}

function localRequest(text, context) {
    const normalized = text.toLowerCase();
    const pin = normalized.match(/^\s*(unpin|remove|pin|add)\s+(.+?)\s+(?:to|from|on)\s+(?:my\s+|the\s+)?home(?:\s*screen)?[.!?]*\s*$/);
    const shortPin = normalized.match(/^\s*(unpin|pin)\s+(.+?)[.!?]*\s*$/);
    const pinRequest = pin || shortPin;
    if (pinRequest) {
        const name = context.appNames.find(name => name.toLowerCase() === pinRequest[2].trim());
        return name ? context.pinApp(name, !['unpin', 'remove'].includes(pinRequest[1])) : 'Choose an app listed in Apps, such as YouTube or Solitaire.';
    }
    if (/(larger|bigger|increase|turn up).*(text|letters|writing)|(text|letters|writing).*(larger|bigger)/.test(normalized))
        return context.setTextSize(true);
    if (/(smaller|decrease|reduce).*(text|letters|writing)|(text|letters|writing).*(smaller|reduce)/.test(normalized))
        return context.setTextSize(false);
    if (/(high contrast|stronger contrast).*(on|enable|turn on)|turn on.*(high contrast|stronger contrast)/.test(normalized))
        return context.setContrast(true);
    if (/(high contrast|stronger contrast).*(off|disable|turn off)|turn off.*(high contrast|stronger contrast)/.test(normalized))
        return context.setContrast(false);
    const volume = normalized.match(/(?:volume|sound).{0,18}\b(\d{1,3})\s*(?:%|percent)?/);
    if (volume) return context.setVolume(Math.max(0, Math.min(100, Number(volume[1]))));
    if (/(turn|make|raise|increase).{0,18}(volume|sound).{0,12}(up|louder)/.test(normalized)) return context.changeVolume(10);
    if (/(turn|make|lower|decrease).{0,18}(volume|sound).{0,12}(down|quieter|lower)/.test(normalized)) return context.changeVolume(-10);
    if (/\b(unmute|turn sound on|sound on)\b/.test(normalized)) return context.setMute(false);
    if (/\b(mute|silence|quiet)\b/.test(normalized)) return context.setMute(true);
    if (/(open|show).{0,15}(sound|microphone|audio).{0,15}(settings|controls)?/.test(normalized)) return context.openSoundSettings();
    if (/(open|show|pair|connect).{0,20}(bluetooth|hearing aid)/.test(normalized)) return context.openBluetoothSettings();
    const install = normalized.match(/(?:install|download|get).{0,10}(solitaire|chess|sudoku|music|podcasts|movies|app store)/);
    if (install) return context.installApp({solitaire: 'Solitaire', chess: 'Chess', sudoku: 'Sudoku', music: 'Music', podcasts: 'Podcasts', movies: 'Movies', 'app store': 'App store'}[install[1]]);
    return null;
}

function runTool(name, args, context) {
    switch (name) {
    case 'pin_app': return typeof args.pinned === 'boolean' ? context.pinApp(String(args.name || ''), args.pinned) : 'Please say whether to pin or unpin the app.';
    case 'set_text_size': return context.setTextSize(args.larger === true);
    case 'set_high_contrast': return context.setContrast(args.enabled === true);
    case 'set_volume': return context.setVolume(Number(args.percent));
    case 'change_volume': return context.changeVolume(Number(args.points));
    case 'set_mute': return context.setMute(args.muted === true);
    case 'open_sound_settings': return context.openSoundSettings();
    case 'open_bluetooth_settings': return context.openBluetoothSettings();
    case 'open_app': return context.openApp(String(args.name || ''));
    case 'install_app': return context.installApp(String(args.name || ''));
    default: return 'That device action is not available.';
    }
}

function sendCompletion(messages, key, cancel, context, depth, done) {
    const payload = {
        model,
        messages,
        tools: toolDefinitions.map(tool => ['pin_app', 'open_app'].includes(tool.function.name) ? {
            ...tool, function: {...tool.function, parameters: {...tool.function.parameters, properties: {...tool.function.parameters.properties, name: {type: 'string', enum: context.appNames}}}},
        } : tool),
        tool_choice: 'auto',
        max_tokens: 1200,
        temperature: 0.2,
        stream: false,
        chat_template_kwargs: {enable_thinking: false},
    };
    const message = Soup.Message.new('POST', 'https://integrate.api.nvidia.com/v1/chat/completions');
    message.request_headers.append('Authorization', `Bearer ${key}`);
    message.set_request_body_from_bytes('application/json', new GLib.Bytes(new TextEncoder().encode(JSON.stringify(payload))));
    session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, cancel, (_s, res) => {
        try {
            const bytes = session.send_and_read_finish(res);
            if (cancel.is_cancelled()) return;
            if (message.status_code !== 200) throw new Error(message.status_code === 401 ? 'The NVIDIA API key was not accepted.' : message.status_code === 429 ? 'NVIDIA is busy or the account limit was reached. Try again later.' : `NVIDIA could not answer (HTTP ${message.status_code}). Check the connection and model access.`);
            const response = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            const assistant = response.choices?.[0]?.message;
            const calls = assistant?.tool_calls || [];
            if (calls.length && depth < 3) {
                const followup = [...messages, {role: 'assistant', content: assistant.content || null, tool_calls: calls}];
                for (const call of calls) {
                    const result = runTool(call.function?.name, parseArguments(call.function?.arguments), context);
                    followup.push({role: 'tool', tool_call_id: call.id, name: call.function?.name || 'device_action', content: result});
                }
                sendCompletion(followup, key, cancel, context, depth + 1, done);
                return;
            }
            const reply = assistant?.content?.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            if (!reply) throw new Error('NVIDIA returned no visible answer. Please try again.');
            done(null, reply);
        } catch (error) { if (!cancel.is_cancelled()) done(error, null); }
    });
}

export function assistantPage(page, button, label, context) {
    const intro = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 4});
    intro.add_css_class('assistant-intro');
    const title = label('How can I help today?'); title.add_css_class('chat-title'); intro.append(title);
    const subtitle = label('Ask a question, change a setting, or pin your favourite app.'); subtitle.add_css_class('chat-subtitle'); intro.append(subtitle); page.append(intro);
    const transcript = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 18, margin_start: 18, margin_end: 18, margin_top: 18, margin_bottom: 18});
    const chatScroll = new Gtk.ScrolledWindow({child: transcript, min_content_height: 120, vexpand: true, hscrollbar_policy: Gtk.PolicyType.NEVER});
    chatScroll.add_css_class('assistant-scroll');
    const render = () => {
        while (transcript.get_first_child()) transcript.remove(transcript.get_first_child());
        const messages = conversation.length ? conversation : [{role: 'assistant', content: 'Hello, I’m Kindred. What would you like to do today?\n\nYou can say “pin YouTube to Home” or “make the text bigger”.'}];
        for (const message of messages) {
            const row = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 6, hexpand: false, halign: message.role === 'user' ? Gtk.Align.END : Gtk.Align.START, margin_start: message.role === 'user' ? 64 : 0, margin_end: message.role === 'user' ? 0 : 64});
            row.add_css_class('bubble'); row.add_css_class(message.role === 'user' ? 'bubble-user' : 'bubble-assistant');
            const speaker = label(message.role === 'user' ? 'You' : 'Kindred'); speaker.add_css_class('speaker'); row.append(speaker);
            const content = label(message.content); content.selectable = true; content.wrap_mode = 2; content.max_width_chars = 48; row.append(content); transcript.append(row);
        }
    };
    chatScroll.get_vadjustment().connect('changed', adjustment => adjustment.set_value(Math.max(0, adjustment.upper - adjustment.page_size)));
    render(); page.append(chatScroll);
    const input = new Gtk.Entry({placeholder_text: 'Type what you need', max_length: 4000, hexpand: true}); input.update_property([Gtk.AccessibleProperty.LABEL], ['Message to Kindred']); input.add_css_class('assistant-input');
    const status = label('Ready to help.'); status.add_css_class('assistant-status');
    const optionsBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12});
    if (!readKey()) {
        const setup = new Gtk.Expander({label: 'Set up online answers'});
        const setupBox = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8}); setup.set_child(setupBox); optionsBox.append(setup);
        setupBox.append(label('An administrator can add your NVIDIA key. Larger text and contrast work without it.'));
        const key = new Gtk.PasswordEntry({show_peek_icon: true}); key.update_property([Gtk.AccessibleProperty.LABEL], ['NVIDIA API key']); setupBox.append(key);
        setupBox.append(button('Save API key', () => {
            if (!key.text.trim()) return;
            GLib.mkdir_with_parents(GLib.path_get_dirname(keyPath), 0o700);
            Gio.File.new_for_path(keyPath).replace_contents(key.text.trim(), null, false, Gio.FileCreateFlags.PRIVATE, null);
            key.text = ''; status.label = 'API key saved privately. You can send a message now.';
        }));
    }

    const aloud = new Gtk.CheckButton({label: 'Read replies aloud', active: false}); optionsBox.append(aloud);
    const applyQuickAction = text => {
        const result = localRequest(text, context);
        if (!result) return;
        conversation = [...conversation, {role: 'user', content: text}, {role: 'assistant', content: result}];
        render(); status.label = 'Done.';
    };
    const quick = new Gtk.FlowBox({selection_mode: Gtk.SelectionMode.NONE, row_spacing: 10, column_spacing: 10, homogeneous: false});
    for (const [text, labelText] of [['make the text bigger', 'Larger text'], ['turn on high contrast', 'High contrast'], ['make the volume louder', 'Louder'], ['open sound settings', 'Sound settings']]) {
        const action = button(labelText, () => applyQuickAction(text)); action.add_css_class('quick-action'); quick.append(action);
    }
    optionsBox.append(quick);
    const listen = button('Talk', () => {
        speech?.force_exit(); speech = null;
        listen.sensitive = false; status.label = 'Listening for 10 seconds… Speak clearly. You can edit the words before sending.';
        try {
            const proc = Gio.Subprocess.new(['python3', GLib.build_filenamev([GLib.get_current_dir(), 'scripts', 'voice-input.py'])], Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
            voice = proc;
            proc.communicate_utf8_async(null, null, (_p, res) => {
                try {
                    const [, output] = proc.communicate_utf8_finish(res);
                    if (voice !== proc) return;
                    if (!proc.get_successful()) throw new Error();
                    const result = JSON.parse(output.trim().split('\n').pop());
                    input.text = result.text || ''; status.label = result.error || (result.text ? 'Check these words, then press Send.' : 'No speech heard. Try again or type your message.');
                } catch (_) { status.label = 'Voice input is unavailable. Check your microphone in Sound settings, or type below.'; }
                finally { if (voice === proc) voice = null; listen.sensitive = true; }
            });
        } catch (_) { status.label = 'Voice input is unavailable. You can still type.'; listen.sensitive = true; }
    });
    const composer = new Gtk.Box({spacing: 10}); composer.add_css_class('chat-composer'); composer.append(input); composer.append(listen); listen.set_tooltip_text('Record for 10 seconds, then review the words before sending.');
    const send = button('Send', () => {
        const text = input.text.trim(), key = readKey();
        if (!text || activeCancel) return;
        const pending = [...conversation.slice(-20), {role: 'user', content: text}];
        const localResult = localRequest(text, context);
        if (localResult) {
            conversation = [...pending, {role: 'assistant', content: localResult}]; render(); input.text = ''; status.label = 'Ready for your next message.';
            return;
        }
        if (!key) { status.label = 'Open Voice & chat options to set up online answers.'; return; }
        const cancel = new Gio.Cancellable(); activeCancel = cancel;
        conversation = pending; render(); input.text = '';
        send.sensitive = false; status.label = 'Kindred is thinking…';
        sendCompletion([{role: 'system', content: systemPrompt}, ...pending], key, cancel, context, 0, (error, reply) => {
            if (!error && reply) {
                conversation = [...pending, {role: 'assistant', content: reply}]; render(); status.label = 'Reply ready.';
                if (aloud.active) {
                    speech?.force_exit();
                    try { speech = Gio.Subprocess.new(['espeak-ng', '-s', '145', '--stdin'], Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDERR_SILENCE); speech.communicate_utf8_async(reply, null, (p, r) => { try { p.communicate_utf8_finish(r); } catch (_) {} }); }
                    catch (_) { status.label = 'Reply ready. Spoken audio is unavailable.'; }
                }
            } else if (error && !cancel.is_cancelled()) { status.label = error.message; conversation = pending.slice(0, -1); if (!input.text) input.text = text; render(); }
            if (activeCancel === cancel) activeCancel = null;
            send.sensitive = true;
        });
    }); send.add_css_class('suggested-action'); send.hexpand = false; listen.hexpand = false; composer.append(send); page.append(composer); page.append(status); input.connect('activate', () => send.emit('clicked'));
    optionsBox.append(button('Stop listening / speaking / request', () => { stopAssistant(); listen.sensitive = true; send.sensitive = true; status.label = 'Stopped.'; }));
    optionsBox.append(button('Clear conversation', () => { stopAssistant(); conversation = []; render(); input.text = ''; send.sensitive = true; listen.sensitive = true; status.label = 'Conversation cleared.'; }));
    optionsBox.append(label('Online answers send your message and recent conversation to NVIDIA. Replies may be mistaken. Review important advice.')); const options = button('Voice & chat options', () => {
        if (activeOptions) { activeOptions.present(); return; }
        const dialog = new Gtk.Window({title: 'Kindred — Chat options', transient_for: page.get_root(), modal: true, default_width: 720, default_height: 620});
        activeOptions = dialog;
        const layout = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 16, margin_top: 20, margin_bottom: 20, margin_start: 20, margin_end: 20});
        layout.append(button('Back to chat', () => dialog.hide()));
        layout.append(new Gtk.ScrolledWindow({child: optionsBox, vexpand: true, hscrollbar_policy: Gtk.PolicyType.NEVER}));
        dialog.set_child(layout); dialog.connect('close-request', () => { dialog.hide(); return true; }); dialog.present();
    }); options.add_css_class('assistant-options'); page.append(options); input.grab_focus();
}
