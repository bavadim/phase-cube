/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A circular time diagram, not a second sequencer or animation engine. */
window.XronoView=class{
  constructor(svg,{onSelect,onRotate,onRatio,onCommit,onCancel,onRatioCancel,onTreeAction,onPatternAction}){
    Object.assign(this,{svg,onSelect,onRotate,onRatio,onCommit,onCancel,onRatioCancel,onTreeAction,onPatternAction});this.NS='http://www.w3.org/2000/svg';this.drag=null;
    this.colors=['#538e7a','#c18043','#727ec2','#b97192','#b49b36','#568fa9','#8b7b6d','#789643'];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    svg.addEventListener('pointerdown',e=>this.down(e));svg.addEventListener('pointermove',e=>this.move(e));
    svg.addEventListener('pointerup',e=>this.end(e,false));svg.addEventListener('pointercancel',e=>this.end(e,true));
    svg.addEventListener('lostpointercapture',e=>this.end(e,true));
    svg.addEventListener('keydown',e=>{
      const wf=e.target.closest('[data-wf-index]');
      if(wf&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
        e.preventDefault();const h=XronoModel.wfBoundaries(this.state.wf)[+wf.dataset.wfIndex],direction=Math.sign(h.a*this.state.wf.shorts-h.b*this.state.wf.longs);
        this.onRatio(e.key==='Home'?1:e.key==='End'?8:Math.max(1,Math.min(8,this.state.wf.ratio+(e.key==='ArrowRight'?1:-1)*direction*(e.shiftKey?.1:.01))));this.onCommit();return;
      }
      if(!['Enter',' '].includes(e.key))return;
      const target=e.target.closest('[data-tree-kind],[data-pattern-kind]');if(!target)return;e.preventDefault();
      if(target.dataset.treeKind)this.onTreeAction({kind:target.dataset.treeKind,key:target.dataset.treeKey});
      else this.onPatternAction({kind:target.dataset.patternKind,key:target.dataset.patternKey});
    });
    this.resize=new ResizeObserver(()=>{const w=svg.getBoundingClientRect().width;if(Math.abs(w-(this.width||0))>1)this.draw();});this.resize.observe(svg);
    window.addEventListener('blur',()=>this.end(null,true));
  }
  set(state,rows){this.state=state;this.rows=rows;this.draw();}
  node(name,attrs={},parent=this.svg){const n=document.createElementNS(this.NS,name);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent.append(n);return n;}
  point(t,r=this.radius){const a=t*Math.PI*2-Math.PI/2;return{x:this.cx+r*Math.cos(a),y:this.cy+r*Math.sin(a)};}
  draw(){
    if(!this.state)return;
    const focused=this.svg.contains(document.activeElement)?document.activeElement.closest?.('[data-tree-kind],[data-pattern-kind],[data-wf-index]'):null;
    const focus=focused?{...focused.dataset}:null;
    const w=Math.max(260,this.svg.getBoundingClientRect().width),h=Math.min(660,w+8);this.width=w;this.cx=w/2;this.cy=h/2;this.radius=Math.min(w/2-35,h/2-36);
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=h+'px';this.svg.replaceChildren();
    const treeMode=this.state.mode==='tree',wfMode=this.state.mode==='wf';this.svg.setAttribute('role','group');
    this.svg.setAttribute('aria-label',treeMode?'Дерево ритма: плюс делит интервал, минус сворачивает ветку, нажатие на ноту передаёт удар выбранному инструменту.':wfMode?'Интервалы WF: тяните крупные круглые границы для изменения L/s. Квадраты неподвижны.':'Фигуры: тяните ноту для вращения инструмента; плюс делит интервал, минус сворачивает ветку.');
    this.node('title').textContent=treeMode?'Один оборот — один цикл. Плюс добавляет удар внутри интервала, минус объединяет ветку, цвет ноты показывает её инструмент.':wfMode?'Начало цикла закреплено. Перетаскивание круглой границы растягивает длинные интервалы за счёт коротких.':'Один оборот — один цикл. Цветные вершины запускают звуки. Поворот и деление действуют только на выбранный инструмент.';
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
    if(wfMode)this.drawWF();else{
      if(this.rows[selected]?.points.length){const p=this.point(this.rows[selected].points[0]);this.node('circle',{cx:p.x,cy:p.y,r:12,fill:'none',stroke:'var(--ink)','stroke-width':1.4,'pointer-events':'none'});}
      this.drawDivisions();
    }
    }
    this.locator=this.node('line',{x1:this.cx,y1:this.cy,x2:this.cx,y2:this.cy-this.radius,stroke:'var(--ink)','stroke-width':1.2,opacity:0,'pointer-events':'none'});
    this.node('circle',{cx:this.cx,cy:this.cy,r:3,fill:'var(--muted)'});
    if(focus){
      let target;
      if(focus.treeKind&&treeMode)target=this.svg.querySelector(`[data-tree-kind="${focus.treeKind}"][data-tree-key="${focus.treeKey}"]`)||this.svg.querySelector(`[data-tree-key="${focus.treeKey}"]`);
      else if(focus.wfIndex!==undefined&&wfMode)target=this.svg.querySelector(`[data-wf-index="${focus.wfIndex}"]`);
      else if(focus.patternKind&&this.state.mode==='pb')target=this.svg.querySelector(`[data-pattern-kind="${focus.patternKind}"][data-pattern-key="${focus.patternKey}"]`)||this.svg.querySelector(`[data-pattern-key="${focus.patternKey}"]`);
      target?.focus?.({preventScroll:true});
    }
  }
  drawWF(){
    const w=this.state.wf,handles=XronoModel.wfBoundaries(w);this.wfTargets=[];
    const seen=new Set();
    handles.forEach((h,i)=>{
      const end=handles[i+1]?.time??1,r=this.radius*.88,a=this.point(h.time+w.phase,r),b=this.point(end+w.phase,r);
      this.node('path',{d:`M${a.x},${a.y} A${r},${r} 0 ${end-h.time>.5?1:0} 1 ${b.x},${b.y}`,fill:'none',stroke:h.letter==='L'?'var(--ink)':'var(--muted)','stroke-width':h.letter==='L'?3:1.5,'stroke-dasharray':h.letter==='L'?'none':'3 4','pointer-events':'none',opacity:.55});
      if(handles.length<=8||!seen.has(h.letter)){const p=this.point((h.time+end)/2+w.phase,this.radius*.77);this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle',class:'wf-interval','pointer-events':'none'}).textContent=h.letter;seen.add(h.letter);}
      const p=this.point(h.time+w.phase);
      if(!h.movable){this.node('rect',{x:p.x-5,y:p.y-5,width:10,height:10,rx:2,fill:'var(--ink)','pointer-events':'none'});return;}
      const g=this.node('g',{'data-wf-index':i,role:'slider',tabindex:0,'aria-label':'Граница длинного и короткого интервалов','aria-valuemin':1,'aria-valuemax':8,'aria-valuenow':+w.ratio.toFixed(4),'aria-valuetext':'L/s = '+Number(w.ratio.toFixed(3)),class:'wf-target'});
      this.node('circle',{...{cx:p.x,cy:p.y},r:22,fill:'transparent'},g);
      this.node('circle',{cx:p.x,cy:p.y,r:10,fill:'var(--surface)',stroke:'var(--ink)','stroke-width':2},g);
      this.node('circle',{cx:p.x,cy:p.y,r:4,fill:this.colors[0],'pointer-events':'none'},g);
      this.wfTargets.push({...h,...p,wf:true});
    });
    this.node('text',{x:this.cx,y:this.cy+22,'text-anchor':'middle',class:'wf-readout','pointer-events':'none'}).textContent='L/s '+Number(w.ratio.toFixed(3));
  }
  actionButton(kind,key,p,label,color,pattern=false){
    const prefix=pattern?'pattern':'tree',g=this.node('g',{['data-'+prefix+'-kind']:kind,['data-'+prefix+'-key']:key,role:'button',tabindex:0,'aria-label':label,class:'tree-target'});
    this.node('title',{},g).textContent=label;
    this.node('circle',{cx:p.x,cy:p.y,r:22,fill:'transparent'},g);
    this.node('circle',{cx:p.x,cy:p.y,r:11,fill:'var(--surface)',stroke:color,'stroke-width':1.5},g);
    this.node('text',{x:p.x,y:p.y+5,'text-anchor':'middle','pointer-events':'none'},g).textContent=kind==='split'?'+':kind==='merge'?'−':'';
    return g;
  }
  drawDivisions(){
    const p=this.state.pb[this.state.selected],geometry=XronoModel.patternGeometry(p),color=this.colors[this.state.selected];this.divisionTargets=[];
    const byKey=new Map([...geometry.leaves,...geometry.branches].map(n=>[n.key,n])),branchKeys=new Set(geometry.branches.map(n=>n.key));
    const where=n=>branchKeys.has(n.key)?this.point(n.start+n.length/2+p.phase,this.radius*(.32+n.depth*.25)):this.point(n.start+p.phase);
    for(const n of geometry.branches)for(const side of ['L','R']){
      const a=where(n),b=where(byKey.get(n.key+side));this.node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':1.2,opacity:.45,'pointer-events':'none'});
    }
    const target=(kind,n,r)=>{const point=this.point(n.start+n.length/2+p.phase,this.radius*r);this.actionButton(kind,n.key,point,kind==='split'?'Разделить интервал выбранного инструмента':'Свернуть ветку выбранного инструмента',color,true);this.divisionTargets.push({kind,key:n.key,...point,pattern:true});};
    for(const n of geometry.branches)target('merge',n,.32+n.depth*.25);
    for(const n of geometry.leaves)if(n.canSplit)target('split',n,.82);
  }
  drawTree(){
    const T=XronoTree,geometry=T.geometry(this.state.tree),byKey=new Map([...geometry.leaves,...geometry.branches].map(n=>[n.key,n]));this.treeTargets=[];
    const isBranch=key=>geometry.branches.some(n=>n.key===key);
    const where=n=>isBranch(n.key)?this.point(n.start+n.length/2,this.radius*(.32+n.depth*.26)):this.point(n.start);
    const firstOwner=key=>geometry.leaves.find(n=>n.key.startsWith(key)).owner;
    const link=(a,b,color)=>{const control={x:(a.x+b.x)/2*.75+this.cx*.25,y:(a.y+b.y)/2*.75+this.cy*.25};this.node('path',{d:`M${a.x},${a.y} Q${control.x},${control.y} ${b.x},${b.y}`,fill:'none',stroke:color,'stroke-width':1.8,'stroke-opacity':.7});};
    for(let i=0;i<4;i++){const n=byKey.get(String(i));link(this.point((i+.5)/4,this.radius*.10),where(n),'var(--line)');}
    for(const n of geometry.branches)for(const side of ['L','R']){const child=byKey.get(n.key+side);link(where(n),where(child),this.colors[firstOwner(child.key)]);}
    const button=(kind,key,p,label,color)=>{
      const g=this.actionButton(kind,key,p,label,color);
      this.treeTargets.push({kind,key,...p});return g;
    };
    for(const n of geometry.branches){const count=geometry.leaves.filter(v=>v.key.startsWith(n.key)).length;button('merge',n.key,where(n),'Свернуть ветку: '+count+' удара → 1','var(--muted)');}
    for(const n of geometry.leaves){
      if(n.canSplit)button('split',n.key,this.point(n.start+n.length/2,this.radius*.85),'Разделить интервал: добавить '+XronoModel.instruments[this.state.selected].label,this.colors[this.state.selected]);
      const p=this.point(n.start),g=button('paint',n.key,p,'Нота '+XronoModel.instruments[n.owner].label+': передать инструменту '+XronoModel.instruments[this.state.selected].label,this.colors[n.owner]);
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
    const controls=this.state.mode==='wf'?this.wfTargets:this.divisionTargets;
    const control=controls?.map(t=>({...t,d:Math.hypot(p.x-t.x,p.y-t.y)})).sort((a,b)=>a.d-b.d)[0];
    const visible=this.rows.filter(row=>row.enabled||row.id===this.state.selected);
    const hits=visible.flatMap(row=>row.points.map((t,j)=>{const q=this.point(t);return{id:row.id,index:j,d:Math.hypot(p.x-q.x,p.y-q.y)};})).sort((a,b)=>a.d-b.d);
    if(control?.d<=22&&control.d<=(hits[0]?.d??Infinity)+(this.state.mode==='wf'?3:0))return control;
    if(hits[0]?.d<=26){const preferred=hits.find(h=>h.id===this.state.selected&&h.d<=hits[0].d+3);return preferred||hits[0];}
    const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
    const edges=visible.flatMap(row=>row.points.map((t,j)=>({id:row.id,index:j,d:distance(p,this.point(t),this.point(row.points[(j+1)%row.points.length]))}))).sort((a,b)=>a.d-b.d);
    return edges[0]?.d<=12?edges[0]:null;
  }
  down(e){
    if(this.drag||e.button!==0)return;const hit=this.hit(this.local(e));if(!hit)return;
    if(this.state.mode==='tree'||hit.pattern){this.drag={tree:this.state.mode==='tree',pattern:!!hit.pattern,pointer:e.pointerId,hit,start:this.local(e),moved:false};this.svg.setPointerCapture(e.pointerId);e.preventDefault();return;}
    if(this.state.mode==='wf'){
      if(!hit.wf){this.onSelect(hit.id);e.preventDefault();return;}
      this.drag={wf:true,pointer:e.pointerId,index:hit.index,ratio:this.state.wf.ratio,time:hit.time,last:this.angle(this.local(e)),delta:0};this.svg.setPointerCapture(e.pointerId);e.preventDefault();return;
    }
    const phase=this.state.mode==='pb'?this.state.pb[hit.id].phase:this.state.wf.phase;
    this.drag={pointer:e.pointerId,id:hit.id,start:this.angle(this.local(e)),phase,moved:false};
    this.onSelect(hit.id);this.svg.setPointerCapture(e.pointerId);e.preventDefault();
  }
  move(e){
    const d=this.drag;if(!d||e.pointerId!==d.pointer)return;
    if(d.tree||d.pattern){const p=this.local(e);if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>12)d.moved=true;e.preventDefault();return;}
    const p=this.local(e);if(Math.hypot(p.x-this.cx,p.y-this.cy)<this.radius*.25)return;
    if(d.wf){const angle=this.angle(p);d.delta+=XronoModel.wrap(angle-d.last+.5)-.5;d.last=angle;this.onRatio(XronoModel.ratioAtBoundary(this.state.wf,d.index,d.time+d.delta));e.preventDefault();return;}
    const delta=XronoModel.wrap(this.angle(p)-d.start+.5)-.5;
    if(!d.moved&&Math.abs(delta)<.001)return;
    d.moved=true;this.onRotate(d.id,XronoModel.wrap(d.phase+delta));e.preventDefault();
  }
  end(e,cancel){
    const d=this.drag;if(!d||e&&e.pointerId!==d.pointer)return;this.drag=null;
    if(this.svg.hasPointerCapture(d.pointer))this.svg.releasePointerCapture(d.pointer);
    if(d.tree||d.pattern){if(!cancel&&!d.moved)(d.tree?this.onTreeAction:this.onPatternAction)({kind:d.hit.kind,key:d.hit.key});return;}
    if(d.wf){if(cancel)this.onRatioCancel(d.ratio);else this.onCommit();return;}
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
