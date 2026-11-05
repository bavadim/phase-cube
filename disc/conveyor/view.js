/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.ConveyorView = (() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const colors = {kick:['#e7ae63','#9b6532'],bass:['#83c8ab','#487664'],hook:['#bda4e7','#766195']};
  const rates = [.5,1,2], keyNames = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
  const pitchName = n => keyNames[n % 12] + (Math.floor(n / 12) - 1);
  const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
  const wrap = (x,n) => x-Math.floor(x/n)*n;
  const svg = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(NS,tag);
    for(const [key,val] of Object.entries(attrs))node.setAttribute(key,val);
    if(parent)parent.append(node);
    return node;
  };
  const rect = (p,x,y,w,h,fill,rx=0) => svg('rect',{x,y,width:w,height:h,fill,rx},p);
  const line = (p,x1,y1,x2,y2,stroke,sw=1) => svg('line',{x1,y1,x2,y2,stroke,'stroke-width':sw},p);
  const circle = (p,cx,cy,r,fill,stroke='none',sw=1) => svg('circle',{cx,cy,r,fill,stroke,'stroke-width':sw},p);
  const label = (p,x,y,text,fill,size,anchor='middle') => {
    const e=svg('text',{x,y,fill,'font-size':size,'font-weight':600,'text-anchor':anchor},p); e.textContent=text;return e;
  };
  const setTransform = (node,s) => node.setAttribute('transform',s);
  let serial=0;

  function wheelPath(teeth,radius) {
    const points=[];
    for(let i=0;i<teeth;i++){
      for(const [f,dr] of [[-.50,-1.5],[-.31,-1.5],[-.17,1.25],[.17,1.25],[.31,-1.5]]){
        const angle=2*Math.PI*(i+f)/teeth;
        points.push(((radius+dr)*Math.cos(angle)).toFixed(2)+','+((radius+dr)*Math.sin(angle)).toFixed(2));
      }
    }
    return 'M'+points.join('L')+'Z';
  }
  function pressButton(button, activate, opts) {
    let start=null, touchAt=-Infinity;
    button.addEventListener('pointerdown', event=>{
      if(event.isPrimary && event.pointerType==='touch')start={id:event.pointerId,x:event.clientX,y:event.clientY};
    },opts);
    button.addEventListener('pointercancel',()=>{start=null;},opts);
    button.addEventListener('pointerup', event=>{
      if(!start||start.id!==event.pointerId)return;
      const down=start;start=null;
      if(Math.hypot(event.clientX-down.x,event.clientY-down.y)>9)return;
      if(button.disabled || !button.contains(document.elementFromPoint(event.clientX,event.clientY)))return;
      touchAt=performance.now();activate();
    },opts);
    button.addEventListener('click', event=>{
      if(event.detail>0 && event.pointerType!=='mouse' && performance.now()-touchAt<700)return;
      if(!button.disabled)activate();
    },opts);
  }
  function create(host, callbacks) {
    const bindPress=(button,activate)=>pressButton(button,activate,opts);
    const id='cv'+(++serial);
    const events=new AbortController(), opts={signal:events.signal};
    host.classList.add('cv-machine');
    host.innerHTML='<svg class="cv-drive" aria-label="Коробка передач и лента с неподвижным считывателем"></svg>'+
      '<section class="cv-cassette"><div class="cv-toolbar"><span class="cv-title">Монтаж · такт</span><div class="cv-pages" role="group" aria-label="Редактируемый такт"></div>'+
      '<button type="button" data-eject class="cv-eject" aria-label="Снять выбранную плитку" title="Снять выбранную плитку"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6 4V2.5h4V4M5 6l.5 7h5L11 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg><span>Снять</span></button></div>'+
      '<svg class="cv-grid" tabindex="0" role="group" aria-label="Монтажное окно нот. По горизонтали время, по вертикали высота."></svg></section>';
    const drive=host.querySelector('.cv-drive'), grid=host.querySelector('.cv-grid'), eject=host.querySelector('[data-eject]');
    for(let i=0;i<4;i++){
      const b=document.createElement('button'); b.type='button'; b.dataset.bar=i;b.textContent=String(i+1);
      b.setAttribute('aria-label','Такт '+(i+1));host.querySelector('.cv-pages').append(b);
      bindPress(b,()=>callbacks.onBar?.(i));
    }
    let part=null, bar=0, selectedId=null, geometry=null, pointer=null, size=0, viewportPitch=null;
    let clockState={step:0,driveTurns:0,rate:1,activeIds:[],playing:false};
    let wheels=[], band,bandGrid,rollers,reader,bulb, needle, runNotes, runGeometry,activeSignature='',gearControls=[];
    let runningPick=null, lastPitch=null;
    const activeGroups=new Map();
    let gridBounds=null, gridTiles, playLine;
    function defs(parent) {
      const defs=svg('defs',{},parent);
      function gradient(tag,a,b,angle) {
        const g=svg('linearGradient',{id:id+tag,x1:'0',y1:'0',x2:angle?'1':'0',y2:'1'},defs);
        svg('stop',{offset:'0%','stop-color':a},g); svg('stop',{offset:'100%','stop-color':b},g);
      }
      gradient('metal','#a4ada0','#576c60',true); gradient('brass','#f5d89c','#b68952',true);
      gradient('belt','#203630','#102724',false);
      return defs;
    }
    function bolt(p,x,y) {circle(p,x,y,2.6,'#486259','#1c332b');line(p,x-1,y+.7,x+1,y-.7,'#a2aa93',.8);}
    function wheel(parent,x,y,n,brass) {
      const r=n*.9, group=svg('g',{},parent);
      const rotor=svg('g',{},group);setTransform(group,'translate('+x+' '+y+')');
      const path=wheelPath(n,r);
      const tooth=svg('path',{d:path,fill:'url(#'+id+(brass?'brass':'metal')+')',stroke:'#253c32','stroke-width':1.1},rotor);
      circle(rotor,0,0,r*.73,'none',brass?'#a6824c':'#586e61',1);
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3;
        circle(rotor,Math.cos(a)*r*.52,Math.sin(a)*r*.52,Math.max(1.5,r*.143),brass?'#6f6448':'#3d564b');
      }
      circle(group,0,0,r*.27,'#233b32',brass?'#e1c68f':'#9ba994',1.1);
      circle(group,0,0,r*.105,'#b8beab');
      return {rotor,tooth};
    }
    function buildDrive(){
      if(!size)return;
      drive.replaceChildren(); wheels=[];gearControls=[];rollers=[];runNotes=[];
      const defsNode=defs(drive);
      const compact=size<620;
      const gbW=compact?145:222, h=compact?145:175;
      drive.setAttribute('viewBox','0 0 '+size+' '+h);
      // Both shafts span all three pairs. Input wheels are keyed, output
      // wheels freewheel until the sliding collar engages one of them.
      const xs=compact?[28,72,116]:[44,109,174];
      const inputY=compact?43:55, outY=inputY+32.4, shaftEnd=gbW-5;
      rect(drive,8,10,gbW-12,h-20,'#1c342e',12);
      rect(drive,12,14,gbW-20,h-28,'#2d4940',9);
      for(const x of [18,gbW-14])for(const y of [20,h-20])bolt(drive,x,y);
      line(drive,xs[0]-16,inputY,shaftEnd,inputY,'#172d25',7);
      line(drive,xs[0]-16,inputY,shaftEnd,inputY,'#899482',3);
      line(drive,xs[0]-16,outY,gbW+10,outY,'#1a3029',8);
      line(drive,xs[0]-16,outY,gbW+10,outY,'#b2aa89',4);
      rates.forEach((rate,i)=>{
        const x=xs[i], b=svg('g',{'class':'cv-selector'},drive);
        const bw=compact?40:55, y=compact?20:24, bH=compact?105:123;
        const boundary=rect(b,x-bw/2,y,bw,bH,'transparent',8);
        boundary.setAttribute('class','cv-gear-outline');
        const n1=[12,18,24][i],n2=36-n1;
        const w1=wheel(b,x,inputY,n1,true),w2=wheel(b,x,outY,n2,false);
        const ratio=label(b,x,compact?117:139,['½×','1×','2×'][i],'#e1decb',compact?13:15);
        ratio.classList.add('cv-ratio');
        const collar=rect(b,x-11,outY+20,22,6,'#eabb6d',2);
        line(b,x-8,outY+22,x+8,outY+22,'#fff0bc',1).setAttribute('class','cv-collar-line');
        // Keep the pocket's hit surface fixed while the teeth rotate.
        const button=rect(b,x-bw/2,y,bw,bH,'transparent',8);
        button.setAttribute('role','button');button.setAttribute('tabindex','0');
        button.setAttribute('data-speed',rate);
        button.setAttribute('aria-label','Скорость ленты '+(['½','1','2'][i])+'×');
        wheels.push({w1,w2,n1,n2,rate});gearControls.push({button,collar,boundary,w2,ratio});
        bindPress(button,()=>callbacks.onRate?.(rate));
        button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();callbacks.onRate?.(rate);}},opts);
      });
      // Walk the power take-off across the housing to the left belt drum.
      const left=gbW+13,right=size-(compact?19:30), top=compact?57:66, bottom=compact?93:110;
      const r=(bottom-top)/2, cy=top+r, axle=left+r, end=right-r;
      svg('path',{d:'M '+(gbW-13)+' '+outY+' H '+(gbW+2)+' L '+axle+' '+cy,fill:'none',stroke:'#1a3028','stroke-width':12,'stroke-linejoin':'round'},drive);
      svg('path',{d:'M '+(gbW-13)+' '+outY+' H '+(gbW+2)+' L '+axle+' '+cy,fill:'none',stroke:'#acac91','stroke-width':5,'stroke-linejoin':'round'},drive);
      const holder=rect(drive,left-3,top-4,right-left+6,bottom-top+8,'#172b25',r+4);
      holder.setAttribute('stroke','#466053');
      rect(drive,left,top,right-left,bottom-top,'url(#'+id+'belt)',r);
      for(const x of [axle,end]){
        const rot=svg('g',{transform:'translate('+x+' '+cy+')'},drive);
        circle(rot,0,0,r-2,'#6e8272','#b6b9a0');
        const spokes=svg('g',{},rot);rollers.push(spokes);
        for(let i=0;i<3;i++){
          const a=2*Math.PI*i/3;
          circle(spokes,.5*r*Math.cos(a),.5*r*Math.sin(a),.14*r,'#3b5146');
        }
        circle(rot,0,0,r*.22,'#2d453b','#b9b69b');
      }
      // Eight tile sockets per turn of the directly coupled output drum.
      const pitch=2*Math.PI*r/8;
      const headX=axle+(end-axle)*(compact?.31:.37);
      runGeometry={left:axle,right:end,top,bottom,pitch,headX};
      const clip=svg('clipPath',{id:id+'run'},defsNode);
      rect(clip,axle,2,end-axle,bottom+4,'#fff');
      const visible=svg('g',{'clip-path':'url(#'+id+'run)'},drive);
      bandGrid=svg('g',{},visible);
      for(let x=axle-pitch*2;x<end+pitch*2;x+=pitch){
        line(bandGrid,x,top+1,x,top+6,'#b0b7a1',1.5);
        line(bandGrid,x+3,top+8,x+8,bottom-8,'#305046',1.5);
      }
      band=svg('g',{},visible);
      for(let x=axle-pitch*2;x<end+pitch*2;x+=pitch){
        line(band,x,bottom-4,x,bottom-1,'#758b79',1.5);
      }
      runNotes=svg('g',{},visible); runNotes._part=null;
      const bridge=svg('g',{},drive);
      line(bridge,headX,top-23,headX,top+7,'#e3bd71',1.8).setAttribute('data-reader-line','');
      svg('path',{d:'M'+(headX-5)+' '+(top-27)+' h10 l-5 8z',fill:'#f4c373'},bridge);
      bulb=circle(bridge,headX,top-35,4,'#a48959','#f4d48d',1);
      needle=svg('path',{d:'M'+(headX-7)+' '+(bottom+6)+'h14',fill:'none',stroke:'#e9bd70','stroke-width':2},bridge);
      if(!compact)label(bridge,headX+14,top-31,'СЧИТЫВАТЕЛЬ','#c9d1bc',9,'start');
      const start=compact?left:axle;
      label(drive,start,h-17,'ЛЕНТА','#b9c6b4',9,'start');
      reader=label(drive,right,h-17,'01 / 64','#e4dcc4',11,'end');
      paintDrive();
    }
    function paintDrive(){
      if(!part||!runGeometry||!runNotes)return;
      const audible=clockState.part?.key===part.key?clockState.part:part;
      const t=clockState.step||0;
      const {pitch,headX,left,right,top,bottom}=runGeometry;
      const turnsPerBar=16*pitch/(Math.PI*(bottom-top));
      const reference=(clockState.driveTurns||0)*turnsPerBar;
      for(let i=0;i<wheels.length;i++){
        const {w1,w2,n1,n2,rate}=wheels[i];
        setTransform(w1.rotor,'rotate('+(reference*360)+')');
        // Touch lies on +Y for the input, -Y for the output wheel.
        const contactTurns=.75-(.5-n1*.25)/n2;
        setTransform(w2.rotor,'rotate('+((contactTurns-reference*rate)*360)+')');
        const control=gearControls[i], selected=rate===part.speed;
        control.button.setAttribute('aria-pressed',String(selected));
        control.ratio.setAttribute('fill',selected?'#ffdc90':'#e1decb');
        control.collar.setAttribute('opacity',selected?'1':'.1');
        control.button.parentElement.querySelector('.cv-collar-line').setAttribute('opacity',selected?'1':'0');
        control.boundary.setAttribute('fill',selected?'#49604c':'transparent');
        control.w2.tooth.setAttribute('fill','url(#'+id+(rate===audible.speed?'brass':'metal')+')');
      }
      const move=wrap(t,1)*pitch;
      setTransform(bandGrid,'translate('+(-move)+' 0)');setTransform(band,'translate('+move+' 0)');
      for(const roller of rollers)setTransform(roller,'rotate('+(-t*pitch*180/(Math.PI*(runGeometry.bottom-top)/2))+')');
      if(runNotes._part!==audible){
        runNotes.replaceChildren();
        runNotes._part=audible;
        // Pack simultaneous gates into separate rows, including held notes
        // across the seam. Each tile still has its own onset at the reader.
        const voices=[];
        function laneFor(n){
          let i=voices.findIndex(row=>row.every(other=>wrap(n.step-other.step,64)>=other.length && wrap(other.step-n.step,64)>=n.length));
          if(i<0){i=voices.length;voices.push([]);}
          voices[i].push(n);
        }
        for(const note of audible.notes)laneFor(note);
        const laneHeight=Math.min(15,(top-6)/Math.max(1,voices.length)), height=Math.max(1,laneHeight-1);
        for(const [lane,notes] of voices.entries())for(const n of notes) {
          const width=Math.max(2,n.length*pitch-1);
          // A gate longer than the hidden return path can cross both ends of
          // the visible strip, so draw both portions when needed.
          const copies=Math.ceil((width+right-left)/(64*pitch));
          for(let copy=0;copy<copies;copy++){
            const piece=svg('g',{'data-running-id':n.id},runNotes);
            Object.assign(piece,{_note:n,_copy:copy,_y:top-(lane+1)*laneHeight});
            piece.style.cursor='pointer';
            const block=rect(piece,0,0,width,height,colors[part.key][0],Math.min(2.5,height/3));
            block.setAttribute('stroke',colors[part.key][1]);
            line(piece,2,1.2,2,height-1.2,'#fff6d8',1.25);
            if(width>=13.5 && height>=9){
              label(piece,4,height*.5+2.8,part.key==='kick'?'●':pitchName(n.pitch),'#3e3642',Math.min(9,(width-4)/pitchName(n.pitch).length*1.6),'start');
            }else if(width>5){
              const y=1+(1-(n.pitch%12)/11)*(height-2);
              line(piece,3,y,Math.min(width-1,9),y,'#504555',1);
            }
          }
        }
      }
      const active=clockState.playing?new Set(clockState.activeIds):new Set();
      for(const piece of runNotes.children) {
        const n=piece._note,delta=n.step-t;
        const firstCycle=Math.ceil(((left-headX)/pitch - n.length - delta)/64);
        const x=headX+(delta+64*(firstCycle+piece._copy))*pitch;
        const visible=x+n.length*pitch>=left && x<=right;
        piece.style.display=visible?'':'none';
        if(visible){
          setTransform(piece,'translate('+x+' '+piece._y+')');
          piece.firstChild.setAttribute('fill',active.has(n.id)?'#fff2b6':colors[part.key][0]);
        }
      }
      const strike=clockState.playing&&audible.notes.some(n=>wrap(t-n.step,64)<Math.min(.5,n.length));
      bulb.setAttribute('fill',strike?'#fff6c1':active.size?'#e5c77d':'#8f855f');
      bulb.setAttribute('r',strike?'5.5':'4');
      needle.setAttribute('stroke',active.size?'#fff5b5':'#a2936d');
      reader.textContent=String(Math.floor(t)+1).padStart(2,'0')+' / 64';
    }
    drive.addEventListener('pointerdown',e=>{
      if(!runGeometry||!part||e.button!==0||runningPick||e.target.closest('[data-speed]'))return;
      const {x,y}=new DOMPoint(e.clientX,e.clientY).matrixTransform(drive.getScreenCTM().inverse());
      const {left,right,top,bottom,pitch,headX}=runGeometry;
      if(x<left||x>right||y<top-22||y>bottom+4)return;
      // Latch the physical cell when the finger lands, before the moving
      // pallet advances. Waiting for click would select a different note.
      const id=e.target.closest('[data-running-id]')?.dataset.runningId;
      const step=wrap(Math.floor(clockState.step+(x-headX)/pitch),64);
      const note=part.notes.find(n=>n.id===id);
      const near=part.notes.reduce((best,n)=>!best||Math.abs(wrap(n.step-step+32,64)-32)<Math.abs(wrap(best.step-step+32,64)-32)?n:best,null);
      const chosenPitch=part.key==='kick'?36:(selectedNote()?.pitch??lastPitch??near?.pitch??(part.key==='hook'?72:48));
      runningPick={pointer:e.pointerId,x:e.clientX,y:e.clientY,note,step,pitch:chosenPitch};
      drive.setPointerCapture(e.pointerId);
    },opts);
    drive.addEventListener('pointerup',e=>{
      if(!runningPick||runningPick.pointer!==e.pointerId)return;
      const pick=runningPick;runningPick=null;
      if(drive.hasPointerCapture(e.pointerId))drive.releasePointerCapture(e.pointerId);
      if(Math.hypot(e.clientX-pick.x,e.clientY-pick.y)>9)return;
      const note=pick.note||part.notes.find(n=>n.step===pick.step&&n.pitch===pick.pitch);
      callbacks.onBar?.(Math.floor((note?.step??pick.step)/16));
      if(note)callbacks.onSelect?.(note.id); else callbacks.onAdd?.({step:pick.step,pitch:pick.pitch,length:1});
    },opts);
    drive.addEventListener('pointercancel',()=>{runningPick=null;},opts);
    drive.addEventListener('lostpointercapture',()=>{runningPick=null;},opts);
    function selectedNote(){return part?.notes.find(n=>n.id===selectedId);}
    function pitchWindow(){
      if(part.key==='kick')return {low:36,high:36};
      const notes=part.notes.filter(n=>Math.floor(n.step/16)===bar);
      const pitches=notes.length?notes.map(n=>n.pitch):[part.key==='hook'?72:48];
      const minimum=Math.min(...pitches), maximum=Math.max(...pitches);
      const count=Math.min(19,Math.max(11,maximum-minimum+3));
      const middle=(minimum+maximum)/2;
      const low=clamp(viewportPitch??Math.round(middle-(count-1)/2),0,128-count);
      return {low,high:low+count-1};
    }
    function buildGrid(resetWindow=false){
      if(!part||!size)return;
      if(resetWindow)viewportPitch=null;
      grid.replaceChildren();activeGroups.clear();activeSignature=null;
      const width=grid.clientWidth||size-30, compact=width<610;
      const {low,high}=pitchWindow(), count=high-low+1;
      // Pin the editing range until a bar or instrument is changed, so newly
      // added notes cannot move the lanes out from under a pointer.
      viewportPitch=low;
      const height=part.key==='kick'?(compact?108:116):(compact?clamp(Math.round(innerHeight*.34),218,294):252);
      const x0=compact?33:47,y0=25,right=width-5;
      const cell=(right-x0)/16, lane=(height-y0-6)/count;
      gridBounds={width,height,x0,y0,right,low,high,cell,lane};
      grid.setAttribute('viewBox','0 0 '+width+' '+height);
      const defsNode=svg('defs',{},grid), clip=svg('clipPath',{id:id+'grid'},defsNode);
      rect(clip,x0,y0,right-x0,height-y0-5,'white');
      rect(grid,0,0,width,height,'#e7e7d9');
      rect(grid,x0,0,right-x0,y0,'#d1d5c4');
      for(let k=0;k<16;k++){
        const x=x0+k*cell;
        line(grid,x,17,x,22,k%4?'#8fa08b':'#485f50',k%4?.8:1.4);
        if(k%4===0)label(grid,x+3,13,(k/4+1),'#40594a',10,'start');
      }
      for(let n=high;n>=low;n--){
        const y=y0+(high-n)*lane,dark=[1,3,6,8,10].includes(n%12);
        rect(grid,x0,y,right-x0,lane,dark?'#dedfce':'#edf0e2');
        rect(grid,2,y,x0-5,lane,dark?'#879485':'#c6cebb',1);
        if(count===1||n%12===0||lane>=13||n%2===0)
          label(grid,x0-6,y+lane/2+3.5,part.key==='kick'?'●':pitchName(n),dark?'#243e31':'#4e6352',lane<13?8:10,'end');
        line(grid,x0,y,right,y,'#bbc4ae',.7);
      }
      for(let k=0;k<=16;k++)line(grid,x0+k*cell,y0,x0+k*cell,height-6,k%4?'#bcc5b0':'#8b9f89',k%4?.8:1.4);
      const cut=svg('g',{'clip-path':'url(#'+id+'grid)'},grid);
      playLine=rect(cut,x0,y0,2,height-y0-6,'#b98435');
      playLine.setAttribute('opacity','.8');
      gridTiles=svg('g',{},cut);
      const begin=bar*16, end=begin+16;
      const inPage=part.notes.filter(n=>n.step>=begin&&n.step<end);
      for(const n of part.notes){
        for(const start of [n.step,n.step-64]){
          if(start<begin && start+n.length>begin)paintTile(n,start, true);
        }
      }
      for(const n of inPage) if(n.id!==selectedId)paintTile(n,n.step);
      for(const n of inPage) if(n.id===selectedId)paintTile(n,n.step);
      if(high<127||low>0){
        const ruler=rect(grid,0,y0,x0-2,height-y0-5,'transparent');
        ruler.setAttribute('data-ruler','');
        ruler.style.cursor=part.key==='kick'?'default':'ns-resize';
      }
      paintGridClock();
    }
    function tileRect(note,start) {
      const g=gridBounds, x=g.x0+(start-bar*16)*g.cell;
      const rowCenter=g.y0+(g.high-note.pitch+.5)*g.lane;
      const h=Math.min(g.lane-1.4,part.key==='kick'?30:25);
      return {x,y:rowCenter-h/2,w:Math.max(2,note.length*g.cell-1.5),h};
    }
    function paintTile(note,start,carry=false,preview=false) {
      const g=gridBounds;
      if(note.pitch<g.low||note.pitch>g.high)return;
      const b=tileRect(note,start), selected=!carry&&note.id===selectedId;
      const group=svg('g',{},gridTiles);
      const groove=rect(group,b.x+.5,b.y,b.w,b.h,colors[part.key][0],Math.min(3,b.h*.24));
      groove.setAttribute('stroke',selected?'#1c4035':colors[part.key][1]);
      groove.setAttribute('stroke-width',selected?2.2:1.2);
      line(group,b.x+2,b.y+1.8,b.x+Math.max(2,b.w-2),b.y+1.8,'#fff6d4',.9);
      if(!carry){
        circle(group,b.x+Math.min(b.w*.24,5),b.y+b.h/2,Math.min(1.8,b.h*.16),'#405646');
        if(b.w>35&&b.h>=10)label(group,b.x+9,b.y+b.h/2+3,part.key==='kick'?'●':pitchName(note.pitch),'#293b32',Math.min(10,b.h*.63),'start');
      }
      if(carry){group.setAttribute('opacity','.6');group.style.pointerEvents='none';return;}
      if(preview){group.style.pointerEvents='none';group.setAttribute('opacity','.83');return;}
      group.setAttribute('data-note-id',note.id);
      const desc=svg('title',{},group);desc.textContent=pitchName(note.pitch)+' · '+(note.step+1);
      activeGroups.set(note.id,groove);
      if(selected){
        const x=Math.min(g.right-3,b.x+b.w), y=b.y+b.h/2;
        const handle=svg('g',{'data-length-id':note.id},gridTiles);
        const width=clamp(b.w*.3,7,15), hw=width/2;
        rect(handle,x-hw,y-Math.max(9,b.h/2),width,Math.max(18,b.h),'transparent');
        rect(handle,x-2.1,y-Math.min(5,b.h*.36),4.2,Math.min(10,b.h*.72),'#314c40',1.5);
      }
    }
    function paintGridClock(){
      if(!gridBounds||!part)return;
      const {x0,cell}=gridBounds, step=clockState.step||0;
      const local=step-bar*16;
      playLine.style.display=clockState.playing && local>=0&&local<16?'':'none';
      playLine.setAttribute('x',x0+local*cell);
      const active=clockState.playing?clockState.activeIds||[]:[];
      const signature=active.join('|');
      if(activeSignature===signature)return;
      activeSignature=signature;
      for(const [n,node] of activeGroups)node.setAttribute('fill',active.includes(n)?'#ffda86':colors[part.key][0]);
    }
    function localPoint(e) {
      const rect=grid.getBoundingClientRect();
      return {x:(e.clientX-rect.left)*gridBounds.width/rect.width,y:(e.clientY-rect.top)*gridBounds.height/rect.height};
    }
    function clientPoint(x,y){
      const box=grid.getBoundingClientRect();
      return {x:box.left+x*box.width/gridBounds.width,y:box.top+y*box.height/gridBounds.height};
    }
    function cellPoint(step,pitch) {
      const {x0,y0,cell,lane,high}=gridBounds;
      return clientPoint(x0+(step-bar*16+.5)*cell,y0+(high-pitch+.5)*lane);
    }
    function notePoint(id,kind='body'){
      const n=part?.notes.find(n=>n.id===id);if(!n||!gridBounds)return null;
      const {x,y,w,h}=tileRect(n,n.step);
      return clientPoint(kind==='length'?Math.min(gridBounds.right-3,x+w):x+Math.min(w*.32,gridBounds.cell*.36),y+h/2);
    }
    function cellAt(p){
      const g=gridBounds;
      return {step:bar*16+clamp(Math.floor((p.x-g.x0)/g.cell),0,15),
        pitch:clamp(g.high-Math.floor((p.y-g.y0)/g.lane),g.low,g.high),length:1};
    }
    function drawPreview(note){
      gridTiles.querySelector('[data-preview]')?.remove();
      paintTile(note,note.step,false,true);
      gridTiles.lastElementChild?.setAttribute('data-preview','');
    }
    function cancel(){
      if(!pointer)return;
      const old=pointer;pointer=null;
      if(grid.hasPointerCapture(old.id))grid.releasePointerCapture(old.id);
      buildGrid();
    }
    grid.addEventListener('pointerdown',e=>{
      if(!part||pointer||e.button!==0)return;
      const p=localPoint(e),g=gridBounds;
      if(p.y<g.y0||p.y>g.height-4)return;
      const grip=e.target.closest('[data-length-id]'), tile=e.target.closest('[data-note-id]');
      const note=part.notes.find(n=>n.id===(grip?.dataset.lengthId||tile?.dataset.noteId));
      const kind=p.x<g.x0?'ruler':grip?'length':note?'move':'add';
      if(kind==='ruler'&&part.key==='kick')return;
      if(p.x>g.right)return;
      pointer={id:e.pointerId,kind,at:p,initial:note?{...note}:cellAt(p),patch:null,moved:false,low:g.low};
      grid.focus({preventScroll:true});
      grid.setPointerCapture(e.pointerId);
      e.preventDefault();
    },opts);
    grid.addEventListener('pointermove',e=>{
      const drag=pointer;if(!drag||drag.id!==e.pointerId)return;
      const p=localPoint(e),g=gridBounds;
      const dx=p.x-drag.at.x,dy=p.y-drag.at.y;
      if(!drag.moved&&Math.hypot(dx,dy)<4)return;
      drag.moved=true;
      if(drag.kind==='ruler'){
        viewportPitch=clamp(drag.low+Math.round(dy/g.lane),0,127-(g.high-g.low));buildGrid();return;
      }
      if(drag.kind==='length') {
        drag.patch={length:clamp(Math.round(drag.initial.length+dx/g.cell),1,64)};
      } else if(drag.kind==='move'){
        drag.patch={step:clamp(drag.initial.step+Math.round(dx/g.cell),bar*16,bar*16+15),
          pitch:part.key==='kick'?36:clamp(drag.initial.pitch-Math.round(dy/g.lane),g.low,g.high)};
      } else drag.patch=cellAt(p);
      drawPreview({...drag.initial,...drag.patch});
    },opts);
    grid.addEventListener('pointerup',e=>{
      const drag=pointer;if(!drag||drag.id!==e.pointerId)return;
      pointer=null;grid.releasePointerCapture(e.pointerId);
      if(drag.kind==='ruler')return;
      if(drag.kind==='add')callbacks.onAdd?.(drag.patch||drag.initial);
      else if(!drag.moved)callbacks.onSelect?.(drag.initial.id);
      else if(drag.patch) {
        const pageButton=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-bar]');
        const destination=pageButton&&host.contains(pageButton)?Number(pageButton.dataset.bar):bar;
        if(drag.kind==='move' && destination!==bar){
          const step=destination*16+drag.initial.step%16;
          callbacks.onEdit?.(drag.initial.id,{step});
          if(part.notes.some(n=>n.id===drag.initial.id && n.step===step)){
            callbacks.onBar?.(destination);
            callbacks.onSelect?.(drag.initial.id);
          }
        } else callbacks.onEdit?.(drag.initial.id,drag.patch);
      }
      buildGrid();
    },opts);
    grid.addEventListener('pointercancel',cancel,opts);grid.addEventListener('lostpointercapture',e=>{
      if(pointer&&e.pointerId===pointer.id)cancel();
    },opts);
    grid.addEventListener('wheel',e=>{
      if(!part||part.key==='kick'||localPoint(e).x>=gridBounds.x0)return;
      e.preventDefault();
      viewportPitch=clamp(viewportPitch+Math.sign(e.deltaY)*-1,0,127-(gridBounds.high-gridBounds.low));buildGrid();
    },{...opts,passive:false});
    grid.addEventListener('keydown',e=>{
      const note=selectedNote(); if(!note)return;
      if(['Delete','Backspace'].includes(e.key)){e.preventDefault();callbacks.onDelete?.(note.id);return;}
      const delta=['ArrowUp','ArrowRight'].includes(e.key)?1:-1;
      if(!e.key.startsWith('Arrow'))return;
      e.preventDefault();
      if(e.shiftKey)callbacks.onEdit?.(note.id,{length:clamp(Math.round(note.length)+delta,1,64)});
      else if(['ArrowUp','ArrowDown'].includes(e.key)&&part.key!=='kick')callbacks.onEdit?.(note.id,{pitch:clamp(note.pitch+delta,0,127)});
      else if(['ArrowLeft','ArrowRight'].includes(e.key))callbacks.onEdit?.(note.id,{step:bar*16+wrap(note.step+delta,16)});
    },opts);
    bindPress(eject,()=>{if(selectedId)callbacks.onDelete?.(selectedId);});
    function resize(){
      const next=Math.round(host.clientWidth);if(!next||size===next)return;
      size=next;if(pointer)cancel();buildDrive();buildGrid();
    }
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    return {
      update(next){
        const changed=part?.key!==next.part.key||bar!==next.bar;
        if(changed&&pointer)cancel();
        if(part?.key!==next.part.key)lastPitch=null;
        part=next.part;bar=next.bar;selectedId=next.selectedId;
        if(selectedNote())lastPitch=selectedNote().pitch;
        host.style.setProperty('--tile',colors[part.key][0]);
        host.style.setProperty('--tile-dark',colors[part.key][1]);
        eject.disabled=!selectedNote();
        for(const b of host.querySelectorAll('[data-bar]'))b.setAttribute('aria-pressed',String(+b.dataset.bar===bar));
        buildGrid(changed);paintDrive();
      },
      clock(value){clockState=value;paintDrive();paintGridClock();},
      cellPoint,notePoint,
      inspect(){return {step:clockState.step,playing:clockState.playing,activeIds:clockState.activeIds,
        rate:clockState.rate,selectedId,bar,headX:runGeometry?.headX,tileSpacing:runGeometry?.pitch,notes:activeGroups.size};},
      destroy(){cancel();events.abort();observer.disconnect();host.replaceChildren();host.classList.remove('cv-machine');}
    };
  }
  return {create,pressButton};
})();
