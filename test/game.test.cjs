const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../game-core.js');
const empty=(mode='normal')=>{const r=G.createRoom('TEST',mode);r.map={walls:[],barrels:[],hazards:[]};r.nextBuff=1000;return r;};
const add=(r,id='one',classId='assault')=>G.addPlayer(r,id,id,classId);
function advance(r,time){for(let i=0;i<Math.round(time/.025);i++)G.step(r,.025);}
test('eight classes have distinct stats and all twenty-four skills execute with cooldown',()=>{
 assert.equal(Object.keys(G.CLASSES).length,8);
 for(const id of Object.keys(G.CLASSES))for(let i=0;i<3;i++){
  const r=empty(),p=add(r,'one',id);p.x=300;p.y=300;
  assert.equal(G.skill(r,p,i),true,id+' skill '+i);assert.ok(p.cds[i]>0||(id==='scout'&&i===2&&p.ultShots===2));assert.equal(G.skill(r,p,i),false);
  advance(r,.1);assert.ok(p.hp<=p.maxHp);
 }
});
test('team assignment balances, friendly fire is disabled, kills increase team total',()=>{
 const r=empty('tdm'),a=add(r,'a'),b=add(r,'b'),c=add(r,'c');assert.equal(a.team,0);assert.equal(b.team,1);assert.equal(c.team,0);
 G.damage(r,c,500,a.id);assert.equal(c.hp,c.maxHp);G.damage(r,b,500,a.id);
 assert.equal(b.dead,true);assert.equal(a.score,1);assert.deepEqual(r.teamScores,[1,0]);G.damage(r,b,500,a.id);assert.equal(a.score,1);
});
test('flag awards per second, transfers on kill, retains earned scores and drops on disconnect',()=>{
 const r=empty('flag'),a=add(r,'a'),b=add(r,'b');Object.assign(a,{x:800,y:500});Object.assign(b,{x:100,y:100});advance(r,2.05);
 assert.equal(r.flag.owner,'a');assert.equal(a.score,2);G.damage(r,a,500,b.id);assert.equal(r.flag.owner,'b');advance(r,1.05);assert.equal(a.score,2);assert.equal(b.score,1);
 b.connected=false;G.dropFlag(r,b,null);assert.equal(r.flag.owner,null);assert.equal(b.score,1);
});
test('passive healing waits eight seconds, then heals only one HP each second',()=>{
 const r=empty(),p=add(r);p.hp=40;advance(r,7.9);assert.equal(p.hp,40);advance(r,1.1);assert.ok(p.hp>=40.9&&p.hp<=41.1);
});
test('hazards exist exclusively in normal mode',()=>{
 assert.ok(G.createRoom('TEST','normal').map.hazards.some(h=>h.type==='saw'));
 for(const mode of ['tdm','flag','zone'])assert.equal(G.createRoom('TEST',mode).map.hazards.length,0);
});
test('destroyed TNT returns after twenty seconds and does not spawn inside players',()=>{
 const r=empty(),p=add(r);Object.assign(p,{x:100,y:100});r.map.barrels=[{id:0,x:500,y:500,hp:50,respawn:0}];G.blast(r,500,500,50,100,p.id);assert.equal(r.map.barrels[0].hp,0);
 advance(r,19.9);assert.equal(r.map.barrels[0].hp,0);p.x=500;p.y=500;advance(r,.2);assert.equal(r.map.barrels[0].hp,0);p.x=100;p.y=100;advance(r,1.1);assert.equal(r.map.barrels[0].hp,50);
});
test('legendary range, rapid fire and bomb launcher modify actual weapon behavior',()=>{
 const r=empty(),p=add(r);G.fire(r,p);const baseLife=r.bullets[0].life,baseCd=p.shotCd;p.shotCd=0;p.buffs.range=10;p.buffs.rapid=10;G.fire(r,p);assert.ok(r.bullets[1].life>baseLife);assert.ok(p.shotCd<baseCd);
 p.shotCd=0;p.buffs.launcher=10;G.fire(r,p);const b=r.bullets.at(-1);assert.equal(b.bomb,true);const enemy=add(r,'enemy');enemy.x=b.x+80;enemy.y=b.y;b.life=.01;advance(r,.025);assert.ok(enemy.hp<enemy.maxHp);
});
test('projectiles use substeps, hit enemies and do not tunnel through a target',()=>{
 const r=empty(),a=add(r,'a'),b=add(r,'b');Object.assign(a,{x:100,y:100,a:0});Object.assign(b,{x:160,y:100});G.fire(r,a);advance(r,.1);assert.equal(b.hp,75);
});
test('respawn returns class maximum HP and removes active weapon buffs',()=>{
 const r=empty(),p=add(r,'a','guardian');p.buffs.launcher=10;G.damage(r,p,1000,null);assert.equal(p.dead,true);assert.deepEqual(p.buffs,{});advance(r,3.1);assert.equal(p.dead,false);assert.equal(p.hp,145);
});
test('snapshot is serializable and never contains session tokens or sockets',()=>{
 const r=empty();const p=add(r);p.token='PRIVATE';p.ws={private:true};const text=JSON.stringify(G.snapshot(r));assert.ok(!text.includes('PRIVATE'));assert.ok(!text.includes('private'));
});
test('cosmetics validate all choices, reject injected values and survive snapshots',()=>{
 const look=G.normalizeCosmetics({color:'coral',pattern:'star',hat:'crown',aura:'rune',trail:'comet',visor:'glass'});assert.deepEqual(look,{color:'coral',pattern:'star',hat:'crown',aura:'rune',trail:'comet',visor:'glass'});
 const bad=G.normalizeCosmetics({color:'<script>',pattern:'__proto__',hat:'constructor'},'test');assert.ok(Object.hasOwn(G.COSMETICS.colors,bad.color));assert.equal(bad.pattern,'plain');assert.equal(bad.hat,'none');
 const r=empty('tdm'),p=G.addPlayer(r,'a','Alice','guardian',look);const other=G.addPlayer(r,'b','Bob','guardian',{color:'mint',pattern:'stripe',hat:'antenna'});
 const state=G.snapshot(r);assert.equal(state.players[0].cosmetics.color,'coral');assert.equal(state.players[1].cosmetics.color,'mint');assert.equal(p.maxHp,145);assert.notEqual(p.team,other.team);
});
test('shields absorb damage, break under repeated fire, overflow into HP and never decay with time',()=>{
 const r=empty(),p=add(r,'a','guardian');G.skill(r,p,1);assert.equal(p.shield,95);advance(r,2);assert.equal(p.shield,95);G.damage(r,p,25);assert.equal(p.hp,145);assert.equal(p.shield,70);G.damage(r,p,25);assert.equal(p.shield,45);G.damage(r,p,65);assert.equal(p.shield,0);assert.equal(p.hp,125);
});
test('ricochet bullets reflect off map walls and arena boundaries while lifetime remains bounded',()=>{
 const r=empty(),p=add(r,'a','ricochet');Object.assign(p,{x:100,y:100,a:0});r.map.walls=[{x:200,y:50,w:40,h:100}];G.fire(r,p);const b=r.bullets[0];assert.equal(b.bounces,3);assert.ok(b.life>1.5);assert.ok(b.vx>900);advance(r,.12);assert.ok(b.vx<0);assert.equal(b.bounces,2);assert.ok(b.x<200);advance(r,.2);assert.ok(b.vx>0);advance(r,3.1);assert.equal(r.bullets.length,0);
});
test('scout ultimate has three separately activated shots, then starts one full cooldown',()=>{
 const r=empty(),p=add(r,'a','scout');
 for(let i=0;i<3;i++){assert.equal(G.skill(r,p,2),true);assert.equal(p.ultShots,2-i);assert.equal(p.cds[2]>0,i===2);if(i<2)advance(r,.25);}
 assert.equal(G.skill(r,p,2),false);advance(r,17.1);assert.equal(p.ultShots,3);assert.equal(p.cds[2],0);
});
test('mage blink uses cursor target, respects max range and never ends inside solid geometry',()=>{
 const r=empty(),p=add(r,'a','mage');Object.assign(p,{x:100,y:100});G.skill(r,p,0,{x:350,y:200});assert.ok(Math.abs(p.x-350)<1);assert.ok(Math.abs(p.y-200)<1);
 p.cds[0]=0;r.map.walls=[{x:500,y:100,w:120,h:200}];const before={x:p.x,y:p.y};G.skill(r,p,0,{x:2000,y:200});assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=381);assert.equal(G.inWall(r.map.walls,p.x,p.y,16),false);
});
test('invisible assassins are excluded from enemy snapshots but visible to themselves; attacking breaks cloak',()=>{
 const r=empty(),p=add(r,'a','assassin'),enemy=add(r,'b');G.skill(r,p,1);assert.ok(p.invis>.9);assert.ok(!G.snapshot(r,enemy.id).players.some(x=>x.id===p.id));assert.ok(G.snapshot(r,p.id).players.some(x=>x.id===p.id));G.fire(r,p);assert.equal(p.invis,0);assert.ok(G.snapshot(r,enemy.id).players.some(x=>x.id===p.id));
 p.cds[1]=0;G.skill(r,p,1);advance(r,1.1);assert.equal(p.invis,0);
});
test('jester clone looks like the owner to enemies, moves, fires, has no scoreboard entry and expires in 2s',()=>{
 const r=empty(),p=add(r,'a','jester'),opponent=add(r,'b');Object.assign(p,{x:200,y:200});Object.assign(opponent,{x:900,y:700});G.skill(r,p,1);assert.equal(r.decoys.length,1);const d=r.decoys[0],start={x:d.x,y:d.y};advance(r,.5);
 assert.ok(Math.hypot(d.x-start.x,d.y-start.y)>20);assert.ok(r.events.some(e=>e.t==='shot'&&e.id===d.id));const state=G.snapshot(r,opponent.id),copy=state.players.find(x=>x.id===d.id);assert.equal(copy.name,p.name);assert.equal(copy.classId,p.classId);assert.deepEqual(copy.cosmetics,p.cosmetics);assert.equal(copy.allyDecoy,undefined);assert.equal(state.roster.length,2);assert.equal(G.snapshot(r,p.id).players.find(x=>x.id===d.id).allyDecoy,true);
 advance(r,1.6);assert.equal(r.decoys.length,0);
});
test('compatible buffs combine dual explosive rounds, power, rapid fire and longer projectile range',()=>{
 const r=empty(),p=add(r);p.buffs={double:10,launcher:10,power:10,rapid:10,range:10};G.fire(r,p);assert.equal(r.bullets.length,2);for(const b of r.bullets){assert.equal(b.bomb,true);assert.ok(b.damage>39);assert.ok(b.life>1.5);}assert.ok(p.shotCd<.5);
});
test('class changes are queued only during a TDM death and applied at respawn with score/team preserved',()=>{
 const r=empty('tdm'),p=add(r,'a');p.score=4;assert.equal(G.queueClass(r,p,'mage'),false);G.damage(r,p,1000);assert.equal(p.dead,true);assert.equal(G.queueClass(r,p,'mage'),true);assert.equal(p.classId,'assault');const team=p.team;advance(r,5.1);assert.equal(p.classId,'mage');assert.equal(p.maxHp,90);assert.equal(p.hp,90);assert.equal(p.score,4);assert.equal(p.team,team);
 const ffa=empty();const solo=add(ffa);G.damage(ffa,solo,1000);assert.equal(G.queueClass(ffa,solo,'scout'),false);
});
test('zone awards survival time only to an uncontested player, preserves score and moves after 15s',()=>{
 const r=empty('zone'),p=add(r,'a'),opponent=add(r,'b');Object.assign(p,{x:800,y:500});Object.assign(opponent,{x:100,y:100});advance(r,2.1);assert.equal(p.score,2);Object.assign(opponent,{x:810,y:500});advance(r,2);assert.equal(p.score,2);assert.equal(r.zone.contested,true);Object.assign(opponent,{x:100,y:100});advance(r,1.1);assert.equal(p.score,3);const old={x:r.zone.x,y:r.zone.y};advance(r,10);assert.ok(Math.hypot(r.zone.x-old.x,r.zone.y-old.y)>290);assert.equal(r.zone.nextAt,30);assert.ok(p.score>=3);
});
test('each mode has its own default target and individual match ends exactly at 30 kills',()=>{
 assert.equal(G.MODES.normal.target,30);assert.equal(G.MODES.tdm.target,50);assert.equal(G.MODES.flag.target,100);assert.equal(G.MODES.zone.target,100);
 const r=empty(),a=add(r,'a'),b=add(r,'b');a.score=29;G.damage(r,b,1000,a.id);assert.equal(a.score,30);assert.equal(r.match.status,'finished');assert.equal(r.match.winner.id,a.id);const hp=a.hp;G.damage(r,a,500,b.id);assert.equal(a.hp,hp);assert.equal(G.fire(r,a),false);assert.equal(G.skill(r,a,0),false);const time=r.time;advance(r,1);assert.equal(r.time,time);
});
test('TDM ends at 50 team kills, not 50 individual kills, and all recipients get the same winner',()=>{
 const r=empty('tdm'),a=add(r,'a'),b=add(r,'b');r.teamScores[0]=49;G.damage(r,b,1000,a.id);assert.equal(a.score,1);assert.equal(r.match.status,'finished');assert.equal(r.match.winner.team,0);assert.deepEqual(G.snapshot(r,a.id).match.winner,G.snapshot(r,b.id).match.winner);
});
test('flag and zone end at 100 accumulated seconds and preserve final results',()=>{
 for(const mode of ['flag','zone']){const r=empty(mode),p=add(r);p.x=800;p.y=500;p.score=99;advance(r,1.1);assert.equal(p.score,100);assert.equal(r.match.status,'finished');assert.equal(r.match.results[0].score,100);assert.equal(r.match.winner.id,p.id);}
});
test('rematch requires each connected player, respects minimum results display, resets game state and preserves identity',()=>{
 const r=empty(),a=add(r,'a'),b=add(r,'b');a.score=29;G.damage(r,b,1000,a.id);a.buffs.launcher=10;a.shield=30;assert.equal(G.voteRematch(r,a),true);assert.equal(G.voteRematch(r,a),true);advance(r,3.2);assert.equal(r.match.status,'finished');assert.equal(G.snapshot(r,a.id).match.readyCount,1);G.voteRematch(r,b);advance(r,.025);assert.equal(r.match.status,'playing');assert.equal(r.match.round,2);assert.equal(a.score,0);assert.equal(b.dead,false);assert.equal(a.hp,a.maxHp);assert.deepEqual(a.buffs,{});assert.equal(a.shield,0);assert.equal(a.id,'a');assert.equal(G.voteRematch(r,a),false);
});
test('shield breaking emits exactly once and winning projectile does not crash remaining bullet processing',()=>{
 const r=empty(),a=add(r,'a'),b=add(r,'b');b.shield=10;G.damage(r,b,20,a.id);G.damage(r,b,5,a.id);assert.equal(r.events.filter(e=>e.t==='shieldBreak').length,1);
 Object.assign(a,{x:100,y:100,a:0,score:29});Object.assign(b,{x:160,y:100,hp:1});a.buffs.double=10;G.fire(r,a);assert.doesNotThrow(()=>advance(r,.2));assert.equal(r.match.status,'finished');assert.equal(r.match.winner.id,a.id);
});
test('team zone scores once per second for a team, contests opponents, ignores kills, ends and rematches',()=>{
 const r=empty('zoneTeam'),a=add(r,'a'),b=add(r,'b'),c=add(r,'c');
 Object.assign(a,{x:790,y:500});Object.assign(c,{x:820,y:500});Object.assign(b,{x:100,y:100});
 G.damage(r,c,10,a.id);assert.equal(c.hp,c.maxHp);advance(r,2.1);assert.deepEqual(r.teamScores,[2,0]);assert.equal(a.score,2);assert.equal(c.score,2);
 Object.assign(b,{x:800,y:520});advance(r,1.1);assert.equal(r.zone.contested,true);assert.equal(r.teamScores[0],2);
 G.damage(r,b,1000,a.id);assert.equal(r.teamScores[0],2);assert.equal(a.score,2);r.teamScores[0]=99;advance(r,1.1);assert.equal(r.match.status,'finished');assert.equal(r.match.winner.team,0);assert.equal(G.snapshot(r,a.id).zone.holder,'team0');
 for(const p of r.players.values())G.voteRematch(r,p);advance(r,3.1);assert.equal(r.match.status,'playing');assert.deepEqual(r.teamScores,[0,0]);assert.equal(c.team,0);
});
test('mage frost travels long range, roots for half a second, blocks mobility and expires',()=>{
 const r=empty(),a=add(r,'a','mage'),b=add(r,'b');Object.assign(a,{x:100,y:100,a:0});Object.assign(b,{x:700,y:100});
 G.skill(r,a,1);assert.equal(a.shield,0);assert.equal(r.bullets[0].kind,'frost');assert.ok(r.bullets[0].life*r.bullets[0].vx>900);advance(r,.65);assert.ok(b.root>0);assert.equal(b.hp,78);b.input={x:0,y:1,a:0,fire:false};const y=b.y;assert.equal(G.skill(r,b,0),false);advance(r,.3);assert.equal(b.y,y);advance(r,.3);assert.equal(b.root,0);assert.ok(b.y>y);
 const safe=empty(),m=add(safe,'m','mage'),v=add(safe,'v');Object.assign(m,{x:100,y:100,a:0});Object.assign(v,{x:200,y:100,invuln:1});G.skill(safe,m,1);advance(safe,.15);assert.equal(v.root,0);assert.equal(v.hp,100);
});
test('arcane sphere pierces three enemies once each and stops at walls',()=>{
 const r=empty(),a=add(r,'a','mage');Object.assign(a,{x:100,y:100,a:0});const victims=['b','c','d'].map((id,i)=>{const p=add(r,id);Object.assign(p,{x:200+i*100,y:100});return p;});G.skill(r,a,2);advance(r,.6);for(const p of victims)assert.equal(p.hp,66);
 a.cds[2]=0;r.map.walls=[{x:150,y:50,w:30,h:100}];G.skill(r,a,2);advance(r,.6);for(const p of victims)assert.equal(p.hp,66);
});
test('guardian alone grants class shields; assault has timed rapid fire and directional knockback',()=>{
 for(const id of ['mage','assault','guardian']){const r=empty(),p=add(r,'a',id);G.skill(r,p,1);assert.equal(p.shield,id==='guardian'?95:0);}
 const r=empty(),a=add(r,'a'),front=add(r,'b'),back=add(r,'c');Object.assign(a,{x:500,y:500,a:0});Object.assign(front,{x:600,y:500});Object.assign(back,{x:400,y:500});G.fire(r,a);const cd=a.shotCd;a.shotCd=0;G.skill(r,a,1);G.fire(r,a);assert.ok(a.shotCd<cd);r.bullets=[];G.skill(r,a,2);assert.equal(front.hp,62);assert.ok(front.x>680);assert.equal(back.hp,100);advance(r,3.1);assert.equal(a.overdrive,0);
});
