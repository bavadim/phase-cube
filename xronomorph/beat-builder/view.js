/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
'use strict';
const B=BeatBuilder,short=x=>B.wrap(x+.5)-.5;
class BeatCircle{
 constructor(svg,callbacks){
  this.svg=svg;this.callbacks=callbacks;this.drag=null;this.options={selection:[],snap:true};
  svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));svg.addEventListener('pointerup',e=>this.end(e));svg.addEventListener('pointercancel',()=>this.cancel());svg.addEventListener('lostpointercapture',()=>{if(this.drag)this.cancel();});
  svg.addEventListener('dblclick',e=>{const hit=e.target.closest('[data-event]');if(hit){e.preventDefault();if(this.disabled)callbacks.blocked();else callbacks.remove([Number(hit.dataset.event)]);}});
  svg.addEventListener('keydown',e=>this.key(e));window.addEventListener('blur',()=>this.cancel());
 }
 position(e){const m=this.svg.getScreenCTM();if(!m)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()),dx=p.x-180,dy=p.y-180,r=Math.hypot(dx,dy);return{time:B.wrap((Math.atan2(dy,dx)+Math.PI/2)/B.TAU),velocity:Math.max(0,Math.min(1,(r-72)/64)),radius:r};}
 point(time,r){const a=B.TAU*time-Math.PI/2;return[180+r*Math.cos(a),180+r*Math.sin(a)];}
 draw(track,color,options={}){
  this.track=track;this.options={selection:[],snap:true,...options};const selected=new Set(this.options.selection),focus=this.svg.contains(document.activeElement)?document.activeElement.dataset.event:null,ringFocused=this.svg.contains(document.activeElement)&&document.activeElement.hasAttribute('data-rotation-ring');
  let h='<circle cx="180" cy="180" r="141" fill="#111a14" stroke="#3c503e"/><circle cx="180" cy="180" r="72" fill="none" stroke="#324333" stroke-dasharray="2 5"/>';
  if(this.options.reference){const ref=this.options.reference;h+='<g data-reference="true" pointer-events="none">';for(const e of ref.events){const a=this.point(e.time,151),b=this.point(e.time,158);h+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${ref.color}" stroke-width="3" opacity=".65"/>`;}h+='</g>';}
  for(let i=0;i<16;i++){const p=this.point(i/16,141),q=this.point(i/16,i%4?146:150);h+=`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${i%4?'#536c50':'#c2d1b5'}" stroke-width="${i%4?1:2}" pointer-events="none"/>`;if(i%4===0){const t=this.point(i/16,155);h+=`<text x="${t[0]}" y="${t[1]+4}" text-anchor="middle" fill="#a9bda0" font-size="10" pointer-events="none">${i/4+1}</text>`;}}
  const points=track.events.filter(e=>e.velocity>B.EPS).slice().sort((a,b)=>a.time-b.time).map(e=>this.point(e.time,72+64*e.velocity));
  if(points.length>1)h+=`<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${color}" fill-opacity=".035" stroke="${color}" stroke-opacity=".3" stroke-width="1.25" pointer-events="none"/>`;
  const count=track.events.filter(e=>e.velocity>B.EPS).length;
  h+=`<g pointer-events="none"><text x="180" y="173" text-anchor="middle" fill="${color}" font-size="36" font-weight="400">${count}</text><text x="180" y="193" text-anchor="middle" fill="#8da183" font-size="9" letter-spacing="1.5">УДАРОВ / ТАКТ</text>`;
  if(selected.size)h+=`<text x="180" y="214" text-anchor="middle" fill="#dcedc8" font-size="10">выбрано ${selected.size}</text>`;h+='</g>';
  if(!track.events.length)h+='<text x="180" y="235" text-anchor="middle" fill="#aabd9f" font-size="10" pointer-events="none">Нажмите на круг: первый удар</text>';
  h+='<g id="circle-locator" pointer-events="none"><line x1="180" y1="113" x2="180" y2="39" stroke="#e4f7c7" stroke-width="1.3" opacity=".65"/><circle cx="180" cy="39" r="2.5" fill="#d5f77b"/></g>';
  track.events.forEach((e,i)=>{const p=this.point(e.time,72+64*e.velocity),q=this.point(e.time,72),s=selected.has(i);h+=`<g class="point" data-event="${i}" tabindex="0" role="button" aria-pressed="${s}" aria-label="Удар ${i+1}, шаг ${(e.time*16+1).toFixed(2)}, сила ${Math.round(e.velocity*100)} процентов"><line x1="${q[0]}" y1="${q[1]}" x2="${p[0]}" y2="${p[1]}" stroke="${color}" stroke-width="${s?3.5:2.5}" opacity="${s?1:.55}"/><circle cx="${p[0]}" cy="${p[1]}" r="21" fill="transparent"/><circle class="hit-dot" cx="${p[0]}" cy="${p[1]}" r="${s?7.5:6}" fill="${color}" stroke="${s?'#f0ffdb':'#152017'}" stroke-width="${s?2.5:1}"/></g>`;});
  h+=`<circle class="rotation-ring" data-rotation-ring="true" cx="180" cy="180" r="173" fill="none" stroke="${color}" stroke-width="16" stroke-opacity=".13" tabindex="0" role="button" aria-label="Повернуть ${selected.size?'выделенные удары':'всю партию'}: тяните обод или нажимайте стрелки"/>`;
  h+='<g pointer-events="none" fill="#b6cba7" font-size="12"><text x="180" y="11" text-anchor="middle">↻</text><text x="180" y="359" text-anchor="middle">↻</text></g>';
  this.svg.innerHTML=h;if(focus!==undefined&&focus!==null)this.svg.querySelector(`[data-event="${focus}"]`)?.focus({preventScroll:true});if(ringFocused)this.svg.querySelector('[data-rotation-ring]')?.focus({preventScroll:true});this.tick(this.phase||0);
 }
 down(e){
  if(e.button!==0||!e.isPrimary)return;if(this.disabled){e.preventDefault();this.callbacks.blocked();return;}this.cancel();const p=this.position(e);if(!p)return;const hit=e.target.closest('[data-event]');
  if(hit){e.preventDefault();const index=Number(hit.dataset.event);if(this.options.multi||e.shiftKey){this.callbacks.toggle(index);return;}if(!this.options.selection.includes(index))this.callbacks.select([index]);this.start(e,{kind:'point',index,origin:p});return;}
  if(e.target.closest('[data-rotation-ring]')){e.preventDefault();this.start(e,{kind:'rotate',origin:p});return;}
  if(p.radius>=70&&p.radius<=145){e.preventDefault();this.callbacks.add(this.options.snap?B.wrap(Math.round(p.time*16)/16):p.time,Math.max(.4,p.velocity));}
  else if(p.radius<60){e.preventDefault();this.callbacks.select([]);}
 }
 start(e,payload){this.callbacks.begin(payload);this.drag={...payload,id:e.pointerId,x:e.clientX,y:e.clientY,last:payload.origin.time,turn:0,moved:false};this.svg.setPointerCapture(e.pointerId);}
 move(e){const d=this.drag;if(!d||e.pointerId!==d.id)return;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<3&&!d.moved)return;const p=this.position(e);if(!p)return;e.preventDefault();d.moved=true;d.turn+=short(p.time-d.last);d.last=p.time;this.callbacks.move({...p,kind:d.kind,index:d.index,turn:d.turn});}
 end(e){const d=this.drag;if(!d||e.pointerId!==d.id)return;this.drag=null;if(this.svg.hasPointerCapture(d.id))this.svg.releasePointerCapture(d.id);this.callbacks.end();}
 cancel(){if(!this.drag)return;const d=this.drag;this.drag=null;if(this.svg.hasPointerCapture(d.id))this.svg.releasePointerCapture(d.id);this.callbacks.cancel();}
 key(e){const hit=e.target.closest('[data-event]'),ring=e.target.closest('[data-rotation-ring]');if(!hit&&!ring)return;const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'];if(!keys.includes(e.key))return;e.preventDefault();if(this.disabled){this.callbacks.blocked();return;}
  const index=hit?Number(hit.dataset.event):null;if(index!==null&&!this.options.selection.includes(index))this.callbacks.select([index]);
  if(e.key==='Delete'||e.key==='Backspace'){if(hit)this.callbacks.remove(this.options.selection.length?this.options.selection:[index]);return;}
  this.callbacks.nudge({time:e.key==='ArrowLeft'?-1/16:e.key==='ArrowRight'?1/16:0,velocity:e.key==='ArrowUp'?.05:e.key==='ArrowDown'?-.05:0});
 }
 tick(phase){this.phase=B.wrap(phase);this.svg.querySelector('#circle-locator')?.setAttribute('transform',`rotate(${this.phase*360} 180 180)`);}
}
window.BeatCircle=BeatCircle;
})();
