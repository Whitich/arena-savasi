const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const G=require('../game-core.js'),source=fs.readFileSync(path.join(__dirname,'../client.js'),'utf8');
function controls(){
 const events={},messages=[],hint={textContent:''};
 const context={window:{addEventListener:(n,fn)=>events[n]=fn},bindingAction:null,bindings:{...G.DEFAULT_BINDINGS},BIND_LABELS:{skill1:'skill1',up:'up'},playing:true,keys:new Set(),firing:true,aim:0,muted:false,store:{set(){}},cursorTarget:()=>({x:700,y:500}),renderBindings(){},renderLobby(){},initAudio(){},addFeed(){},send:o=>messages.push(o),$:id=>id==='settings'?{open:false}:hint};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf("window.addEventListener('keydown'"),source.indexOf("window.addEventListener('keyup'")),context);
 return{context,events,messages,hint};
}
const event=(code,extra={})=>({code,repeat:false,target:{closest:()=>false},preventDefault(){},stopPropagation(){},...extra});
test('custom skill key sends the mapped skill and held repeats do not recast',()=>{const{context,events,messages}=controls();context.bindings.skill1='KeyZ';events.keydown(event('KeyQ'));assert.equal(messages.length,0);events.keydown(event('KeyZ'));assert.equal(messages[0].index,0);events.keydown(event('KeyZ',{repeat:true}));assert.equal(messages.length,1);});
test('key reassignment rejects conflicts and saves unique choice',()=>{const{context,events,hint}=controls();context.bindingAction='skill1';events.keydown(event('KeyW'));assert.equal(context.bindings.skill1,'KeyQ');assert.match(hint.textContent,/kullanılıyor/);events.keydown(event('KeyZ'));assert.equal(context.bindings.skill1,'KeyZ');assert.equal(context.bindingAction,null);});
test('focus in inputs or buttons never moves or casts',()=>{const{context,events,messages}=controls();events.keydown(event('KeyQ',{target:{closest:()=>true}}));assert.equal(messages.length,0);assert.equal(context.keys.size,0);});
test('reset inputs clears firing and immediately tells server to stop',()=>{const{context,messages}=controls();context.keys.add('KeyW');const fn=source.slice(source.indexOf('function resetInputs(){'),source.indexOf("window.addEventListener('keydown'"));vm.runInContext(fn,context);context.resetInputs();assert.equal(context.keys.size,0);assert.equal(context.firing,false);assert.equal(messages.at(-1).fire,false);assert.equal(messages.at(-1).x,0);});
