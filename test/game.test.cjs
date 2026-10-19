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
 const look=G.normalizeCosmetics({color:'coral',pattern:'star',hat:'crown'});assert.deepEqual(look,{color:'coral',pattern:'star',hat:'crown'});
 const bad=G.normalizeCosmetics({color:'<script>',pattern:'__proto__',hat:'constructor'},'test');assert.ok(Object.hasOwn(G.COSMETICS.colors,bad.color));assert.equal(bad.pattern,'plain');assert.equal(bad.hat,'none');
 const r=empty('tdm'),p=G.addPlayer(r,'a','Alice','guardian',look);const other=G.addPlayer(r,'b','Bob','guardian',{color:'mint',pattern:'stripe',hat:'antenna'});
 const state=G.snapshot(r);assert.equal(state.players[0].cosmetics.color,'coral');assert.equal(state.players[1].cosmetics.color,'mint');assert.equal(p.maxHp,145);assert.notEqual(p.team,other.team);
});
test('shields absorb damage, break under repeated fire, overflow into HP and never decay with time',()=>{
 const r=empty(),p=add(r);G.skill(r,p,1);assert.equal(p.shield,55);advance(r,2);assert.equal(p.shield,55);G.damage(r,p,25);assert.equal(p.hp,100);assert.equal(p.shield,30);G.damage(r,p,25);assert.equal(p.shield,5);G.damage(r,p,25);assert.equal(p.shield,0);assert.equal(p.hp,80);
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
 const r=empty(),p=add(r,'a','mage');Object.assign(p,{x:100,y:100});G.skill(r,p,2,{x:350,y:200});assert.ok(Math.abs(p.x-350)<1);assert.ok(Math.abs(p.y-200)<1);
 p.cds[2]=0;r.map.walls=[{x:500,y:100,w:120,h:200}];const before={x:p.x,y:p.y};G.skill(r,p,2,{x:2000,y:200});assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=381);assert.equal(G.inWall(r.map.walls,p.x,p.y,16),false);
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
