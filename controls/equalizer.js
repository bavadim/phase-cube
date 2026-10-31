/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* SVG score view. Sound, clock and musical events stay in Strudel. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuzzleEqualizer = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const NS='http://www.w3.org/2000/svg', CENTER=380, INNER=204, STEP=17;
  const mod=n=>((n%1)+1)%1;
  function point(radius,phase){const a=phase*Math.PI*2-Math.PI/2;return [CENTER+Math.cos(a)*radius,CENTER+Math.sin(a)*radius];}
  function arc(radius,start,end){
    const a=point(radius,start),b=point(radius,end),span=end-start;
    if(span>=.999999){const m=point(radius,start+.5);return `M${a} A${radius},${radius} 0 0 1 ${m} A${radius},${radius} 0 0 1 ${a}`;}
    return `M${a} A${radius},${radius} 0 ${span>.5?1:0} 1 ${b}`;
  }
  // A phrase crosses the seam without losing its continuation. Durations are
  // event spans, not estimates of a sample's physical decay or release.
  function segments(start,duration){
    if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0)return [];
    if(duration>=1)return [[0,1]];
    const s=mod(start),e=s+duration;
    return e<=1?[[s,e]]:[[s,1],[0,e-1]];
  }
  function node(tag,attrs={},parent){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(parent)parent.append(el);return el;}
  class Score {
    constructor(svg,voices,{gridSteps=16,periodBeats=16}={}){
      this.svg=svg;this.voices=voices;this.rows=[];this.frameHits=[];
      const spacing=119/Math.max(1,voices.length-1);
      const grid=node('g',{'class':'orbit-grid','aria-hidden':'true'},svg);
      for(let t=0;t<gridSteps;t++){
        const major=Math.abs(t*periodBeats/gridSteps/4-Math.round(t*periodBeats/gridSteps/4))<1e-8;
        const a=point(INNER-12,t/gridSteps),b=point(336,t/gridSteps);
        node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],'class':major?'quarter-line':'subdivision-line'},grid);
        const c=point(337,t/gridSteps),d=point(major?347:342,t/gridSteps);
        node('line',{x1:c[0],y1:c[1],x2:d[0],y2:d[1],'class':'ruler-tick'},grid);
      }
      voices.forEach((v,id)=>{
        const r=INNER+id*spacing,g=node('g',{'class':'orbit-track', 'data-id':id,style:`--track-color:${v.color}`},svg);
        const title=node('title',{},g);title.textContent=`${id+1}. ${v.name}`;
        node('circle',{cx:CENTER,cy:CENTER,r,'class':'orbit-bed'},g);
        node('circle',{cx:CENTER,cy:CENTER,r:r+5.5,'class':'orbit-target-rail'},g);
        const target=node('g',{'class':'orbit-target','aria-hidden':'true'},g),current=node('g',{'class':'orbit-current','aria-hidden':'true'},g),preview=node('g',{'class':'orbit-preview','aria-hidden':'true'},g);
        this.rows.push({g,r,target,current,preview});
      });
      const sweep=node('g',{'id':'clock-hand','class':'orbit-sweep','aria-hidden':'true'},svg);
      node('line',{x1:CENTER,y1:CENTER-INNER+14,x2:CENTER,y2:CENTER-335},sweep);
      node('circle',{cx:CENTER,cy:CENTER-335,r:5.5},sweep);
      this.sweep=sweep;
    }
    drawEvents(parent,events,r,ghost){
      parent.replaceChildren();
      const keys=new Map();
      for(const e of events){const key=e.start+':'+e.duration;if(!keys.has(key))keys.set(key,[]);keys.get(key).push(e);}
      for(const group of keys.values()){
        const e=group[0],layers=ghost?1:Math.min(4,group.length);
        for(let i=0;i<layers;i++){
          const radius=r+(ghost?5.5:-3)+(layers>1?(i-(layers-1)/2)*2.5:0);
          for(const [start,end]of segments(e.start,e.duration)){
            // Leave a tiny joint between adjacent events; wrapped continuations
            // have no artificial attack mark at zero.
            const inset=Math.min(.002,(end-start)/5);
            const d=arc(radius,start+inset,end-inset);
            node('path',{d,'class':ghost?'target-event':'current-event','stroke-width':ghost?3.8:layers>1?1.8:5.5},parent);
            if(ghost)node('path',{d,'class':'target-event-core','stroke-width':1.8},parent);
          }
        }
        if(!ghost){const a=point(r-8,mod(e.start)),b=point(r+1,mod(e.start));node('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],'class':'event-onset'},parent);}
        else {const p=point(r+5.5,mod(e.start));node('circle',{cx:p[0],cy:p[1],r:2.4,'class':'target-onset'},parent);}
      }
    }
    drawPreview(parent,events,r){
      parent.replaceChildren();
      const seen=new Set();
      for(const e of events){
        const key=e.start+':'+e.duration;if(seen.has(key))continue;seen.add(key);
        for(const [start,end]of segments(e.start,e.duration)){
          const inset=Math.min(.002,(end-start)/5);
          node('path',{d:arc(r+1,start+inset,end-inset),'class':'preview-event'},parent);
        }
        const p=point(r+1,mod(e.start));node('circle',{cx:p[0],cy:p[1],r:2.5,'class':'preview-onset'},parent);
      }
    }
    update({rows,target,phases,selected,muted,solo,mode,showTarget=true,pending=false,forecast=null,affected=[]}){
      this.svg.classList.toggle('hide-target',!showTarget);
      this.svg.classList.toggle('audition-target',mode==='target');
      this.svg.classList.toggle('has-move-preview',!!forecast);
      this.svg.dataset.previewMove=forecast?.move||'';
      this.svg.dataset.selected=selected;
      this.rows.forEach((row,id)=>{
        this.drawEvents(row.target,target[id]||[],row.r,true);
        this.drawEvents(row.current,rows[id]||[],row.r,false);
        const changed=!!forecast?.changed.includes(id);
        this.drawPreview(row.preview,changed?forecast.rows[id]:[],row.r);
        row.g.classList.toggle('will-change',changed);
        row.g.classList.toggle('just-changed',affected.includes(id));
        if(forecast)row.g.dataset.previewPhase=forecast.phases[id].ticks;else delete row.g.dataset.previewPhase;
        row.g.classList.toggle('selected',id===selected);
        row.g.classList.toggle('is-muted',muted.includes(id)||(solo>=0&&solo!==id));
        row.g.classList.toggle('aligned',phases[id].ticks===0);
        row.g.setAttribute('aria-label',`${id+1}. ${this.voices[id].name}. ${phases[id].ticks===0?'Совпадает с целью.':'Не совпадает с целью.'}`);
        row.g.dataset.phase=phases[id].ticks;
      });
      this.svg.classList.toggle('is-pending',pending);
    }
    frame(phase,hits,playing){
      this.sweep.setAttribute('transform',`rotate(${phase*360} ${CENTER} ${CENTER})`);
      this.svg.classList.toggle('is-playing',playing);
      this.rows.forEach((row,id)=>{if(this.frameHits[id]!==hits[id])row.g.classList.toggle('playing-note',hits[id]);});
      this.frameHits=hits;
    }
  }
  return {Score,arc,segments,point};
});
