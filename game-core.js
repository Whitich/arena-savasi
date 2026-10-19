(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ArenaCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const W=1600,H=1000,RAD=16;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MODES={normal:{name:'Normal Arena',description:'Herkes tek · testereler, taretler ve lav kapanları'},tdm:{name:'Takım Ölüm Maçı',description:'Kırmızı ve mavi · ortak öldürme skoru · dost ateşi kapalı'},flag:{name:'Bayrak Taşıma',description:'Herkes tek · bayrak sende kaldıkça saniyede +1 puan'}};
const CLASSES={
 assault:{name:'Akıncı',icon:'⚔',color:'#5b9cff',hp:100,speed:260,damage:25,interval:.24,skills:[{name:'Atılma',icon:'💨',cd:4},{name:'Enerji Kalkanı',icon:'🛡',cd:11},{name:'Şok Dalgası',icon:'⚡',cd:16}],description:'Dengeli savaşçı. Hızlı atılma, kısa kalkan ve alan hasarı.'},
 scout:{name:'İzci',icon:'🏹',color:'#55dfc2',hp:85,speed:305,damage:24,interval:.27,skills:[{name:'Uzun Atılma',icon:'💨',cd:5},{name:'Adrenalin',icon:'⚡',cd:12},{name:'Keskin Atış',icon:'🎯',cd:15}],description:'Hızlı ve kırılgan. Uzun atılma, hız patlaması ve 65 hasarlık keskin atış.'},
 guardian:{name:'Muhafız',icon:'🛡',color:'#b6a0ff',hp:145,speed:215,damage:32,interval:.32,skills:[{name:'Hücum',icon:'💥',cd:6},{name:'Kale Kalkanı',icon:'🛡',cd:14},{name:'Yer Sarsıntısı',icon:'🌋',cd:18}],description:'Yüksek can, düşük hız. Hücum, uzun kalkan ve yakında güçlü alan hasarı.'},
 bomber:{name:'Bombacı',icon:'💣',color:'#ffad68',hp:105,speed:245,damage:27,interval:.28,skills:[{name:'Kaçış Atılması',icon:'💨',cd:5},{name:'Kara Mayını',icon:'💥',cd:10},{name:'Bomba Salvosu',icon:'🚀',cd:17}],description:'Alan kontrolü. Kaçış, düşmana tetiklenen mayın ve üç bombalık salvo.'}
};
const BUFFS={speed:{name:'Hız',icon:'⚡',color:'#4dd7e6',duration:8},double:{name:'Çift Namlu',icon:'🔫',color:'#ffd166',duration:9},power:{name:'Güçlü Mermi',icon:'💥',color:'#ff7a6b',duration:9},heal:{name:'Can Paketi',icon:'♥',color:'#65dc99',duration:0},shield:{name:'Kalkan',icon:'🛡',color:'#b9a1ff',duration:2},range:{name:'Uzun Menzil',icon:'🎯',color:'#ffc857',duration:14,legendary:true},rapid:{name:'Hızlı Tarama',icon:'⚡',color:'#ffc857',duration:10,legendary:true},launcher:{name:'Bomba Fırlatıcı',icon:'🚀',color:'#ffc857',duration:12,legendary:true},vampire:{name:'Can Çalma',icon:'🩸',color:'#ffc857',duration:10,legendary:true}};
const COSMETICS={colors:{azure:{name:'Mavi',hex:'#5b9cff'},coral:{name:'Mercan',hex:'#ff718a'},mint:{name:'Nane',hex:'#55dfbc'},gold:{name:'Altın',hex:'#ffd166'},violet:{name:'Mor',hex:'#bb91ff'},orange:{name:'Turuncu',hex:'#ff9f58'},pink:{name:'Pembe',hex:'#f57ed5'},ice:{name:'Buz',hex:'#83e5ef'},lime:{name:'Limon',hex:'#bded63'},silver:{name:'Gümüş',hex:'#d2ddea'}},patterns:{plain:'Düz',stripe:'Çizgili',cross:'Artı',star:'Yıldız'},hats:{none:'Yok',crown:'Taç',horns:'Boynuz',antenna:'Anten'}};
function normalizeCosmetics(value={},seed=''){
 value=value&&typeof value==='object'?value:{};
 const colors=Object.keys(COSMETICS.colors);
 return{color:Object.hasOwn(COSMETICS.colors,value.color)?value.color:colors[hash(seed)%colors.length],pattern:Object.hasOwn(COSMETICS.patterns,value.pattern)?value.pattern:'plain',hat:Object.hasOwn(COSMETICS.hats,value.hat)?value.hat:'none'};
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
 return{code,mode,seed,map:generateMap(seed,mode),random:rng(hash(seed+'buff')),players:new Map(),bullets:[],mines:[],buffs:[],events:[],time:0,bulletSeq:0,buffSeq:0,nextBuff:2,teamScores:[0,0],flag:{owner:null,x:800,y:500,clock:0},emptyAt:0};
}
function addPlayer(room,id,name,classId='assault',cosmetics={}){
 const team=room.mode==='tdm'?([0,1].map(t=>[...room.players.values()].filter(p=>p.connected&&p.team===t).length).reduce((best,n,i,a)=>n<a[best]?i:best,0)):null;
 const c=CLASSES[classId]||CLASSES.assault;
 const p={id,cosmetics:normalizeCosmetics(cosmetics,id),name:String(name||'Oyuncu').slice(0,14),classId:CLASSES[classId]?classId:'assault',team,...safePosition(room,team),a:0,hp:c.hp,maxHp:c.hp,score:0,kills:0,deaths:0,dead:false,respawn:0,connected:true,input:{x:0,y:0,a:0,fire:false},cds:[0,0,0],shotCd:0,shield:0,dash:0,dashA:0,haste:0,slow:0,buffs:{},noHit:0,vx:0,vy:0};
 room.players.set(id,p);return p;
}
function emit(room,event){room.events.push(event);}
function enemy(room,a,b){return !a||room.mode!=='tdm'||a.team!==b.team;}
function dropFlag(room,p,killer){if(room.mode!=='flag'||room.flag.owner!==p.id)return;room.flag.owner=killer&&!killer.dead&&killer.connected?killer.id:null;room.flag.x=p.x;room.flag.y=p.y;room.flag.clock=0;emit(room,{t:'flag',owner:room.flag.owner});}
function kill(room,p,killer){
 if(p.dead)return;p.dead=true;p.hp=0;p.respawn=3;p.deaths++;p.input.fire=false;p.shield=0;p.dash=0;p.haste=0;p.buffs={};
 if(killer&&killer!==p&&enemy(room,killer,p)){killer.kills++;if(room.mode!=='flag')killer.score++;if(room.mode==='tdm')room.teamScores[killer.team]++;}
 else killer=null;
 dropFlag(room,p,killer);emit(room,{t:'death',id:p.id,killer:killer?.id||null,x:p.x,y:p.y});
}
function damage(room,p,amount,owner=null){
 if(p.dead||!p.connected||p.shield>0)return 0;
 const killer=room.players.get(owner);if(killer&&(!enemy(room,killer,p)||killer===p))return 0;
 const dealt=Math.min(p.hp,amount);p.hp=Math.max(0,p.hp-amount);p.noHit=0;emit(room,{t:'hit',id:p.id,owner,x:p.x,y:p.y,amount:Math.round(dealt)});
 if(killer?.buffs.vampire>0&&!killer.dead)killer.hp=Math.min(killer.maxHp,killer.hp+dealt*.2);
 if(p.hp<=0)kill(room,p,killer);return dealt;
}
function blast(room,x,y,r,amount,owner=null,color='#ffad68'){
 emit(room,{t:'explosion',x,y,r,color});
 for(const p of room.players.values())if(distance(p,{x,y})<r+RAD)damage(room,p,amount,owner);
 // Chain reactions are scheduled once per barrel; mark dead before recursing.
 for(const b of room.map.barrels)if(b.hp>0&&distance(b,{x,y})<r+15)hitBarrel(room,b,amount,owner);
}
function hitBarrel(room,b,amount,owner){
 if(b.hp<=0)return;b.hp=Math.max(0,b.hp-amount);
 if(b.hp===0){b.respawn=20;blast(room,b.x,b.y,170,42,owner,'#ff9e6d');}
}
function makeBullet(room,p,angle,options={}){
 const range=p.buffs.range>0?1.7:1;
 const b={id:++room.bulletSeq,owner:p.id,team:p.team,x:p.x+Math.cos(angle)*24,y:p.y+Math.sin(angle)*24,vx:Math.cos(angle)*(options.speed||720),vy:Math.sin(angle)*(options.speed||720),life:(options.life||.85)*range,damage:options.damage||CLASSES[p.classId].damage*(p.buffs.power>0?1.5:1),bomb:!!options.bomb,r:options.r||95,color:CLASSES[p.classId].color};
 room.bullets.push(b);return b;
}
function fire(room,p){
 if(p.dead||!p.connected||p.shotCd>0)return false;
 const c=CLASSES[p.classId],bomb=p.buffs.launcher>0;
 p.shotCd=bomb?.65:c.interval*(p.buffs.rapid>0?.5:1);
 const opts=bomb?{bomb:true,speed:440,life:1.1,damage:60}:{};
 if(p.buffs.double>0&&!bomb){makeBullet(room,p,p.a-.09,opts);makeBullet(room,p,p.a+.09,opts);}else makeBullet(room,p,p.a,opts);
 emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb});return true;
}
function skill(room,p,index){
 if(p.dead||!p.connected||!Number.isInteger(index)||index<0||index>2||p.cds[index]>0)return false;
 const c=CLASSES[p.classId];p.cds[index]=c.skills[index].cd;
 if(index===0){p.dash=p.classId==='scout'?.23:p.classId==='guardian'?.23:.16;p.dashA=p.a;emit(room,{t:'dash',id:p.id,x:p.x,y:p.y});}
 else if(index===1){
  if(p.classId==='scout')p.haste=3;
  else if(p.classId==='bomber'){if(room.mines.filter(m=>m.owner===p.id).length>=3)room.mines.splice(room.mines.findIndex(m=>m.owner===p.id),1);room.mines.push({id:++room.bulletSeq,owner:p.id,team:p.team,x:p.x,y:p.y,life:22,arm:.65});}
  else p.shield=p.classId==='guardian'?2.8:1.4;
  emit(room,{t:'skill',id:p.id,x:p.x,y:p.y,index});
 }else if(p.classId==='scout'){
  makeBullet(room,p,p.a,{speed:1150,life:1.3,damage:65});emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb:false});
 }else if(p.classId==='bomber'){
  for(const a of [-.22,0,.22])makeBullet(room,p,p.a+a,{bomb:true,speed:460,life:.75,damage:45,r:100});emit(room,{t:'shot',id:p.id,x:p.x,y:p.y,bomb:true});
 }else{const tank=p.classId==='guardian',r=tank?165:225;blast(room,p.x,p.y,r,tank?65:40,p.id,'#b6a0ff');if(tank)for(const other of room.players.values())if(other!==p&&enemy(room,p,other)&&distance(p,other)<r)other.slow=2;}
 return true;
}
function pickup(room,p,b){
 if(BUFFS[b.kind].duration)p.buffs[b.kind]=BUFFS[b.kind].duration;
 if(b.kind==='heal')p.hp=Math.min(p.maxHp,p.hp+25);
 if(b.kind==='shield')p.shield=Math.max(p.shield,2);
 emit(room,{t:'pickup',id:p.id,kind:b.kind,x:b.x,y:b.y});
}
function spawnBuff(room){
 const kinds=room.random()<.23?['range','rapid','launcher','vampire']:['speed','double','power','heal','shield'];
 let p;for(let i=0;i<100;i++){p={x:120+room.random()*1360,y:100+room.random()*800};if(!inWall(room.map.walls,p.x,p.y,40)&&room.map.barrels.every(b=>distance(b,p)>60)&&room.map.hazards.every(h=>distance(h,p)>120))break;}
 room.buffs.push({id:++room.buffSeq,kind:kinds[Math.floor(room.random()*kinds.length)],...p,life:24});
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
function step(room,dt){
 room.time+=dt;
 for(const p of room.players.values()){
  if(!p.connected)continue;
  if(p.dead){p.respawn-=dt;if(p.respawn<=0){p.dead=false;p.hp=p.maxHp;Object.assign(p,safePosition(room,p.team));p.shield=1;p.noHit=0;p.vx=p.vy=0;emit(room,{t:'respawn',id:p.id,x:p.x,y:p.y});}continue;}
  for(let i=0;i<3;i++)p.cds[i]=Math.max(0,p.cds[i]-dt);
  for(const k of Object.keys(p.buffs)){p.buffs[k]-=dt;if(p.buffs[k]<=0)delete p.buffs[k];}
  p.shield=Math.max(0,p.shield-dt);p.haste=Math.max(0,p.haste-dt);p.slow=Math.max(0,p.slow-dt);p.shotCd=Math.max(0,p.shotCd-dt);p.noHit+=dt;
  if(p.noHit>8)p.hp=Math.min(p.maxHp,p.hp+dt); // 1 HP/s, after 8s without taking damage.
  const c=CLASSES[p.classId];let mx=p.input.x,my=p.input.y;const len=Math.hypot(mx,my);if(len>1){mx/=len;my/=len;}
  let speed=c.speed*(p.buffs.speed>0?1.45:1)*(p.haste>0?1.5:1)*(p.slow>0?.55:1);
  if(p.dash>0){speed=p.classId==='guardian'?850:1100;mx=Math.cos(p.dashA);my=Math.sin(p.dashA);p.dash=Math.max(0,p.dash-dt);}
  const oldX=p.x,oldY=p.y,pos=resolve(room.map,p.x+mx*speed*dt,p.y+my*speed*dt);p.x=pos.x;p.y=pos.y;p.vx=(p.x-oldX)/dt;p.vy=(p.y-oldY)/dt;p.a=p.input.a;
  if(p.input.fire)fire(room,p);
  for(let i=room.buffs.length-1;i>=0;i--)if(distance(p,room.buffs[i])<31){pickup(room,p,room.buffs[i]);room.buffs.splice(i,1);}
 }
 if(room.mode==='normal')updateHazards(room,dt);
 for(let i=room.bullets.length-1;i>=0;i--){
  const b=room.bullets[i];let removed=false;const substeps=Math.max(1,Math.ceil(Math.hypot(b.vx,b.vy)*dt/10));
  for(let j=0;j<substeps&&!removed;j++){
   b.x+=b.vx*dt/substeps;b.y+=b.vy*dt/substeps;b.life-=dt/substeps;
   if(b.life<=0||b.x<0||b.x>W||b.y<0||b.y>H||inWall(room.map.walls,b.x,b.y)){removed=true;break;}
   const barrel=room.map.barrels.find(br=>br.hp>0&&distance(br,b)<18);
   if(barrel){if(!b.bomb)hitBarrel(room,barrel,b.damage,b.owner);removed=true;break;}
   const owner=room.players.get(b.owner);
   for(const p of room.players.values())if(p.connected&&!p.dead&&p.id!==b.owner&&enemy(room,owner,p)&&distance(p,b)<RAD+4){if(!b.bomb)damage(room,p,b.damage,b.owner);removed=true;break;}
  }
  if(removed){if(b.bomb)blast(room,b.x,b.y,b.r,b.damage,b.owner);room.bullets.splice(i,1);}
 }
 for(let i=room.mines.length-1;i>=0;i--){const m=room.mines[i];m.arm-=dt;m.life-=dt;const owner=room.players.get(m.owner);if(m.arm<=0&&[...room.players.values()].some(p=>p.connected&&!p.dead&&p.id!==m.owner&&enemy(room,owner,p)&&distance(p,m)<40)){blast(room,m.x,m.y,125,65,m.owner);room.mines.splice(i,1);}else if(m.life<=0)room.mines.splice(i,1);}
 for(const b of room.map.barrels)if(b.hp<=0){b.respawn=Math.max(0,b.respawn-dt);if(b.respawn===0){if([...room.players.values()].some(p=>p.connected&&!p.dead&&distance(p,b)<50))b.respawn=1;else{b.hp=50;emit(room,{t:'barrel',id:b.id,x:b.x,y:b.y});}}}
 for(let i=room.buffs.length-1;i>=0;i--){room.buffs[i].life-=dt;if(room.buffs[i].life<=0)room.buffs.splice(i,1);}
 room.nextBuff-=dt;if(room.nextBuff<=0){room.nextBuff=8;if(room.buffs.length<3)spawnBuff(room);}
 if(room.mode==='flag'){
  const flag=room.flag;let owner=room.players.get(flag.owner);
  if(owner&&(!owner.connected||owner.dead)){dropFlag(room,owner,null);owner=null;}
  if(!flag.owner){const candidate=[...room.players.values()].find(p=>p.connected&&!p.dead&&distance(p,flag)<32);if(candidate){flag.owner=candidate.id;flag.clock=0;owner=candidate;emit(room,{t:'flag',owner:candidate.id});}}
  if(owner){flag.x=owner.x;flag.y=owner.y;flag.clock+=dt;while(flag.clock>=1){owner.score++;flag.clock-=1;}}
 }
}
const round=n=>Math.round(n*10)/10;
function snapshot(room){
 return{t:'state',time:round(room.time),mode:room.mode,teamScores:room.teamScores,flag:room.mode==='flag'?room.flag:null,
 players:[...room.players.values()].map(p=>({id:p.id,name:p.name,cosmetics:p.cosmetics,classId:p.classId,team:p.team,x:round(p.x),y:round(p.y),a:Math.round(p.a*1000)/1000,vx:round(p.vx),vy:round(p.vy),hp:round(p.hp),maxHp:p.maxHp,score:p.score,kills:p.kills,deaths:p.deaths,dead:p.dead,respawn:round(p.respawn),connected:p.connected,cds:p.cds.map(round),shield:round(p.shield),dash:round(p.dash),haste:round(p.haste),slow:round(p.slow),buffs:Object.fromEntries(Object.entries(p.buffs).map(([k,v])=>[k,round(v)]))})),
 bullets:room.bullets.map(b=>({id:b.id,owner:b.owner,x:round(b.x),y:round(b.y),vx:round(b.vx),vy:round(b.vy),bomb:b.bomb,color:b.color})),
 barrels:room.map.barrels.map(b=>({id:b.id,hp:b.hp,respawn:round(b.respawn)})),buffs:room.buffs,mines:room.mines,
 hazards:room.map.hazards.map(h=>({id:h.id,type:h.type,x:round(h.x),y:round(h.y),angle:Math.round((h.angle||0)*1000)/1000,active:h.active||false}))};
}
return{W,H,RAD,COSMETICS,normalizeCosmetics,CLASSES,MODES,BUFFS,DEFAULT_BINDINGS,clamp,hash,rng,resolve,inWall,generateMap,safePosition,createRoom,addPlayer,enemy,damage,kill,blast,fire,skill,step,snapshot,dropFlag};
});
