/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Common result contract; each puzzle family keeps its own musical action. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./composition-loader.js'),require('./phase-map.js'),require('./puzzles/fourier/binding.js'));else root.PuzzleProjection=factory(root.PhaseCubeLibrary,root.PuzzlePhases,root.FourierBinding);})(globalThis,function(L,Phases,Fourier){
  'use strict';
  const spectral=spec=>spec.schema==='music-puzzle/2'&&spec.projection===Fourier.VERSION;
  const version=spec=>spectral(spec)?Fourier.VERSION:Phases.VERSION;
  const validate=(binding,spec)=>spectral(spec)?Fourier.validate(binding,spec):Phases.validateTable(binding,spec);
  const prepare=args=>spectral(args.puzzle.manifest)?Fourier.prepare(args):Phases.fitPhaseMap(args);
  function nativeEvents(S,events,bars){
    const fraction=x=>S.Fraction([Math.round(x*1e9),1e9]);
    const source=events.map(e=>({at:fraction(e.start*bars),duration:fraction(typeof e.value.duration!=='number'&&typeof e.value.clip==='number'?e.duration*bars/e.value.clip:e.duration*bars),value:e.value}));
    const maxDuration=Math.max(...source.map(e=>Number(e.duration)));
    return new S.Pattern(state=>{
      const begin=Number(state.span.begin),end=Number(state.span.end),haps=[];
      for(let cycle=Math.floor((begin-maxDuration)/bars);cycle<=Math.floor(end/bars);cycle++)for(const event of source){
        const at=event.at.add(fraction(cycle*bars)),whole=new S.TimeSpan(at,at.add(event.duration)),part=whole.intersection(state.span);
        if(part)haps.push(new S.Hap(whole,part,event.value));
      }
      return haps;
    });
  }
  function project(S,prepared,state){
    const {phaseMap:binding,puzzle,fragments:game}=prepared;
    if(spectral(puzzle.manifest)){
      const result=Fourier.project(binding,puzzle,state,game);
      const patterns=puzzle.model.solved(state)?game.basePatterns:result.rows.map(row=>nativeEvents(S,row,game.periodBars));
      return{schema:'music-projection/1',...result,patterns};
    }
    const parts=Phases.projectMusic(binding,puzzle,state).map(p=>({...p,kind:'pose-shift/1',aligned:p.ticks===0}));
    const patterns=game.basePatterns.map((p,id)=>p.late(S.Fraction([parts[id].ticks*game.periodBars,binding.gridSteps])));
    const rows=game.targetRows.map((row,id)=>row.map(e=>({...e,start:((e.start+parts[id].ticks/binding.gridSteps)%1+1)%1})));
    return{schema:'music-projection/1',parts,patterns,rows};
  }
  return{version,validate,prepare,project,nativeEvents,analyzePattern:Phases.analyzePattern};
});
