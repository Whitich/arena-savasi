(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ArenaCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const W=1600,H=1000,RAD=16;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const isTeamMode=mode=>mode==='tdm'||mode==='zoneTeam';
const MODES={zoneTeam:{target:100,unit:'takım saniyesi',name:'Alan Hakimiyeti · Takımlı',description:'Kırmızı ve mavi · rakipsiz takım saniyede +1 puan · alan her 15 saniyede taşınır'},zone:{target:100,unit:'saniye',name:'Alan Hakimiyeti · Tekli',description:'Herkes tek · rakipsiz alanda saniyede +1 puan · alan her 15 saniyede taşınır'},normal:{target:30,unit:'öldürme',name:'Normal Arena',description:'Herkes tek · testereler, taretler ve lav kapanları'},tdm:{target:50,unit:'takım öldürmesi',name:'Takım Ölüm Maçı',description:'Kırmızı ve mavi · ortak öldürme skoru · dost ateşi kapalı'},flag:{target:100,unit:'saniye',name:'Bayrak Taşıma',description:'Herkes tek · bayrak sende kaldıkça saniyede +1 puan'}};
const CLASSES={
 ricochet:{name:'Sekici',icon:'🔷',color:'#84cbff',hp:95,speed:255,damage:18,interval:.29,bulletSpeed:920,bulletLife:1.65,bounces:3,skills:[{name:'Kayarak Kaçış',icon:'💨',cd:5},{name:'Sekme Ustası',icon:'🔷',cd:12},{name:'Çapraz Yaylım',icon:'✳',cd:18}],description:'Hızlı mermiler 3 kez seker ve uzun yaşar. E: 4 saniye daha fazla sekme. R: beşli seken yaylım.'},
 mage:{name:'Büyücü',icon:'🔮',color:'#ca9aff',hp:90,speed:245,damage:23,interval:.28,bulletSpeed:680,skills:[{name:'Işınlanma',icon:'🌀',cd:14},{name:'Buz Mührü',icon:'❄',cd:12},{name:'Arkan Küre',icon:'☄',cd:7}],description:'Q: fareye doğru en fazla 380 birim ışınlanma; duvar içine girmez. E: uzun menzilli buz, 22 hasar ve 0,5 saniye sabitleme. R: delip geçen arkan küre (34 hasar).'},
 assassin:{name:'Suikastçı',icon:'🗡',color:'#f18ab9',hp:80,speed:310,damage:20,interval:.25,skills:[{name:'Gölge Atılımı',icon:'💨',cd:6},{name:'Görünmezlik',icon:'👤',cd:11},{name:'Hançer Salvosu',icon:'🗡',cd:16}],description:'E: 1 saniye görünmezlik; saldırı veya hasar alınca bozulur. Q: atılma. R: yakın mesafeli üçlü hançer.'},
 jester:{name:'Soytarı',icon:'🃏',color:'#ffcc75',hp:90,speed:275,damage:21,interval:.27,skills:[{name:'Yan Adım',icon:'💨',cd:5},{name:'İkiz Aldatmaca',icon:'🎭',cd:13},{name:'Konfeti Salvosu',icon:'🎊',cd:16}],description:'E: 2 saniye aynı görünen, yürüyen ve hafif hasarla ateş eden kopya. Q: kaçış. R: yavaşlatan üçlü salvo.'},
 assault:{name:'Akıncı',icon:'⚔',color:'#5b9cff',hp:100,speed:260,damage:25,interval:.24,skills:[{name:'Atılma',icon:'💨',cd:4},{name:'Seri Tetik',icon:'🔥',cd:11},{name:'İtici Darbe',icon:'⚡',cd:16}],description:'Q: atılma. E: 3 saniye %30 hızlı ateş. R: öne doğru koni, 38 hasar ve geri itme.'},
 scout:{name:'İzci',icon:'🏹',color:'#55dfc2',hp:85,speed:305,damage:24,interval:.27,skills:[{name:'Uzun Atılma',icon:'💨',cd:5},{name:'Adrenalin',icon:'⚡',cd:12},{name:'Üçlü Keskin Atış',icon:'🎯',cd:17}],description:'Hızlı ve kırılgan. Uzun atılma, hız patlaması ve R ile ayrı ayrı kullanılan üç adet 42 hasarlık keskin atış.'},
 guardian:{name:'Muhafız',icon:'🛡',color:'#b6a0ff',hp:145,speed:215,damage:32,interval:.32,skills:[{name:'Hücum',icon:'💥',cd:6},{name:'Kale · 5 sn',icon:'🛡',cd:14},{name:'Yer Sarsıntısı',icon:'🌋',cd:18}],description:'Yüksek can, düşük hız. Hücum, 5 saniyelik 95 canlık kalkan. R: 40 yakın alan hasarı ve 2 saniye yavaşlatma.'},
 bomber:{name:'Bombacı',icon:'💣',color:'#ffad68',hp:105,speed:245,damage:27,interval:.28,skills:[{name:'Kaçış Atılması',icon:'💨',cd:5},{name:'Kara Mayını',icon:'💥',cd:10},{name:'Bomba Salvosu',icon:'🚀',cd:17}],description:'Alan kontrolü. Kaçış, düşmana tetiklenen mayın ve üç bombalık salvo.'}
};
// Menu descriptions use base values; buffs and enemy defenses can change the result.
const SKILL_DETAILS={
 assault:['Kısa atılma; hasar vermez.','3 saniye %30 daha hızlı ateş; bufflarla birleşir.','38 alan hasarı; öne doğru 260 birim koni ve en fazla 96 birim geri itme.'],
 scout:['Uzun atılma; hasar vermez.','3 saniye %50 hızlı hareket.','Her basış 42 hasarlı bir mermi (1120 birim/sn). 3 hak; üçüncüden sonra 17 sn bekleme.'],
 guardian:['Hücum; temas hasarı vermez.','95 kalkan canı; en fazla 5 saniye sürer.','40 alan hasarı; 165 birim yarıçap ve 2 saniye %45 yavaşlatma.'],
 bomber:['Kısa atılma; hasar vermez.','Mayın patlaması 65 hasar, 125 birim yarıçap. 0,65 sn sonra kurulur; 22 sn yaşar, en fazla 3 mayın.','3 bomba × 38 hasar (üçü de vurursa 114); bomba başına 95 birim patlama yarıçapı.'],
 ricochet:['Kısa kayma; hasar vermez.','4 saniye +2 sekme ve %15 mermi hızı.','5 mermi × 15 hasar (hepsi vurursa 75); 1000 birim/sn, 1,9 sn ömür, 4 sekme.'],
 mage:['Fareye doğru en fazla 380 birim ışınlanma; hasar vermez, duvar içine girmez.','22 hasar ve 0,5 saniye hareket sabitleme. Mermi hızı 920 birim/sn, ömrü 1,05 sn.','Hedef başına 34 hasar; en fazla 3 hedefi deler. Mermi hızı 640 birim/sn, ömrü 1,2 sn.'],
 assassin:['Kısa atılma; hasar vermez.','1 saniye görünmezlik. Saldırınca veya hasar alınca bozulur; bayrak taşırken kullanılamaz.','3 hançer × 17 hasar (hepsi vurursa 51); 1050 birim/sn ve 0,4 sn ömür.'],
 jester:['Kısa yan adım; hasar vermez.','2 saniyelik kopya; atış başına 8 hasar, yaklaşık 0,33 sn atış aralığı.','3 mermi × 18 hasar (hepsi vurursa 54) ve 1 saniye %45 yavaşlatma.']
};
for(const [id,c]of Object.entries(CLASSES))c.skills.forEach((skill,i)=>skill.detail=SKILL_DETAILS[id][i]);
const RARITIES={common:{name:'Sıradan',color:'#a8b2c1',weight:28},uncommon:{name:'Gelişmiş',color:'#69d990',weight:30},rare:{name:'Nadir',color:'#69adff',weight:23},epic:{name:'Destansı',color:'#bd87ff',weight:13},legendary:{name:'Legendary',color:'#ffd166',weight:6}};
const BUFFS={
 smallheal:{name:'İlk Yardım',icon:'✚',rarity:'common',duration:0,description:'Anında +15 can.'},
 cooldown:{name:'Enerji Parçası',icon:'⌛',rarity:'common',duration:0,description:'Yetenek beklemelerinden 2 saniye düşürür.'},
 heal:{name:'Can Paketi',icon:'♥',rarity:'uncommon',duration:0,description:'Anında +25 can.'},
 speed:{name:'Hız',icon:'⚡',rarity:'uncommon',duration:8,description:'8 saniye %45 hızlı hareket.'},
 velocity:{name:'İvme Mermisi',icon:'➤',rarity:'uncommon',duration:10,description:'10 saniye silah mermileri %25 daha hızlı.'},
 magnet:{name:'Mıknatıs',icon:'🧲',rarity:'uncommon',duration:12,description:'12 saniye buffları 90 birimden topla; duvar arkasını çekmez.'},
 regen:{name:'Yenilenme',icon:'✚',rarity:'uncommon',duration:8,description:'8 saniye +2 can/sn; son 2 saniyede hasar aldıysan durur.'},
 shield:{name:'Kalkan',icon:'🛡',rarity:'rare',duration:0,description:'5 saniyelik +35 kalkan canı. Toplam en fazla 120; tekrar alınca süre yenilenir.'},
 power:{name:'Güçlü Mermi',icon:'💥',rarity:'rare',duration:9,description:'9 saniye silah hasarı %40 artar.'},
 armor:{name:'Çelik Deri',icon:'◆',rarity:'rare',duration:9,description:'9 saniye alınan hasar %20 azalır. Titan ile en güçlü koruma geçerli.'},
 focus:{name:'Odak',icon:'◉',rarity:'rare',duration:10,description:'10 saniye yetenek beklemeleri %25 hızlı dolar.'},
 chill:{name:'Buzlu Mermi',icon:'❄',rarity:'rare',duration:9,description:'9 saniye normal silah isabetleri 0,6 saniye yavaşlatır. Bombaya uygulanmaz.'},
 double:{name:'Çift Namlu',icon:'🔫',rarity:'epic',duration:9,description:'9 saniye iki mermi; her biri %76 hasar. Bomba ile birleşir.'},
 range:{name:'Uzun Menzil',icon:'🎯',rarity:'epic',duration:14,description:'14 saniye mermi ömrü %70 artar (en fazla 3 saniye).'},
 bounce:{name:'Sekme Çekirdeği',icon:'◇',rarity:'epic',duration:10,description:'10 saniye silah mermilerine +1 sekme. Sekici ve bombayla birleşir.'},
 pierce:{name:'Delici Mermi',icon:'⇢',rarity:'epic',duration:9,description:'9 saniye silah mermisi bir ek hedefi deler; aynı hedefe tekrar vurmaz. Bomba hariç.'},
 execute:{name:'Avcı İçgüdüsü',icon:'◎',rarity:'epic',duration:9,description:'9 saniye %35 canın altındaki rakiplere %20 fazla hasar.'},
 rapid:{name:'Hızlı Tarama',icon:'⚡',rarity:'legendary',duration:10,description:'10 saniye atış aralığı %42 azalır.'},
 launcher:{name:'Bomba Fırlatıcı',icon:'🚀',rarity:'legendary',duration:12,description:'12 saniye silahın patlayıcı bomba atar. Çoklu atış ile birleşir.'},
 vampire:{name:'Can Çalma',icon:'🩸',rarity:'legendary',duration:10,description:'10 saniye verdiğin gerçek can hasarının %20’sini iyileş.'},
 multishot:{name:'Yıldız Salvosu',icon:'✴',rarity:'legendary',duration:9,description:'9 saniye üçlü atış (%60 hasar). Çift Namlu ile dörtlü (%50), bomba ile de birleşir.'},
 titan:{name:'Titan Zırhı',icon:'⬟',rarity:'legendary',duration:10,description:'5 saniyelik +35 kalkan, 10 saniye %30 hasar azaltma; karşılığında %10 yavaş hareket.'}
};
for(const b of Object.values(BUFFS)){b.color=RARITIES[b.rarity].color;b.legendary=b.rarity==='legendary';}
const COSMETICS={colors:{azure:{name:'Mavi',hex:'#5b9cff'},coral:{name:'Mercan',hex:'#ff718a'},mint:{name:'Nane',hex:'#55dfbc'},gold:{name:'Altın',hex:'#ffd166'},violet:{name:'Mor',hex:'#bb91ff'},orange:{name:'Turuncu',hex:'#ff9f58'},pink:{name:'Pembe',hex:'#f57ed5'},ice:{name:'Buz',hex:'#83e5ef'},lime:{name:'Limon',hex:'#bded63'},silver:{name:'Gümüş',hex:'#d2ddea'}},patterns:{plain:'Düz',stripe:'Çizgili',cross:'Artı',star:'Yıldız'},auras:{none:'Kapalı',orbit:'Yörünge',rune:'Rün Halkası',pulse:'Neon Nabız'},weapons:{standard:'Klasik',neon:'Neon Ray',gold:'Altın İşçilik',candy:'Şeker Kamışı',void:'Kozmik',frost:'Buz Kristali'},trails:{rainbow:'Gökkuşağı',hearts:'Kalp İzi',stars:'Yıldız Tozu',frost:'Buz Parçaları',none:'Kapalı',comet:'Kuyruklu Yıldız',sparks:'Kıvılcım',ribbon:'Neon Şerit'},visors:{none:'Yok',glass:'Pilot Vizörü',eyes:'Robot Gözler'},hats:{unicorn:'Gökkuşağı Unicorn',cat:'Kedi Kulakları',wizard:'Büyücü Şapkası',headphones:'DJ Kulaklık',samurai:'Samuray Miğferi',none:'Yok',crown:'Taç',horns:'Boynuz',antenna:'Anten'}};
function normalizeCosmetics(value={},seed=''){
 value=value&&typeof value==='object'?value:{};
 const colors=Object.keys(COSMETICS.colors);
 return{color:Object.hasOwn(COSMETICS.colors,value.color)?value.color:colors[hash(seed)%colors.length],pattern:Object.hasOwn(COSMETICS.patterns,value.pattern)?value.pattern:'plain',hat:Object.hasOwn(COSMETICS.hats,value.hat)?value.hat:'none',aura:Object.hasOwn(COSMETICS.auras,value.aura)?value.aura:'none',trail:Object.hasOwn(COSMETICS.trails,value.trail)?value.trail:'none',weapon:Object.hasOwn(COSMETICS.weapons,value.weapon)?value.weapon:'standard',weaponColor:Object.hasOwn(COSMETICS.colors,value.weaponColor)?value.weaponColor:'ice',visor:Object.hasOwn(COSMETICS.visors,value.visor)?value.visor:'none'};
}
const DEFAULT_BINDINGS={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD',fire:'Space',skill1:'KeyQ',skill2:'KeyE',skill3:'KeyR',mute:'KeyM'};
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);}
function rng(seed){return()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function inWall(walls,x,y,m=0){return walls.some(w=>x>w.x-m&&x<w.x+w.w+m&&y>w.y-m&&y<w.y+w.h+m);}
function resolve(map,x,y,r=RAD){
 for(const w of map.walls){const cx=clamp(x,w.x,w.x+w.w),cy=clamp(y,w.y,w.y+w.h),dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy);
 if(d===0){const sides=[x-w.x,w.x+w.w-x,y-w.y,w.y+w.h-y],i=sides.indexOf(Math.min(...sides));if(i===0)x=w.x-r;else if(i===1)x=w.x+w.w+r;else if(i===2)y=w.y-r;else y=w.y+w.h+r;}
 else if(d<r){x+=dx/d*(r-d);y+=dy/d*(r-d);}}
 for(const b of map.barrels||[]){if(b.hp<=0)continue;const dx=x-b.x,dy=y-b.y,d=Math.hypot(dx,dy);if(d<r+15){x=b.x+(d?dx/d:1)*(r+15);y=b.y+(d?dy/d:0)*(r+15);}}
 return{x:clamp(x,r,W-r),y:clamp(y,r,H-r)};
}
function generateMap(seed,mode){
 const random=rng(hash(seed)),walls=[];let guard=0;
 while(walls.length<10&&guard++<500){const vertical=random()<.4;const w=vertical?50:90+Math.floor(random()*3)*45,h=vertical?100+Math.floor(random()*3)*40:50;
 const x=160+random()*(W-320-w),y=130+random()*(H-260-h);
 if(x<900&&x+w>700&&y<600&&y+h>400)continue;
 if(walls.some(c=>x<c.x+c.w+75&&x+w+75>c.x&&y<c.y+c.h+75&&y+h+75>c.y))continue;
 walls.push({x:Math.round(x),y:Math.round(y),w,h});}
 const barrels=[];
 for(let i=0;i<7;i++){let pos;for(let k=0;k<200;k++){pos={x:100+random()*(W-200),y:100+random()*(H-200)};if(!inWall(walls,pos.x,pos.y,40)&&distance(pos,{x:800,y:500})>120&&barrels.every(b=>distance(b,pos)>100))break;}barrels.push({...pos,id:i,hp:50,respawn:0});}
 const hazards=[];
 if(mode==='normal'){
 const safe=(x,y)=>{for(let i=0;i<100;i++){if(!inWall(walls,x,y,75)&&barrels.every(b=>distance(b,{x,y})>80))return{x,y};x=180+random()*1240;y=160+random()*680;}return{x:800,y:500};};
 for(let i=0;i<2;i++){const p=safe(400+i*700,300+i*350);hazards.push({id:'s'+i,type:'saw',...p,baseX:p.x,baseY:p.y,phase:random()*6,axis:i,angle:0});}
 for(let i=0;i<2;i++)hazards.push({id:'t'+i,type:'turret',...safe(200+i*1200,200+i*600),angle:random()*6,next:1+i*.8});
 hazards.push({id:'lava',type:'lava',...safe(800,700),active:false,phase:random()*5});
 }
 return{walls,barrels,hazards};
}
function safePosition(room,team=null){
 for(let i=0;i<300;i++){const x=team===0?70+room.random()*350:team===1?1180+room.random()*350:70+room.random()*1460,y=70+room.random()*860;
 if(inWall(room.map.walls,x,y,45)||room.map.barrels.some(b=>b.hp>0&&distance(b,{x,y})<60))continue;
 if(room.map.hazards.some(h=>distance(h,{x,y})<(h.type==='saw'?155:90)))continue;
 if([...room.players.values()].some(p=>!p.dead&&p.connected&&distance(p,{x,y})<130))continue;
 return{x,y};}
 return{x:team===0?70:team===1?1530:800,y:500};
}
function createRoom(code,mode='normal',seed=code){
 if(!MODES[mode])throw Error('Invalid mode');
 return{code,mode,seed,match:{round:1,status:'playing',target:MODES[mode].target,winner:null,results:[],ready:new Set(),intermission:0,finishedAt:0},map:generateMap(seed,mode),random:rng(hash(seed+'buff')),players:new Map(),decoys:[],zone:{x:800,y:500,r:140,nextAt:15,clock:0,holder:null,contested:false},bullets:[],mines:[],buffs:[],events:[],time:0,bulletSeq:0,buffSeq:0,nextBuff:2,teamScores:[0,0],flag:{owner:null,x:800,y:500,clock:0},emptyAt:0};
}
function checkMatch(room){
 const m=room.match;if(m.status!=='playing')return;
 let winner=null;
 if(isTeamMode(room.mode)){const team=room.teamScores.findIndex(score=>score>=m.target);if(team>=0)winner={kind:'team',team,name:team===0?'Kırmızı takım':'Mavi takım',score:room.teamScores[team]};}
 else{const p=[...room.players.values()].find(p=>p.score>=m.target);if(p)winner={kind:'player',id:p.id,name:p.name,score:p.score};}
 if(!winner)return;
 m.status='finished';m.winner=winner;m.finishedAt=room.time;m.intermission=0;
 m.results=[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,score:p.score,kills:p.kills,deaths:p.deaths})).sort((a,b)=>b.score-a.score||b.kills-a.kills);
 room.bullets=[];room.mines=[];room.decoys=[];for(const p of room.players.values())p.input={x:0,y:0,a:p.a,fire:false};
 emit(room,{t:'matchEnd',winner,round:m.round});
}
function voteRematch(room,p){if(room.match.status!=='finished'||!p.connected)return false;room.match.ready.add(p.id);return true;}
function restartMatch(room){
 const round=room.match.round+1;
 room.map=generateMap(room.seed,room.mode);room.time=0;room.bullets=[];room.mines=[];room.decoys=[];room.buffs=[];room.events=[];room.nextBuff=2;room.teamScores=[0,0];room.flag={owner:null,x:800,y:500,clock:0};room.zone={x:800,y:500,r:140,nextAt:15,clock:0,holder:null,contested:false};
 room.match={round,status:'playing',target:MODES[room.mode].target,winner:null,results:[],ready:new Set(),intermission:0,finishedAt:0};
 for(const p of room.players.values())p.dead=true;
 for(const p of room.players.values()){
  if(p.nextClass)p.classId=p.nextClass;
  Object.assign(p,{...safePosition(room,p.team),maxHp:CLASSES[p.classId].hp,hp:CLASSES[p.classId].hp,score:0,kills:0,deaths:0,dead:false,respawn:0,cds:[0,0,0],shotCd:0,shield:0,shieldMax:0,shieldTime:0,invuln:1,invis:0,ricochetBoost:0,ultShots:3,ultTap:0,nextClass:null,dash:0,haste:0,root:0,overdrive:0,slow:0,buffs:{},noHit:0,vx:0,vy:0,input:{x:0,y:0,a:p.a,fire:false}});
 }
 emit(room,{t:'matchStart',round});
}
function addPlayer(room,id,name,classId='assault',cosmetics={}){
 const team=isTeamMode(room.mode)?([0,1].map(t=>[...room.players.values()].filter(p=>p.connected&&p.team===t).length).reduce((best,n,i,a)=>n<a[best]?i:best,0)):null;
 const c=CLASSES[classId]||CLASSES.assault;
 const p={id,cosmetics:normalizeCosmetics(cosmetics,id),name:String(name||'Oyuncu').slice(0,14),classId:CLASSES[classId]?classId:'assault',team,...safePosition(room,team),a:0,hp:c.hp,maxHp:c.hp,score:0,kills:0,deaths:0,dead:false,respawn:0,connected:true,input:{x:0,y:0,a:0,fire:false},cds:[0,0,0],shotCd:0,shield:0,shieldMax:0,shieldTime:0,invuln:0,invis:0,ricochetBoost:0,ultShots:3,ultTap:0,nextClass:null,dash:0,dashA:0,haste:0,root:0,overdrive:0,slow:0,buffs:{},noHit:0,vx:0,vy:0};
 room.players.set(id,p);return p;
}
function emit(room,event){room.events.push(event);}
function enemy(room,a,b){return !a||!isTeamMode(room.mode)||a.team!==b.team;}
function dropFlag(room,p,killer){if(room.mode!=='flag'||room.flag.owner!==p.id)return;room.flag.owner=killer&&!killer.dead&&killer.connected?killer.id:null;room.flag.x=p.x;room.flag.y=p.y;room.flag.clock=0;emit(room,{t:'flag',owner:room.flag.owner});}
function kill(room,p,killer){
 if(p.dead||room.match.status!=='playing')return;p.dead=true;p.hp=0;p.respawn=isTeamMode(room.mode)?5:3;p.deaths++;p.input.fire=false;p.shield=0;p.shieldMax=0;p.shieldTime=0;p.invis=0;p.ricochetBoost=0;p.invuln=0;if(p.classId==='scout'&&p.ultShots<3)p.cds[2]=Math.max(p.cds[2],17);p.dash=0;p.haste=0;p.root=0;p.overdrive=0;p.slow=0;p.buffs={};
 if(killer&&killer!==p&&enemy(room,killer,p)){killer.kills++;if(room.mode!=='flag'&&room.mode!=='zone'&&room.mode!=='zoneTeam')killer.score++;if(room.mode==='tdm')room.teamScores[killer.team]++;}
 else killer=null;
 dropFlag(room,p,killer);emit(room,{t:'death',id:p.id,killer:killer?.id||null,x:p.x,y:p.y});checkMatch(room);
}
function damage(room,p,amount,owner=null){
 if(room.match.status!=='playing'||p.dead||!p.connected||p.invuln>0)return 0;
 const killer=room.players.get(owner);if(killer&&(!enemy(room,killer,p)||killer===p))return 0;
 p.invis=0;p.noHit=0;if(killer?.buffs.execute>0&&p.hp/p.maxHp<.35)amount*=1.2;amount*=p.buffs.titan>0?.7:p.buffs.armor>0?.8:1;const previousShield=p.shield;const absorbed=Math.min(p.shield,amount);p.shield-=absorbed;amount-=absorbed;
 const dealt=Math.min(p.hp,amount);p.hp=Math.max(0,p.hp-amount);emit(room,{t:'hit',id:p.id,owner,x:p.x,y:p.y,amount:Math.round(dealt),absorbed:Math.round(absorbed)});
 if(previousShield>0&&p.shield===0){p.shieldTime=0;p.shieldMax=0;emit(room,{t:'shieldBreak',id:p.id,owner,x:p.x,y:p.y});}
 if(killer?.buffs.vampire>0&&!killer.dead)killer.hp=Math.min(killer.maxHp,killer.hp+dealt*.2);
 if(p.hp<=0)kill(room,p,killer);return dealt;
}
function hurtDecoy(room,d,amount,owner){
 const attacker=room.players.get(owner);if(owner===d.owner||!enemy(room,attacker,d))return;
 d.hp-=amount;emit(room,{t:'hit',id:d.id,owner,x:d.x,y:d.y,amount:Math.round(amount)});
 if(d.hp<=0){d.life=0;emit(room,{t:'vanish',x:d.x,y:d.y});}
}
function queueClass(room,p,classId){
 if(room.match.status!=='playing'||!isTeamMode(room.mode)||!p.dead||!Object.hasOwn(CLASSES,classId))return false;
 p.nextClass=classId;return true;
}
function blast(room,x,y,r,amount,owner=null,color='#ffad68'){
 emit(room,{t:'explosion',x,y,r,color});
 for(const p of room.players.values())if(distance(p,{x,y})<r+RAD)damage(room,p,amount,owner);
 for(const d of room.decoys)if(d.life>0&&distance(d,{x,y})<r+RAD)hurtDecoy(room,d,amount,owner);
 // Chain reactions are scheduled once per barrel; mark dead before recursing.
 for(const b of room.map.barrels)if(b.hp>0&&distance(b,{x,y})<r+15)hitBarrel(room,b,amount,owner);
}
function hitBarrel(room,b,amount,owner){
 if(b.hp<=0)return;b.hp=Math.max(0,b.hp-amount);
 if(b.hp===0){b.respawn=20;blast(room,b.x,b.y,170,42,owner,'#ff9e6d');}
}
function makeBullet(room,p,angle,options={}){
 const c=CLASSES[p.classId],range=p.buffs.range>0?1.7:1;
 const damageValue=(options.damage||c.damage)*(options.scalePower===false?1:(p.buffs.power>0?1.4:1));
 const speed=(options.speed||c.bulletSpeed||720)*(options.weapon&&p.buffs.velocity>0?1.25:1);
 const b={id:++room.bulletSeq,owner:p.id,team:p.team,x:p.x+Math.cos(angle)*24,y:p.y+Math.sin(angle)*24,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:Math.min(3,(options.life||c.bulletLife||.85)*range),damage:damageValue,bomb:!!options.bomb,r:options.r||95,bounces:(options.bounces??((c.bounces||0)+(p.ricochetBoost>0?2:0)))+(options.weapon&&p.buffs.bounce>0?1:0),slow:options.slow||(options.weapon&&!options.bomb&&p.buffs.chill>0?.6:0),root:options.root||0,pierce:options.pierce||(options.weapon&&!options.bomb&&p.buffs.pierce>0?1:0),hitIds:[],kind:options.kind||null,color:options.color||COSMETICS.colors[p.cosmetics?.color]?.hex||c.color};
 room.bullets.push(b);return b;
}
function fire(room,p){
 if(room.match.status!=='playing'||p.dead||!p.connected||p.shotCd>0)return false;
 p.invis=0;const c=CLASSES[p.classId],bomb=p.buffs.launcher>0,dual=p.buffs.double>0,multi=p.buffs.multishot>0,count=multi?(dual?4:3):(dual?2:1),shotScale=multi?(dual?.5:.6):(dual?.76:1);
 p.shotCd=(bomb?.68:c.interval)*(p.buffs.rapid>0?.58:1)*(dual?1.08:1)*(p.overdrive>0?1/1.3:1);
 const opts=bomb?{bomb:true,speed:470*(p.ricochetBoost>0?1.15:1),life:1.1,damage:count>1?58*shotScale*.88:58,r:count>1?78:95}:{damage:c.damage*shotScale};
 if(p.ricochetBoost>0&&!bomb)opts.speed=(c.bulletSpeed||720)*1.15;
 opts.weapon=true;for(let i=0;i<count;i++)makeBullet(room,p,p.a+(i-(count-1)/2)*(multi?.14:.20),opts);
 emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb});return true;
}
function blink(room,p,target){
 let dx=(Number.isFinite(target?.x)?target.x:p.x+Math.cos(p.a)*380)-p.x,dy=(Number.isFinite(target?.y)?target.y:p.y+Math.sin(p.a)*380)-p.y;
 const length=Math.hypot(dx,dy);if(length>380){dx*=380/length;dy*=380/length;}
 for(let i=24;i>=0;i--){const x=clamp(p.x+dx*i/24,RAD,W-RAD),y=clamp(p.y+dy*i/24,RAD,H-RAD);
 if(inWall(room.map.walls,x,y,RAD+1)||room.map.barrels.some(b=>b.hp>0&&distance(b,{x,y})<RAD+17))continue;
 emit(room,{t:'blink',id:p.id,x:p.x,y:p.y,tx:x,ty:y});p.x=x;p.y=y;p.vx=p.vy=0;return;
 }
}
function grantShield(p,value,additive=false){const previous=p.shield;p.shield=additive?Math.min(120,p.shield+value):Math.max(p.shield,value);p.shieldMax=Math.max(previous>0?p.shieldMax||0:0,p.shield);p.shieldTime=5;}
function skill(room,p,index,target=null){
 if(room.match.status!=='playing'||p.dead||!p.connected||!Number.isInteger(index)||index<0||index>2||p.cds[index]>0)return false;
 const c=CLASSES[p.classId];if(p.root>0&&index===0)return false;
 if(p.classId==='scout'&&index===2){
  if(room.time<p.ultTap)return false;p.ultTap=room.time+.22;p.invis=0;
  if(p.ultShots<=0)p.ultShots=3;p.ultShots--;
  makeBullet(room,p,p.a,{speed:1120,life:1.1,damage:42,scalePower:false});
  if(p.ultShots===0)p.cds[2]=c.skills[2].cd;
  emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb:false});return true;
 }
 if(p.classId==='assassin'&&index===1&&room.flag.owner===p.id)return false;
 p.cds[index]=c.skills[index].cd;
 if(p.classId==='mage'){
  if(index===2){makeBullet(room,p,p.a,{speed:640,life:1.2,damage:34,pierce:2,kind:'arcane',color:'#ca9aff',bounces:0,scalePower:false});emit(room,{t:'cast',x:p.x,y:p.y,color:'#ca9aff'});}
  else if(index===1){makeBullet(room,p,p.a,{speed:920,life:1.05,damage:22,root:.5,kind:'frost',color:'#83e8ff',bounces:0,scalePower:false});emit(room,{t:'cast',x:p.x,y:p.y,color:'#83e8ff'});}
  else blink(room,p,target);
 }else if(p.classId==='assassin'&&index===1){p.invis=1;emit(room,{t:'skill',id:p.id,x:p.x,y:p.y,index});}
 else if(p.classId==='assassin'&&index===2){p.invis=0;for(const a of [-.11,0,.11])makeBullet(room,p,p.a+a,{speed:1050,life:.4,damage:17,scalePower:false});emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb:false});}
 else if(p.classId==='jester'&&index===1){
  room.decoys=room.decoys.filter(d=>d.owner!==p.id);
  room.decoys.push({id:'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(room.random()*16);return(c==='x'?n:(n&3|8)).toString(16);}),owner:p.id,name:p.name,classId:p.classId,cosmetics:p.cosmetics,team:p.team,x:p.x,y:p.y,a:p.a,moveA:p.a+Math.PI/2,hp:p.hp,maxHp:p.maxHp,life:2,turn:0,shot:.12,buffs:{},score:p.score,kills:p.kills,deaths:p.deaths});
  emit(room,{t:'skill',id:p.id,x:p.x,y:p.y,index});
 }else if(p.classId==='jester'&&index===2){for(const a of [-.18,0,.18])makeBullet(room,p,p.a+a,{damage:18,slow:1,scalePower:false});emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb:false});}
 else if(p.classId==='ricochet'&&index===1)p.ricochetBoost=4;
 else if(p.classId==='ricochet'&&index===2){for(const a of [-.32,-.16,0,.16,.32])makeBullet(room,p,p.a+a,{speed:1000,life:1.9,damage:15,bounces:4,scalePower:false});emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb:false});}
 else if(index===0){p.dash=p.classId==='scout'?.23:p.classId==='guardian'?.23:.16;p.dashA=p.a;emit(room,{t:'dash',id:p.id,x:p.x,y:p.y});}
 else if(index===1){
  if(p.classId==='scout')p.haste=3;
  else if(p.classId==='bomber'){if(room.mines.filter(m=>m.owner===p.id).length>=3)room.mines.splice(room.mines.findIndex(m=>m.owner===p.id),1);room.mines.push({id:++room.bulletSeq,owner:p.id,team:p.team,x:p.x,y:p.y,life:22,arm:.65});}
  else if(p.classId==='guardian')grantShield(p,95);else p.overdrive=3;
  emit(room,{t:'skill',id:p.id,x:p.x,y:p.y,index});
 }else if(p.classId==='bomber'){
  for(const a of [-.22,0,.22])makeBullet(room,p,p.a+a,{bomb:true,speed:460,life:.75,damage:38,r:95,scalePower:false});emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb:true});
 }else if(p.classId==='assault'){emit(room,{t:'cone',x:p.x,y:p.y,a:p.a,r:260,color:'#ffaf64'});for(const other of room.players.values()){const dx=other.x-p.x,dy=other.y-p.y,angle=Math.atan2(dy,dx)-p.a;if(!other.dead&&other.connected&&enemy(room,p,other)&&other!==p&&Math.hypot(dx,dy)<260&&Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))<.65&&other.invuln<=0){damage(room,other,38,p.id);if(!other.dead)for(let i=0;i<12;i++)Object.assign(other,resolve(room.map,other.x+Math.cos(p.a)*8,other.y+Math.sin(p.a)*8));}}
 }else{const tank=p.classId==='guardian',r=tank?165:225;blast(room,p.x,p.y,r,tank?40:38,p.id,'#b6a0ff');if(tank)for(const other of room.players.values())if(other!==p&&enemy(room,p,other)&&distance(p,other)<r)other.slow=2;}
 return true;
}
function pickup(room,p,b){
 if(BUFFS[b.kind].duration)p.buffs[b.kind]=BUFFS[b.kind].duration;
 if(b.kind==='heal'||b.kind==='smallheal')p.hp=Math.min(p.maxHp,p.hp+(b.kind==='heal'?25:15));
 if(b.kind==='cooldown')p.cds=p.cds.map(cd=>Math.max(0,cd-2));
 if(b.kind==='titan')grantShield(p,35,true);
 if(b.kind==='shield')grantShield(p,35,true);
 emit(room,{t:'pickup',id:p.id,kind:b.kind,x:b.x,y:b.y});
}
function clearPath(room,a,b){const steps=Math.ceil(distance(a,b)/10);for(let i=1;i<=steps;i++){const p={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps};if(inWall(room.map.walls,p.x,p.y)||room.map.barrels.some(br=>br.hp>0&&distance(br,p)<17))return false;}return true;}
function spawnBuff(room){
 let roll=room.random()*100,rarity='common';for(const [id,tier]of Object.entries(RARITIES)){roll-=tier.weight;if(roll<0){rarity=id;break;}}
 const kinds=Object.keys(BUFFS).filter(k=>BUFFS[k].rarity===rarity);let pos=null;
 for(let i=0;i<100;i++){const p={x:120+room.random()*1360,y:100+room.random()*800};if(!inWall(room.map.walls,p.x,p.y,40)&&room.map.barrels.every(b=>distance(b,p)>60)&&room.map.hazards.every(h=>distance(h,p)>120)&&room.buffs.every(b=>distance(b,p)>85)){pos=p;break;}}
 if(!pos)return;room.buffs.push({id:++room.buffSeq,kind:kinds[Math.floor(room.random()*kinds.length)],...pos,life:26});
}
function updateHazards(room,dt){
 for(const h of room.map.hazards){
  if(h.type==='saw'){h.x=h.baseX+(h.axis===0?Math.sin(room.time*.8+h.phase)*70:0);h.y=h.baseY+(h.axis===1?Math.sin(room.time*.8+h.phase)*70:0);h.angle=room.time*6;
   for(const p of room.players.values())if(distance(p,h)<RAD+23)damage(room,p,36*dt);}
  else if(h.type==='turret'){
   h.angle=room.time*.65+(h.id==='t1'?Math.PI:0);h.next-=dt;
   if(h.next<=0){h.next=1.6;room.bullets.push({id:++room.bulletSeq,owner:null,team:null,x:h.x+Math.cos(h.angle)*25,y:h.y+Math.sin(h.angle)*25,vx:Math.cos(h.angle)*360,vy:Math.sin(h.angle)*360,life:2.4,damage:18,bomb:false,color:'#ff785d'});emit(room,{t:'turret',x:h.x,y:h.y});}
  }else{h.active=(room.time+h.phase)%7>4.8;for(const p of room.players.values())if(h.active&&distance(p,h)<RAD+52)damage(room,p,24*dt);}
 }
}
function moveZone(room){
 const old=room.zone;
 for(let i=0;i<100;i++){const x=180+room.random()*1240,y=180+room.random()*640;if(distance(old,{x,y})<300||inWall(room.map.walls,x,y,60)||room.map.barrels.some(b=>b.hp>0&&distance(b,{x,y})<60))continue;old.x=x;old.y=y;break;}
 old.nextAt+=15;old.clock=0;old.holder=null;old.contested=false;emit(room,{t:'zone',x:old.x,y:old.y});
}
function step(room,dt){
 if(room.match.status==='finished'){
  room.match.intermission+=dt;
  const active=[...room.players.values()].filter(p=>p.connected&&!p.bot);
  if(room.match.intermission>=3&&active.length&&active.every(p=>room.match.ready.has(p.id)))restartMatch(room);
  return;
 }
 room.time+=dt;
 for(const p of room.players.values()){
  if(!p.connected)continue;
  if(p.dead){p.respawn-=dt;if(p.respawn<=0){if(p.nextClass){p.classId=p.nextClass;p.nextClass=null;p.maxHp=CLASSES[p.classId].hp;p.cds=CLASSES[p.classId].skills.map(s=>s.cd*.5);}p.ultShots=3;p.dead=false;p.hp=p.maxHp;Object.assign(p,safePosition(room,p.team));p.shield=0;p.shieldMax=0;p.shieldTime=0;p.invuln=1;p.noHit=0;p.vx=p.vy=0;emit(room,{t:'respawn',id:p.id,x:p.x,y:p.y});}continue;}
  for(let i=0;i<3;i++)p.cds[i]=Math.max(0,p.cds[i]-dt*(p.buffs.focus>0?1.25:1));
  for(const k of Object.keys(p.buffs)){p.buffs[k]-=dt;if(p.buffs[k]<=0)delete p.buffs[k];}
  if(p.shield>0){p.shieldTime=Math.max(0,p.shieldTime-dt);if(p.shieldTime<.000001){p.shield=0;p.shieldMax=0;p.shieldTime=0;emit(room,{t:'shieldExpire',id:p.id,x:p.x,y:p.y});}}
  p.invuln=Math.max(0,p.invuln-dt);p.invis=Math.max(0,p.invis-dt);p.ricochetBoost=Math.max(0,p.ricochetBoost-dt);if(p.classId==='scout'&&p.cds[2]===0&&p.ultShots===0)p.ultShots=3;p.haste=Math.max(0,p.haste-dt);p.slow=Math.max(0,p.slow-dt);p.root=Math.max(0,p.root-dt);p.overdrive=Math.max(0,p.overdrive-dt);p.shotCd=Math.max(0,p.shotCd-dt);p.noHit+=dt;
  if(p.buffs.regen>0&&p.noHit>2)p.hp=Math.min(p.maxHp,p.hp+dt*2);
  if(p.noHit>8)p.hp=Math.min(p.maxHp,p.hp+dt); // 1 HP/s, after 8s without taking damage.
  const c=CLASSES[p.classId];let mx=p.input.x,my=p.input.y;const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
  let speed=c.speed*(p.buffs.speed>0?1.45:1)*(p.haste>0?1.5:1)*(p.slow>0?.55:1)*(p.buffs.titan>0?.9:1);
  if(p.dash>0){speed=p.classId==='guardian'?850:1100;mx=Math.cos(p.dashA);my=Math.sin(p.dashA);p.dash=Math.max(0,p.dash-dt);}
  if(p.root>0){speed=0;p.dash=0;}
  const oldX=p.x,oldY=p.y,pos=resolve(room.map,p.x+mx*speed*dt,p.y+my*speed*dt);p.x=pos.x;p.y=pos.y;p.vx=(p.x-oldX)/dt;p.vy=(p.y-oldY)/dt;p.a=p.input.a;
  if(p.input.fire)fire(room,p);
  for(let i=room.buffs.length-1;i>=0;i--)if(distance(p,room.buffs[i])<(p.buffs.magnet>0?90:31)&&(distance(p,room.buffs[i])<31||clearPath(room,p,room.buffs[i]))){pickup(room,p,room.buffs[i]);room.buffs.splice(i,1);}
 }
 for(let i=room.decoys.length-1;i>=0;i--){
  const d=room.decoys[i],owner=room.players.get(d.owner);d.life-=dt;if(d.life<=0||!owner?.connected){room.decoys.splice(i,1);continue;}
  const targets=[...room.players.values()].filter(p=>p.connected&&!p.dead&&p.invis<=0&&p.id!==d.owner&&enemy(room,d,p)).sort((a,b)=>distance(a,d)-distance(b,d));
  d.turn-=dt;if(d.turn<=0){d.turn=.30+room.random()*.25;d.moveA=(targets[0]?Math.atan2(targets[0].y-d.y,targets[0].x-d.x):d.a)+(room.random()<.5?-1:1)*(Math.PI/3+room.random()*.5);}
  const pos=resolve(room.map,d.x+Math.cos(d.moveA)*CLASSES.jester.speed*dt,d.y+Math.sin(d.moveA)*CLASSES.jester.speed*dt);d.vx=(pos.x-d.x)/dt;d.vy=(pos.y-d.y)/dt;d.x=pos.x;d.y=pos.y;
  d.a=targets[0]?Math.atan2(targets[0].y-d.y,targets[0].x-d.x):d.moveA;d.shot-=dt;
  if(d.shot<=0){d.shot=.33;makeBullet(room,{...d,id:d.owner},d.a+(room.random()-.5)*.12,{damage:8,speed:690,life:.8,scalePower:false});emit(room,{t:'shot',id:d.id,x:d.x,y:d.y,bomb:false});}
 }
 if(room.mode==='normal')updateHazards(room,dt);
 for(let i=room.bullets.length-1;i>=0;i--){
  if(room.match.status!=='playing')break;
  const b=room.bullets[i];let removed=false;const substeps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/10));
  for(let j=0;j<substeps&&!removed;j++){
   const oldX=b.x,oldY=b.y;b.x+=b.vx*dt/substeps;b.y+=b.vy*dt/substeps;b.life-=dt/substeps;
   if(b.life<=0){removed=true;break;}
   if(b.x<2||b.x>W-2||b.y<2||b.y>H-2||inWall(room.map.walls,b.x,b.y)){
    if(b.bounces>0){
     const hitX=b.x<2||b.x>W-2||inWall(room.map.walls,b.x,oldY),hitY=b.y<2||b.y>H-2||inWall(room.map.walls,oldX,b.y);
     if(hitX||!hitY)b.vx=-b.vx;if(hitY)b.vy=-b.vy;b.x=oldX;b.y=oldY;b.bounces--;continue;
    }removed=true;break;
   }
   const barrel=room.map.barrels.find(br=>br.hp>0&&distance(br,b)<18);
   if(barrel){if(!b.bomb)hitBarrel(room,barrel,b.damage,b.owner);removed=true;break;}
   const owner=room.players.get(b.owner);
   for(const p of room.players.values())if(p.connected&&!p.dead&&p.id!==b.owner&&enemy(room,owner,p)&&!(b.hitIds||[]).includes(p.id)&&distance(p,b)<RAD+4){if(!b.bomb){damage(room,p,b.damage,b.owner);if(b.slow>0&&!p.dead&&p.invuln<=0)p.slow=Math.max(p.slow,b.slow);if(b.root>0&&!p.dead&&p.invuln<=0){p.root=Math.max(p.root,b.root);p.dash=0;emit(room,{t:'freeze',x:p.x,y:p.y,color:'#83e8ff'});}}if(b.pierce>0){b.hitIds.push(p.id);b.pierce--;}else removed=true;break;}
   if(!removed)for(const d of room.decoys)if(d.life>0&&d.owner!==b.owner&&enemy(room,owner,d)&&distance(d,b)<RAD+4){if(!b.bomb)hurtDecoy(room,d,b.damage,b.owner);removed=true;break;}
  }
  if(removed){if(b.bomb)blast(room,b.x,b.y,b.r,b.damage,b.owner);room.bullets.splice(i,1);}
 }
 for(let i=room.mines.length-1;i>=0;i--){const m=room.mines[i];m.arm-=dt;m.life-=dt;const owner=room.players.get(m.owner);if(m.arm<=0&&[...room.players.values()].some(p=>p.connected&&!p.dead&&p.id!==m.owner&&enemy(room,owner,p)&&distance(p,m)<40)){blast(room,m.x,m.y,125,65,m.owner);room.mines.splice(i,1);}else if(m.life<=0)room.mines.splice(i,1);}
 for(const b of room.map.barrels)if(b.hp<=0){b.respawn=Math.max(0,b.respawn-dt);if(b.respawn===0){if([...room.players.values()].some(p=>p.connected&&!p.dead&&distance(p,b)<50))b.respawn=1;else{b.hp=50;emit(room,{t:'barrel',id:b.id,x:b.x,y:b.y});}}}
 for(let i=room.buffs.length-1;i>=0;i--){room.buffs[i].life-=dt;if(room.buffs[i].life<=0)room.buffs.splice(i,1);}
 room.nextBuff-=dt;if(room.nextBuff<=0){room.nextBuff=6.5;if(room.buffs.length<4)spawnBuff(room);}
 if(room.mode==='zone'||room.mode==='zoneTeam'){
  const z=room.zone;if(room.time>=z.nextAt)moveZone(room);
  const inside=[...room.players.values()].filter(p=>p.connected&&!p.dead&&distance(p,z)<=z.r-RAD);
  const teams=[...new Set(inside.map(p=>p.team))];
  z.contested=room.mode==='zoneTeam'?teams.length>1:inside.length>1;const holder=!z.contested&&inside.length?inside[0]:null;
  const holderKey=holder?(room.mode==='zoneTeam'?'team'+holder.team:holder.id):null;z.team=room.mode==='zoneTeam'&&holder?holder.team:null;
  if(z.holder!==holderKey){z.clock=0;z.holder=holderKey;}
  if(holder){z.clock+=dt;while(z.clock>=1){if(room.mode==='zoneTeam'){room.teamScores[holder.team]++;for(const p of inside)p.score++;}else holder.score++;z.clock-=1;checkMatch(room);if(room.match.status==='finished')break;}}
 }
 if(room.mode==='flag'){
  const flag=room.flag;let owner=room.players.get(flag.owner);
  if(owner&&(!owner.connected||owner.dead)){dropFlag(room,owner,null);owner=null;}
  if(!flag.owner){const candidate=[...room.players.values()].find(p=>p.connected&&!p.dead&&distance(p,flag)<32);if(candidate){flag.owner=candidate.id;flag.clock=0;owner=candidate;emit(room,{t:'flag',owner:candidate.id});}}
  if(owner){flag.x=owner.x;flag.y=owner.y;flag.clock+=dt;while(flag.clock>=1){owner.score++;flag.clock-=1;checkMatch(room);if(room.match.status==='finished')break;}}
 }
}
const round=n=>Math.round(n*10)/10;
function snapshot(room,viewerId=null){
 const viewer=room.players.get(viewerId);
 const serialize=p=>({bot:!!p.bot,id:p.id,name:p.name,cosmetics:p.cosmetics,classId:p.classId,team:p.team,x:round(p.x),y:round(p.y),a:Math.round(p.a*1000)/1000,vx:round(p.vx||0),vy:round(p.vy||0),hp:round(p.hp),maxHp:p.maxHp,score:p.score,kills:p.kills,deaths:p.deaths,dead:!!p.dead,respawn:round(p.respawn||0),connected:p.connected!==false,cds:(p.cds||[0,0,0]).map(round),shield:round(p.shield||0),shieldMax:p.shieldMax||0,shieldTime:round(p.shieldTime||0),invuln:round(p.invuln||0),invis:p.id===viewerId||!enemy(room,viewer,p)?round(p.invis||0):0,ultShots:p.ultShots??3,nextClass:p.nextClass||null,ricochetBoost:round(p.ricochetBoost||0),dash:round(p.dash||0),haste:round(p.haste||0),root:round(p.root||0),overdrive:round(p.overdrive||0),slow:round(p.slow||0),buffs:Object.fromEntries(Object.entries(p.buffs||{}).map(([k,v])=>[k,round(v)]))});
 const visible=[...room.players.values()].filter(p=>p.invis<=0||p.id===viewerId||!enemy(room,viewer,p)||room.flag.owner===p.id).map(serialize);
 for(const d of room.decoys)if(d.life>0){const copy=serialize(d);if(viewerId===d.owner||!enemy(room,viewer,d))copy.allyDecoy=true;visible.push(copy);}
 const active=[...room.players.values()].filter(p=>p.connected&&!p.bot);
 return{t:'state',match:{round:room.match.round,status:room.match.status,target:room.match.target,winner:room.match.winner,results:room.match.results,finishedAt:round(room.match.finishedAt),ready:room.match.ready.has(viewerId),readyCount:active.filter(p=>room.match.ready.has(p.id)).length,required:active.length},time:Math.round(room.time*100)/100,mode:room.mode,teamScores:room.teamScores,flag:room.mode==='flag'?room.flag:null,zone:(room.mode==='zone'||room.mode==='zoneTeam')?room.zone:null,
 roster:[...room.players.values()].map(p=>({bot:!!p.bot,id:p.id,name:p.name,cosmetics:p.cosmetics,classId:p.classId,team:p.team,score:p.score,kills:p.kills,connected:p.connected})),players:visible,
 bullets:room.bullets.map(b=>({id:b.id,owner:b.owner,x:round(b.x),y:round(b.y),vx:round(b.vx),vy:round(b.vy),bomb:b.bomb,kind:b.kind,color:b.color})),
 barrels:room.map.barrels.map(b=>({id:b.id,hp:b.hp,respawn:round(b.respawn)})),buffs:room.buffs,mines:room.mines,
 hazards:room.map.hazards.map(h=>({id:h.id,type:h.type,x:round(h.x),y:round(h.y),angle:Math.round((h.angle||0)*1000)/1000,active:h.active||false,warning:h.type==='lava'&&!h.active&&(room.time+h.phase)%7>3.6}))};
}
return{W,H,RAD,isTeamMode,COSMETICS,normalizeCosmetics,CLASSES,MODES,BUFFS,RARITIES,DEFAULT_BINDINGS,clamp,hash,rng,resolve,inWall,generateMap,safePosition,createRoom,addPlayer,checkMatch,voteRematch,restartMatch,queueClass,enemy,damage,kill,blast,fire,skill,step,snapshot,dropFlag};
});
