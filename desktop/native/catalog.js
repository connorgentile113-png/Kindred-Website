// Curated Debian applications. Commands are fixed, never supplied by the assistant.
export const catalog = [
    {name: "Solitaire", command: "/usr/games/sol", category: "Games", description: "Play Klondike and other card games."},
    {name: "Chess", command: "/usr/games/gnome-chess", category: "Games", description: "Play against the computer or a friend."},
    {name: "Sudoku", command: "/usr/games/gnome-sudoku", category: "Games", description: "A quiet number puzzle. Start with Easy and take your time."},
    {name: "Music", command: "rhythmbox", category: "Listen & watch", description: "Listen to music from the Music folder and Internet radio."},
    {name: "Podcasts", command: "gpodder", category: "Listen & watch", description: "Subscribe to podcasts and listen to downloaded episodes."},
    {name: "Movies", command: "vlc", category: "Listen & watch", description: "Watch a movie with subtitles and clear audio controls."},
    {name: "App store", command: "gnome-software", category: "Tools", description: "Discover Debian and Flathub apps. Check each publisher and permissions."},
];

// Real, everyday apps people already know. Each opens in Kindred's friendly
// wrapper window; video services use Firefox for broader playback support.
export const webApps = [
    {name: "YouTube", url: "https://www.youtube.com", category: "Watch & listen", description: "Watch videos, music and how-to clips."},
    {name: "Netflix", url: "https://www.netflix.com", category: "Watch & listen", description: "Watch films and series."},
    {name: "Spotify", url: "https://open.spotify.com", category: "Watch & listen", description: "Listen to music and podcasts."},
    {name: "Instagram", url: "https://www.instagram.com", category: "Keep in touch", description: "Share and see photos with friends."},
    {name: "Facebook", url: "https://www.facebook.com", category: "Keep in touch", description: "Catch up with family and friends."},
    {name: "WhatsApp", url: "https://web.whatsapp.com", category: "Keep in touch", description: "Send messages and photos."},
    {name: "Gmail", url: "https://mail.google.com", category: "Keep in touch", description: "Read and send email in your browser."},
    {name: "Google Maps", url: "https://maps.google.com", category: "Everyday", description: "Find places and get directions."},
    {name: "Wikipedia", url: "https://www.wikipedia.org", category: "Everyday", description: "Look up anything, free."},
    {name: "Amazon", url: "https://www.amazon.com", category: "Everyday", description: "Shop and reorder essentials."},
    {name: "BBC News", url: "https://www.bbc.com", category: "Everyday", description: "Trusted news from around the world."},
];
