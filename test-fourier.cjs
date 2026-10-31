/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./puzzles/fourier/model.js'),Contract=require('./puzzle-contract.js'),Projection=require('./music-projection.js');
const {S,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),L=require('./composition-loader.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),energy=c=>c.flat().reduce((s,x)=>s+x*x,0);
const norm=rows=>JSON.stringify(rows.map(row=>row.map(e=>[Math.round(e.start*1e8),Math.round(e.duration*1e8),JSON.stringify(e.value)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));

test('Fourier group: 192 closed states, all inverses, periods 4/4/8, noncommutativity and shortest hints',()=>{
 const m=new F.Model(),goal=m.initialState(),E=energy(F.reference);
 assert.equal(m.allStates().length,192);assert.equal(new Set(m.allStates().map(s=>JSON.stringify(F.coefficients(s)))).size,192);
 for(const state of m.allStates()){
  close(energy(m.coefficients(state)),E);
  for(const move of m.legalMoves()){
   assert.equal(m.applyTo(m.applyTo(state,move),m.inverse(move)),state);
   let next=state;for(let i=0;i<F.orders[move[0]];i++)next=m.applyTo(next,move);assert.equal(next,state);
   assert.notEqual(m.applyTo(state,move),state);
   for(const t of [0,.25,.5,.75,1])close(energy(F.interpolate(state,move,t)),E);
   const end=F.interpolate(state,move,1),actual=m.coefficients(m.applyTo(state,move));end.flat().forEach((v,i)=>close(v,actual.flat()[i]));
  }
  m.restore(state);let steps=0;
  while(!m.solved()){const distance=m.distance(),hint=m.hint();m.apply(hint);assert.equal(m.distance(),distance-1);assert(++steps<12);}
  assert.equal(m.correct(),2);
 }
 assert.equal(m.applyTo(m.applyTo(goal,'A'),'B'),m.applyTo(m.applyTo(goal,'B'),'A'));
 assert.notEqual(m.applyTo(m.applyTo(goal,'A'),'M'),m.applyTo(m.applyTo(goal,'M'),'A'));
 assert.equal(Contract.probes(Contract.inspect(registry.get('fourier'))).coverage,'complete');
});

test('all existing scores: Fourier states preserve notes/gates and native Strudel emits the projected events',async()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},loader=new Loader(S,{palette,registry,library,storage});
 const report={schema:'fourier-contracts/1',status:'PASS',pairs:[],acousticAcceptance:'unverified',musicalAcceptance:'unverified'};
 for(const songId of L.files){
  const p=await loader.prepareSession({puzzleId:'fourier',songId}),music=new Music(S,p),m=p.model;
  assert.equal(m.count,2);assert.equal(p.fragments.count,6);assert(Projection.validate(p.phaseMap,p.module.manifest));
  assert.equal(norm(music.rows(0)),norm(p.fragments.targetRows));assert(music.phases(0).every(d=>d.aligned&&d.ticks===undefined));
  assert.equal(norm(music.shifted(0).map(pat=>L.eventsOf(pat,p.fragments.periodBars))),norm(p.fragments.targetRows));
  for(const state of m.allStates()){
   const rows=music.rows(state),native=music.shifted(state).map(pat=>L.eventsOf(pat,p.fragments.periodBars));
   assert.equal(norm(native),norm(rows),'Native onset/gate/value must match projection, state '+state);
   rows.forEach((row,id)=>{
    assert(row.every(e=>e.start>=0&&e.start<1&&e.duration>0));
    const values=r=>r.map(e=>JSON.stringify([e.duration,e.value])).sort();assert.deepEqual(values(row),values(p.fragments.targetRows[id]),'No lost/created/retuned notes');
   });
  }
  const again=await new Loader(S,{palette,registry,library,storage}).prepareSession({puzzleId:'fourier',songId});assert.equal(again.diagnostics.cache,'hit');
  assert.equal(p.diagnostics.distinctRhythms,192);assert.equal(p.diagnostics.silentMoves,0);assert.equal(p.diagnostics.unsolvedGoalRhythmAliases,0);assert(p.diagnostics.derivativeBound<1);
  report.pairs.push({songId,fragments:6,progressUnits:2,bindingFingerprint:p.phaseMap.fingerprint,...p.diagnostics});
 }
 const controller=new AbortController(),cancelled=new Loader(S,{palette,registry,library,storage:null});
 await assert.rejects(()=>cancelled.prepareSession({puzzleId:'fourier',songId:L.files[0],signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});assert.equal(cancelled.bindings.size,0);
 const files=['puzzles/fourier/model.js','puzzles/fourier/module.js','puzzles/fourier/binding.js','music-projection.js','music.js','puzzle-contract.js','session-loader.js','controls/pattern-pieces.js','composition-loader.js',...L.files.map(id=>'compositions/'+id+'.strudel.mjs')];
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
