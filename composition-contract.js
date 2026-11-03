/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Pure music-composition/1 validation and native Strudel event analysis. No files, UI or puzzle rules. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MusicCompositionContract=factory();})(globalThis,function(){
  'use strict';
  const onset=h=>Number(h.whole.begin);
  const quantize=n=>Math.round(n*1e9)/1e9;
  const attacks=(p,from,to)=>p.queryArc(from,to).filter(h=>h.hasOnset()&&onset(h)>=from&&onset(h)<to);
  const eventsOf=(p,bars)=>attacks(p,0,bars).map(h=>({start:onset(h)/bars,duration:Number(h.duration)/bars,value:h.value}));
  function inspectModule(module){
    const meta=module?.metadata;
    if(meta?.schema!=='music-composition/1'||!Number.isInteger(meta.version)||meta.version<1||
      typeof meta.title!=='string'||!meta.title||typeof meta.style!=='string'||!meta.style||!Number.isFinite(meta.bpm)||meta.bpm<=0||
      typeof meta.download!=='string'||!meta.download||typeof module.default!=='function')throw new Error('Неверный модуль композиции');
    return module;
  }
  function signature(p,from,bars){
    return attacks(p,from,from+bars).map(h=>JSON.stringify([quantize(onset(h)-from),quantize(Number(h.duration)),h.value])) .sort();
  }
  function analyze(S,raw,id){
    if(raw?.schema!=='music-composition/1'||!Number.isInteger(raw.version)||raw.version<1)throw new Error('Неподдерживаемый контракт композиции');
    if(!raw||!raw.title||!raw.style||!Number.isFinite(raw.bpm)||raw.bpm<=0)throw new Error('Композиции нужны название, стиль и темп');
    if(raw.meter&&JSON.stringify(raw.meter)!=='[4,4]')throw new Error('Текущий транспорт поддерживает размер 4/4');
    if(raw.phaseOptions?.subdivisionsPerBeat&&(!Array.isArray(raw.phaseOptions.subdivisionsPerBeat)||!raw.phaseOptions.subdivisionsPerBeat.length||raw.phaseOptions.subdivisionsPerBeat.length>4||raw.phaseOptions.subdivisionsPerBeat.some(n=>!Number.isInteger(n)||n<1||n>8)))throw new Error('Неверная сетка фаз');
    if(!Number.isFinite(raw.periodBars)||raw.periodBars<=0)throw new Error('Нужен период игровых партий');
    if(!Array.isArray(raw.sections)||!raw.sections.length)throw new Error('Нужна форма композиции');
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
  return {inspectModule,analyze,attacks,signature,eventsOf};
});
