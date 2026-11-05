/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.ConveyorSampleGear = (() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const TAU = 2 * Math.PI, STEPS = 64, TILT = .72;
  const CENTER_X = 17, RADIUS = 155, PINION = RADIUS / 4, FACE = 27;
  const NAMES = {kick:'Бочка',bass:'Бас',hook:'Мелодия'};
  const wrap = (n, period) => n - Math.floor(n / period) * period;
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const fmt = n => n.toFixed(2);
  let serial = 0;

  function el(parent, tag, attrs = {}) {
    const node = document.createElementNS(NS, tag);
    for (const [key,value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.append(node);
    return node;
  }
  function text(parent, x, y, value, size, color, extra = {}) {
    const node = el(parent, 'text', {x, y, fill:color, 'font-size':size, 'text-anchor':'middle',
      'font-family':'system-ui,sans-serif','font-weight':650,'pointer-events':'none', ...extra});
    node.textContent = value;
    return node;
  }
  const pt = (angle, r, y = 0) => [r * Math.sin(angle), y + TILT * r * Math.cos(angle)];
  const pair = p => fmt(p[0]) + ',' + fmt(p[1]);
  const arc = (r, large, clockwise, at) => 'A'+fmt(r)+','+fmt(TILT*r)+' 0 '+large+','+clockwise+' '+pair(at);

  function toothOutline(count, radius) {
    const points = [];
    for (let tooth=0; tooth<count; tooth++) {
      for (const [offset, depth] of [[-.5,-3],[-.33,-3],[-.20,3.6],[.20,3.6],[.33,-3]]) {
        const a = TAU * (tooth+offset) / count, r = radius+depth;
        points.push([r*Math.sin(a),r*Math.cos(a)]);
      }
    }
    return points;
  }
  function profiles(part) {
    const lanes = [];
    const notes = part.notes.map(note => {
      const free = row => row.every(n => wrap(note.step-n.step,STEPS) >= n.length-1e-8 &&
        wrap(n.step-note.step,STEPS) >= note.length-1e-8);
      let lane = lanes.findIndex(free);
      if (lane < 0) { lane=lanes.length; lanes.push([]); }
      lanes[lane].push(note);
      return {note, lane};
    });
    const width = Math.min(23, 42 / Math.max(1,lanes.length));
    for (const p of notes) {
      p.outer = 143 - p.lane * width;
      p.inner = p.outer - Math.max(.4, width * .88);
      p.height = 1.5 + (p.note.gain ?? 1) * 10;
      p.span = Math.min(TAU-.006, Math.max(.005,p.note.length/STEPS*TAU));
    }
    return notes;
  }

  function create(host, callbacks) {
    const uid = 'sample-cog-'+(++serial)+'-';
    const abort = new AbortController(), opts = {signal:abort.signal};
    const svg = el(host,'svg',{viewBox:'-240 -163 465 331',role:'group',
      'aria-label':'Музыкальная шестерёнка выбранного сэмпла', 'data-sample-gear':''});
    svg.style.cssText='display:block;width:100%;height:clamp(250px,min(54vh,75vw),492px);overflow:visible;touch-action:none;user-select:none;-webkit-user-select:none;';
    const defs = el(svg,'defs');
    function gradient(name, stops, x2, y2) {
      const g = el(defs,'linearGradient',{id:uid+name,x1:'0%',y1:'0%',x2,y2});
      for (const [offset,color] of stops) el(g,'stop',{offset,'stop-color':color});
      return 'url(#'+uid+name+')';
    }
    const steel = gradient('steel', [['0%','#a9baaa'],['43%','#809587'],['74%','#657e72'],['100%','#a7b6a1']], '90%','100%');
    const brass = gradient('brass', [['0%','#f4d29a'],['54%','#ac8853'],['100%','#dac18b']], '80%','100%');
    const bodyColor = gradient('side',[['0%','#243b37'],['25%','#51665b'],['60%','#374f48'],['100%','#182e2b']], '100%','20%');
    const fixed = el(svg,'g',{'pointer-events':'none'});
    el(fixed,'ellipse',{cx:CENTER_X-7,cy:43,rx:178,ry:105,fill:'#112620',opacity:.5});
    // The foot, central spindle and marked post stay at a fixed height. All
    // the score-bearing hardware can slide along that spindle.
    el(fixed,'ellipse',{cx:CENTER_X,cy:33,rx:103,ry:73,fill:'#243a34',stroke:'#5b7061','stroke-width':2});
    el(fixed,'ellipse',{cx:CENTER_X,cy:29,rx:84,ry:60,fill:'#31473e',stroke:'#192e28'});
    const railX = CENTER_X + 142, railY = 93;
    el(fixed,'rect',{x:railX,y:railY-28,width:13,height:79,rx:4,fill:'#21382f',stroke:'#6b8171'});
    for(let i=0;i<=8;i++) {
      const y=railY+19-i*4;
      el(fixed,'path',{d:'M'+(railX+4)+' '+y+'h'+(i%4?5:11),stroke:i%4?'#8b9c89':'#f1d398','stroke-width':i%4?1:2});
    }

    function wheel(parent,x,r,teeth,topMaterial) {
      const profile=toothOutline(teeth,r), shape='M'+profile.map(pair).join('L')+'Z';
      const base=el(parent,'g');
      const back=el(base,'g',{transform:'translate(0 '+FACE+') scale(1 '+TILT+')'});
      const backPlate=el(back,'path',{d:shape,fill:bodyColor,stroke:'#162b25','stroke-width':1.2});
      const faces=['#233d32','#314d40','#426051','#546e60','#667c6a'].map(fill=>el(base,'path',{fill,stroke:fill,'stroke-width':.45}));
      const surface=el(base,'g',{transform:'scale(1 '+TILT+')'}), details=el(surface,'g');
      el(details,'path',{d:shape,fill:topMaterial,stroke:'#273c33','stroke-width':1.1});
      el(details,'circle',{r:r-7,fill:'none',stroke:'#2a4439','stroke-width':1.4});
      let lastAngle;
      return {base,details,x,set(cy,degrees) {
        base.setAttribute('transform','translate('+x+' '+cy+')');
        if(lastAngle===degrees)return;
        lastAngle=degrees;
        const rotation='rotate('+degrees+')';
        backPlate.setAttribute('transform',rotation);details.setAttribute('transform',rotation);
        const angle=degrees*Math.PI/180, sin=Math.sin(angle), cos=Math.cos(angle);
        const verts=profile.map(([x,y])=>[x*cos-y*sin,TILT*(x*sin+y*cos)]);
        const d=faces.map(()=>[]);
        for(let j=0;j<verts.length;j++){
          const p=verts[j],q=verts[(j+1)%verts.length], dx=q[0]-p[0], dy=(q[1]-p[1])/TILT;
          if(dx<=0)continue;
          const light=(dx*.6+dy*.65)/Math.hypot(dx,dy);
          const tone=clamp(Math.round(2+light*2),0,4);
          d[tone].push('M'+pair(p)+'L'+pair(q)+'v'+FACE+'L'+pair([p[0],p[1]+FACE])+'Z');
        }
        faces.forEach((face,i)=>face.setAttribute('d',d[i].join('')));
      }};
    }
    const inputX=CENTER_X-RADIUS-PINION;
    const input=wheel(svg,inputX,PINION,16,brass);
    for (let i=0; i<4; i++) {
      const a=i*TAU/4;
      el(input.details,'circle',{cx:Math.sin(a)*21,cy:Math.cos(a)*21,r:4.5,fill:'#4c503f',stroke:'#d3b283'});
    }
    el(input.details,'circle',{r:11,fill:'#475b4c',stroke:'#eed197','stroke-width':2});
    text(svg,inputX,62,'ПРИВОД',8,'#b9cbb9',{'letter-spacing':1.4});
    const main=wheel(svg,CENTER_X,RADIUS,64,steel);
    el(main.details,'circle',{r:146.5,fill:'#273f38',stroke:'#b0bfaa','stroke-width':1.2});
    el(main.details,'circle',{r:105,fill:'#3c5548',stroke:'#102d26','stroke-width':1.5});
    // The input drives the teeth. The colored score sleeve is keyed to its
    // own phase, so repositioning a phrase never slips the transmission.
    const carriage=el(svg,'g'), sleeveFace=el(carriage,'g',{transform:'scale(1 '+TILT+')'});
    const index=el(sleeveFace,'g',{'pointer-events':'none'});
    el(index,'circle',{r:96,fill:'#53695c',stroke:'#839581','stroke-width':2.5});
    el(index,'circle',{r:87,fill:'none',stroke:'#2c483e','stroke-width':4});
    for(let k=0;k<STEPS;k++) {
      const angle=TAU*k/STEPS, outer=k%4===0?101:98;
      el(index,'path',{d:'M'+pair([outer*Math.sin(angle),outer*Math.cos(angle)])+'L'+
        pair([(k%16===0?82:k%4===0?89:93)*Math.sin(angle),(k%16===0?82:k%4===0?89:93)*Math.cos(angle)]),
        stroke:k%16===0?'#f2ce84':k%4===0?'#d8ddbd':'#97a897','stroke-width':k%16===0?3:1.2});
    }
    const noteSides=el(carriage,'g'), notesLayer=el(carriage,'g');
    const hub=el(carriage,'g',{'data-cog-hub':'',role:'slider',tabindex:0,'aria-label':'Громкость всего сэмпла',
      'aria-valuemin':0,'aria-valuemax':200});
    hub.style.cursor='ns-resize';
    el(hub,'ellipse',{cx:0,cy:3,rx:67,ry:46,fill:'#172d29',stroke:'#abb4a0','stroke-width':2.2});
    el(hub,'ellipse',{cx:0,cy:-2,rx:62,ry:42,fill:'#233c34',stroke:'#d5b679','stroke-width':1.1});
    const hubTitle=text(hub,0,-9,'',15,'#f1e9d2');
    const hubGain=text(hub,0,13,'',14,'#f3c971');
    const rim=el(carriage,'ellipse',{cx:0,cy:0,rx:82,ry:82*TILT,fill:'none',stroke:'transparent','stroke-width':22,
      'pointer-events':'stroke','data-cog-rim':'',role:'slider',tabindex:0,'aria-label':'Фаза всего сэмпла',
      'aria-valuemin':0,'aria-valuemax':63});
    rim.style.cursor='grab';
    const guide=el(carriage,'g',{'pointer-events':'none'});
    // This straight blade reads every concentric lane at the same angle.
    const reader=el(guide,'path',{d:'M-3.4 66 0 62 3.4 66 2 109 -2 109Z',fill:'#eac26d',stroke:'#4e5037','stroke-width':1,
      'data-cog-reader':''});
    const lamp=el(guide,'circle',{cx:0,cy:111.8,r:3.4,fill:'#dbc593'});
    el(guide,'path',{d:'M3 113H18',fill:'none',stroke:'#6d8070','stroke-width':2});
    const phaseText=text(guide,22,116,'',8.4,'#f3e9cb',{'text-anchor':'start'});
    el(guide,'path',{d:'M138 76h12v11',fill:'none',stroke:'#c7b98b','stroke-width':3});
    const levelMarker=el(guide,'path',{d:'M145 87h13',stroke:'#f3c775','stroke-width':3.7,'stroke-linecap':'round'});

    let state=null, selectedId=null, seenKey=null, renderedNotes=null, visuals=[], notesAt='';
    let clock={step:0,driveTurns:0,activeIds:[],playing:false}, drag=null, lastRender={};
    let cy=0, displayStep=0;
    function rebuildNotes(part) {
      renderedNotes=part.notes;
      noteSides.replaceChildren();notesLayer.replaceChildren();
      visuals=profiles(part).map(p=>{
        const note=p.note, group=el(notesLayer,'g',{'data-cog-note':note.id,'aria-label':ConveyorBoxes.name(note.pitch),
          role:'button',tabindex:-1});
        group.style.cursor='grab';
        const ink=ConveyorBoxes.color(note.pitch);
        const title=el(group,'title');
        title.textContent=ConveyorBoxes.name(note.pitch)+' · '+Math.round((note.gain??1)*100)+'%';
        const sides=el(noteSides,'g',{'data-cog-note':note.id});
        sides.style.cursor='grab';
        const side=el(sides,'path',{fill:ink,stroke:'#24382f','stroke-width':.6});
        const shadow=el(sides,'path',{fill:'#193126',opacity:.30,'pointer-events':'none'});
        const top=el(group,'path',{fill:ink,stroke:'#2c3c32','stroke-width':.9});
        const mark=el(group,'path',{stroke:'#fff6da','stroke-width':1.8,'pointer-events':'none'});
        return {...p,group,side,shadow,top,mark};
      });
      notesAt='';
    }
    function paintNote(p, step, active) {
      const a=(p.note.step-step)*TAU/STEPS, b=a+p.span, big=p.span>Math.PI?1:0, h=-p.height;
      const outer0=pt(a,p.outer), outer1=pt(b,p.outer), up0=pt(a,p.outer,h), up1=pt(b,p.outer,h);
      const in0=pt(a,p.inner,h), in1=pt(b,p.inner,h), baseInner=pt(a,p.inner);
      const side='M'+pair(outer0)+arc(p.outer,big,0,outer1)+'L'+pair(up1)+arc(p.outer,big,1,up0)+'Z'+
        'M'+pair(in0)+'L'+pair(up0)+'L'+pair(outer0)+'L'+pair(baseInner)+'Z'+
        'M'+pair(in1)+'L'+pair(up1)+'L'+pair(outer1)+'L'+pair(pt(b,p.inner))+'Z'+
        'M'+pair(baseInner)+arc(p.inner,big,0,pt(b,p.inner))+'L'+pair(in1)+arc(p.inner,big,1,in0)+'Z';
      p.side.setAttribute('d',side);p.shadow.setAttribute('d',side);
      p.top.setAttribute('d','M'+pair(up0)+arc(p.outer,big,0,up1)+'L'+pair(in1)+arc(p.inner,big,1,in0)+'Z');
      p.mark.setAttribute('d','M'+pair(in0)+'L'+pair(up0));
      p.top.setAttribute('stroke',p.note.id===selectedId?'#fff7ce':active.has(p.note.id)?'#f9da7a':'#273a31');
      p.top.setAttribute('stroke-width',p.note.id===selectedId?2.8:active.has(p.note.id)?2:.9);
    }
    function render() {
      if(!state)return;
      const live=clock.playing&&clock.part?.key===state.key?clock.part:state;
      const desiredPhase=state.phase||0, livePhase=live.phase||0;
      const playStep=Number.isFinite(clock.step)?clock.step:0;
      displayStep=playStep+(drag?.kind==='phase'?-drag.steps:0);
      const level=drag?.kind==='level'?drag.level:state.level??1;
      cy=18-13*level;
      const wheelTurns=wrap(playStep+livePhase,STEPS)/STEPS;
      main.set(cy,wheelTurns*360); input.set(5,11.25-wheelTurns*360*4);
      carriage.setAttribute('transform','translate('+CENTER_X+' '+cy+')');
      index.setAttribute('transform','rotate('+displayStep*360/STEPS+')');
      if(renderedNotes!==live.notes)rebuildNotes(live);
      const signature=[displayStep,selectedId,clock.activeIds.join(','),renderedNotes.length].join('|');
      if(notesAt!==signature) {
        const active=new Set(clock.playing?clock.activeIds:[]);
        for(const p of visuals)paintNote(p,displayStep,active);
        notesAt=signature;
      }
      hubTitle.textContent=NAMES[state.key]||state.key;
      hubGain.textContent='↕ '+Math.round(level*100)+'%';
      const phase=wrap(desiredPhase+(drag?.kind==='phase'?drag.steps:0),STEPS);
      phaseText.textContent='Фаза '+phase+' / 64';
      hub.setAttribute('aria-valuenow',String(Math.round(level*100)));
      rim.setAttribute('aria-valuenow',String(phase));
      lamp.setAttribute('fill',clock.playing&&clock.activeIds.length?'#fff3a8':'#b6a777');
      reader.setAttribute('fill',clock.playing&&clock.activeIds.length?'#ffe5a1':'#d0b475');
      levelMarker.setAttribute('stroke',drag?.kind==='level'?'#fff7bc':'#f3c775');
      lastRender={step:playStep,displayStep,phase,level,rotation:wheelTurns*360,driveTurns:clock.driveTurns,
        rate:live.speed,activeIds:clock.activeIds,selectedId, playing:clock.playing,levelPixelsPerUnit:pixelsPerUnit()};
    }
    function local(e) {
      const matrix=svg.getScreenCTM();
      return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
    }
    function angleOf(point) {return Math.atan2(point.x-CENTER_X,(point.y-cy)/TILT);}
    function pixelsPerUnit() {return Math.max(44,Math.min(96,svg.clientHeight*.22));}
    function toClient(x,y) {
      const p=new DOMPoint(CENTER_X+x,cy+y).matrixTransform(svg.getScreenCTM());
      return {x:p.x,y:p.y};
    }
    function phasePoint(fraction=.11) {return toClient(...pt(fraction*TAU,82));}
    function notePoint(id) {
      const p=visuals.find(p=>p.note.id===id);
      if(!p)return null;
      // Pick a visible position on the actual raised top surface. Tops
      // can overlap in projection when long, loud notes share a time slot.
      const a=(p.note.step-displayStep)*TAU/STEPS;
      for(const fraction of [.5,.25,.75,.08,.92])for(const radius of [.5,.78,.22]) {
        const aim=toClient(...pt(a+p.span*fraction,p.inner+(p.outer-p.inner)*radius,-p.height));
        if(document.elementFromPoint(aim.x,aim.y)?.closest('[data-cog-note]')?.dataset.cogNote===id)return aim;
      }
      return null;
    }

    svg.addEventListener('pointerdown', e=>{
      if(!state||drag||!e.isPrimary||e.button!==0)return;
      const localPoint=local(e), angle=angleOf(localPoint);
      const r=Math.hypot(localPoint.x-CENTER_X,(localPoint.y-cy)/TILT);
      const noteNode=e.target.closest('[data-cog-note]');
      let kind;
      if(e.target.closest('[data-cog-hub]'))kind='level';
      else if(noteNode||e.target.closest('[data-cog-rim]')||(r>70&&r<=RADIUS+4))kind='phase';
      else return;
      drag={id:e.pointerId,kind,atX:e.clientX,atY:e.clientY,lastAngle:angle,cumulative:0,steps:0,
        level:state.level??1, initialLevel:state.level??1,moved:false,noteId:noteNode?.dataset.cogNote,
        addStep:r>=104&&r<=146?wrap(Math.floor(displayStep+angle/TAU*STEPS),STEPS):null};
      svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    },opts);
    svg.addEventListener('pointermove',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      if(!drag.moved&&Math.hypot(e.clientX-drag.atX,e.clientY-drag.atY)<4)return;
      drag.moved=true;
      if(drag.kind==='level')drag.level=clamp(Math.round((drag.initialLevel+(drag.atY-e.clientY)/pixelsPerUnit())*100)/100,0,2);
      else {
        const av=angleOf(local(e)), delta=av-drag.lastAngle;
        drag.cumulative+=Math.atan2(Math.sin(delta),Math.cos(delta));drag.lastAngle=av;
        drag.steps=Math.round(drag.cumulative/TAU*STEPS);
      }
      render();
    },opts);
    svg.addEventListener('pointerup',e=>{
      if(!drag||drag.id!==e.pointerId)return;
      const finished=drag;drag=null;
      if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
      if(finished.moved) {
        if(finished.kind==='level'&&finished.initialLevel!==finished.level)callbacks.onLevel?.(finished.level);
        else if(finished.kind==='phase'&&finished.steps)callbacks.onPhase?.(finished.steps);
      } else if(finished.noteId)callbacks.onSelect?.(finished.noteId);
      else if(finished.kind==='phase'&&finished.addStep!==null)callbacks.onAdd?.({step:finished.addStep});
      render();
    },opts);
    function cancel() { if(!drag)return; const id=drag.id; drag=null;if(svg.hasPointerCapture(id))svg.releasePointerCapture(id);render(); }
    svg.addEventListener('pointercancel',cancel,opts);svg.addEventListener('lostpointercapture',cancel,opts);
    hub.addEventListener('keydown',e=>{
      if(!state||!['ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();callbacks.onLevel?.(clamp(Math.round(((state.level??1)+(e.key==='ArrowUp'?.1:-.1))*100)/100,0,2));
    },opts);
    rim.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();callbacks.onPhase?.(e.key==='ArrowRight'?1:-1);
    },opts);
    return {
      update({part,selectedId:id}) {if(seenKey!==part.key){cancel();seenKey=part.key;}state=part;selectedId=id;render();},
      clock(value) {clock=value;render();}, phasePoint,hubPoint:()=>toClient(0,-2),notePoint,
      inspect:()=>({...lastRender}),
      destroy(){cancel();abort.abort();svg.remove();}
    };
  }
  return {create};
})();
