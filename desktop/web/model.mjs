export const APP_VERSION = '0.4.0';
export const RELEASE_REPO = 'connorgentile113-png/Kindred-OS';

export const activities = [
  {id:'internet',name:'Internet',description:'Visit your favorite places',icon:'globe',color:'blue'},
  {id:'email',name:'Email',description:'Keep in touch with people',icon:'mail',color:'rose'},
  {id:'photos',name:'Photos',description:'A home for your memories',icon:'image',color:'gold'},
  {id:'documents',name:'Documents',description:'Your letters, recipes & more',icon:'file',color:'sage'},
  {id:'calendar',name:'Calendar',description:'See what’s coming up',icon:'calendar',color:'lavender'},
  {id:'more',name:'More things to do',description:'Music, games, books & more',icon:'grid',color:'sand'}
];

// Real, everyday apps people already know. Kindred opens each one inside a
// friendly wrapper with a big Back button, so no one has to learn a new layout.
export const webApps = [
  {id:'youtube',name:'YouTube',description:'Watch videos, music and how-to clips',url:'https://www.youtube.com',category:'Watch & listen',color:'#e5322d',icon:'play'},
  {id:'netflix',name:'Netflix',description:'Watch films and series',url:'https://www.netflix.com',category:'Watch & listen',color:'#e50914',icon:'video'},
  {id:'spotify',name:'Spotify',description:'Listen to music and podcasts',url:'https://open.spotify.com',category:'Watch & listen',color:'#1db954',icon:'music'},
  {id:'instagram',name:'Instagram',description:'Share and see photos with friends',url:'https://www.instagram.com',category:'Keep in touch',color:'#c13584',icon:'camera'},
  {id:'facebook',name:'Facebook',description:'Catch up with family and friends',url:'https://www.facebook.com',category:'Keep in touch',color:'#1877f2',icon:'users'},
  {id:'whatsapp',name:'WhatsApp',description:'Send messages and photos',url:'https://web.whatsapp.com',category:'Keep in touch',color:'#25d366',icon:'chat'},
  {id:'gmail',name:'Gmail',description:'Read and send email in your browser',url:'https://mail.google.com',category:'Keep in touch',color:'#d93025',icon:'mail'},
  {id:'x',name:'X (Twitter)',description:'Short news and conversations',url:'https://x.com',category:'Keep in touch',color:'#14252f',icon:'chat'},
  {id:'maps',name:'Google Maps',description:'Find places and get directions',url:'https://maps.google.com',category:'Everyday',color:'#34a853',icon:'map'},
  {id:'wikipedia',name:'Wikipedia',description:'Look up anything, free',url:'https://www.wikipedia.org',category:'Everyday',color:'#33423d',icon:'book'},
  {id:'pinterest',name:'Pinterest',description:'Ideas, recipes and hobbies',url:'https://www.pinterest.com',category:'Everyday',color:'#e60023',icon:'image'},
  {id:'amazon',name:'Amazon',description:'Shop and reorder essentials',url:'https://www.amazon.com',category:'Everyday',color:'#ff9900',icon:'shopping'},
  {id:'bbc',name:'BBC News',description:'Trusted news from around the world',url:'https://www.bbc.com',category:'Everyday',color:'#bb1919',icon:'news'},
  {id:'weather',name:'Weather Channel',description:'Forecast for your town',url:'https://weather.com',category:'Everyday',color:'#0e4c92',icon:'cloud'}
];
export const webAppCategories = ['Keep in touch','Watch & listen','Everyday'];

export const initialDocuments = [
  {id:'letter',title:'A letter to the family',category:'Letters',text:'Dear everyone,\n\nI was thinking about our last Sunday together. It was lovely to have everyone around the table.\n\nWith love,',modified:'September 28'},
  {id:'recipe',title:'My favorite apple cake',category:'Recipes',text:'Apple cake\n\n3 apples\n2 cups of flour\n1 cup of sugar\n2 eggs\n\nMix together and bake at 350°F for 45 minutes.',modified:'September 19'},
  {id:'garden',title:'Notes for the garden',category:'Other things',text:'Remember to plant the spring bulbs.\nWater the herbs on the kitchen windowsill.',modified:'September 12'}
];

export function searchItems(query, documents) {
  const q=query.trim().toLocaleLowerCase();
  if(!q) return [];
  return [
    ...activities.map(a=>({...a,type:'Activity'})),
    ...webApps.map(a=>({...a,type:'App'})),
    ...documents.map(d=>({...d,name:d.title,description:d.category||'Document',type:'Document'}))
  ].filter(item=>`${item.name} ${item.description} ${item.url||''} ${item.text||''}`.toLocaleLowerCase().includes(q));
}

export function safeLoad(storage,key,fallback) {
  try {const value=JSON.parse(storage.getItem(key));return value??fallback;} catch {return fallback;}
}

// Version comparison and update decisions are pure so the installer page, the
// assistant and the automatic updater all agree on what "needs an update" means.
export function parseVersion(value) {
  return String(value ?? '').trim().replace(/^v/i,'').split(/[.+-]/).map(part=>Number.parseInt(part,10)||0);
}
export function compareVersions(a,b) {
  const left=parseVersion(a),right=parseVersion(b);
  const length=Math.max(left.length,right.length);
  for(let i=0;i<length;i++){
    const x=left[i]||0,y=right[i]||0;
    if(x!==y) return x<y?-1:1;
  }
  return 0;
}
// A release payload looks like: {latest:"0.5.0", minimum:"0.3.0", url:"...", notes:"..."}
export function updateDecision(current, release = {}) {
  const latest=release.latest||release.version||null;
  const minimum=release.minimum||release.min||'0.0.0';
  if(!latest) return {update:false,required:false,latest:null,current:String(current),unknown:true};
  return {
    update: compareVersions(latest,current)>0,
    required: compareVersions(minimum,current)>0,
    latest,
    current: String(current),
    url: release.url||release.html_url||null,
    notes: release.notes||release.body||''
  };
}
