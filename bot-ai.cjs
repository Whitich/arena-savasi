'use strict';
const G=require('./game-core.js'),crypto=require('node:crypto');
const CELL=40,COLS=G.W/CELL,ROWS=G.H/CELL,STEP=.14;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function clearance(room,p){let d=Math.min(p.x,p.y,G.W-p.x,G.H-p.y);for(const w of room.map.walls)d=Math.min(d,Math.hypot(p.x-G.clamp(p.x,w.x,w.x+w.w),p.y-G.clamp(p.y,w.y,w.y+w.h)));for(const br of room.map.barrels)if(br.hp>0)d=Math.min(d,dist(p,br)-15);return d;}
function clear(room,a,b,pad=19){const initial=clearance(room,a),required=Math.min(pad,Math.max(15.99,initial-.01)),n=Math.ceil(dist(a,b)/4);for(let i=0;i<=n;i++){const q={x:a.x+(b.x-a.x)*i/(n||1),y:a.y+(b.y-a.y)*i/(n||1)};if(clearance(room,q)<required-.001)return false;}return true;}

function grid(room){if(room.botGrid&&room.botGrid.until>room.time&&room.botGrid.round===room.match.round)return room.botGrid;const open=new Uint8Array(COLS*ROWS);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const p={x:x*CELL+20,y:y*CELL+20};open[y*COLS+x]=clear(room,p,p)?1:0;}return room.botGrid={open,until:room.time+1,round:room.match.round};}
function path(room,start,goal){const {open}=grid(room),point=i=>({x:(i%COLS)*CELL+20,y:Math.floor(i/COLS)*CELL+20});
 const nearest=p=>{const candidates=[];for(let i=0;i<open.length;i++)if(open[i])candidates.push({i,d:dist(p,point(i))});candidates.sort((a,b)=>a.d-b.d);for(const {i}of candidates)if(clear(room,p,point(i),17))return i;return -1;};const from=nearest(start),to=nearest(goal);if(from<0||to<0)return[];
 const costs=new Float64Array(open.length).fill(Infinity),prev=new Int32Array(open.length).fill(-1),closed=new Uint8Array(open.length),queue=[from];costs[from]=0;let loops=0;
 while(queue.length&&loops++<open.length){let at=0;for(let i=1;i<queue.length;i++)if(costs[queue[i]]+dist(point(queue[i]),point(to))<costs[queue[at]]+dist(point(queue[at]),point(to)))at=i;const cur=queue.splice(at,1)[0];if(cur===to){const result=[];for(let i=to;i!==from&&i>=0;i=prev[i])result.unshift(point(i));result.unshift(point(from));return result;}closed[cur]=1;const x=cur%COLS,y=Math.floor(cur/COLS);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const nx=x+dx,ny=y+dy,idx=ny*COLS+nx;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||!open[idx]||closed[idx])continue;if(dx&&dy&&(!open[y*COLS+nx]||!open[ny*COLS+x]))continue;if(!clear(room,point(cur),point(idx)))continue;const next=costs[cur]+Math.hypot(dx,dy)*CELL;if(next<costs[idx]){costs[idx]=next;prev[idx]=cur;if(!queue.includes(idx))queue.push(idx);}}}return[];}
function addBots(room,count){const names=['Atlas','Nova','Pixel','Kora','Orion','Luna','Echo','Vega'];const classes=Object.keys(G.CLASSES);for(let i=0;i<count&&room.players.size<16;i++){const p=G.addPlayer(room,'bot-'+crypto.randomUUID(),'BOT '+names[i],classes[i%classes.length],{color:Object.keys(G.COSMETICS.colors)[(i+2)%10],hat:i%2?'antenna':'none'});p.bot=true;p.invuln=1;}room.botCount=[...room.players.values()].filter(p=>p.bot).length;}
function wander(room,p){const cells=grid(room).open;for(let i=0;i<30;i++){const idx=Math.floor(room.random()*cells.length);if(cells[idx])return{x:(idx%COLS)*CELL+20,y:Math.floor(idx/COLS)*CELL+20};}return{x:800,y:500};}
function flee(room,p,enemies){let best=null,bestScore=-Infinity;for(let i=0;i<12;i++){const a=i*Math.PI/6,q={x:G.clamp(p.x+Math.cos(a)*260,60,G.W-60),y:G.clamp(p.y+Math.sin(a)*260,60,G.H-60)};if(!clear(room,p,q))continue;const score=enemies.length?Math.min(...enemies.map(e=>dist(q,e))):dist(q,{x:800,y:500});if(score>bestScore){bestScore=score;best=q;}}return best||wander(room,p);}
function danger(room,p,q){let score=0;for(const b of room.bullets){const owner=room.players.get(b.owner);if(b.owner===p.id||owner&&!G.enemy(room,p,owner)||dist(p,b)>360)continue;const v2=b.vx*b.vx+b.vy*b.vy;if(!v2)continue;const t=G.clamp(((q.x-b.x)*b.vx+(q.y-b.y)*b.vy)/v2,0,.45),d=Math.hypot(q.x-b.x-b.vx*t,q.y-b.y-b.vy*t);if(d<55)score+=(55-d)*7;}
 for(const h of room.map.hazards){const d=dist(q,h);if(h.type==='saw'&&d<85)score+=(85-d)*12;if(h.type==='lava'&&((room.time+h.phase)%7>3.6)&&d<100)score+=(100-d)*10;if(h.type==='turret'&&d<70)score+=(70-d)*4;}return score;}
function intercept(shooter,target,speed){const rx=target.x-shooter.x,ry=target.y-shooter.y,vx=target.vx||0,vy=target.vy||0,a=vx*vx+vy*vy-speed*speed,b=2*(rx*vx+ry*vy),c=rx*rx+ry*ry;let t=0;if(Math.abs(a)<.00001){if(Math.abs(b)>.00001)t=Math.max(0,-c/b);}else{const d=b*b-4*a*c;if(d>=0){const roots=[(-b-Math.sqrt(d))/(2*a),(-b+Math.sqrt(d))/(2*a)].filter(t=>t>=0);if(roots.length)t=Math.min(...roots);}}t=Math.min(t,1.2);return{x:target.x+vx*t,y:target.y+vy*t,time:t};}
function think(room,p){const brain=p.brain,c=G.CLASSES[p.classId];
 const opponents=[...room.players.values(),...room.decoys.filter(d=>d.life>0)].filter(e=>e.id!==p.id&&e.owner!==p.id&&e.connected!==false&&!e.dead&&G.enemy(room,p,e)&&(e.invis||0)<=0 ).sort((a,b)=>dist(p,a)-dist(p,b));const seen=opponents.filter(e=>clear(room,p,e,3));let pursuit=opponents.find(e=>e.id===brain.pursuit);if(!pursuit||opponents[0]&&dist(p,opponents[0])<dist(p,pursuit)*.65)pursuit=opponents[0];brain.pursuit=pursuit?.id;const target=pursuit&&seen.includes(pursuit)?pursuit:null;
 if(target)brain.memory={x:target.x,y:target.y,until:room.time+2};
 let goal,objective=false;
 if(room.mode==='flag'){objective=true;if(room.flag.owner===p.id){if(!brain.escape||room.time>brain.escapeAt||dist(p,brain.escape)<45||seen.some(e=>dist(p,e)<250)){brain.escape=flee(room,p,seen);brain.escapeAt=room.time+1;}goal=brain.escape;}else goal={x:room.flag.x,y:room.flag.y};}
 else if(room.zone&&(room.mode==='zone'||room.mode==='zoneTeam')){objective=true;const z=room.zone,a=(G.hash(p.id)%628)/100+room.time*.25;goal={x:z.x+Math.cos(a)*z.r*.32,y:z.y+Math.sin(a)*z.r*.32};}
 else if(target)goal=target;
 else if(pursuit)goal=pursuit;
 else if(brain.memory&&brain.memory.until>room.time)goal=brain.memory;
 else{if(!brain.roam||dist(p,brain.roam)<60||room.time>brain.roamAt){brain.roam=wander(room,p);brain.roamAt=room.time+4;}goal=brain.roam;}
 const nearby=room.buffs.filter(b=>dist(p,b)<(objective?100:170)&&(dist(p,b)<65||dist(p,b)+dist(b,goal)-dist(p,goal)<(objective?75:130))&&clear(room,p,b)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(nearby)goal=nearby;
 // Health packs are worth a short detour; objectives still take priority.
 if(p.hp<p.maxHp*.45){const heal=room.buffs.filter(b=>['heal','smallheal','regen','shield','titan'].includes(b.kind)&&dist(p,b)<(objective?140:300)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(heal)goal=heal;}
 // Replan stalled routes and keep each waypoint reachable from the actual position.
 if(!brain.progress||dist(p,brain.progress)>22){brain.progress={x:p.x,y:p.y};brain.progressAt=room.time;}
 const stuck=room.time-(brain.progressAt||0)>.8;
 if(stuck){brain.pathAt=0;brain.strafe=-(brain.strafe||1);brain.progressAt=room.time;}
 let waypoint=goal;if(!clear(room,p,goal)){
 if(room.time>=brain.pathAt||!brain.goal||dist(brain.goal,goal)>90||brain.path?.length&&!clear(room,p,brain.path[0],17)){brain.path=path(room,p,goal);brain.pathAt=room.time+.65;brain.goal={x:goal.x,y:goal.y};}
 while(brain.path?.length>1&&clear(room,p,brain.path[1]))brain.path.shift();
 while(brain.path?.length&&dist(p,brain.path[0])<10)brain.path.shift();
 waypoint=brain.path?.[0]||p;}

 const dx=waypoint.x-p.x,dy=waypoint.y-p.y,len=Math.hypot(dx,dy);let mx=len>5?dx/len:0,my=len>5?dy/len:0;
 if(target&&!objective&&clear(room,p,goal)){const d=dist(p,target);if(d<210){mx=-(target.x-p.x)/Math.max(1,d);my=-(target.y-p.y)/Math.max(1,d);}else if(d<430){const a=Math.atan2(target.y-p.y,target.x-p.x)+Math.PI/2*(brain.strafe||1);mx=Math.cos(a);my=Math.sin(a);}}
 // Choose a short safe step, including standing still, with projectile lookahead.
 let best={x:0,y:0},score=-Infinity;for(const angle of [null,0,.65,-.65,1.25,-1.25,Math.PI]){const a=Math.atan2(my,mx)+(angle||0),x=angle===null?0:Math.cos(a),y=angle===null?0:Math.sin(a),q={x:p.x+x*60,y:p.y+y*60};if(!clear(room,p,q,17))continue;const value=(x*mx+y*my)*35-danger(room,p,{x:p.x+x*65,y:p.y+y*65});if(value>score){score=value;best={x,y};}}
 mx=best.x;my=best.y;brain.moveOrigin={x:p.x,y:p.y};brain.moveBudget=Math.min(50,len>5?len:50);const d=target?dist(p,target):Infinity;
 let aim=p.a;if(target){const point=intercept(p,target,p.buffs.launcher>0?470:c.bulletSpeed||720);aim=Math.atan2(point.y-p.y,point.x-p.x)+(room.random()-.5)*.18;}else if(mx||my)aim=Math.atan2(my,mx);
 p.a=aim;p.input={x:mx,y:my,a:aim,fire:!!target&&d<(c.bulletSpeed||720)*(c.bulletLife||.85)+20&&clear(room,p,target,4)};
 const threatened=danger(room,p,p)>130;
 if((threatened||room.mode==='flag'&&room.flag.owner===p.id&&target)&&p.cds[0]<=0&&p.classId!=='mage'){const a=p.a;p.a=Math.atan2(my,mx);G.skill(room,p,0);p.a=a;}
 if(p.classId==='mage'&&p.cds[0]<=0&&(threatened||target&&p.hp<p.maxHp*.4)){const q=flee(room,p,seen);G.skill(room,p,0,q);}
 if(target){const id=p.classId;const useE=id==='mage'?d<900:id==='guardian'?p.shield<=0:id==='bomber'?d<260:id==='assassin'?p.hp<p.maxHp*.7:true;if(useE)G.skill(room,p,1);
 const ranges={guardian:160,assault:250,bomber:340,scout:950,ricochet:950,mage:740,assassin:380,jester:580};if(p.invis<=0&&d<ranges[id]&&clear(room,p,target,4)){const speeds={bomber:460,scout:1120,ricochet:1000,mage:640,assassin:1050,jester:720},point=intercept(p,target,speeds[id]||720);p.a=Math.atan2(point.y-p.y,point.x-p.x)+(room.random()-.5)*.14;G.skill(room,p,2);p.a=aim;}}
}
function updateBots(room,dt){if(room.match.status!=='playing')return;for(const p of room.players.values()){if(!p.bot||!p.connected||p.dead)continue;if(!p.brain||p.brain.round!==room.match.round)p.brain={round:room.match.round,next:room.time+room.random()*.15,pathAt:0,strafe:room.random()<.5?-1:1};// Never hold an old steering command past its checked segment or waypoint.
 if(p.brain.moveOrigin&&dist(p,p.brain.moveOrigin)>=p.brain.moveBudget-8)p.brain.next=0;
 if(room.time<p.brain.next)continue;p.brain.next=room.time+STEP+room.random()*.04;think(room,p);}}
module.exports={addBots,updateBots,path,clear,intercept,danger};
