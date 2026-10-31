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
    if(raw?.schema!=='music-composition/1'||!Number.isInteger(raw.version)||raw.version<1)throw new Error('Неподдерживаемый контракт композиции');
    if(!raw||!raw.title||!raw.style||!Number.isFinite(raw.bpm)||raw.bpm<=0)throw new Error('Композиции нужны название, стиль и темп');
    if(raw.meter&&JSON.stringify(raw.meter)!=='[4,4]')throw new Error('Текущий транспорт поддерживает размер 4/4');
    if(raw.phaseOptions?.subdivisionsPerBeat&&(!Array.isArray(raw.phaseOptions.subdivisionsPerBeat)||!raw.phaseOptions.subdivisionsPerBeat.length||raw.phaseOptions.subdivisionsPerBeat.length>4||raw.phaseOptions.subdivisionsPerBeat.some(n=>!Number.isInteger(n)||n<1||n>8)))throw new Error('Неверная сетка фаз');
    if(!Number.isFinite(raw.periodBars)||raw.periodBars<=0)throw new Error('Нужен период игровых партий');
    let bars=0;
    const sections=raw.sections.map(section=>{
      if(!section.name||!Number.isFinite(section.bars)||section.bars<=0)throw new Error('Неверная секция композиции');
      const result={...section,from:bars,to:bars+section.bars};bars=result.to;return result;
    });
    if(!bars||bars%raw.periodBars)throw new Error('Длина песни должна содержать целое число игровых циклов');
    if(!Array.isArray(raw.playerParts)||!raw.playerParts.length)throw new Error('Нужно указать список игровых партий');
    const keys=new Set(),partStats=[],patterns=[];
    for(const part of raw.playerParts){
      if(['weight','pieces'].some(k=>part[k]!==undefined&&(!Number.isFinite(part[k])||part[k]<=0))||(part.groups&&(!Array.isArray(part.groups)||part.groups.some(g=>!g||!Array.isArray(g.onsetsBeats)||g.onsetsBeats.some(at=>!Number.isFinite(at)||at<0||at>=raw.periodBars*4)))))throw new Error('Неверные ограничения разбиения партии');
      if(!part.key||keys.has(part.key)||!part.name||!part.pattern?.queryArc)throw new Error('Неверная игровая партия');
      keys.add(part.key);
      const local=attacks(part.pattern,0,raw.periodBars);
      if(!local.length)throw new Error('Пустая игровая партия: '+part.name);
      const reference=JSON.stringify(signature(part.pattern,0,raw.periodBars));
      for(let from=raw.periodBars;from<=bars;from+=raw.periodBars){
        if(JSON.stringify(signature(part.pattern,from,raw.periodBars))!==reference)throw new Error('Изменяется игровая партия: '+part.name);
      }
      partStats.push({key:part.key,name:part.name,attacks:local.length});
      patterns.push(part.pattern.withValue(v=>({...v,_phaseCubePart:part.key})));
    }
    if(!raw.backing?.queryArc)throw new Error('Отсутствует Strudel-фон');
    const pattern=S.stack(raw.backing,...patterns),events=attacks(pattern,0,bars);
    for(const h of events)if(!Number.isFinite(onset(h))||!Number.isFinite(Number(h.duration))||Number(h.duration)<=0)throw new Error('Неверная длительность ноты');
    if(JSON.stringify(signature(raw.backing,0,raw.periodBars))!==JSON.stringify(signature(raw.backing,bars,raw.periodBars)))throw new Error('Фон не зациклен по длине формы');
    const sounds=[...new Set(events.map(h=>h.value.s))].sort(),instruments=new Set(events.map(h=>h.value._phaseCubePart));
    return Object.freeze({...raw,id,bars,sections,pattern,timing:Object.freeze({bpm:raw.bpm,meter:[4,4],periodBeats:raw.periodBars*4,songBeats:bars*4}),
      stats:Object.freeze({bars,bpm:raw.bpm,seconds:bars*240/raw.bpm,periodBars:raw.periodBars,periodSeconds:raw.periodBars*240/raw.bpm,
        attacks:events.length,instruments:instruments.size,sounds,parts:partStats,sections:sections.length,maxGateBars:Math.max(...events.map(h=>Number(h.duration)))})});
  }
  class Loader{
    constructor(S,{palette,baseURL}={}){this.S=S;this.palette=palette;this.baseURL=baseURL||new URL('./',document.baseURI);this.cache=new Map();this.modules=new Map();}
    async module(id){
      if(!files.includes(id))throw new Error('Неизвестная композиция: '+id);
      if(!this.modules.has(id)){
        const url=new URL(`compositions/${id}.strudel.mjs`,this.baseURL);url.searchParams.set('v','contracts1');
        const promise=globalThis.PhaseCubeEmbeddedCompositions?.[id]||import(url.href);
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
