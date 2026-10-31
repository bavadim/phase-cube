/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Each piece owns a riff; its slot and angle control that riff's Fourier field. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('../../puzzle-contract.js'));else root.ScratchBinding=factory(root.ScratchModel,root.PuzzleContract);})(globalThis,function(F,Contract){
  'use strict';
  const VERSION='spectral-riff/1',wrap=x=>((x%1)+1)%1,round=x=>Math.round(x*1e9)/1e9;
  function projectParameters(binding,parameters,game){
    const bySource=new Map(parameters.map(p=>[p.source,p]));
    const parts=game.targetRows.map((row,id)=>{
      const piece=bySource.get(id);
      return{kind:VERSION,id,controlKey:piece.key,gain:1,period:1,aligned:piece.slot===piece.source&&Math.abs(piece.phase%4)<1e-9};
    });
    const rows=game.targetRows.map((row,id)=>{
      if(parts[id].aligned)return row;
      const piece=bySource.get(id);
      return row.map(e=>{
        const a=F.field(piece,e.start),b=F.field(piece,e.start+e.duration),duration=b.time-a.time,ratio=duration/e.duration;
        const value={...e.value,postgain:(e.value.postgain??1)*a.gain};
        if(typeof value.duration==='number')value.duration*=ratio;
        return{...e,start:wrap(a.time),duration,volume:a.gain,value};
      }).sort((a,b)=>a.start-b.start);
    });
    return{rows,parts,coefficients:parameters.map(p=>[F.amplitudes[p.source]*Math.cos(p.phase*Math.PI/2),F.amplitudes[p.source]*Math.sin(p.phase*Math.PI/2)])};
  }
  const project=(binding,puzzle,state,game)=>projectParameters(binding,F.parameters(state),game);
  function preview(binding,puzzle,state,game,point){
    if(!F.keys.includes(point.key))throw new Error('Неверный прогноз детали');
    if(point.kind==='piece-swap'){
      const move=puzzle.model.swapMove(point.key,point.to,state);if(!move)throw new Error('Неверный обмен деталей');
      return project(binding,puzzle,puzzle.model.applyTo(state,move),game);
    }
    if(point.kind!=='piece-phase'||!Number.isFinite(point.phase))throw new Error('Неверный прогноз фазы');
    const parameters=F.parameters(state);parameters[F.keys.indexOf(point.key)].phase=point.phase;
    return projectParameters(binding,parameters,game);
  }
  // Compare actual events, never invisible event identities: relabelling equal
  // notes is not an audible change and must not pass the discrimination audit.
  const signature=rows=>rows.map(row=>row.map(e=>JSON.stringify([round(e.start),round(e.duration),
    Object.fromEntries(Object.entries(e.value).filter(([k])=>!k.startsWith('_phaseCube')).sort(([a],[b])=>a.localeCompare(b)))])).sort().join('|')).join('||');
  function validate(binding,spec){return spec.projection===VERSION&&binding?.algorithm===VERSION&&binding.stateCount===F.stateCount&&binding.gridSteps===4&&
    binding.fragments===spec.fragments&&binding.fragments===F.keys.length&&binding.scope==='one-piece-one-riff';}
  async function prepare({puzzle,game,signal,onProgress=()=>{}}){
    if(game.count!==F.keys.length)throw new Error('Пазлу нужны три независимых музыкальных фрагмента');
    const probe=Contract.probes(puzzle),binding={algorithm:VERSION,stateCount:F.stateCount,gridSteps:4,fragments:game.count,scope:'one-piece-one-riff'};
    const signatures=new Map(),target=signature(game.targetRows);let aliases=0;
    for(let i=0;i<probe.states.length;i++){
      if(signal?.aborted)throw new DOMException('Подготовка отменена','AbortError');
      const s=probe.states[i],key=signature(project(binding,puzzle,s.state,game).rows);signatures.set(s.id,key);if(!s.solved&&key===target)aliases++;
      if(i%32===0){onProgress({candidate:i+1,total:probe.states.length});await new Promise(r=>setTimeout(r,0));}
    }
    const silentMoves=probe.edges.filter(e=>signatures.get(e.before)===signatures.get(e.after)).length,distinct=new Set(signatures.values()).size;
    if(aliases||silentMoves||distinct!==F.stateCount)throw new Error('Композиция не различает все 384 состояния пазла');
    return{...binding,diagnostics:{coverage:'complete',stateSpace:F.stateCount,states:probe.states.length,edges:probe.edges.length,
      distinctPatterns:distinct,unsolvedGoalRhythmAliases:0,silentMoves:0,independentRiffs:true,scope:binding.scope,
      signatureScope:'per-riff-native-events-without-visual-ids',acousticAcceptance:'unverified',musicalAcceptance:'unverified'}};
  }
  return{VERSION,prepare,validate,project,preview,projectParameters};
});
