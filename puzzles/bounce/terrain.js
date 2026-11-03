/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Musical kinematics: one revolution is the selected riff's true repeat period.
   This is not a free-running physics simulation. Every landing is an onset. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BounceTerrain=factory();})(globalThis,function(){
  'use strict';
  const wrap=x=>((x%1)+1)%1,delta=(a,b)=>wrap(b-a+.5)-.5;
  const radius=1.48,ballRadius=.135;
  function attacks(row,period=1){
    if(!(period>0&&Number.isFinite(period)))throw new Error('Invalid riff period');
    const groups=new Map();
    for(const e of row){
      const time=wrap(e.start/period),key=Math.round(time*1e8)%100000000;
      const velocity=Math.max(0,Math.min(1,e.value?.velocity??1));
      if(!groups.has(key))groups.set(key,{time:key/1e8,velocity,pitches:[]});
      const item=groups.get(key);item.velocity=Math.max(item.velocity,velocity);
      const pitch=e.pitch??e.value?.note;if(pitch!=null&&!item.pitches.includes(pitch))item.pitches.push(pitch);
    }
    return [...groups.values()].sort((a,b)=>a.time-b.time);
  }
  const shift=(events,phase)=>events.map(e=>({...e,time:wrap(e.time-phase/8)})).sort((a,b)=>a.time-b.time);
  // Pitch is visible in the landing pad silhouette; equal onset rhythms do
  // not make a shifted melody look solved. The score retains exact note gates.
  const tokenWidth=event=>.045+.003*(Math.abs(Number(event.pitches[0])||0)%24);
  const crest=(event,gain)=>radius+.07+.16*gain*(.55+.45*event.velocity);
  function surface(events,time,gain){
    let r=radius;
    for(let i=0;i<events.length;i++){
      const e=events[i],prev=events[(i+events.length-1)%events.length],next=events[(i+1)%events.length];
      const gap=events.length===1?1:Math.min(wrap(e.time-prev.time),wrap(next.time-e.time));
      const width=Math.min(.04,gap*.42),d=Math.abs(delta(e.time,time));
      if(d<width)r=Math.max(r,radius+(crest(e,gain)-radius)*(.5+.5*Math.cos(Math.PI*d/width)));
    }
    return r;
  }
  function flight(events,time,gain){
    const t=wrap(time);
    if(!events.length)return{time:t,radius:radius+ballRadius,progress:0,impact:0};
    let index=events.findIndex(e=>e.time>t+1e-10)-1;
    if(index<0)index=events.length-1;
    // The first event after t can be absent: the previous one is the last event.
    if(t>=events.at(-1).time-1e-10)index=events.length-1;
    const previous=events[index],next=events[(index+1)%events.length];
    const span=events.length===1?1:wrap(next.time-previous.time),age=Math.abs(delta(previous.time,t))<1e-9?0:wrap(t-previous.time);
    const u=Math.max(0,Math.min(1,age/span)),height=Math.min(.40,.14+span*2.4);
    const r=crest(previous,gain)*(1-u)+crest(next,gain)*u+4*u*(1-u)*height+ballRadius;
    return{time:t,radius:r,progress:u,impact:Math.max(0,1-age/Math.min(.024,span*.22)),previous:index};
  }
  function point(time,r){const a=time*Math.PI*2;return{x:Math.sin(a)*r,y:Math.cos(a)*r};}
  const angle=p=>Math.atan2(p.x,p.y)/(Math.PI*2);
  return{wrap,delta,radius,ballRadius,attacks,shift,tokenWidth,crest,surface,flight,point,angle};
});
