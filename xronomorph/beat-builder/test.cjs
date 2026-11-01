/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),B=require('./model.js'),R=require('../algorithms/model.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
test('four parts, two independent patterns, strict project boundary',()=>{
 const p=B.initial();assert.equal(B.validate(p),p);p.patterns.B[0].events.pop();assert.equal(p.patterns.A[0].events.length,4);
 p.patterns.A[0].events[0].time=1-Number.EPSILON;assert.equal(B.validate(p),p);
 for(const alter of [p=>p.patterns.A[0].events[0].time=1,p=>p.patterns.B[1].sound='missing',p=>p.chain.push('A'),p=>p.bpm=0,p=>p.patterns.A[0].gain=2]){const bad=B.initial();alter(bad);assert.throws(()=>B.validate(bad));}
});
test('rotation forms a finite cycle on the grid; swing preserves anchor and identities',()=>{
 const es=B.events([0,1,4,7,12,15]);let x=es;for(let i=0;i<16;i++)x=B.rotate(x,1/16);x.forEach((e,i)=>near(e.time,es[i].time));
 const y=B.swing(es,1);assert.equal(y.length,es.length);[0,2,4].forEach(i=>near(y[i].time,es[i].time));near(y[1].time-es[1].time,1/32);assert.deepEqual(B.swing(es,0),es);
 const z=B.accent(es,1);near(z[0].velocity,es[0].velocity);assert(z[1].velocity<es[1].velocity);
});
test('mirroring preserves total strength and becomes exactly symmetric',()=>{
 const es=B.events([0,3,7,12]),x=B.mirror(es,3,1),grid=B.grid({events:x});near(x.reduce((s,e)=>s+e.velocity,0),es.reduce((s,e)=>s+e.velocity,0));near(R.mirrorError(grid,3),0);assert.throws(()=>B.mirror([...B.events([0],1),...B.events([0],1)],0,1));
});
test('responses avoid reference cells; exact motif cover adds no overlap',()=>{
 const ref={events:B.events([0,4,8,12])},answer=B.complement(ref,5);assert.equal(answer.events.length,5);assert(answer.events.every(e=>!ref.events.some(x=>x.time===e.time)));
 const c=B.canon(ref);assert.equal(c.exact,true);assert.equal(c.events.length,12);assert.equal(c.copies,3);const xs=B.grid({events:ref.events.concat(c.events)});assert(xs.every(x=>x>0&&x<=1));
 assert(B.canon({events:B.events([0,1,3])}).error);assert(B.canon({events:[{time:.01,velocity:1}]}).error);
 assert.deepEqual(B.complement({events:B.events(Array.from({length:16},(_,i)=>i))},8).events,[]);
});
test('fill preserves first three beats and only edits ending',()=>{
 const es=B.events([0,3,6,8,12,15]),f=B.fill(es,7);assert.deepEqual(f.filter(e=>e.time<.75),es.filter(e=>e.time<.75));assert.equal(f.filter(e=>e.time>=.75).length,7);assert(f.every(e=>e.time<1&&e.velocity<=1));
});
test('Fourier uses event DFT and retains base identity at zero edit',()=>{
 const es=B.events([0,3,6,10,12]),cs=R.dft(es.map(e=>R.polar(e.velocity*2,B.TAU*e.time))),x=B.scratch(es,1,0,R.abs(cs[1]));x.events.forEach((e,i)=>{near(B.wrap(e.time-es[i].time+.5)-.5,0);near(e.velocity,es[i].velocity);});
 const changed=B.scratch(es,2,Math.PI/3,.4);assert.notDeepEqual(changed.events,es);assert(changed.events.every(e=>e.time>=0&&e.time<1&&e.velocity<=1));
});
test('four-bar transport projection and mute/solo are per pattern',()=>{
 const p=B.initial(),a=B.score(p);assert.equal(a.length,4*p.patterns.A.reduce((s,t)=>s+t.events.length,0));assert(a.every(e=>e.start>=0&&e.start<1));
 p.patterns.B[0].events=[];p.chain=['A','B','A','B'];const chain=B.score(p,{chain:true});assert.equal(chain.filter(e=>e.part===0).length,8);
 p.patterns.A[0].solo=true;const solo=B.score(p);assert(solo.every(e=>e.instrument==='kick'));p.patterns.A[0].mute=true;assert.equal(B.score(p).length,0);
});
test('Strudel exports readable grid and exact free timing without quantization',()=>{
 const p=B.initial(),url='https://bavadim.github.io/phase-cube/assets/samples/',s=B.exportStrudel(p,url);assert(s.includes('setcpm(128 / 4)'));assert(s.includes('cat(A, A, A, B)'));assert(s.includes('xrono_kick ~ ~ ~'));p.patterns.B[0].events[0].time=.0123456789;const free=B.exportStrudel(p,url);assert(free.includes('.late(0.0123456789)'));assert.throws(()=>B.exportStrudel(p,'javascript:bad'));
});
