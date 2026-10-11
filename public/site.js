// Screenshots are images of the installed OS, never a simulated desktop.
const screens = {
  home: {src: '/assets/home.png', alt: 'Kindred Home with six familiar activities and a pinned YouTube shortcut.', caption: 'Your familiar activities, with your favourite apps pinned above them. Screenshots show the actual desktop; this website does not run the OS.'},
  assistant: {src: '/assets/assistant.png', alt: 'Kindred assistant with readable conversation bubbles and a message, Talk and Send bar.', caption: 'A calm conversation, with your message controls always in reach. Simple settings and Home pinning work locally; online answers require an NVIDIA key.'}
};
for (const button of document.querySelectorAll('[data-screen]')) {
  button.addEventListener('click', () => {
    const screen = screens[button.dataset.screen];
    if (!screen) return;
    const image = document.querySelector('#showcase-image');
    image.src = screen.src; image.alt = screen.alt;
    document.querySelector('#showcase-caption').textContent = screen.caption;
    for (const choice of document.querySelectorAll('[data-screen]')) choice.setAttribute('aria-pressed', String(choice === button));
  });
}
const text = (selector, value) => document.querySelectorAll(selector).forEach(element => { element.textContent = value; });
const safeReleaseLink = value => typeof value === 'string' && value.startsWith('https://github.com/connorgentile113-png/Kindred-Website/') && !/[?#]/.test(value);
fetch('/release.json', {cache: 'no-store'}).then(response => {
  if (!response.ok) throw new Error('Release information unavailable');
  return response.json();
}).then(release => {
  if (!/^\d+\.\d+\.\d+$/.test(release.version)) throw new Error('Invalid release');
  text('[data-version]', `Kindred ${release.version}`); text('[data-version-number]', release.version);
  const links = {iso: release.iso.url, 'iso-checksum': release.iso.checksumUrl, application: release.application.url, 'application-checksum': release.application.checksumUrl};
  for (const [name, url] of Object.entries(links)) {
    if (!safeReleaseLink(url)) throw new Error('Invalid download link');
    document.querySelectorAll(`[data-download="${name}"]`).forEach(link => { link.href = url; });
  }
  if (safeReleaseLink(release.releaseUrl)) document.querySelectorAll('[data-release-link]').forEach(link => { link.href = release.releaseUrl; });
  if (release.downloadsPublic) text('#release-status', 'Public download · No GitHub sign-in needed. Back up your files before installing.');
  else text('#release-status', 'Public downloads are being prepared. Please check release notes for availability.');
  text('[data-download-size]', `${(release.iso.sizeBytes / 1e9).toFixed(1)} GB`);
  if (/^[a-f0-9]{64}$/.test(release.iso.sha256)) text('[data-iso-hash]', release.iso.sha256);
  text('[data-iso-command]', `sha256sum -c kindred-os-${release.version}-amd64.iso.sha256`);
  const appVersion = release.application.version || release.version;
  if (!/^\d+\.\d+\.\d+$/.test(appVersion)) throw new Error('Invalid application release');
  text('[data-upgrade-command]', `sha256sum -c kindred-update-${appVersion}.tar.gz.sha256\nmkdir kindred-upgrade\ntar xzf kindred-update-${appVersion}.tar.gz -C kindred-upgrade\ncd kindred-upgrade\nsudo bash scripts/upgrade-existing.sh`);
}).catch(() => { text('#release-status', 'Release information could not load. Use the release notes to find downloads and checksums.'); });

// Only appearance is stored. Blocked browser storage still permits reading controls.
const readingKey = 'kindred-website-reading-v1';
let reading = {size: 'comfortable', contrast: false};
let readingStorageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(readingKey));
  if (saved && ['comfortable', 'larger', 'largest'].includes(saved.size)) {
    reading = {size: saved.size, contrast: saved.contrast === true};
  }
} catch (_) { readingStorageAvailable = false; }
function applyReading(saveSettings = false) {
  document.documentElement.dataset.readingSize = reading.size;
  document.documentElement.dataset.readingContrast = String(reading.contrast);
  for (const button of document.querySelectorAll('button[data-reading-size]')) {
    button.setAttribute('aria-pressed', String(button.dataset.readingSize === reading.size));
  }
  document.querySelector('button[data-reading-contrast]')?.setAttribute('aria-pressed', String(reading.contrast));
  if (saveSettings) {
    try { localStorage.setItem(readingKey, JSON.stringify(reading)); }
    catch (_) { readingStorageAvailable = false; }
    text('[data-reading-status]', `Text: ${reading.size}. Stronger contrast: ${reading.contrast ? 'on' : 'off'}.${readingStorageAvailable ? ' Reading settings saved on this browser.' : ' Settings work on this page, but this browser cannot save them.'}`);
  }
}
applyReading();
for (const bar of document.querySelectorAll('[data-reading-bar]')) bar.hidden = false;
for (const button of document.querySelectorAll('button[data-reading-size]')) {
  button.addEventListener('click', () => { reading.size = button.dataset.readingSize; applyReading(true); });
}
 document.querySelector('button[data-reading-contrast]')?.addEventListener('click', () => { reading.contrast = !reading.contrast; applyReading(true); });
document.querySelector('[data-reading-reset]')?.addEventListener('click', () => { reading = {size: 'comfortable', contrast: false}; applyReading(true); });
