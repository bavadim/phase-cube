/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A circular time diagram, not a second sequencer or animation engine. */
window.XronoView=class{
  constructor(svg,{onSelect,onRotate,onCommit,onCancel}){
    Object.assign(this,{svg,onSelect,onRotate,onCommit,onCancel});this.NS='http://www.w3.org/2000/svg';this.drag=null;
    this.colors=['#538e7a','#c18043','#727ec2','#b97192','#b49b36','#568fa9','#8b7b6d','#789643'];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));
    svg.addEventListener('pointerup',e=>this.end(e,false));svg.addEventListener('pointercancel',e=>this.end(e,true));
    svg.addEventListener('lostpointercapture',e=>this.end(e,true));
    this.resize=new ResizeObserver(()=>{const w=svg.getBoundingClientRect().width;if(Math.abs(w-(this.width||0))>1)this.draw();});this.resize.observe(svg);
    window.addEventListener('blur',()=>this.end(null,true));
  }
  set(state,rows){this.state=state;this.rows=rows;this.draw();}
  node(name,attrs={},parent=this.svg){const n=document.createElementNS(this.NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
  point(t,r=this.radius){const a=t*Math.PI*2-Math.PI/2;return{x:this.cx+r*Math.cos(a),y:this.cy+r*Math.sin(a)};}
  draw(){
    if(!this.state)return;
    const w=Math.max(260,this.svg.getBoundingClientRect().width),h=Math.min(660,w+8);this.width=w;this.cx=w/2;this.cy=h/2;this.radius=Math.min(w/2-35,h/2-36);
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=h+'px';this.svg.replaceChildren();
    this.node('title').textContent='Один оборот — один цикл. Цветные вершины запускают звуки. Вращается только вся фигура; отдельные вершины зафиксированы.';
    this.node('circle',{cx:this.cx,cy:this.cy,r:this.radius,fill:'none',stroke:'var(--line)','stroke-width':1.5});
    const count=this.state.snap||16;
    for(let i=0;i<count;i++){const a=this.point(i/count,this.radius+7),b=this.point(i/count,this.radius+12);this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'var(--line)','stroke-width':1});}
    for(const[t,label]of[[0,'0'],[.25,'¼'],[.5,'½'],[.75,'¾']]){const p=this.point(t,this.radius+25),n=this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle'});n.textContent=label;}
    const selected=this.state.selected,order=this.rows.filter(r=>r.enabled&&r.id!==selected).concat(this.rows.filter(r=>r.id===selected));
    for(const row of order){
      const id=row.id,color=this.colors[id%this.colors.length],active=id===selected;
      const group=this.node('g',{'data-layer':id,opacity:row.enabled?1:.24});
      this.node('polygon',{points:row.points.map(t=>{const p=this.point(t);return p.x+','+p.y;}).join(' '),fill:color,'fill-opacity':active?.07:.015,stroke:color,'stroke-width':active?2.7:1.4,'stroke-opacity':active?1:.65},group);
      row.points.forEach((t,j)=>{const p=this.point(t),mark=this.node('g',{'data-event':id+':'+j},group);
        this.node('circle',{cx:p.x,cy:p.y,r:14,fill:color,opacity:0,'data-pulse':id+':'+j},mark);
        this.node('circle',{cx:p.x,cy:p.y,r:active?7:5,fill:color},mark);
      });
    }
    if(this.rows[selected]?.points.length){const p=this.point(this.rows[selected].points[0]);this.node('circle',{cx:p.x,cy:p.y,r:12,fill:'none',stroke:'var(--ink)','stroke-width':1.4,'pointer-events':'none'});}
    this.locator=this.node('line',{x1:this.cx,y1:this.cy,x2:this.cx,y2:this.cy-this.radius,stroke:'var(--ink)','stroke-width':1.2,opacity:0,'pointer-events':'none'});
    this.node('circle',{cx:this.cx,cy:this.cy,r:3,fill:'var(--muted)'});
  }
  local(e){const r=this.svg.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  angle(p){return XronoModel.wrap((Math.atan2(p.y-this.cy,p.x-this.cx)+Math.PI/2)/(Math.PI*2));}
  hit(p){
    const visible=this.rows.filter(row=>row.enabled||row.id===this.state.selected);
    const hits=visible.flatMap(row=>row.points.map((t,j)=>{const q=this.point(t);return{id:row.id,index:j,d:Math.hypot(p.x-q.x,p.y-q.y)};})).sort((a,b)=>a.d-b.d);
    if(hits[0]?.d<=26){const preferred=hits.find(h=>h.id===this.state.selected&&h.d<=hits[0].d+3);return preferred||hits[0];}
    const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
    const edges=visible.flatMap(row=>row.points.map((t,j)=>({id:row.id,index:j,d:distance(p,this.point(t),this.point(row.points[(j+1)%row.points.length]))}))).sort((a,b)=>a.d-b.d);
    return edges[0]?.d<=12?edges[0]:null;
  }
  down(e){
    if(this.drag||e.button!==0)return;const hit=this.hit(this.local(e));if(!hit)return;
    const phase=this.state.mode==='pb'?this.state.pb[hit.id].phase:this.state.wf.phase;
    this.drag={pointer:e.pointerId,id:hit.id,start:this.angle(this.local(e)),phase,moved:false};
    this.onSelect(hit.id);this.svg.setPointerCapture(e.pointerId);e.preventDefault();
  }
  move(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointer)return;
    const p=this.local(e);if(Math.hypot(p.x-this.cx,p.y-this.cy)<this.radius*.25)return;
    const delta=XronoModel.wrap(this.angle(p)-d.start+.5)-.5;
    if(!d.moved&&Math.abs(delta)<.001)return;
    d.moved=true;this.onRotate(d.id,XronoModel.wrap(d.phase+delta));e.preventDefault();
  }
  end(e,cancel){
    const d=this.drag;if(!d||e&&e.pointerId!==d.pointer)return;this.drag=null;
    if(this.svg.hasPointerCapture(d.pointer))this.svg.releasePointerCapture(d.pointer);
    if(cancel)this.onCancel(d.id,d.phase);else this.onCommit();
  }
  tick(cycle,playing,events,audioTime){
    if(!this.locator)return;
    const p=this.point(XronoModel.wrap(cycle));this.locator.setAttribute('x2',p.x);this.locator.setAttribute('y2',p.y);this.locator.setAttribute('opacity',playing?.5:0);
    this.svg.querySelectorAll('[data-pulse]').forEach(n=>n.setAttribute('opacity',0));
    if(!playing||this.reduced.matches)return;
    for(const event of events){
      const age=audioTime-event.time;if(age<0||age>.1)continue;
      const row=this.rows[event.part];if(!row)continue;
      const phase=XronoModel.wrap(event.cycle),index=row.points.findIndex(t=>Math.abs(t-phase)<1e-6);
      if(index>=0)this.svg.querySelector(`[data-pulse="${row.id}:${index}"]`)?.setAttribute('opacity',.5*(1-age/.1));
    }
  }
};
