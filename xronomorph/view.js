/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* SVG only: time lives on the circumference; chords are a visual aid. */
window.XronoView=class{
  constructor(svg,callbacks){
    Object.assign(this,{svg,...callbacks});this.NS='http://www.w3.org/2000/svg';this.drag=null;
    this.colors=['#538e7a','#c18043','#727ec2','#b97192','#b49b36','#568fa9'];this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));
    for(const type of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(type,e=>this.end(e,type!=='pointerup'));
    svg.addEventListener('keydown',e=>{
      const action=e.target.closest('[data-action]'),note=e.target.closest('[data-note]');
      if(action&&['Enter',' '].includes(e.key)){e.preventDefault();this.onAction(action.dataset.action==='split'?{kind:'split',arc:+action.dataset.index}:{kind:'merge',event:+action.dataset.index});}
      else if(note&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.onNudge(+note.dataset.part,(e.key==='ArrowRight'?1:-1)*(e.shiftKey?10:1)/360);}
    });
    window.addEventListener('keydown',e=>{if(e.key==='Escape')this.end(null,true);});window.addEventListener('blur',()=>this.end(null,true));
    this.resize=new ResizeObserver(()=>{if(Math.abs(svg.getBoundingClientRect().width-(this.width||0))>1)this.draw();});this.resize.observe(svg);
  }
  color(p){return this.colors[XronoModel.instruments.findIndex(i=>i.id===p.instrument)];}
  set(state,rows){this.state=state;this.rows=rows;this.draw();}
  node(name,attrs={},parent=this.svg){const n=document.createElementNS(this.NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
  point(t,r=this.radius){const a=t*Math.PI*2-Math.PI/2;return{x:this.cx+r*Math.cos(a),y:this.cy+r*Math.sin(a)};}
  arc(start,length,r,attrs){
    const a=this.point(start,r),b=this.point(start+length,r);
    if(length>1-1e-8)return this.node('circle',{cx:this.cx,cy:this.cy,r,fill:'none',...attrs});
    return this.node('path',{d:`M${a.x},${a.y} A${r},${r} 0 ${length>.5?1:0} 1 ${b.x},${b.y}`,fill:'none',...attrs});
  }
  draw(){
    if(!this.state)return;
    const focused=this.svg.contains(document.activeElement)?document.activeElement.closest?.('[data-action],[data-note]'):null,focus=focused?{...focused.dataset}:null;
    const w=Math.max(260,this.svg.getBoundingClientRect().width),h=Math.min(660,w+8);this.width=w;this.cx=w/2;this.cy=h/2;this.radius=Math.min(w/2-35,h/2-36);
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=h+'px';this.svg.replaceChildren();this.targets=[];
    this.node('title').textContent='Один круг — один цикл. Перетаскивание ноты вращает инструмент. Плюс делит дугу и добавляет ноту, минус объединяет дуги.';
    this.node('circle',{cx:this.cx,cy:this.cy,r:this.radius,fill:'none',stroke:'var(--line)','stroke-width':1.5});
    for(let i=0;i<16;i++){const a=this.point(i/16,this.radius+7),b=this.point(i/16,this.radius+12);this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'var(--line)'});}
    for(const[t,label]of[[0,'0'],[.25,'¼'],[.5,'½'],[.75,'¾']]){const p=this.point(t,this.radius+25);this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle'}).textContent=label;}
    const selected=this.state.selected,order=this.rows.filter(p=>p.enabled&&p.id!==selected).concat(this.rows[selected]);
    for(const row of order){
      const color=this.color(row),active=row.id===selected,group=this.node('g',{'data-layer':row.id,opacity:row.enabled?1:.3});
      if(row.points.length===2){const a=this.point(row.points[0]),b=this.point(row.points[1]);this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':active?2.7:1.4},group);}
      else if(row.points.length>2)this.node('polygon',{points:row.points.map(t=>{const p=this.point(t);return p.x+','+p.y;}).join(' '),fill:color,'fill-opacity':active?.06:.01,stroke:color,'stroke-width':active?2.7:1.4,'stroke-opacity':active?1:.6},group);
      row.events.forEach((event,j)=>{
        const p=this.point(event.time),mark=this.node('g',{'data-note':event.index,'data-part':row.id,role:'slider',tabindex:0,'aria-label':row.label+': вращение всего рисунка','aria-valuemin':0,'aria-valuemax':360,'aria-valuenow':Math.round(row.phase*360),class:'note-target'},group);
        this.node('circle',{cx:p.x,cy:p.y,r:14,fill:color,opacity:0,'data-pulse':row.id+':'+j},mark);
        this.node('circle',{cx:p.x,cy:p.y,r:active?7:5,fill:color},mark);
      });
    }
    const part=this.state.parts[selected],color=this.color(part),arcs=XronoModel.arcs(part),d=this.drag;
    for(const arc of arcs){
      this.arc(arc.start+part.phase,arc.length,this.radius*.94,{stroke:color,'stroke-width':2,'stroke-opacity':.35,'stroke-dasharray':arc.empty?'4 6':'none','pointer-events':'none'});
      const at=d?.kind==='split'&&d.arc.index===arc.index?d.at:arc.empty?0:arc.start+arc.length/2;
      const enabled=part.points.length<XronoModel.maxEvents&&(arc.empty||arc.length>XronoModel.EPS*4);
      if(enabled)this.button('split',arc.index,this.point(at+part.phase,this.radius*.82),'+',arc.empty?'Добавить первую ноту':'Разделить дугу: нажмите для середины или потяните к нужной точке',color);
    }
    part.points.forEach((t,index)=>{
      const p=this.point(t+part.phase,this.radius*.55),end=this.point(t+part.phase,this.radius-14);
      this.node('line',{x1:p.x,y1:p.y,x2:end.x,y2:end.y,stroke:color,opacity:.25,'pointer-events':'none'});
      this.button('merge',index,p,'−','Убрать ноту и объединить соседние дуги',color);
    });
    if(d?.kind==='split'&&d.moved){
      const p=this.point(d.at+part.phase);this.node('circle',{cx:p.x,cy:p.y,r:9,fill:'var(--surface)',stroke:color,'stroke-width':2,'stroke-dasharray':'3 2','pointer-events':'none'});
      this.node('text',{x:this.cx,y:this.cy+24,'text-anchor':'middle','pointer-events':'none',class:'preview-label'}).textContent='Новая нота';
    }
    this.locator=this.node('line',{x1:this.cx,y1:this.cy,x2:this.cx,y2:this.cy-this.radius,stroke:'var(--ink)','stroke-width':1.2,opacity:0,'pointer-events':'none'});this.node('circle',{cx:this.cx,cy:this.cy,r:3,fill:'var(--muted)'});
    if(focus){const selector=focus.action?`[data-action="${focus.action}"][data-index="${focus.index}"]`:`[data-note="${focus.note}"][data-part="${focus.part}"]`;const target=this.svg.querySelector(selector)||this.svg.querySelector('[data-action="split"]');target?.focus?.({preventScroll:true});}
  }
  button(kind,index,p,symbol,label,color){
    const g=this.node('g',{'data-action':kind,'data-index':index,role:'button',tabindex:0,'aria-label':label,class:'arc-target'});
    this.node('title',{},g).textContent=label;this.node('circle',{cx:p.x,cy:p.y,r:22,fill:'transparent'},g);this.node('circle',{cx:p.x,cy:p.y,r:12,fill:'var(--surface)',stroke:color,'stroke-width':1.6},g);
    this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle','pointer-events':'none'},g).textContent=symbol;this.targets.push({kind,index,...p});
  }
  local(e){const b=this.svg.getBoundingClientRect();return{x:e.clientX-b.x,y:e.clientY-b.y};}
  angle(p){return XronoModel.wrap((Math.atan2(p.y-this.cy,p.x-this.cx)+Math.PI/2)/(2*Math.PI));}
  hit(p){
    const controls=this.targets.map(t=>({...t,d:Math.hypot(p.x-t.x,p.y-t.y)})).sort((a,b)=>a.d-b.d),notes=this.rows.filter(r=>r.enabled||r.id===this.state.selected).flatMap(r=>r.events.map(e=>{const q=this.point(e.time);return{kind:'rotate',id:r.id,index:e.index,d:Math.hypot(p.x-q.x,p.y-q.y)};})).sort((a,b)=>a.d-b.d);
    if(controls[0]?.d<=22&&controls[0].d<=(notes[0]?.d??Infinity))return controls[0];
    if(notes[0]?.d<=24)return notes.find(n=>n.id===this.state.selected&&n.d<=notes[0].d+3)||notes[0];return null;
  }
  down(e){
    if(this.drag||e.button!==0)return;const p=this.local(e),hit=this.hit(p);if(!hit)return;
    if(hit.kind==='rotate'){
      this.onSelect(hit.id);this.onRotateStart();this.drag={kind:'rotate',pointer:e.pointerId,id:hit.id,phase:this.state.parts[hit.id].phase,last:this.angle(p),delta:0};
    }else if(hit.kind==='split'){
      const arc=XronoModel.arcs(this.state.parts[this.state.selected])[hit.index];this.drag={kind:'split',pointer:e.pointerId,arc,at:arc.empty?0:arc.start+arc.length/2,last:this.angle(p),delta:0,start:p,moved:false};
    }else this.drag={kind:'merge',pointer:e.pointerId,index:hit.index,start:p,moved:false};
    this.svg.setPointerCapture(e.pointerId);e.preventDefault();
  }
  move(e){
    const d=this.drag;if(!d){const hit=this.hit(this.local(e));this.svg.style.cursor=hit?(hit.kind==='merge'?'pointer':'grab'):'default';return;}if(d.pointer!==e.pointerId)return;const p=this.local(e);e.preventDefault();
    if(d.kind==='merge'){if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>12)d.moved=true;return;}
    if(Math.hypot(p.x-this.cx,p.y-this.cy)<this.radius*.25)return;
    const angle=this.angle(p);d.delta+=XronoModel.wrap(angle-d.last+.5)-.5;d.last=angle;
    if(d.kind==='rotate'){this.onRotate(d.id,d.phase+d.delta);return;}
    if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>4)d.moved=true;
    d.at=d.arc.empty?XronoModel.wrap(d.delta):Math.max(d.arc.start+XronoModel.EPS*2,Math.min(d.arc.start+d.arc.length-XronoModel.EPS*2,d.arc.start+d.arc.length/2+d.delta));this.draw();
  }
  end(e,cancel){
    const d=this.drag;if(!d||e&&e.pointerId!==d.pointer)return;this.drag=null;if(this.svg.hasPointerCapture(d.pointer))this.svg.releasePointerCapture(d.pointer);
    if(d.kind==='rotate')this.onRotateEnd(cancel);
    else if(!cancel){if(d.kind==='split')this.onAction({kind:'split',arc:d.arc.index,at:d.moved?d.at:undefined});else if(!d.moved)this.onAction({kind:'merge',event:d.index});}
    this.draw();
  }
  tick(cycle,playing,events,audioTime){
    if(!this.locator)return;const p=this.point(XronoModel.wrap(cycle));this.locator.setAttribute('x2',p.x);this.locator.setAttribute('y2',p.y);this.locator.setAttribute('opacity',playing?.5:0);
    this.svg.querySelectorAll('[data-pulse]').forEach(n=>n.setAttribute('opacity',0));if(!playing||this.reduced.matches)return;
    for(const event of events){const age=audioTime-event.time,row=this.rows[event.part];if(age<0||age>.1||!row)continue;const phase=XronoModel.wrap(event.cycle),index=row.points.findIndex(t=>Math.abs(t-phase)<1e-6);if(index>=0)this.svg.querySelector(`[data-pulse="${row.id}:${index}"]`)?.setAttribute('opacity',.5*(1-age/.1));}
  }
};
