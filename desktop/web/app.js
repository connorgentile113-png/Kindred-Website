import {APP_VERSION,activities,webApps,webAppCategories,initialDocuments,searchItems,safeLoad,updateDecision} from './model.mjs';

const paths={
  home:'M3 11l9-8 9 8M5 10v11h5v-7h4v7h5V10',
  back:'M19 12H5m7-7-7 7 7 7',
  arrow:'M5 12h14m-6-6 6 6-6 6',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  help:'M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 18h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  globe:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2c5 5 5 15 0 20-5-5-5-15 0-20',
  mail:'M3 5h18v14H3zM3 5l9 8 9-8',
  image:'M3 3h18v18H3zM3 17l6-6 5 5 3-3 4 4M8 7h.01',
  file:'M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h6',
  calendar:'M3 5h18v17H3zM7 2v6M17 2v6M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01',
  grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M10 2h4l1 3 3 1 3 1v4l-2 1-1 3 1 3-3 2-3-2-3 1-2 2-3-2 1-3-1-3-2-1V7l3-1 3-1z',
  power:'M12 2v10M6 5a9 9 0 1 0 12 0',
  wifi:'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01',
  sun:'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1',
  heart:'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-4 4 2 10 8 15 6-5 12-11 8-15',
  check:'M4 12l5 5L20 6',
  music:'M9 18V5l12-3v14M9 5l12-3M9 18a3 3 0 1 1-3-3M21 16a3 3 0 1 1-3-3',
  book:'M12 5C8 2 4 2 2 3v17c3-1 7-1 10 2 3-3 7-3 10-2V3c-3-1-7-1-10 2zM12 5v17',
  play:'M6 4l14 8-14 8z',
  video:'M3 5h13v14H3zM16 9l5-4v14l-5-4',
  camera:'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',
  users:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M17 11a3 3 0 1 0 0-6M22 21v-1.5a4.5 4.5 0 0 0-3.5-4.4',
  user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 21a7 7 0 0 1 14 0',
  chat:'M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z',
  map:'M9 3 3 6v15l6-3 6 3 6-3V3l-6 3M9 3v15M15 6v15',
  news:'M4 4h13v16H4zM17 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h5',
  shopping:'M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0',
  cloud:'M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.5 1.5A3.5 3.5 0 0 1 17 18z',
  refresh:'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5',
  download:'M12 3v12m-5-5 5 5 5-5M5 21h14',
  close:'M6 6l12 12M18 6 6 18',
  send:'M4 12l16-8-6 16-3-6z',
  sparkle:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  box:'M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10'
};
const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.grid}"/></svg>`;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let documents=safeLoad(localStorage,'kindred-documents',initialDocuments);
if(!Array.isArray(documents)||!documents.every(d=>d&&typeof d.id==='string'&&typeof d.title==='string'&&typeof d.text==='string'))documents=initialDocuments.map(d=>({...d}));
let settings=safeLoad(localStorage,'kindred-settings',{scale:1,contrast:false,pointer:false});
if(!settings||typeof settings!=='object')settings={scale:1,contrast:false,pointer:false};
let conversation=safeLoad(localStorage,'kindred-conversation',[]);
if(!Array.isArray(conversation))conversation=[];
let current={page:'home'},history=[],online=true,storeFilter='All',lastUpdate=null,updateChecking=false;
let deleted=safeLoad(localStorage,'kindred-deleted',[]);
if(!Array.isArray(deleted))deleted=[];

function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{announce('Your changes could not be saved. Keep this screen open and copy your work before leaving.');return false;}}
function announce(text){document.getElementById('announcement').textContent=text;}
function navigate(page,id){history.push({...current});current={page,id};render(true);}
function heading(title,description){return `<div class="page-heading"><p class="eyebrow">YOUR KINDRED</p><h1>${title}</h1><p>${description}</p></div>`;}
function row(title,description,action,ico='file',id=''){return `<button class="row" data-action="${action}" data-id="${escape(id)}"><span class="icon-box sage">${icon(ico)}</span><span><h3>${escape(title)}</h3><p>${escape(description)}</p></span>${icon('arrow')}</button>`;}
const landscape=`<svg class="landscape" viewBox="0 0 270 150" aria-hidden="true"><circle cx="175" cy="51" r="30" fill="#d8b971"/><path d="M2 132Q70 42 150 107Q215 45 270 96V150H2Z" fill="#cad5b7"/><path d="M0 149Q57 89 139 131Q216 93 270 130V150Z" fill="#9fb398"/><path d="M45 149Q131 92 197 150" fill="#e9eee2"/><path d="M35 80V137M35 110L19 96M35 99L51 83" stroke="#748f71" stroke-width="3" fill="none"/><path d="M231 79v49M231 104l-12-14M231 96l13-13" stroke="#748f71" stroke-width="3" fill="none"/></svg>`;

// ---- Apps ---------------------------------------------------------------
function appStoreGrid(){
  const apps=storeFilter==='All'?webApps:webApps.filter(a=>a.category===storeFilter);
  return `<div class="store-categories">${['All',...webAppCategories].map(c=>`<button class="chip ${storeFilter===c?'active':''}" data-action="filter" data-id="${escape(c)}">${escape(c)}</button>`).join('')}</div>
  <div class="store-grid">${apps.map(a=>`<button class="store-app" data-action="open-app" data-id="${a.id}">
    <span class="store-icon" style="background:${a.color}">${icon(a.icon)}</span>
    <h3>${escape(a.name)}</h3><p>${escape(a.description)}</p>
    <span class="store-open">Open ${escape(a.name)} ${icon('arrow')}</span>
  </button>`).join('')}</div>`;
}
function appWindow(app){
  return `<div class="app-wrapper" role="dialog" aria-label="${escape(app.name)}">
    <div class="app-wrapper-bar">
      <button class="app-wrapper-btn primary" data-action="back">${icon('back')}Back</button>
      <button class="app-wrapper-btn" data-action="home">${icon('home')}<span>Home</span></button>
      <button class="app-wrapper-btn" data-action="reload">${icon('refresh')}<span>Reload</span></button>
      <div class="app-wrapper-title"><span class="store-icon" style="background:${app.color};width:40px;height:40px;border-radius:12px">${icon(app.icon)}</span>${escape(app.name)}</div>
      <a class="app-wrapper-btn" href="${app.url}" target="_blank" rel="noopener noreferrer">${icon('globe')}<span>New window</span></a>
    </div>
    <iframe class="app-wrapper-frame" src="${app.url}" title="${escape(app.name)}" allow="fullscreen; microphone; camera; clipboard-write" referrerpolicy="no-referrer"></iframe>
  </div>`;
}

// ---- Assistant ----------------------------------------------------------
const assistantWelcome={role:'assistant',content:'Hello. I am Kindred, your helper. Ask me anything, or choose one of the suggestions below. I can open apps, make the text bigger, and answer questions.'};
function chatReply(text){
  const q=text.toLowerCase();
  const findApp=webApps.find(a=>q.includes(a.name.toLowerCase().split(' ')[0]));
  if(/(bigger|larger|increase).*(text|word)|(text|word).*(bigger|larger)/.test(q)){settings.scale=1.3;save('kindred-settings',settings);applySettings();return{reply:'Done — I made the text larger. You can change it back any time in Settings.',action:null};}
  if(/(smaller|reduce).*(text|word)|(text|word).*(smaller)/.test(q)){settings.scale=1;save('kindred-settings',settings);applySettings();return{reply:'Done — the text is back to a comfortable size.',action:null};}
  if(/contrast/.test(q)&&/(on|enable|more|stronger)/.test(q)){settings.contrast=true;save('kindred-settings',settings);applySettings();return{reply:'High contrast is on. Everything should stand out more clearly now.',action:null};}
  if(/contrast/.test(q)&&/(off|disable|less)/.test(q)){settings.contrast=false;save('kindred-settings',settings);applySettings();return{reply:'High contrast is off.',action:null};}
  if(/(open|show|go to|launch).*(app|store)/.test(q)||/app store/.test(q)){return{reply:'Opening the App store for you. It has the apps people already know — YouTube, Instagram, Facebook, Gmail and more.',action:{name:'apps'}};}
  if(findApp&&/(open|show|go to|launch|play|watch|use)/.test(q)){return{reply:`Opening ${findApp.name} in a friendly window, with a big Back button at the top.`,action:{name:'open-app',id:findApp.id}};}
  if(/(what can you do|help me|what do you do)/.test(q)){return{reply:'I can open apps for you, make the text bigger or smaller, turn contrast on, find your documents, and answer simple questions. If I am not sure, I will say so.',action:null};}
  if(/(hello|hi|hey|good morning|good afternoon|good evening)/.test(q)){return{reply:'Hello! It is lovely to hear from you. What would you like to do today?',action:null};}
  if(/(thank|thanks)/.test(q)){return{reply:'You are very welcome. I am always here when you need me.',action:null};}
  if(/(app|youtube|instagram|facebook|gmail|netflix|spotify)/.test(q)){return{reply:'You can find that in the App store. Choose Apps in the top bar, and everything is one big button away.',action:{name:'apps'}};}
  if(/(document|letter|note)/.test(q)){return{reply:'Your documents are safe in the Documents area. Would you like me to take you there?',action:{name:'documents'}};}
  return{reply:'I want to help, but I did not quite understand. You could try “open YouTube”, “make the text bigger”, or “what can you do?”.',action:null};
}
function chatView(){
  const messages=[assistantWelcome,...conversation];
  return `<div class="chat">
    <div class="chat-scroll" id="chat-scroll">${messages.map(m=>`<div class="msg ${m.role==='user'?'user':'assistant'}">
      <span class="msg-avatar">${m.role==='user'?icon('user'):icon('sparkle')}</span>
      <div class="msg-bubble">${escape(m.content)}</div></div>`).join('')}${updateChecking?`<div class="msg assistant msg-typing"><span class="msg-avatar">${icon('sparkle')}</span><div class="msg-bubble">Kindred is typing…</div></div>`:''}</div>
    <div class="chat-suggestions">${[['Open YouTube','open YouTube'],['Make the text bigger','make the text bigger'],['What can you do?','what can you do'],['Open the App store','open the app store']].map(([labelText,text])=>`<button class="chip" data-action="chat-say" data-id="${escape(text)}">${escape(labelText)}</button>`).join('')}</div>
    <div class="chat-input"><input id="chat-input" aria-label="Type a message to Kindred" placeholder="Type your message…" autocomplete="off" maxlength="4000"><button class="chat-send" data-action="chat-send">${icon('send')}Send</button></div>
    <p class="chat-status" id="chat-status" role="status">Ready. Your conversation stays on this computer until you clear it.</p>
    <div class="chat-suggestions"><button class="chip" data-action="chat-clear">Clear conversation</button><button class="chip" data-action="open-app" data-id="youtube">${icon('play')}Try an app</button></div>
  </div>`;
}
function sendChat(text){
  const value=String(text||'').trim();
  if(!value)return;
  conversation.push({role:'user',content:value});
  const {reply,action}=chatReply(value);
  conversation.push({role:'assistant',content:reply});
  save('kindred-conversation',conversation);
  render(true);
  if(action)setTimeout(()=>action.name==='open-app'?openApp(action.id):navigate(action.name),600);
}

// ---- Updates ------------------------------------------------------------
async function checkForUpdates(interactive){
  updateChecking=true;
  if(interactive)render(true);
  try{
    const res=await fetch('/updates/version',{cache:'no-store'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const release=await res.json();
    lastUpdate={...updateDecision(APP_VERSION,release),error:null,checkedAt:new Date()};
  }catch(error){
    lastUpdate={update:false,required:false,current:APP_VERSION,error:'The update service could not be reached. Your Kindred still works normally.',checkedAt:new Date()};
  }
  updateChecking=false;
  render(true);
  if(interactive){
    const status=document.getElementById('update-status');
    if(status)status.textContent=lastUpdate.error?'Could not check for updates. Please try again later.':(lastUpdate.update?`Kindred ${lastUpdate.latest} is available.`:'Kindred is up to date.');
  }
}
function updateBanner(){
  if(!lastUpdate||!lastUpdate.update)return '';
  return `<div class="update-banner"><strong>${icon('download')} Kindred ${escape(lastUpdate.latest)} is ready.</strong><p>${escape(lastUpdate.notes||'A new version is available with improvements and fixes.')}</p><button class="primary" data-action="install-update">Update now</button></div>`;
}

// ---- Home ---------------------------------------------------------------
function home(){const now=new Date();const hour=now.getHours();return `<div class="greeting"><div><p class="eyebrow">A LITTLE SIMPLER. A LITTLE MORE YOU.</p><h1>Good ${hour<12?'morning':hour<17?'afternoon':'evening'}.</h1><p class="intro">You’re home. What would you like to do?</p></div><p class="date">${now.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</p></div>${updateBanner()}<div class="welcome"><div><h2>Your day, at your own pace.</h2><p>Catch up with someone, revisit a memory,<br>or discover something new. Start here.</p></div>${landscape}</div><div class="section-title"><h2>What would you like to do?</h2><span>Choose anything. You can always come home.</span></div><div class="activities">${activities.map(a=>`<button class="activity" data-action="${a.id}"><span class="icon-box ${a.color}">${icon(a.icon)}</span><span class="arrow">${icon('arrow')}</span><h3>${a.name}</h3><p>${a.description}</p></button>`).join('')}</div><div class="lower"><button class="weather" data-action="weather">${icon('sun','sun')}<div><strong>72° <span style="font-size:.85rem">&nbsp; Sunny</span></strong><p>A lovely day to step outside · Sample forecast</p></div><span class="weather-link">Tomorrow ${icon('arrow')}</span></button><button class="help-card" data-action="assistant">${icon('sparkle')}<div><h3>Ask Kindred for help.</h3><p>Your assistant, ready to chat.</p></div>${icon('arrow')}</button></div>`;}

function content(){switch(current.page){
case 'home':return home();
case 'documents':return heading('Your documents','Letters, recipes, and the things you want to keep.')+`<div class="toolbar"><button class="primary" data-action="new">${icon('file')}Create a document</button>${deleted.length?'<button class="secondary" data-action="undo">Undo deletion</button>':''}</div><div class="rows">${documents.map(d=>row(d.title,`${d.category||'Other things'} · ${d.modified||'Today'}`,'open','file',d.id)).join('')||'<div class="empty">Your documents will appear here. Choose “Create a document” to begin.</div>'}</div>`;
case 'editor':{const d=documents.find(d=>d.id===current.id);if(!d)return heading('This document is no longer here.','Your other documents are safe. Go Back to find them.');return heading('Your document','Take your time. Your changes are saved as you type.')+`<div class="panel"><div class="field"><label for="document-title">Document name</label><input id="document-title" value="${escape(d.title)}"></div><div class="field"><label for="document-text">Your words</label><textarea id="document-text">${escape(d.text)}</textarea></div><p id="save-state" role="status">${icon('check')} Saved on this computer</p></div><div class="toolbar"><button class="primary" data-action="documents">Done · Back to documents</button><button class="secondary" data-action="delete">Move to recently deleted</button></div>`;}
case 'search':return heading('Find something','A few words are all you need. Look for an activity, an app, or one of your documents.')+`<div class="search-box">${icon('search')}<input id="search" type="search" aria-label="Find something" placeholder="Try “recipes”, “youtube” or “email”…" autocomplete="off"></div><div id="results" class="rows" aria-live="polite"><p class="empty">What would you like to find?</p></div>`;
case 'apps':return heading('App store','The apps people already know. Tap one and it opens in a friendly window.')+appStoreGrid();
case 'app':{const app=webApps.find(a=>a.id===current.id);return app?appWindow(app):heading('That app is not here.','Go Back to the App store to choose another one.');}
case 'assistant':return heading('Your Kindred assistant','Ask me anything. I can open apps, change how things look, and help you find your way.')+chatView();
case 'settings':return heading('Make yourself comfortable','A few simple changes can make your computer feel more like you.')+`<div class="panel"><div class="setting"><div><h2>Text size</h2><p>Make the words easier to read.</p></div><select id="text-size" aria-label="Text size"><option value="1" ${settings.scale===1?'selected':''}>Comfortable</option><option value="1.15" ${settings.scale===1.15?'selected':''}>Larger</option><option value="1.3" ${settings.scale===1.3?'selected':''}>Largest</option></select></div><div class="setting"><div><h2>Stronger contrast</h2><p>Make text and outlines stand out.</p></div><button class="toggle" data-action="contrast" aria-pressed="${!!settings.contrast}">${settings.contrast?'On · Turn off':'Off · Turn on'}</button></div><div class="setting"><div><h2>Bigger pointer</h2><p>Make the pointer easier to see.</p></div><button class="toggle" data-action="pointer" aria-pressed="${!!settings.pointer}">${settings.pointer?'On · Turn off':'Off · Turn on'}</button></div><div class="setting"><div><h2>Updates</h2><p>Kindred version ${APP_VERSION}. ${lastUpdate&&!lastUpdate.error&&lastUpdate.latest?`Latest available: ${escape(lastUpdate.latest)}.`:'Check for the newest version.'}</p></div><button class="toggle" data-action="check-updates">${updateChecking?'Checking…':'Check for updates'}</button></div><p class="chat-status" id="update-status" role="status"></p></div>`;
case 'help':return heading('Your Kindred assistant','Ask me anything. I can open apps, change how things look, and help you find your way.')+chatView();
case 'network':return heading('Let’s get you connected',online?'Your Internet connection is ready.':'The Internet is disconnected. Your documents are safe.')+`<div class="panel"><h2>${online?'You’re connected':'Your work is still here'}</h2><p class="notice">${online?'You can return to Internet and choose a website.':'Nothing has been lost. Choose “Reconnect” to restore the sample connection.'}</p><div class="toolbar"><button class="primary" data-action="reconnect">${online?'Back to Internet':'Reconnect'}</button><button class="secondary" data-action="disconnect">Try a disconnected connection</button></div><p class="intro">This preview uses a sample connection. Your computer’s connection will stay as it is.</p></div>`;
case 'printer':return heading('Let’s check your printer','Your documents are safe, even when the printer doesn’t respond.')+`<div class="panel"><h2>Try these steps</h2><ol><li>Make sure the printer is turned on.</li><li>Check that there is paper in the tray.</li><li>Check the cable or the printer’s Wi-Fi connection.</li></ol><p class="notice">Printing isn’t connected in this preview. You can keep editing and save your document.</p><button class="primary" data-action="documents">Go to your documents</button></div>`;
case 'sound':return heading('Let’s check the sound','Start with these simple steps.')+`<div class="panel"><ol><li>Check that your speakers or headphones are connected.</li><li>Look for a volume control on your speakers.</li><li>Make sure your headphones are charged.</li></ol><p class="notice">Sound controls aren’t connected in this preview. Your computer’s volume stays as it is.</p><button class="primary" data-action="assistant">Ask Kindred for help</button></div>`;
case 'reassurance':return heading('You’re in a safe place.','It’s okay to try things. Your documents are still here.')+`<div class="panel"><h2>Let’s start again, together.</h2><p class="notice">Home is always here. If you deleted a document, go to Documents and choose “Undo deletion” to restore your most recently deleted document.</p><button class="primary" data-action="home">${icon('home')}Go Home</button></div>`;
case 'internet':return heading('A window to the world','Choose a familiar place, or enter a website you’d like to visit.')+(online?`<div class="panel"><form id="website-form"><div class="field"><label for="website">Website address</label><input id="website" placeholder="For example, wikipedia.org" required></div><button class="primary" type="submit">Visit website ${icon('arrow')}</button></form><p id="website-error" role="status"></p></div><div class="tiles">${[['YouTube','Watch videos and music','https://www.youtube.com'],['Wikipedia','Explore something new','https://www.wikipedia.org'],['BBC News','Read the latest news','https://www.bbc.com']].map(([t,d,u])=>`<a class="row" href="${u}" target="_blank" rel="noopener noreferrer"><span class="icon-box blue">${icon('globe')}</span><span><h3>${t}</h3><p>${d} · Opens in a Kindred window</p></span>${icon('arrow')}</a>`).join('')}</div>`:`<div class="notice">The Internet is disconnected. Your documents are safe.</div><button class="primary" data-action="network">Help me reconnect</button>`);
case 'email':return heading('Stay in touch','Write a little note to someone you care about.')+`<div class="panel"><form id="email-form"><div class="field"><label for="recipient">Their email address</label><input id="recipient" type="email" placeholder="someone@example.com" required></div><div class="field"><label for="subject">Subject</label><input id="subject" required></div><div class="field"><label for="message">Your message</label><textarea id="message" required></textarea></div><button class="primary" type="submit">Open in your email app ${icon('arrow')}</button><p class="intro">You can review and send it in your email app. An email account is needed.</p><p id="email-status" role="status"></p></form></div>`;
case 'photos':return heading('A home for your memories','Choose a photo from your computer to enjoy it here.')+`<div class="panel"><div class="field"><label for="photo-picker">Choose a photo</label><input id="photo-picker" type="file" accept="image/*"></div><p class="intro">Your photo stays on this computer.</p><div id="photo-view"></div></div>`;
case 'calendar':return heading('Your calendar','A little space for the things you’re looking forward to.')+`<div class="panel"><p class="eyebrow">SAMPLE EVENT</p><div class="calendar-day"><span class="day-number">12</span><div><h2>Lunch with the family</h2><p>Sunday, October 12 · 12:30 PM</p></div></div><p class="notice">This is a sample calendar. Your own calendar hasn’t been connected yet.</p></div>`;
case 'weather':return heading('A look at tomorrow','A little help planning your day.')+`<div class="panel"><p class="eyebrow">SAMPLE FORECAST · NOT LIVE WEATHER</p><div class="calendar-day">${icon('sun','sun')}<div><h2>Tomorrow · 70°</h2><p>Partly sunny. A light jacket might be nice.</p></div></div><p class="notice">Connect a weather service and choose your town to see a real forecast.</p></div>`;
case 'more':return heading('More things to enjoy','There’s always something new to spend a little time with.')+`<div class="rows">${row('Music','Listen to a favorite song.','open-app','music','spotify')}${row('Books','Find a new story to get lost in.','books','book')}${row('Games','A little challenge, at your own pace.','games','grid')}${row('App store','The apps people already know.','apps','box')}</div>`;
case 'music':case 'books':case 'games':return heading({music:'A little music',books:'Find your next story',games:'Time for a little fun'}[current.page],'Choose something to explore.')+`<div class="panel"><p class="notice">This activity opens a familiar app in a Kindred window, with a big Back button at the top.</p><div class="toolbar"><button class="primary" data-action="open-app" data-id="${current.page==='music'?'spotify':current.page==='books'?'wikipedia':'youtube'}">Explore ${current.page} ${icon('arrow')}</button><button class="secondary" data-action="apps">Open the App store</button></div></div>`;
case 'power':return heading('Finished for now?','Make sure you have everything you need before you leave.')+`<div class="panel"><h2>Your saved documents will be here.</h2><p class="notice">This is a safe preview. Your computer will stay on.</p><div class="toolbar"><button class="primary" data-action="finish">Finish preview</button><button class="secondary" data-action="home">Keep using Kindred</button></div></div>`;
case 'finished':return heading('See you again soon.','Your saved documents are waiting for you.')+`<div class="panel"><p class="notice">The preview is resting. Your computer is still on.</p><button class="primary" data-action="home">Return Home</button></div>`;
default:return home();}}

function applySettings(){document.documentElement.style.setProperty('--scale',[1,1.15,1.3].includes(settings.scale)?settings.scale:1);document.body.classList.toggle('contrast',!!settings.contrast);document.body.classList.toggle('large-pointer',!!settings.pointer);}

function render(focus=false){applySettings();const title={home:'Home',editor:'Documents',search:'Find something',settings:'Settings',help:'Your assistant',assistant:'Your assistant',apps:'App store',app:webApps.find(a=>a.id===current.id)?.name||'App',more:'More things to do'}[current.page]||current.page.charAt(0).toUpperCase()+current.page.slice(1);document.title=`Kindred OS — ${title}`;
const canGoBack=history.length>0;
document.getElementById('app').innerHTML=`<div class="shell"><aside class="sidebar" aria-label="Main navigation"><div class="brand"><svg class="brand-mark" viewBox="0 0 36 36" aria-hidden="true"><path d="M7 27V9m0 9 10-9M7 18l10 9M23 10v17m0-9 7-8m-7 8 7 9"/></svg><div>kindred<small>FEEL AT HOME</small></div></div><nav class="nav">${[['home','Home'],['apps','Apps'],['assistant','Assistant'],['search','Find something']].map(([a,t])=>`<button data-action="${a}" ${current.page===a?'class="active" aria-current="page"':''}>${icon(a==='assistant'?'sparkle':a)}${t}</button>`).join('')}</nav><div class="side-bottom"><button data-action="settings">${icon('settings')}Settings</button><button data-action="power">${icon('power')}Turn off computer</button><div class="sidebar-note">A familiar place.<br>A little peace of mind.</div></div></aside><div class="workspace"><header class="topbar"><button class="topbar-back" data-action="back" ${canGoBack?'':'disabled'} aria-label="Go back">${icon('back')}Back</button><div class="breadcrumb">${icon(current.page==='home'?'home':'grid')}<span>${escape(title)}</span></div><div class="status"><span class="connected">${icon(online?'wifi':'help')}${online?'Connected':'Disconnected'}</span><span>${new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span></div></header><main id="main" class="main" tabindex="-1">${content()}<footer class="footer"><span>${icon('heart')}Made for life. Made for you.</span><span>Kindred OS · A safe preview</span></footer></main></div></div>`;
if(focus){document.getElementById('main').focus({preventScroll:true});window.scrollTo(0,0);}
const scroll=document.getElementById('chat-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight;
bind();}

function bind(){
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>action(button.dataset.action,button.dataset.id)));
  document.getElementById('search')?.addEventListener('input',e=>{const results=searchItems(e.target.value,documents);document.getElementById('results').innerHTML=results.length?results.map(r=>row(r.name,`${r.type} · ${r.description}`,(r.type==='Document'?'open':r.type==='App'?'open-app':r.id),r.icon||'file',r.id)).join(''):`<p class="empty">${e.target.value.trim()?'Nothing found yet. Try a different word, or ask Kindred for help.':'What would you like to find?'}</p>`;document.querySelectorAll('#results [data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action,b.dataset.id));});
  ['document-title','document-text'].forEach(id=>document.getElementById(id)?.addEventListener('input',e=>{const d=documents.find(d=>d.id===current.id);d[id==='document-title'?'title':'text']=e.target.value;d.modified='Today';const saved=save('kindred-documents',documents);document.getElementById('save-state').textContent=saved?'✓ Saved on this computer':'Unable to save. Keep this screen open and copy your words before leaving.';}));
  document.getElementById('text-size')?.addEventListener('change',e=>{settings.scale=Number(e.target.value);save('kindred-settings',settings);applySettings();announce('Text size changed.');});
  document.getElementById('chat-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendChat(e.target.value);}});
  document.getElementById('website-form')?.addEventListener('submit',e=>{e.preventDefault();const address=document.getElementById('website').value.trim();try{const url=new URL(/^[a-z]+:/i.test(address)?address:`https://${address}`);if(!['https:','http:'].includes(url.protocol)||!url.hostname.includes('.'))throw new Error();window.open(url.href,'_blank','noopener,noreferrer');document.getElementById('website-error').textContent='Your website opens in a new window. Kindred stays here.';}catch{document.getElementById('website-error').textContent='That address doesn’t look right. Your work is safe. Try an address like wikipedia.org.';}});
  document.getElementById('email-form')?.addEventListener('submit',e=>{e.preventDefault();const recipient=document.getElementById('recipient').value,subject=document.getElementById('subject').value,message=document.getElementById('message').value;window.location.href=`mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;document.getElementById('email-status').textContent='Your note is ready for your email app. If it didn’t open, make sure an email app is set up. Your words are still here.';});
  document.getElementById('photo-picker')?.addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;if(!file.type.startsWith('image/')){announce('Please choose a photo.');return;}const url=URL.createObjectURL(file);const img=new Image();img.alt=file.name;img.style.cssText='max-width:100%;max-height:500px;border-radius:12px;margin-top:24px';img.onload=()=>URL.revokeObjectURL(url);img.onerror=()=>{URL.revokeObjectURL(url);document.getElementById('photo-view').textContent='This photo couldn’t be opened. The original is safe. Try another photo.';};img.src=url;document.getElementById('photo-view').replaceChildren(img);});
}
function openApp(id){const app=webApps.find(a=>a.id===id);if(!app)return;navigate('app',id);}
function action(name,id){
  if(name==='back'){current=history.pop()||{page:'home'};render(true);return;}
  if(name==='home'){current={page:'home'};history=[];render(true);return;}
  if(name==='open'){navigate('editor',id);return;}
  if(name==='open-app'){openApp(id);return;}
  if(name==='reload'){render(true);return;}
  if(name==='filter'){storeFilter=id||'All';render(true);return;}
  if(name==='chat-say'){sendChat(id);return;}
  if(name==='chat-send'){sendChat(document.getElementById('chat-input')?.value);return;}
  if(name==='chat-clear'){conversation=[];save('kindred-conversation',conversation);render(true);announce('Conversation cleared.');return;}
  if(name==='check-updates'||name==='install-update'){checkForUpdates(true);return;}
  if(name==='new'){const d={id:globalThis.crypto?.randomUUID?.()||`document-${Date.now()}`,title:'Untitled document',category:'Letters',text:'',modified:'Today'};documents.push(d);save('kindred-documents',documents);navigate('editor',d.id);return;}
  if(name==='delete'){deleted.push({...documents.find(d=>d.id===current.id)});save('kindred-deleted',deleted);documents=documents.filter(d=>d.id!==current.id);save('kindred-documents',documents);current={page:'documents'};render(true);announce('Document moved to recently deleted. You can undo this.');return;}
  if(name==='undo'){if(deleted.length){documents.push(deleted.pop());save('kindred-documents',documents);save('kindred-deleted',deleted);}render();announce('Your document has been restored.');return;}
  if(name==='contrast'||name==='pointer'){settings[name]=!settings[name];save('kindred-settings',settings);render();document.querySelector(`[data-action="${name}"]`)?.focus();return;}
  if(name==='disconnect'){online=false;render();return;}
  if(name==='reconnect'){online=true;navigate('internet');return;}
  if(name==='finish'){navigate('finished');return;}
  navigate(name);
}
// A link may open Kindred straight to a screen, which the install page uses.
const params=new URLSearchParams(location.search);
const requested=params.get('page');
if(['home','documents','search','settings','apps','assistant','help','internet','more'].includes(requested))current={page:requested==='help'?'assistant':requested};
if(params.get('app')&&webApps.some(a=>a.id===params.get('app')))current={page:'app',id:params.get('app')};
render();
checkForUpdates(false);
