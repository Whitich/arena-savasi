'use strict';
const G=window.ArenaCore,$=id=>document.getElementById(id),cv=$('cv'),ctx=cv.getContext('2d');
const {CLASSES,MODES,BUFFS,RARITIES,clamp,W,H,RAD}=G;
const TEAM_COLORS=['#ff728b','#68a8ff'];
const BIND_LABELS={up:'Yukarı',down:'Aşağı',left:'Sol',right:'Sağ',fire:'Ateş (klavye)',skill1:'1. yetenek',skill2:'2. yetenek',skill3:'3. yetenek',mute:'Sesi aç / kapat'};
const store={get(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch{return fallback;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
let bindings={...G.DEFAULT_BINDINGS,...store.get('arena_bindings_v2',{})};
// Discard corrupt settings rather than leaving controls inaccessible.
if(Object.values(bindings).some(v=>typeof v!=='string')||new Set(Object.values(bindings)).size!==Object.keys(G.DEFAULT_BINDINGS).length)bindings={...G.DEFAULT_BINDINGS};
let selectedClass=store.get('arena_class','assault');if(!CLASSES[selectedClass])selectedClass='assault';
let cosmetics=G.normalizeCosmetics(store.get('arena_cosmetics_v1',{color:Object.keys(G.COSMETICS.colors)[Math.floor(Math.random()*10)]}));
store.set('arena_cosmetics_v1',cosmetics);
const botSettings=Object.fromEntries(Object.keys(MODES).map(id=>[id,{enabled:false,count:3,team:1}]));
let selectedMode='normal',lobbyAction=location.hash.length>1?'join':'create',bindingAction=null;
let ws=null,playing=false,connecting=false,intentional=false,retryTimer=null,retryCount=0;
let myId=null,roomCode='',roomMode='normal',token=null,map={walls:[],barrels:[],hazards:[]},world=null;
let stateAt=0,lastMessageAt=0,lastSendAt=0,lastPingAt=0,ping=null,pendingPing=0,frameMs=16.7,renderPos=null;
const players=new Map(),tracks=new Map(),particles=[],rings=[],keys=new Set();let firing=false,aim=0,shake=0,hurtFlash=0;
let mouse={x:innerWidth/2,y:innerHeight/2,moved:false},vw=innerWidth,vh=innerHeight,dpr=1;
const turretFlashes=new Map();
const damageLabels=[];let hitUntil=0,hitColor='#fff',shieldFlash=0,killToastUntil=0,criticalActive=false;
const MAP_THEMES={
 neon:{name:'Neon Tersane',tag:'Metal paneller · turkuaz ışık',floor:['#142a39','#101c30','#231e39'],wall:'#293e56',top:'#5d8098',edge:'#75e6ec',dark:'#122034',line:'#8dc5df',style:'tech'},
 forest:{name:'Kadim Orman',tag:'Yosunlu taş · yaprak desenleri',floor:['#1e352d','#152b28','#243b30'],wall:'#3d5146',top:'#7d9270',edge:'#b7cd8a',dark:'#20352e',line:'#9abc8c',style:'forest'},
 frost:{name:'Buz Üssü',tag:'Donmuş zemin · kristal duvarlar',floor:['#294556','#213649','#303d59'],wall:'#4c657a',top:'#9eb9cb',edge:'#b2f2ff',dark:'#2c435a',line:'#a5d9ef',style:'ice'},
 desert:{name:'Çöl Harabeleri',tag:'Kumtaşı · antik mozaikler',floor:['#3e342c','#302d2b','#45382e'],wall:'#705a46',top:'#b09165',edge:'#e6c48b',dark:'#493d34',line:'#c6a87a',style:'sand'},
 ember:{name:'Kızıl Dökümhane',tag:'Bazalt plakalar · kor damarları',floor:['#30242d','#211f2b','#382630'],wall:'#453c48',top:'#78616c',edge:'#ff9d78',dark:'#292332',line:'#c2877b',style:'ember'}
};
let mapTheme=store.get('arena_map_theme','neon');if(!Object.hasOwn(MAP_THEMES,mapTheme))mapTheme='neon';
let fxQuality=store.get('arena_fx','full');if(!['full','low'].includes(fxQuality))fxQuality='full';
let actx=null,muted=store.get('arena_muted',false),lastHurtSound=0;
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function keyLabel(code){if(code==='Space')return'BOŞLUK';if(code.startsWith('Key'))return code.slice(3);if(code.startsWith('Digit'))return code.slice(5);return({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'SOL SHIFT',ShiftRight:'SAĞ SHIFT'})[code]||code;}
function classColor(p){return G.COSMETICS.colors[p.cosmetics?.color]?.hex||CLASSES[p.classId]?.color||'#7cacf0';}
function localPlayer(){return players.get(myId);}
function knownPlayer(id){return players.get(id)||world?.roster?.find(p=>p.id===id);}
function showError(message){$('lobbyError').textContent=message;}
const RAINBOW=['#ff7192','#ffae60','#ffe17b','#74e6a0','#76cfff','#bc95ff'];
function extraHatSVG(){return{
 unicorn:'<path d="M24 48Q17 20 35 27L42 35H58L67 27Q84 20 76 48" fill="#f6eaff" stroke="#cab8ed" stroke-width="2"/>'+RAINBOW.map((c,i)=>`<path d="M${27+i*8} 38L${31+i*8} 47" stroke="${c}" stroke-width="8"/>`).join('')+'<path d="M43 36L50 4L57 36Z" fill="#fff3c8" stroke="#d8c0ff" stroke-width="2"/>'+RAINBOW.slice(0,4).map((c,i)=>`<path d="M${48-i} ${14+i*5}H${52+i}" stroke="${c}" stroke-width="3"/>`).join(''),
 cat:'<path d="M25 42L23 13L44 35M75 42L77 13L56 35" fill="#29344d" stroke="#cbdaf5" stroke-width="2"/><path d="M29 32L28 23L37 34M71 32L72 23L63 34" fill="#ff97c3"/>',
 wizard:'<path d="M25 35L47 3L67 35Z" fill="#7058bb" stroke="#baa2ff" stroke-width="2"/><ellipse cx="47" cy="37" rx="34" ry="7" fill="#5946a1"/><path d="M46 16L50 23L42 23Z" fill="#ffe4a2"/>',
 headphones:'<path d="M22 55V43Q22 18 50 18Q78 18 78 43V55" fill="none" stroke="#354861" stroke-width="8"/><rect x="19" y="43" width="10" height="24" rx="5" fill="#73e9e3"/><rect x="71" y="43" width="10" height="24" rx="5" fill="#f891d0"/>',
 samurai:'<path d="M24 37Q50 2 76 37L82 43H18Z" fill="#963e56" stroke="#f3a3a1" stroke-width="2"/><path d="M36 29L27 8L48 27M64 29L73 8L52 27" fill="#ffd180"/>'};}
function trailSVG(look,c){if(look.trail==='none')return '';if(look.trail==='rainbow')return RAINBOW.map((color,i)=>`<path d="M${2+i*2} ${75+i*4}L${26+i*2} ${66+i*4}" stroke="${color}" stroke-width="3" opacity=".65"/>`).join('');if(['hearts','stars','frost'].includes(look.trail))return `<text x="4" y="83" fill="${look.trail==='hearts'?'#ff8cc0':look.trail==='frost'?'#b8f5ff':'#ffe5a0'}" font-size="13">${look.trail==='hearts'?'♥':look.trail==='frost'?'❄':'✦'}</text><text x="15" y="95" fill="${c}" font-size="9">✧</text>`;return `<path d="M7 82L28 72M3 91L31 79M12 96L34 86" stroke="${c}" stroke-width="${look.trail==='sparks'?2:4}" opacity=".5" stroke-dasharray="${look.trail==='sparks'?'2 5':'30'}"/>`;}
function weaponSVG(look){const c=G.COSMETICS.colors[look.weaponColor]?.hex||'#83e5ef',kind=look.weapon;return `<g><rect x="64" y="57" width="28" height="10" rx="3" fill="${kind==='gold'?'#e5b358':kind==='candy'?'#fff0ef':'#17283e'}" stroke="${c}" stroke-width="1.5"/><path d="M72 61H93" stroke="${c}" stroke-width="3"/>${kind==='candy'?'<path d="M68 58L73 66M78 58L83 66" stroke="#ff7192" stroke-width="3"/>':kind==='void'?'<circle cx="76" cy="62" r="4" fill="#b394ff"/>':kind==='frost'?'<path d="M67 57L73 51L80 57" fill="#c9faff"/>':kind==='neon'?`<path d="M68 55H89" stroke="${c}" stroke-width="2"/>`:''}</g>`;}
function renderCustomizer(){
 $('colorChoices').innerHTML=Object.entries(G.COSMETICS.colors).map(([id,c])=>`<button class="swatch ${cosmetics.color===id?'selected':''}" style="--swatch:${c.hex}" data-color="${id}" title="${c.name}" aria-label="${c.name}" aria-pressed="${cosmetics.color===id}"></button>`).join('');
 for(const [id,key,choices]of [['patternChoice','pattern',G.COSMETICS.patterns],['hatChoice','hat',G.COSMETICS.hats],['auraChoice','aura',G.COSMETICS.auras],['trailChoice','trail',G.COSMETICS.trails],['visorChoice','visor',G.COSMETICS.visors],['weaponChoice','weapon',G.COSMETICS.weapons],['weaponColorChoice','weaponColor',Object.fromEntries(Object.entries(G.COSMETICS.colors).map(([id,c])=>[id,c.name]))]]){$(id).innerHTML=Object.entries(choices).map(([value,name])=>`<option value="${value}">${name}</option>`).join('');$(id).value=cosmetics[key];}
 const c=G.COSMETICS.colors[cosmetics.color].hex;
 const pattern={plain:'',stripe:'<path d="M29 50L71 74M29 63L65 83" stroke="#fff" stroke-width="7" opacity=".7"/>',cross:'<path d="M50 42V82M30 62H70" stroke="#fff" stroke-width="8" opacity=".8"/>',star:'<path d="M50 41L56 55L72 56L60 66L64 82L50 73L36 82L40 66L28 56L44 55Z" fill="#fff" opacity=".85"/>'}[cosmetics.pattern];
 const hat={...extraHatSVG(),none:'',crown:'<path d="M27 35L24 16L40 25L50 10L60 25L76 16L73 35Z" fill="#ffd166" stroke="#fff1bc" stroke-width="2"/>',horns:'<path d="M29 38Q12 25 21 9L39 34M71 38Q88 25 79 9L61 34" fill="#f3e0c0"/>',antenna:'<path d="M50 35V14" stroke="#dceaff" stroke-width="4"/><circle cx="50" cy="10" r="7" fill="#ff728b"/>'}[cosmetics.hat];
 $('avatarPreview').innerHTML=`<svg viewBox="0 0 100 110" role="img" aria-label="Seçtiğin karakter"><defs><radialGradient id="avatarTint" cx="30%" cy="20%"><stop stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient><clipPath id="avatarClip"><circle cx="50" cy="62" r="27"/></clipPath></defs>${cosmetics.aura!=='none'?`<ellipse cx="50" cy="95" rx="43" ry="12" fill="${c}15" stroke="${c}" stroke-width="2" stroke-dasharray="${cosmetics.aura==='rune'?'3 6':'40 12'}"/>`:''}<ellipse cx="50" cy="98" rx="29" ry="6" fill="#0004"/><circle cx="50" cy="62" r="27" fill="${c}" stroke="#eaf4ff" stroke-width="3"/><g clip-path="url(#avatarClip)">${pattern}<circle cx="50" cy="62" r="27" fill="url(#avatarTint)"/></g>${trailSVG(cosmetics,c)}${cosmetics.visor!=='none'?'<rect x="30" y="50" width="38" height="14" rx="6" fill="#0b1c30" stroke="#9ff8ff" stroke-width="2"/>'+(cosmetics.visor==='eyes'?'<path d="M35 56H43M55 56H63" stroke="#e2ffff" stroke-width="3"/>':'<path d="M35 54H48" stroke="#e2ffff" stroke-width="2"/>'):''}${hat}${weaponSVG(cosmetics)}</svg>`;
}
function saveCosmetics(){store.set('arena_cosmetics_v1',cosmetics);renderCustomizer();}
$('colorChoices').onclick=e=>{const b=e.target.closest('[data-color]');if(b){cosmetics.color=b.dataset.color;saveCosmetics();}};
$('patternChoice').onchange=()=>{cosmetics.pattern=$('patternChoice').value;saveCosmetics();};
$('hatChoice').onchange=()=>{cosmetics.hat=$('hatChoice').value;saveCosmetics();};
for(const key of ['aura','trail','visor','weapon','weaponColor'])$(key+'Choice').onchange=()=>{cosmetics[key]=$(key+'Choice').value;saveCosmetics();};
$('randomLook').onclick=()=>{for(const [key,list]of Object.entries({color:G.COSMETICS.colors,pattern:G.COSMETICS.patterns,hat:G.COSMETICS.hats,aura:G.COSMETICS.auras,trail:G.COSMETICS.trails,visor:G.COSMETICS.visors,weapon:G.COSMETICS.weapons,weaponColor:G.COSMETICS.colors})){const ids=Object.keys(list);cosmetics[key]=ids[Math.floor(Math.random()*ids.length)];}saveCosmetics();};
$('fxQuality').value=fxQuality;$('fxQuality').onchange=()=>{fxQuality=$('fxQuality').value;store.set('arena_fx',fxQuality);};
function renderThemeChoices(){
 $('themeChoices').innerHTML=Object.entries(MAP_THEMES).map(([id,t])=>`<button class="theme-card ${mapTheme===id?'selected':''}" data-theme="${id}" aria-pressed="${mapTheme===id}"><canvas width="240" height="150" aria-hidden="true"></canvas><strong>${t.name}</strong><small>${t.tag}</small><span>${mapTheme===id?'✓ SEÇİLİ':'ÖNİZLE VE SEÇ'}</span></button>`).join('');
 for(const card of $('themeChoices').querySelectorAll('[data-theme]')){const f=card.querySelector('canvas').getContext('2d');f.save();f.scale(240/W,150/H);paintFloor(f,card.dataset.theme);for(const w of [{x:260,y:230,w:360,h:70},{x:1040,y:260,w:70,h:360},{x:540,y:700,w:360,h:70}])paintWall(f,w,MAP_THEMES[card.dataset.theme]);f.restore();}
 $('themeName').textContent=MAP_THEMES[mapTheme].name;$('mapThemeButton').textContent='◈ '+MAP_THEMES[mapTheme].name;
}
function openThemes(){resetInputs();renderThemeChoices();$('themeDialog').showModal();}
$('themeOpen').onclick=openThemes;$('mapThemeButton').onclick=openThemes;
$('themeClose').onclick=()=>$('themeDialog').close();$('themeDone').onclick=()=>$('themeDialog').close();
$('themeChoices').onclick=e=>{const b=e.target.closest('[data-theme]');if(!b)return;mapTheme=b.dataset.theme;floorLayer=null;store.set('arena_map_theme',mapTheme);renderThemeChoices();};
function openBuffGuide(){resetInputs();$('buffGuideList').innerHTML=Object.entries(RARITIES).map(([id,t])=>`<section class="rarity-group" style="--rarity:${t.color}"><h3>${t.name}</h3>${Object.values(BUFFS).filter(b=>b.rarity===id).map(b=>`<div><strong>${b.icon} ${b.name}${b.duration?' · '+b.duration+' sn':''}</strong><p>${b.description}</p></div>`).join('')}</section>`).join('');$('buffGuide').showModal();}
$('buffGuideOpen').onclick=openBuffGuide;$('buffGuideClose').onclick=()=>$('buffGuide').close();
function renderLobby(){
 renderCustomizer();$('themeName').textContent=MAP_THEMES[mapTheme].name;$('mapThemeButton').textContent='◈ '+MAP_THEMES[mapTheme].name;
 $('createTab').classList.toggle('active',lobbyAction==='create');$('joinTab').classList.toggle('active',lobbyAction==='join');
 $('createTab').setAttribute('aria-selected',String(lobbyAction==='create'));$('joinTab').setAttribute('aria-selected',String(lobbyAction==='join'));
 $('createOptions').classList.toggle('hidden',lobbyAction!=='create');
 $('teamField').classList.toggle('hidden',lobbyAction==='create'&&!G.isTeamMode(selectedMode));
 $('roomLabel').textContent=lobbyAction==='create'?'Oda kodu · isteğe bağlı':'Katılacağın odanın kodu';
 $('room').placeholder=lobbyAction==='create'?'Boş bırakırsan otomatik oluşturulur':'Örn: ARENA';
 $('start').textContent=connecting?'BAĞLANIYOR…':lobbyAction==='create'?'ODAYI OLUŞTUR':'ODAYA KATIL';$('start').disabled=connecting;
 $('roomHint').textContent=lobbyAction==='create'?'Oda kurulduktan sonra linki arkadaşlarınla paylaş. Katılan herkes seçtiğin oyun moduna girer.':'Oyun modu odayı kuran kişi tarafından belirlenir. Sınıfını seçip oda koduyla katıl.';
 $('modeList').innerHTML=Object.entries(MODES).map(([id,m])=>`<div class="mode-wrap ${id===selectedMode?'selected':''}"><button class="mode ${id===selectedMode?'selected':''}" data-mode="${id}" aria-pressed="${id===selectedMode}"><strong>${m.name}</strong><small>${m.description} · Hedef: ${m.target} ${m.unit}</small></button><div class="bot-options"><label>Bot eklensin mi?<select data-bots="${id}" aria-label="${m.name}: Bot eklensin mi?"><option value="no" ${!botSettings[id].enabled?'selected':''}>Hayır</option><option value="yes" ${botSettings[id].enabled?'selected':''}>Evet</option></select></label>${botSettings[id].enabled?`<label>Kaç bot?<select data-bot-count="${id}" aria-label="${m.name}: Bot sayısı">${Array.from({length:8},(_,i)=>`<option value="${i+1}" ${botSettings[id].count===i+1?'selected':''}>${i+1} bot</option>`).join('')}</select></label>${G.isTeamMode(id)?`<label>Botların takımı<select data-bot-team="${id}" aria-label="${m.name}: Botların takımı"><option value="0" ${botSettings[id].team===0?'selected':''}>1. takım · Kırmızı</option><option value="1" ${botSettings[id].team===1?'selected':''}>2. takım · Mavi</option></select></label>`:''}`:''}</div></div>`).join('');
 const num=n=>Number(n).toLocaleString('tr-TR',{maximumFractionDigits:2});
 $('classList').innerHTML=Object.entries(CLASSES).map(([id,c])=>`<button class="class-card ${id===selectedClass?'selected':''}" style="--class-color:${c.color}" data-class="${id}" aria-pressed="${id===selectedClass}"><span class="class-top"><span><strong>${c.name}</strong>${id===selectedClass?'<span class="selected-mark">SEÇİLDİ</span>':''}</span><span class="class-icon">${c.icon}</span></span><span class="class-stats"><span><b>${c.hp}</b> CAN</span><span><b>${c.damage}</b> HASAR / MERMİ</span><span><b>${num(c.interval)} sn</b> ATIŞ ARALIĞI</span><span><b>${c.bulletSpeed||720}</b> MERMİ HIZI</span><span><b>${c.speed}</b> HAREKET HIZI</span><span><b>${num(1/c.interval)}</b> ATIŞ / SN</span></span><span class="weapon-note">Hızlar: birim/sn · Mermi ömrü: ${num(c.bulletLife||.85)} sn${c.bounces?' · '+c.bounces+' sekme':''}</span><span class="class-skill-list">${c.skills.map((s,i)=>`<span class="class-skill-row"><span class="skill-row-head"><b>${keyLabel(bindings['skill'+(i+1)])} · ${s.name}</b><em>${num(s.cd)} sn bekleme</em></span><span>${s.detail}</span></span>`).join('')}</span></button>`).join('');
 $('skillPreview').innerHTML=CLASSES[selectedClass].skills.map((s,i)=>`<div class="preview"><span class="key">${keyLabel(bindings['skill'+(i+1)])}</span><strong>${s.icon} ${s.name}</strong><p>${s.detail}</p><span class="skill-wait">Bekleme: ${num(s.cd)} saniye</span></div>`).join('');
 $('controlsSummary').textContent=`${['up','left','down','right'].map(k=>keyLabel(bindings[k])).join(' / ')}: hareket · Sol tık / ${keyLabel(bindings.fire)}: ateş · ${keyLabel(bindings.mute)}: ses`;
}
$('classList').onclick=e=>{const b=e.target.closest('[data-class]');if(!b)return;selectedClass=b.dataset.class;store.set('arena_class',selectedClass);renderLobby();};
$('modeList').onchange=e=>{const id=e.target.dataset.bots||e.target.dataset.botCount||e.target.dataset.botTeam;if(!id)return;if(e.target.dataset.bots)botSettings[id].enabled=e.target.value==='yes';else if(e.target.dataset.botTeam)botSettings[id].team=Number(e.target.value);else botSettings[id].count=Number(e.target.value);selectedMode=id;renderLobby();};
$('modeList').onclick=e=>{const b=e.target.closest('[data-mode]');if(!b)return;selectedMode=b.dataset.mode;renderLobby();};
$('createTab').onclick=()=>{lobbyAction='create';showError('');renderLobby();};$('joinTab').onclick=()=>{lobbyAction='join';showError('');renderLobby();};
function renderBindings(){
 $('bindingList').innerHTML=Object.entries(BIND_LABELS).map(([id,label])=>`<div class="binding"><span>${label}</span><button class="${bindingAction===id?'listening':''}" data-bind="${id}">${bindingAction===id?'TUŞA BAS…':keyLabel(bindings[id])}</button></div>`).join('');
}
$('bindingList').onclick=e=>{const b=e.target.closest('[data-bind]');if(!b)return;bindingAction=b.dataset.bind;$('bindHint').textContent=`${BIND_LABELS[bindingAction]} için yeni tuşa bas. Esc: iptal.`;renderBindings();};
$('settingsOpen').onclick=()=>{resetInputs();bindingAction=null;renderBindings();$('settings').showModal();};
function closeSettings(){bindingAction=null;$('settings').close();renderLobby();}
$('settingsClose').onclick=closeSettings;$('settingsDone').onclick=closeSettings;
$('bindingsReset').onclick=()=>{bindings={...G.DEFAULT_BINDINGS};bindingAction=null;store.set('arena_bindings_v2',bindings);renderBindings();renderLobby();$('bindHint').textContent='Varsayılan tuşlar geri yüklendi.';};
$('settings').addEventListener('cancel',e=>{if(bindingAction){e.preventDefault();bindingAction=null;renderBindings();$('bindHint').textContent='Tuş seçimi iptal edildi.';}});
function initAudio(){try{if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();}catch{}}
function sound(kind,x,y){
 if(muted||!actx||actx.state!=='running')return;
 const me=localPlayer(),dist=me&&Number.isFinite(x)?Math.hypot(x-me.x,y-me.y):0;
 const volume=clamp(1-dist/1000,0,1);if(volume<=.01)return;
 try{const cfg={kill:['triangle',1250,.22,.07],shieldHit:['triangle',640,.06,.03],shieldBreak:['sawtooth',1000,.18,.045],warning:['triangle',180,.18,.035],victory:['triangle',880,.45,.06],shoot:['square',420,.055,.025],bomb:['sawtooth',140,.15,.045],boom:['sawtooth',75,.3,.08],hurt:['sawtooth',180,.1,.04],hit:['triangle',900,.06,.04],buff:['triangle',660,.22,.06],dash:['triangle',520,.1,.035],die:['square',230,.45,.06]}[kind];if(!cfg)return;
 const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();o.type=cfg[0];o.frequency.setValueAtTime(cfg[1],t);if(kind==='boom'||kind==='die'||kind==='shieldBreak')o.frequency.exponentialRampToValueAtTime(40,t+cfg[2]);if(kind==='buff')o.frequency.exponentialRampToValueAtTime(1320,t+cfg[2]);
 o.connect(g);let pan;if(actx.createStereoPanner){pan=actx.createStereoPanner();pan.pan.value=me&&Number.isFinite(x)?clamp((x-me.x)/650,-.85,.85):0;g.connect(pan);pan.connect(actx.destination);}else g.connect(actx.destination);
 g.gain.setValueAtTime(cfg[3]*volume,t);g.gain.exponentialRampToValueAtTime(.001,t+cfg[2]);o.onended=()=>{o.disconnect();g.disconnect();if(pan)pan.disconnect();};o.start(t);o.stop(t+cfg[2]+.02);
 }catch{}
}
function addFeed(text,highlight=false){const el=document.createElement('div');el.className='feed-item'+(highlight?' hi':'');el.textContent=text;$('feed').appendChild(el);while($('feed').children.length>5)$('feed').firstChild.remove();setTimeout(()=>el.remove(),4500);}
function burst(x,y,color,n=12){for(let i=0;i<Math.ceil(n*(fxQuality==='low'?.35:1))&&particles.length<(fxQuality==='low'?120:360);i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*220;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.3,max:.55,color,size:2+Math.random()*2});}}
function effects(events){
 for(const e of events){
  if(e.t==='shot'){sound(e.bomb?'bomb':'shoot',e.x,e.y);burst(e.x+Math.cos(players.get(e.id)?.a||0)*24,e.y+Math.sin(players.get(e.id)?.a||0)*24,'#ffe5aa',3);}
  else if(e.t==='turret'){sound('shoot',e.x,e.y);turretFlashes.set(Math.round(e.x)+','+Math.round(e.y),performance.now());}
  else if(e.t==='hit'){
   if(e.id===myId){if(e.amount>0)hurtFlash=.5;else shieldFlash=.3;if(performance.now()-lastHurtSound>150){sound(e.amount>0?'hurt':'shieldHit');lastHurtSound=performance.now();}}
   if(e.owner===myId){
    hitUntil=performance.now()+150;hitColor=e.amount>0?'#f2f8ff':'#78e7ef';sound(e.amount>0?'hit':'shieldHit');
    if(damageLabels.length>35)damageLabels.shift();damageLabels.push({x:e.x,y:e.y-28,life:.65,text:e.amount>0?'-'+e.amount:'🛡 '+(e.absorbed||0),color:hitColor});
   }
   burst(e.x,e.y,e.amount>0?'#ff94aa':'#78e7ef',4);
  }else if(e.t==='shieldBreak'){sound('shieldBreak',e.x,e.y);burst(e.x,e.y,'#78e7ef',24);rings.push({x:e.x,y:e.y,r:60,t:0,max:.32,color:'#78e7ef'});if(e.id===myId)shieldFlash=.65;}
  else if(e.t==='shieldExpire'){rings.push({x:e.x,y:e.y,r:32,t:0,max:.3,color:'#78e7ef'});}
  else if(e.t==='matchEnd'){resetInputs();if(e.winner?.id===myId||e.winner?.kind==='team'&&e.winner.team===localPlayer()?.team)sound('victory');}
  else if(e.t==='matchStart'){addFeed('Rövanş başladı!',true);}
  else if(e.t==='explosion'){rings.push({x:e.x,y:e.y,r:e.r,t:0,max:.45,color:e.color||'#ffad68'});burst(e.x,e.y,e.color||'#ffad68',20);sound('boom',e.x,e.y);if(renderPos&&Math.hypot(e.x-renderPos.x,e.y-renderPos.y)<400)shake=6;}
  else if(e.t==='dash'){burst(e.x,e.y,classColor(players.get(e.id)||{}),12);sound('dash',e.x,e.y);}
  else if(e.t==='cast'||e.t==='freeze'){burst(e.x,e.y,e.color,18);rings.push({x:e.x,y:e.y,r:e.t==='freeze'?38:55,t:0,max:.4,color:e.color});sound('buff',e.x,e.y);}
  else if(e.t==='cone'){for(let i=-5;i<=5;i++){const a=e.a+i*.12;burst(e.x+Math.cos(a)*120,e.y+Math.sin(a)*120,e.color,5);}sound('boom',e.x,e.y);}
  else if(e.t==='skill')burst(e.x,e.y,'#9ae8ea',10);
  else if(e.t==='pickup'){burst(e.x,e.y,BUFFS[e.kind].color,16);sound('buff',e.x,e.y);if(e.id===myId)addFeed(`${RARITIES[BUFFS[e.kind].rarity].name} · ${BUFFS[e.kind].name} aldın! · ${BUFFS[e.kind].description}`,true);}
  else if(e.t==='death'){
   const victim=knownPlayer(e.id),killer=knownPlayer(e.killer);burst(e.x,e.y,victim?classColor(victim):'#ff829b',25);addFeed(killer?`${killer.name} → ${victim?.name||'Oyuncu'}`:`${victim?.name||'Oyuncu'} haritaya yenildi`);
   if(e.killer===myId){sound('kill');hitUntil=performance.now()+450;hitColor='#ffd166';killToastUntil=performance.now()+1500;$('killToast').textContent=(victim?.name||'Rakip')+' saf dışı!';$('killToast').classList.remove('hidden');}
   if(e.id===myId){sound('die');$('deadmsg').textContent=killer?`${killer.name} seni öldürdü`:'Harita hasarı';resetInputs();}
  }else if(e.t==='blink'){for(const point of [{x:e.x,y:e.y},{x:e.tx,y:e.ty}]){burst(point.x,point.y,'#ca9aff',16);rings.push({...point,r:48,t:0,max:.45,color:'#ca9aff'});}sound('dash',e.tx,e.ty);}
  else if(e.t==='respawn'){if(e.id===myId)renderPos={x:e.x,y:e.y};burst(e.x,e.y,'#9ffff0',18);rings.push({x:e.x,y:e.y,r:65,t:0,max:.6,color:'#9ffff0'});}
  else if(e.t==='flag'){const owner=players.get(e.owner);addFeed(owner?`⚑ Bayrak ${owner.name} oyuncusunda`:'⚑ Bayrak yere düştü',true);}
  else if(e.t==='barrel')burst(e.x,e.y,'#ffba72',8);
 }
}
function endpoint(){return window.ARENA_SERVER_URL||((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');}
function send(o){if(ws?.readyState!==1)return;if(ws.bufferedAmount>32768){if(o.t==='input')return;if(ws.bufferedAmount>262144){ws.close();return;}}ws.send(JSON.stringify(o));}
function sessionRead(code){try{return JSON.parse(sessionStorage.getItem('arena_session_'+code));}catch{return null;}}
function sessionWrite(){try{sessionStorage.setItem('arena_session_'+roomCode,JSON.stringify({token,team:localPlayer()?.team,classId:localPlayer()?.classId||selectedClass,mode:roomMode}));}catch{}}
function applyState(s,initial=false){
 const wasFinished=world?.match?.status==='finished';const changed=world?.match?.round!==s.match?.round;if(changed){tracks.clear();renderPos=null;particles.length=0;rings.length=0;damageLabels.length=0;hitUntil=0;resetInputs();}
 const now=performance.now();stateAt=now;world=s;if(s.walls)map.walls=s.walls;roomMode=s.mode;if(s.match?.status==='finished'&&!wasFinished)resetInputs();
 const seen=new Set();for(const p of s.players){seen.add(p.id);players.set(p.id,p);let h=tracks.get(p.id);if(!h){h=[];tracks.set(p.id,h);}h.push({x:p.x,y:p.y,a:p.a,at:now,dead:p.dead});if(h.length>8)h.shift();}
 for(const id of players.keys())if(!seen.has(id)){players.delete(id);tracks.delete(id);}
 for(const b of s.barrels){const target=map.barrels.find(br=>br.id===b.id);if(target)Object.assign(target,b);}
 const me=localPlayer();if(me&&(!renderPos||initial||me.dead)){renderPos={x:me.x,y:me.y};}
 $('dead').classList.toggle('hidden',!me?.dead);
}
function connectRoom(payload,resuming=false){
 clearTimeout(retryTimer);intentional=false;connecting=true;if(!playing)renderLobby();
 if(ws){ws.onclose=null;ws.close();}
 const socket=new WebSocket(endpoint());ws=socket;let welcomed=false;
 const timeout=setTimeout(()=>{if(!welcomed)socket.close();},12000);
 socket.onopen=()=>{send(payload);lastMessageAt=performance.now();};
 socket.onmessage=event=>{
  if(ws!==socket)return;lastMessageAt=performance.now();let o;try{o=JSON.parse(event.data);}catch{return;}
  if(o.t==='welcome'){
   clearTimeout(timeout);welcomed=true;myId=o.id;token=o.token;roomCode=o.code;roomMode=o.mode;map=o.map;players.clear();tracks.clear();particles.length=0;rings.length=0;renderPos=null;pendingPing=0;ping=null;
   applyState(o.state,true);playing=true;connecting=false;retryCount=0;sessionWrite();location.hash=roomCode;
   $('lobby').classList.add('hidden');$('hud').classList.remove('hidden');$('connecting').classList.add('hidden');$('status').textContent='● Oyun sunucusuna bağlı';$('feed').innerHTML='';
   addFeed(`${MODES[roomMode].name} · ${roomCode} odasına katıldın`,true);updateHUD();resetInputs();return;
  }
  if(o.t==='state'){applyState(o);return;}
  if(o.t==='events'){effects(o.events);return;}
  if(o.t==='pong'&&o.ts===pendingPing){ping=Math.max(0,performance.now()-o.ts);pendingPing=0;return;}
  if(o.t==='joined'&&o.id!==myId)addFeed(o.name+' katıldı');
  if(o.t==='leave')addFeed(o.name+' ayrıldı');
  if(o.t==='error'){
   clearTimeout(timeout);connecting=false;showError(o.message);intentional=true;playing=false;$('connecting').classList.add('hidden');$('hud').classList.add('hidden');$('matchEnd').classList.add('hidden');$('lowHealth').classList.add('hidden');$('lobby').classList.remove('hidden');renderLobby();socket.close();
  }
 };
 socket.onerror=()=>{};
 socket.onclose=()=>{
  clearTimeout(timeout);if(ws!==socket||intentional)return;connecting=false;
  if(playing){resetInputs();$('status').textContent='Bağlantı kesildi';$('connecting').classList.remove('hidden');retryTimer=setTimeout(()=>connectRoom({t:'join',code:roomCode,name:$('name').value||'Oyuncu',classId:localPlayer()?.classId||selectedClass,token,cosmetics,mode:roomMode,team:localPlayer()?.team??Number($('teamChoice').value),resume:true},true),Math.min(8000,1000*2**retryCount++));}
  else{showError('Sunucuya bağlanılamadı. Ücretsiz sunucu uyanıyorsa biraz bekleyip tekrar dene.');renderLobby();}
 };
}
function start(){
 if(playing||connecting)return;initAudio();showError('');
 const code=$('room').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);if(lobbyAction==='join'&&!code){showError('Katılacağın odanın kodunu yaz.');return;}
 const name=$('name').value.trim().slice(0,14)||'Oyuncu';$('name').value=name;store.set('arena_name',name);
 const previous=lobbyAction==='join'?sessionRead(code):null;
 connectRoom({t:lobbyAction,code,name,classId:selectedClass,cosmetics,mode:selectedMode,botsEnabled:botSettings[selectedMode].enabled,botCount:botSettings[selectedMode].count,botTeam:botSettings[selectedMode].team,team:Number($('teamChoice').value),token:previous?.classId===selectedClass&&(!G.isTeamMode(previous.mode)||previous.team===Number($('teamChoice').value))?previous.token:undefined});
}
$('start').onclick=start;for(const id of ['name','room'])$(id).addEventListener('keydown',e=>{if(e.key==='Enter')start();});
$('name').value=store.get('arena_name','');$('room').value=location.hash.slice(1).replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,8);
$('room').oninput=()=>{$('room').value=$('room').value.toUpperCase().replace(/[^A-Z0-9]/g,'');};
$('share').onclick=async()=>{$('share').blur();resetInputs();const link='https://arena-savasi.onrender.com/#'+roomCode;try{await navigator.clipboard.writeText(link);addFeed('Oda linki kopyalandı. Arkadaşlarına gönder!',true);}catch{addFeed('Oda linki: '+link,true);}};
$('rematch').onclick=()=>{resetInputs();send({t:'rematch'});};$('resultMenu').onclick=()=>$('leave').click();
$('deathClasses').onclick=e=>{const b=e.target.closest('[data-death-class]');if(b){send({t:'classChange',classId:b.dataset.deathClass});b.blur();}};
$('leave').onclick=()=>{intentional=true;resetInputs();send({t:'leave'});ws?.close();playing=false;connecting=false;clearTimeout(retryTimer);try{sessionStorage.removeItem('arena_session_'+roomCode);}catch{}token=null;$('connecting').classList.add('hidden');$('hud').classList.add('hidden');$('matchEnd').classList.add('hidden');$('lowHealth').classList.add('hidden');$('lobby').classList.remove('hidden');showError('');lobbyAction='join';$('room').value=roomCode;renderLobby();};
function movement(){
 const held=(action,alias)=>keys.has(bindings[action])||bindings[action]===G.DEFAULT_BINDINGS[action]&&!Object.values(bindings).includes(alias)&&keys.has(alias);
 return{x:(held('right','ArrowRight')?1:0)-(held('left','ArrowLeft')?1:0),y:(held('down','ArrowDown')?1:0)-(held('up','ArrowUp')?1:0)};
}
function resetInputs(){keys.clear();firing=false;if(playing)send({t:'input',x:0,y:0,a:aim,fire:false});}
window.addEventListener('keydown',e=>{
 if(bindingAction){
  e.preventDefault();e.stopPropagation();if(e.code==='Escape'){bindingAction=null;renderBindings();return;}
  if(['Tab','MetaLeft','MetaRight','F5','F11','F12'].includes(e.code)||e.ctrlKey||e.metaKey||e.altKey){$('bindHint').textContent='Bu tarayıcı kısayolu kullanılamaz. Başka bir tuş seç.';return;}
  const conflict=Object.entries(bindings).find(([id,key])=>id!==bindingAction&&key===e.code);if(conflict){$('bindHint').textContent=`Bu tuş ${BIND_LABELS[conflict[0]]} için kullanılıyor. Önce onu değiştir.`;return;}
  bindings[bindingAction]=e.code;store.set('arena_bindings_v2',bindings);bindingAction=null;renderBindings();renderLobby();$('bindHint').textContent='Tuş kaydedildi.';return;
 }
 if(!playing||world?.match?.status==='finished'||$('settings').open||$('themeDialog').open||$('buffGuide').open||e.target.closest('input,button,textarea,select'))return;
 if(Object.values(bindings).includes(e.code)||e.code.startsWith('Arrow'))e.preventDefault();keys.add(e.code);if(e.repeat)return;
 const index=[bindings.skill1,bindings.skill2,bindings.skill3].indexOf(e.code);if(index>=0){const target=cursorTarget();send({t:'skill',index,a:aim,x:target.x,y:target.y});}
 if(e.code===bindings.mute){muted=!muted;store.set('arena_muted',muted);addFeed(muted?'Ses kapatıldı':'Ses açıldı');if(!muted)initAudio();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',resetInputs);
cv.addEventListener('pointerdown',e=>{if(e.button===0&&playing&&world?.match?.status!=='finished'){initAudio();firing=true;cv.setPointerCapture?.(e.pointerId);}});
window.addEventListener('pointerup',e=>{if(e.button===0)firing=false;});window.addEventListener('pointermove',e=>{mouse={x:e.clientX,y:e.clientY,moved:true};});
cv.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{resetInputs();if(document.visibilityState==='visible')lastFrame=performance.now();});
window.addEventListener('beforeunload',()=>ws?.close());
function resize(){dpr=Math.min(devicePixelRatio||1,2);vw=innerWidth;vh=innerHeight;cv.width=vw*dpr;cv.height=vh*dpr;cv.style.width=vw+'px';cv.style.height=vh+'px';}window.addEventListener('resize',resize);resize();
function scale(){return clamp(Math.min(vw,vh*1.5)/1100,.5,1.35);}
function camera(s){const p=renderPos||{x:800,y:500};return{x:W*s<vw?(vw/s-W)/2:-clamp(p.x-vw/(2*s),0,W-vw/s),y:H*s<vh?(vh/s-H)/2:-clamp(p.y-vh/(2*s),0,H-vh/s)};}
function cursorTarget(){const s=scale(),cam=camera(s);return{x:mouse.x/s-cam.x,y:mouse.y/s-cam.y};}
function positionFor(p,now){
 if(p.id===myId&&renderPos)return renderPos;
 const h=tracks.get(p.id);if(!h?.length)return p;const target=now-80;
 for(let i=h.length-2;i>=0;i--)if(h[i].at<=target){const a=h[i],b=h[i+1];if(a.dead!==b.dead)return b;const k=clamp((target-a.at)/Math.max(1,b.at-a.at),0,1);return{x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};}
 return h[0];
}
let lastFrame=performance.now(),hudAt=0;
function loop(now){
 requestAnimationFrame(loop);const elapsed=Math.max(1,now-lastFrame),dt=Math.min(.05,elapsed/1000);lastFrame=now;frameMs+=(elapsed-frameMs)*.06;
 if(!playing||!world)return;
 const me=localPlayer(),s=scale(),cam=camera(s),moving=movement();
 if(mouse.moved&&renderPos)aim=Math.atan2(mouse.y/s-cam.y-renderPos.y,mouse.x/s-cam.x-renderPos.x);else if(moving.x||moving.y)aim=Math.atan2(moving.y,moving.x);
 if(ws?.readyState===1&&world.match?.status!=='finished'&&me&&!me.dead&&renderPos){
  let mx=moving.x,my=moving.y;const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
  const c=CLASSES[me.classId],age=Math.min(.15,(now-stateAt)/1000);let speed=c.speed*(me.buffs.speed>0?1.45:1)*(me.haste>0?1.5:1)*(me.slow>0?.55:1)*(me.buffs.titan>0?.9:1);
  if(me.dash>age){mx=Math.cos(me.a);my=Math.sin(me.a);speed=me.classId==='guardian'?850:1100;}
  if(me.root>age||me.pull)speed=0;
  renderPos=G.resolve(map,renderPos.x+mx*speed*dt,renderPos.y+my*speed*dt);
  if(me.tether){const t=me.tether,d=Math.hypot(renderPos.x-t.x,renderPos.y-t.y);if(d>t.length)renderPos=G.resolve(map,t.x+(renderPos.x-t.x)/d*t.length,t.y+(renderPos.y-t.y)/d*t.length);}
  const lead=Math.min(.1,(ping||40)/2000+age),tx=me.x+me.vx*lead,ty=me.y+me.vy*lead,delta=Math.hypot(tx-renderPos.x,ty-renderPos.y);
  if(delta>180)renderPos={x:me.x,y:me.y};else if(delta>4){const k=Math.min(1,dt*9);renderPos=G.resolve(map,renderPos.x+(tx-renderPos.x)*k,renderPos.y+(ty-renderPos.y)*k);}
 }
 if(ws?.readyState===1&&now-lastSendAt>=33){lastSendAt=now;send({t:'input',x:moving.x,y:moving.y,a:Math.round(aim*1000)/1000,fire:world.match?.status!=='finished'&&!!(firing||keys.has(bindings.fire))});}
 if(ws?.readyState===1&&now-lastPingAt>=1500){lastPingAt=now;if(now-lastMessageAt>12000)ws.close();else if(!pendingPing||now-pendingPing>4000){pendingPing=now;send({t:'ping',ts:now});}}
 for(let i=damageLabels.length-1;i>=0;i--){damageLabels[i].life-=dt;damageLabels[i].y-=dt*35;if(damageLabels[i].life<=0)damageLabels.splice(i,1);}
 if(now>killToastUntil)$('killToast').classList.add('hidden');shieldFlash=Math.max(0,shieldFlash-dt*2);
 shake=Math.max(0,shake-dt*20);hurtFlash=Math.max(0,hurtFlash-dt*2);
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.max(0,1-dt*4);p.vy*=Math.max(0,1-dt*4);p.life-=dt;if(p.life<=0)particles.splice(i,1);}
 for(let i=rings.length-1;i>=0;i--){rings[i].t+=dt;if(rings[i].t>rings[i].max)rings.splice(i,1);}
 draw(now);if(now-hudAt>=100){hudAt=now;updateHUD();}
}
requestAnimationFrame(loop);
function roundRect(x,y,w,h,r=7){ctx.beginPath();ctx.roundRect(x,y,Math.max(0,w),Math.max(0,h),r);}
function circle(x,y,r,fill,stroke=null,width=2){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function drawCosmetics(p,x,y){
 const look=p.cosmetics||G.normalizeCosmetics({},p.id);
 ctx.save();ctx.beginPath();ctx.arc(x,y,RAD-1,0,Math.PI*2);ctx.clip();ctx.strokeStyle='#ffffffb0';ctx.fillStyle='#ffffffe0';ctx.lineWidth=4;
 if(look.pattern==='stripe'){for(const offset of [-10,1,12]){ctx.beginPath();ctx.moveTo(x-22,y+offset-10);ctx.lineTo(x+22,y+offset+14);ctx.stroke();}}
 else if(look.pattern==='cross'){ctx.beginPath();ctx.moveTo(x-11,y);ctx.lineTo(x+11,y);ctx.moveTo(x,y-11);ctx.lineTo(x,y+11);ctx.stroke();}
 else if(look.pattern==='star'){ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?5:12;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();}ctx.restore();
 if(look.visor!=='none'){ctx.fillStyle='#0b1c30';roundRect(x-11,y-7,22,10,4);ctx.fill();ctx.strokeStyle='#9ff8ff';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#c5ffff';if(look.visor==='eyes'){ctx.fillRect(x-7,y-4,4,3);ctx.fillRect(x+3,y-4,4,3);}else ctx.fillRect(x-7,y-4,12,2);}
 if(['unicorn','cat','wizard','headphones','samurai'].includes(look.hat))drawHeadwear(look.hat,x,y);
 if(look.hat==='crown'){ctx.fillStyle='#ffd166';ctx.strokeStyle='#fff1bc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-12,y-16);ctx.lineTo(x-14,y-28);ctx.lineTo(x-5,y-23);ctx.lineTo(x,y-32);ctx.lineTo(x+5,y-23);ctx.lineTo(x+14,y-28);ctx.lineTo(x+12,y-16);ctx.closePath();ctx.fill();ctx.stroke();}
 else if(look.hat==='horns'){ctx.fillStyle='#f3e0c0';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(x+side*8,y-13);ctx.quadraticCurveTo(x+side*26,y-20,x+side*18,y-32);ctx.lineTo(x+side*15,y-15);ctx.fill();}}
 else if(look.hat==='antenna'){ctx.strokeStyle='#dceaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-15);ctx.lineTo(x,y-29);ctx.stroke();circle(x,y-31,4,'#ff728b');}
}
function drawHeadwear(hat,x,y){
 ctx.save();ctx.translate(x,y);ctx.lineWidth=1.2;
 if(hat==='unicorn'){ctx.fillStyle='#f6eaff';ctx.strokeStyle='#cab8ed';ctx.beginPath();ctx.moveTo(-15,-8);ctx.lineTo(-17,-26);ctx.lineTo(-6,-17);ctx.lineTo(6,-17);ctx.lineTo(17,-26);ctx.lineTo(15,-8);ctx.closePath();ctx.fill();ctx.stroke();for(let i=0;i<6;i++){ctx.fillStyle=RAINBOW[i];roundRect(-15+i*5,-18,5,7,2);ctx.fill();}ctx.fillStyle='#fff3c8';ctx.beginPath();ctx.moveTo(-4,-17);ctx.lineTo(0,-37);ctx.lineTo(4,-17);ctx.fill();for(let i=0;i<4;i++){ctx.strokeStyle=RAINBOW[i];ctx.beginPath();ctx.moveTo(-1-i*.6,-31+i*4);ctx.lineTo(1+i*.6,-31+i*4);ctx.stroke();}}
 else if(hat==='cat'){for(const side of [-1,1]){ctx.fillStyle='#29344d';ctx.strokeStyle='#cbdaf5';ctx.beginPath();ctx.moveTo(side*15,-9);ctx.lineTo(side*16,-31);ctx.lineTo(side*4,-15);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ff97c3';ctx.beginPath();ctx.moveTo(side*13,-17);ctx.lineTo(side*13,-25);ctx.lineTo(side*8,-16);ctx.fill();}}
 else if(hat==='wizard'){ctx.fillStyle='#7058bb';ctx.beginPath();ctx.moveTo(-15,-17);ctx.lineTo(-2,-39);ctx.lineTo(12,-17);ctx.fill();ctx.fillStyle='#5946a1';ctx.beginPath();ctx.ellipse(-2,-16,22,5,0,0,Math.PI*2);ctx.fill();circle(-2,-26,2,'#ffe4a2');}
 else if(hat==='headphones'){ctx.strokeStyle='#354861';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,-2,17,Math.PI,Math.PI*2);ctx.stroke();for(const side of [-1,1]){ctx.fillStyle=side<0?'#73e9e3':'#f891d0';roundRect(side*16-3,-8,6,14,3);ctx.fill();}}
 else{ctx.fillStyle='#963e56';ctx.strokeStyle='#f3a3a1';ctx.beginPath();ctx.moveTo(-19,-14);ctx.quadraticCurveTo(0,-38,19,-14);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ffd180';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*2,-20);ctx.lineTo(side*16,-36);ctx.lineTo(side*10,-17);ctx.fill();}}
 ctx.restore();
}
function drawWeapon(p,x,y,angle){const look=p.cosmetics||{},kind=look.weapon||'standard',c=G.COSMETICS.colors[look.weaponColor]?.hex||classColor(p);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=kind==='gold'?'#d8a74e':kind==='candy'?'#fff0ef':kind==='frost'?'#8bbac9':'#111c30';roundRect(7,-5,23,10,2);ctx.fill();ctx.strokeStyle=c;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=c;ctx.fillRect(14,-1.5,17,3);ctx.fillRect(9,-4,3,8);
 if(kind==='candy'){ctx.strokeStyle='#ff7192';ctx.lineWidth=2;for(let i=12;i<28;i+=6){ctx.beginPath();ctx.moveTo(i,-4);ctx.lineTo(i+4,4);ctx.stroke();}}else if(kind==='void'){circle(17,0,3,'#b394ff','#e6dcff',1);}else if(kind==='neon'){ctx.fillStyle=c;ctx.fillRect(11,-7,17,2);}else if(kind==='frost'){ctx.fillStyle='#d6fcff';ctx.beginPath();ctx.moveTo(12,-5);ctx.lineTo(17,-10);ctx.lineTo(22,-5);ctx.fill();}else if(kind==='gold'){ctx.fillStyle='#fff1b0';ctx.fillRect(18,-4,2,8);}ctx.restore();}
function drawMoveTrail(p,pos,now){const trail=p.cosmetics?.trail;if(!trail||trail==='none'||fxQuality!=='full'||Math.hypot(p.vx,p.vy)<30)return;const a=Math.atan2(p.vy,p.vx),c=classColor(p);for(let i=1;i<=5;i++){const x=pos.x-Math.cos(a)*(16+i*7),y=pos.y-Math.sin(a)*(16+i*7);ctx.save();ctx.globalAlpha*=.7-i*.09;
 if(trail==='rainbow'){ctx.strokeStyle=RAINBOW[i-1];ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(a)*9,y-Math.sin(a)*9);ctx.stroke();}
 else if(trail==='hearts'){ctx.fillStyle='#ff8cc0';ctx.beginPath();ctx.moveTo(x,y+4);ctx.bezierCurveTo(x-9,y-2,x-5,y-8,x,y-3);ctx.bezierCurveTo(x+5,y-8,x+9,y-2,x,y+4);ctx.fill();}
 else if(trail==='stars'||trail==='frost'){ctx.translate(x,y);ctx.rotate(now/900+i);ctx.strokeStyle=trail==='frost'?'#b8f5ff':'#ffe5a0';ctx.lineWidth=1.7;for(let j=0;j<(trail==='frost'?3:2);j++){ctx.rotate(Math.PI/(trail==='frost'?3:2));ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(4,0);ctx.stroke();}}
 else circle(x,y,trail==='sparks'?1.7:Math.max(1,5-i*.65),c);ctx.restore();}}
let floorLayer=null;
function paintFloor(f,id){
 const t=MAP_THEMES[id],tint=f.createLinearGradient(0,0,W,H);t.floor.forEach((c,i)=>tint.addColorStop(i/2,c));f.fillStyle=tint;f.fillRect(0,0,W,H);
 const random=G.rng(7832),tile=t.style==='tech'?80:t.style==='sand'?100:120;
 for(let x=0;x<W;x+=tile)for(let y=0;y<H;y+=tile){f.fillStyle=(x+y)% (tile*2)?'#ffffff03':'#0000000b';f.fillRect(x+2,y+2,tile-4,tile-4);f.strokeStyle=t.line+'10';f.lineWidth=1;f.strokeRect(x,y,tile,tile);
 if(t.style==='tech'){f.fillStyle=t.edge+'35';f.fillRect(x+5,y+5,3,3);if((x+y)%240===0){f.strokeStyle=t.edge+'16';f.beginPath();f.moveTo(x+12,y+12);f.lineTo(x+30,y+12);f.lineTo(x+38,y+20);f.stroke();}}
 if(t.style==='ice'&&random()<.4){f.strokeStyle=t.edge+'15';f.beginPath();f.moveTo(x+18,y+15);f.lineTo(x+70,y+44);f.lineTo(x+44,y+92);f.moveTo(x+70,y+44);f.lineTo(x+98,y+27);f.stroke();}
 if(t.style==='sand'){f.strokeStyle=t.edge+'12';f.strokeRect(x+tile/2-10,y+tile/2-10,20,20);f.fillStyle='#ddc29d0c';for(let i=0;i<4;i++)f.fillRect(x+random()*tile,y+random()*tile,2,2);}
 if(t.style==='forest'&&random()<.65){f.save();f.translate(x+random()*tile,y+random()*tile);f.rotate(random()*6);f.fillStyle=t.edge+'12';f.beginPath();f.ellipse(0,0,14,4,0,0,Math.PI*2);f.fill();f.restore();}
 if(t.style==='ember'&&random()<.4){f.strokeStyle=t.edge+'22';f.lineWidth=2;f.beginPath();f.moveTo(x+10,y+20);f.lineTo(x+43,y+47);f.lineTo(x+36,y+70);f.lineTo(x+85,y+99);f.stroke();}
 }
 f.strokeStyle=t.edge+'25';f.lineWidth=2;f.setLineDash([12,16]);f.strokeRect(38,38,W-76,H-76);f.setLineDash([]);
 for(const [x,y]of [[80,80],[W-80,80],[80,H-80],[W-80,H-80]]){f.strokeStyle=t.edge+'80';f.lineWidth=3;f.beginPath();f.moveTo(x-18,y+18);f.lineTo(x-18,y-18);f.lineTo(x+18,y-18);f.stroke();}
 f.strokeStyle=t.line+'16';f.lineWidth=2;for(const radius of [180,196]){f.beginPath();f.arc(W/2,H/2,radius,0,Math.PI*2);f.stroke();}f.font='800 66px Segoe UI';f.textAlign='center';f.fillStyle=t.edge+'09';f.fillText('ARENA',W/2,H/2+22);
 // Decorative markings are flat paint, never additional obstacles.
 f.font='12px monospace';f.fillStyle=t.edge+'44';f.fillText(t.name.toLocaleUpperCase('tr'),W/2,70);
}
function paintWall(f,w,t){
 f.fillStyle='#02081177';f.fillRect(w.x+5,w.y+10,w.w,w.h);f.fillStyle=t.wall;f.fillRect(w.x,w.y,w.w,w.h);f.fillStyle=t.top;f.fillRect(w.x,w.y,w.w,5);f.fillStyle=t.dark;f.fillRect(w.x,w.y+w.h-6,w.w,6);f.strokeStyle=t.edge+'50';f.lineWidth=1;f.strokeRect(w.x+.5,w.y+.5,w.w-1,w.h-1);
 f.fillStyle=t.edge+'77';f.fillRect(w.x+9,w.y+1,Math.max(0,w.w-18),2);
 if(t.style==='tech'||t.style==='ember'){for(let x=w.x+15;x<w.x+w.w-10;x+=45){f.fillStyle=t.dark;f.fillRect(x,w.y+14,3,Math.max(0,w.h-28));}for(const x of [w.x+7,w.x+w.w-7]){f.fillStyle=t.edge+'88';f.fillRect(x,w.y+9,2,2);}}
 if(t.style==='sand'||t.style==='forest'){f.strokeStyle=t.dark+'88';for(let y=w.y+22;y<w.y+w.h-6;y+=26){f.beginPath();f.moveTo(w.x,y);f.lineTo(w.x+w.w,y);f.stroke();}f.fillStyle=t.edge+'13';f.fillRect(w.x+6,w.y+7,Math.min(18,w.w-12),Math.max(0,w.h-16));}
 if(t.style==='ice'){f.fillStyle=t.edge+'18';f.beginPath();f.moveTo(w.x+4,w.y+8);f.lineTo(w.x+w.w-4,w.y+8);f.lineTo(w.x+4,w.y+w.h-8);f.fill();}
}
function drawFloor(){if(!floorLayer){floorLayer=document.createElement('canvas');floorLayer.width=W;floorLayer.height=H;paintFloor(floorLayer.getContext('2d'),mapTheme);}ctx.drawImage(floorLayer,0,0);}
function drawAura(p,x,y,now){
 const look=p.cosmetics||{},c=classColor(p);if(look.aura==='none'||!look.aura)return;
 ctx.save();ctx.translate(x,y);ctx.scale(1,.38);ctx.rotate(look.aura==='rune'?now/2400:0);ctx.strokeStyle=c+'88';ctx.lineWidth=2;ctx.setLineDash(look.aura==='rune'?[4,7]:look.aura==='orbit'?[32,10]:[]);circle(0,22,look.aura==='pulse'?29+Math.sin(now/300)*3:30,c+'0d',c+'88',2);ctx.restore();
 if(look.aura==='orbit'&&fxQuality==='full')for(let i=0;i<2;i++){const a=now/700+i*Math.PI;circle(x+Math.cos(a)*30,y+8+Math.sin(a)*10,2.4,c);}
}
function drawFragileFloor(f,now){
 const cracking=f.state==='cracking',broken=f.state==='broken',pulse=.6+.4*Math.sin(now/90);ctx.save();ctx.translate(f.x,f.y);
 function outline(inset=0){const r=f.r-inset,c=12;ctx.beginPath();ctx.moveTo(-r+c,-r);ctx.lineTo(r-c,-r);ctx.lineTo(r,-r+c);ctx.lineTo(r,r-c);ctx.lineTo(r-c,r);ctx.lineTo(-r+c,r);ctx.lineTo(-r,r-c);ctx.lineTo(-r,-r+c);ctx.closePath();}
 ctx.save();ctx.translate(3,6);outline(-3);ctx.fillStyle='#00000055';ctx.fill();ctx.restore();
 outline();const base=ctx.createLinearGradient(-55,-55,55,55);base.addColorStop(0,'#627b8c');base.addColorStop(.45,'#304453');base.addColorStop(1,'#172a38');ctx.fillStyle=base;ctx.fill();ctx.strokeStyle=cracking?'#ffc779':'#8197a6';ctx.lineWidth=2;ctx.stroke();
 ctx.save();outline(5);ctx.clip();if(broken){const depth=ctx.createRadialGradient(0,0,4,0,0,62);depth.addColorStop(0,'#010309');depth.addColorStop(.6,'#040b14');depth.addColorStop(1,'#203543');ctx.fillStyle=depth;ctx.fillRect(-55,-55,110,110);for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.save();ctx.rotate(a);ctx.fillStyle=i%2?'#405565':'#263c4c';ctx.beginPath();ctx.moveTo(38,-16);ctx.lineTo(53,-22);ctx.lineTo(56,20);ctx.lineTo(43,12);ctx.lineTo(33,2);ctx.closePath();ctx.fill();ctx.restore();}}else{
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){const x=-48+col*32,y=-48+row*32;ctx.fillStyle=(row+col)%2?'#344b5b':'#3b5361';ctx.fillRect(x+1,y+1,29,29);ctx.strokeStyle='#8195a31c';ctx.lineWidth=1;ctx.strokeRect(x+3,y+3,25,25);}
 ctx.strokeStyle='#071722';ctx.lineWidth=cracking?4:2;ctx.beginPath();ctx.moveTo(-47,-18);ctx.lineTo(-24,-11);ctx.lineTo(-12,4);ctx.lineTo(4,-6);ctx.lineTo(15,12);ctx.lineTo(46,21);ctx.moveTo(4,-6);ctx.lineTo(13,-28);ctx.lineTo(31,-43);ctx.moveTo(-12,4);ctx.lineTo(-25,25);ctx.lineTo(-18,48);ctx.stroke();
 if(cracking){ctx.strokeStyle=`rgba(255,177,78,${pulse})`;ctx.lineWidth=1.5;ctx.stroke();for(let i=0;i<5;i++){const y=20-((now/18+i*13)%60);circle(-27+i*14+Math.sin(i)*8,y,1.5,'#ffd18b99');}}
 }ctx.restore();
 for(const [x,y]of [[-40,-40],[40,-40],[-40,40],[40,40]]){circle(x,y,3.5,'#172b39','#8796a3',1);ctx.strokeStyle='#a7b7c0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-1.5,y);ctx.lineTo(x+1.5,y);ctx.stroke();}
 ctx.fillStyle=cracking?'#ffbb68':'#d8b56e';for(const y of [-54,50])for(let i=0;i<5;i++)ctx.fillRect(-20+i*9,y,5,3);
 if(cracking){outline(-3);ctx.strokeStyle=`rgba(255,180,80,${pulse})`;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ffd6a1';ctx.textAlign='center';ctx.font='bold 10px Segoe UI';ctx.fillText('ZEMİN ÇÖKÜYOR',0,-66);}else if(broken){ctx.fillStyle='#8aa4b5';ctx.textAlign='center';ctx.font='9px Segoe UI';ctx.fillText('ONARIM '+Math.ceil(f.timer)+'sn',0,69);}
 ctx.restore();
}
function drawPortal(p,now){
 const c=p.color||'#63e4f5';ctx.save();ctx.translate(p.x,p.y);circle(3,6,48,'#00000055');circle(0,0,46,'#111e32','#587182',3);circle(0,0,40,'#040b1c',c,2);const glow=ctx.createRadialGradient(0,0,2,0,0,36);glow.addColorStop(0,'#e7faff');glow.addColorStop(.12,c);glow.addColorStop(.5,c+'66');glow.addColorStop(1,'#071323');circle(0,0,36,glow);
 for(let i=0;i<4;i++){ctx.save();ctx.rotate(now/900+i*Math.PI/2);ctx.strokeStyle=i%2?c:c+'88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,9+i*6,.2,Math.PI*1.5);ctx.stroke();ctx.restore();}
 for(let i=0;i<8;i++){ctx.save();ctx.rotate(i*Math.PI/4-now/3500);ctx.fillStyle=c;ctx.fillRect(40,-2,5,4);ctx.restore();}if(fxQuality==='full')for(let i=0;i<7;i++){const a=now/700+i*2.4,r=15+(i*13+now/30)%22;circle(Math.cos(a)*r,Math.sin(a)*r,1.4,'#e7faffaa');}
 ctx.fillStyle=c;ctx.textAlign='center';ctx.font='bold 10px Segoe UI';ctx.fillText(p.id==='portalA'?'PORTAL A ↔ B':'PORTAL B ↔ A',0,63);ctx.restore();
}
function drawHazard(h,now){
 ctx.save();ctx.translate(h.x,h.y);
 if(h.type==='saw'){
  circle(3,7,28,'#02081488');circle(0,0,34,null,'#ff728b20',1);ctx.save();ctx.rotate(h.angle);const metal=ctx.createLinearGradient(-22,-22,24,24);metal.addColorStop(0,'#eef8ff');metal.addColorStop(.45,'#93adbf');metal.addColorStop(.55,'#d7e7ee');metal.addColorStop(1,'#526f89');ctx.fillStyle=metal;ctx.strokeStyle='#e4f6ff';ctx.lineWidth=.8;ctx.beginPath();for(let i=0;i<48;i++){const a=i*Math.PI/24,r=i%4===0?27:i%4===1?25:i%4===2?18:20;i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();circle(0,0,16,'#405b73','#a9c2d3',1);for(let i=0;i<6;i++){const a=i*Math.PI/3;circle(Math.cos(a)*11,Math.sin(a)*11,2.3,'#1a2d43','#c1d9e8',.7);}ctx.restore();circle(0,0,8,'#302438','#ff8b9d',1.5);circle(0,0,3,'#ff738e');
  if(fxQuality==='full'){ctx.strokeStyle='#daefff44';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,29+i*1.2,h.angle+i*2,h.angle+i*2+.8);ctx.stroke();}for(let i=0;i<3;i++){const a=now/180+i*2.1,r=29+(now/18+i*3)%8;ctx.strokeStyle=i%2?'#ffe4aa77':'#ff9d6a55';ctx.beginPath();ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);ctx.lineTo(Math.cos(a)*(r+4),Math.sin(a)*(r+4));ctx.stroke();}}
 }else if(h.type==='turret'){
  circle(3,7,25,'#02081488');ctx.fillStyle='#26354a';ctx.strokeStyle='#617386';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;i?ctx.lineTo(Math.cos(a)*25,Math.sin(a)*25):ctx.moveTo(Math.cos(a)*25,Math.sin(a)*25);}ctx.closePath();ctx.fill();ctx.stroke();circle(0,0,19,'#182c3d','#8593a1',1.5);for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;circle(Math.cos(a)*20,Math.sin(a)*20,2,'#b1becb');}
  const flashAt=turretFlashes.get(Math.round(h.x)+','+Math.round(h.y)),flash=flashAt===undefined?0:clamp(1-(now-flashAt)/150,0,1);if(flashAt!==undefined&&!flash)turretFlashes.delete(Math.round(h.x)+','+Math.round(h.y));
  ctx.save();ctx.rotate(h.angle);ctx.fillStyle='#354c61';roundRect(-12,-12,27,24,5);ctx.fill();ctx.strokeStyle='#829cad';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#101b2b';roundRect(5,-6,29,12,2);ctx.fill();ctx.fillStyle='#b2c1ce';ctx.fillRect(12,-5,19,3);ctx.fillStyle='#5b7188';ctx.fillRect(12,3,19,2);ctx.fillStyle='#faad78';ctx.fillRect(29,-7,5,14);ctx.fillStyle='#111b2a';ctx.fillRect(32,-4,3,8);for(let i=0;i<3;i++){ctx.fillStyle='#111e30';ctx.fillRect(-8+i*5,-8,2,6);}circle(-2,4,3,'#ff697f','#ffd2b0',1);
  if(flash>0){ctx.globalAlpha=flash;ctx.fillStyle='#fff2b6';ctx.beginPath();ctx.moveTo(34,-5);ctx.lineTo(43,-3);ctx.lineTo(51,0);ctx.lineTo(43,3);ctx.lineTo(34,5);ctx.closePath();ctx.fill();circle(36,0,7,'#ffc36c66');ctx.globalAlpha=1;}ctx.restore();
 }else{
  const active=h.active,warning=h.warning,pulse=.6+.4*Math.sin(now/130),color=active?'#ff9660':warning?'#ffd17c':'#786077';
  circle(2,5,55,'#02081488');circle(0,0,54,active?'#662b24':'#272332',color,2);circle(0,0,50,null,active?'#ffbd8055':'#8a686b33',1);
  if(active){const heat=ctx.createRadialGradient(0,0,4,0,0,51);heat.addColorStop(0,'#ffb55d');heat.addColorStop(.5,'#e86632');heat.addColorStop(1,'#72312f');circle(0,0,49,heat);}
  ctx.save();ctx.beginPath();ctx.arc(0,0,49,0,Math.PI*2);ctx.clip();
  for(let i=0;i<7;i++){const a=i*2.4,x=Math.cos(a)*23,y=Math.sin(a)*23;ctx.fillStyle=active?'#43242b':'#1b2330';ctx.strokeStyle=active?'#ffcf7988':warning?'#ffb97599':'#75556466';ctx.lineWidth=active?2:1;ctx.beginPath();for(let j=0;j<5;j++){const b=j*Math.PI*2/5+i,r=13+(i+j)%3*3;j?ctx.lineTo(x+Math.cos(b)*r,y+Math.sin(b)*r):ctx.moveTo(x+Math.cos(b)*r,y+Math.sin(b)*r);}ctx.closePath();ctx.fill();ctx.stroke();}
  if(active&&fxQuality==='full')for(let i=0;i<6;i++){const a=i*2.4,r=12+(i*17)%32;circle(Math.cos(a)*r,Math.sin(a)*r,1.5+(Math.sin(now/200+i)+1)*1.6,'#ffe09f99');}ctx.restore();
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.globalAlpha=warning?.4+pulse*.5:active?.9:.35;ctx.setLineDash([8,6]);circle(0,0,58,null,color,2);ctx.restore();
  if(active&&fxQuality==='full')for(let i=0;i<4;i++){const phase=(now/900+i*.27)%1;circle(-28+i*18+Math.sin(now/500+i)*4,-20-phase*35,1.5+phase*2,`rgba(255,181,100,${(1-phase)*.6})`);}
  ctx.font='bold 9px Segoe UI';ctx.textAlign='center';ctx.fillStyle=color;ctx.strokeStyle='#101423';ctx.lineWidth=3;const label=active?'LAV AKTİF':warning?'LAV ISINIYOR':'LAV BEKLEMEDE';ctx.strokeText(label,0,73);ctx.fillText(label,0,73);
 }ctx.restore();
}
function draw(now){
 const s=scale(),cam=camera(s);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#080f1b';ctx.fillRect(0,0,vw,vh);ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);ctx.translate(cam.x*s,cam.y*s);ctx.scale(s,s);
 drawFloor();
 if(G.isTeamMode(roomMode)){ctx.fillStyle='#ff587812';ctx.fillRect(0,0,400,H);ctx.fillStyle='#4f99ff12';ctx.fillRect(1200,0,400,H);}
 if(world.zone){const z=world.zone,color=z.contested?'#ff829b':z.holder?'#65dfc1':'#ffd166';circle(z.x,z.y,z.r,color+'16',color,3);ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();ctx.arc(z.x,z.y,z.r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp((z.nextAt-world.time)/15,0,1));ctx.stroke();ctx.fillStyle=color;ctx.font='bold 13px Segoe UI';ctx.textAlign='center';ctx.fillText(z.contested?'ÇEKİŞMELİ ALAN':'ALANI TUT',z.x,z.y-z.r+30);}
 ctx.strokeStyle=MAP_THEMES[mapTheme].top;ctx.lineWidth=5;ctx.strokeRect(0,0,W,H);
 for(const f of world.floors||[])drawFragileFloor(f,now);
 for(const portal of world.portals||[])drawPortal(portal,now);
 for(const w of map.walls){paintWall(ctx,w,MAP_THEMES[mapTheme]);if(w.dynamic==='moving'){ctx.strokeStyle='#ffe19b';ctx.lineWidth=2;ctx.strokeRect(w.x-3,w.y-3,w.w+6,w.h+6);ctx.fillStyle='#ffe19b';ctx.font='bold 14px Segoe UI';ctx.fillText(w.axis==='x'?'↔':'↕',w.x+w.w/2,w.y+w.h/2+5);}}
 for(const p of world.players){if(p.dead)continue;const pos=positionFor(p,now);if(p.tether){const t=p.tether;circle(t.x,t.y,t.length,null,'#63e4d529',1);ctx.strokeStyle='#ffe19b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(pos.x,pos.y);ctx.stroke();circle(t.x,t.y,7,'#203e49','#63e4d5',2);ctx.fillStyle='#ffe19b';ctx.font='bold 12px Segoe UI';ctx.fillText('HALAT '+t.hits+'/5 · '+Math.ceil(t.life)+'sn',(t.x+pos.x)/2,(t.y+pos.y)/2-12);}if(p.pull){const source=players.get(p.pull.owner);if(source){ctx.strokeStyle='#63e4d5';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(source.x,source.y);ctx.lineTo(pos.x,pos.y);ctx.stroke();}circle(pos.x,pos.y,23,null,'#63e4d5',3);}}

 for(const b of map.barrels){
  if(b.hp<=0){circle(b.x,b.y,16,'#05080c66');ctx.fillStyle=b.respawn<3?'#ffcf78':'#7d8da5';ctx.font='10px Segoe UI';ctx.textAlign='center';ctx.fillText('TNT '+Math.ceil(b.respawn)+'s',b.x,b.y+4);continue;}
  circle(b.x+3,b.y+6,18,'#02081288');circle(b.x,b.y,17,'#512b35','#ef976d',2);ctx.fillStyle='#db7754';ctx.fillRect(b.x-12,b.y-10,24,4);ctx.fillStyle='#251e2a';ctx.fillRect(b.x-15,b.y+7,30,4);circle(b.x+10,b.y-13,3,'#ffe3a2');ctx.fillStyle='#ffdd93';ctx.font='bold 10px Segoe UI';ctx.textAlign='center';ctx.fillText('TNT',b.x,b.y+4);ctx.fillStyle='#080e16';ctx.fillRect(b.x-16,b.y-26,32,4);ctx.fillStyle='#ffba75';ctx.fillRect(b.x-16,b.y-26,32*b.hp/50,4);
 }
 for(const h of world.hazards)drawHazard(h,now);
 for(const b of world.buffs){const c=BUFFS[b.kind],pulse=1+Math.sin(now/150+b.id)*.09;const tier=Object.keys(RARITIES).indexOf(c.rarity)+1;circle(b.x,b.y,29*pulse,'#050b1788',c.color,2);for(let i=0;i<tier;i++)circle(b.x+(i-(tier-1)/2)*6,b.y+36,1.8,c.color);circle(b.x,b.y,24*pulse,c.color+'13');if(c.legendary){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(now/1600);ctx.strokeStyle='#ffd16688';ctx.lineWidth=1.5;ctx.strokeRect(-23,-23,46,46);ctx.restore();}circle(b.x,b.y,25*pulse,c.color+'1f');circle(b.x,b.y,16*pulse,'#101b2d',c.color,c.legendary?3:2);ctx.font='17px Segoe UI Emoji';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(c.icon,b.x,b.y+6);ctx.font='bold 10px Segoe UI';ctx.fillStyle=c.color;ctx.strokeStyle='#050b17';ctx.lineWidth=3;ctx.strokeText((c.legendary?'★ ':'')+c.name,b.x,b.y-35);ctx.fillText((c.legendary?'★ ':'')+c.name,b.x,b.y-35);ctx.font='8px Segoe UI';ctx.fillText(RARITIES[c.rarity].name.toLocaleUpperCase('tr'),b.x,b.y+49);}
 const me=localPlayer();for(const m of world.mines){const owner=players.get(m.owner);if(m.owner===myId||G.isTeamMode(roomMode)&&owner?.team===me?.team){circle(m.x,m.y,11,'#3b2b1d','#ffbc6b');circle(m.x,m.y,3,'#ff795a');}else circle(m.x,m.y,5,'#7e614e');}
 const bulletAge=Math.min(.09,(now-stateAt)/1000);
 for(const b of world.bullets){let x=b.x,y=b.y;const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*bulletAge/8));for(let i=0;i<steps;i++){const nx=x+b.vx*bulletAge/steps,ny=y+b.vy*bulletAge/steps;if(nx<0||nx>W||ny<0||ny>H||G.inWall(map.walls,nx,ny))break;x=nx;y=ny;}if(b.bomb){circle(x,y,7,'#ffbd6c','#fff1bf',2);ctx.strokeStyle='#ffad6877';ctx.lineWidth=5;}else{ctx.strokeStyle=b.color+'24';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(x-b.vx*.035,y-b.vy*.035);ctx.lineTo(x,y);ctx.stroke();ctx.strokeStyle=b.color;ctx.lineWidth=3;}ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-b.vx*.023,y-b.vy*.023);ctx.lineTo(x,y);ctx.stroke();if(b.kind==='hook'||b.kind==='net'){const owner=players.get(b.owner);ctx.save();ctx.strokeStyle='#63e4d5';ctx.lineWidth=b.kind==='hook'?3:2;if(b.kind==='hook'&&owner){ctx.beginPath();ctx.moveTo(owner.x,owner.y);ctx.lineTo(x,y);ctx.stroke();}ctx.translate(x,y);ctx.rotate(Math.atan2(b.vy,b.vx));if(b.kind==='hook'){ctx.fillStyle='#b6fff0';roundRect(-10,-12,22,24,6);ctx.fill();ctx.strokeRect(-10,-12,22,24);}else{ctx.beginPath();ctx.ellipse(0,0,18,26,0,0,Math.PI*2);ctx.stroke();for(let k=-16;k<=16;k+=8){ctx.beginPath();ctx.moveTo(-14,k);ctx.lineTo(14,k);ctx.stroke();ctx.beginPath();ctx.moveTo(k*.7,-22);ctx.lineTo(k*.7,22);ctx.stroke();}}ctx.restore();}else if(b.kind){circle(x,y,b.kind==='frost'?7:10,b.color+'77',b.color,2);circle(x,y,3,'#fff');}else if(!b.bomb)circle(x,y,2.8,'#f5faff');}
 if(world.flag&&!world.flag.owner){const f=world.flag;circle(f.x,f.y,33,'#ffc85722','#ffc85766');drawFlag(f.x,f.y,now);}
 for(const p of players.values()){
  if(p.dead||!p.connected)continue;ctx.globalAlpha=p.invis>0?.38:1;const pos=positionFor(p,now),c=classColor(p),angle=p.id===myId?aim:p.a;
  drawAura(p,pos.x,pos.y,now);
  drawMoveTrail(p,pos,now);
  ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(pos.x,pos.y+16,18,7,0,0,Math.PI*2);ctx.fill();
  if(p.dash>.02){for(let i=1;i<=3;i++)circle(pos.x-Math.cos(angle)*i*12,pos.y-Math.sin(angle)*i*12,RAD-i*2,c+'33');}
  if(G.isTeamMode(roomMode))circle(pos.x,pos.y,RAD+5,null,TEAM_COLORS[p.team],3);
  const bodyTint=ctx.createRadialGradient(pos.x-6,pos.y-8,1,pos.x,pos.y,22);bodyTint.addColorStop(0,'#eaffff');bodyTint.addColorStop(.3,c);bodyTint.addColorStop(1,'#152539');circle(pos.x,pos.y,RAD,bodyTint,p.id===myId?'#f4faff':'#dbe6f577',p.id===myId?3:2);
  drawCosmetics(p,pos.x,pos.y);
  drawWeapon(p,pos.x,pos.y,angle);
  if(p.shield>0)circle(pos.x,pos.y,26+Math.sin(now/100),null,'#78e6ef',2);
  if(p.invuln>0){circle(pos.x,pos.y,29,null,'#b8f4ffcc',2);ctx.fillStyle='#c4f7ff';ctx.textAlign='center';ctx.font='bold 10px Segoe UI';ctx.fillText('KORUMA '+p.invuln.toFixed(1)+'sn',pos.x,pos.y-42);}
  if(p.root>0){circle(pos.x,pos.y,24,null,'#83e8ff',3);ctx.fillStyle='#b9f5ff';ctx.font='bold 18px Segoe UI';ctx.fillText('❄',pos.x,pos.y-48);}
  if(p.buffs.armor>0||p.buffs.titan>0)circle(pos.x,pos.y,22,null,p.buffs.titan>0?'#ffd16699':'#69adff88',2);
  if(p.buffs.regen>0)circle(pos.x,pos.y,19,null,'#69d99066',1);
  if(p.overdrive>0)circle(pos.x,pos.y,23,null,'#ffaf64',3);
  if(p.haste>0)circle(pos.x,pos.y,21,null,'#69e3ba88',2);
  ctx.fillStyle='#050c16bb';roundRect(pos.x-25,pos.y-37,50,6,3);ctx.fill();ctx.fillStyle=p.hp/p.maxHp>.35?'#71deac':'#ff7791';roundRect(pos.x-25,pos.y-37,50*clamp(p.hp/p.maxHp,0,1),6,3);ctx.fill();
  if(p.shield>0){ctx.fillStyle='#15313f';ctx.fillRect(pos.x-25,pos.y-44,50,3);ctx.fillStyle='#79e9ed';ctx.fillRect(pos.x-25,pos.y-44,50*clamp(p.shield/(p.shieldMax||120),0,1),3);}
  ctx.font='bold 12px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#edf5ff';ctx.strokeStyle='#07111e';ctx.lineWidth=4;const label=p.name+(p.id===myId?' (sen)':p.allyDecoy?' · yansıma':'');ctx.strokeText(label,pos.x,pos.y-51);ctx.fillText(label,pos.x,pos.y-51);
  ctx.font='9px Segoe UI';ctx.fillStyle=c;ctx.fillText(CLASSES[p.classId].name+(G.isTeamMode(roomMode)?' · '+(p.team===0?'KIRMIZI':'MAVİ'):''),pos.x,pos.y+36);
  if(world.flag?.owner===p.id)drawFlag(pos.x+22,pos.y-40,now);ctx.globalAlpha=1;
 }
 for(const label of damageLabels){ctx.globalAlpha=clamp(label.life/.25,0,1);ctx.font='bold 15px Segoe UI';ctx.textAlign='center';ctx.strokeStyle='#07111e';ctx.lineWidth=4;ctx.strokeText(label.text,label.x,label.y);ctx.fillStyle=label.color;ctx.fillText(label.text,label.x,label.y);}ctx.globalAlpha=1;
 for(const r of rings){const k=r.t/r.max;ctx.globalAlpha=1-k;circle(r.x,r.y,r.r*(.3+.7*k),null,r.color,6*(1-k)+2);ctx.globalAlpha=1;}
 for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);circle(p.x,p.y,p.size,p.color);}ctx.globalAlpha=1;
 ctx.setTransform(dpr,0,0,dpr,0,0);if(shieldFlash>0){ctx.strokeStyle=`rgba(90,225,245,${shieldFlash})`;ctx.lineWidth=14;ctx.strokeRect(0,0,vw,vh);}if(now<hitUntil){ctx.strokeStyle=hitColor;ctx.lineWidth=3;for(const [dx,dy]of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(mouse.x+dx*5,mouse.y+dy*5);ctx.lineTo(mouse.x+dx*12,mouse.y+dy*12);ctx.stroke();}}if(hurtFlash>0){ctx.fillStyle=`rgba(255,40,70,${hurtFlash*.16})`;ctx.fillRect(0,0,vw,vh);}drawMini(now);
}
function drawFlag(x,y,now){ctx.strokeStyle='#ffe19b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y+10);ctx.lineTo(x,y-22);ctx.stroke();ctx.fillStyle='#ffc857';ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x+24,y-18+Math.sin(now/170)*3);ctx.lineTo(x,y-6);ctx.closePath();ctx.fill();}
function drawMini(now){
 if(vw<700)return;const width=170,height=width*H/W,x=vw-width-14,y=vh-height-14,k=width/W;ctx.fillStyle='#081322e6';roundRect(x,y,width,height,9);ctx.fill();ctx.strokeStyle='#304a68';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=MAP_THEMES[mapTheme].top;for(const w of map.walls)ctx.fillRect(x+w.x*k,y+w.y*k,w.w*k,w.h*k);for(const p of world.portals||[])circle(x+p.x*k,y+p.y*k,4,null,p.color,1.5);
 for(const p of players.values())if(!p.dead&&p.connected){const pos=positionFor(p,now);circle(x+pos.x*k,y+pos.y*k,p.id===myId?3.5:2.5,classColor(p),G.isTeamMode(roomMode)?TEAM_COLORS[p.team]:p.id===myId?'#fff':null,1);}
 if(world.zone)circle(x+world.zone.x*k,y+world.zone.y*k,world.zone.r*k,'#ffd16622','#ffd166',1);
 if(world.flag)circle(x+world.flag.x*k,y+world.flag.y*k,4,'#ffd166');
}
function setHTML(el,html){if(el._html!==html){el._html=html;el.innerHTML=html;}}
function updateMatchEnd(me){
 const m=world.match,finished=m?.status==='finished';$('matchEnd').classList.toggle('hidden',!finished);
 if(!finished)return;
 const won=m.winner?.kind==='team'?m.winner.team===me.team:m.winner?.id===myId;
 $('resultTitle').textContent=won?'ZAFER!':'MAÇ TAMAMLANDI';$('resultTitle').style.color=won?'#79e5c4':'#eaf1ff';
 $('resultWinner').textContent=(m.winner?.name||'Kazanan')+' kazandı';
 const elapsed=Math.floor(m.finishedAt||0);$('resultMode').textContent=MODES[roomMode].name+' · Hedef '+m.target+' '+MODES[roomMode].unit+' · '+Math.floor(elapsed/60)+':'+String(elapsed%60).padStart(2,'0');
 const best=[...m.results].sort((a,b)=>b.kills-a.kills)[0];$('resultHighlight').textContent=['flag','zone','zoneTeam'].includes(roomMode)&&m.results[0]?'Hedefte en uzun: '+m.results[0].name+' · '+m.results[0].score+' saniye'+(best?.kills>0?' / En çok öldürme: '+best.name+' · '+best.kills:''):(best?'En çok öldürme: '+best.name+' · '+best.kills:'');
 setHTML($('resultRows'),m.results.map((p,i)=>`<tr><td>${i+1}. ${esc(p.name)}${p.id===myId?' · sen':''}</td><td>${p.score}${['flag','zone','zoneTeam'].includes(roomMode)?' sn':''}</td><td>${p.kills} / ${p.deaths}</td></tr>`).join(''));
 $('rematch').disabled=!!m.ready;$('rematch').textContent=m.ready?'HAZIRSIN ✓':'RÖVANŞA HAZIRIM';$('rematchStatus').textContent=`Hazır oyuncular: ${m.readyCount} / ${m.required} · herkes hazır olduğunda aynı odada yeniden başlar`;
}
function updateHUD(){
 const me=localPlayer();if(!me||!world)return;updateMatchEnd(me);
 const critical=!me.dead&&me.hp/me.maxHp<=.25&&world.match?.status!=='finished';$('lowHealth').classList.toggle('hidden',!critical);$('hpwrap').classList.toggle('critical',critical);if(critical&&!criticalActive)sound('warning');criticalActive=critical;
 $('matchGoal').textContent='Hedef: '+(world.match?.target||MODES[roomMode].target)+' '+MODES[roomMode].unit;
 const roster=world.roster||[...players.values()];$('count').textContent='Oyuncu: '+roster.filter(p=>p.connected&&!p.bot).length+' · Bot: '+roster.filter(p=>p.connected&&p.bot).length;$('roompill').textContent='Oda: '+roomCode;
 $('ping').textContent=`Ping: ${ping===null?'–':Math.round(ping)+' ms'} · ${Math.round(1000/Math.max(1,frameMs))} FPS`;
 $('hpbar').style.width=clamp(me.hp/me.maxHp*100,0,100)+'%';$('hptext').textContent=Math.ceil(me.hp)+' / '+me.maxHp+(me.shield>0?' · 🛡 '+Math.ceil(me.shield)+' · '+(me.shieldTime||0).toFixed(1)+'sn':'');$('shieldbar').style.width=clamp(me.shield/(me.shieldMax||120)*100,0,100)+'%';$('shieldwrap').classList.toggle('hidden',me.shield<=0);
 $('classPill').textContent=CLASSES[me.classId].name+(me.invis>0?' · GİZLİ':me.ricochetBoost>0?' · Sekme Ustası '+Math.ceil(me.ricochetBoost)+'s':'')+(G.isTeamMode(roomMode)?' · '+(me.team===0?'Kırmızı takım':'Mavi takım'):'');
 const active=Object.entries(me.buffs).filter(([k,t])=>t>0&&k!=='shield').map(([k,t])=>`<span class="buff-chip ${BUFFS[k].legendary?'legendary':''}" title="${RARITIES[BUFFS[k].rarity].name}: ${BUFFS[k].description}" style="--buff-color:${BUFFS[k].color}">${BUFFS[k].legendary?'★ ':''}${BUFFS[k].icon} ${BUFFS[k].name} ${Math.ceil(t)}s</span>`).join('');setHTML($('buffrow'),active);
 CLASSES[me.classId].skills.forEach((skill,i)=>{const el=$('sk-'+i),cd=me.cds[i];el.querySelector('.ico').textContent=skill.icon;el.querySelector('.key').textContent=keyLabel(bindings['skill'+(i+1)]);el.querySelector('.sname').textContent=skill.name;el.querySelector('.cdmask').style.height=clamp(cd/skill.cd*100,0,100)+'%';el.querySelector('.cdnum').textContent=cd>0?(cd<3?cd.toFixed(1):Math.ceil(cd)):(me.classId==='scout'&&i===2?me.ultShots+'/3':'');el.classList.toggle('ready',cd<=0);});
 const list=(world.roster||[...players.values()]).filter(p=>p.connected).sort((a,b)=>b.score-a.score||b.kills-a.kills);
 $('score').querySelector('h3').textContent=MODES[roomMode].name;
 $('scoreUnit').textContent=roomMode==='zoneTeam'?'TAKIM PUANI = RAKİPSİZ ALAN SANİYESİ':roomMode==='zone'?'PUAN = ALANI TEK BAŞINA TUTTUĞUN SANİYE':roomMode==='flag'?'PUAN = BAYRAĞI TAŞIDIĞIN SANİYE':'OYUNCU ÖLDÜRME SAYISI';
 setHTML($('score').querySelector('table'),list.slice(0,16).map((p,i)=>`<tr><td style="color:${p.id===myId?'#f5faff':classColor(p)}">${i+1}. ${esc(p.name)}${p.id===myId?' · sen':''}</td><td>${p.score}${['flag','zone','zoneTeam'].includes(roomMode)?' sn':''}</td></tr>`).join(''));
 $('teamScore').classList.toggle('hidden',!G.isTeamMode(roomMode));if(G.isTeamMode(roomMode))setHTML($('teamScore'),`<span class="red">KIRMIZI ${world.teamScores[0]} · ${world.roster.filter(p=>p.connected&&p.team===0).length} oyuncu</span><span class="blue">MAVİ ${world.teamScores[1]} · ${world.roster.filter(p=>p.connected&&p.team===1).length} oyuncu</span>`);
 if(roomMode==='zone'||roomMode==='zoneTeam'){const z=world.zone;$('modeNotice').textContent=`◎ ${z.contested?'Alan çekişmeli · puan durdu':(z.holder===myId||roomMode==='zoneTeam'&&z.team===me.team)?'Alan sende · saniyede +1 puan':(roomMode==='zoneTeam'?'Takımınla alanı tut':'Alanı tek başına tut')} · ${Math.max(0,Math.ceil(z.nextAt-world.time))}s sonra taşınır`;}
 else if(roomMode==='flag'){const carrier=knownPlayer(world.flag?.owner);$('modeNotice').textContent=carrier?`⚑ ${carrier.name} bayrağı taşıyor · her saniye +1 puan`:'⚑ Ortadaki bayrağı al. Taşıyanı öldürürsen bayrak sana geçer.';}
 else $('modeNotice').textContent=G.isTeamMode(roomMode)?`${me.team===0?'Kırmızı':'Mavi'} takımdasın · dost ateşi kapalı · tehlikeler kapalı`:'Normal Arena · hareketli duvarlar, portallar ve kırılgan zemine dikkat!';
 $('deathClassPanel').classList.toggle('hidden',!me.dead);
 if(me.dead){
  setHTML($('deathClasses'),Object.entries(CLASSES).map(([id,c])=>`<button data-death-class="${id}" class="${(me.nextClass||me.classId)===id?'selected':''}">${c.icon} ${c.name}</button>`).join(''));
  $('nextClassText').textContent=me.nextClass?'Yeniden doğunca: '+CLASSES[me.nextClass].name:'Yeniden doğmadan sınıfını seçebilirsin.';
 }
 $('respawn').textContent='Yeniden doğuş: '+Math.max(0,me.respawn).toFixed(1)+' saniye';$('hint').textContent=me.invuln>0&&!me.dead?'Doğuş koruması: '+me.invuln.toFixed(1)+'sn · Ateş veya yetenek kullanınca kalkar':`${keyLabel(bindings.skill1)} / ${keyLabel(bindings.skill2)} / ${keyLabel(bindings.skill3)}: yetenekler · ${keyLabel(bindings.mute)}: ses`;
}
renderLobby();
