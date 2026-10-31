/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Symbolic discrimination of Strudel events, not an acoustic quality certificate. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./puzzle-contract.js'));else root.PuzzlePhases=factory(root.PuzzleContract);})(globalThis,function(Contract){
  'use strict';
  const VERSION='pose-phase/1',mod=(n,d)=>((n%d)+d)%d,round=n=>Math.round(n*1e8)/1e8;
  const valueKey=value=>JSON.stringify(Object.fromEntries(Object.entries(value).filter(([k])=>!k.startsWith('_phaseCube')).sort(([a],[b])=>a.localeCompare(b))));
  function analyzePattern(events,periodBeats){
    if(!events.length||!Number.isFinite(periodBeats)||periodBeats<=0)throw new Error('Нужен непустой периодический паттерн');
    const notes=events.map(e=>({at:round(e.start*periodBeats),duration:round(e.duration*periodBeats),velocity:e.value.velocity??1,value:valueKey(e.value)}));
    const starts=[...new Set(notes.map(e=>e.at))].sort((a,b)=>a-b);
    const signature=shift=>notes.map(e=>JSON.stringify([round(mod(e.at+shift,periodBeats)),e.duration,e.velocity])).sort().join('|');
    const target=signature(0),symmetries=[];
    // Any exact symmetry must carry the first attack to another attack.
    for(const at of starts){const shift=round(mod(at-starts[0],periodBeats));if(shift&&signature(shift)===target)symmetries.push(shift);}
    return {periodBeats,notes,attacks:notes.length,rhythmicSymmetriesBeats:symmetries};
  }
  function validateTable(table,spec){
    return table?.algorithm===VERSION&&Number.isInteger(table.gridSteps)&&table.gridSteps>=spec.poseIds.length&&
      Array.isArray(table.poseTicks)&&table.poseTicks.length===spec.poseIds.length&&new Set(table.poseTicks).size===table.poseTicks.length&&
      table.poseTicks.every(t=>Number.isInteger(t)&&t>=0&&t<table.gridSteps);
  }
  function shifts(table,placements,home,spec){
    const poseIndex=new Map(spec.poseIds.map((id,i)=>[id,i]));
    return placements.map(p=>({id:p.pieceId,poseId:p.poseId,ticks:mod(table.poseTicks[poseIndex.get(p.poseId)]-table.poseTicks[poseIndex.get(home[p.pieceId].poseId)],table.gridSteps),gridSteps:table.gridSteps}));
  }
  function signatures(table,placements,home,spec,analysis,voices){
    const phases=shifts(table,placements,home,spec),rhythm=new Map(),pitched=[];
    phases.forEach((p,id)=>{
      const a=analysis[id],shift=p.ticks*a.periodBeats/table.gridSteps;
      for(const e of a.notes){
        const at=round(mod(e.at+shift,a.periodBeats)),key=JSON.stringify([voices[id].part,at,e.duration,e.velocity]);
        const old=rhythm.get(key);if(old)old.count++;else rhythm.set(key,{count:1,at});
        pitched.push(JSON.stringify([voices[id].part,at,e.duration,e.value]));
      }
    });
    return {rhythm,key:[...rhythm].map(([k,v])=>k+':'+v.count).sort().join('|'),pitchKey:pitched.sort().join('|')};
  }
  function difference(a,b,periodBeats){
    let distance=0,total=0;const changed=[];
    for(const k of new Set([...a.keys(),...b.keys()])){
      const x=a.get(k),y=b.get(k),d=Math.abs((x?.count||0)-(y?.count||0));distance+=d;total+=(x?.count||0)+(y?.count||0);if(d)changed.push((x||y).at);
    }
    if(!changed.length)return {distance:0,gap:periodBeats};
    changed.sort((x,y)=>x-y);let gap=periodBeats-changed.at(-1)+changed[0];
    for(let i=1;i<changed.length;i++)gap=Math.max(gap,changed[i]-changed[i-1]);
    return {distance:distance/total,gap};
  }
  function assess(table,puzzle,game,analysis,probe){
    const home=Contract.project(puzzle,puzzle.model.initialState()),all=new Map(),rhythms=new Set(),pitches=new Set();
    let goalKey,aliases=0,goals=0;
    for(const s of probe.states){const sig=signatures(table,s.placements,home,puzzle.manifest,analysis,game.voices);all.set(s.id,sig);rhythms.add(sig.key);pitches.add(sig.pitchKey);if(s.solved){goalKey=sig.key;goals++;}}
    for(const s of probe.states)if(!s.solved&&all.get(s.id).key===goalKey)aliases++;
    let silentMoves=0,minMoveDistance=1,sum=0,maxGap=0;
    for(const edge of probe.edges){const d=difference(all.get(edge.before).rhythm,all.get(edge.after).rhythm,analysis[0].periodBeats);if(!d.distance)silentMoves++;minMoveDistance=Math.min(minMoveDistance,d.distance);sum+=d.distance;maxGap=Math.max(maxGap,d.gap);}
    const report={coverage:probe.coverage,states:probe.states.length,edges:probe.edges.length,equivalentGoals:goals,distinctRhythms:rhythms.size,distinctPitchedPatterns:pitches.size,unexpectedRhythmAliases:probe.states.length-Math.max(0,goals-1)-rhythms.size,unsolvedGoalRhythmAliases:aliases,silentMoves,minMoveDistance:round(minMoveDistance),meanMoveDistance:round(sum/probe.edges.length),maxRhythmicResponseGapBeats:round(maxGap)};
    report.discrimination=report.unexpectedRhythmAliases||silentMoves?'weak':'distinct-in-probes';
    report.response=report.maxRhythmicResponseGapBeats>2?'delayed':'within-two-beats-in-probes';
    return report;
  }
  const score=r=>[r.unsolvedGoalRhythmAliases,r.silentMoves,r.unexpectedRhythmAliases,r.maxRhythmicResponseGapBeats,-r.minMoveDistance,-r.meanMoveDistance];
  const better=(a,b)=>{const x=score(a),y=score(b);for(let i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]<y[i];}return false;};
  function candidates(spec,periodBeats,subdivisions){
    const tables=[],seen=new Set(),count=spec.poseIds.length;
    for(const division of subdivisions){
      const gridSteps=periodBeats*division;if(!Number.isInteger(gridSteps)||gridSteps<count)continue;
      const add=poseTicks=>{const k=gridSteps+':'+poseTicks;if(!seen.has(k)&&new Set(poseTicks).size===count){seen.add(k);tables.push({algorithm:VERSION,gridSteps,poseTicks});}};
      for(const step of [1,3,5,7])add(spec.poseIds.map((_,i)=>i*step%gridSteps));
      add(spec.poseIds.map((_,i)=>Math.floor(i*gridSteps/count)));
      let x=1730,order=Array.from({length:gridSteps},(_,i)=>i);
      for(let i=order.length-1;i>0;i--){x=(Math.imul(x,1664525)+1013904223)>>>0;const j=x%(i+1);[order[i],order[j]]=[order[j],order[i]];}
      add(order.slice(0,count));
    }
    return tables;
  }
  async function fitPhaseMap({puzzle,game,analysis,subdivisions=[2,4],signal,onProgress=()=>{}}){
    const started=performance.now(),probe=Contract.probes(puzzle),tables=candidates(puzzle.manifest,analysis[0].periodBeats,subdivisions);
    if(!tables.length)throw new Error('Музыкальная сетка не вмещает положения головоломки');
    let best;
    for(let i=0;i<tables.length;i++){
      if(signal?.aborted)throw new DOMException('Подготовка отменена','AbortError');
      const diagnostics=assess(tables[i],puzzle,game,analysis,probe);
      if(!best||better(diagnostics,best.diagnostics))best={...tables[i],diagnostics};
      onProgress({candidate:i+1,total:tables.length});
      // Yield between bounded candidates so the mobile loading UI remains responsive.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    best.diagnostics={...best.diagnostics,candidates:tables.length,elapsedMs:round(performance.now()-started),acousticAcceptance:'unverified'};
    return best;
  }
  function projectMusic(binding,puzzle,state){
    return shifts(binding,Contract.project(puzzle,state),Contract.project(puzzle,puzzle.model.initialState()),puzzle.manifest)
      .map(p=>({...p,offset:p.ticks/binding.gridSteps,offsetBeats:p.ticks*binding.periodBeats/binding.gridSteps}));
  }
  return {VERSION,analyzePattern,validateTable,fitPhaseMap,projectMusic,assess};
});
