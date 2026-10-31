/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Diagonal C* action on independent periodic riffs, not a PCM Fourier transform. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'),require('../../puzzle-contract.js'));else root.FourierBinding=factory(root.FourierModel,root.PuzzleContract);})(globalThis,function(F,Contract){
  'use strict';
  const VERSION='complex-riff/3',mod=x=>((x%1)+1)%1,round=x=>Math.round(x*1e9)/1e9,wrap=x=>round(mod(x))%1;
  const sound=value=>Object.fromEntries(Object.entries(value).filter(([k])=>!k.startsWith('_phaseCube')).sort(([a],[b])=>a.localeCompare(b)));
  const rowKey=(row,offset=0)=>row.map(e=>JSON.stringify([wrap(e.start+offset),round(e.duration),sound(e.value)])).sort().join('|');
  function period(row){
    const start=Math.min(...row.map(e=>e.start)),reference=rowKey(row);
    const candidates=[...new Set(row.map(e=>mod(e.start-start)).filter(n=>n>1e-8))].sort((a,b)=>a-b);
    return candidates.find(p=>rowKey(row,p)===reference)||1;
  }
  function projectParameters(binding,parameters,game){
    const coefficients=parameters.map(p=>[p.gain*Math.cos(p.phase*Math.PI/4),p.gain*Math.sin(p.phase*Math.PI/4)]);
    const parts=parameters.map((p,id)=>{
      const phase=((p.phase-F.homePhase[id]+4)%8+8)%8-4,amplitude=p.gain;
      return{kind:VERSION,id,controlKey:F.keys[id],phase:phase/8,gain:amplitude,period:binding.periods[id],aligned:Math.abs(phase)<1e-8&&amplitude===1};
    });
    const rows=game.targetRows.map((row,id)=>{
      const p=parts[id];if(p.aligned)return row;
      // Positive complex phase advances the riff; positive rotation moves the
      // score counterclockwise too. Authored dynamics/timbres stay intact.
      return row.map(e=>({...e,start:wrap(e.start-p.phase*p.period),volume:p.gain,
        value:p.gain===1?e.value:{...e.value,postgain:(e.value.postgain??1)*p.gain}})).sort((a,b)=>a.start-b.start);
    });
    return{rows,parts,coefficients};
  }
  function project(binding,puzzle,state,game){return projectParameters(binding,F.parameters(state).map(p=>({phase:p.phase,gain:F.gain(p)})),game);}
  function preview(binding,puzzle,state,game,point){
    if(!F.keys.includes(point.key)||!Number.isFinite(point.phase)||!Number.isFinite(point.gain)||point.gain<0||point.gain>2)throw new Error('Неверный прогноз коэффициента');
    const values=F.parameters(state).map(p=>({phase:p.phase,gain:F.gain(p)}));values[F.keys.indexOf(point.key)]={phase:point.phase,gain:point.gain};
    return projectParameters(binding,values,game);
  }
  const signature=rows=>rows.map(row=>rowKey(row)).join('||');
  function validate(binding,spec){
    return spec.projection===VERSION&&binding?.algorithm===VERSION&&binding.gridPresetStates===F.stateCount&&binding.gridSteps===8&&
      Array.isArray(binding.periods)&&binding.periods.length===spec.fragments&&binding.periods.every(p=>Number.isFinite(p)&&p>0&&p<=1&&Math.abs(1/p-Math.round(1/p))<1e-6);
  }
  async function prepare({puzzle,game,signal,onProgress=()=>{}}){
    const probe=Contract.probes(puzzle),binding={algorithm:VERSION,gridSteps:8,gridPresetStates:F.stateCount,periods:game.targetRows.map(period)},signatures=new Map();
    const target=signature(game.targetRows);let aliases=0;
    for(let i=0;i<probe.states.length;i++){
      if(signal?.aborted)throw new DOMException('Подготовка отменена','AbortError');
      const s=probe.states[i],key=signature(project(binding,puzzle,s.state,game).rows);signatures.set(s.id,key);
      if(!s.solved&&key===target)aliases++;
      if(i%24===0){onProgress({candidate:i+1,total:probe.states.length});await new Promise(r=>setTimeout(r,0));}
    }
    const silentMoves=probe.edges.filter(e=>signatures.get(e.before)===signatures.get(e.after)).length;
    if(aliases||silentMoves)throw new Error('Рифы не различают действия: '+aliases+' ложных целей, '+silentMoves+' неизменных ходов');
    return{...binding,diagnostics:{coverage:probe.coverage,stateSpace:'C8^6 × [0,2]^6',gridPresetStates:F.stateCount,continuousGain:true,states:probe.states.length,edges:probe.edges.length,
      distinctPatterns:new Set(signatures.values()).size,unsolvedGoalRhythmAliases:aliases,silentMoves,
      discrimination:new Set(signatures.values()).size===probe.states.length?'distinct-in-probes':'weak',
      independentRiffs:true,mutedPhaseEditsAllowed:true,signatureScope:'per-riff-events-not-summed-PCM',acousticAcceptance:'unverified',musicalAcceptance:'unverified'}};
  }
  return{VERSION,period,project,preview,prepare,validate};
});
