/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Picture/music partitioning belongs to this puzzle, not the score loader. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../../composition-contract.js'));else root.ScratchPartition=factory(root.MusicCompositionContract);})(globalThis,function(L){
  'use strict';
  const names={kick:'Бочка',hat:'Хэт',snare:'Рабочий барабан',clap:'Хлопок',openhat:'Открытый хэт',metal:'Перкуссия',noise:'Шумовой эффект',hook:'Главная тема',lead:'Лид',stab:'Аккорды',bass:'Бас',sub:'Саб-бас',riff:'Риф',pluck:'Плак',answer:'Ответ темы',acid:'Эйсид'};
  function layout(count){
    const columns=Math.ceil(Math.sqrt(count)),rows=Math.ceil(count/columns),total=columns*rows;
    // Evenly distribute the decorative fixed cells; every musical tile moves.
    const fixedCount=total-count,fixed=new Set(Array.from({length:fixedCount},(_,i)=>Math.floor((i+.5)*total/fixedCount)));
    return Object.freeze({columns,rows,movingCells:Array.from({length:total},(_,i)=>i).filter(i=>!fixed.has(i)),fixedCells:[...fixed]});
  }
  const stemKey=value=>JSON.stringify([value._phaseCubePart??value.s,value.s]);
  function build(S,song,{palette}){
    const stems=new Map();
    for(const h of L.attacks(song.pattern,0,song.bars)){
      const key=stemKey(h.value);if(!stems.has(key))stems.set(key,{key,part:h.value._phaseCubePart??h.value.s,sound:h.value.s,haps:[]});stems.get(key).haps.push(h);
    }
    const sources=[...stems.values()],count=sources.length,voices=[],basePatterns=[],parts=[];
    for(const [id,stem]of sources.entries()){
      let name=names[stem.part]||song.playerParts.find(p=>p.key===stem.part)?.name||String(stem.part);
      if(sources.filter(s=>s.part===stem.part).length>1)name=stem.sound==='sine'?'Саб-бас':name+' · '+stem.sound;
      // Cache native haps once: repeatedly querying the entire arranged score for
      // every instrument is prohibitively slow on phones. Preserve native whole
      // spans/values, including clip and duration semantics, without reparsing.
      const maxDuration=Math.max(...stem.haps.map(h=>Number(h.whole.end)-Number(h.whole.begin)));
      const pattern=new S.Pattern(state=>{
        const result=[],from=Number(state.span.begin),to=Number(state.span.end);
        for(let cycle=Math.floor((from-maxDuration)/song.bars);cycle<=Math.floor(to/song.bars);cycle++)for(const h of stem.haps){
          const offset=S.Fraction(cycle*song.bars),whole=new S.TimeSpan(h.whole.begin.add(offset),h.whole.end.add(offset)),part=whole.intersection(state.span);
          if(part)result.push(new S.Hap(whole,part,h.value));
        }
        return result;
      });
      const attacks=stem.haps.length;
      voices.push({id:stem.key,pieceId:id,name,part:stem.part,sound:stem.sound,color:palette[id%palette.length],attacks});
      parts.push({key:stem.key,name,pieces:1,attacks});basePatterns.push(pattern);
    }
    if(!count)throw Error('В композиции нет инструментальных партий');
    const targetRows=basePatterns.map((p,id)=>L.eventsOf(p,song.bars).map((e,i)=>({...e,id:id+':'+i,pitch:e.value.note==null?null:S.noteToMidi(e.value.note)})));
    return Object.freeze({count,periodBars:song.bars,loopBars:song.periodBars,voices,basePatterns,parts,targetRows,layout:layout(count),backing:S.silence});
  }
  return{build,layout};
});
