const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../game-core.js');
const empty=(mode='normal')=>{const r=G.createRoom('TEST',mode);r.map={walls:[],barrels:[],hazards:[]};r.nextBuff=1000;return r;};
const add=(r,id='one',classId='assault')=>G.addPlayer(r,id,id,classId);
function advance(r,time){for(let i=0;i<Math.round(time/.025);i++)G.step(r,.025);}
test('four classes have distinct stats and all twelve skills execute with cooldown',()=>{
 assert.equal(Object.keys(G.CLASSES).length,4);
 for(const id of Object.keys(G.CLASSES))for(let i=0;i<3;i++){
  const r=empty(),p=add(r,'one',id);p.x=300;p.y=300;
  assert.equal(G.skill(r,p,i),true,id+' skill '+i);assert.ok(p.cds[i]>0);assert.equal(G.skill(r,p,i),false);
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
 for(const mode of ['tdm','flag'])assert.equal(G.createRoom('TEST',mode).map.hazards.length,0);
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
