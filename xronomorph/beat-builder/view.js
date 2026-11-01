/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {'use strict';
const B=BeatBuilder;
class BeatCircle{
 constructor(svg,callbacks){this.svg=svg;this.callbacks=callbacks;this.selected=-1;this.drag=null;
  svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));svg.addEventListener('pointerup',e=>this.end(e));svg.addEventListener('pointercancel',()=>this.cancel());svg.addEventListener('lostpointercapture',()=>{if(this.drag)this.cancel();});
  svg.addEventListener('dblclick',e=>{const p=e.target.closest('[data-event]');if(p){e.preventDefault();if(this.disabled)callbacks.blocked();else callbacks.remove(Number(p.dataset.event));}});
  svg.addEventListener('keydown',e=>this.key(e));window.addEventListener('blur',()=>this.cancel());
 }
 position(e){const m=this.svg.getScreenCTM();if(!m)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse()),dx=p.x-180,dy=p.y-180;return{time:B.wrap((Math.atan2(dy,dx)+Math.PI/2)/B.TAU),velocity:Math.min(1,Math.max(0,(Math.hypot(dx,dy)-85)/59)),radius:Math.hypot(dx,dy)};}
 point(time,r){const a=B.TAU*time-Math.PI/2;return[180+r*Math.cos(a),180+r*Math.sin(a)];}
 draw(track,color,snap){
  this.track=track;this.snap=snap;const focused=this.svg.contains(document.activeElement)?document.activeElement.closest('[data-event]')?.dataset.event:null;
  if(this.selected>=track.events.length)this.selected=-1;
  let h='<circle cx="180" cy="180" r="145" fill="#111a14" stroke="#3e4e3e"/><circle cx="180" cy="180" r="85" fill="none" stroke="#2d3b2e" stroke-dasharray="2 5"/>';
  for(let i=0;i<16;i++){const p=this.point(i/16,145),q=this.point(i/16,i%4?150:156);h+=`<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${i%4?'#596d53':'#becab2'}" stroke-width="${i%4?1:2}"/>`;if(i%4===0){const t=this.point(i/16,169);h+=`<text x="${t[0]}" y="${t[1]+4}" text-anchor="middle" fill="#a8b8a1" font-size="12">${i/4+1}</text>`;}}
  if(!track.events.length)h+='<text x="180" y="177" text-anchor="middle" fill="#b8c9af" font-size="14">Пустой круг</text><text x="180" y="200" text-anchor="middle" fill="#85997e" font-size="11">Нажмите на обод, чтобы начать</text>';
  else h+=`<text x="180" y="176" text-anchor="middle" fill="${color}" font-size="34" font-weight="450">${track.events.filter(e=>e.velocity>B.EPS).length}</text><text x="180" y="198" text-anchor="middle" fill="#8b9f83" font-size="10" letter-spacing="2">УДАРОВ / ТАКТ</text>`;
  h+='<g id="circle-locator" pointer-events="none"><line x1="180" y1="111" x2="180" y2="30" stroke="#e1f7be" stroke-width="1.5" opacity=".65"/><circle cx="180" cy="30" r="3" fill="#d5f77b"/></g>';
  track.events.forEach((e,i)=>{const p=this.point(e.time,85+59*e.velocity),q=this.point(e.time,85),tip=this.point(e.time,145),selected=i===this.selected;h+=`<g class="point" data-event="${i}" tabindex="0" role="button" aria-label="Удар ${i+1}, позиция ${(e.time*16+1).toFixed(2)}, сила ${Math.round(e.velocity*100)} процентов"><line x1="${q[0]}" y1="${q[1]}" x2="${tip[0]}" y2="${tip[1]}" stroke="${color}" stroke-width="1" opacity=".22"/><line x1="${q[0]}" y1="${q[1]}" x2="${p[0]}" y2="${p[1]}" stroke="${color}" stroke-width="3" opacity=".7"/><circle cx="${p[0]}" cy="${p[1]}" r="25" fill="transparent"/><circle class="hit-dot" cx="${p[0]}" cy="${p[1]}" r="${selected?8:6}" fill="${color}" stroke="${selected?'#eef6d6':'#182218'}" stroke-width="${selected?2:1}"/></g>`;});
  this.svg.innerHTML=h;if(focused!==undefined&&focused!==null)this.svg.querySelector(`[data-event="${focused}"]`)?.focus({preventScroll:true});this.tick(this.phase||0);
 }
 down(e){if(e.button!==0||!e.isPrimary)return;if(this.disabled){e.preventDefault();this.callbacks.blocked();return;}this.cancel();const p=this.position(e);if(!p)return;const item=e.target.closest('[data-event]');
  if(item){e.preventDefault();const index=Number(item.dataset.event);this.selected=index;this.callbacks.begin(index);this.drag={id:e.pointerId,index,x:e.clientX,y:e.clientY,moved:false};this.svg.setPointerCapture(e.pointerId);this.callbacks.repaint();}
  else if(p.radius>=78&&p.radius<=157){e.preventDefault();this.callbacks.add(this.snap?B.wrap(Math.round(p.time*16)/16):p.time,Math.max(.4,p.velocity));}
 }
 move(e){const d=this.drag;if(!d||e.pointerId!==d.id)return;if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<3&&!d.moved)return;d.moved=true;const p=this.position(e);if(!p)return;e.preventDefault();this.callbacks.move(d.index,{time:this.snap?B.wrap(Math.round(p.time*16)/16):p.time,velocity:p.velocity});}
 end(e){const d=this.drag;if(!d||e.pointerId!==d.id)return;this.drag=null;if(this.svg.hasPointerCapture(d.id))this.svg.releasePointerCapture(d.id);this.callbacks.end();}
 cancel(){if(!this.drag)return;const d=this.drag;this.drag=null;if(this.svg.hasPointerCapture(d.id))this.svg.releasePointerCapture(d.id);this.callbacks.cancel();}
 key(e){const item=e.target.closest('[data-event]');if(!item)return;if(this.disabled){if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'].includes(e.key)){e.preventDefault();this.callbacks.blocked();}return;}const i=Number(item.dataset.event),hit=this.track.events[i];if(!hit)return;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();this.callbacks.remove(i);return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();this.selected=i;this.callbacks.begin(i);this.callbacks.move(i,{time:B.wrap(hit.time+(e.key==='ArrowLeft'?-1/16:e.key==='ArrowRight'?1/16:0)),velocity:Math.max(0,Math.min(1,hit.velocity+(e.key==='ArrowUp'?.05:e.key==='ArrowDown'?-.05:0)))});this.callbacks.end();
 }
 tick(phase){this.phase=B.wrap(phase);this.svg.querySelector('#circle-locator')?.setAttribute('transform',`rotate(${this.phase*360} 180 180)`);}
}
window.BeatCircle=BeatCircle;
})();
