/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../composition-loader.js'));else root.PuzzleParts=factory(root.PhaseCubeLibrary);})(globalThis,function(L){
  'use strict';
  // This partitions native Strudel events; it never rewrites notes or interprets mini-notation.
  function build(S,song,{count,palette}){
    const source=song.playerParts;
    if(!Number.isInteger(count)||count<source.length)throw new Error('Недостаточно деталей для партий композиции');
    const units=source.map(part=>{
      const starts=[...new Set(L.attacks(part.pattern,0,song.periodBars).map(h=>Math.round(Number(h.whole.begin)*1e9)/1e9))].sort((a,b)=>a-b);
      if(!part.groups)return starts.map(at=>[at]);
      if(part.split==='time')throw new Error('Группировка фраз несовместима с split:time');
      const groups=part.groups.map(g=>g.onsetsBeats.map(at=>Math.round(at/4*1e9)/1e9)),flat=groups.flat();
      if(groups.some(g=>!g.length)||flat.length!==starts.length||new Set(flat).size!==flat.length||flat.some(at=>!starts.includes(at)))throw new Error('Группы должны покрывать все атаки ровно один раз: '+part.name);
      return groups;
    });
    if(units.reduce((n,u)=>n+u.length,0)<count)throw new Error('Недостаточно независимых фраз для деталей головоломки');
    const counts=source.map(()=>1);
    {
      const weights=source.map(p=>p.weight||p.pieces||1),sum=weights.reduce((a,b)=>a+b,0),remaining=count-source.length;
      const quotas=weights.map(w=>remaining*w/sum);
      quotas.forEach((q,i)=>counts[i]+=Math.min(units[i].length-1,Math.floor(q)));
      while(counts.reduce((a,b)=>a+b,0)<count){
        const order=quotas.map((q,i)=>({i,deficit:1+q-counts[i]})).filter(e=>counts[e.i]<units[e.i].length).sort((a,b)=>b.deficit-a.deficit||a.i-b.i);
        if(!order.length)throw new Error('Недостаточно непустых фрагментов');counts[order[0].i]++;
      }
    }
    const voices=[],basePatterns=[],parts=[];
    source.forEach((part,partIndex)=>{
      const pieces=counts[partIndex],local=L.attacks(part.pattern,0,song.periodBars);
      const rank=new Map(units[partIndex].flatMap((group,i)=>group.map(at=>[at,i])));
      parts.push({key:part.key,name:part.name,pieces,attacks:local.length});
      for(let piece=0;piece<pieces;piece++){
        const index=voices.length;
        const p=part.pattern.filterHaps(h=>{
          const at=Math.round((((Number(h.whole.begin)%song.periodBars)+song.periodBars)%song.periodBars)*1e9)/1e9;
          return (part.split==='time'?Math.min(pieces-1,Math.floor(at/song.periodBars*pieces)):rank.get(at)%pieces)===piece;
        }).withValue(v=>({...v,_phaseCubeVoice:index,_phaseCubePart:part.key}));
        const events=L.attacks(p,0,song.periodBars);
        if(!events.length)throw new Error('Пустая музыкальная деталь: '+part.name);
        voices.push({id:part.key+':'+piece,pieceId:index,name:part.name+' · '+(piece+1)+'/'+pieces,part:part.key,color:palette[index%palette.length],attacks:events.length});basePatterns.push(p);
      }
    });
    // Visual identities survive phase wrapping and sorting, without adding
    // metadata to the native Strudel values sent to the audio engine.
    const targetRows=basePatterns.map((p,id)=>L.eventsOf(p,song.periodBars).map((e,i)=>({...e,id:id+':'+i})));
    return Object.freeze({periodBars:song.periodBars,count,voices,basePatterns,parts,targetRows});
  }
  return {build};
});
