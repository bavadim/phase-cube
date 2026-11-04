/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Explicit sources from Turkish Circuit. No role inference, hidden backing or new note parser. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../composition-contract.js'));else root.DiscMusic=factory(root.MusicCompositionContract);})(globalThis,function(Composition){
  'use strict';
  const SOURCES=Object.freeze([
    {key:'kick',name:'Бочка',color:'#efb96e',kind:'drum',description:'Один ударный инструмент',sources:['kick']},
    {key:'bass',name:'Бас',color:'#79c7b8',kind:'bass',description:'Одна басовая партия',sources:['bass']},
    {key:'hook',name:'Мелодия',color:'#b9a0ed',kind:'piano',description:'Партия фортепиано',sources:['hook']}
  ]);
  // Source indices are zero-based bars. Every excerpt covers the same four-bar
  // Am/F/Dm/E progression; choosing one does not include any other lead/stem.
  const WINDOWS=Object.freeze([{from:8,label:'Основная тема'},{from:24,label:'Стеклянная фраза'},{from:60,label:'Круговой мост'},{from:0,label:'Намёк на тему'}]);
  const wrap=n=>((n%1)+1)%1;
  function loopHaps(S,haps,from,bars){
    const offset=S.Fraction(from),period=S.Fraction(bars),local=haps.map(h=>({begin:h.whole.begin.sub(offset),end:h.whole.end.sub(offset),value:h.value}));
    const maxSpan=Math.max(0,...local.map(h=>Number(h.end.sub(h.begin))));
    // Preserve native whole spans and values. The native duration getter applies
    // clip/duration exactly once, including notes continuing across the seam.
    return new S.Pattern(state=>{
      const result=[],begin=Number(state.span.begin),end=Number(state.span.end);
      for(let cycle=Math.floor((begin-maxSpan)/bars);cycle<=Math.floor(end/bars);cycle++){
        const shift=period.mul(cycle);
        for(const h of local){const whole=new S.TimeSpan(h.begin.add(shift),h.end.add(shift)),part=whole.intersection(state.span);if(part)result.push(new S.Hap(whole,part,h.value));}
      }
      return result;
    });
  }
  const signature=(haps,from)=>Array.from(haps,h=>JSON.stringify([Math.round((Number(h.whole.begin)-from)*1e9)/1e9,Math.round(Number(h.duration)*1e9)/1e9,h.value])).sort().join('|');
  function events(S,pattern,bars,key){
    return Array.from(Composition.attacks(pattern,0,bars),(h,i)=>({id:key+':'+i,start:Number(h.whole.begin)/bars,duration:Number(h.duration)/bars,value:h.value,pitch:h.value.note==null?null:(typeof h.value.note==='number'?h.value.note:S.noteToMidi(h.value.note))}));
  }
  function prepare(S,song){
    if(song?.id!=='turkish-circuit'||song.periodBars!==4||!song.pattern?.queryArc)throw Error('Этот PoC использует три партии «Моцарта на конвейере», цикл — четыре такта');
    const periodBars=song.periodBars,all=Composition.attacks(song.pattern,0,song.bars);
    const modules=SOURCES.map(source=>{
      const variants=[],seen=new Set();
      for(const window of WINDOWS){
        const haps=all.filter(h=>h.value._phaseCubePart===source.key&&Number(h.whole.begin)>=window.from&&Number(h.whole.begin)<window.from+periodBars);
        if(!haps.length)continue;
        const sig=signature(haps,window.from);if(seen.has(sig))continue;seen.add(sig);
        const pattern=loopHaps(S,haps,window.from,periodBars);
        variants.push(Object.freeze({id:source.key+'-'+window.from,label:source.key==='hook'?window.label:source.key==='kick'?'Четыре удара':'Басовая линия',sourceStart:window.from,sourceEnd:window.from+periodBars,pattern,events:events(S,pattern,periodBars,source.key),eventCount:haps.length}));
      }
      if(!variants.length||variants[0].sourceStart!==WINDOWS[0].from)throw Error('Нет исходной партии в общем окне: '+source.key);
      return Object.freeze({...source,available:true,variants});
    });
    return Object.freeze({schema:'disc-music/1',song,periodBars,phaseSteps:periodBars*8,baseFrom:WINDOWS[0].from,modules});
  }
  class Engine{
    constructor(S,prepared){this.S=S;this.prepared=prepared;this.periodBars=prepared.periodBars;this.cache=new Map();}
    project(state){
      const key=JSON.stringify(state.parts);if(this.cache.has(key))return this.cache.get(key);
      const patterns=[],rows=[];
      for(const m of this.prepared.modules){
        const p=state.parts.find(p=>p.key===m.key),variant=m.variants[p?.variant]||m.variants[0];
        if(!p)throw Error('В состоянии отсутствует диск '+m.key);
        const audible=p.installed&&p.gain>0,volume=audible?p.gain:0;
        // phase is a fraction of the COMPLETE phrase, not of one bar. Thus
        // adding one revolution is musically the identity for every source.
        let pattern=p.phase===0?variant.pattern:variant.pattern.late(p.phase*this.periodBars);
        if(volume!==1)pattern=pattern.withValue(value=>({...value,postgain:(value.postgain??1)*volume}));
        patterns.push(audible?pattern:this.S.silence);
        // A detached/muted disc retains its geometry. Audible only describes
        // output routing, so the renderer never needs to invent missing notes.
        rows.push(variant.events.map(e=>({...e,start:wrap(e.start+p.phase),gain:volume,volume,audible,configuredGain:p.gain,value:volume===1?e.value:{...e.value,postgain:(e.value.postgain??1)*volume}})).sort((a,b)=>a.start-b.start));
      }
      const result={patterns,rows,pattern:this.S.stack(...patterns)};this.cache.set(key,result);if(this.cache.size>64)this.cache.delete(this.cache.keys().next().value);return result;
    }
    pattern(state){return this.project(state).pattern;}
    rows(state){return this.project(state).rows;}
    diagnostics(state){return{schema:'disc-music/1',periodBars:this.periodBars,phaseSteps:this.prepared.phaseSteps,phaseUnit:'complete-cycle',baseFrom:this.prepared.baseFrom,sources:this.prepared.modules.map(m=>m.key),installed:state.parts.filter(p=>p.installed).map(p=>p.key),attacks:this.rows(state).map(row=>row.filter(e=>e.audible).length),uncontrolledBacking:false};}
  }
  return Object.freeze({SOURCES,WINDOWS,loopHaps,prepare,Engine});
});
