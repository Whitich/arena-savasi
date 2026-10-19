const {test}=require('node:test'),assert=require('node:assert/strict'),{once}=require('node:events');
const {WebSocket}=require('ws'),{createArenaServer}=require('../server.cjs');
async function fixture(t){
 const app=createArenaServer();app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
 t.after(async()=>{for(const ws of app.wss.clients)ws.terminate();await new Promise(r=>app.server.close(r));});
 async function connect(){const ws=new WebSocket('ws://127.0.0.1:'+app.server.address().port+'/ws');ws.messages=[];ws.on('message',bytes=>ws.messages.push(JSON.parse(bytes)));ws.json=o=>ws.send(JSON.stringify(o));await once(ws,'open');return ws;}
 return{...app,connect};
}
async function packet(ws,predicate,timeout=3000){const until=Date.now()+timeout;while(Date.now()<until){const i=ws.messages.findIndex(predicate);if(i>=0)return ws.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,8));}throw Error('Packet timeout '+predicate);}
const join=(t,code,extra={})=>({t,code,name:'Tester',classId:'assault',mode:'tdm',...extra});
test('create/join respect room mode, balance teams and reject missing rooms',async t=>{
 const app=await fixture(t),a=await app.connect(),b=await app.connect(),missing=await app.connect();
 a.json(join('create','TEAM',{cosmetics:{color:'coral',pattern:'star',hat:'crown',aura:'rune',trail:'ribbon',visor:'eyes'}}));const aw=await packet(a,o=>o.t==='welcome');b.json(join('join','TEAM',{mode:'flag'}));const bw=await packet(b,o=>o.t==='welcome');
 assert.equal(bw.mode,'tdm');assert.deepEqual(bw.state.players.find(p=>p.id===aw.id).cosmetics,{color:'coral',pattern:'star',hat:'crown',aura:'rune',trail:'ribbon',visor:'eyes'});assert.equal(bw.state.players.find(p=>p.id===aw.id).team,0);assert.equal(bw.state.players.find(p=>p.id===bw.id).team,1);
 missing.json(join('join','MISSING'));assert.equal((await packet(missing,o=>o.t==='error')).code,'NOT_FOUND');
});
test('real input causes server shots, kills and synchronized team scores; forged reports are ignored',async t=>{
 const app=await fixture(t),a=await app.connect(),b=await app.connect();a.json(join('create','FIGHT'));const aw=await packet(a,o=>o.t==='welcome');b.json(join('join','FIGHT'));const bw=await packet(b,o=>o.t==='welcome');
 const r=app.rooms.get('FIGHT'),pa=r.players.get(aw.id),pb=r.players.get(bw.id);r.map={walls:[],barrels:[],hazards:[]};Object.assign(pa,{x:100,y:100,shield:0,invuln:0});Object.assign(pb,{x:210,y:100,shield:0,invuln:0});
 b.json({t:'d',k:aw.id});b.json({t:'p',id:aw.id,x:1,y:1,hp:999,sc:999});
 const firing=setInterval(()=>a.json({t:'input',x:0,y:0,a:0,fire:true}),80);t.after(()=>clearInterval(firing));
 const dead=await packet(a,o=>o.t==='state'&&o.players.some(p=>p.id===bw.id&&p.dead),3500);clearInterval(firing);a.json({t:'input',x:0,y:0,a:0,fire:false});
 assert.equal(dead.players.find(p=>p.id===aw.id).score,1);assert.deepEqual(dead.teamScores,[1,0]);
 const other=await packet(b,o=>o.t==='state'&&o.teamScores[0]===1);assert.equal(other.players.find(p=>p.id===aw.id).kills,1);
 const sounds=await packet(b,o=>o.t==='events'&&o.events.some(e=>e.t==='shot'&&e.id===aw.id));assert.ok(sounds.events.some(e=>e.t==='shot'));
});
test('resume token restores own player, copied id cannot impersonate and rooms remain isolated',async t=>{
 const app=await fixture(t),a=await app.connect(),b=await app.connect();a.json(join('create','FIRST',{mode:'flag'}));const aw=await packet(a,o=>o.t==='welcome');b.json(join('create','SECOND'));await packet(b,o=>o.t==='welcome');
 a.close();await once(a,'close');await new Promise(r=>setTimeout(r,30));const back=await app.connect();back.json(join('join','FIRST',{token:aw.token}));const resumed=await packet(back,o=>o.t==='welcome');assert.equal(resumed.id,aw.id);assert.equal(resumed.mode,'flag');
 const impostor=await app.connect();impostor.json(join('join','FIRST',{id:aw.id}));const iw=await packet(impostor,o=>o.t==='welcome');assert.notEqual(iw.id,aw.id);
 back.json({t:'ping',ts:123});assert.equal((await packet(back,o=>o.t==='pong')).ts,123);
 const isolated=await packet(b,o=>o.t==='state');assert.equal(isolated.players.length,1);assert.ok(!JSON.stringify(isolated).includes(aw.token));
});
test('static assets and deployment health are served',async t=>{
 const app=await fixture(t),base='http://127.0.0.1:'+app.server.address().port;
 for(const file of ['/','/client.js','/game-core.js','/server-config.js'])assert.equal((await fetch(base+file)).status,200);
 assert.equal((await fetch(base+'/health').then(r=>r.json())).release,'3.4.0');assert.equal((await fetch(base+'/server.cjs')).status,404);
});
test('invisibility is filtered per real WebSocket recipient, then firing reveals the assassin',async t=>{
 const app=await fixture(t),a=await app.connect(),b=await app.connect();a.json(join('create','HIDDEN',{mode:'normal',classId:'assassin'}));const aw=await packet(a,o=>o.t==='welcome');b.json(join('join','HIDDEN'));await packet(b,o=>o.t==='welcome');
 a.json({t:'skill',index:1,a:0});const hidden=await packet(b,o=>o.t==='state'&&!o.players.some(p=>p.id===aw.id));assert.ok(hidden.roster.some(p=>p.id===aw.id));assert.ok((await packet(a,o=>o.t==='state'&&o.players.some(p=>p.id===aw.id&&p.invis>0))).players.some(p=>p.id===aw.id));
 a.json({t:'input',x:0,y:0,a:0,fire:true});await packet(b,o=>o.t==='state'&&o.players.some(p=>p.id===aw.id));a.json({t:'input',x:0,y:0,a:0,fire:false});
});
test('a queued class change is accepted over the network only while dead in TDM',async t=>{
 const app=await fixture(t),a=await app.connect();a.json(join('create','SWITCH'));const aw=await packet(a,o=>o.t==='welcome'),r=app.rooms.get('SWITCH'),p=r.players.get(aw.id);
 a.json({t:'classChange',classId:'mage'});await new Promise(r=>setTimeout(r,30));assert.equal(p.nextClass,null);p.invuln=0;require('../game-core.js').damage(r,p,1000);a.json({t:'classChange',classId:'mage'});await packet(a,o=>o.t==='state'&&o.players.some(p=>p.nextClass==='mage'));p.respawn=.01;
 const state=await packet(a,o=>o.t==='state'&&o.players.some(p=>p.id===aw.id&&p.classId==='mage'&&!p.dead));assert.equal(state.players.find(p=>p.id===aw.id).maxHp,90);
});
test('match winner and consent-based rematch are synchronized through WebSocket',async t=>{
 const app=await fixture(t),a=await app.connect(),b=await app.connect();a.json(join('create','ROUND',{mode:'normal'}));const aw=await packet(a,o=>o.t==='welcome');b.json(join('join','ROUND'));const bw=await packet(b,o=>o.t==='welcome');const r=app.rooms.get('ROUND'),pa=r.players.get(aw.id),pb=r.players.get(bw.id);pa.score=29;pb.invuln=0;require('../game-core.js').damage(r,pb,1000,pa.id);
 for(const ws of [a,b]){const end=await packet(ws,o=>o.t==='state'&&o.match.status==='finished');assert.equal(end.match.winner.id,aw.id);assert.equal(end.match.target,30);}
 a.json({t:'rematch'});await packet(a,o=>o.t==='state'&&o.match.readyCount===1);require('../game-core.js').step(r,3.1);assert.equal(r.match.status,'finished');b.json({t:'rematch'});
 for(const ws of [a,b]){const next=await packet(ws,o=>o.t==='state'&&o.match.round===2);assert.equal(next.match.status,'playing');assert.ok(next.players.every(p=>p.score===0));}
});
