/* SPDX-License-Identifier: AGPL-3.0-or-later */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('./puzzles/scratch/model.js'),Binding=require('./puzzles/scratch/binding.js'),Contract=require('./puzzle-contract.js'),Projection=require('./music-projection.js');
const {S,palette,registry,library,Music}=require('./test-runtime.cjs'),{Loader}=require('./session-loader.js'),L=require('./composition-loader.js');
const close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const norm=rows=>JSON.stringify(rows.map(row=>row.map(e=>[Math.round(e.start*1e8),Math.round(e.duration*1e8),JSON.stringify(e.value)]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))));
test('scratch: complete finite graph, periods, noncommutation, shortest hints and bounded unitary paths',()=>{
  const m=new F.Model();assert.equal(F.states().size,384);
  assert.notEqual(m.applyTo(m.applyTo(0,'A'),'Ax'),m.applyTo(m.applyTo(0,'Ax'),'A'));
  const radius=Math.hypot(...F.amplitudes),minDerivative=1-.2*(Math.sqrt(14)*radius+F.amplitudes.reduce((sum,a,k)=>sum+(k+1)*a,0));
  assert(minDerivative>0,'Every constant-norm interpolation has an increasing cyclic time map');
  for(const state of m.allStates()){
    for(const move of m.legalMoves(state)){
      const next=m.applyTo(state,move);assert.equal(m.applyTo(next,m.inverse(move)),state);
      let cycle=state;for(let i=0;i<(move.endsWith('x')?2:4);i++)cycle=m.applyTo(cycle,move);assert.equal(cycle,state);
      for(const t of [0,.37,1]){
        const c=F.interpolate(state,move,t);close(c.reduce((sum,z)=>sum+z[0]**2+z[1]**2,0),radius**2);
        for(const at of [.07,.25,.83]){const f=F.field(c,at);assert(f.gain>0&&f.gain<2);assert(f.derivative>=minDerivative-1e-8);close(F.field(c,at+1).time,f.time+1);}
        if(t===1)c.flat().forEach((v,i)=>close(v,F.coefficients(next).flat()[i]));
      }
    }
    m.restore(state);let n=0;const distance=m.distance();
    while(!m.solved()){const before=m.distance(),hint=m.hint();m.apply(hint);assert.equal(m.distance(),before-1);assert(++n<=8);}
    assert.equal(n,distance);
  }
});
test('scratch drag: one guarded undoable move; full turns are aliases and stale gestures fail',()=>{
  const m=new F.Model();assert.equal(m.editMove('A',4),null);assert.equal(m.editMove('A',-4),null);
  const move=m.editMove('A',1.2);assert(m.validMove(move));m.apply(move);assert.equal(m.history.length,1);assert(!m.validMove(move));
  const after=m.snapshot(),inverse=m.undo();assert.equal(m.snapshot(),0);assert.equal(m.applyTo(after,inverse),0);
  assert.throws(()=>m.applyTo(after,move),/Устаревшее/);
  assert.equal(Contract.inspect(registry.get('scratch')).model.count,3);assert.equal(registry.get('scratch').manifest.fragments,6);
  assert.throws(()=>Contract.inspect({...registry.get('scratch'),manifest:{...registry.get('scratch').manifest,controls:6}}),/управления/);
});
test('scratch on every score: 384 distinguishable states, original target, exact native gates, unchanged accompaniment, generic previews and cache',async()=>{
  const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},loader=new Loader(S,{palette,registry,library,storage});
  const report={schema:'fourier-scratching-contracts/1',status:'PASS',pairs:[],acousticAcceptance:'unverified',musicalAcceptance:'unverified'};
  for(const songId of L.files){
    const p=await loader.prepareSession({songId,puzzleId:'scratch'}),m=p.model,music=new Music(S,p),game=p.fragments;
    assert(Projection.validate(p.phaseMap,p.module.manifest));assert.equal(p.diagnostics.coverage,'complete');assert.equal(p.diagnostics.distinctPatterns,384);assert.equal(p.diagnostics.silentMoves,0);assert.equal(p.diagnostics.unsolvedGoalRhythmAliases,0);
    assert.equal(norm(music.rows(0)),norm(game.targetRows));assert(music.shifted(0).every((pattern,id)=>pattern===game.basePatterns[id]));
    for(const state of m.allStates()){
      const rows=music.rows(state);
      rows.forEach((row,id)=>{
        assert.equal(row.length,game.targetRows[id].length);
        if(!p.phaseMap.activeFragments.includes(id)){assert.equal(row,game.targetRows[id]);assert.equal(music.shifted(state)[id],game.basePatterns[id]);return;}
        for(const event of row){const source=game.targetRows[id].find(e=>e.id===event.id);
          assert(event.start>=0&&event.start<1&&event.duration>0);assert.equal(event.pitch,source.pitch);assert.equal(event.value.note,source.value.note);assert.equal(event.value.s,source.value.s);
          close(event.value.postgain??1,(source.value.postgain??1)*(event.volume??1));
          if(typeof source.value.duration==='number')close(event.value.duration/source.value.duration,event.duration/source.duration);
        }
      });
    }
    for(const state of [1,19,127,255,383])music.shifted(state).forEach((pattern,id)=>{
      const native=L.eventsOf(pattern,game.periodBars).sort((a,b)=>a.start-b.start||a.duration-b.duration),symbolic=music.rows(state)[id].slice().sort((a,b)=>a.start-b.start||a.duration-b.duration);
      assert.equal(native.length,symbolic.length);
      native.forEach((event,i)=>{close(event.start,symbolic[i].start);close(event.duration,symbolic[i].duration);assert.deepEqual(event.value,symbolic[i].value);});
    });
    const a=music.preview({kind:'scratch-phase',key:'A',phase:.12},0),b=music.preview({kind:'scratch-phase',key:'A',phase:.19},0);
    assert(a.continuous&&b.continuous);assert.notEqual(norm(a.rows),norm(b.rows));assert.deepEqual(a.changed,p.phaseMap.activeFragments);assert.equal(m.snapshot(),0);assert.equal(m.history.length,0);
    const again=await new Loader(S,{palette,registry,library,storage}).prepareSession({songId,puzzleId:'scratch'});assert.equal(again.diagnostics.cache,'hit');
    report.pairs.push({songId,...p.diagnostics});
  }
  const controller=new AbortController(),cancelled=new Loader(S,{palette,registry,library,storage:null});
  await assert.rejects(()=>cancelled.prepareSession({songId:L.files[0],puzzleId:'scratch',signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});assert.equal(cancelled.bindings.size,0);
  fs.mkdirSync(path.join(__dirname,'qa/scratch'),{recursive:true});fs.writeFileSync(path.join(__dirname,'qa/scratch/contracts-report.json'),JSON.stringify(report,null,2)+'\n');
});
