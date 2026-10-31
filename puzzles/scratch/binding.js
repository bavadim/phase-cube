/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A bounded Fourier control field deforms one authored part's timing and dynamics. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('../../puzzle-contract.js'));else root.ScratchBinding=factory(root.ScratchModel,root.PuzzleContract);})(globalThis,function(F,Contract){
  'use strict';
  const VERSION='fourier-scratch/1',wrap=x=>((x%1)+1)%1,round=x=>Math.round(x*1e9)/1e9;
  function projectCoefficients(binding,c,game,aligned=false){
    const active=new Set(binding.activeFragments);
    const rows=game.targetRows.map((row,id)=>{
      if(!active.has(id)||aligned)return row;
      return row.map(e=>{
        const a=F.field(c,e.start),b=F.field(c,e.start+e.duration),duration=b.time-a.time,ratio=duration/e.duration;
        const value={...e.value,postgain:(e.value.postgain??1)*a.gain};
        // Explicit duration overrides native Hap gates in the audio engine.
        // Transform both representations, retaining clip and timbre parameters.
        if(typeof value.duration==='number')value.duration*=ratio;
        return{...e,start:wrap(a.time),duration,volume:a.gain,value};
      }).sort((a,b)=>a.start-b.start);
    });
    const parts=rows.map((row,id)=>({kind:VERSION,id,controlKeys:active.has(id)?F.keys:[],gain:1,period:1,aligned:!active.has(id)||aligned}));
    return{rows,parts,coefficients:c};
  }
  const project=(binding,puzzle,state,game)=>projectCoefficients(binding,F.coefficients(state),game,state===0);
  function preview(binding,puzzle,state,game,point){
    if(point.kind!=='scratch-phase'||!F.keys.includes(point.key)||!Number.isFinite(point.phase))throw new Error('Неверный прогноз волны');
    const c=F.coefficients(state),i=F.keys.indexOf(point.key),a=Math.hypot(...c[i]),angle=point.phase*Math.PI/2;c[i]=[a*Math.cos(angle),a*Math.sin(angle)];
    return projectCoefficients(binding,c,game);
  }
  const signature=(rows,ids)=>ids.map(id=>rows[id].map(e=>[e.id,round(e.start),round(e.duration),round(e.volume??1)]).sort((a,b)=>a[0].localeCompare(b[0]))).map(r=>JSON.stringify(r)).join('|');
  function validate(binding,spec){return spec.projection===VERSION&&binding?.algorithm===VERSION&&binding.stateCount===F.stateCount&&binding.gridSteps===4&&
    Array.isArray(binding.activeFragments)&&binding.activeFragments.length>0&&new Set(binding.activeFragments).size===binding.activeFragments.length&&
    binding.activeFragments.every(i=>Number.isInteger(i)&&i>=0&&i<spec.fragments)&&typeof binding.activePart==='string';}
  async function prepare({puzzle,game,signal,onProgress=()=>{}}){
    const probe=Contract.probes(puzzle),parts=[...new Set(game.voices.map(v=>v.part))];
    parts.sort((a,b)=>(a==='riff'?-1:b==='riff'?1:0)||a.localeCompare(b));
    for(const part of parts){
      const activeFragments=game.voices.flatMap((v,i)=>v.part===part?[i]:[]),binding={algorithm:VERSION,stateCount:F.stateCount,gridSteps:4,activePart:part,activeFragments};
      const signatures=new Map(),target=signature(game.targetRows,activeFragments);let aliases=0;
      for(let i=0;i<probe.states.length;i++){
        if(signal?.aborted)throw new DOMException('Подготовка отменена','AbortError');
        const s=probe.states[i],key=signature(project(binding,puzzle,s.state,game).rows,activeFragments);signatures.set(s.id,key);if(!s.solved&&key===target)aliases++;
        if(i%32===0){onProgress({candidate:i+1,total:probe.states.length});await new Promise(r=>setTimeout(r,0));}
      }
      const silentMoves=probe.edges.filter(e=>signatures.get(e.before)===signatures.get(e.after)).length,distinct=new Set(signatures.values()).size;
      if(!aliases&&!silentMoves&&distinct===F.stateCount)return{...binding,diagnostics:{coverage:'complete',stateSpace:F.stateCount,states:probe.states.length,edges:probe.edges.length,
        distinctPatterns:distinct,unsolvedGoalRhythmAliases:0,silentMoves:0,activePart:part,activeFragments,
        signatureScope:'event-identities-onsets-gates-gain',acousticAcceptance:'unverified',musicalAcceptance:'unverified'}};
    }
    throw new Error('Композиция не различает все 384 состояния спектрального обруча');
  }
  return{VERSION,prepare,validate,project,preview,projectCoefficients};
});
