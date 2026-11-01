/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root){
'use strict';const M=root.RhythmMethods,NS='http://www.w3.org/2000/svg',colors=Array.from({length:6},(_,i)=>`var(--s${i+1})`);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function node(parent,tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;parent.append(e);return e;}
function polygon(points){return points.map((p,i)=>(i?'L':'M')+p.x.toFixed(3)+','+p.y.toFixed(3)).join(' ')+'Z';}
class View{
 constructor(control,result,callbacks){this.control=control;this.result=result;this.callbacks=callbacks;this.geoms=new Map();this.drag=null;this.state=null;
  for(const svg of[control,result]){svg.addEventListener('pointerdown',e=>this.down(svg,e));svg.addEventListener('pointermove',e=>this.move(svg,e));svg.addEventListener('pointerup',e=>this.up(svg,e));svg.addEventListener('pointercancel',()=>this.cancel());svg.addEventListener('lostpointercapture',()=>{if(this.drag)this.cancel();});svg.addEventListener('keydown',e=>this.key(e));}
  window.addEventListener('blur',()=>this.cancel());window.addEventListener('keydown',e=>{if(e.key==='Escape')this.cancel();});
  this.observer=new ResizeObserver(()=>{if(this.state)this.draw(this.state);});this.observer.observe(control.parentElement);this.observer.observe(result.parentElement);
 }
 geom(svg){const w=svg.parentElement.clientWidth,h=Math.min(450,Math.max(270,w*.86)),r=Math.min(w/2-40,h/2-31),g={w,h,x:w/2,y:h/2,r};svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.geoms.set(svg,g);return g;}
 point(g,t,r=g.r){return{x:g.x+r*Math.sin(M.TAU*t),y:g.y-r*Math.cos(M.TAU*t)};}
 group(svg,role,index,label){return node(svg,'g',{'data-role':role,'data-index':index,role:'button',tabindex:0,'aria-label':label});}
 handle(parent,p,color,selected=false,label=''){node(parent,'circle',{cx:p.x,cy:p.y,r:22,class:'hit'});if(selected)node(parent,'circle',{cx:p.x,cy:p.y,r:12,fill:'none',stroke:color,'stroke-width':1.5});node(parent,'circle',{cx:p.x,cy:p.y,r:6,fill:color});if(label)node(parent,'text',{x:p.x+12,y:p.y-12,class:'label'},label);}
 clock(svg,g){for(const scale of[.5,1])node(svg,'circle',{cx:g.x,cy:g.y,r:g.r*scale,class:'grid'});for(const[t,label]of [[0,'0'],[.25,'¼'],[.5,'½'],[.75,'¾']]){const p=this.point(g,t,g.r+20);node(svg,'text',{x:p.x,y:p.y+5,'text-anchor':'middle'},label);}node(svg,'line',{x1:g.x,y1:g.y,x2:g.x,y2:g.y-g.r,class:'locator','data-locator':''});}
 cells(svg,g,values,{interactive=false,axis=null}={}){
  this.clock(svg,g);const n=values.length,max=Math.max(1,...values);
  for(let j=0;j<n;j++){
   const t=j/n,a=this.point(g,t,g.r*.18),b=this.point(g,t,g.r),p=this.point(g,t,g.r*(.18+.82*values[j]/max));
   node(svg,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'grid'});
   if(interactive){const f=t-1/(n*2),z=t+1/(n*2),points=[this.point(g,f,g.r*.12),this.point(g,f,g.r+8),this.point(g,z,g.r+8),this.point(g,z,g.r*.12)],hit=this.group(svg,'strength',j,`Шаг ${j+1}, сила ${values[j].toFixed(2)}. Стрелки вверх и вниз меняют силу.`);node(hit,'path',{d:polygon(points),fill:'transparent'});}
   if(values[j]>M.EPS)node(svg,'line',{x1:a.x,y1:a.y,x2:p.x,y2:p.y,stroke:colors[0],'stroke-width':5,'stroke-linecap':'round','pointer-events':'none'});
   node(svg,'circle',{cx:p.x,cy:p.y,r:values[j]>M.EPS?4:2,fill:values[j]>M.EPS?colors[0]:'var(--line)','pointer-events':'none'});
  }
  if(max>1+M.EPS)node(svg,'text',{x:g.x+8,y:g.y+g.r*.8,class:'label'},`макс. ${max.toFixed(1)}`);
  if(axis!==null){const a=this.point(g,axis/(2*n)),b=this.point(g,axis/(2*n)+.5);node(svg,'line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'axis','pointer-events':'none'});const h=this.group(svg,'axis',0,'Ось зеркала. Стрелки поворачивают её на один шаг.');this.handle(h,a,colors[1],true,'ось');}
 }
 spectrum(svg,g,s){
  const scale=g.r/2;
  for(const a of[1,2]){node(svg,'circle',{cx:g.x,cy:g.y,r:a*scale,class:'grid'});node(svg,'text',{x:g.x+a*scale-4,y:g.y+19,'text-anchor':'end'},a);}
  node(svg,'line',{x1:g.x-g.r,y1:g.y,x2:g.x+g.r,y2:g.y,class:'guide'});node(svg,'line',{x1:g.x,y1:g.y-g.r,x2:g.x,y2:g.y+g.r,class:'guide'});
  node(svg,'text',{x:g.x+g.r+7,y:g.y+5},'Re');node(svg,'text',{x:g.x+6,y:g.y-g.r-8},'Im');
  for(const j of s.coefficients.map((_,i)=>i).filter(i=>i!==s.selected).concat(s.selected)){
   const c=s.coefficients[j],p={x:g.x+c[0]*scale,y:g.y-c[1]*scale},color=colors[j%6],selected=j===s.selected;
   node(svg,'line',{x1:g.x,y1:g.y,x2:p.x,y2:p.y,stroke:color,'stroke-width':selected?3:1.5,opacity:selected?1:.35});
   const h=this.group(svg,'coefficient',j,`Коэффициент ${j}. Стрелки меняют действительную и мнимую части.`);this.handle(h,p,color,selected,selected?`a${j}`:'');
  }
 }
 scratchResult(svg,g,s){this.clock(svg,g);for(const v of[1,2])node(svg,'text',{x:g.x+7,y:g.y-g.r*v/2+20,class:'muted'},v+'×');const ps=M.scratchPoints(s),points=ps.map(p=>({x:g.x+p.z[1]*g.r/2,y:g.y-p.z[0]*g.r/2}));
  node(svg,'path',{d:polygon(points),fill:colors[0],'fill-opacity':.07,stroke:colors[0],'stroke-width':1.5});
  ps.forEach((v,j)=>{const p=points[j];if(v.strength<M.EPS){node(svg,'text',{x:g.x+8,y:g.y+20},`${j+1}: тишина`);return;}node(svg,'line',{x1:g.x,y1:g.y,x2:p.x,y2:p.y,stroke:colors[0],opacity:.2});node(svg,'circle',{cx:p.x,cy:p.y,r:5,fill:colors[0]});node(svg,'text',{x:p.x+9,y:p.y-9,class:'label'},j+1);});
 }
 canonSource(svg,g,s){this.clock(svg,g);const points=s.motif.map(j=>this.point(g,j/16));if(points.length>1)node(svg,'path',{d:polygon(points),fill:colors[0],'fill-opacity':.06,stroke:colors[0],'stroke-width':1.5});
  for(let j=0;j<16;j++){const p=this.point(g,j/16),h=this.group(svg,'cell',j,`Шаг ${j+1}, ${s.motif.includes(j)?'удар':'пауза'}. Enter переключает.`);node(h,'circle',{cx:p.x,cy:p.y,r:21,fill:'transparent',class:'tap'});node(h,'circle',{cx:p.x,cy:p.y,r:s.motif.includes(j)?8:4,fill:s.motif.includes(j)?colors[0]:'var(--line)','pointer-events':'none'});}
 }
 canonResult(svg,g,s){this.clock(svg,g);const cover=M.coverage(16,s.motif,s.entries);
  for(let j=0;j<16;j++){const p=this.point(g,j/16),v=cover[j];node(svg,'circle',{cx:p.x,cy:p.y,r:7,fill:v===1?colors[0]:v>1?'var(--warn)':'var(--panel)',stroke:v===0?'var(--line)':'none','stroke-width':1});if(v>1)node(svg,'text',{x:p.x,y:p.y+5,'text-anchor':'middle',fill:'var(--bg)'},v);}
  const total=s.entries.length;
  for(const i of s.entries.map((_,i)=>i).filter(i=>i!==s.selected).concat(total?[s.selected]:[])){
   const b=s.entries[i],r=g.r*(.35+.47*(i+1)/Math.max(1,total)),points=s.motif.map(a=>this.point(g,(a+b)/16,r)),color=colors[i%6];
   if(points.length>1)node(svg,'path',{d:polygon(points),fill:'none',stroke:color,'stroke-width':i===s.selected?2:1,opacity:i===s.selected?1:.45});
   points.forEach(p=>node(svg,'circle',{cx:p.x,cy:p.y,r:3,fill:color}));
   const h=this.group(svg,'entry',i,`Копия ${i+1}, вступление ${b+1}. Стрелки меняют вступление.`);this.handle(h,this.point(g,b/16,r),color,i===s.selected,String(i+1));
  }
 }
 atoms(svg,g,s){this.clock(svg,g);
  if(!s.atoms.length)node(svg,'text',{x:g.x,y:g.y,'text-anchor':'middle'},'Добавьте мотив');
  for(const i of s.atoms.map((_,i)=>i).filter(i=>i!==s.selected).concat(s.atoms.length?[s.selected]:[])){
   const a=s.atoms[i],r=g.r*a.gain/2,pts=M.atomPoints(a).map(j=>this.point(g,j/16,r)),color=colors[i%6],selected=i===s.selected;
   if(pts.length>1)node(svg,'path',{d:polygon(pts),fill:color,'fill-opacity':selected?.10:.025,stroke:color,'stroke-width':selected?2:1,opacity:selected?1:.45});
   M.atomPoints(a).forEach((j,k)=>{const h=this.group(svg,'atom',i,`Мотив ${i+1}, ${M.dictionary.find(d=>d.id===a.kind).label}. Стрелки влево и вправо вращают, вверх и вниз меняют силу.`);h.dataset.offset=M.mod(j-a.shift,16);this.handle(h,pts[k],color,selected&&k===0,selected&&k===0?String(i+1):'');});
  }
 }
 draw(state){this.state=state;const active=document.activeElement,focus=active?.closest('svg')&&active.dataset.role?{svg:active.closest('svg'),role:active.dataset.role,index:active.dataset.index}:null;
  for(const svg of[this.control,this.result]){svg.replaceChildren();const g=this.geom(svg);node(svg,'title',{},M.descriptions[state.mode][svg===this.control?'control':'result']);if(svg===this.control){if(state.mode==='scratch')this.spectrum(svg,g,state.scratch);if(state.mode==='mirror')this.cells(svg,g,state.mirror.source,{interactive:true,axis:state.mirror.axis});if(state.mode==='canon')this.canonSource(svg,g,state.canon);if(state.mode==='dictionary')this.atoms(svg,g,state.dictionary);}else{if(state.mode==='scratch')this.scratchResult(svg,g,state.scratch);if(state.mode==='mirror')this.cells(svg,g,M.resultVector(state));if(state.mode==='canon')this.canonResult(svg,g,state.canon);if(state.mode==='dictionary')this.cells(svg,g,M.resultVector(state));}}
  if(focus)focus.svg.querySelector(`[data-role="${focus.role}"][data-index="${focus.index}"]`)?.focus({preventScroll:true});
 }
 local(svg,e){const r=svg.getBoundingClientRect(),g=this.geoms.get(svg);return{x:(e.clientX-r.x)*g.w/r.width,y:(e.clientY-r.y)*g.h/r.height};}
 down(svg,e){if(e.button!==0||this.drag)return;const target=e.target.closest('[data-role]');if(!target||!svg.contains(target))return;e.preventDefault();const role=target.dataset.role,index=Number(target.dataset.index);this.callbacks.begin(role,index);this.drag={svg,id:e.pointerId,role,index,offset:Number(target.dataset.offset||0),start:{x:e.clientX,y:e.clientY},moved:false};svg.setPointerCapture(e.pointerId);if(role==='strength')this.apply(svg,e);}
 apply(svg,e){const d=this.drag,g=this.geoms.get(svg),p=this.local(svg,e),dx=p.x-g.x,dy=p.y-g.y,t=M.wrap(Math.atan2(dx,-dy)/M.TAU),distance=Math.hypot(dx,dy);
  const payload={role:d.role,index:d.index};if(d.role==='coefficient')payload.value=[dx/g.r*2,-dy/g.r*2];if(d.role==='axis')payload.value=M.mod(Math.round(t*32),16);if(d.role==='strength')payload.value=clamp((distance/g.r-.18)/.82,0,1);if(d.role==='entry')payload.value=M.mod(Math.round(t*16),16);if(d.role==='atom'){payload.value={shift:M.mod(Math.round(t*16)-d.offset,16),gain:clamp(distance/g.r*2,0,2)};}if(d.role!=='cell')this.callbacks.move(payload);
 }
 move(svg,e){if(!this.drag||svg!==this.drag.svg||e.pointerId!==this.drag.id)return;this.drag.moved||=Math.hypot(e.clientX-this.drag.start.x,e.clientY-this.drag.start.y)>4;if(this.drag.moved)this.apply(svg,e);}
 up(svg,e){if(!this.drag||svg!==this.drag.svg||e.pointerId!==this.drag.id)return;const d=this.drag;if(d.role==='cell'&&!d.moved)this.callbacks.move({role:'cell',index:d.index});this.drag=null;if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);this.callbacks.end();}
 cancel(){if(!this.drag)return;const d=this.drag;this.drag=null;try{if(d.svg.hasPointerCapture(d.id))d.svg.releasePointerCapture(d.id);}catch{}this.callbacks.cancel();}
 key(e){const t=e.target.closest('[data-role]');if(!t)return;const role=t.dataset.role,index=Number(t.dataset.index),arrows=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];if(!arrows.includes(e.key)&&!['Enter',' '].includes(e.key))return;e.preventDefault();const dir=['ArrowRight','ArrowUp'].includes(e.key)?1:-1,s=this.state;this.callbacks.begin(role,index);
  if(role==='cell'){if(['Enter',' '].includes(e.key))this.callbacks.move({role,index});}
  else if(arrows.includes(e.key)){let value;if(role==='coefficient'){value=s.scratch.coefficients[index].slice();value[['ArrowUp','ArrowDown'].includes(e.key)?1:0]+=.025*dir;}if(role==='axis')value=M.mod(s.mirror.axis+dir,16);if(role==='strength')value=clamp(s.mirror.source[index]+dir*.1,0,1);if(role==='entry')value=M.mod(s.canon.entries[index]+dir,16);if(role==='atom'){const a=s.dictionary.atoms[index];value={...a};if(['ArrowUp','ArrowDown'].includes(e.key))value.gain=clamp(a.gain+.1*dir,0,2);else value.shift=M.mod(a.shift+dir,16);}this.callbacks.move({role,index,value});}
  this.callbacks.end();
 }
 tick(cycle){for(const svg of[this.control,this.result]){const g=this.geoms.get(svg),line=svg.querySelector('[data-locator]');if(g&&line){const p=this.point(g,M.wrap(cycle));line.setAttribute('x2',p.x);line.setAttribute('y2',p.y);}}}
}
root.RhythmMethodsView=View;
})(globalThis);
