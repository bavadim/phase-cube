/* SPDX-License-Identifier: AGPL-3.0-or-later */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),M=require('./model.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),add=(s,order=2,arc=0,at)=>M.apply(s,0,{kind:'split',order,arc,at}),count=p=>M.events(p).length;
function balanced(s){M.validate(s);for(const p of M.project(s)){assert(p.balance.residual<M.BALANCE_EPS);assert.notEqual(p.points.length,1);for(const g of M.inspect(p))assert(M.balance(g.points).residual<M.BALANCE_EPS);}}
test('six silent instruments start at zero; the first action inserts a whole pair or triple',()=>{
 const empty=M.initial();assert.equal(empty.parts.length,6);assert.deepEqual(M.score(empty),[]);assert(M.arcs(empty.parts[0])[0].empty);
 for(const order of [2,3]){const s=add(empty,order,0,.137);assert.equal(count(s.parts[0]),order);M.events(s.parts[0]).forEach(e=>assert(Array.from({length:order},(_,k)=>M.wrap(.137+k/order)).some(t=>Math.abs(t-e.time)<1e-8)));balanced(s);}
 assert.deepEqual(empty,M.initial());
});
test('insertion keeps old attacks, previews all companions, and falls back from a colliding midpoint',()=>{
 let s=add(M.initial(),3);const before=M.events(s.parts[0]).map(e=>e.time),a=M.arcs(s.parts[0])[0];
 assert.equal(M.preview(s,0,0,a.start+a.length/2,2).valid,false);
 const option=M.splitOptions(s.parts[0],2,a);assert.notEqual(option.at,a.start+a.length/2);assert(option.ranges.length>=2);
 const v=M.preview(s,0,0,undefined,2);assert(v.valid);assert.equal(v.points.length,2);assert(v.affected.length>=2);
 s=add(s,2);assert.equal(count(s.parts[0]),5);before.forEach(t=>assert(M.events(s.parts[0]).some(e=>Math.abs(e.time-t)<1e-8)));balanced(s);
 const lengths=M.arcs(s.parts[0]).map(a=>a.length);assert(new Set(lengths.map(x=>x.toFixed(5))).size>1);near(lengths.reduce((a,b)=>a+b,0),1);
});
test('collision rejection is atomic, including companions and the circular seam',()=>{
 const s=add(M.initial()),before=M.clone(s);
 for(const a of [{kind:'split',arc:0,order:3,at:1/6},{kind:'split',arc:0,order:2,at:0},{kind:'split',arc:1,order:2,at:1-1e-10},{kind:'split',arc:0,at:NaN},{kind:'split',arc:8},{kind:'merge',event:0},{kind:'merge',group:99},{kind:'split',arc:0,order:1}])assert.throws(()=>M.apply(s,0,a));
 assert.deepEqual(s,before);assert.equal(count(s.parts[0]),2);
});
test('tree parent is the common ancestor of the split arc; removing a branch removes all descendants',()=>{
 let s=add(M.initial());s=add(s,2);s=add(s,2);let nodes=M.inspect(s.parts[0]);
 assert.deepEqual(nodes.map(n=>[n.id,n.parent]),[[1,null],[2,1],[3,1]]);
 // Pick an arc whose endpoints belong to the same child, if any, or to that
 // child and its descendant; LCA must never be guessed from point order.
 const arc=M.arcs(s.parts[0]).find(a=>a.left===2||a.right===2);s=add(s,3,arc.index);balanced(s);
 const tree=M.inspect(s.parts[0]),root=tree.find(n=>n.id===1),removed=root.count;
 s=M.apply(s,0,{kind:'merge',group:1});assert.equal(count(s.parts[0]),0);assert.equal(removed,9);balanced(s);
 s=add(s,3);assert.equal(s.parts[0].groups[0].id,5);assert.equal(count(s.parts[0]),3);
});
test('nested and crossing branches use the actual lowest common ancestor',()=>{
 let s=add(M.initial());s=add(s,3,0,.04);
 const a=M.arcs(s.parts[0]).find(a=>a.left===2&&a.right===2);assert(a);s=add(s,2,a.index,.15);
 assert.equal(M.inspect(s.parts[0]).find(g=>g.id===3).parent,2);
 const before=M.events(s.parts[0]).filter(e=>e.group===1).map(e=>e.time);
 s=M.apply(s,0,{kind:'merge',group:2});assert.deepEqual(M.events(s.parts[0]).map(e=>e.time),before);balanced(s);
 s.parts[0].groups.push({id:4,kind:'orbit',order:2,at:.125,children:[]});s.parts[0].nextId=5;M.validate(s);
 s=add(s,3,0,.05);assert.equal(M.inspect(s.parts[0]).find(g=>g.id===5).parent,null);balanced(s);
});
test('collapsing successive leaf packets recovers every previous musical state',()=>{
 let s=M.rotate(M.initial(),0,.1937),trace=[M.clone(s)];
 for(let n=0;n<20;n++){s=add(s,n%2?2:3);trace.push(M.clone(s));}
 for(let n=20;n>0;n--){
  const added=trace[n-1].parts[0].nextId,leaf=M.inspect(s.parts[0]).find(g=>g.id===added);assert.equal(leaf.node.children.length,0);
  s=M.apply(s,0,{kind:'merge',group:added});assert.deepEqual(M.score(s),M.score(trace[n-1]));assert.deepEqual(s.parts[0].groups,trace[n-1].parts[0].groups);balanced(s);
 }
 assert.equal(count(s.parts[0]),0);
});
test('rotation preserves exact local intervals, provenance and independent instruments',()=>{
 let s=add(M.initial(),3);s=add(s,2);s=M.apply(s,1,{kind:'split',arc:0,order:2,at:.23});const before=M.clone(s),rotated=M.rotate(s,0,100.13729);
 near(rotated.parts[0].phase,.13729);assert.deepEqual(rotated.parts[0].groups,s.parts[0].groups);assert.deepEqual(rotated.parts.slice(1),s.parts.slice(1));assert.deepEqual(M.arcs(rotated.parts[0]),M.arcs(s.parts[0]));assert.deepEqual(s,before);balanced(rotated);
});
test('600 deterministic mixed edits preserve zero resultant after every accepted operation',()=>{
 let s=M.initial(),seed=13579,accepted=0,rejected=0;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let step=0;step<600;step++){
  const id=Math.floor(random()*6),p=s.parts[id],old=M.clone(s);let out;
  try{
   if(random()<.17&&p.groups.length){const nodes=M.inspect(p);out=M.apply(s,id,{kind:'merge',group:nodes[Math.floor(random()*nodes.length)].id});}
   else if(random()<.25)out=M.rotate(s,id,random()*20-10);
   else{const arcs=M.arcs(p),arc=arcs[Math.floor(random()*arcs.length)],order=random()<.5?2:3;out=M.apply(s,id,{kind:'split',arc:arc.index,order,...(random()<.5?{at:arc.start+arc.length*(.05+.9*random())}:{})});}
   balanced(out);assert.deepEqual(s,old);accepted++;s=out;
  }catch(e){rejected++;assert.match(e.message,/совпадает|предел|дуги/);}
  M.validate(old);balanced(s);
 }
 assert(accepted>400);assert(rejected>=0);
});
test('invalid trees, malformed data, unbalanced imports and practical limits are checked',()=>{
 const s=add(M.initial());
 for(const change of [p=>p.groups[0].order=1,p=>p.groups[0].children.push(M.clone(p.groups[0])),p=>p.nextId=1,p=>p.groups[0]={id:1,kind:'fixed',points:[0,.2],children:[]},p=>p.groups[0].at=NaN]){const bad=M.clone(s);change(bad.parts[0]);assert.throws(()=>M.validate(bad));}
 const full=M.initial();full.parts[0].groups=[{id:1,kind:'fixed',points:Array.from({length:128},(_,i)=>i/128),children:[]}];full.parts[0].nextId=2;balanced(full);assert.equal(M.allowed(full.parts[0],2).length,0);assert.throws(()=>add(full));assert.throws(()=>M.rotate(s,0,NaN));
});
test('legacy PB figures survive exactly; unbalanced old divisions are explicitly skipped without mutating input',()=>{
 const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',f),'utf8')),old=read('rotating-v2.json'),before=M.clone(old),expected=read('rotating-v2-score.json'),s=M.migrate(old);
 assert.equal(s.schema,'balanced-rhythm/1');assert.equal(s.parts.length,6);assert.equal(s.rpm,43);assert.equal(s.selected,1);assert.deepEqual(old,before);assert.deepEqual(s.migration.skipped.map(p=>p.index),[0,1]);
 const score=M.score(s),want=expected.filter(e=>e.part===2);assert.equal(score.length,5);score.forEach((e,i)=>{near(e.start,want[i].start);assert.equal(e.note,want[i].note);assert.equal(e.gateSeconds,want[i].gateSeconds);});assert.equal(s.parts[2].groups[0].kind,'fixed');balanced(s);assert.deepEqual(M.migrate(s),s);
 const free={schema:'rhythm-arcs/1',rpm:30,volume:1,selected:0,parts:M.initial().parts.map(p=>{const{groups,nextId,...rest}=p;return{...rest,points:[]};})};free.parts[0].points=[0,.25,.5];free.parts[1].points=[.13,.63];const raw=JSON.stringify(free),converted=M.migrate(free);assert.equal(count(converted.parts[0]),0);assert.equal(count(converted.parts[1]),2);assert.equal(converted.migration.skipped[0].count,3);assert.equal(JSON.stringify(free),raw);balanced(converted);
});
test('Strudel event contract preserves simultaneous parts, mutes, gate seconds and tempo independence',()=>{
 let s=add(M.initial());s=M.apply(s,1,{kind:'split',arc:0});let score=M.score(s);assert.equal(score.length,4);assert.equal(score.filter(e=>e.start===0).length,2);assert.equal(new Set(score.map(e=>e.id)).size,4);
 const before=M.clone(score);s.rpm=80;assert.deepEqual(M.score(s),before);s.parts[0].enabled=false;assert.equal(M.score(s).length,2);s.parts[1].gateMs=123;near(M.score(s)[0].gateSeconds,.123);
});
