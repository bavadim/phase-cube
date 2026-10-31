/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./composition-loader.js'),require('./controls/pattern-pieces.js'),require('./puzzle-contract.js'),require('./music-projection.js'));else root.PuzzleSessionLoader=factory(root.PhaseCubeLibrary,root.PuzzleParts,root.PuzzleContract,root.PuzzleProjection);})(globalThis,function(L,Parts,Contract,Projection){
  'use strict';
  const CACHE='music-puzzle-bindings/3';
  const aborted=signal=>{if(signal?.aborted)throw new DOMException('Подготовка отменена','AbortError');};
  async function fingerprint(value){
    const bytes=new TextEncoder().encode(JSON.stringify(value));
    if(!globalThis.crypto?.subtle)return null;
    const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  }
  class Loader{
    constructor(S,{palette,registry,library,preload=async()=>{},storage}={}){
      Object.assign(this,{S,palette,registry,preload});this.library=library||new L.Loader(S);this.bindings=new Map();
      try{this.storage=storage===undefined?globalThis.localStorage:storage;}catch{this.storage=null;}
    }
    read(key,spec){
      if(!key)return null;
      try{const entry=JSON.parse(this.storage?.getItem(CACHE)||'[]').find(e=>e.key===key);if(entry&&Projection.validate(entry.binding,spec))return entry.binding;}catch{}
      return null;
    }
    write(key,binding){
      if(!key)return;
      try{const entries=JSON.parse(this.storage?.getItem(CACHE)||'[]').filter(e=>e.key!==key);entries.push({key,binding});this.storage?.setItem(CACHE,JSON.stringify(entries.slice(-12)));}catch{}
    }
    async prepareSession({songId,puzzleId,signal,onProgress}={}){
      aborted(signal);
      const module=this.registry.get(puzzleId),puzzle=Contract.inspect(module),song=await this.library.load(songId);aborted(signal);
      const game=Parts.build(this.S,song,{count:puzzle.manifest.fragments,palette:this.palette});
      const analysis=game.targetRows.map(row=>Projection.analyzePattern(row,song.timing.periodBeats));
      const subdivisions=song.phaseOptions?.subdivisionsPerBeat||[2,4];
      const home=puzzle.manifest.projection==='pose-phase/1'?Contract.project(puzzle,puzzle.model.initialState()):puzzle.model.initialState();
      const input={algorithm:Projection.version(puzzle.manifest),spec:puzzle.manifest,home,reference:puzzle.manifest.projection!=='pose-phase/1'?game.targetRows.map(row=>row.map(({start,duration,value})=>({start,duration,value}))):undefined,parts:game.voices.map(v=>v.part),analysis,subdivisions};
      const hash=await fingerprint(input),key=hash||JSON.stringify(input);aborted(signal);
      let binding=this.bindings.get(key)||this.read(hash,puzzle.manifest),cache=binding?'hit':'miss';
      if(binding&&binding.periodBeats!==song.timing.periodBeats){binding=null;cache='miss';}
      if(!binding){
        const prepared=await Promise.all([Projection.prepare({puzzle,game,analysis,subdivisions,signal,onProgress}),this.preload(this.S,song.pattern,song.bars)]);
        binding={...prepared[0],periodBeats:song.timing.periodBeats,fingerprint:hash};aborted(signal);
        this.write(hash,binding);
      }else await this.preload(this.S,song.pattern,song.bars);
      aborted(signal);
      binding=Object.freeze({...binding,...(binding.poseTicks?{poseTicks:Object.freeze([...binding.poseTicks])}:{}),diagnostics:Object.freeze({...binding.diagnostics})});this.bindings.set(key,binding);
      return {composition:song,module,model:puzzle.model,puzzle,fragments:game,binding,analysis,
        stats:{composition:song.stats,binding:{pieces:game.count,gridSteps:binding.gridSteps,periodBeats:binding.periodBeats}},diagnostics:{...binding.diagnostics,cache}};
    }
  }
  return {Loader,fingerprint};
});
