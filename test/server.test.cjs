const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {WebSocket}=require('ws');
const {createArenaServer}=require('../server.cjs');
function client(url){
  const ws=new WebSocket(url); ws.messages=[];
  ws.on('message',data=>ws.messages.push(JSON.parse(data)));
  ws.sendJSON=o=>ws.send(JSON.stringify(o));return ws;
}
async function waitFor(ws,predicate){
  const until=Date.now()+2000;
  while(Date.now()<until){const i=ws.messages.findIndex(predicate);if(i>=0)return ws.messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}
  throw Error('Packet timeout: '+predicate);
}
test('rooms, movement, central scores, duplicate death, reconnect, spoof protection',async t=>{
  const {server,wss}=createArenaServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  const url='ws://127.0.0.1:'+server.address().port+'/ws';
  const a=client(url),b=client(url),c=client(url);
  t.after(async()=>{for(const ws of wss.clients)ws.terminate();await new Promise(resolve=>server.close(resolve));});
  await Promise.all([a,b,c].map(ws=>once(ws,'open')));
  for(const [ws,id,room]of [[a,'alice','TEST'],[b,'bob','TEST'],[c,'carol','OTHER']]){ws.sendJSON({t:'join',id,room,name:id});await waitFor(ws,o=>o.t==='welcome');}
  a.sendJSON({t:'p',id:'spoof',x:100,y:120,a:0,hp:100,sc:999});
  const p=await waitFor(b,o=>o.t==='p');assert.equal(p.id,'alice');assert.equal(p.sc,0);assert.equal(p.x,100);
  b.messages=[];a.messages=[];c.messages=[];
  b.sendJSON({t:'d',id:'spoof',k:'alice'});
  await waitFor(a,o=>o.t==='d');
  for(const ws of [a,b])assert.equal((await waitFor(ws,o=>o.t==='scores')).scores.alice,1);
  b.sendJSON({t:'d',k:'alice'});
  b.sendJSON({t:'p',x:100,y:100,a:0,hp:100,dead:0,sc:999});
  a.sendJSON({t:'ping',ts:123});assert.equal((await waitFor(a,o=>o.t==='pong')).ts,123);
  await new Promise(r=>setTimeout(r,60));
  assert.equal(c.messages.length,0);assert.equal(a.messages.filter(o=>o.t==='scores').length,0);
  assert.equal(a.messages.filter(o=>o.t==='p'&&o.id==='bob').length,0);
  a.close();await once(a,'close');
  const reconnect=client(url);await once(reconnect,'open');
  reconnect.sendJSON({t:'join',room:'TEST',id:'alice',name:'Alice'});
  const welcome=await waitFor(reconnect,o=>o.t==='welcome');assert.equal(welcome.scores.alice,1);
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/server-config.js');assert.match(await response.text(),/location.host/);
});
