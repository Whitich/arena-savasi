const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../oyun.html'),'utf8');
function controls(){
 const events={},share={};let muted=false;
 const context={innerWidth:1280,innerHeight:800,running:false,window:{addEventListener:(name,fn)=>events[name]=fn},$:()=>share,castDash(){},castShield(){},castShock(){},addFeed(){},navigator:{clipboard:{writeText:async()=>{}}},room:'TEST',muted};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('const keys = {};'),source.indexOf('let running=false')),context);
 return {context,events,read:()=>vm.runInContext('({keys:{...keys},firing})',context)};
}
const key=(code,tag=false)=>({code,repeat:false,target:{closest:()=>tag},preventDefault(){}});
test('lobby typing and focused buttons do not set movement keys',()=>{
 const {context,events,read}=controls();events.keydown(key('KeyW'));assert.equal(read().keys.KeyW,undefined);
 context.running=true;events.keydown(key('KeyW',true));assert.equal(read().keys.KeyW,undefined);
 events.keydown(key('KeyW'));assert.equal(read().keys.KeyW,true);
});
test('switching away clears both movement and firing',()=>{
 const {context,events,read}=controls();context.running=true;events.keydown(key('KeyW'));events.mousedown({button:0});
 assert.equal(read().firing,true);events.blur();assert.equal(read().keys.KeyW,false);assert.equal(read().firing,false);
});
test('scoreboard renders both players and reacts to central score updates',()=>{
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{style:{},textContent:'',innerHTML:'',classList:{toggle(){}},querySelector(){return node(id+'-table')}});return nodes.get(id);};
 const me={id:'a',name:'Alice',hp:100,score:0,cds:{q:0,e:0,r:0},buff:{},dead:false};
 const bob={id:'b',name:'Bob',score:0,color:'#ff0000'};
 const context={$:node,me,others:new Map([['b',bob]]),colorOf:()=> '#123456',clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),DASH_CD:4,SHIELD_CD:10,SW_CD:16,BUFF_COL:{}};
 vm.createContext(context);
 const code=source.slice(source.indexOf('function updateHUD(){'),source.indexOf('function start(){'));
 vm.runInContext(code,context);context.updateHUD();const table=node('score-table');assert.match(table.innerHTML,/Alice/);assert.match(table.innerHTML,/Bob/);
 const before=table.innerHTML;me.score=1;context.updateHUD();assert.notEqual(table.innerHTML,before);assert.match(table.innerHTML,/<td class="p">1<\/td>/);
});
