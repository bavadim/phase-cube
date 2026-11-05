/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.ConveyorBelt = (() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const wrap = (v, n = 64) => v - Math.floor(v / n) * n;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const ratios = [.5, 1, 2];
  let serial = 0;

  function node(parent, tag, attrs) {
    const element = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) element.setAttribute(k, v);
    parent.append(element);
    return element;
  }
  const box = (p, x, y, w, h, fill, rx = 0) => node(p, 'rect', {x, y, width:w, height:h, fill, rx});
  const circle = (p, x, y, r, fill) => node(p, 'circle', {cx:x, cy:y, r, fill});
  const line = (p, x1, y1, x2, y2, stroke, width = 1) => node(p,'line',{x1,y1,x2,y2,stroke,'stroke-width':width});
  const path = (p, d, fill) => node(p, 'path', {d,fill});
  const translate = (e, x, y) => e.setAttribute('transform','translate('+x+' '+y+')');
  const rotate = (e, deg) => e.setAttribute('transform','rotate('+deg+')');
  function text(p,x,y,label,size,color,anchor='start',weight=600) {
    const e=node(p,'text',{x,y,fill:color,'font-size':size,'font-weight':weight,'text-anchor':anchor,'pointer-events':'none'});
    e.textContent=label; return e;
  }
  function wheel(parent,x,y,teeth,module,fill) {
    const rim = teeth*module/2;
    const base = node(parent,'g',{}); translate(base,x,y);
    const rotor=node(base,'g',{});
    const points=[];
    for(let i=0;i<teeth;i++){
      for(const [f,height] of [[-.5,-.85],[-.31,-.85],[-.17,.7],[.17,.7],[.31,-.85]]){
        const a=(i+f)*2*Math.PI/teeth, r=rim+height*module;
        points.push((Math.cos(a)*r).toFixed(2)+' '+(Math.sin(a)*r).toFixed(2));
      }
    }
    const face=path(rotor,'M'+points.join('L')+'Z',fill);
    face.setAttribute('stroke','#1d332e'); face.setAttribute('stroke-width','1');
    circle(rotor,0,0,rim*.70,'#31483b');
    circle(rotor,0,0,rim*.63,fill);
    for(let i=0;i<3;i++){
      const a=i*2*Math.PI/3;
      circle(rotor,rim*.47*Math.cos(a),rim*.47*Math.sin(a),rim*.12,'#3d5142');
    }
    circle(base,0,0,rim*.24,'#182f2a'); circle(base,0,0,rim*.11,'#b1b39a');
    return {rotor,face};
  }

  function create(host, callbacks) {
    const id='cratebelt'+(++serial), opts=new AbortController();
    const root=node(host,'svg',{role:'group','aria-label':'Лента с нотами и коробка передач',class:'crate-belt'});
    root.style.cssText='display:block;width:100%;height:auto;touch-action:none;user-select:none;-webkit-user-select:none;color:#f0eacb;font-family:ui-monospace,SFMono-Regular,Consolas,monospace';
    let part=null, selectedId=null, bar=0, clock={step:0,driveTurns:0,playing:false,activeIds:[]};
    let g, gesture=null, group, slotGroup, beltTicks, returnTicks, rollers=[], gears=[], readHead, lamp, readTick, readout, markScale;
    let artPart=null, pieces=[], numLanes=1, drawnBeat=null, slotRects=[], beatMarkers=[], guides=[];
    let heldOrigin=0, readerX=0, lastPosition=null, rollerStep=0;
    const ref = fragment => 'url(#'+id+fragment+')';
    const color = n => ConveyorBoxes.color(n.pitch);
    const name = n => ConveyorBoxes.name(n.pitch);
    function layout() {
      const width=Math.max(240,Math.round(host.clientWidth||host.getBoundingClientRect().width||640));
      if(g?.width===width && g.lanes===numLanes)return;
      if(gesture)cancel();
      const small=width<630;
      const left=small?17:46, right=width-left;
      const spacing=(right-left)/16, baseTop=small?143:173;
      // Stacked sounding gates use parallel elevated runs. Reserve enough
      // clearance for full gain on each run; a neighbouring gate never scales
      // the boxes of the original voice.
      const gainTravel=small?36:49, railPitch=2*gainTravel+18;
      const top=Math.max(baseTop,52+2*gainTravel+(numLanes-1)*railPitch);
      const height=(small?302:350)+top-baseTop;
      const rollerR=small?13:19;
      g={width,left,right,spacing,height,top,rollerR,small,gainTravel,railPitch,lanes:numLanes};
      root.setAttribute('viewBox','0 0 '+width+' '+height);
      root.replaceChildren();
      const defs=node(root,'defs',{});
      function grad(key,stops,diagonal=false){
        const grad=node(defs,'linearGradient',{id:id+key,x1:'0%',y1:'0%',x2:diagonal?'100%':'0%',y2:'100%'});
        for(const [offset,shade] of stops)node(grad,'stop',{offset,'stop-color':shade});
      }
      grad('room',[['0%','#23433e'],['67%','#37594c'],['100%','#29463b']],true);
      grad('panel',[['0%','#718674'],['5%','#526d5e'],['100%','#405951']]);
      grad('rubber',[['0%','#263a32'],['22%','#293e34'],['62%','#172e2a'],['100%','#112521']]);
      grad('steel',[['0%','#d2cfaa'],['44%','#8fa28c'],['100%','#606e59']],true);
      grad('brass',[['0%','#ffe3a5'],['44%','#d6b370'],['100%','#9e784d']],true);
      const clip=node(defs,'clipPath',{id:id+'window'});box(clip,left,0,right-left,top+3,'white');
      const ticks=node(defs,'clipPath',{id:id+'tread'});box(ticks,left,top,right-left,rollerR*2,'white');
      box(root,0,0,width,height,ref('room'));
      // The four marks name the downbeats on the actual strip. The rows of
      // small punched holes continue across the loop seam.
      markScale=node(root,'g',{'clip-path':ref('window'),'pointer-events':'none'});
      beatMarkers=[];
      for(let i=0;i<5;i++) {
        const m=node(markScale,'g',{});line(m,0,22,0,29,'#86a18a',1.5);
        const t=text(m,5,29,'',10,'#b9c9ad');beatMarkers.push({m,t});
      }
      guides=[];
      for(let lane=numLanes-1;lane>0;lane--){
        const y=top-lane*railPitch;
        for(const x of [left+2,right-3]){
          path(root,'M'+x+' '+(y+6)+' v'+(railPitch-4)+' l4 -2 v-'+(railPitch-5)+'z','#355044');
          line(root,x,y+6,x,y+railPitch-1,'#819781',1.2);
        }
        box(root,left-5,y-.5,right-left+10,9,'#142f29',4);
        box(root,left-4,y,right-left+8,3,'#809b86',1.5);
        for(const x of [left,right])circle(root,x,y+4,2.2,'#c0c6a8');
        const guide=node(root,'g',{'clip-path':ref('window')});
        for(let j=0;j<17;j++)line(guide,left+j*spacing,y+1,left+j*spacing-1,y+5,'#c9c8a4',1);
        guides.push(guide);
      }
      const shellY=top+2*rollerR+1;
      box(root,8,shellY+4,width-16,height-shellY-14,'#19362c',12);
      box(root,8,shellY,width-16,height-shellY-18,ref('panel'),12);
      line(root,21,shellY+2,width-20,shellY+2,'#a9b396',1);
      // Continuous rubber band, two visible drums and its counter-moving return.
      const inset=small?8:16;
      box(root,left-inset,top,right-left+2*inset,rollerR*2,ref('rubber'),rollerR);
      line(root,left,top+2,right,top+2,'#b7c3a1',2.5);
      line(root,left,top+2*rollerR-2,right,top+2*rollerR-2,'#738d76',2);
      const clipped=node(root,'g',{'clip-path':ref('tread')});
      beltTicks=node(clipped,'g',{});returnTicks=node(clipped,'g',{});
      for(let j=-2;j<19;j++){
        const x=left+j*spacing;
        line(beltTicks,x,top+4,x+2,top+9,'#7b927d',1.2);
        line(returnTicks,x,top+2*rollerR-6,x-2,top+2*rollerR-3,'#718875',1);
      }
      rollers=[];
      for(const x of [left,right]){
        const base=node(root,'g',{});translate(base,x,top+rollerR);
        circle(base,0,0,rollerR*.88,'#0e2720');circle(base,0,0,rollerR*.73,ref('steel'));
        const spokes=node(base,'g',{});rollers.push(spokes);
        for(let j=0;j<4;j++)circle(spokes,Math.cos(j*Math.PI/2)*rollerR*.42,Math.sin(j*Math.PI/2)*rollerR*.42,rollerR*.115,'#304a3b');
        circle(base,0,0,rollerR*.19,'#c7cabb');
      }
      const compact=small;
      const gearX=small?21:38, periodX=small?47:62;
      const housingWidth=periodX*3+12, gearY=shellY+15;
      const housingHeight=height-gearY-25;
      const housing=box(root,gearX,gearY,housingWidth,housingHeight,'#223c33',8);
      housing.setAttribute('stroke','#83927a');
      const module=compact?1.14:1.48;
      const inputY=gearY+18, outputY=inputY+18*module;
      const gearCenters=ratios.map((_,i)=>gearX+6+periodX*(i+.5));
      const rotorX=gearCenters[0], rotorEnd=gearCenters[2];
      line(root,rotorX-13,inputY,rotorEnd+14,inputY,'#9a9f86',2.5);
      line(root,rotorX-13,outputY,rotorEnd+14,outputY,'#92a38c',3);
      path(root,'M'+(rotorX-13)+' '+outputY+' H'+(gearX+5)+' Q'+(gearX-1)+' '+outputY+' '+(gearX-1)+' '+(outputY-7)+' V'+(top+rollerR+7)+' Q'+(gearX-1)+' '+(top+rollerR)+' '+left+' '+(top+rollerR),'none').setAttribute('style','stroke:#cca96d;stroke-width:3;stroke-linecap:round');
      gears=[];
      ratios.forEach((rate,i)=>{
        const x=gearCenters[i], n=[12,18,24][i], m=36-n;
        const back=box(root,x-periodX*.44,gearY+3,periodX*.88,housingHeight-6,'transparent',6);
        const drive=wheel(root,x,inputY,n,module,ref('steel'));
        const driven=wheel(root,x,outputY,m,module,ref('brass'));
        const label=text(root,x,gearY+housingHeight-10,['½×','1×','2×'][i],small?13:14,'#cfd7bd','middle');
        const latch=box(root,x-9,gearY+housingHeight-6,18,2.8,'#ffcc7b',1.2);
        const hit=box(root,x-periodX/2,gearY,periodX,housingHeight,'transparent');
        hit.setAttribute('data-speed',rate);hit.setAttribute('role','button');hit.setAttribute('tabindex','0');hit.setAttribute('aria-label','Скорость '+rate+'×');
        hit.style.cursor='pointer';
        function activate(){callbacks.onRate?.(rate);}
        // These targets are redrawn on resize, so listeners die with the
        // detached node. Avoid retaining their old closures on an AbortSignal.
        ConveyorView.pressButton(hit,activate);
        hit.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
        gears.push({n,m,drive,driven,rate,back,label,latch,hit});
      });
      const rightX=width-(small?23:45);
      const statusX=gearX+housingWidth+18, statusW=Math.max(46,Math.min(179,rightX-statusX));
      const dialX=rightX-statusW, dialY=gearY+Math.max(4,(housingHeight-55)/2);
      box(root,dialX,dialY,statusW,55,'#273d34',6).setAttribute('stroke','#93a18a');
      text(root,dialX+12,dialY+17,'ШАГ ЛЕНТЫ',9,'#a7bda4');
      readout=text(root,dialX+12,dialY+41,'01 / 64',small?19:23,'#d8e1c6');
      if(statusX+68<dialX){
        text(root,statusX,inputY+5,'КОРОБКА ПЕРЕДАЧ',10,'#e1dec8');
        line(root,statusX,outputY,dialX-24,outputY,'#82947e',1);
      }
      slotGroup=node(root,'g',{});slotRects=[];
      for(let j=0;j<17;j++){
        const slot=box(slotGroup,0,top+.1,spacing,Math.max(17,1.1*rollerR),'transparent');
        slot.style.cursor='copy';slotRects.push(slot);
      }
      group=node(root,'g',{'clip-path':ref('window')});
      readHead=node(root,'g',{'pointer-events':'none'});
      const beam=line(readHead,0,42,0,top+8,'#f6bd67',1.65);beam.setAttribute('data-reader-line','');
      path(readHead,'M-7 36 H7 L0 47 Z','#ffce82');
      lamp=circle(readHead,0,33,5,'#f4cc87');lamp.setAttribute('stroke','#ffdc9a');
      readTick=path(readHead,'M-6 '+(top+13)+'h12l-6 -5z','#ffce82');
      artPart=null;drawnBeat=null; rebuildAndPaint();
    }

    function makePiece(n, lane, copy) {
      const el=node(group,'g',{'data-crate-id':n.id,'data-note-id':n.id});
      el.style.cursor='grab';
      node(el,'title',{}).textContent=name(n);
      const front=box(el,0,0,1,1,color(n),1.3);front.setAttribute('data-face','front');
      front.setAttribute('stroke','#263d35');front.setAttribute('stroke-width','1.15');
      const lid=path(el,'',color(n));lid.setAttribute('data-face','top');
      const shine=path(el,'','rgba(255,255,230,.42)');
      const end=path(el,'',color(n));end.setAttribute('data-face','side');
      const shade=path(el,'','rgba(22,39,40,.25)');
      const packing=path(el,'','rgba(255,244,201,.52)');
      const fold=line(el,0,0,1,1,'rgba(48,43,26,.32)',.75);
      const edge=line(el,0,0,1,1,'#fbf5db',1.3);
      const stamp=text(el,0,0,name(n),10,'#21332e','middle',720);
      const handle=box(el,0,0,1,1,'transparent',2);
      handle.style.cursor='ew-resize';handle.setAttribute('data-handle','length');handle.setAttribute('data-length-id',n.id);
      const grip=line(el,0,0,1,1,'#263e37',2);
      for(const deco of [shine,shade,packing,fold,edge,stamp,grip])deco.style.pointerEvents='none';
      return {n,el,front,lid,shine,end,shade,packing,fold,edge,stamp,handle,grip,lane,copy};
    }
    function currentArt() {
      if(gesture)return artPart;
      return clock.playing&&clock.part?.key===part?.key ? clock.part : part;
    }
    function rebuild() {
      const active=currentArt();
      if(artPart===active)return;
      artPart=active;pieces=[];group.replaceChildren();
      if(!active)return;
      const lanes=[];
      for(const note of active.notes){
        let i=lanes.findIndex(row=>row.every(other=>wrap(note.step-other.step)>=other.length && wrap(other.step-note.step)>=note.length));
        if(i<0){i=lanes.length;lanes.push([]);} lanes[i].push(note);
      }
      numLanes=Math.max(1,lanes.length);
      if(g.lanes!==numLanes){layout();return;}
      // A long gate across the phrase seam may appear at both ends of the belt.
      lanes.forEach((row,lane)=>row.forEach(n=>{
        const copies=n.length+16>64?2:1;
        for(let copy=0;copy<copies;copy++)pieces.push(makePiece(n,lane,copy));
      }));
    }
    function origin(){
      if(gesture)return heldOrigin;
      return clock.playing?clock.step-4:bar*16;
    }
    function geometry(n,lane,start,from) {
      const h=6+clamp(n.gain??1,0,2)*g.gainTravel;
      const w=Math.max(2,n.length*g.spacing-2);
      const dx=Math.min(g.small?4.8:9.5, w*.22, g.gainTravel*.25), dy=dx*.72;
      const x=g.left+(start-from)*g.spacing;
      const y=g.top-1-lane*g.railPitch;
      return {x,y,h,w,dx,dy};
    }
    function setShape(p,n,b,selected,lit) {
      const {w,h,dx,dy}=b;
      const signature=[w,h,dx,dy,n.pitch,selected,lit].join('|');
      if(p.signature===signature)return;
      p.signature=signature;
      const fill=color(n);
      p.front.setAttribute('width',w);p.front.setAttribute('height',h);p.front.setAttribute('y',-h);
      p.front.setAttribute('fill',fill);p.front.setAttribute('stroke',selected?'#fff0c4':'#263d35');
      p.front.setAttribute('stroke-width',selected?2.7:1);
      const top='M0 '+(-h)+' l'+dx+' '+(-dy)+' h'+w+' l'+(-dx)+' '+dy+'z';
      const end='M'+w+' '+(-h)+' l'+dx+' '+(-dy)+' v'+h+' l'+(-dx)+' '+dy+'z';
      for(const e of [p.lid,p.shine])e.setAttribute('d',top);
      for(const e of [p.end,p.shade])e.setAttribute('d',end);
      p.lid.setAttribute('fill',fill);p.end.setAttribute('fill',fill);
      const tape=Math.min(10,Math.max(2,w*.17)), tapeX=w*.52;
      const tab=Math.min(h*.16,7);
      p.packing.setAttribute('d','M'+tapeX+' '+(-h)+' l'+dx+' '+(-dy)+' h'+tape+' l'+(-dx)+' '+dy+' v'+tab+' h'+(-tape)+'Z');
      const seamY=-h-dy*.48;
      p.fold.setAttribute('x1',dx*.48);p.fold.setAttribute('x2',w+dx*.48);p.fold.setAttribute('y1',seamY);p.fold.setAttribute('y2',seamY);
      p.edge.setAttribute('x1',2);p.edge.setAttribute('x2',w-1);p.edge.setAttribute('y1',-h+2);p.edge.setAttribute('y2',-h+2);
      p.edge.setAttribute('opacity',lit?'1':'.6');
      p.stamp.textContent=name(n);
      p.stamp.setAttribute('x',Math.min(w/2,22));p.stamp.setAttribute('y',-h/2+3.8);
      p.stamp.setAttribute('font-size',Math.min(12,Math.max(6,w/2.8)));
      p.stamp.setAttribute('visibility',h<9||w<9?'hidden':'visible');
      const hw=Math.min(w*.28,Math.max(g.small?9:8,dx+4));
      p.handle.setAttribute('x',w-hw);p.handle.setAttribute('y',-h-dy);p.handle.setAttribute('width',hw+dx);p.handle.setAttribute('height',h+dy+1);
      p.handle.style.pointerEvents=selected?'all':'none';
      p.grip.setAttribute('x1',w-2);p.grip.setAttribute('x2',w-2);p.grip.setAttribute('y1',-h*.67);p.grip.setAttribute('y2',-h*.33);
      p.grip.setAttribute('visibility',selected&&h>12?'visible':'hidden');
    }
    function paint() {
      if(!g||!part)return;
      const from=origin(), live=clock.playing, active=new Set(live?clock.activeIds:[]);
      const {left,spacing,top,rollerR}=g;
      const q=Math.floor(from), frac=from-q;
      const firstBeat=Math.ceil(from/4)*4;
      if(drawnBeat!==firstBeat){
        drawnBeat=firstBeat;
        beatMarkers.forEach(({m,t},i)=>{const beat=firstBeat+i*4;t.textContent=String(1+Math.floor(wrap(beat)/16))+'.'+(1+Math.floor(wrap(beat,16)/4));});
      }
      beatMarkers.forEach(({m},i)=>translate(m,left+(firstBeat+i*4-from)*spacing,0));
      translate(beltTicks,-frac*spacing,0);translate(returnTicks,frac*spacing,0);
      for(const guide of guides)translate(guide,-frac*spacing,0);
      const bars=clock.driveTurns||0, position=clock.step||0;
      // Both shafts have equal centre distance (12+24 = 18+18).
      // Match the driven axle speed to the belt surface's linear speed.
      const turnsPerBar=16*spacing/(2*Math.PI*rollerR);
      for(const item of gears) {
        const angle=bars*turnsPerBar;
        rotate(item.drive.rotor,angle*360);
        const rest=.75-(.5-item.n*.25)/item.m;
        rotate(item.driven.rotor,(rest-angle*item.rate)*360);
        const selected=item.rate===part.speed;
        item.back.setAttribute('fill',selected?'#52654f':'transparent');
        item.label.setAttribute('fill',selected?'#ffdc93':'#d4ddc6');
        item.latch.setAttribute('opacity',selected?'1':'.1');
        item.hit.setAttribute('aria-pressed',selected);
      }
      // Unwrap the heard tile coordinate: speed changes, a full phrase and
      // its phase offset share one continuous surface underneath the hand.
      if(lastPosition===null)rollerStep=position;
      else rollerStep+=wrap(position-lastPosition+32)-32;
      lastPosition=position;
      const rollerTurns=rollerStep*spacing/(2*Math.PI*rollerR);
      for(const rotor of rollers)rotate(rotor,-rollerTurns*360);
      const headStep=wrap(position-from);
      readerX=headStep<16?left+headStep*spacing:left;
      translate(readHead,readerX,0);readHead.setAttribute('opacity',headStep>=16?'.32':'1');
      lamp.setAttribute('fill',active.size?'#fffadb':'#a78a57');
      readTick.setAttribute('fill',active.size?'#fff3ab':'#d2a66a');
      readout.textContent=String(1+Math.floor(position)).padStart(2,'0')+' / 64';
      slotRects.forEach((slot,i)=>{
        slot.setAttribute('x',left+(i-frac)*spacing);
        slot.setAttribute('width',Math.min(spacing,Math.max(0,(16+frac-i)*spacing)));
        slot.setAttribute('data-step',wrap(q+i));
      });
      for(const p of pieces){
        const n=gesture?.note?.id===p.n.id?{...p.n,...gesture.patch}:p.n;
        let start=from+wrap(n.step-from);
        if(p.copy || start>=from+16) start-=64;
        if(p.copy && start+64>=from+16)start-=64;
        const b=geometry(n,p.lane,start,from);
        const visible=start<from+16 && start+n.length>from;
        p.box=b;p.el.style.display=visible?'':'none';
        if(!visible)continue;
        translate(p.el,b.x,b.y);setShape(p,n,b,selectedId===n.id||gesture?.note?.id===n.id,active.has(n.id));
      }
    }
    function rebuildAndPaint(){if(!group||!part)return;rebuild();paint();}
    function screen(x,y) { const pt=new DOMPoint(x,y).matrixTransform(root.getScreenCTM()); return {x:pt.x,y:pt.y}; }
    function local(e) {return new DOMPoint(e.clientX,e.clientY).matrixTransform(root.getScreenCTM().inverse());}
    function cancel(){const old=gesture;gesture=null;if(old&&root.hasPointerCapture(old.pid))root.releasePointerCapture(old.pid);rebuildAndPaint();}
    root.addEventListener('pointerdown',e=>{
      if(!part||gesture||e.button!==0||e.target.closest('[data-speed]'))return;
      const p=local(e),id=e.target.closest('[data-crate-id]')?.dataset.crateId;
      if(!id && (p.x<g.left||p.x>=g.right||p.y<35||p.y>g.top+g.rollerR*1.2))return;
      const note=artPart.notes.find(n=>n.id===id);
      heldOrigin=origin();
      gesture={pid:e.pointerId,partKey:part.key,note,at:p,step:wrap(Math.floor(heldOrigin+(p.x-g.left)/g.spacing)),kind:e.target.closest('[data-length-id]')?'length':'body',patch:null};
      root.setPointerCapture(e.pointerId);e.preventDefault();
    },{signal:opts.signal});
    root.addEventListener('pointermove',e=>{
      if(!gesture||e.pointerId!==gesture.pid||!gesture.note)return;
      const d=gesture, p=local(e),dx=p.x-d.at.x,dy=p.y-d.at.y;
      if(!d.patch && Math.hypot(dx,dy)<4)return;
      if(d.kind==='length')d.patch={length:clamp(Math.round(d.note.length+dx/g.spacing),1,64)};
      else if(Math.abs(dx)>Math.abs(dy))d.patch={step:wrap(d.note.step+Math.round(dx/g.spacing))};
      else d.patch={gain:clamp(Math.round(((d.note.gain??1)-dy/g.gainTravel)*20)/20,0,2)};
      paint();
    },{signal:opts.signal});
    root.addEventListener('pointerup',e=>{
      if(!gesture||e.pointerId!==gesture.pid)return;
      const d=gesture;
      const end=local(e);
      gesture=null;
      if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);
      if(d.note){
        if(d.patch)callbacks.onEdit?.(d.note.id,d.patch);
        else callbacks.onSelect?.(d.note.id);
      } else if(Math.hypot(end.x-d.at.x,end.y-d.at.y)<8)callbacks.onAdd?.({step:d.step});
      rebuildAndPaint();
    },{signal:opts.signal});
    root.addEventListener('pointercancel',cancel,{signal:opts.signal});
    root.addEventListener('lostpointercapture',e=>{if(gesture?.pid===e.pointerId)cancel();},{signal:opts.signal});
    const observer=new ResizeObserver(layout);observer.observe(host);layout();
    return {
      update(next){
        if(gesture && (next.part.key!==part?.key||next.bar!==bar))cancel();
        part=next.part;bar=next.bar;selectedId=next.selectedId;
        rebuildAndPaint();
      },
      clock(next){clock=next;rebuildAndPaint();},
      inspect(){return {playing:clock.playing,step:clock.step,rate:clock.rate,selectedId,bar,origin:origin(),left:g.left,right:g.right,top:g.top,width:g.width,headX:readerX,tileSpacing:g.spacing};},
      cellPoint(step){return screen(g.left+(wrap(step-origin())+.5)*g.spacing,g.top+g.rollerR*.55);},
      notePoint(id,kind='body'){
        const p=pieces.find(p=>p.n.id===id&&p.el.style.display!=='none');if(!p)return null;
        const b=p.box,x=kind==='length'?b.x+b.w-Math.min(2,b.w*.1):b.x+b.w*.38;
        return screen(clamp(x,g.left+1,g.right-1),b.y-b.h*(kind==='gain'?.67:.45));
      },
      destroy(){observer.disconnect();opts.abort();gesture=null;root.remove();}
    };
  }
  return {create};
})();
