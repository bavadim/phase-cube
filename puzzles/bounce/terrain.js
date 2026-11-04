/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Circular event geometry. Rotation uses the audio clock; gain controls size. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.BounceTerrain=factory();})(globalThis,function(){
  'use strict';
  const wrap=x=>((x%1)+1)%1,delta=(a,b)=>wrap(b-a+.5)-.5,TAU=Math.PI*2;
  const gainDragSpan=1.8,gainStep=.5,gains=Object.freeze([0,.5,1,1.5,2]),front=Math.PI/4;
  const colors=['#db7063','#df994d','#cfb64e','#a5b95a','#71af79','#53ac99','#50a4b8','#668ec1','#8d7bb7','#ae79ac','#c67f9d','#d58781'];
  function attacks(row,period=1){
    if(!(period>0&&Number.isFinite(period)))throw new Error('Invalid riff period');
    const groups=new Map();
    for(const e of row){
      const key=Math.round(wrap(e.start/period)*1e8)%100000000,velocity=Math.max(0,Math.min(1,e.value?.velocity??1));
      if(!groups.has(key))groups.set(key,{time:key/1e8,velocity,gate:0,pitches:[],signatures:new Set()});
      const item=groups.get(key);item.velocity=Math.max(item.velocity,velocity);item.gate=Math.max(item.gate,(e.duration??0)/period);
      const pitch=e.pitch??e.value?.note;if(pitch!=null&&!item.pitches.includes(pitch))item.pitches.push(pitch);
      item.signatures.add(JSON.stringify([pitch,e.duration==null?null:e.duration/period,e.value]));
    }
    return [...groups.values()].map(({signatures,...event})=>({...event,signature:[...signatures].sort().join('|')})).sort((a,b)=>a.time-b.time);
  }
  const shift=(events,phase)=>events.map(e=>({...e,time:wrap(e.time-phase/8)})).sort((a,b)=>a.time-b.time);
  const radius=gain=>1.10+.32*Math.max(0,Math.min(2,gain));
  // Every tooth shares the socket radius; dynamics must not change the fit.
  const crest=(event,gain)=>radius(gain)+.14;
  // Rotational stabilizer of the actual onset set inside C8. An arbitrary 45°
  // step is not a seat when the rhythm only fits every 90° or 180°.
  function seatStep(events){
    if(!events.length)throw new Error('Шестерёнке нужны ноты');
    return [1,2,4,8].find(step=>events.every(e=>events.some(s=>Math.abs(delta(e.time-step/8,s.time))<1e-7)));
  }
  function snapGain(gain){
    if(!Number.isFinite(gain))throw new Error('Неверный размер шестерёнки');
    const bounded=Math.max(0,Math.min(2,gain));
    return gains[Math.round(bounded/gainStep)];
  }
  function surface(events,time,gain){
    let r=radius(gain)-.10;
    for(let i=0;i<events.length;i++){
      const e=events[i],prev=events[(i+events.length-1)%events.length],next=events[(i+1)%events.length];
      const gap=events.length===1?1:Math.min(wrap(e.time-prev.time),wrap(next.time-e.time));
      const width=Math.min(.045,gap*.42),d=Math.abs(delta(e.time,time));
      if(d<width)r=Math.max(r,radius(gain)-.10+(crest(e,gain)-radius(gain)+.10)*(.5+.5*Math.cos(Math.PI*d/width)));
    }
    return r;
  }
  const pitch=event=>Math.round(Number(event.pitches[0])||0);
  const noteClass=event=>((pitch(event)%12)+12)%12;
  const color=event=>colors[noteClass(event)];
  const tokenWidth=event=>.065+.002*(Math.abs(pitch(event))%24)+.05*Math.sqrt(Math.min(1,event.gate*8));
  const rotation=(phase,period)=>front-wrap(phase/period)*TAU;
  // Positions are unwrapped audio cycles, so holding across loop boundaries is continuous.
  const heldPhase=(phase,start,position,period)=>phase-8*(position-start)/period;
  function point(time,r,y=0){const a=time*TAU;return{x:Math.sin(a)*r,y,z:Math.cos(a)*r};}
  return{wrap,delta,TAU,front,gainDragSpan,gainStep,gains,attacks,seatStep,snapGain,shift,radius,crest,surface,pitch,noteClass,color,tokenWidth,rotation,heldPhase,point};
});
