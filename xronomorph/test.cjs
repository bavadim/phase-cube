/* SPDX-License-Identifier: AGPL-3.0-or-later */
const test=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const M=require('./model.js');
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
test('state validation rejects invalid domains and gate duration is independent of rhythm',()=>{
  const s=M.initial();M.validate(s);const a=M.score(s);s.rpm=90;assert.deepEqual(M.score(s),a);
  for(const mutate of [s=>s.wf.ratio=NaN,s=>s.wf.longs=0,s=>s.pb[0].note=500,s=>s.pb[0].phase=Infinity,s=>s.pb.push(...Array(9).fill(s.pb[0])),s=>s.selected=20]){
    const bad=M.initial();mutate(bad);assert.throws(()=>M.validate(bad));
  }
});
