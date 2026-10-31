/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Each instrument follows its picture piece between Fourier frequency slots. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('../../puzzle-contract.js'));else root.ScratchBinding=factory(root.ScratchModel,root.PuzzleContract);})(globalThis,function(F,Contract){
  'use strict';
  const VERSION='spectral-riff/2',wrap=x=>((x%1)+1)%1,round=x=>Math.round(x*1e9)/1e9;
  function projectRow(row,piece,cycles){
    if(piece.slot===piece.source&&Math.abs(piece.phase%4)<1e-9)return row;
    return row.map(e=>{
      // Arrangement spans the full song; the deformation repeats each local loop.
      const a=F.field(piece,e.start*cycles),b=F.field(piece,(e.start+e.duration)*cycles),duration=(b.time-a.time)/cycles,ratio=duration/e.duration;
      const value={...e.value,postgain:(e.value.postgain??1)*a.gain};
      if(typeof value.duration==='number')value.duration*=ratio;
      return{...e,start:wrap(a.time/cycles),duration,volume:a.gain,value};
    }).sort((a,b)=>a.start-b.start);
  }
  function projectParameters(binding,parameters,game){
    const bySource=new Map(parameters.map(p=>[p.source,p])),cycles=game.periodBars/(game.loopBars||game.periodBars);
    const parts=game.targetRows.map((row,id)=>{const piece=bySource.get(id);return{kind:VERSION,id,controlKey:piece.key,gain:1,period:1,aligned:piece.slot===piece.source&&Math.abs(piece.phase%4)<1e-9};});
    return{parts,rows:game.targetRows.map((row,id)=>projectRow(row,bySource.get(id),cycles)),
      coefficients:parameters.map(p=>[F.amplitude(p.source)*Math.cos(p.phase*Math.PI/2),F.amplitude(p.source)*Math.sin(p.phase*Math.PI/2)])};
  }
  const project=(binding,puzzle,state,game)=>projectParameters(binding,puzzle.model.parameters(state),game);
  function preview(binding,puzzle,state,game,point){
    const model=puzzle.model;if(!model.keys.includes(point.key))throw Error('Неверный прогноз детали');
    if(point.kind==='piece-swap'){const move=model.swapMove(point.key,point.to,state);if(!move)throw Error('Неверный обмен деталей');return project(binding,puzzle,model.applyTo(state,move),game);}
    if(point.kind!=='piece-phase'||!Number.isFinite(point.phase))throw Error('Неверный прогноз фазы');
    const parameters=model.parameters(state);parameters[model.keys.indexOf(point.key)].phase=point.phase;return projectParameters(binding,parameters,game);
  }
  // No visual ids or metadata in the musical discrimination signature.
  const signature=row=>row.map(e=>JSON.stringify([round(e.start),round(e.duration),Object.fromEntries(Object.entries(e.value).filter(([k])=>!k.startsWith('_phaseCube')).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,typeof v==='number'?round(v):v]))])).sort().join('|');
  function validate(binding,spec){return spec.projection===VERSION&&binding?.algorithm===VERSION&&binding.gridSteps===4&&binding.fragments===spec.fragments&&binding.scope==='one-piece-one-instrument'&&binding.diagnostics?.pieceStates===spec.fragments*spec.fragments*4;}
  async function prepare({puzzle,game,signal,onProgress=()=>{}}){
    const binding={algorithm:VERSION,gridSteps:4,fragments:game.count,scope:'one-piece-one-instrument'};
    const cycles=game.periodBars/(game.loopBars||game.periodBars);let checked=0;
    for(let source=0;source<game.count;source++){
      const signatures=new Set(),target=signature(game.targetRows[source]);
      for(let slot=0;slot<game.count;slot++)for(let phase=0;phase<4;phase++){
        const key=signature(projectRow(game.targetRows[source],{source,slot,phase},cycles));
        if(signatures.has(key)||(!(source===slot&&phase===0)&&key===target))throw Error('Партия «'+game.voices[source].name+'» не различает положения плитки');
        signatures.add(key);checked++;
      }
      if(signal?.aborted)throw new DOMException('Подготовка отменена','AbortError');
      onProgress({candidate:source+1,total:game.count});await new Promise(r=>setTimeout(r,0));
    }
    const probes=Contract.probes(puzzle),signatures=new Map(probes.states.map(s=>[s.id,project(binding,puzzle,s.state,game).rows.map(signature).join('||')]));
    const silentMoves=probes.edges.filter(e=>signatures.get(e.before)===signatures.get(e.after)).length;
    if(silentMoves)throw Error('Обнаружены неразличимые ходы');
    let stateSpace=4n**BigInt(game.count);for(let i=2;i<=game.count;i++)stateSpace*=BigInt(i);
    return{...binding,diagnostics:{coverage:'complete-per-piece; sampled-global',pieceStates:checked,stateSpace:String(stateSpace),states:probes.states.length,edges:probes.edges.length,
      silentMoves:0,unsolvedGoalRhythmAliases:0,independentRiffs:true,scope:binding.scope,
      signatureScope:'per-instrument-native-events-without-visual-ids',acousticAcceptance:'unverified',musicalAcceptance:'unverified'}};
  }
  return{VERSION,prepare,validate,project,preview,projectParameters,projectRow};
});
