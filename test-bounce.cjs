/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('./puzzles/bounce/terrain.js'),Module=require('./puzzles/bounce/module.js');
const {S,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),L=require('./composition-loader.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('bounce: each landing is an onset, including the wrap, chords and short riff periods',()=>{
 for(const times of [[0],[.12],[0,.125,.5,.875],[.1,.11,.6],[.05,.23,.63,.9]]){
  const row=times.flatMap(start=>[{start:start*.5,duration:.01,value:{velocity:.6,note:60}},{start:start*.5+.5,duration:.01,value:{velocity:.6,note:60}}]);
  const events=B.attacks(row,.5);assert.equal(events.length,times.length);
  for(const shift of [-10,-.125,0,.82,7.9])for(const gain of [0,.334,1,2]){
   const moved=B.shift(events,shift);
   for(const e of moved){close(B.flight(moved,e.time,gain).radius,B.crest(e,gain)+B.ballRadius);close(B.surface(moved,e.time,gain),B.crest(e,gain));}
   for(let i=0;i<2048;i++){
    const t=i/2048,f=B.flight(moved,t,gain);assert(Number.isFinite(f.radius));assert(f.radius>=B.surface(moved,t,gain)+B.ballRadius-1e-7,'Ball must stay above the terrain');
    close(B.flight(moved,t+10,gain).radius,f.radius);
   }
  }
 }
 assert.equal(B.attacks([{start:0,value:{note:60}},{start:0,value:{note:64}}]).length,1,'A chord is one landing');
 assert.deepEqual(B.attacks([],1),[]);assert(Number.isFinite(B.flight([],0,0).radius));assert.throws(()=>B.attacks([],0));
});
test('bounce reuses the independent riff contract with exact undo and hints',()=>{
 const m=Module.create();assert(m.solved());assert.equal(m.count,6);
 for(let i=0;i<Module.shuffleSteps;i++){const before=m.snapshot(),move=m.shuffle();assert(m.validMove(m.inverse(move)));assert.deepEqual(m.applyTo(m.snapshot(),m.inverse(move)),before);}
 assert(!m.solved());const before=m.snapshot(),p=m.parameters()[0];m.apply(m.editMove('A',{phase:p.phase+1,level:5.348}));m.undo();assert.deepEqual(m.snapshot(),before);
 let n=0;while(!m.solved()){m.apply(m.hint());assert(++n<50);}assert.equal(m.correct(),6);
});
test('every bundled melody: visible terrain landings match the native Strudel event times',async()=>{
 const loader=new Loader(S,{palette,registry,library,storage:null});
 for(const songId of L.files){
  const p=await loader.prepareSession({puzzleId:'bounce',songId}),m=p.model,music=new Music(S,p);assert(m.solved());
  for(const move of ['A',"B'",'C-','D+']){
   const state=m.applyTo(m.snapshot(),move),rows=music.rows(state),phases=music.phases(state);
   for(let i=0;i<6;i++){
    const events=B.shift(B.attacks(p.fragments.targetRows[i],p.binding.periods[i]),m.parameters(state)[i].phase-require('./puzzles/fourier/model.js').homePhase[i]);
    const real=B.attacks(rows[i],p.binding.periods[i]);assert.equal(real.length,events.length);
    real.forEach((e,j)=>close(e.time,events[j].time));
    for(const e of real)close(B.flight(events,e.time,phases[i].gain).radius,B.crest(e,phases[i].gain)+B.ballRadius);
    const native=L.eventsOf(music.shifted(state)[i],p.fragments.periodBars);assert.equal(native.length,rows[i].length);
    native.forEach(e=>assert(rows[i].some(r=>Math.abs(r.start-e.start)<1e-7),'Every native attack is displayed'));
   }
  }
 }
});
