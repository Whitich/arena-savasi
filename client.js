'use strict';
const G=window.ArenaCore,$=id=>document.getElementById(id),cv=$('cv'),ctx=cv.getContext('2d');
const {CLASSES,MODES,BUFFS,clamp,W,H,RAD}=G;
const TEAM_COLORS=['#ff728b','#68a8ff'];
const BIND_LABELS={up:'Yukarı',down:'Aşağı',left:'Sol',right:'Sağ',fire:'Ateş (klavye)',skill1:'1. yetenek',skill2:'2. yetenek',skill3:'3. yetenek',mute:'Sesi aç / kapat'};
const store={get(k,fallback){try{return JSON.parse(localStorage.getItem(k))??fallback;}catch{return fallback;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}};
let bindings={...G.DEFAULT_BINDINGS,...store.get('arena_bindings_v2',{})};
// Discard corrupt settings rather than leaving controls inaccessible.
if(Object.values(bindings).some(v=>typeof v!=='string')||new Set(Object.values(bindings)).size!==Object.keys(G.DEFAULT_BINDINGS).length)bindings={...G.DEFAULT_BINDINGS};
let selectedClass=store.get('arena_class','assault');if(!CLASSES[selectedClass])selectedClass='assault';
let cosmetics=G.normalizeCosmetics(store.get('arena_cosmetics_v1',{color:Object.keys(G.COSMETICS.colors)[Math.floor(Math.random()*10)]}));
store.set('arena_cosmetics_v1',cosmetics);
let selectedMode='normal',lobbyAction=location.hash.length>1?'join':'create',bindingAction=null;
let ws=null,playing=false,connecting=false,intentional=false,retryTimer=null,retryCount=0;
let myId=null,roomCode='',roomMode='normal',token=null,map={walls:[],barrels:[],hazards:[]},world=null;
let stateAt=0,lastMessageAt=0,lastSendAt=0,lastPingAt=0,ping=null,pendingPing=0,frameMs=16.7,renderPos=null;
const players=new Map(),tracks=new Map(),particles=[],rings=[],keys=new Set();let firing=false,aim=0,shake=0,hurtFlash=0;
let mouse={x:innerWidth/2,y:innerHeight/2,moved:false},vw=innerWidth,vh=innerHeight,dpr=1;
const damageLabels=[];let hitUntil=0,hitColor='#fff',shieldFlash=0,killToastUntil=0,criticalActive=false;
let actx=null,muted=store.get('arena_muted',false),lastHurtSound=0;
function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function keyLabel(code){if(code==='Space')return'BOŞLUK';if(code.startsWith('Key'))return code.slice(3);if(code.startsWith('Digit'))return code.slice(5);return({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',ShiftLeft:'SOL SHIFT',ShiftRight:'SAĞ SHIFT'})[code]||code;}
function classColor(p){return G.COSMETICS.colors[p.cosmetics?.color]?.hex||CLASSES[p.classId]?.color||'#7cacf0';}
function localPlayer(){return players.get(myId);}
function knownPlayer(id){return players.get(id)||world?.roster?.find(p=>p.id===id);}
function showError(message){$('lobbyError').textContent=message;}
function renderCustomizer(){
 $('colorChoices').innerHTML=Object.entries(G.COSMETICS.colors).map(([id,c])=>`<button class="swatch ${cosmetics.color===id?'selected':''}" style="--swatch:${c.hex}" data-color="${id}" title="${c.name}" aria-label="${c.name}" aria-pressed="${cosmetics.color===id}"></button>`).join('');
 for(const [id,key,choices]of [['patternChoice','pattern',G.COSMETICS.patterns],['hatChoice','hat',G.COSMETICS.hats]]){$(id).innerHTML=Object.entries(choices).map(([value,name])=>`<option value="${value}">${name}</option>`).join('');$(id).value=cosmetics[key];}
 const c=G.COSMETICS.colors[cosmetics.color].hex;
 const pattern={plain:'',stripe:'<path d="M29 50L71 74M29 63L65 83" stroke="#fff" stroke-width="7" opacity=".7"/>',cross:'<path d="M50 42V82M30 62H70" stroke="#fff" stroke-width="8" opacity=".8"/>',star:'<path d="M50 41L56 55L72 56L60 66L64 82L50 73L36 82L40 66L28 56L44 55Z" fill="#fff" opacity=".85"/>'}[cosmetics.pattern];
 const hat={none:'',crown:'<path d="M27 35L24 16L40 25L50 10L60 25L76 16L73 35Z" fill="#ffd166" stroke="#fff1bc" stroke-width="2"/>',horns:'<path d="M29 38Q12 25 21 9L39 34M71 38Q88 25 79 9L61 34" fill="#f3e0c0"/>',antenna:'<path d="M50 35V14" stroke="#dceaff" stroke-width="4"/><circle cx="50" cy="10" r="7" fill="#ff728b"/>'}[cosmetics.hat];
 $('avatarPreview').innerHTML=`<svg viewBox="0 0 100 110" role="img" aria-label="Seçtiğin karakter"><defs><clipPath id="avatarClip"><circle cx="50" cy="62" r="27"/></clipPath></defs><ellipse cx="50" cy="98" rx="29" ry="6" fill="#0004"/><circle cx="50" cy="62" r="27" fill="${c}" stroke="#eaf4ff" stroke-width="3"/><g clip-path="url(#avatarClip)">${pattern}</g>${hat}<rect x="64" y="58" width="26" height="8" rx="3" fill="#17283e"/><rect x="73" y="60" width="18" height="4" fill="#d6e8fa"/></svg>`;
}
function saveCosmetics(){store.set('arena_cosmetics_v1',cosmetics);renderCustomizer();}
$('colorChoices').onclick=e=>{const b=e.target.closest('[data-color]');if(b){cosmetics.color=b.dataset.color;saveCosmetics();}};
$('patternChoice').onchange=()=>{cosmetics.pattern=$('patternChoice').value;saveCosmetics();};
$('hatChoice').onchange=()=>{cosmetics.hat=$('hatChoice').value;saveCosmetics();};
function renderLobby(){
 renderCustomizer();
 $('createTab').classList.toggle('active',lobbyAction==='create');$('joinTab').classList.toggle('active',lobbyAction==='join');
 $('createTab').setAttribute('aria-selected',String(lobbyAction==='create'));$('joinTab').setAttribute('aria-selected',String(lobbyAction==='join'));
 $('createOptions').classList.toggle('hidden',lobbyAction!=='create');
 $('roomLabel').textContent=lobbyAction==='create'?'Oda kodu · isteğe bağlı':'Katılacağın odanın kodu';
 $('room').placeholder=lobbyAction==='create'?'Boş bırakırsan otomatik oluşturulur':'Örn: ARENA';
 $('start').textContent=connecting?'BAĞLANIYOR…':lobbyAction==='create'?'ODAYI OLUŞTUR':'ODAYA KATIL';$('start').disabled=connecting;
 $('roomHint').textContent=lobbyAction==='create'?'Oda kurulduktan sonra linki arkadaşlarınla paylaş. Katılan herkes seçtiğin oyun moduna girer.':'Oyun modu odayı kuran kişi tarafından belirlenir. Sınıfını seçip oda koduyla katıl.';
 $('modeList').innerHTML=Object.entries(MODES).map(([id,m])=>`<button class="mode ${id===selectedMode?'selected':''}" data-mode="${id}" aria-pressed="${id===selectedMode}"><strong>${m.name}</strong><small>${m.description} · Hedef: ${m.target} ${m.unit}</small></button>`).join('');
 $('classList').innerHTML=Object.entries(CLASSES).map(([id,c])=>`<button class="class-card ${id===selectedClass?'selected':''}" style="--class-color:${c.color}" data-class="${id}" aria-pressed="${id===selectedClass}"><span class="class-top"><span><strong>${c.name}</strong>${id===selectedClass?'<span class="selected-mark">SEÇİLDİ</span>':''}</span><span class="class-icon">${c.icon}</span></span><span class="class-stats"><span>♥ ${c.hp} CAN</span><span>➜ ${c.speed} HIZ</span></span><p>${c.description}</p></button>`).join('');
 $('skillPreview').innerHTML=CLASSES[selectedClass].skills.map((s,i)=>`<div class="preview"><span class="key">${keyLabel(bindings['skill'+(i+1)])}</span><strong>${s.icon} ${s.name}</strong>${s.cd} saniye bekleme</div>`).join('');
 $('controlsSummary').textContent=`${['up','left','down','right'].map(k=>keyLabel(bindings[k])).join(' / ')}: hareket · Sol tık / ${keyLabel(bindings.fire)}: ateş · ${keyLabel(bindings.mute)}: ses`;
}
$('classList').onclick=e=>{const b=e.target.closest('[data-class]');if(!b)return;selectedClass=b.dataset.class;store.set('arena_class',selectedClass);renderLobby();};
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
function burst(x,y,color,n=12){for(let i=0;i<n&&particles.length<500;i++){const a=Math.random()*Math.PI*2,s=60+Math.random()*220;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+Math.random()*.3,max:.55,color,size:2+Math.random()*2});}}
function effects(events){
 for(const e of events){
  if(e.t==='shot'){sound(e.bomb?'bomb':'shoot',e.x,e.y);burst(e.x+Math.cos(players.get(e.id)?.a||0)*24,e.y+Math.sin(players.get(e.id)?.a||0)*24,'#ffe5aa',3);}
  else if(e.t==='turret')sound('shoot',e.x,e.y);
  else if(e.t==='hit'){
   if(e.id===myId){if(e.amount>0)hurtFlash=.5;else shieldFlash=.3;if(performance.now()-lastHurtSound>150){sound(e.amount>0?'hurt':'shieldHit');lastHurtSound=performance.now();}}
   if(e.owner===myId){
    hitUntil=performance.now()+150;hitColor=e.amount>0?'#f2f8ff':'#78e7ef';sound(e.amount>0?'hit':'shieldHit');
    if(damageLabels.length>35)damageLabels.shift();damageLabels.push({x:e.x,y:e.y-28,life:.65,text:e.amount>0?'-'+e.amount:'🛡 '+(e.absorbed||0),color:hitColor});
   }
   burst(e.x,e.y,e.amount>0?'#ff94aa':'#78e7ef',4);
  }else if(e.t==='shieldBreak'){sound('shieldBreak',e.x,e.y);burst(e.x,e.y,'#78e7ef',24);rings.push({x:e.x,y:e.y,r:60,t:0,max:.32,color:'#78e7ef'});if(e.id===myId)shieldFlash=.65;}
  else if(e.t==='matchEnd'){resetInputs();if(e.winner?.id===myId||e.winner?.kind==='team'&&e.winner.team===localPlayer()?.team)sound('victory');}
  else if(e.t==='matchStart'){addFeed('Rövanş başladı!',true);}
  else if(e.t==='explosion'){rings.push({x:e.x,y:e.y,r:e.r,t:0,max:.45,color:e.color||'#ffad68'});burst(e.x,e.y,e.color||'#ffad68',20);sound('boom',e.x,e.y);if(renderPos&&Math.hypot(e.x-renderPos.x,e.y-renderPos.y)<400)shake=6;}
  else if(e.t==='dash'){burst(e.x,e.y,classColor(players.get(e.id)||{}),12);sound('dash',e.x,e.y);}
  else if(e.t==='skill')burst(e.x,e.y,'#9ae8ea',10);
  else if(e.t==='pickup'){burst(e.x,e.y,BUFFS[e.kind].color,16);sound('buff',e.x,e.y);if(e.id===myId)addFeed(`${BUFFS[e.kind].legendary?'★ EFSANEVİ · ':''}${BUFFS[e.kind].name} aldın!`,true);}
  else if(e.t==='death'){
   const victim=knownPlayer(e.id),killer=knownPlayer(e.killer);burst(e.x,e.y,victim?classColor(victim):'#ff829b',25);addFeed(killer?`${killer.name} → ${victim?.name||'Oyuncu'}`:`${victim?.name||'Oyuncu'} haritaya yenildi`);
   if(e.killer===myId){sound('kill');hitUntil=performance.now()+450;hitColor='#ffd166';killToastUntil=performance.now()+1500;$('killToast').textContent=(victim?.name||'Rakip')+' saf dışı!';$('killToast').classList.remove('hidden');}
   if(e.id===myId){sound('die');$('deadmsg').textContent=killer?`${killer.name} seni öldürdü`:'Harita hasarı';resetInputs();}
  }else if(e.t==='respawn'&&e.id===myId){renderPos={x:e.x,y:e.y};}
  else if(e.t==='flag'){const owner=players.get(e.owner);addFeed(owner?`⚑ Bayrak ${owner.name} oyuncusunda`:'⚑ Bayrak yere düştü',true);}
  else if(e.t==='barrel')burst(e.x,e.y,'#ffba72',8);
 }
}
function endpoint(){return window.ARENA_SERVER_URL||((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');}
function send(o){if(ws?.readyState!==1)return;if(ws.bufferedAmount>32768){if(o.t==='input')return;if(ws.bufferedAmount>262144){ws.close();return;}}ws.send(JSON.stringify(o));}
function sessionRead(code){try{return JSON.parse(sessionStorage.getItem('arena_session_'+code));}catch{return null;}}
function sessionWrite(){try{sessionStorage.setItem('arena_session_'+roomCode,JSON.stringify({token,classId:localPlayer()?.classId||selectedClass,mode:roomMode}));}catch{}}
function applyState(s,initial=false){
 const wasFinished=world?.match?.status==='finished';const changed=world?.match?.round!==s.match?.round;if(changed){tracks.clear();renderPos=null;particles.length=0;rings.length=0;damageLabels.length=0;hitUntil=0;resetInputs();}
 const now=performance.now();stateAt=now;world=s;roomMode=s.mode;if(s.match?.status==='finished'&&!wasFinished)resetInputs();
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
  if(playing){resetInputs();$('status').textContent='Bağlantı kesildi';$('connecting').classList.remove('hidden');retryTimer=setTimeout(()=>connectRoom({t:'join',code:roomCode,name:$('name').value||'Oyuncu',classId:localPlayer()?.classId||selectedClass,token,cosmetics,mode:roomMode,resume:true},true),Math.min(8000,1000*2**retryCount++));}
  else{showError('Sunucuya bağlanılamadı. Ücretsiz sunucu uyanıyorsa biraz bekleyip tekrar dene.');renderLobby();}
 };
}
function start(){
 if(playing||connecting)return;initAudio();showError('');
 const code=$('room').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);if(lobbyAction==='join'&&!code){showError('Katılacağın odanın kodunu yaz.');return;}
 const name=$('name').value.trim().slice(0,14)||'Oyuncu';$('name').value=name;store.set('arena_name',name);
 const previous=lobbyAction==='join'?sessionRead(code):null;
 connectRoom({t:lobbyAction,code,name,classId:selectedClass,cosmetics,mode:selectedMode,token:previous?.classId===selectedClass?previous.token:undefined});
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
 if(!playing||world?.match?.status==='finished'||$('settings').open||e.target.closest('input,button,textarea,select'))return;
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
  const c=CLASSES[me.classId],age=Math.min(.15,(now-stateAt)/1000);let speed=c.speed*(me.buffs.speed>0?1.45:1)*(me.haste>0?1.5:1)*(me.slow>0?.55:1);
  if(me.dash>age){mx=Math.cos(me.a);my=Math.sin(me.a);speed=me.classId==='guardian'?850:1100;}
  renderPos=G.resolve(map,renderPos.x+mx*speed*dt,renderPos.y+my*speed*dt);
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
 const look=G.normalizeCosmetics(p.cosmetics,p.id);
 ctx.save();ctx.beginPath();ctx.arc(x,y,RAD-1,0,Math.PI*2);ctx.clip();ctx.strokeStyle='#ffffffb0';ctx.fillStyle='#ffffffe0';ctx.lineWidth=4;
 if(look.pattern==='stripe'){for(const offset of [-10,1,12]){ctx.beginPath();ctx.moveTo(x-22,y+offset-10);ctx.lineTo(x+22,y+offset+14);ctx.stroke();}}
 else if(look.pattern==='cross'){ctx.beginPath();ctx.moveTo(x-11,y);ctx.lineTo(x+11,y);ctx.moveTo(x,y-11);ctx.lineTo(x,y+11);ctx.stroke();}
 else if(look.pattern==='star'){ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?5:12;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();}ctx.restore();
 if(look.hat==='crown'){ctx.fillStyle='#ffd166';ctx.strokeStyle='#fff1bc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-12,y-16);ctx.lineTo(x-14,y-28);ctx.lineTo(x-5,y-23);ctx.lineTo(x,y-32);ctx.lineTo(x+5,y-23);ctx.lineTo(x+14,y-28);ctx.lineTo(x+12,y-16);ctx.closePath();ctx.fill();ctx.stroke();}
 else if(look.hat==='horns'){ctx.fillStyle='#f3e0c0';for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(x+side*8,y-13);ctx.quadraticCurveTo(x+side*26,y-20,x+side*18,y-32);ctx.lineTo(x+side*15,y-15);ctx.fill();}}
 else if(look.hat==='antenna'){ctx.strokeStyle='#dceaff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y-15);ctx.lineTo(x,y-29);ctx.stroke();circle(x,y-31,4,'#ff728b');}
}
function draw(now){
 const s=scale(),cam=camera(s);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#080f1b';ctx.fillRect(0,0,vw,vh);ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);ctx.translate(cam.x*s,cam.y*s);ctx.scale(s,s);
 ctx.fillStyle='#101b2c';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#24354b66';ctx.lineWidth=1;
 for(let x=0;x<=W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<=H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 if(roomMode==='tdm'){ctx.fillStyle='#ff587812';ctx.fillRect(0,0,400,H);ctx.fillStyle='#4f99ff12';ctx.fillRect(1200,0,400,H);}
 if(world.zone){const z=world.zone,color=z.contested?'#ff829b':z.holder?'#65dfc1':'#ffd166';circle(z.x,z.y,z.r,color+'16',color,3);ctx.strokeStyle=color;ctx.lineWidth=6;ctx.beginPath();ctx.arc(z.x,z.y,z.r+7,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp((z.nextAt-world.time)/15,0,1));ctx.stroke();ctx.fillStyle=color;ctx.font='bold 13px Segoe UI';ctx.textAlign='center';ctx.fillText(z.contested?'ÇEKİŞMELİ ALAN':'ALANI TUT',z.x,z.y-z.r+30);}
 ctx.strokeStyle='#526d92';ctx.lineWidth=5;ctx.strokeRect(0,0,W,H);
 for(const w of map.walls){ctx.fillStyle='#223752';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#3b5478';ctx.fillRect(w.x,w.y,w.w,7);ctx.strokeStyle='#7ca5da33';ctx.lineWidth=1;ctx.strokeRect(w.x+.5,w.y+.5,w.w-1,w.h-1);}
 for(const b of map.barrels){
  if(b.hp<=0){circle(b.x,b.y,16,'#05080c66');ctx.fillStyle=b.respawn<3?'#ffcf78':'#7d8da5';ctx.font='10px Segoe UI';ctx.textAlign='center';ctx.fillText('TNT '+Math.ceil(b.respawn)+'s',b.x,b.y+4);continue;}
  circle(b.x,b.y,16,'#874c31','#cf8b5a',2.5);ctx.fillStyle='#ffdd93';ctx.font='bold 10px Segoe UI';ctx.textAlign='center';ctx.fillText('TNT',b.x,b.y+4);ctx.fillStyle='#080e16';ctx.fillRect(b.x-16,b.y-26,32,4);ctx.fillStyle='#ffba75';ctx.fillRect(b.x-16,b.y-26,32*b.hp/50,4);
 }
 for(const h of world.hazards){
  if(h.type==='saw'){
   ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.angle);ctx.fillStyle='#c2d1e6';ctx.beginPath();for(let j=0;j<24;j++){const a=j*Math.PI/12,r=j%2?18:27;const x=Math.cos(a)*r,y=Math.sin(a)*r;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();circle(0,0,9,'#ff6379','#5a2635');ctx.restore();circle(h.x,h.y,35,null,'#ff637922',1);
  }else if(h.type==='turret'){
   circle(h.x,h.y,22,'#4f3741','#ab6b66',2);ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.angle);ctx.fillStyle='#fa9a76';ctx.fillRect(0,-5,32,10);ctx.restore();circle(h.x,h.y,8,'#ffd3a3');
  }else{circle(h.x,h.y,54,h.active?'#ff6c2e55':'#ff6c2e12',h.active?'#ff9b4f':'#744332',2);ctx.fillStyle=h.active?'#ffc57a':'#aa7952';ctx.font='bold 13px Segoe UI';ctx.textAlign='center';ctx.fillText(h.active?'LAV':'UYARI',h.x,h.y+4);}
 }
 for(const b of world.buffs){const c=BUFFS[b.kind],pulse=1+Math.sin(now/150+b.id)*.09;circle(b.x,b.y,25*pulse,c.color+'1f');circle(b.x,b.y,16*pulse,'#101b2d',c.color,c.legendary?3:2);ctx.font='17px Segoe UI Emoji';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(c.icon,b.x,b.y+6);ctx.font='bold 10px Segoe UI';ctx.fillStyle=c.color;ctx.fillText((c.legendary?'★ ':'')+c.name,b.x,b.y-31);}
 const me=localPlayer();for(const m of world.mines){const owner=players.get(m.owner);if(m.owner===myId||roomMode==='tdm'&&owner?.team===me?.team){circle(m.x,m.y,11,'#3b2b1d','#ffbc6b');circle(m.x,m.y,3,'#ff795a');}else circle(m.x,m.y,5,'#7e614e');}
 const bulletAge=Math.min(.09,(now-stateAt)/1000);
 for(const b of world.bullets){let x=b.x,y=b.y;const steps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*bulletAge/8));for(let i=0;i<steps;i++){const nx=x+b.vx*bulletAge/steps,ny=y+b.vy*bulletAge/steps;if(nx<0||nx>W||ny<0||ny>H||G.inWall(map.walls,nx,ny))break;x=nx;y=ny;}if(b.bomb){circle(x,y,7,'#ffbd6c','#fff1bf',2);ctx.strokeStyle='#ffad6877';ctx.lineWidth=5;}else{ctx.strokeStyle=b.color;ctx.lineWidth=4;}ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-b.vx*.023,y-b.vy*.023);ctx.lineTo(x,y);ctx.stroke();if(!b.bomb)circle(x,y,2.8,'#f5faff');}
 if(world.flag&&!world.flag.owner){const f=world.flag;circle(f.x,f.y,33,'#ffc85722','#ffc85766');drawFlag(f.x,f.y,now);}
 for(const p of players.values()){
  if(p.dead||!p.connected)continue;ctx.globalAlpha=p.invis>0?.38:1;const pos=positionFor(p,now),c=classColor(p),angle=p.id===myId?aim:p.a;
  ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(pos.x,pos.y+16,18,7,0,0,Math.PI*2);ctx.fill();
  if(p.dash>.02){for(let i=1;i<=3;i++)circle(pos.x-Math.cos(angle)*i*12,pos.y-Math.sin(angle)*i*12,RAD-i*2,c+'33');}
  if(roomMode==='tdm')circle(pos.x,pos.y,RAD+5,null,TEAM_COLORS[p.team],3);
  circle(pos.x,pos.y,RAD,c,p.id===myId?'#f4faff':'#dbe6f577',p.id===myId?3:2);
  drawCosmetics(p,pos.x,pos.y);
  ctx.save();ctx.translate(pos.x,pos.y);ctx.rotate(angle);ctx.fillStyle='#07101c';ctx.fillRect(7,-4,22,8);ctx.fillStyle='#d5e7ff';ctx.fillRect(14,-2,15,4);ctx.restore();
  if(p.shield>0)circle(pos.x,pos.y,26+Math.sin(now/100),null,'#78e6ef',2);
  if(p.invuln>0)circle(pos.x,pos.y,29,null,'#ffffff88',1);
  if(p.haste>0)circle(pos.x,pos.y,21,null,'#69e3ba88',2);
  ctx.fillStyle='#050c16bb';roundRect(pos.x-25,pos.y-37,50,6,3);ctx.fill();ctx.fillStyle=p.hp/p.maxHp>.35?'#71deac':'#ff7791';roundRect(pos.x-25,pos.y-37,50*clamp(p.hp/p.maxHp,0,1),6,3);ctx.fill();
  if(p.shield>0){ctx.fillStyle='#15313f';ctx.fillRect(pos.x-25,pos.y-44,50,3);ctx.fillStyle='#79e9ed';ctx.fillRect(pos.x-25,pos.y-44,50*clamp(p.shield/(p.shieldMax||120),0,1),3);}
  ctx.font='bold 12px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#edf5ff';ctx.strokeStyle='#07111e';ctx.lineWidth=4;const label=p.name+(p.id===myId?' (sen)':p.allyDecoy?' · yansıma':'');ctx.strokeText(label,pos.x,pos.y-51);ctx.fillText(label,pos.x,pos.y-51);
  ctx.font='9px Segoe UI';ctx.fillStyle=c;ctx.fillText(CLASSES[p.classId].name+(roomMode==='tdm'?' · '+(p.team===0?'KIRMIZI':'MAVİ'):''),pos.x,pos.y+36);
  if(world.flag?.owner===p.id)drawFlag(pos.x+22,pos.y-40,now);ctx.globalAlpha=1;
 }
 for(const label of damageLabels){ctx.globalAlpha=clamp(label.life/.25,0,1);ctx.font='bold 15px Segoe UI';ctx.textAlign='center';ctx.strokeStyle='#07111e';ctx.lineWidth=4;ctx.strokeText(label.text,label.x,label.y);ctx.fillStyle=label.color;ctx.fillText(label.text,label.x,label.y);}ctx.globalAlpha=1;
 for(const r of rings){const k=r.t/r.max;ctx.globalAlpha=1-k;circle(r.x,r.y,r.r*(.3+.7*k),null,r.color,6*(1-k)+2);ctx.globalAlpha=1;}
 for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);circle(p.x,p.y,p.size,p.color);}ctx.globalAlpha=1;
 ctx.setTransform(dpr,0,0,dpr,0,0);if(shieldFlash>0){ctx.strokeStyle=`rgba(90,225,245,${shieldFlash})`;ctx.lineWidth=14;ctx.strokeRect(0,0,vw,vh);}if(now<hitUntil){ctx.strokeStyle=hitColor;ctx.lineWidth=3;for(const [dx,dy]of [[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(mouse.x+dx*5,mouse.y+dy*5);ctx.lineTo(mouse.x+dx*12,mouse.y+dy*12);ctx.stroke();}}if(hurtFlash>0){ctx.fillStyle=`rgba(255,40,70,${hurtFlash*.16})`;ctx.fillRect(0,0,vw,vh);}drawMini(now);
}
function drawFlag(x,y,now){ctx.strokeStyle='#ffe19b';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y+10);ctx.lineTo(x,y-22);ctx.stroke();ctx.fillStyle='#ffc857';ctx.beginPath();ctx.moveTo(x,y-22);ctx.lineTo(x+24,y-18+Math.sin(now/170)*3);ctx.lineTo(x,y-6);ctx.closePath();ctx.fill();}
function drawMini(now){
 if(vw<700)return;const width=170,height=width*H/W,x=vw-width-14,y=vh-height-14,k=width/W;ctx.fillStyle='#081322e6';roundRect(x,y,width,height,9);ctx.fill();ctx.strokeStyle='#304a68';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#344c6e';for(const w of map.walls)ctx.fillRect(x+w.x*k,y+w.y*k,w.w*k,w.h*k);
 for(const p of players.values())if(!p.dead&&p.connected){const pos=positionFor(p,now);circle(x+pos.x*k,y+pos.y*k,p.id===myId?3.5:2.5,classColor(p),roomMode==='tdm'?TEAM_COLORS[p.team]:p.id===myId?'#fff':null,1);}
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
 const best=[...m.results].sort((a,b)=>b.kills-a.kills)[0];$('resultHighlight').textContent=['flag','zone'].includes(roomMode)&&m.results[0]?'Hedefte en uzun: '+m.results[0].name+' · '+m.results[0].score+' saniye'+(best?.kills>0?' / En çok öldürme: '+best.name+' · '+best.kills:''):(best?'En çok öldürme: '+best.name+' · '+best.kills:'');
 setHTML($('resultRows'),m.results.map((p,i)=>`<tr><td>${i+1}. ${esc(p.name)}${p.id===myId?' · sen':''}</td><td>${p.score}${['flag','zone'].includes(roomMode)?' sn':''}</td><td>${p.kills} / ${p.deaths}</td></tr>`).join(''));
 $('rematch').disabled=!!m.ready;$('rematch').textContent=m.ready?'HAZIRSIN ✓':'RÖVANŞA HAZIRIM';$('rematchStatus').textContent=`Hazır oyuncular: ${m.readyCount} / ${m.required} · herkes hazır olduğunda aynı odada yeniden başlar`;
}
function updateHUD(){
 const me=localPlayer();if(!me||!world)return;updateMatchEnd(me);
 const critical=!me.dead&&me.hp/me.maxHp<=.25&&world.match?.status!=='finished';$('lowHealth').classList.toggle('hidden',!critical);$('hpwrap').classList.toggle('critical',critical);if(critical&&!criticalActive)sound('warning');criticalActive=critical;
 $('matchGoal').textContent='Hedef: '+(world.match?.target||MODES[roomMode].target)+' '+MODES[roomMode].unit;
 $('count').textContent='Oyuncu: '+(world.roster||[...players.values()]).filter(p=>p.connected).length;$('roompill').textContent='Oda: '+roomCode;
 $('ping').textContent=`Ping: ${ping===null?'–':Math.round(ping)+' ms'} · ${Math.round(1000/Math.max(1,frameMs))} FPS`;
 $('hpbar').style.width=clamp(me.hp/me.maxHp*100,0,100)+'%';$('hptext').textContent=Math.ceil(me.hp)+' / '+me.maxHp+(me.shield>0?' · 🛡 '+Math.ceil(me.shield):'');$('shieldbar').style.width=clamp(me.shield/(me.shieldMax||120)*100,0,100)+'%';$('shieldwrap').classList.toggle('hidden',me.shield<=0);
 $('classPill').textContent=CLASSES[me.classId].name+(me.invis>0?' · GİZLİ':me.ricochetBoost>0?' · Sekme Ustası '+Math.ceil(me.ricochetBoost)+'s':'')+(roomMode==='tdm'?' · '+(me.team===0?'Kırmızı takım':'Mavi takım'):'');
 const active=Object.entries(me.buffs).filter(([k,t])=>t>0&&k!=='shield').map(([k,t])=>`<span class="buff-chip ${BUFFS[k].legendary?'legendary':''}" style="--buff-color:${BUFFS[k].color}">${BUFFS[k].legendary?'★ ':''}${BUFFS[k].icon} ${BUFFS[k].name} ${Math.ceil(t)}s</span>`).join('');setHTML($('buffrow'),active);
 CLASSES[me.classId].skills.forEach((skill,i)=>{const el=$('sk-'+i),cd=me.cds[i];el.querySelector('.ico').textContent=skill.icon;el.querySelector('.key').textContent=keyLabel(bindings['skill'+(i+1)]);el.querySelector('.sname').textContent=skill.name;el.querySelector('.cdmask').style.height=clamp(cd/skill.cd*100,0,100)+'%';el.querySelector('.cdnum').textContent=cd>0?(cd<3?cd.toFixed(1):Math.ceil(cd)):(me.classId==='scout'&&i===2?me.ultShots+'/3':'');el.classList.toggle('ready',cd<=0);});
 const list=(world.roster||[...players.values()]).filter(p=>p.connected).sort((a,b)=>b.score-a.score||b.kills-a.kills);
 $('score').querySelector('h3').textContent=MODES[roomMode].name;
 $('scoreUnit').textContent=roomMode==='zone'?'PUAN = ALANI TEK BAŞINA TUTTUĞUN SANİYE':roomMode==='flag'?'PUAN = BAYRAĞI TAŞIDIĞIN SANİYE':'OYUNCU ÖLDÜRME SAYISI';
 setHTML($('score').querySelector('table'),list.slice(0,16).map((p,i)=>`<tr><td style="color:${p.id===myId?'#f5faff':classColor(p)}">${i+1}. ${esc(p.name)}${p.id===myId?' · sen':''}</td><td>${p.score}${['flag','zone'].includes(roomMode)?' sn':''}</td></tr>`).join(''));
 $('teamScore').classList.toggle('hidden',roomMode!=='tdm');if(roomMode==='tdm')setHTML($('teamScore'),`<span class="red">KIRMIZI ${world.teamScores[0]}</span><span class="blue">MAVİ ${world.teamScores[1]}</span>`);
 if(roomMode==='zone'){const z=world.zone;$('modeNotice').textContent=`◎ ${z.contested?'Alan çekişmeli · puan durdu':z.holder===myId?'Alan sende · saniyede +1 puan':'Alanı tek başına tut'} · ${Math.max(0,Math.ceil(z.nextAt-world.time))}s sonra taşınır`;}
 else if(roomMode==='flag'){const carrier=knownPlayer(world.flag?.owner);$('modeNotice').textContent=carrier?`⚑ ${carrier.name} bayrağı taşıyor · her saniye +1 puan`:'⚑ Ortadaki bayrağı al. Taşıyanı öldürürsen bayrak sana geçer.';}
 else $('modeNotice').textContent=roomMode==='tdm'?`${me.team===0?'Kırmızı':'Mavi'} takımdasın · dost ateşi kapalı · tehlikeler kapalı`:'Normal Arena · herkese karşı · testere, taret ve lavlara dikkat!';
 $('deathClassPanel').classList.toggle('hidden',roomMode!=='tdm'||!me.dead);
 if(roomMode==='tdm'&&me.dead){
  setHTML($('deathClasses'),Object.entries(CLASSES).map(([id,c])=>`<button data-death-class="${id}" class="${(me.nextClass||me.classId)===id?'selected':''}">${c.icon} ${c.name}</button>`).join(''));
  $('nextClassText').textContent=me.nextClass?'Yeniden doğunca: '+CLASSES[me.nextClass].name:'Yeniden doğmadan sınıfını seçebilirsin.';
 }
 $('respawn').textContent='Yeniden doğuş: '+Math.max(0,me.respawn).toFixed(1)+' saniye';$('hint').textContent=`${keyLabel(bindings.skill1)} / ${keyLabel(bindings.skill2)} / ${keyLabel(bindings.skill3)}: yetenekler · ${keyLabel(bindings.mute)}: ses`;
}
renderLobby();
