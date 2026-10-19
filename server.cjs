const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {WebSocketServer,WebSocket} = require('ws');

function createArenaServer(){
  const rooms=new Map();
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,rooms:rooms.size,version:process.env.RENDER_GIT_COMMIT||'local'}));return;}
    const files={'/':'oyun.html','/oyun.html':'oyun.html','/index.html':'index.html','/server-config.js':'server-config.js'};
    const file=files[pathname];
    if(!file){res.writeHead(404);res.end();return;}
    // Same-origin endpoint: deploying the server needs no client configuration.
    if(file==='server-config.js'){
      res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
      res.end("window.ARENA_SERVER_URL=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws';");return;
    }
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    fs.createReadStream(path.join(__dirname,file)).pipe(res);
  });
  const wss=new WebSocketServer({server,path:'/ws',maxPayload:4096,perMessageDeflate:false});
  const send=(ws,o,state=false)=>{
    if(ws.readyState!==WebSocket.OPEN)return;
    if(ws.bufferedAmount>262144){ws.terminate();return;}
    if(state && ws.bufferedAmount>8192)return;
    ws.send(JSON.stringify(o));
  };
  const broadcast=(room,o,except=null,state=false)=>{
    for(const p of room.players.values())if(p.ws!==except)send(p.ws,o,state);
  };
  const scores=room=>Object.fromEntries(room.scores);
  const publishScores=room=>broadcast(room,{t:'scores',scores:scores(room)});
  const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
  const eventTypes=new Set(['s','sw','bx','bl','bf','fx']);
  function leave(ws){
    const r=ws.room,p=ws.player;
    if(!r||!p||r.players.get(p.id)?.ws!==ws)return;
    r.players.delete(p.id);
    broadcast(r,{t:'bye',id:p.id,n:++r.seq});
    if(!r.players.size){clearTimeout(r.expiry);r.expiry=setTimeout(()=>{if(!r.players.size)rooms.delete(r.code);},300000);r.expiry.unref();}
    ws.room=null;ws.player=null;
  }
  wss.on('connection',ws=>{
    ws.alive=true;ws.on('pong',()=>ws.alive=true);
    ws.joinTimer=setTimeout(()=>{if(!ws.player)ws.close(1008,'Join required');},8000);ws.joinTimer.unref();
    ws.windowAt=Date.now();ws.count=0;
    ws.on('message',bytes=>{
      const now=Date.now();
      if(now-ws.windowAt>=1000){ws.windowAt=now;ws.count=0;}
      if(++ws.count>100){ws.close(1008,'Too many packets');return;}
      let o;try{o=JSON.parse(bytes.toString());}catch{return;}
      if(!o||typeof o!=='object')return;
      if(o.t==='join'){
        if(ws.player)return;
        if(!/^[A-Z0-9]{1,8}$/.test(o.room)||!/^[a-zA-Z0-9-]{1,48}$/.test(o.id))return ws.close(1008,'Invalid room or id');
        let r=rooms.get(o.room);
        if(!r){if(rooms.size>=500)return ws.close(1013,'Server full');r={code:o.room,players:new Map(),scores:new Map(),barrels:{},buffs:new Set(),seq:0};rooms.set(o.room,r);}
        if(r.players.size>=16)return ws.close(1013,'Room full');
        clearTimeout(r.expiry);clearTimeout(ws.joinTimer);
        // A simultaneous duplicate id must not evict an existing player.
        if(r.players.has(o.id))return ws.close(1008,'Player already connected');
        const p={id:o.id,name:String(o.name||'Oyuncu').slice(0,14),x:800,y:500,a:0,hp:100,dead:false,deadUntil:0,ws,lastShot:0,lastShock:0};
        if(!r.scores.has(p.id))r.scores.set(p.id,0);
        ws.room=r;ws.player=p;r.players.set(p.id,p);
        send(ws,{t:'welcome',id:p.id,players:[...r.players.values()].map(({ws,...v})=>v),scores:scores(r),barrels:r.barrels,buffs:[...r.buffs]});
        broadcast(r,{t:'yo',id:p.id,name:p.name,x:p.x,y:p.y,hp:p.hp,sc:r.scores.get(p.id),n:++r.seq},ws);
        publishScores(r);return;
      }
      const r=ws.room,p=ws.player;if(!r||!p)return;
      if(o.t==='ping'){if(finite(o.ts,0,1e15))send(ws,{t:'pong',ts:o.ts});return;}
      if(o.t==='bye'){ws.close();return;}
      if(o.t==='p'){
        if(!finite(o.x,0,1600)||!finite(o.y,0,1000)||!finite(o.a,-100,100)||!finite(o.hp,0,100))return;
        if(p.dead && now<p.deadUntil)return;
        // Only accept alive after the respawn cooldown has elapsed.
        p.dead=!!o.dead;p.x=o.x;p.y=o.y;p.a=o.a;p.hp=p.dead?0:o.hp;
        broadcast(r,{t:'p',id:p.id,name:p.name,x:p.x,y:p.y,a:p.a,hp:p.hp,dead:p.dead?1:0,sc:r.scores.get(p.id),sh:o.sh?1:0,dsh:o.dsh?1:0,n:++r.seq},ws,true);return;
      }
      if(o.t==='d'){
        if(p.dead)return;
        p.dead=true;p.hp=0;p.deadUntil=now+2800;
        const killer=r.players.get(o.k);
        if(killer && killer.id!==p.id)r.scores.set(killer.id,r.scores.get(killer.id)+1);
        broadcast(r,{t:'d',id:p.id,k:killer?.id||null,n:++r.seq},ws);
        publishScores(r);return;
      }
      if(!eventTypes.has(o.t)||p.dead)return;
      // Allowlisted fields only: clients cannot impersonate another player or set scores.
      let event={t:o.t,id:p.id};
      if(o.t==='s'){
        if(now-p.lastShot<170||!finite(o.x,0,1600)||!finite(o.y,0,1000)||!finite(o.a,-100,100)||typeof o.b!=='string'||o.b.length>80)return;
        p.lastShot=now;Object.assign(event,{x:o.x,y:o.y,a:o.a,b:o.b,c:/^#[0-9a-f]{6}$/i.test(o.c)?o.c:'#4f8cff',sp:o.sp?1:0,d:o.d===45?45:25});
      }else if(o.t==='sw'){
        if(!finite(o.x,0,1600)||!finite(o.y,0,1000))return;
        if(o.r===200&&o.d===35){if(!p.lastBarrel||now-p.lastBarrel>500)return;p.lastBarrel=0;Object.assign(event,{r:200,d:35});}
        else{if(now-p.lastShock<15500)return;p.lastShock=now;Object.assign(event,{r:240,d:40});}
        Object.assign(event,{x:o.x,y:o.y});
      }else if(o.t==='bl'){
        if(!Number.isInteger(o.bi)||o.bi<0||o.bi>7||!finite(o.hp,0,30))return;
        r.barrels[o.bi]=Math.min(r.barrels[o.bi]??30,o.hp);Object.assign(event,{bi:o.bi,hp:r.barrels[o.bi]});
        if(event.hp===0)p.lastBarrel=now;
      }else if(o.t==='bf'){
        const bucket=Math.floor(now/12000);
        if(!Number.isInteger(o.w)||Math.abs(o.w-bucket)>1||r.buffs.has(o.w)||!finite(o.x,0,1600)||!finite(o.y,0,1000)||!['speed','double','power','heal','shield'].includes(o.k))return;
        r.buffs.add(o.w);for(const w of r.buffs)if(w<bucket-2)r.buffs.delete(w);
        Object.assign(event,{w:o.w,k:o.k,x:o.x,y:o.y});
      }else if(o.t==='fx'){
        if(o.k!=='dash'||!finite(o.x,0,1600)||!finite(o.y,0,1000))return;
        Object.assign(event,{k:'dash',x:o.x,y:o.y});
      }else if(o.t==='bx'){
        if(typeof o.bid!=='string'||o.bid.length>80||!finite(o.x,0,1600)||!finite(o.y,0,1000))return;
        Object.assign(event,{bid:o.bid,k:o.k,x:o.x,y:o.y,s:o.s?1:0});
      }
      event.n=++r.seq;broadcast(r,event,ws);
    });
    ws.on('error',()=>{});ws.on('close',()=>{clearTimeout(ws.joinTimer);leave(ws);});
  });
  const heartbeat=setInterval(()=>{
    for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
  },10000);heartbeat.unref();
  server.on('close',()=>{clearInterval(heartbeat);for(const r of rooms.values())clearTimeout(r.expiry);});
  return {server,wss,rooms};
}
if(require.main===module){
  const {server}=createArenaServer();
  server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('Arena ready on port '+server.address().port));
}
module.exports={createArenaServer};
