/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./puzzles/fourier/model.js'),Contract=require('./puzzle-contract.js'),Projection=require('./music-projection.js');
const {S,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),L=require('./composition-loader.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const norm=rows=>JSON.stringify(rows.map(row=>row.map(e=>[Math.round(e.start*1e8),Math.round(e.duration*1e8),JSON.stringify(e.value)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
const samples=m=>[...new Set([...m.probeStates(),...Array.from({length:128},(_,i)=>(Math.imul(i+11,1664525)>>>0)%F.stateCount)])];

test('polar Fourier: independent bounded radii, phases of order 8 and exact inverses',()=>{
 const m=new F.Model();assert.equal(F.stateCount,24**4);assert.equal(m.snapshot(),0);assert.equal(m.correct(),4);
 for(const state of samples(m)){
  const before=m.parameters(state);
  for(const move of m.legalMoves(state)){
   const next=m.applyTo(state,move),after=m.parameters(next),id=F.keys.indexOf(m.moveTarget(move));
   assert.equal(m.applyTo(next,m.inverse(move)),state);
   for(let i=0;i<4;i++)assert.equal(JSON.stringify(before[i])!==JSON.stringify(after[i]),i===id);
   if(/[+-]$/.test(move))assert.equal(after[id].phase,before[id].phase);
   else{assert.equal(after[id].level,before[id].level);let cycle=state;for(let n=0;n<8;n++)cycle=m.applyTo(cycle,move);assert.equal(cycle,state);}
   for(const t of [0,.25,.5,.75,1])F.interpolate(state,move,t).forEach(c=>assert(Math.hypot(...c)>=.2-1e-9&&Math.hypot(...c)<=.6+1e-9));
   F.interpolate(state,move,1).flat().forEach((x,i)=>close(x,m.coefficients(next).flat()[i]));
  }
  m.restore(state);let steps=0;
  while(!m.solved()){const distance=m.distance();m.apply(m.hint());assert.equal(m.distance(),distance-1);assert(++steps<=24);}
 }
 const probe=Contract.probes(Contract.inspect(registry.get('fourier')));assert.equal(probe.coverage,'sampled');assert(probe.states.length<600);
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
 assert.throws(()=>m.editMove('A',{phase:8,level:1}));assert.throws(()=>m.applyTo(before,'A+'));
 for(const z of [[.01,0],[.3,.4],[-10,20],[0,-.6]]){const p=m.snap(z);assert(p.phase>=0&&p.phase<8&&p.level>=0&&p.level<3);}
});

test('all existing scores: polar projection preserves notes/gates and native Strudel emits its event times',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},loader=new Loader(S,{palette,registry,library,storage});
 const report={schema:'fourier-contracts/3',status:'PASS',pairs:[],acousticAcceptance:'unverified',musicalAcceptance:'unverified'};
 for(const songId of L.files){
  const p=await loader.prepareSession({puzzleId:'fourier',songId}),music=new Music(S,p),m=p.model;
  assert.equal(m.count,4);assert.equal(p.fragments.count,6);assert(Projection.validate(p.phaseMap,p.module.manifest));
  assert.equal(norm(music.rows(0)),norm(p.fragments.targetRows));assert(music.phases(0).every(d=>d.aligned&&d.ticks===undefined));
  for(const state of samples(m)){
   const rows=music.rows(state),native=music.shifted(state).map(pat=>L.eventsOf(pat,p.fragments.periodBars));
   assert.equal(norm(native),norm(rows),'Native onset/gate/value must match projection, state '+state);
   rows.forEach((row,id)=>{
    assert(row.every(e=>e.start>=0&&e.start<1&&e.duration>0));
    const values=r=>r.map(e=>JSON.stringify([e.duration,e.value])).sort();assert.deepEqual(values(row),values(p.fragments.targetRows[id]),'No lost/created/retuned notes');
   });
  }
  const again=await new Loader(S,{palette,registry,library,storage}).prepareSession({puzzleId:'fourier',songId});assert.equal(again.diagnostics.cache,'hit');
  assert.equal(p.diagnostics.coverage,'sampled');assert.equal(p.diagnostics.stateSpace,F.stateCount);assert.equal(p.diagnostics.silentMoves,0);assert.equal(p.diagnostics.unsolvedGoalRhythmAliases,0);assert(p.diagnostics.derivativeBound<1);
  report.pairs.push({songId,fragments:6,progressUnits:4,bindingFingerprint:p.phaseMap.fingerprint,...p.diagnostics});
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
