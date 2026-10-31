/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./puzzles/fourier/model.js'),Contract=require('./puzzle-contract.js'),Projection=require('./music-projection.js'),Binding=require('./puzzles/fourier/binding.js');
const {S,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),L=require('./composition-loader.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const norm=rows=>JSON.stringify(rows.map(row=>row.map(e=>[Math.round(e.start*1e8),Math.round(e.duration*1e8),JSON.stringify(e.value)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
const samples=m=>[...new Set([...m.probeStates().filter(Number.isInteger),...Array.from({length:128},(_,i)=>(Math.imul(i+11,1664525)>>>0)%F.stateCount)])];

test('polar Fourier: independent bounded radii, phases of order 8 and exact inverses',()=>{
 const m=new F.Model();assert.equal(F.stateCount,72**6);assert.equal(m.snapshot(),0);assert.equal(m.correct(),6);
 for(const state of samples(m)){
  const before=m.parameters(state);
  for(const move of m.legalMoves(state)){
   const next=m.applyTo(state,move),after=m.parameters(next),id=F.keys.indexOf(m.moveTarget(move));
   assert.equal(m.applyTo(next,m.inverse(move)),state);
   for(let i=0;i<F.keys.length;i++)assert.equal(JSON.stringify(before[i])!==JSON.stringify(after[i]),i===id);
   if(/[+-]$/.test(move))assert.equal(after[id].phase,before[id].phase);
   else{assert.equal(after[id].level,before[id].level);let cycle=state;for(let n=0;n<8;n++)cycle=m.applyTo(cycle,move);assert.equal(cycle,state);}
   for(const t of [0,.25,.5,.75,1])F.interpolate(state,move,t).forEach(c=>assert(Math.hypot(...c)>=-1e-9&&Math.hypot(...c)<=2+1e-9));
   F.interpolate(state,move,1).flat().forEach((x,i)=>close(x,m.coefficients(next).flat()[i]));
  }
  m.restore(state);let steps=0;
  while(!m.solved()){const distance=m.distance();m.apply(m.hint());assert.equal(m.distance(),distance-1);assert(++steps<=48);}
 }
 const probe=Contract.probes(Contract.inspect(registry.get('fourier')));assert.equal(probe.coverage,'sampled');assert(probe.states.length<800);
 for(let seed=0;seed<64;seed++){
  m.reset(seed);const moves=[m.shuffle(),m.shuffle(),m.shuffle()];assert.equal(m.distance(),3);assert(moves.some(s=>/[+-]$/.test(s)));assert(moves.some(s=>!/[+-]$/.test(s)));
 }
});

test('drag is one replayable guarded move; undo returns both coordinates and rejects stale/no-op edits',()=>{
 const m=new F.Model(),before=m.snapshot(),edit=m.editMove('A',{phase:5,level:0});
 assert(m.validMove(edit));const next=m.applyTo(before,edit);assert.equal(m.applyTo(next,m.inverse(edit)),before);
 m.apply(edit);assert.equal(m.history.length,1);assert.deepEqual(m.parameters()[0],{phase:5,level:0});assert.equal(m.validMove(edit),false);
 const inverse=m.undo();assert.equal(m.snapshot(),before);assert.equal(m.applyTo(next,inverse),before);assert.equal(m.history.length,0);
 assert.equal(m.editMove('A',m.parameters()[0]),null);assert.throws(()=>m.applyTo(before,{...edit,from:{phase:2,level:1}}));
 assert.equal(m.editMove('A',{phase:8,level:4}),null);assert.throws(()=>m.applyTo(before,{kind:'coefficient',key:'A',from:{phase:0,level:0},to:{phase:0,level:1}}));
 for(const z of [[.01,0],[.3,.4],[-10,20],[0,-.6]]){const p=m.snap(z);assert(p.phase>=0&&p.phase<8&&p.level>=0&&p.level<F.levels.length);}
});

test('all existing scores: polar projection preserves notes/gates and native Strudel emits its event times',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},loader=new Loader(S,{palette,registry,library,storage});
 const report={schema:'fourier-contracts/5',status:'PASS',pairs:[],acousticAcceptance:'unverified',musicalAcceptance:'unverified'};
 for(const songId of L.files){
  const p=await loader.prepareSession({puzzleId:'fourier',songId}),music=new Music(S,p),m=p.model;
  assert.equal(m.count,6);assert.equal(p.fragments.count,6);assert(Projection.validate(p.binding,p.module.manifest));
  assert.equal(norm(music.rows(0)),norm(p.fragments.targetRows));assert(music.phases(0).every(d=>d.aligned&&d.ticks===undefined));
  for(const state of samples(m)){
   const rows=music.rows(state),native=music.shifted(state).map(pat=>L.eventsOf(pat,p.fragments.periodBars));
   assert.equal(norm(native),norm(rows),'Native onset/gate/value must match projection, state '+state);
   rows.forEach((row,id)=>{
    assert(row.every(e=>e.start>=0&&e.start<1&&e.duration>0));
    const clean=value=>{const copy={...value};delete copy.postgain;return copy;};
    const values=r=>r.map(e=>JSON.stringify([e.duration,clean(e.value)])).sort();assert.deepEqual(values(row),values(p.fragments.targetRows[id]),'No lost/created/retuned notes');
    const gain=music.phases(state)[id].gain;
    row.forEach(e=>{const source=p.fragments.targetRows[id].find(original=>original.id===e.id);close(e.value.postgain??1,(source.value.postgain??1)*gain);});
   });
  }
  for(const key of F.keys){
   const id=F.keys.indexOf(key),before=music.rows(0),shift=music.rows(m.applyTo(0,key)),quiet=music.rows(m.applyTo(0,key+'-'));
   for(let j=0;j<6;j++)if(j!==id){assert.equal(shift[j],before[j]);assert.equal(quiet[j],before[j]);}
   const phase=music.phases(m.applyTo(0,key))[id];
   for(const event of shift[id]){const source=before[id].find(e=>e.id===event.id);close(((event.start-source.start-phase.period/8)%1+1)%1,0);assert.deepEqual(event.value,source.value);}
   for(const event of quiet[id]){const source=before[id].find(e=>e.id===event.id);close(event.start,source.start);close(event.value.postgain,(source.value.postgain??1)*.75);}
   const a=m.applyTo(m.applyTo(0,key),key+'-'),b=m.applyTo(m.applyTo(0,key+'-'),key);assert.equal(a,b,'Rotation and positive scaling commute');
  }
  const again=await new Loader(S,{palette,registry,library,storage}).prepareSession({puzzleId:'fourier',songId});assert.equal(again.diagnostics.cache,'hit');
  assert.equal(p.diagnostics.coverage,'sampled');assert.equal(p.diagnostics.gridPresetStates,F.stateCount);assert.equal(p.diagnostics.continuousGain,true);assert.equal(p.diagnostics.silentMoves,0);assert.equal(p.diagnostics.unsolvedGoalRhythmAliases,0);assert.equal(p.diagnostics.independentRiffs,true);
  report.pairs.push({songId,fragments:6,progressUnits:6,bindingFingerprint:p.binding.fingerprint,...p.diagnostics});
 }
 const controller=new AbortController(),cancelled=new Loader(S,{palette,registry,library,storage:null});
 await assert.rejects(()=>cancelled.prepareSession({puzzleId:'fourier',songId:L.files[0],signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});assert.equal(cancelled.bindings.size,0);
 const files=['puzzles/actions.js','puzzles/fourier/model.js','puzzles/fourier/module.js','puzzles/fourier/binding.js','music-projection.js','music.js','puzzle-contract.js','session-loader.js','controls/pattern-pieces.js','composition-loader.js',...L.files.map(id=>'compositions/'+id+'.strudel.mjs')];
 report.sourceSha256=Object.fromEntries(files.map(file=>[file,require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,file))).digest('hex')]));
 fs.mkdirSync(path.join(__dirname,'qa/fourier'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/fourier/contracts-report.json'),JSON.stringify(report,null,2)+'\n');
});
test('native event adapter preserves clipped gates, wrapped tails and one onset across scheduler query boundaries',()=>{
 const source=S.note('c4 d4').s('sine').clip(.5),events=L.eventsOf(source,1),adapted=Projection.nativeEvents(S,events,1);
 assert.equal(norm([L.eventsOf(adapted,1)]),norm([events]));
 const wrapped=Projection.nativeEvents(S,[{start:.95,duration:.3,value:{note:60,s:'sine'}}],1);
 const tail=wrapped.queryArc(1,1.1);assert(tail.length&&tail.every(h=>!h.hasOnset()));
 const slices=Array.from({length:20},(_,i)=>wrapped.queryArc(i/10,(i+1)/10)).flat().filter(h=>h.hasOnset());
 assert.equal(slices.length,2);assert.deepEqual(slices.map(h=>Math.round(Number(h.whole.begin)*100)),[95,195]);
});

test('riff period preserves pitch, gates and dynamics, rather than counting only attacks',()=>{
 const row=[0,.25,.5,.75].map((start,i)=>({start,duration:.1,value:{note:i%2?62:60,gain:.2}}));
 close(Binding.period(row),.5);close(Binding.period(row.map(e=>({...e,value:{note:60,gain:.2}}))),.25);
 close(Binding.period(row.map((e,i)=>({...e,value:{...e.value,velocity:i/4}}))),1);
 const {level,brightness}=require('./controls/equalizer.js');
 close(level({volume:.5,value:{velocity:.8}}),.4);assert(brightness(.25)<brightness(.5)&&brightness(.5)<brightness(1));
});

test('volume scales after timbre processing and preserves a source without explicit gain',()=>{
 const m=new F.Model(),event={id:'x',start:0,duration:.1,value:{s:'sine',note:60,distort:.4}},game={targetRows:Array(6).fill([event])};
 const projected=Binding.project({periods:Array(6).fill(1)},null,m.applyTo(0,'A-'),game);
 assert.deepEqual(projected.rows[0][0].value,{...event.value,postgain:.75});
 assert.equal(projected.rows[0][0].value.gain,undefined);assert.equal(projected.rows[1],game.targetRows[1]);
});

test('short native riff repeats four times under one master clock and rotates by its own period',()=>{
 const pattern=S.note('c4 e4').s('sine').fast(4).clip(.5),row=L.eventsOf(pattern,1).map((e,i)=>({...e,id:'event:'+i})),m=new F.Model();
 const period=Binding.period(row);close(period,.25);
 const targetRows=Array(6).fill(row),game={targetRows,basePatterns:Array(6).fill(pattern),periodBars:1},prepared={puzzle:{manifest:registry.get('fourier').manifest,model:m},fragments:game,binding:{periods:Array(6).fill(period)}};
 const projection=Projection.project(S,prepared,m.applyTo(0,"A'"));
 projection.rows[0].forEach(e=>{const original=row.find(v=>v.id===e.id);close(((e.start-original.start+period/8+1.5)%1)-.5,0);});
 assert.equal(norm([L.eventsOf(projection.patterns[0],1)]),norm([projection.rows[0]]));
 for(let i=1;i<6;i++)assert.equal(projection.rows[i],targetRows[i]);
});

test('thirds and sixths retain their true period and wrapped events stay inside the master circle',()=>{
 for(const repeats of [3,6]){
  const row=Array.from({length:repeats},(_,i)=>({id:String(i),start:i/repeats,duration:.01,value:{note:60,s:'sine'}}));
  const period=Binding.period(row);close(period,1/repeats);
  const m=new F.Model(),game={targetRows:Array(6).fill(row)};
  for(const state of m.probeStates())for(const event of Binding.project({periods:Array(6).fill(period)},null,state,game).rows.flat())assert(event.start>=0&&event.start<1);
 }
});

test('phase aliases wrap before comparing, zero retains phase, and continuous preview stays outside model history',()=>{
 const m=new F.Model(),row=[{id:'0:0',start:.2,duration:.05,pitch:60,value:{s:'sine',note:60}}],game={targetRows:Array(6).fill(row)},binding={periods:Array(6).fill(1)};
 for(const turns of [-3,-1,0,1,4])for(const key of F.keys){const i=F.keys.indexOf(key);assert.equal(m.editMove(key,{phase:F.homePhase[i]+8*turns,level:4}),null);}
 const silence=m.editMove('A',{phase:3,level:0});m.apply(silence);assert.deepEqual(m.snap([0,0],3),{phase:3,level:0});assert.equal(Binding.project(binding,null,m.snapshot(),game).rows[0][0].value.postgain,0);m.undo();
 const a=Binding.preview(binding,null,0,game,{key:'A',phase:.1,gain:1.01}),b=Binding.preview(binding,null,0,game,{key:'A',phase:.2,gain:1.02});
 assert.notEqual(a.rows[0][0].start,b.rows[0][0].start);assert.notEqual(a.rows[0][0].value.postgain,b.rows[0][0].value.postgain);assert.equal(a.rows[1],row);assert.equal(m.snapshot(),0);assert.equal(m.history.length,0);
 const hidden=m.applyTo(0,"C'");assert.equal(m.solved(hidden),false,'Different note order does not become a valid goal just because attacks line up');
});
test('changing pitches with identical rhythm invalidates the cached riff periods',async()=>{
 const base=await library.load('turkish-circuit');let revision=0;
 const score=()=>L.analyze(S,{...base,playerParts:['x','y','z'].map(key=>({key,name:key,pattern:(revision?S.note('c4 d4 e4 f4').slow(2):S.note('c4').fast(2)).s('sine')}))},'cache-note-test',palette);
 const loader=new Loader(S,{palette,registry,library:{load:async()=>score()},storage:null});
 const first=await loader.prepareSession({puzzleId:'fourier',songId:'cache-note-test'});revision=1;
 const second=await loader.prepareSession({puzzleId:'fourier',songId:'cache-note-test'});
 assert.equal(second.diagnostics.cache,'miss');assert.notDeepEqual(first.binding.periods,second.binding.periods);
});

test('continuous chair gain persists, projects into native audio, reverses exactly and has actionable hints',()=>{
 const m=new F.Model(),binding={periods:Array(6).fill(1)},row=[{id:'n',start:.17,duration:.08,value:{note:60,s:'sine'}}],game={targetRows:Array(6).fill(row)};
 for(const gain of [0,.001,.123456,.731,1.006,1.337,1.999999,2]){
  m.reset();const move=m.editMove('A',{phase:3,level:gain*4});m.apply(move);const state=m.snapshot();
  close(F.gain(m.parameters()[0]),gain);close(Math.hypot(...m.coefficients()[0]),gain);
  const projected=Binding.project(binding,null,state,game);close(projected.parts[0].gain,gain);close(projected.rows[0][0].value.postgain,gain);
  const native=L.eventsOf(Projection.nativeEvents(S,projected.rows[0],1),1);assert.equal(norm([native]),norm([projected.rows[0]]));
  assert.equal(m.applyTo(state,m.inverse(move)),0);
  for(const operation of m.legalMoves()){const next=m.applyTo(state,operation);assert.deepEqual(m.applyTo(next,m.inverse(operation)),state);}
  m.undo();assert.equal(m.snapshot(),0);m.restore(state);
  let n=0;while(!m.solved()){
    const hint=m.hint();m.select(m.moveTarget(hint));assert(m.actions().some(a=>JSON.stringify(a.move)===JSON.stringify(hint)));m.apply(hint);assert(++n<16);
  }
  assert.equal(m.snapshot(),0);
 }
 const near=m.editMove('A',{phase:0,level:4.000000001});const almost=m.applyTo(0,near);assert(!m.solved(almost));assert.equal(Binding.project(binding,null,almost,game).parts[0].aligned,false);
 const a=m.editMove('B',{phase:1,level:4.123456789123});m.apply(a);m.apply("B'");m.apply('B');assert.equal(m.applyTo(m.snapshot(),m.inverse(a)),0);
 assert.throws(()=>m.editMove('A',{phase:0,level:8.01}));assert.throws(()=>m.restore({kind:'continuous-levels/1',values:Array(6).fill({phase:0,level:NaN})}));
});
