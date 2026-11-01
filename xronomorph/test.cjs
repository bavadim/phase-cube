/* SPDX-License-Identifier: AGPL-3.0-or-later */
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const M=require('./model.js');
const Tree=require('./tree.js');
const delta=(a,b)=>Math.abs(M.wrap(a-b+.5)-.5),contains=(row,t)=>row.some(a=>delta(a,t)<1e-8);
test('PB catalogue reproduces all six exact minimal irregular rotation classes',()=>{
  const exact=JSON.parse(execFileSync('python3',[require('node:path').join(__dirname,'verify-irregular.py')],{encoding:'utf8'}));
  const irregular=M.shapes.filter(p=>p.kind==='irregular');assert.equal(irregular.length,6);
  assert.deepEqual(irregular.map(p=>p.points.map(t=>Math.round(t*30))),exact);
  for(const shape of M.shapes){assert(Math.abs(M.balance(shape.points)-1)<1e-12);assert.equal(new Set(shape.points).size,shape.points.length);}
  for(const shape of irregular)for(let mask=1;mask<2**shape.points.length-1;mask++){
    const subset=shape.points.filter((_,i)=>(mask>>i)&1);assert(M.balance(subset)<1-1e-8,'irregular pattern must be minimal');
  }
});
test('independent rotations preserve PB, intervals, other layers and event multiplicity',()=>{
  const s=M.initial();s.pb[0].shape='irregular-2';const before=M.project(s),rotated=M.rotate(s,0,.123456789),after=M.project(rotated);
  assert.deepEqual(after.slice(1),before.slice(1));
  before[0].points.forEach(t=>assert(contains(after[0].points,t+.123456789)));
  assert(Math.abs(M.balance(after.filter(p=>p.enabled).flatMap(p=>p.points))-1)<1e-12);
  assert.deepEqual(M.rotate(M.rotate(s,0,.75),0,1),s);
  s.pb[1].shape='regular-4';s.pb[1].phase=0;s.pb[2].enabled=false;
  s.pb[0].shape='regular-4';const score=M.score(s);assert.equal(score.length,8);assert.equal(score.filter(e=>e.start===0).length,2);
  s.snap=16;assert.equal(M.rotate(s,0,.11).pb[0].phase,2/16);
});
test('WF initialization and all six nested levels follow long/short interval rules',()=>{
  assert.equal(M.word(3,2).join(''),'LsLLs');
  for(const longs of [1,2,3,5,8])for(const shorts of [1,2,3,5,8])for(const ratio of [1,1.001,1.5,(1+Math.sqrt(5))/2,2,2.0001,3,8]){
    const w={longs,shorts,ratio,reverse:[false,true,false,true,false,true]},levels=M.hierarchy(w);
    levels.forEach((row,i)=>{
      assert(Math.abs(row.intervals.reduce((s,x)=>s+x,0)-1)<1e-10);
      assert(row.intervals.every(n=>n>0));
      const sizes=[];row.intervals.forEach(n=>{if(!sizes.some(x=>Math.abs(x-n)<1e-8))sizes.push(n);});assert(sizes.length<=2);
      if(i)levels[i-1].points.forEach(t=>assert(contains(row.points,t),'every lower event remains in the next raw level'));
    });
  }
  const w={longs:3,shorts:2,ratio:2,reverse:Array(6).fill(false)};
  assert.deepEqual(M.hierarchy(w)[0].points,[0,.25,.375,.625,.875]);
});
test('WF complements interlock, shared rotation preserves hierarchy, degeneracies stay finite',()=>{
  const s=M.initial();s.mode='wf';s.wf.layers.forEach(p=>{p.enabled=true;p.complement=true;});
  const rows=M.project(s);
  rows.forEach((row,i)=>row.points.forEach(t=>rows.slice(0,i).forEach(lower=>assert(!contains(lower.points,t)))));
  const after=M.project(M.rotate(s,3,.1875));
  rows.forEach((row,i)=>row.points.forEach(t=>assert(contains(after[i].points,t+.1875))));
  for(const ratio of [1,1.5,2,3]){s.wf.ratio=ratio;M.project(s).forEach(p=>assert(p.points.every(Number.isFinite)));}
  s.wf.ratio=2;const terminal=M.project(s);assert(terminal.at(-1).points.length===0,'C is silent after the hierarchy reaches the full equal grid');
});
test('WF boundary inverse follows the pointer continuously for every base word and direction',()=>{
  for(let longs=1;longs<=8;longs++)for(let shorts=1;shorts<=8;shorts++)for(const reversed of [false,true]){
    const w={longs,shorts,ratio:1.618,reverse:[reversed]};
    const handles=M.wfBoundaries(w);assert.equal(handles.length,longs+shorts);assert.equal(handles[0].movable,false);
    handles.forEach((h,i)=>assert(Math.abs(h.time-M.hierarchy(w)[0].points[i])<1e-12));
    for(const h of handles.filter(h=>h.movable))for(const ratio of [1,1.0001,1.25,1.9999,2,2.0001,3.79123,8]){
      const time=(h.a*ratio+h.b)/(longs*ratio+shorts),actual=M.ratioAtBoundary(w,h.index,time);
      assert(Math.abs(actual-ratio)<1e-10);
      const point=M.wfBoundaries({...w,ratio:actual})[h.index];assert(Math.abs(point.time-time)<1e-12);
    }
    for(const h of handles.filter(h=>h.movable)){
      assert([1,8].some(r=>Math.abs(M.ratioAtBoundary(w,h.index,-5)-r)<1e-10));
      assert([1,8].some(r=>Math.abs(M.ratioAtBoundary(w,h.index,5)-r)<1e-10));
    }
    assert.throws(()=>M.ratioAtBoundary(w,0,.4));assert.throws(()=>M.ratioAtBoundary(w,1,NaN));
  }
});
test('free splitting and rotation compose independently for each instrument, including irregular figures',()=>{
  let s=M.initial();const original=M.project(s),saved=M.clone(s);
  s=M.rotate(s,0,.13729);s=M.divide(s,0,{kind:'split',key:'0'});
  let rows=M.project(s);assert.equal(rows[0].points.length,5);assert(contains(rows[0].points,.125+.13729));assert.deepEqual(rows.slice(1),original.slice(1));
  assert.equal(rows[0].balanced,false,'free local splitting need not preserve strict PB');
  const score=M.score(s);s=M.rotate(s,0,.23729);rows=M.project(s);
  score.filter(e=>e.part===0).forEach(e=>assert(contains(rows[0].points,e.start+.1)));
  s=M.divide(s,0,{kind:'split',key:'0R'});assert.equal(M.project(s)[0].points.length,6);
  s=M.divide(s,0,{kind:'merge',key:'0'});assert.equal(M.project(s)[0].points.length,4);assert.equal(s.pb[0].phase,.23729);
  assert.deepEqual(saved,M.initial(),'all operations leave their input intact');
  s.pb[0].shape='regular-29';delete s.pb[0].rhythm;s=M.divide(s,0,{kind:'split',key:'28'});assert.equal(M.project(s)[0].points.length,30);
  s=M.divide(s,0,{kind:'merge',key:'28'});assert.equal(M.project(s)[0].points.length,29);
  for(const shape of M.shapes.filter(p=>p.kind==='irregular')){
    s=M.initial();s.pb[0].shape=shape.id;const geometry=M.patternGeometry(s.pb[0]),last=geometry.leaves.at(-1);
    const split=M.divide(s,0,{kind:'split',key:last.key});assert(contains(M.project(split)[0].points,last.start+last.length/2));
    assert.deepEqual(M.project(M.divide(split,0,{kind:'merge',key:last.key})),M.project(s));
  }
});
test('state validation rejects invalid domains and gate duration is independent of rhythm',()=>{
  const s=M.initial();M.validate(s);const a=M.score(s);s.rpm=90;assert.deepEqual(M.score(s),a);
  for(const mutate of [s=>s.wf.ratio=NaN,s=>s.wf.longs=0,s=>s.pb[0].note=500,s=>s.pb[0].phase=Infinity,s=>s.pb.push(...Array(9).fill(s.pb[0])),s=>s.selected=20]){
    const bad=M.initial();mutate(bad);assert.throws(()=>M.validate(bad));
  }
});
test('tree split adds a real onset, painting transfers it without duplication, merge preserves the left onset',()=>{
  const s=M.initial();s.mode='tree';const base=M.score(s);assert.equal(base.length,4);
  s.tree=Tree.apply(s.tree,{kind:'split',key:'0',owner:1});
  let score=M.score(s);assert.equal(score.length,5);assert(score.some(e=>e.start===.125&&e.part===1));
  base.forEach(e=>assert(score.some(n=>n.start===e.start&&n.part===e.part)));
  const beforePaint=score.map(e=>e.start).sort();s.tree=Tree.apply(s.tree,{kind:'paint',key:'0R',owner:3});
  score=M.score(s);assert.deepEqual(score.map(e=>e.start).sort(),beforePaint);assert.equal(score.filter(e=>e.start===.125).length,1);assert(score.some(e=>e.start===.125&&e.part===3));
  s.tree=Tree.apply(s.tree,{kind:'paint',key:'0L',owner:2});
  s.tree=Tree.apply(s.tree,{kind:'split',key:'0R',owner:5});assert.equal(M.score(s).length,6);
  s.tree=Tree.apply(s.tree,{kind:'merge',key:'0'});score=M.score(s);assert.equal(score.length,4);assert(score.some(e=>e.start===0&&e.part===2));
  assert.throws(()=>M.rotate(s,0,.25));
});
test('fully subdivided tree partitions the cycle exactly, bounds density and rejects stale branch actions',()=>{
  let tree=Tree.initial();
  while(Tree.geometry(tree).leaves.some(n=>n.canSplit)){
    const leaf=Tree.geometry(tree).leaves.find(n=>n.canSplit);tree=Tree.apply(tree,{kind:'split',key:leaf.key,owner:leaf.key.length%6});
  }
  const {leaves}=Tree.geometry(tree);assert.equal(leaves.length,16);
  leaves.forEach((n,i)=>{assert.equal(n.start,i/16);assert.equal(n.length,1/16);});
  assert.throws(()=>Tree.apply(tree,{kind:'split',key:'0LL',owner:0}));
  assert.throws(()=>Tree.apply(tree,{kind:'paint',key:'0',owner:1}));
  const saved=JSON.stringify(tree);const merged=Tree.apply(tree,{kind:'merge',key:'0'});assert.equal(Tree.geometry(merged).leaves.length,13);assert.equal(JSON.stringify(tree),saved);
  assert.throws(()=>Tree.apply(merged,{kind:'paint',key:'0LR',owner:0}));
  assert.throws(()=>Tree.apply(tree,{kind:'paint',key:'1LR',owner:20}));
});
test('saved PB/WF settings migrate without losing the existing music configuration',()=>{
  const old=M.initial();old.schema='xronomorph-lab/1';delete old.tree;old.mode='wf';old.rpm=43;old.wf.phase=.19;old.pb[0].shape='irregular-4';
  const restored=M.migrate(old);assert.equal(restored.schema,'xronomorph-lab/2');assert.deepEqual(restored.wf,old.wf);assert.deepEqual(restored.pb,old.pb);assert.equal(restored.rpm,43);assert.equal(Tree.geometry(restored.tree).leaves.length,4);
});
