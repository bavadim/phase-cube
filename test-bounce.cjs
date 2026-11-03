/* SPDX-License-Identifier: AGPL-3.0-or-later */
const compositionIds=require('./compositions/catalog.js');
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('./puzzles/bounce/terrain.js'),Module=require('./puzzles/bounce/module.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,a+' != '+b);
test('gears: rotating events and sockets cross the fixed read head at the exact audio onset',()=>{
 for(const period of [1,.5,.25,.125])for(const time of [0,.03125,.23,.5,.999]){
  close(B.wrap((B.rotation(time*period,period)+time*B.TAU-B.front)/B.TAU),0);
  const a=B.rotation(.13,period),b=B.rotation(.13+period,period);close(Math.sin(a),Math.sin(b));close(Math.cos(a),Math.cos(b));
 }
 close(B.radius(2)-B.radius(0),.64);assert(B.gainDragSpan>=1.8);
 for(const gain of [0,.2,1,1.4,2])assert(Number.isFinite(B.surface([],0,gain))&&B.radius(gain)>.25);
});
test('holding uses the unwrapped audio clock, freezes geometry and snaps to the existing phase grid',()=>{
 for(const period of [1,.5,.25,.125])for(const start of [.93,10.99])for(const turns of [0,.125,.375,1,2.25,10.125]){
  const phase=3,position=start+turns*period,held=B.heldPhase(phase,start,position,period);
  close(held,phase-8*turns);
  const a=B.rotation(start,period)-phase*B.TAU/8,b=B.rotation(position,period)-held*B.TAU/8;
  close(Math.sin(a),Math.sin(b));close(Math.cos(a),Math.cos(b));
  const m=Module.create(),before=m.snapshot(),p=m.parameters()[0];
  const move=m.editMove('A',{phase:Math.round(B.heldPhase(p.phase,start,position,period)),level:p.level});
  if(Math.abs(turns-Math.round(turns))<1e-8)assert.equal(move,null,'A whole local revolution is a no-op');
  else {m.apply(move);assert.equal(m.history.length,1);m.undo();assert.deepEqual(m.snapshot(),before);}
 }
});
test('note markers retain pitches and duration; repeated local events are folded without losing their signature',()=>{
 const row=[{start:0,duration:.1,value:{note:60,velocity:.8}},{start:.5,duration:.2,value:{note:64,velocity:.8}}],events=B.attacks(row);
 assert.notEqual(B.color(events[0]),B.color(events[1]));assert.notEqual(B.tokenWidth(events[0]),B.tokenWidth(events[1]));
 const repeated=B.attacks([...row,...row.map(e=>({...e,start:e.start+1}))],1);assert.equal(repeated.length,2);
 assert.deepEqual(repeated.map(e=>e.signature),events.map(e=>e.signature));assert.throws(()=>B.attacks([],0));
});
test('shared edit contract snaps each release to its nearest C8 seat without changing another riff',()=>{
 for(const phase of [-800.51,-8.5,-8.49,-.51,-.5,-.49,0,.49,.5,.51,7.49,7.5,7.99,8,83.63]){
  const m=Module.create();m.apply('B');const before=m.snapshot(),point={phase,gain:1.137},move=m.editPoint('A',point,before);
  assert(move);const state=m.applyTo(before,move),params=m.parameters(state),expected=((Math.round(phase)%8)+8)%8;
  assert.equal(params[0].phase,expected);close(params[0].level/4,point.gain);
  const distance=Math.abs(B.delta(phase/8,expected/8));assert(distance<=1/16+1e-9);
  assert.deepEqual(params.slice(1),m.parameters(before).slice(1));assert.deepEqual(m.applyTo(state,m.inverse(move)),before);
 }
 const m=Module.create();assert.equal(m.editPoint('A',{phase:16.1,gain:1}),null);
 for(const point of [{phase:NaN,gain:1},{phase:0,gain:Infinity},{phase:0,gain:-1}])assert.throws(()=>m.editPoint('A',point));
});
test('gear model retains exact undo, independent riff moves and solvable hints',()=>{
 const m=Module.create();assert(m.solved());for(let i=0;i<Module.shuffleSteps;i++)m.shuffle();assert(!m.solved());
 const before=m.snapshot(),p=m.parameters()[0];m.apply(m.editMove('A',{phase:p.phase+1,level:5.348}));m.undo();assert.deepEqual(m.snapshot(),before);
 let n=0;while(!m.solved()){m.apply(m.hint());assert(++n<50);}assert.equal(m.correct(),6);
});
test('every score: six visible rotors retain native Strudel attacks and their true repeat periods',async()=>{
 const {S,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),L=require('./composition-contract.js'),F=require('./puzzles/fourier/model.js');
 const loader=new Loader(S,{palette,registry,library,storage:null});
 for(const songId of compositionIds){
  const p=await loader.prepareSession({puzzleId:'bounce',songId}),m=p.model,music=new Music(S,p);assert(m.solved());
  for(const move of ['A',"B'",'C-','D+']){
   const state=m.applyTo(m.snapshot(),move),rows=music.rows(state);
   for(let i=0;i<6;i++){
    const events=B.shift(B.attacks(p.fragments.targetRows[i],p.binding.periods[i]),m.parameters(state)[i].phase-F.homePhase[i]);
    const real=B.attacks(rows[i],p.binding.periods[i]);assert.equal(real.length,events.length);real.forEach((e,j)=>close(e.time,events[j].time));
    real.forEach(e=>{const angle=B.rotation(e.time*p.binding.periods[i],p.binding.periods[i])+e.time*B.TAU;close(Math.sin(angle),Math.sin(B.front));close(Math.cos(angle),Math.cos(B.front));});
    const native=L.eventsOf(music.shifted(state)[i],p.fragments.periodBars);assert.equal(native.length,rows[i].length);
    native.forEach(e=>assert(rows[i].some(r=>Math.abs(r.start-e.start)<1e-7)));
   }
  }
 }
});
