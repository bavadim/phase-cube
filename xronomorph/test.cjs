/* SPDX-License-Identifier: AGPL-3.0-or-later */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),M=require('./model.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),add=(s,arc=0,at)=>M.apply(s,0,{kind:'split',arc,at});
test('all six instruments start empty; 0 → 1 → 2 → 3 attacks retain a full cyclic partition',()=>{
 let s=M.initial();assert.equal(s.parts.length,6);assert.equal(new Set(s.parts.map(p=>p.instrument)).size,6);assert.deepEqual(M.score(s),[]);assert(M.arcs(s.parts[0])[0].empty);
 for(let n=1;n<=3;n++){s=add(s);assert.equal(s.parts[0].points.length,n);const arcs=M.arcs(s.parts[0]);near(arcs.reduce((t,a)=>t+a.length,0),1);assert(arcs.every(a=>a.length>0));assert.equal(M.score(s).length,n);}
 assert.deepEqual(s.parts[0].points,[0,.25,.5]);
});
test('a split uses arc length, including one-note circles and arcs across zero',()=>{
 let s=add(M.initial(),0,.8);near(M.arcs(s.parts[0])[0].length,1);s=add(s);near(s.parts[0].points[0],.3);near(s.parts[0].points[1],.8);
 s=add(s,1,1.1);near(s.parts[0].points[0],.1);assert.equal(s.parts[0].points.length,3);near(M.arcs(s.parts[0]).reduce((a,b)=>a+b.length,0),1);
});
test('arbitrary split positions construct exact triplets and non-dyadic rhythms',()=>{
 let s=add(M.initial());s=add(s,0,1/3);s=add(s,1);s.parts[0].points.forEach((t,i)=>near(t,i/3));
 const times=[.017,.113,Math.SQRT2/5,.63,.8701,.999];s=add(M.initial(),0,times[0]);
 for(const t of times.slice(1)){const arc=M.arcs(s.parts[0]).find(a=>t>a.start&&t<a.start+a.length);s=add(s,arc.index,t);}
 s.parts[0].points.forEach((t,i)=>near(t,times[i]));
});
test('rotation preserves all interval lengths and other instruments for 0, 1, 2 and dense figures',()=>{
 for(const count of [0,1,2,3,16,128]){
  const s=M.initial();s.parts[0].points=Array.from({length:count},(_,i)=>i/count);s.parts[1].points=[.2,.8];const original=M.clone(s);
  const rotated=M.rotate(s,0,10.13729);assert.deepEqual(rotated.parts.slice(1),s.parts.slice(1));assert.deepEqual(M.arcs(rotated.parts[0]),M.arcs(s.parts[0]));
  M.project(rotated)[0].points.forEach(t=>assert(M.project(s)[0].points.some(a=>Math.abs(M.wrap(a+.13729)-t)<1e-8)));
  assert.deepEqual(s,original);
 }
});
test('joining can remove any attack, including the first and last; insertion and rotation stay independent',()=>{
 let s=add(M.initial());s=add(s);s=add(s,1);s=M.rotate(s,0,.21);const after=s.parts[0].phase;
 s=M.apply(s,0,{kind:'merge',event:0});assert.equal(s.parts[0].points.length,2);near(s.parts[0].phase,after);
 while(s.parts[0].points.length)s=M.apply(s,0,{kind:'merge',event:0});assert.equal(M.score(s).length,0);
 s=add(s);assert.equal(M.score(s).length,1);near(M.score(s)[0].start,after);
});
test('invalid or duplicate attacks, stale addresses and practical density limits are rejected',()=>{
 const s=add(M.initial());
 for(const action of [{kind:'split',arc:0,at:0},{kind:'split',arc:0,at:1},{kind:'split',arc:0,at:NaN},{kind:'split',arc:4},{kind:'merge',event:1},{kind:'merge',event:-1},{kind:'paint'}])assert.throws(()=>M.apply(s,0,action));
 for(const points of [[.3,.2],[0,0],[NaN],[1],[0,1-1e-9],Array.from({length:129},(_,i)=>i/129)]){const bad=M.initial();bad.parts[0].points=points;assert.throws(()=>M.validate(bad));}
 const full=M.initial();full.parts[0].points=Array.from({length:128},(_,i)=>i/128);M.validate(full);assert.throws(()=>add(full));assert.throws(()=>M.rotate(s,0,NaN));assert.throws(()=>M.apply(s,100,{kind:'split',arc:0}));
});
test('old rotating figures migrate with exactly the previous release onset times and sound settings',()=>{
 const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',f),'utf8')),old=read('rotating-v2.json'),before=M.clone(old),expected=read('rotating-v2-score.json');
 const s=M.migrate(old),score=M.score(s);assert.equal(s.schema,'rhythm-arcs/1');assert.equal(s.parts.length,6);assert.equal(s.selected,1);assert.equal(s.rpm,43);assert.equal(s.volume,.8);assert.deepEqual(old,before);
 const sort=a=>a.sort((x,y)=>x.part-y.part||x.start-y.start);sort(score);sort(expected);assert.equal(score.length,expected.length);
 score.forEach((e,i)=>{const {id,start,...rest}=e,{start:at,...want}=expected[i];assert.deepEqual(rest,want);near(start,at);});
 assert(s.parts.slice(3).every(p=>!p.points.length));assert.deepEqual(M.migrate(s),s);
 const v1=M.clone(old);v1.schema='xronomorph-lab/1';v1.pb.forEach(p=>delete p.rhythm);assert(M.migrate(v1).parts.length===6);
});
test('the Strudel event contract preserves simultaneous instruments, mutes, gates and tempo independence',()=>{
 let s=add(M.initial());s=M.apply(s,1,{kind:'split',arc:0});let score=M.score(s);assert.equal(score.length,2);assert(score.every(e=>e.start===0));assert.notEqual(score[0].part,score[1].part);
 const before=M.clone(score);s.rpm=80;assert.deepEqual(M.score(s),before);s.parts[0].enabled=false;assert.equal(M.score(s).length,1);s.parts[1].gateMs=123;near(M.score(s)[0].gateSeconds,.123);
});
