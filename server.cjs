'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const Game=require('./game-core.js');
const VERSION='3.2.0';
function createArenaServer(options={}){
 const rooms=new Map(),sessions=new Map();
 const server=http.createServer((req,res)=>{
  let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,rooms:rooms.size,release:VERSION,version:process.env.RENDER_GIT_COMMIT||'local'}));return;}
  const files={'/':'oyun.html','/oyun.html':'oyun.html','/index.html':'index.html','/client.js':'client.js','/game-core.js':'game-core.js','/server-config.js':'server-config.js'};
  const file=files[pathname];if(!file){res.writeHead(404);res.end();return;}
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  if(file==='server-config.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end("window.ARENA_SERVER_URL=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';");return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});const stream=fs.createReadStream(path.join(__dirname,file));stream.on('error',()=>res.destroy());stream.pipe(res);
 });
 const wss=new WebSocketServer({server,path:'/ws',maxPayload:2048,perMessageDeflate:false});
 function send(ws,obj,state=false){if(!ws||ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>262144){ws.terminate();return;}if(state&&ws.bufferedAmount>8192)return;ws.send(JSON.stringify(obj));}
 function broadcast(r,obj,state=false){for(const p of r.players.values())if(p.connected)send(p.ws,obj,state);}
 function error(ws,message,code='INVALID'){send(ws,{t:'error',message,code});}
 function generatedCode(){return crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}
 function newRoom(code,mode){const r=Game.createRoom(code,mode,code+'-'+crypto.randomBytes(4).toString('hex'));rooms.set(code,r);return r;}
 function welcome(ws,r,p,token){send(ws,{t:'welcome',release:VERSION,id:p.id,token,code:r.code,mode:r.mode,map:{walls:r.map.walls,barrels:r.map.barrels.map(({id,x,y})=>({id,x,y})),hazards:r.map.hazards},state:Game.snapshot(r,p.id)});}
 function disconnect(ws){const r=ws.room,p=ws.player;if(!r||!p||p.ws!==ws)return;p.connected=false;p.disconnectedAt=Date.now();p.input={x:0,y:0,a:p.a,fire:false};p.ws=null;Game.dropFlag(r,p,null);broadcast(r,{t:'leave',id:p.id,name:p.name});ws.room=null;ws.player=null;}
 wss.on('connection',ws=>{
  if(wss.clients.size>256){ws.close(1013,'Server full');return;}
  ws.alive=true;ws.on('pong',()=>ws.alive=true);ws.windowAt=Date.now();ws.count=0;
  ws.joinTimer=setTimeout(()=>{if(!ws.player)ws.close(1008,'Join required');},10000);ws.joinTimer.unref();
  ws.on('message',bytes=>{
   try{
    const now=Date.now();if(now-ws.windowAt>=1000){ws.windowAt=now;ws.count=0;}if(++ws.count>90){ws.close(1008,'Packet limit');return;}
    let o;try{o=JSON.parse(bytes.toString());}catch{return;}if(!o||typeof o!=='object'||Array.isArray(o))return;
    if(o.t==='create'||o.t==='join'){
     if(ws.player)return;
     let code=String(o.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8),r;
     if(o.t==='create'){
      if(!Game.MODES[o.mode])return error(ws,'Geçerli bir oyun modu seç.');
      if(!code){do{code=generatedCode();}while(rooms.has(code));}
      if(rooms.has(code))return error(ws,'Bu oda kodu kullanımda. Başka kod seç veya odaya katıl.','EXISTS');
      if(rooms.size>=100)return error(ws,'Sunucu dolu. Biraz sonra tekrar dene.');
      r=newRoom(code,o.mode);
     }else{
      r=rooms.get(code);
      if(!r&&o.resume&&Game.MODES[o.mode]&&rooms.size<100)r=newRoom(code,o.mode);
      if(!r)return error(ws,'Oda bulunamadı. Kodu kontrol et veya yeni oda oluştur.','NOT_FOUND');
     }
     let p,token;
     const session=typeof o.token==='string'?sessions.get(o.token):null;
     if(session&&session.code===code){p=r.players.get(session.id);if(p?.connected)return error(ws,'Bu oyuncu başka sekmede zaten bağlı.');if(p){token=o.token;p.connected=true;p.ws=ws;p.input={x:0,y:0,a:p.a,fire:false};p.disconnectedAt=0;}}
     if(!p){
      const active=[...r.players.values()].filter(p=>p.connected).length;if(active>=16)return error(ws,'Oda dolu (16 oyuncu).');
      if(!Game.CLASSES[o.classId])return error(ws,'Bir sınıf seç.');
      p=Game.addPlayer(r,crypto.randomUUID(),o.name,o.classId,o.cosmetics);p.ws=ws;p.invuln=1;p.lastInputAt=now;
      token=crypto.randomBytes(24).toString('hex');sessions.set(token,{id:p.id,code});p.token=token;
     }
     if(o.cosmetics)p.cosmetics=Game.normalizeCosmetics(o.cosmetics,p.id);
     ws.room=r;ws.player=p;r.emptyAt=0;clearTimeout(ws.joinTimer);welcome(ws,r,p,token);broadcast(r,{t:'joined',id:p.id,name:p.name});return;
    }
    const r=ws.room,p=ws.player;if(!r||!p)return;
    if(o.t==='ping'){if(typeof o.ts==='number'&&Number.isFinite(o.ts))send(ws,{t:'pong',ts:o.ts});return;}
    if(o.t==='input'){
     if(!Number.isFinite(o.x)||!Number.isFinite(o.y)||!Number.isFinite(o.a))return;
     p.lastInputAt=now;p.input={x:Game.clamp(o.x,-1,1),y:Game.clamp(o.y,-1,1),a:Math.atan2(Math.sin(o.a),Math.cos(o.a)),fire:o.fire===true};return;
    }
    if(o.t==='skill'){if(Number.isFinite(o.a)){p.a=Math.atan2(Math.sin(o.a),Math.cos(o.a));p.input.a=p.a;}Game.skill(r,p,o.index,{x:o.x,y:o.y});return;}
    if(o.t==='rematch'){Game.voteRematch(r,p);return;}
    if(o.t==='classChange'){Game.queueClass(r,p,o.classId);return;}
    if(o.t==='leave'){disconnect(ws);ws.close(1000,'Left room');}
    // No client damage, position, buff, kill or score reports are accepted.
   }catch(err){console.error('Packet processing failed:',err.message);ws.close(1011,'Protocol error');}
  });
  ws.on('close',()=>{clearTimeout(ws.joinTimer);disconnect(ws);});ws.on('error',()=>{});
 });
 let last=Date.now(),acc=0,publish=0;
 const tick=setInterval(()=>{
  const now=Date.now();acc+=Math.min(.2,(now-last)/1000);last=now;
  while(acc>=.025){acc-=.025;publish+=.025;
   for(const r of rooms.values()){
    const active=[...r.players.values()].some(p=>p.connected);
    for(const p of r.players.values())if(!p.connected&&now-p.disconnectedAt>30000){sessions.delete(p.token);r.players.delete(p.id);r.mines=r.mines.filter(m=>m.owner!==p.id);r.bullets=r.bullets.filter(b=>b.owner!==p.id);}
    if(!active){if(!r.emptyAt)r.emptyAt=now;if(now-r.emptyAt>300000){for(const p of r.players.values())sessions.delete(p.token);rooms.delete(r.code);}continue;}
    for(const p of r.players.values())if(now-(p.lastInputAt||0)>450)p.input={x:0,y:0,a:p.a,fire:false};
    Game.step(r,.025);
    if(r.events.length){broadcast(r,{t:'events',events:r.events.splice(0,200)});r.events.length=0;}
   }
   if(publish>=.05){publish=0;for(const r of rooms.values())if([...r.players.values()].some(p=>p.connected))for(const p of r.players.values())if(p.connected)send(p.ws,Game.snapshot(r,p.id),true);}
  }
 },25);tick.unref();
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},10000);heartbeat.unref();
 server.on('close',()=>{clearInterval(tick);clearInterval(heartbeat);});
 return{server,wss,rooms,sessions};
}
if(require.main===module){const{server,wss}=createArenaServer();server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Arena '+VERSION+' ready on '+server.address().port));process.on('SIGTERM',()=>{for(const ws of wss.clients)ws.close(1012,'Restarting');server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),4000).unref();});}
module.exports={createArenaServer};
