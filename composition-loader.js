/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Load ordinary ES modules; Strudel remains the only pattern interpreter. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PhaseCubeLibrary=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Catalog contains paths only. Names, tempo, instruments and form belong to each score.
  const files=['turkish-circuit','steel-shift','elise-after-hours'];
  const mod=(x,n)=>((x%n)+n)%n;
  const onset=h=>Number(h.whole.begin);
  const quantize=n=>Math.round(n*1e9)/1e9;
  const attacks=(p,from,to)=>p.queryArc(from,to).filter(h=>h.hasOnset()&&onset(h)>=from&&onset(h)<to);
  const eventsOf=(p,bars)=>attacks(p,0,bars).map(h=>({start:onset(h)/bars,duration:Number(h.duration)/bars,value:h.value}));
  function signature(p,from,bars){
    return attacks(p,from,from+bars).map(h=>JSON.stringify([quantize(onset(h)-from),quantize(Number(h.duration)),h.value])) .sort();
  }
  function analyze(S,raw,id,palette){
    if(!raw||!raw.title||!raw.style||!Number.isFinite(raw.bpm)||raw.bpm<=0)throw new Error('Композиции нужны название, стиль и темп');
    if(!Number.isFinite(raw.periodBars)||raw.periodBars<=0)throw new Error('Нужен период игровых партий');
    let bars=0;
    const sections=raw.sections.map(section=>{
      if(!section.name||!Number.isFinite(section.bars)||section.bars<=0)throw new Error('Неверная секция композиции');
      const result={name:section.name,bars:section.bars,from:bars,to:bars+section.bars};bars=result.to;return result;
    });
    if(!bars||bars%raw.periodBars)throw new Error('Длина песни должна содержать целое число игровых циклов');
    if(!Array.isArray(raw.playerParts)||!raw.playerParts.length||raw.playerParts.length>8)throw new Error('Нужно от одной до восьми партий игрока');
    const assigned=raw.playerParts.reduce((sum,part)=>sum+(part.pieces||0),0);
    const automatic=raw.playerParts.filter(part=>part.pieces==null).length;
    const available=8-assigned;
    if(available<automatic||(!automatic&&available!==0))throw new Error('Неверное распределение восьми деталей');
    let automaticIndex=0;
    const parts=raw.playerParts.map(part=>({...part,pieces:part.pieces??(Math.floor(available/automatic)+(automaticIndex++<available%automatic?1:0))}));
    const voices=[],basePatterns=[],partStats=[];
    const keys=new Set();
    for(const part of parts){
      if(!part.key||keys.has(part.key)||!part.name||!Number.isInteger(part.pieces)||part.pieces<1||!part.pattern?.queryArc)throw new Error('Неверная игровая партия');
      keys.add(part.key);
      const local=attacks(part.pattern,0,raw.periodBars);
      if(!local.length)throw new Error('Пустая игровая партия: '+part.name);
      const starts=[...new Set(local.map(h=>quantize(onset(h))))].sort((a,b)=>a-b);
      const rank=new Map(starts.map((time,i)=>[time,i]));
      // Verify all authored repetitions, rather than estimating a period from arbitrary JS.
      const reference=JSON.stringify(signature(part.pattern,0,raw.periodBars));
      for(let from=raw.periodBars;from<=bars;from+=raw.periodBars){
        if(JSON.stringify(signature(part.pattern,from,raw.periodBars))!==reference)throw new Error('Изменяется игровая партия: '+part.name);
      }
      partStats.push({key:part.key,name:part.name,attacks:local.length,pieces:part.pieces});
      for(let piece=0;piece<part.pieces;piece++){
        const index=voices.length;
        const p=part.pattern.filterHaps(h=>{
          const at=quantize(mod(onset(h),raw.periodBars));
          return (part.split==='time'?Math.min(part.pieces-1,Math.floor(at/raw.periodBars*part.pieces)):rank.get(at)%part.pieces)===piece;
        }).withValue(value=>({...value,_phaseCubeVoice:index,_phaseCubePart:part.key}));
        const events=attacks(p,0,raw.periodBars);
        if(!events.length)throw new Error('Пустая деталь кубика: '+part.name);
        voices.push({name:`${part.name} · ${piece+1}/${part.pieces}`,part:part.key,color:palette[index],attacks:events.length});
        basePatterns.push(p);
      }
    }
    if(voices.length!==8)throw new Error('Композиция должна давать ровно восемь деталей кубика');
    if(!raw.backing?.queryArc)throw new Error('Отсутствует Strudel-фон');
    const pattern=S.stack(raw.backing,...basePatterns);
    const events=attacks(pattern,0,bars);
    for(const h of events){
      if(!Number.isFinite(onset(h))||!Number.isFinite(Number(h.duration))||Number(h.duration)<=0)throw new Error('Неверная длительность ноты');
    }
    if(JSON.stringify(signature(raw.backing,0,raw.periodBars))!==JSON.stringify(signature(raw.backing,bars,raw.periodBars)))throw new Error('Фон не зациклен по длине формы');
    const sounds=[...new Set(events.map(h=>h.value.s))].sort();
    const instruments=new Set(events.map(h=>h.value._phaseCubePart));
    const game=Object.freeze({periodBars:raw.periodBars,voices,basePatterns,targetRows:basePatterns.map(p=>eventsOf(p,raw.periodBars))});
    return Object.freeze({...raw,id,bars,sections,game,pattern,
      stats:Object.freeze({bars,bpm:raw.bpm,seconds:bars*240/raw.bpm,periodBars:raw.periodBars,periodSeconds:raw.periodBars*240/raw.bpm,
        attacks:events.length,instruments:instruments.size,sounds,parts:partStats,sections:sections.length,
        maxGateBars:Math.max(...events.map(h=>Number(h.duration)))})});
  }
  class Loader{
    constructor(S,{palette,baseURL}={}){this.S=S;this.palette=palette;this.baseURL=baseURL||new URL('./',document.baseURI);this.cache=new Map();this.modules=new Map();}
    async module(id){
      if(!files.includes(id))throw new Error('Неизвестная композиция: '+id);
      if(!this.modules.has(id)){
        const promise=globalThis.PhaseCubeEmbeddedCompositions?.[id]||import(new URL(`compositions/${id}.strudel.mjs`,this.baseURL).href);
        this.modules.set(id,Promise.resolve(promise));
      }
      return this.modules.get(id);
    }
    async load(id){
      if(!files.includes(id))throw new Error('Неизвестная композиция: '+id);
      if(!this.cache.has(id)){
        const pending=(async()=>{
          const module=await this.module(id);
          return analyze(this.S,await module.default(this.S),id,this.palette);
        })();
        this.cache.set(id,pending);pending.catch(()=>this.cache.delete(id));
      }
      return this.cache.get(id);
    }
    async catalog(){return Promise.all(files.map(async id=>({id,...(await this.module(id)).metadata})));}
  }
  return {Loader,analyze,files,attacks,signature,eventsOf};
});
