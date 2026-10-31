/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One set of persistent musical events moves between states on shared lanes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuzzleEqualizer = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NS='http://www.w3.org/2000/svg',CENTER=380,INNER=250;
  const mod=n=>((n%1)+1)%1,delta=(a,b)=>mod(b-a+.5)-.5;
  const level=e=>Math.max(0,Math.min(2,(e.volume??1)*(typeof e.value?.velocity==='number'?e.value.velocity:1)));
  // Multiplying RGB channels changes HSV value while retaining hue/saturation.
  // Width provides a second level cue on the light paper background.
  const brightness=level=>.3+.7*Math.sqrt(Math.max(0,Math.min(1,level/2)));
  function point(radius,phase){const a=phase*Math.PI*2-Math.PI/2;return [CENTER+Math.cos(a)*radius,CENTER+Math.sin(a)*radius];}
  function arc(radius,start,end){
    const a=point(radius,start),b=point(radius,end),span=end-start;
    if(span>=.999999){const m=point(radius,start+.5);return `M${a} A${radius},${radius} 0 0 1 ${m} A${radius},${radius} 0 0 1 ${a}`;}
    return `M${a} A${radius},${radius} 0 ${span>.5?1:0} 1 ${b}`;
  }
  // These spans are note gates, not measurements of the sample's PCM tail.
  function segments(start,duration){
    if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0)return [];
    if(duration>=1)return [[0,1]];
    const s=mod(start),e=s+duration;return e<=1?[[s,e]]:[[s,1],[0,e-1]];
  }
  function node(tag,attrs={},parent){const el=document.createElementNS(NS,tag);set(el,attrs);if(parent)parent.append(el);return el;}
  function set(el,attrs){for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);}
  function groups(events){
    const result=new Map();
    events.forEach((e,i)=>{const key=e.start+':'+e.duration;if(!result.has(key))result.set(key,[]);result.get(key).push({...e,id:e.id??String(i)});});
    return [...result.values()].map(values=>{
      values.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      return{id:values.map(e=>e.id).join('|'),start:values[0].start,duration:values[0].duration,layers:Math.min(3,values.length),levels:values.slice(0,3).map(level),pitches:values.slice(0,3).map(e=>e.pitch??null)};
    });
  }
  const fingerprint=rows=>JSON.stringify(rows.map(row=>groups(row).map(e=>[e.id,e.start,e.duration,e.levels,e.pitches]).sort((a,b)=>a[0].localeCompare(b[0]))));
  class Score{
    constructor(svg,voices,{periodBeats=16,periodSeconds=8}={}){
      Object.assign(this,{svg,voices,periodSeconds});this.laneWidth=Math.min(10,73/Math.max(1,voices.length-1));this.rows=[];this.baseRows=[];this.destination=null;this.motion=null;this.committed=null;this.forecast=null;
      this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      const grid=node('g',{'class':'orbit-grid','aria-hidden':'true'},svg),bars=Math.max(1,Math.round(periodBeats/4));
      for(let t=0;t<bars;t++){
        const a=point(INNER-9,t/bars),b=point(331,t/bars),c=point(337,t/bars),d=point(t?342:347,t/bars);
        node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],'class':'bar-line'},grid);
        node('line',{x1:c[0],y1:c[1],x2:d[0],y2:d[1],'class':'ruler-tick'},grid);
      }
      const spacing=(323-INNER)/Math.max(1,voices.length-1);
      voices.forEach((v,id)=>{
        const r=INNER+id*spacing,g=node('g',{'class':'orbit-track','data-id':id,style:`--track-color:${v.color}`},svg);
        node('title',{},g).textContent=`${id+1}. ${v.name}`;
        node('circle',{cx:CENTER,cy:CENTER,r,'class':'orbit-bed'},g);
        const target=node('g',{'class':'orbit-target','aria-hidden':'true'},g),current=node('g',{'class':'orbit-current','aria-hidden':'true'},g);
        const cycles=node('g',{'class':'orbit-cycles','aria-hidden':'true'},g);
        this.rows.push({g,r,target,current,cycles,cycleTicks:[],events:new Map(),positions:new Map()});
      });
      const sweep=node('g',{'id':'clock-hand','class':'orbit-sweep','aria-hidden':'true'},svg);
      node('line',{x1:CENTER,y1:CENTER-INNER+9,x2:CENTER,y2:CENTER-335},sweep);
      node('circle',{cx:CENTER,cy:CENTER-335,r:5.5},sweep);this.sweep=sweep;
    }
    pitchRadius(row,pitch){const range=row.pitchRange;return row.r+(Number.isFinite(pitch)&&range?.max>range?.min?Math.min(7,this.laneWidth*.45)*((pitch-range.min)/(range.max-range.min)-.5):0);}
    drawSlots(target){
      this.rows.forEach((row,id)=>{
        const pitches=(target[id]||[]).map(e=>e.pitch).filter(Number.isFinite);row.pitchRange={min:Math.min(...pitches),max:Math.max(...pitches)};
        row.target.replaceChildren();
        for(const e of groups(target[id]||[])){
          for(let layer=0;layer<e.layers;layer++){
            const r=this.pitchRadius(row,e.pitches[layer]);
            for(const [start,end]of segments(e.start,e.duration)){
              const inset=Math.min(.002,(end-start)/5);
              node('path',{d:arc(r,start+inset,end-inset),'class':'target-slot','data-pitch':e.pitches[layer]??'','stroke-width':Math.min(this.laneWidth*.65,e.layers>1?3:5.5)},row.target);
            }
            const a=point(r-2.5,e.start),b=point(r+2.5,e.start);
            node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],'class':'target-stop'},row.target);
          }
        }
      });
    }
    renderEvent(row,e){
      let item=row.events.get(e.id);
      if(!item){
        const g=node('g',{'class':'score-event','data-event-id':e.id},row.current),paths=[];
        for(let layer=0;layer<e.layers;layer++)paths.push([node('path',{'class':'current-event'},g),node('path',{'class':'current-event'},g)]);
        const onset=node('line',{'class':'event-onset'},g),flash=node('circle',{'class':'event-flash',r:4.2},g);
        item={g,paths,onset,flash};row.events.set(e.id,item);
      }
      const levelsKey=JSON.stringify([e.levels,e.pitches]);
      if(item.start===e.start&&item.duration===e.duration&&item.levelsKey===levelsKey)return;
      const spans=segments(e.start,e.duration);
      item.paths.forEach((paths,i)=>paths.forEach((path,k)=>{
        const span=spans[k];path.style.display=span?'':'none';if(!span)return;
        const inset=Math.min(.002,(span[1]-span[0])/5),r=this.pitchRadius(row,e.pitches[i])+(e.layers>1?(i-(e.layers-1)/2)*.5:0);
        const intensity=e.levels[i]??e.levels[0];
        set(path,{d:arc(r,span[0]+inset,span[1]-inset),'stroke-width':Math.min(this.laneWidth*.65,e.layers>1?.5+intensity:2+3.5*intensity)});
        path.style.filter='brightness('+brightness(intensity)+')';path.style.opacity=intensity>0?'1':'0';path.dataset.pitch=e.pitches[i]??'';
      }));
      const radii=e.pitches.map(p=>this.pitchRadius(row,p)),r=radii.reduce((a,b)=>a+b,0)/radii.length;
      const a=point(Math.min(...radii)-1.5,e.start),b=point(Math.max(...radii)+1.5,e.start),p=point(r,e.start);
      set(item.onset,{x1:a[0],y1:a[1],x2:b[0],y2:b[1]});set(item.flash,{cx:p[0],cy:p[1]});
      item.onset.style.opacity=Math.max(...e.levels)>0?'1':'0';
      item.onset.style.filter='brightness('+brightness(Math.max(...e.levels))+')';
      item.start=e.start;item.duration=e.duration;item.levelsKey=levelsKey;
    }
    advance(now){
      if(!this.motion)return;
      const t=this.reduced?1:Math.min(1,(now-this.motion.start)/300),ease=t*t*(3-2*t);
      this.rows.forEach((row,id)=>{
        for(const e of this.motion.to[id]){
          const from=this.motion.from[id].get(e.id)||e,start=mod(from.start+delta(from.start,e.start)*ease);
          const levels=e.levels.map((v,i)=>(from.levels?.[i]??v)+(v-(from.levels?.[i]??v))*ease);
          const value={...e,start,levels};row.positions.set(e.id,value);this.renderEvent(row,value);
        }
      });
      if(t===1)this.motion=null;
    }
    transition(rows,immediate=false){
      const key=fingerprint(rows);if(key===this.destination)return;
      const now=performance.now();this.advance(now);
      const to=rows.map(groups),from=this.rows.map(row=>new Map(row.positions));
      this.rows.forEach((row,id)=>{
        const ids=new Set(to[id].map(e=>e.id));
        for(const [key,item]of row.events)if(!ids.has(key)){item.g.remove();row.events.delete(key);row.positions.delete(key);}
      });
      this.motion={from,to,start:this.destination==null||this.reduced||immediate?now-300:now};this.destination=key;this.advance(now);
    }
    commit(rows){this.committed={key:fingerprint(rows),rows};}
    cancel(){this.committed=null;this.forecast=null;}
    update({rows,target,phases,pending=false,forecast=null,selectedKey=null}){
      this.baseRows=rows;this.forecast=forecast;
      if(this.target!==target){this.target=target;this.drawSlots(target);}
      if(this.committed?.key===fingerprint(rows))this.committed=null;
      const visible=forecast?.rows||this.committed?.rows||rows,preview=!!(forecast||this.committed);
      this.svg.dataset.mode=preview?'preview':'current';
      this.svg.setAttribute('aria-label',preview?'Прогноз выбранного действия и гнёзда цели':'Звучащий рисунок и гнёзда цели');
      this.svg.classList.toggle('has-move-preview',preview);this.svg.classList.toggle('is-pending',pending);
      this.svg.dataset.previewMove=forecast?JSON.stringify(forecast.move):'';
      this.rows.forEach((row,id)=>{
        row.g.classList.toggle('will-change',!!forecast?.changed.includes(id)||!!this.committed&&fingerprint([rows[id]])!==fingerprint([visible[id]]));
        row.g.classList.toggle('aligned',phases[id].aligned);
        row.g.dataset.gain=phases[id].gain??1;
        row.period=phases[id].period;row.selected=!!selectedKey&&phases[id].controlKey===selectedKey;
        row.cycles.style.display=row.selected?'':'none';
        const count=row.selected&&row.period?Math.round(1/row.period):0;
        if(count!==row.cycleTicks.length){row.cycles.replaceChildren();row.cycleTicks=Array.from({length:count},()=>node('line',{},row.cycles));}
        row.g.dataset.cycleCount=count;
        row.g.setAttribute('aria-label',`${id+1}. ${this.voices[id].name}. ${phases[id].aligned?'Совпадает с целью.':'Не совпадает с целью.'}`);
        if(phases[id].ticks!==undefined)row.g.dataset.phase=phases[id].ticks;else delete row.g.dataset.phase;
        if(forecast?.phases[id].ticks!==undefined)row.g.dataset.previewPhase=forecast.phases[id].ticks;else delete row.g.dataset.previewPhase;
      });
      this.transition(visible,!!forecast?.continuous);
    }
    frame(phase,playing,now=performance.now()){
      this.advance(now);this.sweep.setAttribute('transform',`rotate(${phase*360} ${CENTER} ${CENTER})`);
      this.svg.classList.toggle('is-playing',playing);
      const actual=playing&&!this.forecast&&!this.committed&&!this.motion;
      this.rows.forEach(row=>{
        if(row.selected&&row.period&&row.positions.size){
          const anchor=row.positions.values().next().value.start;
          row.g.dataset.localPhase=mod((phase-anchor)/row.period);
          row.cycleTicks.forEach((tick,k)=>{const a=point(row.r+4.5,anchor+k*row.period),b=point(row.r+8,anchor+k*row.period);set(tick,{x1:a[0],y1:a[1],x2:b[0],y2:b[1]});});
        }else delete row.g.dataset.localPhase;
        for(const [id,item]of row.events){
          const e=row.positions.get(id),on=!!(actual&&e&&Math.max(...e.levels)>0&&mod(phase-e.start)*this.periodSeconds<.12);
          if(item.sounding!==on){item.g.classList.toggle('sounding',on);item.sounding=on;}
        }
      });
    }
  }
  return{Score,arc,segments,point,delta,groups,level,brightness};
});
