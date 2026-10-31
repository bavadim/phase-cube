/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A bounded Fourier displacement of event onsets. This is not a PCM FFT or pitch shifter. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('../../puzzle-contract.js'));else root.FourierBinding=factory(root.FourierModel,root.PuzzleContract);})(globalThis,function(F,Contract){
  'use strict';
  const VERSION='fourier-time/1',strength=.025,mod=x=>((x%1)+1)%1,round=x=>Math.round(x*1e9)/1e9;
  const field=(c,t)=>c.reduce((sum,z,k)=>sum+z[0]*Math.cos(2*Math.PI*(k+1)*t)-z[1]*Math.sin(2*Math.PI*(k+1)*t),0);
  function project(binding,puzzle,state,game){
    const coefficients=F.coefficients(state),delta=coefficients.map((z,i)=>z.map((v,j)=>v-F.reference[i][j]));
    const rows=state===0?game.targetRows:game.targetRows.map((row,id)=>row.map(e=>({...e,start:round(mod(e.start+binding.strength*field(delta,e.start+id/(game.count*7))))})).sort((a,b)=>a.start-b.start));
    const aligned=rows.map((row,id)=>signature([row],[game.voices[id]])===signature([game.targetRows[id]],[game.voices[id]]));
    return{rows,parts:rows.map((_,id)=>({kind:VERSION,id,aligned:aligned[id]})),coefficients};
  }
  function signature(rows,voices){return rows.flatMap((row,id)=>row.map(e=>JSON.stringify([voices[id].part,round(e.start),round(e.duration),e.value.velocity??1]))).sort().join('|');}
  function validate(binding,spec){return spec.projection===VERSION&&binding?.algorithm===VERSION&&binding.strength===strength&&binding.gridSteps===64&&binding.stateCount===192;}
  async function prepare({puzzle,game,signal,onProgress=()=>{}}){
    const probe=Contract.probes(puzzle),binding={algorithm:VERSION,strength,gridSteps:64,stateCount:192},signatures=new Map();
    const target=signature(game.targetRows,game.voices);let aliases=0;
    for(let i=0;i<probe.states.length;i++){
      if(signal?.aborted)throw new DOMException('Подготовка отменена','AbortError');
      const s=probe.states[i],sKey=signature(project(binding,puzzle,s.state,game).rows,game.voices);signatures.set(s.id,sKey);
      if(!s.solved&&sKey===target)aliases++;
      if(i%24===0){onProgress({candidate:i+1,total:probe.states.length});await new Promise(r=>setTimeout(r,0));}
    }
    const silentMoves=probe.edges.filter(e=>signatures.get(e.before)===signatures.get(e.after)).length;
    if(aliases||silentMoves)throw new Error('Фурье-печать не различима на этой композиции: '+aliases+' ложных целей, '+silentMoves+' неслышимых по событиям ходов');
    // |d displacement / dt| <= strength * 2*pi*sqrt(1^2+2^2)*2*||reference|| < 1.
    const derivativeBound=strength*2*Math.PI*Math.sqrt(5)*2*Math.sqrt(F.reference.flat().reduce((s,x)=>s+x*x,0));
    return{...binding,diagnostics:{coverage:probe.coverage,states:probe.states.length,edges:probe.edges.length,distinctRhythms:new Set(signatures.values()).size,
      unsolvedGoalRhythmAliases:aliases,silentMoves,discrimination:new Set(signatures.values()).size===probe.states.length?'distinct-in-probes':'weak',
      derivativeBound,orderPreserving:derivativeBound<1,acousticAcceptance:'unverified',musicalAcceptance:'unverified'}};
  }
  return{VERSION,field,project,prepare,validate};
});
