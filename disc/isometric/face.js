/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoFace=(()=>{
  'use strict';
  const bounds={
    router:[[-1.38,-.04,-1.08],[1.42,2.58,1.09]],
    source:[[-1.88,-.04,-2.23],[1.79,1.96,1.53]],
    delay:[[-1.18,-.04,-1.08],[1.20,1.0,1.13]]
  };
  const idle='#e5e4d2';
  const row=(type,key,x,y,z,w,d,extra={})=>({type,key,x,y,z,w,d,...extra});
  const paintTools=[...IsoFlow.PALETTE.filter(pitch=>pitch!==null),null];
  const layouts={
    source:[
      ...paintTools.map((pitch,i)=>row('brush','brush-'+(pitch??'rest'),-1.20+.80*i,1.08,-1.88,.59,.55,{pitch})),
      ...Array.from({length:8},(_,i)=>{const a=-i*Math.PI/4;
        return row('pin','pin-'+i,.55+.95*Math.sin(a),1.241,.13+.95*Math.cos(a),.43,.43,{i});
      }),
      ...Array.from({length:4},(_,i)=>row('phase','rim-'+i,0,0,0,.38,.38,{i})),
      row('level','lift',.55,1.58,.13,.47,.47)
    ],
    delay:[row('slot','delay-0',-.84,.50,.32,.35,.45,{i:0}),
      ...Array.from({length:4},(_,n)=>row('slot','delay-'+(n+1),-.50+n*.44,.53,.20,.38,.48,{i:n+1}))]
  };
  const paths={erase:'m3 14 9-10 8 7-9 10H8Zm5-5 8 7'};
  function symbol(name){
    const ns='http://www.w3.org/2000/svg',s=document.createElementNS(ns,'svg'),p=document.createElementNS(ns,'path');
    s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');p.setAttribute('d',paths[name]);s.append(p);return s;
  }

  function attr(e,k,v){if(e.getAttribute(k)!==String(v))e.setAttribute(k,String(v));}
  function rgbaChoice(e,name,value){if(value)e.dataset[name]='true';else delete e.dataset[name];}
  function fluidFill(colors){
    if(colors.length<2)return colors[0]||'transparent';
    return 'linear-gradient(90deg,'+colors.map((c,i)=>c+' '+(100*i/colors.length)+'% '+(100*(i+1)/colors.length)+'%').join(',')+')';
  }
  function controlData(def,s,frame){
    const {pitchName}=window.IsoWorkshopLabels;
    const playStep=frame.playing?frame.tick.step:-1;
    const {type,i}=def;
    if(type==='program'){
      const selected=IsoFlow.routePresetIndex(s)===i;
      return {chosen:selected,pressed:selected,label:'Рисунок задвижки '+(i+1)+(selected?', выбран':'')};
    }
    if(type==='brush'){
      const pitch=def.pitch,chosen=frame.paintPitch===pitch;
      return {chosen,pressed:chosen,color:pitch===null?idle:IsoPieces.noteColor(pitch),
        label:pitch===null?'Пауза. Убрать ноту со штифта':pitchName(pitch)+'. Выбрать и послушать ноту'};
    }
    if(type==='pin'){
      const tones=IsoFlow.pitches(s.source.notes[i]),name=tones.map(pitchName).join(', ')||'пауза';
      const brush=frame.paintPitch;
      return {live:playStep>=0&&(playStep-s.source.phase+8)%8===i,rest:!tones.length,tones,
        color:tones.length?IsoPieces.noteColor(tones[0]):idle,label:'Штифт '+(i+1)+', '+name+'. '+(brush===undefined?'Сменить ноту':brush===null?'Слить жидкость':'Добавить '+pitchName(brush))};
    }
    if(type==='phase')return {label:'Повернуть нотный диск. Сдвиг '+s.source.phase+' восьмых'};
    if(type==='level')return {label:'Поднять ручку громкости. '+Math.round(s.source.level*100)+'%'};
    if(type==='slot')return {chosen:s.delay===i,pressed:s.delay===i,label:'Задержка '+i+' восьмых'};
  }
  function activate(def,frame,cb){
    const state=frame.editState||frame.state;
    switch(def.type){
      case 'brush':return cb.choosePitch(def.pitch);
      case 'pin':return cb.act({type:'note',index:def.i});
      case 'program':return cb.chooseRoutePreset(def.i);
      case 'slot':
        if(cb.act({type:'delay',delta:def.i-state.delay})&&!frame.playing)cb.testDose('delay');
    }
  }
  function sectorTap(element,perform) {
    let finger=null,released=-Infinity;
    element.onpointerdown=ev=>{
      if(!ev.isPrimary||ev.button!==0)return;
      finger={id:ev.pointerId,x:ev.clientX,y:ev.clientY};
      element.setPointerCapture(ev.pointerId);
    };
    element.onpointercancel=()=>{finger=null;};
    element.onpointerup=ev=>{
      if(finger?.id!==ev.pointerId)return;
      const tap=Math.hypot(ev.clientX-finger.x,ev.clientY-finger.y)<14;
      released=performance.now();finger=null;
      if(tap)perform();
    };
    element.onclick=ev=>{if(!ev.pointerType&&ev.detail===0&&performance.now()-released>350)perform();};
  }
  // The same axial cam selection remains visible in the 2D renderer.
  function flatCam(root){
    const ns='http://www.w3.org/2000/svg';
    const add=(tag,attrs,parent)=>{
      const element=document.createElementNS(ns,tag);
      for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);
      parent.append(element);return element;
    };
    const scene=add('svg',{class:'flat-cam',viewBox:'0 0 320 340','aria-hidden':'true'},root);
    add('path',{d:'M121 18V302M246 23V307',fill:'none',stroke:'#697d70','stroke-width':11,'stroke-linecap':'round'},scene);
    add('path',{d:'M68 306H274',fill:'none',stroke:'#b5bfa9','stroke-width':18,'stroke-linecap':'round'},scene);
    const barrel=add('g',{},scene),arm=add('g',{},scene);
    add('path',{d:'M190 0H246',fill:'none',stroke:'#b79458','stroke-width':9,'stroke-linecap':'round'},arm);
    add('circle',{cx:246,cy:0,r:15,fill:'#e2bb6b',stroke:'#736b4e','stroke-width':3},arm);
    let signature='',angle,lastState,rows=[];
    const rowY=i=>285-i*43;
    function update(frame){
      const state=frame.editState||frame.state,programs=IsoFlow.routerPrograms(state);
      const next=programs.map(program=>program.routes.map(Number).join('')).join('|');
      if(next!==signature){
        barrel.replaceChildren();rows=programs.map((program,i)=>{
          const g=add('g',{},barrel),side=add('path',{stroke:'#4a6459','stroke-width':1.5},g),top=add('path',{stroke:'#4a6459','stroke-width':1.3},g);
          return {g,side,top,program,i};
        });signature=next;
      }
      const phase=(frame.time||0)*Math.PI*2;
      if(phase!==angle||lastState!==state){
        const active=IsoFlow.routePresetIndex(state);
        for(const row of rows){
          const points=[];
          for(let n=0;n<128;n++){
            const a=n*Math.PI*2/128,unit=n/16,i=Math.floor(unit)%8;
            const r=IsoPieces.camRadius((unit-i)-.5,row.program.routes[(i+7)%8],row.program.routes[i],row.program.routes[(i+1)%8]);
            points.push([121+Math.cos(a-phase)*r*83,rowY(row.i)+Math.sin(a-phase)*r*23]);
          }
          const upper='M '+points.map(p=>p.join(' ')).join(' L ')+' Z';
          row.side.setAttribute('d','M '+points.map(([x,y])=>[x,y+9].join(' ')).join(' L ')+' Z');
          row.top.setAttribute('d',upper);
          row.side.setAttribute('fill',row.i===active?'#4f8e76':'#7c9989');
          row.top.setAttribute('fill',row.i===active?'#b6d0a7':'#c2ccc0');
        }
        arm.setAttribute('transform','translate(0 '+rowY(active)+')');
        angle=phase;lastState=state;
      }
    }
    return {update,place(e,d){e.style.left='59%';e.style.top=(rowY(d.i)/340*100)+'%';e.style.width='42%';e.style.height='12%';},rowPixels(){return root.getBoundingClientRect().height*43/340;}};
  }
  function flatScore(root){
    const well=document.createElement('div');well.className='flat-score';root.append(well);
    const ns='http://www.w3.org/2000/svg';
    const drawing=document.createElementNS(ns,'svg');drawing.setAttribute('viewBox','-1.3 -1.3 2.6 2.6');
    drawing.setAttribute('aria-hidden','true');well.append(drawing);
    const rim=document.createElementNS(ns,'path'),vertices=[];
    for(let tooth=0;tooth<24;tooth++)for(const [offset,r] of [[-.50,1.10],[-.30,1.20],[.30,1.20],[.50,1.10]]){
      const a=(tooth+offset)*Math.PI/12;vertices.push([Math.sin(a)*r,Math.cos(a)*r].join(' '));
    }
    rim.setAttribute('d','M '+vertices.join(' L ')+' Z');rim.setAttribute('fill','#617a6e');drawing.append(rim);
    const layer=(r,fill)=>{const e=document.createElementNS(ns,'circle');e.setAttribute('r',r);e.setAttribute('fill',fill);drawing.append(e);};
    layer(1.085,'#3a554a');layer(.74,'#8fbb9d');layer(.28,'#c49b5e');layer(.14,'#71684c');
    const reader=document.createElementNS(ns,'path');reader.setAttribute('d','M -.105 1.27 L 0 1.07 L .105 1.27 Z');
    reader.setAttribute('fill','#faf1cf');reader.setAttribute('stroke','#394c3e');reader.setAttribute('stroke-width','.025');drawing.append(reader);
    return {well,update(frame){const p=IsoPieces.scorePin(frame,0);
      const angle=Math.atan2(p.x-.55,p.z-.13);rim.setAttribute('transform','rotate('+(-angle*180/Math.PI)+')');},
      place(e,d,frame){
        let p;if(d.type==='pin')p=IsoPieces.scorePin(frame,d.i);
        if(d.type==='phase'){const a=(d.i+.5)*Math.PI/2;p={x:.55+Math.sin(a)*1.15,z:.13+Math.cos(a)*1.15};}
        if(d.type==='level')p={x:.55,z:.13-.15*(frame.editState||frame.state).source.level};
        e.style.left=(50+(p.x-.55)*100/2.6)+'%';e.style.top=(50+(p.z-.13)*100/2.6)+'%';}};
  }
  // The fallback has the same two fluid paths as the cast models. Glass shows
  // separate bands for the pitches in a dose, including after the source changes.
  function flatVessels(root){
    const id='delay';
    const ns='http://www.w3.org/2000/svg';
    const create=(tag,attrs,parent)=>{
      const el=document.createElementNS(ns,tag);
      for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
      parent.append(el);return el;
    };
    const diagram=create('svg',{viewBox:'0 0 320 240','aria-hidden':'true',class:'flat-fluid-drawing'},root);
    const line=(d,color,w,parent=diagram)=>create('path',{d,fill:'none',stroke:color,'stroke-width':w,'stroke-linecap':'round','stroke-linejoin':'round'},parent);
    const pipe=d=>{line(d,'#65827b',13);line(d,'#dcece0',8);};
    const box=(x,y,w,h,r,fill,stroke,width=2,parent=diagram)=>create('rect',{x,y,width:w,height:h,rx:r,fill,stroke,'stroke-width':width},parent);
    const well=(x,y,w,h)=>{
      const shell=box(x,y,w,h,6,'#e2efe1','#60877d',3);
      const bands=create('g',{},diagram);
      line('M '+(x+5)+' '+(y+7)+' v '+(h*.47),'#fff9e1',2.2);
      let key,barHeight=-1;
      return {shell,fill(packets,amount){
        const pitches=IsoFlow.tones(packets),next=pitches.join(',');
        const height=Math.round(Math.max(0,Math.min(1,amount))*(h-9));
        if(key===next&&barHeight===height)return;
        if(key!==next){
          bands.replaceChildren();
          for(const [i,pitch] of pitches.entries()){
            const width=(w-8)/pitches.length;
            box(x+4+i*width,y,width+.15,1,0,IsoPieces.noteColor(pitch),'none',0,bands);
          }
          key=next;
        }
        for(const band of bands.children){band.setAttribute('y',y+h-4-height);band.setAttribute('height',height);}
        barHeight=height;
      }};
    };
    const coords={};
    const addPort=(port,x,y)=>{coords['port-'+id+':'+port]=[x,y];box(x-12,y-5,24,13,3,'#c2a673','#52665e');};
    let update;
    const xs=[91,147,203,259];
    pipe('M31 8V187Q31 202 47 202H270V218');
    pipe('M31 53H91V79');
    const siphons=xs.slice(1).map((x,i)=>{
      const bridge=create('g',{},diagram),d='M'+(xs[i]+9)+' 82 v-17 q0-7 7-7 h24 q7 0 7 7 v17';
      line(d,'#65827b',9,bridge);line(d,'#cadac8',5,bridge);
      return bridge;
    });
    const tanks=xs.map(x=>{
      pipe('M'+x+' 157V202');
      return well(x-18,75,36,83);
    });
    box(15,33,32,26,7,'#719486','#41685f');
    coords['delay-0']=[31,136];
    for(const [i,x] of xs.entries()){
      coords['delay-'+(i+1)]=[x,139];
      line('M'+(x-14)+' 102h6m-6 15h6','#608578',2);
    }
    addPort('out',270,218);
    const gate=box(0,176,25,12,4,'#9d7640','#725a3e');
    const stream=create('g',{},diagram);
    let released='';
    update=(state,tick,phase)=>{
      siphons.forEach((bridge,i)=>bridge.setAttribute('visibility',state.delay>i+1||tick?.pockets.some(p=>p.due-p.entered>i+1)?'visible':'hidden'));
      tanks.forEach((tank,i)=>{
        tank.shell.setAttribute('fill',i<state.delay?'#e0f1e3':'#c8d2c8');
        const waiting=tick?.pockets.filter(box=>tick.tick-box.entered===i)||[];
        tank.fill(waiting,waiting.length?.80-.14*phase:0);
      });
      gate.setAttribute('x',(state.delay?xs[state.delay-1]:31)-12.5);
      const output=tick?.edges.filter(e=>e.from==='delay:out')||[];
      const tones=IsoFlow.tones(output.length?output:state.delay===0?tick?.activity.delay||[]:[]);
      const signature=tones.join(',');
      if(released!==signature){
        stream.replaceChildren();
        tones.forEach((pitch,i)=>box(0,8*i/tones.length,16,8/tones.length,0,IsoPieces.noteColor(pitch),'none',0,stream));
        released=signature;
      }
      if(tones.length){
        const from=state.delay?xs[state.delay-1]:31;
        stream.setAttribute('transform','translate('+(from+(262-from)*phase)+' 198)');
      }
    };
    let lastTick,lastPhase,lastState;
    return {update(frame){
      const test=frame.testFluid?.station===id?frame.testFluid:null;
      const tick=test?.tick||(frame.playing?frame.tick:null);
      const phase=test?.progress??(frame.time*IsoFlow.STEPS)%1;
      const state=frame.editState||frame.state;
      if(tick===lastTick&&phase===lastPhase&&state===lastState)return;
      update(state,tick,phase);lastTick=tick;lastPhase=phase;lastState=state;
    },place(e,d){
      const [x,y]=coords[d.key];
      e.style.left=(x/320*100)+'%';e.style.top=(y/240*100)+'%';
    }};
  }
  function makeView({overlay,pieces,projectLocal,callbacks},flat){
    const root=document.createElement('div');root.dataset.face='';
    root.className='iso-face'+(flat?' is-flat':'');overlay.append(root);
    const faces=new Map();
    let graphic=null,active=null, controls=[], frame=null, state=null, step=-2,pose=null,paintPitch;
    let lastScoreTime,lastScorePhase;
    function pour(pin,pitch){
      if(!root.animate||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
      const brush=root.querySelector('[data-face-key="brush-'+(pitch??'rest')+'"]');
      if(!brush)return;
      const box=root.getBoundingClientRect(),start=(pitch===null?pin:brush).getBoundingClientRect(),
        end=(pitch===null?brush:pin).getBoundingClientRect();
      const x=start.left+start.width/2-box.left,y=start.top+start.height/2-box.top;
      const dx=end.left+end.width/2-box.left-x,dy=end.top+end.height/2-box.top-y;
      const bead=document.createElement('span');bead.className='poured-drop';bead.setAttribute('aria-hidden','true');
      bead.style.left=x+'px';bead.style.top=y+'px';
      bead.style.background=pitch===null?getComputedStyle(pin).getPropertyValue('--cap-tone'):IsoPieces.noteColor(pitch);
      root.append(bead);
      const motion=bead.animate([{transform:'translate(-50%,-50%)'},
        {transform:'translate(calc(-50% + '+dx*.5+'px),calc(-50% + '+(dy*.5-15)+'px))'},
        {transform:'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px)) scale(.75)'}],
        {duration:230,easing:'ease-in-out'});
      motion.onfinish=motion.oncancel=()=>bead.remove();
    }
    function layoutFor(id){
      if(id==='router')return IsoFlow.routerPrograms(frame.editState||frame.state).map((_,i)=>row('program','program-'+i,0,0,0,1.05,.30,{i}));
      return layouts[id]||[];
    }
    function screenPhase(x,y){
      if(flat){const r=graphic.well.getBoundingClientRect();return Math.atan2(x-r.left-r.width/2,y-r.top-r.height/2);}
      const c=IsoPieces.sourcePhase(pieces.source.group),p=projectLocal('source',c.x,c.y,c.z),
        a=projectLocal('source',c.x+1,c.y,c.z),b=projectLocal('source',c.x,c.y,c.z+1),r=root.getBoundingClientRect();
      const dx=x-r.left-p.x,dy=y-r.top-p.y,ax=a.x-p.x,ay=a.y-p.y,bx=b.x-p.x,by=b.y-p.y,det=ax*by-ay*bx;
      return Math.atan2((dx*by-dy*bx)/det,(dy*ax-dx*ay)/det);
    }
    function bindDrag(element,def){
      let pointer=null,released=-Infinity;
      const change=(count)=>{
        const s=frame.editState||frame.state;
        if(def.type==='phase')callbacks.act({type:'phase',delta:count});
        if(def.type==='level')callbacks.act({type:'level',delta:count*.25});
        if(def.type==='program')callbacks.chooseRoutePreset(Math.max(0,Math.min(IsoFlow.routerPrograms(s).length-1,IsoFlow.routePresetIndex(s)+count)));
      };
      element.onpointerdown=event=>{
        if(!event.isPrimary||event.button!==0)return;
        event.preventDefault();event.stopPropagation();
        const s=frame.editState||frame.state;
        let pitch=30;
        if(def.type==='program'){
          if(flat)pitch=graphic.rowPixels();
          else{const a=IsoPieces.routerRow(pieces.router.group,0),p=projectLocal('router',a.x,a.y,a.z),q=projectLocal('router',a.x,a.y+.30,a.z);pitch=Math.max(20,Math.hypot(q.x-p.x,q.y-p.y));}
        }
        pointer={id:event.pointerId,x:event.clientX,y:event.clientY,angle:def.type==='phase'?screenPhase(event.clientX,event.clientY):0,
          turn:0,steps:0,moved:false,pitch,program:IsoFlow.routePresetIndex(s)};
        element.setPointerCapture(event.pointerId);
      };
      element.onpointermove=event=>{
        const g=pointer;if(!g||event.pointerId!==g.id)return;
        event.preventDefault();
        if(Math.hypot(event.clientX-g.x,event.clientY-g.y)>5)g.moved=true;
        if(!g.moved)return;
        let steps;
        if(def.type==='phase'){
          const angle=screenPhase(event.clientX,event.clientY);
          g.turn-=Math.atan2(Math.sin(angle-g.angle),Math.cos(angle-g.angle));g.angle=angle;
          steps=Math.round(g.turn/(Math.PI/4));
        }else steps=Math.round((g.y-event.clientY)/(def.type==='level'?14:g.pitch));
        if(steps!==g.steps){
          if(def.type==='program')callbacks.chooseRoutePreset(Math.max(0,Math.min(IsoFlow.routerPrograms(frame.editState||frame.state).length-1,g.program+steps)));
          else change(steps-g.steps);
          g.steps=steps;
        }
      };
      const finish=(event,cancelled)=>{
        const g=pointer;if(!g||event.pointerId!==g.id)return;
        pointer=null;released=performance.now();
        if(element.hasPointerCapture(event.pointerId))element.releasePointerCapture(event.pointerId);
        if(!cancelled&&!g.moved&&def.type==='program')callbacks.chooseRoutePreset(def.i);
      };
      element.onpointerup=event=>finish(event,false);
      element.onpointercancel=event=>finish(event,true);
      element.onlostpointercapture=event=>finish(event,true);
      element.onclick=event=>{if(!event.pointerType&&event.detail===0&&performance.now()-released>350){if(def.type==='program')callbacks.chooseRoutePreset(def.i);else change(1);}};
      element.onkeydown=event=>{
        if(!['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(event.key))return;
        event.preventDefault();change(event.key==='ArrowUp'||event.key==='ArrowRight'?1:-1);
      };
    }
    function rebuild(id){
      if(active&&faces.has(active))faces.get(active).shell.visible=false;
      active=id;root.dataset.part=id||'';root.hidden=!id;root.replaceChildren();controls=[];state=null;pose=null;graphic=null;
      lastScoreTime=lastScorePhase=undefined;
      if(!id)return;
      const layout=layoutFor(id);
      if(flat&&id==='router')graphic=flatCam(root);
      if(flat&&id==='source')graphic=flatScore(root);
      if(flat&&id==='delay')graphic=flatVessels(root);
      let face=faces.get(id);
      if(!flat&&!face){
        face=IsoPieces.serviceFace(id,pieces[id].group);faces.set(id,face);
        for(const d of layout)if(d.type==='pin')face.key(d.key,d.x,d.y,d.z,d.w,d.d,true);
      }
      if(face)face.shell.visible=true;
      for(const d of layout){
        const e=document.createElement('button');e.type='button';
        e.className='iso-face-control face-'+d.type;e.dataset.faceKey=d.key;
        const mark=document.createElement('i');mark.setAttribute('aria-hidden','true');e.append(mark);
        (flat&&['pin','phase','level'].includes(d.type)?graphic.well:root).append(e);
        if(d.type==='brush'&&d.pitch===null)mark.append(symbol('erase'));
        if(['program','phase','level'].includes(d.type))bindDrag(e,d);
        else{
          const perform=()=>{
            if(d.type==='pin'&&frame.paintPitch!==undefined){
              const tones=IsoFlow.pitches(frame.editState.source.notes[d.i]);
              if(frame.paintPitch===null?tones.length:!tones.includes(frame.paintPitch))pour(e,frame.paintPitch);
            }
            activate(d,frame,callbacks);
          };
          if(d.type==='pin')sectorTap(e,perform);else e.onclick=perform;
        }
        controls.push({d,e,mark,color:null});
      }
    }
    function render(next,id){
      frame=next;
      const programCount=id==='router'?IsoFlow.routerPrograms(frame.editState||frame.state).length:0;
      if(active!==id||(id==='router'&&programCount!==controls.length))rebuild(id);
      if(!id||!controls.length)return;
      const s=frame.editState||frame.state,cur=frame.playing?frame.tick.step:-1;
      const changed=state!==s||step!==cur||paintPitch!==frame.paintPitch;
      state=s;step=cur;paintPitch=frame.paintPitch;
      if(changed&&id==='source'){
        root.toggleAttribute('data-brush',paintPitch!==undefined);
        root.style.setProperty('--brush-tone',paintPitch==null?idle:IsoPieces.noteColor(paintPitch));
      }
      let moved=false;
      if(!flat){
        const a=projectLocal(id,0,0,0),b=projectLocal(id,1,0,1);
        moved=!pose||pose[0]!==a.x||pose[1]!==a.y||pose[2]!==b.x||pose[3]!==b.y;
        if(moved)pose=[a.x,a.y,b.x,b.y];
      }
      const scoreMoves=id==='source'&&(lastScoreTime!==frame.time||lastScorePhase!==frame.state.source.phase);
      if(scoreMoves){lastScoreTime=frame.time;lastScorePhase=frame.state.source.phase;}
      if(flat){
        graphic.update(frame);
        if(id==='delay'||id==='router')controls.forEach(({d,e})=>graphic.place(e,d));
      }
      if(!changed&&!moved&&!scoreMoves)return;
      const face=faces.get(id);
      for(const item of controls){
        const {d,e}=item;
        if(changed){
          const result=controlData(d,state,frame);
          attr(e,'aria-label',result.label);
          if(result.pressed!==undefined)attr(e,'aria-pressed',result.pressed);
          rgbaChoice(e,'chosen',result.chosen);rgbaChoice(e,'live',result.live);rgbaChoice(e,'rest',result.rest);
          if(result.tones){
            const signature=result.tones.join(',');
            if(item.fluid!==signature){
              item.fluid=signature;e.dataset.tones=signature;
              e.style.setProperty('--liquid',fluidFill(result.tones.map(IsoPieces.noteColor)));
              if(d.type==='pin')face?.capFluid(d.key,result.tones);
            }
          }
          if(result.color&&item.color!==result.color){e.style.setProperty('--cap-tone',result.color);item.color=result.color;}
        }
        if(flat){if(id==='source'&&['pin','phase','level'].includes(d.type))graphic.place(e,d,frame);continue;}
        let {x,y,z}=d;
        if(d.type==='pin')({x,y,z}=IsoPieces.scorePin(frame,d.i));
        if(d.type==='program')({x,y,z}=IsoPieces.routerRow(pieces.router.group,d.i));
        if(d.type==='level')({x,y,z}=IsoPieces.sourceLevel(pieces.source.group));
        if(d.type==='phase'){
          const c=IsoPieces.sourcePhase(pieces.source.group),a=(d.i+.5)*Math.PI/2;
          x=c.x+Math.sin(a)*c.radius;y=c.y;z=c.z+Math.cos(a)*c.radius;
        }
        const center=projectLocal(id,x,y,z),right=projectLocal(id,x+d.w,y,z),front=projectLocal(id,x,y,z+d.d);
        let w=Math.max(44,Math.hypot(right.x-center.x,right.y-center.y)),h=Math.max(44,Math.abs(front.y-center.y));
        if(d.type==='program'){
          const up=projectLocal(id,x,y+.30,z);
          h=Math.min(44,Math.max(22,Math.hypot(up.x-center.x,up.y-center.y)));
        }
        e.style.left=center.x+'px';e.style.top=center.y+'px';e.style.width=w+'px';e.style.height=h+'px';
        e.style.setProperty('--face-size',Math.max(12,Math.min(25,w*.41))+'px');
      }
    }
    return {render,focusBounds:id=>bounds[id],dispose(){if(active&&faces.has(active))faces.get(active).shell.visible=false;root.remove();}};
  }
  return {mount:opts=>makeView(opts,false),mountFlat:opts=>makeView(opts,true)};
})();
