/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A circular time diagram, not a second sequencer or animation engine. */
window.XronoView=class{
  constructor(svg,{onSelect,onRotate,onCommit,onCancel,onTreeAction}){
    Object.assign(this,{svg,onSelect,onRotate,onCommit,onCancel,onTreeAction});this.NS='http://www.w3.org/2000/svg';this.drag=null;
    this.colors=['#538e7a','#c18043','#727ec2','#b97192','#b49b36','#568fa9','#8b7b6d','#789643'];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));
    svg.addEventListener('pointerup',e=>this.end(e,false));svg.addEventListener('pointercancel',e=>this.end(e,true));
    svg.addEventListener('lostpointercapture',e=>this.end(e,true));
    svg.addEventListener('keydown',e=>{if(this.state?.mode!=='tree'||!['Enter',' '].includes(e.key))return;const target=e.target.closest('[data-tree-kind]');if(target){e.preventDefault();this.onTreeAction({kind:target.dataset.treeKind,key:target.dataset.treeKey});}});
    this.resize=new ResizeObserver(()=>{const w=svg.getBoundingClientRect().width;if(Math.abs(w-(this.width||0))>1)this.draw();});this.resize.observe(svg);
    window.addEventListener('blur',()=>this.end(null,true));
  }
  set(state,rows){this.state=state;this.rows=rows;this.draw();}
  node(name,attrs={},parent=this.svg){const n=document.createElementNS(this.NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
  point(t,r=this.radius){const a=t*Math.PI*2-Math.PI/2;return{x:this.cx+r*Math.cos(a),y:this.cy+r*Math.sin(a)};}
  draw(){
    if(!this.state)return;
    const focused=this.svg.contains(document.activeElement)?document.activeElement.closest?.('[data-tree-kind]'):null;
    const focus=focused?{kind:focused.dataset.treeKind,key:focused.dataset.treeKey}:null;
    const w=Math.max(260,this.svg.getBoundingClientRect().width),h=Math.min(660,w+8);this.width=w;this.cx=w/2;this.cy=h/2;this.radius=Math.min(w/2-35,h/2-36);
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=h+'px';this.svg.replaceChildren();
    const treeMode=this.state.mode==='tree';this.svg.setAttribute('role',treeMode?'group':'img');
    this.svg.setAttribute('aria-label',treeMode?'Дерево ритма: плюс делит интервал, минус сворачивает ветку, нажатие на ноту передаёт удар выбранному инструменту.':'Ритмические фигуры на общей окружности');
    this.node('title').textContent=treeMode?'Один оборот — один цикл. Плюс добавляет удар внутри интервала, минус объединяет ветку, цвет ноты показывает её инструмент.':'Один оборот — один цикл. Цветные вершины запускают звуки. Вращается только вся фигура; отдельные вершины зафиксированы.';
    this.node('circle',{cx:this.cx,cy:this.cy,r:this.radius,fill:'none',stroke:'var(--line)','stroke-width':1.5});
    const count=this.state.snap||16;
    for(let i=0;i<count;i++){const a=this.point(i/count,this.radius+7),b=this.point(i/count,this.radius+12);this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'var(--line)','stroke-width':1});}
    for(const[t,label]of[[0,'0'],[.25,'¼'],[.5,'½'],[.75,'¾']]){const p=this.point(t,this.radius+25),n=this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle'});n.textContent=label;}
    if(treeMode)this.drawTree();
    else{
    this.lastTreeStarts=null;
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
    }
    this.locator=this.node('line',{x1:this.cx,y1:this.cy,x2:this.cx,y2:this.cy-this.radius,stroke:'var(--ink)','stroke-width':1.2,opacity:0,'pointer-events':'none'});
    this.node('circle',{cx:this.cx,cy:this.cy,r:3,fill:'var(--muted)'});
    if(focus&&treeMode){const target=this.svg.querySelector(`[data-tree-kind="${focus.kind}"][data-tree-key="${focus.key}"]`)||this.svg.querySelector(`[data-tree-key="${focus.key}"]`);target?.focus?.({preventScroll:true});}
  }
  drawTree(){
    const T=XronoTree,geometry=T.geometry(this.state.tree),byKey=new Map([...geometry.leaves,...geometry.branches].map(n=>[n.key,n]));this.treeTargets=[];
    const isBranch=key=>geometry.branches.some(n=>n.key===key);
    const where=n=>isBranch(n.key)?this.point(n.start+n.length/2,this.radius*(.32+n.depth*.26)):this.point(n.start);
    const firstOwner=key=>geometry.leaves.find(n=>n.key.startsWith(key)).owner;
    const link=(a,b,color)=>{const control={x:(a.x+b.x)/2*.75+this.cx*.25,y:(a.y+b.y)/2*.75+this.cy*.25};this.node('path',{d:`M${a.x},${a.y} Q${control.x},${control.y} ${b.x},${b.y}`,fill:'none',stroke:color,'stroke-width':1.8,'stroke-opacity':.7});};
    for(let i=0;i<4;i++){const n=byKey.get(String(i));link(this.point((i+.5)/4,this.radius*.10),where(n),'var(--line)');}
    for(const n of geometry.branches)for(const side of ['L','R']){const child=byKey.get(n.key+side);link(where(n),where(child),this.colors[firstOwner(child.key)]);}
    const button=(kind,key,p,label,symbol,color)=>{
      const g=this.node('g',{'data-tree-kind':kind,'data-tree-key':key,role:'button',tabindex:0,'aria-label':label,class:'tree-target'});
      this.node('title',{},g).textContent=label;
      this.node('circle',{cx:p.x,cy:p.y,r:22,fill:'transparent'},g);
      this.node('circle',{cx:p.x,cy:p.y,r:11,fill:'var(--surface)',stroke:color,'stroke-width':1.5},g);
      const text=this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle','pointer-events':'none'},g);text.textContent=symbol;
      this.treeTargets.push({kind,key,...p});return g;
    };
    for(const n of geometry.branches){const count=geometry.leaves.filter(v=>v.key.startsWith(n.key)).length;button('merge',n.key,where(n),'Свернуть ветку: '+count+' удара → 1','−','var(--muted)');}
    for(const n of geometry.leaves){
      if(n.canSplit)button('split',n.key,this.point(n.start+n.length/2,this.radius*.85),'Разделить интервал: добавить '+XronoModel.instruments[this.state.selected].label,'+',this.colors[this.state.selected]);
      const p=this.point(n.start),g=button('paint',n.key,p,'Нота '+XronoModel.instruments[n.owner].label+': передать инструменту '+XronoModel.instruments[this.state.selected].label,'',this.colors[n.owner]);
      const index=this.rows[n.owner].points.indexOf(n.start);this.node('circle',{cx:p.x,cy:p.y,r:16,fill:this.colors[n.owner],opacity:0,'data-pulse':n.owner+':'+index},g);
      const dot=this.node('circle',{cx:p.x,cy:p.y,r:9,fill:this.colors[n.owner]},g);
      if(this.lastTreeStarts&&!this.lastTreeStarts.has(n.start)&&!this.reduced.matches){const a=this.node('animate',{attributeName:'r',from:2,to:9,dur:'160ms'},dot);a.beginElement?.();}
    }
    this.lastTreeStarts=new Set(geometry.leaves.map(n=>n.start));
  }
  local(e){const r=this.svg.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  angle(p){return XronoModel.wrap((Math.atan2(p.y-this.cy,p.x-this.cx)+Math.PI/2)/(Math.PI*2));}
  hit(p){
    if(this.state.mode==='tree'){const candidates=this.treeTargets.map(t=>({...t,d:Math.hypot(p.x-t.x,p.y-t.y)})).sort((a,b)=>a.d-b.d);return candidates[0]?.d<=22?candidates[0]:null;}
    const visible=this.rows.filter(row=>row.enabled||row.id===this.state.selected);
    const hits=visible.flatMap(row=>row.points.map((t,j)=>{const q=this.point(t);return{id:row.id,index:j,d:Math.hypot(p.x-q.x,p.y-q.y)};})).sort((a,b)=>a.d-b.d);
    if(hits[0]?.d<=26){const preferred=hits.find(h=>h.id===this.state.selected&&h.d<=hits[0].d+3);return preferred||hits[0];}
    const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
    const edges=visible.flatMap(row=>row.points.map((t,j)=>({id:row.id,index:j,d:distance(p,this.point(t),this.point(row.points[(j+1)%row.points.length]))}))).sort((a,b)=>a.d-b.d);
    return edges[0]?.d<=12?edges[0]:null;
  }
  down(e){
    if(this.drag||e.button!==0)return;const hit=this.hit(this.local(e));if(!hit)return;
    if(this.state.mode==='tree'){this.drag={tree:true,pointer:e.pointerId,hit,start:this.local(e),moved:false};this.svg.setPointerCapture(e.pointerId);e.preventDefault();return;}
    const phase=this.state.mode==='pb'?this.state.pb[hit.id].phase:this.state.wf.phase;
    this.drag={pointer:e.pointerId,id:hit.id,start:this.angle(this.local(e)),phase,moved:false};
    this.onSelect(hit.id);this.svg.setPointerCapture(e.pointerId);e.preventDefault();
  }
  move(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointer)return;
    if(d.tree){const p=this.local(e);if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>12)d.moved=true;e.preventDefault();return;}
    const p=this.local(e);if(Math.hypot(p.x-this.cx,p.y-this.cy)<this.radius*.25)return;
    const delta=XronoModel.wrap(this.angle(p)-d.start+.5)-.5;
    if(!d.moved&&Math.abs(delta)<.001)return;
    d.moved=true;this.onRotate(d.id,XronoModel.wrap(d.phase+delta));e.preventDefault();
  }
  end(e,cancel){
    const d=this.drag;if(!d||e&&e.pointerId!==d.pointer)return;this.drag=null;
    if(this.svg.hasPointerCapture(d.pointer))this.svg.releasePointerCapture(d.pointer);
    if(d.tree){if(!cancel&&!d.moved)this.onTreeAction({kind:d.hit.kind,key:d.hit.key});return;}
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
