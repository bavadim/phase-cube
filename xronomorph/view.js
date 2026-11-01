/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* SVG geometry/picking only. Native Strudel owns musical time and sound. */
window.XronoView=class{
  constructor(svg,callbacks){
    Object.assign(this,{svg,...callbacks});this.NS='http://www.w3.org/2000/svg';this.drag=null;this.hover=null;this.removeGroup=null;
    this.colors=['#538e7a','#c18043','#727ec2','#b97192','#b49b36','#568fa9'];this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));
    svg.addEventListener('pointerleave',()=>{if(!this.drag&&this.hover){this.hover=null;this.draw();}});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])svg.addEventListener(type,e=>this.end(e,type!=='pointerup'));
    svg.addEventListener('keydown',e=>{
      const action=e.target.closest('[data-action]'),note=e.target.closest('[data-note]');
      if(action&&['Enter',' '].includes(e.key)){e.preventDefault();this.onAction({kind:'split',arc:+action.dataset.index,at:+action.dataset.at});}
      else if(note&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();this.onNudge(+note.dataset.part,(e.key==='ArrowRight'?1:-1)*(e.shiftKey?10:1)/360);}
    });
    svg.addEventListener('focusin',e=>{const a=e.target.closest('[data-action]');if(a&&!this.drag&&this.hover?.index!==+a.dataset.index){this.hover={kind:'split',index:+a.dataset.index};this.draw();}});
    svg.addEventListener('focusout',e=>{if(!svg.contains(e.relatedTarget)&&!this.drag&&this.hover){this.hover=null;this.draw();}});
    window.addEventListener('keydown',e=>{if(e.key==='Escape')this.end(null,true);});window.addEventListener('blur',()=>this.end(null,true));
    this.resize=new ResizeObserver(()=>{if(Math.abs(svg.getBoundingClientRect().width-(this.width||0))>1)this.draw();});this.resize.observe(svg);
  }
  color(p){return this.colors[XronoModel.instruments.findIndex(i=>i.id===p.instrument)];}
  set(state,rows){if(this.selected!==state.selected)this.hover=null;this.selected=state.selected;this.state=state;this.rows=rows;this.draw();}
  removal(id){this.removeGroup=id;this.draw();}
  node(name,attrs={},parent=this.svg){const n=document.createElementNS(this.NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
  point(t,r=this.radius){const a=t*Math.PI*2-Math.PI/2;return{x:this.cx+r*Math.cos(a),y:this.cy+r*Math.sin(a)};}
  arc(start,length,r,attrs){
    const a=this.point(start,r),b=this.point(start+length,r);
    if(length>1-1e-8)return this.node('circle',{cx:this.cx,cy:this.cy,r,fill:'none',...attrs});
    return this.node('path',{d:`M${a.x},${a.y} A${r},${r} 0 ${length>.5?1:0} 1 ${b.x},${b.y}`,fill:'none',...attrs});
  }
  polygon(times,color,attrs={},parent=this.svg){
    const points=times.map(t=>this.point(t));
    if(points.length===2){const[a,b]=points;return this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,...attrs},parent);}
    if(points.length>2)return this.node('polygon',{points:points.map(p=>p.x+','+p.y).join(' '),fill:'none',stroke:color,...attrs},parent);
  }
  packetPreview(index,at){
    const M=XronoModel,p=this.state.parts[this.state.selected],arc=M.arcs(p)[index],gap=3/(M.TAU*this.radius);
    if(at==null&&arc)at=M.splitOptions(p,this.state.arity,arc,M.allowed(p,this.state.arity,gap)).at;
    const v=M.preview(this.state,this.state.selected,index,at);
    if(v.valid&&v.points.some(t=>M.events(p).some(e=>Math.abs(M.wrap(t-e.time+.5)-.5)<gap)))return{...v,valid:false,reason:'Одна из связанных нот совпадает с существующей',affected:[]};
    return v;
  }
  draw(){
    if(!this.state||this.drawing)return;this.drawing=true;
    try{
    const M=XronoModel,focused=this.svg.contains(document.activeElement)?document.activeElement.closest?.('[data-action],[data-note]'):null,focus=focused?{...focused.dataset}:null;
    const w=Math.max(260,this.svg.getBoundingClientRect().width),h=Math.min(660,w+8);this.width=w;this.cx=w/2;this.cy=h/2;this.radius=Math.min(w/2-35,h/2-36);
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=h+'px';this.svg.replaceChildren();this.targets=[];
    this.node('title').textContent='Один круг — один цикл. Нота вращает весь инструмент. Плюс добавляет связанную пару или тройку. Дерево справа позволяет удалить целую ветвь.';
    this.node('circle',{cx:this.cx,cy:this.cy,r:this.radius,fill:'none',stroke:'var(--line)','stroke-width':1.5});
    for(let i=0;i<16;i++){const a=this.point(i/16,this.radius+7),b=this.point(i/16,this.radius+12);this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'var(--line)'});}
    for(const[t,label]of[[0,'0'],[.25,'¼'],[.5,'½'],[.75,'¾']]){const p=this.point(t,this.radius+25);this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle'}).textContent=label;}
    const selected=this.state.selected,part=this.state.parts[selected],color=this.color(part),arcs=M.arcs(part),domains=M.allowed(part,this.state.arity,3/(M.TAU*this.radius)),d=this.drag;
    let preview=null;
    if(d?.kind==='split')preview=this.packetPreview(d.arc.index,d.at);
    else if(this.hover?.kind==='split'&&arcs[this.hover.index])preview=this.packetPreview(this.hover.index);
    const removing=M.inspect(part).find(g=>g.id===this.removeGroup)?.subtreeIds||[];
    const order=this.rows.filter(p=>p.enabled&&p.id!==selected).concat(this.rows[selected]);
    for(const row of order){
      const c=this.color(row),active=row.id===selected,group=this.node('g',{'data-layer':row.id,opacity:row.enabled?1:.3});
      this.polygon(row.points,c,{'stroke-width':active?2:1.2,'stroke-opacity':active?.6:.25},group);
      if(active)for(const g of M.inspect(part))this.polygon(g.points.map(t=>M.wrap(t+part.phase)),c,{'stroke-width':removing.includes(g.id)?3:1,'stroke-dasharray':'4 5','stroke-opacity':removing.includes(g.id)?.9:.22},group);
      row.events.forEach((event,j)=>{
        const p=this.point(event.time),mark=this.node('g',{'data-note':event.index,'data-part':row.id,'data-group':event.group,role:'slider',tabindex:0,'aria-label':row.label+': вращение всего рисунка','aria-valuemin':0,'aria-valuemax':360,'aria-valuenow':Math.round(row.phase*360),class:'note-target'},group);
        this.node('circle',{cx:p.x,cy:p.y,r:14,fill:c,opacity:0,'data-pulse':row.id+':'+j},mark);
        this.node('circle',{cx:p.x,cy:p.y,r:active?7:5,fill:c,opacity:active&&removing.includes(event.group)?.25:1},mark);
      });
    }
    for(const arc of arcs){
      const affected=preview?.valid&&preview.affected.includes(arc.index);
      this.arc(arc.start+part.phase,arc.length,this.radius*.94,{stroke:color,'stroke-width':affected?4:2,'stroke-opacity':affected?.85:.25,'stroke-dasharray':arc.empty?'4 6':'none'});
      const option=M.splitOptions(part,this.state.arity,arc,domains),at=d?.kind==='split'&&d.arc.index===arc.index?d.at:option.at;
      if(at!=null)this.button(arc.index,at,this.point(at+part.phase,this.radius*.80),'+'+this.state.arity,arc.empty?'Добавить первую '+(this.state.arity===2?'пару':'тройку'):'Добавить '+this.state.arity+' связанные ноты: нажмите или потяните плюс',color);
    }
    if(preview){
      const c=preview.valid?color:'var(--invalid)',times=preview.points.map(t=>M.wrap(t+part.phase));
      this.polygon(times,c,{'stroke-width':2,'stroke-dasharray':'5 4','data-preview-packet':preview.order});
      for(const t of times){const p=this.point(t);this.node('circle',{cx:p.x,cy:p.y,r:10,fill:'var(--surface)',stroke:c,'stroke-width':2.5,'data-preview-note':true});}
    }
    const b=this.rows[selected].balance;
    this.node('path',{d:`M${this.cx-8},${this.cy}h16 M${this.cx},${this.cy-8}v16`,stroke:'var(--muted)',opacity:.45});
    this.node('circle',{cx:this.cx+b.y*this.radius,cy:this.cy-b.x*this.radius,r:4,fill:color,'data-balance':b.residual,'data-empty':b.empty});
    this.node('text',{x:this.cx,y:this.cy+27,'text-anchor':'middle',class:'balance-label'}).textContent=b.empty?'Нет нот':'Баланс';
    this.locator=this.node('line',{x1:this.cx,y1:this.cy,x2:this.cx,y2:this.cy-this.radius,stroke:'var(--ink)','stroke-width':1.2,opacity:0});
    this.onPreview?.(preview?(preview.valid?`${preview.order===2?'Пара':'Тройка'}: ${preview.order} связанные ноты · баланс сохранён`:preview.reason):removing.length?'Удаляется целая ветвь со всеми потомками':'');
    if(focus){const selector=focus.action?`[data-action="split"][data-index="${focus.index}"]`:`[data-note="${focus.note}"][data-part="${focus.part}"]`;const target=this.svg.querySelector(selector)||this.svg.querySelector('[data-action="split"]');target?.focus?.({preventScroll:true});}
    }finally{this.drawing=false;}
  }
  button(index,at,p,symbol,label,color){
    const g=this.node('g',{'data-action':'split','data-index':index,'data-at':at,role:'button',tabindex:0,'aria-label':label,class:'arc-target'});
    this.node('title',{},g).textContent=label;this.node('circle',{cx:p.x,cy:p.y,r:22,fill:'transparent'},g);this.node('circle',{cx:p.x,cy:p.y,r:15,fill:'var(--surface)',stroke:color,'stroke-width':1.6},g);
    this.node('text',{x:p.x,y:p.y+4,'text-anchor':'middle'},g).textContent=symbol;this.targets.push({kind:'split',index,at,...p});
  }
  local(e){const b=this.svg.getBoundingClientRect();return{x:e.clientX-b.x,y:e.clientY-b.y};}
  angle(p){return XronoModel.wrap((Math.atan2(p.y-this.cy,p.x-this.cx)+Math.PI/2)/(2*Math.PI));}
  hit(p){
    const controls=this.targets.map(t=>({...t,d:Math.hypot(p.x-t.x,p.y-t.y)})).sort((a,b)=>a.d-b.d),notes=this.rows.filter(r=>r.enabled||r.id===this.state.selected).flatMap(r=>r.events.map(e=>{const q=this.point(e.time);return{kind:'rotate',id:r.id,index:e.index,d:Math.hypot(p.x-q.x,p.y-q.y)};})).sort((a,b)=>a.d-b.d);
    if(controls[0]?.d<=22&&controls[0].d<=(notes[0]?.d??Infinity))return controls[0];
    if(notes[0]?.d<=24)return notes.find(n=>n.id===this.state.selected&&n.d<=notes[0].d+3)||notes[0];return null;
  }
  down(e){
    if(this.drag||e.button!==0)return;const M=XronoModel,p=this.local(e),hit=this.hit(p);if(!hit)return;this.hover=null;
    if(hit.kind==='rotate'){
      this.onSelect(hit.id);this.onRotateStart();this.drag={kind:'rotate',pointer:e.pointerId,id:hit.id,phase:this.state.parts[hit.id].phase,last:this.angle(p),delta:0};
    }else{
      const part=this.state.parts[this.state.selected],arc=M.arcs(part)[hit.index],at=hit.at;this.drag={kind:'split',pointer:e.pointerId,arc,at,initialAt:at,last:this.angle(p),delta:0,start:p,moved:false};
    }
    this.svg.setPointerCapture(e.pointerId);e.preventDefault();this.draw();
  }
  move(e){
    const d=this.drag,p=this.local(e);if(!d){const hit=this.hit(p),next=hit?.kind==='split'?{kind:'split',index:hit.index}:null;this.svg.style.cursor=hit?'grab':'default';if(this.hover?.index!==next?.index){this.hover=next;this.draw();}return;}if(d.pointer!==e.pointerId)return;e.preventDefault();
    if(Math.hypot(p.x-this.cx,p.y-this.cy)<this.radius*.25)return;
    const M=XronoModel,angle=this.angle(p);d.delta+=M.wrap(angle-d.last+.5)-.5;d.last=angle;
    if(d.kind==='rotate'){this.onRotate(d.id,d.phase+d.delta);return;}
    if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>4)d.moved=true;
    d.at=d.arc.empty?M.wrap(d.initialAt+d.delta):Math.max(d.arc.start+M.EPS*2,Math.min(d.arc.start+d.arc.length-M.EPS*2,d.initialAt+d.delta));this.draw();
  }
  end(e,cancel){
    const d=this.drag;if(!d||e&&e.pointerId!==d.pointer)return;this.drag=null;this.hover=null;if(this.svg.hasPointerCapture(d.pointer))this.svg.releasePointerCapture(d.pointer);
    if(d.kind==='rotate')this.onRotateEnd(cancel);
    else if(!cancel&&this.packetPreview(d.arc.index,d.at).valid)this.onAction({kind:'split',arc:d.arc.index,at:d.at});
    this.draw();
  }
  tick(cycle,playing,events,audioTime){
    if(!this.locator)return;const p=this.point(XronoModel.wrap(cycle));this.locator.setAttribute('x2',p.x);this.locator.setAttribute('y2',p.y);this.locator.setAttribute('opacity',playing?.5:0);
    this.svg.querySelectorAll('[data-pulse]').forEach(n=>n.setAttribute('opacity',0));if(!playing||this.reduced.matches)return;
    for(const event of events){const age=audioTime-event.time,row=this.rows[event.part];if(age<0||age>.1||!row)continue;const phase=XronoModel.wrap(event.cycle),index=row.points.findIndex(t=>Math.abs(t-phase)<1e-6);if(index>=0)this.svg.querySelector(`[data-pulse="${row.id}:${index}"]`)?.setAttribute('opacity',.5*(1-age/.1));}
  }
};
