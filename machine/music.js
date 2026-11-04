/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Native Strudel excerpts -> six physical modules. Scores and their sound patches stay untouched. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../composition-contract.js'));else root.MachineMusic=factory(root.MusicCompositionContract);})(globalThis,function(Composition){
  'use strict';
  const ROLES=Object.freeze([
    {key:'pulse',name:'Ударник',kind:'hammer',color:'#f4b860',description:'Бочка и опорный пульс'},
    {key:'bass',name:'Басовые меха',kind:'bellows',color:'#ee7b67',description:'Басовая линия'},
    {key:'percussion',name:'Перезвон',kind:'chimes',color:'#72c7bb',description:'Хэты, хлопки и перкуссия'},
    {key:'melody',name:'Лента мелодии',kind:'tape',color:'#85b8e7',description:'Главная тема и мелодические ответы'},
    {key:'texture',name:'Резонатор',kind:'comb',color:'#bd96dd',description:'Рифы, плаки и аккорды'},
    {key:'air',name:'Воздушная камера',kind:'prism',color:'#bed388',description:'Шумы, атмосфера и протяжённые созвучия'}
  ]);
  const mod=(n,p)=>((n%p)+p)%p;
  function roleOf(value){
    const name=String(value._phaseCubePart??value.s??'').toLowerCase();
    if(/kick|бочка|^bd$|pulse|floor/.test(name))return'pulse';
    if(/bass|sub|бас/.test(name))return'bass';
    if(/noise|air|pad|atmos|созвуч|шум/.test(name))return'air';
    if(/hat|snare|clap|metal|perc|drum|tom|щелч|том|барабан/.test(name))return'percussion';
    if(/hook|lead|piano|melody|answer|reply|пианино|мелод|тема/.test(name))return'melody';
    return'texture';
  }
  function loopHaps(S,haps,from,bars){
    const offset=S.Fraction(from),length=S.Fraction(bars);
    const local=haps.map(h=>({begin:h.whole.begin.sub(offset),end:h.whole.end.sub(offset),value:h.value}));
    const maxSpan=Math.max(0,...local.map(h=>Number(h.end.sub(h.begin))));
    // Keep each native whole span, including clip/duration properties on its
    // value. Rebuilding from playback duration would apply clip a second time.
    return new S.Pattern(state=>{
      const begin=Number(state.span.begin),end=Number(state.span.end),result=[];
      for(let cycle=Math.floor((begin-maxSpan)/bars);cycle<=Math.floor(end/bars);cycle++){
        const shift=length.mul(cycle);
        for(const h of local){const whole=new S.TimeSpan(h.begin.add(shift),h.end.add(shift)),part=whole.intersection(state.span);if(part)result.push(new S.Hap(whole,part,h.value));}
      }
      return result;
    });
  }
  const signature=(haps,from)=>haps.map(h=>JSON.stringify([Math.round((Number(h.whole.begin)-from)*1e9)/1e9,Math.round(Number(h.duration)*1e9)/1e9,h.value])).sort().join('|');
  function events(S,pattern,bars){
    return Composition.attacks(pattern,0,bars).map((h,i)=>({id:i,start:Number(h.whole.begin)/bars,duration:Number(h.duration)/bars,value:h.value,pitch:h.value.note==null?null:(typeof h.value.note==='number'?h.value.note:S.noteToMidi(h.value.note))}));
  }
  function prepare(S,song){
    if(!song?.pattern?.queryArc||!Number.isFinite(song.periodBars)||song.periodBars<=0)throw Error('Нужна проверенная композиция music-composition/1');
    const bars=song.periodBars,all=Composition.attacks(song.pattern,0,song.bars),windows=[];
    for(let from=0;from<song.bars;from+=bars){
      const local=all.filter(h=>Number(h.whole.begin)>=from&&Number(h.whole.begin)<from+bars),groups=new Map(ROLES.map(r=>[r.key,[]]));
      for(const h of local)groups.get(roleOf(h.value)).push(h);
      const coverage=[...groups.values()].filter(h=>h.length).length;
      // A well-populated early passage introduces all available controls; it
      // is not a quality score and does not evaluate the player's creation.
      windows.push({from,groups,coverage,count:local.length});
    }
    const base=[...windows].sort((a,b)=>b.coverage-a.coverage||Math.abs(a.from-8)-Math.abs(b.from-8))[0];
    const ordered=[base,...windows.filter(w=>w!==base)];
    const modules=ROLES.map(role=>{
      const seen=new Set(),variants=[];
      for(const w of ordered){
        const haps=w.groups.get(role.key);if(!haps.length)continue;
        const sig=signature(haps,w.from);if(seen.has(sig))continue;seen.add(sig);
        const pattern=loopHaps(S,haps,w.from,bars),section=song.sections.find(s=>w.from>=s.from&&w.from<s.to);
        variants.push({id:role.key+'-'+w.from,label:section?.name||'Фраза '+(variants.length+1),sourceStart:w.from,pattern,events:events(S,pattern,bars),eventCount:haps.length});
      }
      const sources=[...new Set(all.filter(h=>roleOf(h.value)===role.key).map(h=>String(h.value._phaseCubePart??h.value.s)))];
      return Object.freeze({...role,available:variants.length>0,variants,sources,baseVariant:variants.findIndex(v=>v.sourceStart===base.from)});
    });
    return Object.freeze({schema:'mechanism-music/1',song,periodBars:bars,baseFrom:base.from,modules,sourceAttackCount:all.length});
  }
  class Engine{
    constructor(S,prepared){this.S=S;this.prepared=prepared;this.periodBars=prepared.periodBars;this.cache=new Map();}
    project(state){
      const key=JSON.stringify(state.parts);if(this.cache.has(key))return this.cache.get(key);
      const patterns=[],rows=[];
      for(const m of this.prepared.modules){
        const p=state.parts.find(p=>p.key===m.key),v=m.variants[p?.variant]||m.variants[0];
        if(!p?.installed||!v||p.gain===0){patterns.push(this.S.silence);rows.push([]);continue;}
        // Eight phase placements are measured in ONE BAR (0..7/8). Returning
        // the selector to zero restores the source; a bar is not generally
        // the period of the complete multi-bar harmonic progression.
        let pattern=p.phase===0?v.pattern:v.pattern.late(p.phase);
        if(p.gain!==1)pattern=pattern.withValue(value=>({...value,postgain:(value.postgain??1)*p.gain}));
        patterns.push(pattern);
        rows.push(v.events.map(e=>({...e,id:m.key+':'+e.id,start:mod(e.start+p.phase/this.periodBars,1),gain:p.gain,volume:p.gain,value:p.gain===1?e.value:{...e.value,postgain:(e.value.postgain??1)*p.gain}})).sort((a,b)=>a.start-b.start));
      }
      const result={patterns,rows,pattern:patterns.length?this.S.stack(...patterns):this.S.silence};
      this.cache.set(key,result);if(this.cache.size>64)this.cache.delete(this.cache.keys().next().value);return result;
    }
    pattern(state){return this.project(state).pattern;}
    rows(state){return this.project(state).rows;}
    diagnostics(state){return{schema:'mechanism-music/1',periodBars:this.periodBars,phaseUnit:'bar',baseFrom:this.prepared.baseFrom,installed:state.parts.filter(p=>p.installed).map(p=>p.key),attacks:this.rows(state).map(r=>r.length),allSources:this.prepared.modules.flatMap(m=>m.sources),uncontrolledBacking:false};}
  }
  return Object.freeze({ROLES,roleOf,loopHaps,prepare,Engine});
});
