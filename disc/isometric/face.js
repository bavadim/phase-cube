/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoFace=(()=>{
  'use strict';
  const bounds={
    router:[[-1.38,-.04,-1.08],[1.42,1.00,1.09]],
    source:[[-1.88,-.04,-2.23],[1.79,1.53,2.29]],
    delay:[[-1.18,-.04,-1.08],[1.20,1.0,1.13]],
    copy:[[-1.03,-.04,-1.08],[1.06,1.13,1.10]],
    keys:[[-1.47,-.08,-.93],[1.47,1.05,2.02]],
    bell:[[-1.47,-.07,-.92],[1.47,1.48,2.02]],
    bin:[[-1.47,-.08,-.84],[1.47,1.20,2.02]]
  };
  const idle='#e5e4d2', ivory='#fff0ce', green='#92d2b7', amber='#f6ba88';
  const row=(type,key,x,y,z,w,d,extra={})=>({type,key,x,y,z,w,d,...extra});
  const outlet=(id,port)=>row('port','port-'+id+':'+port,0,0,0,.56,.46,{port,id});
  const paintTools=[...IsoFlow.PALETTE.filter(pitch=>pitch!==null),null];
  const primer=(id,x,y,z)=>row('primer','test-'+id,x,y,z,.39,.40,{id});
  const layouts={
    router:[
      ...Array.from({length:8},(_,i)=>row('step','step-'+i,0,.745,0,.49,.49,{i})),
      row('lever','lever',.75,.735,.283,.38,.41),
      outlet('router','straight'),outlet('router','side')
    ],
    source:[
      ...paintTools.map((pitch,i)=>row('brush','brush-'+(pitch??'rest'),-1.20+.80*i,1.08,-1.88,.59,.55,{pitch})),
      ...Array.from({length:8},(_,i)=>{const a=-i*Math.PI/4;
        return row('pin','pin-'+i,.55+.95*Math.sin(a),1.241,.13+.95*Math.cos(a),.43,.43,{i});
      }),
      ...['phase','level'].flatMap((control,i)=>[-1,1].map((sign,j)=>
        row('rocker',control+(sign<0?'-down':'-up'),-1.09+1.39*i+(j-.5)*.62,.51,1.79,.54,.50,{control,sign}))),
      row('reading','phase-value',-1.09,.43,1.39,1.16,.28,{control:'phase'}),
      row('reading','level-value',.30,.43,1.39,1.16,.28,{control:'level'}),
      outlet('source','out')
    ],
    delay:[primer('delay',-.72,.65,-.57),row('slot','delay-0',-.84,.50,.32,.35,.45,{i:0}),
      ...Array.from({length:4},(_,n)=>row('slot','delay-'+(n+1),-.50+n*.44,.53,.20,.38,.48,{i:n+1})),outlet('delay','out')],
    copy:[primer('copy',0,.72,-.56),outlet('copy','out'),outlet('copy','copy')],
    ...Object.fromEntries(['keys','bell','bin'].map(id=>[id,Array.from({length:8},(_,i)=>
      row('event','arrival-'+i,(i%4-1.5)*.64,.50,1.12+Math.floor(i/4)*.46,.59,.42,{id,i}))]))
  };
  const capTypes=new Set(['pin','rocker','event']);
  const paths={
    phaseUp:'M5 17a7 7 0 1 1 13-7l2-4m-2 4-4-1',
    phaseDown:'M19 17a7 7 0 1 0-13-7L4 6m2 4 4-1',
    louder:'M2 9h4l5-4v14l-5-4H2z M14 8q5 4 0 8m3-11q8 7 0 14',
    softer:'M3 9h4l5-4v14l-5-4H3z M15 9q4 3 0 6',
    gate:'M4 12h16m-12-4-4 4 4 4m8-8 4 4-4 4',
    port:'M8 3h8v5H8zm-2 5h12v5H6zm3 5v3a5 5 0 0 0 5 5h4',
    prime:'M12 2S5 10.4 5 15a7 7 0 0 0 14 0c0-4.6-7-13-7-13zm-4 13a4 4 0 0 0 4 4',
    erase:'m3 14 9-10 8 7-9 10H8Zm5-5 8 7',
  };
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
    const {names,ports,pitchName}=window.IsoWorkshopLabels;
    const chosen=frame.previewStep??0, playStep=frame.playing?frame.tick.step:-1;
    const {type,i,sign,control,port,id}=def;
    if(type==='step'){
      const direct=s.routes[i], recipient=names[s.links['router:'+(direct?'straight':'side')]]||'Свободно';
      const tones=IsoFlow.tones(frame.steps?.[i]?.activity.router||[]);
      return {chosen:chosen===i,live:playStep===i,
        color:direct?green:amber,tones,rest:!tones.length,pressed:chosen===i,
        label:'Шаг '+(i+1)+', '+(tones.map(pitchName).join(', ')||'пауза')+', '+recipient+(chosen===i&&frame.picked?'. Переключить задвижку':'. Показать путь')};
    }
    if(type==='primer')return {disabled:frame.playing,label:'Подать пробную порцию в '+(id==='copy'?'двойной дозатор':'линию задержки')};
    if(type==='lever')return {way:s.routes[chosen]?'straight':'side',label:'Переключить задвижку для шага '+(chosen+1)};
    if(type==='brush'){
      const pitch=def.pitch,chosen=frame.paintPitch===pitch;
      return {chosen,pressed:chosen,color:pitch===null?idle:IsoPieces.noteColor(pitch),
        label:pitch===null?'Пауза. Убрать ноту со штифта':pitchName(pitch)+'. Выбрать и послушать ноту'};
    }
    if(type==='pin'){
      const tones=IsoFlow.pitches(s.source.notes[i]), name=tones.map(pitchName).join(', ')||'пауза';
      const brush=frame.paintPitch;
      return {live:playStep>=0&&(playStep-s.source.phase+8)%8===i,rest:!tones.length,tones,
        color:tones.length?IsoPieces.noteColor(tones[0]):idle,label:'Штифт '+(i+1)+', '+name+'. '+(brush===undefined?'Сменить ноту':brush===null?'Слить жидкость':'Добавить '+pitchName(brush))};
    }
    if(type==='reading'){
      const name=control==='phase'?'Сдвиг':'Громкость', value=control==='phase'?s.source.phase+'/8':Math.round(s.source.level*100)+'%';
      return {units:control==='phase'?s.source.phase:s.source.level*4,label:name+' '+value};
    }
    if(type==='rocker'){
      const isLevel=control==='level';
      return {label:(isLevel?'Громкость':'Сдвиг')+(sign===1?' больше':' меньше'),
        color:ivory,disabled:isLevel&&(sign>0?s.source.level>=2:s.source.level<=0)};
    }
    if(type==='slot')return {chosen:s.delay===i,pressed:s.delay===i,
      label:'Задержка: '+i+' восьмых',color:s.delay===i?'#bda4cb':ivory};
    if(type==='event'){
      const hits=frame.steps?.[i]?.hits[id]||[];
      const tones=IsoFlow.tones(hits),notes=tones.map(pitchName).join(', ')||'пауза';
      return {label:'Шаг '+(i+1)+': '+notes,
        color:tones.length?IsoPieces.noteColor(tones[0]):'#c0bfae',tones,units:hits.length,live:playStep===i};
    }
    if(type==='port'){
      const connected=names[s.links[id+':'+port]]||'Свободно';
      const pointed=id==='router'&&(s.routes[chosen]?port==='straight':port==='side');
      return {chosen:pointed,way:port,
        label:ports[port]+' → '+connected+'. Подключить или снять шланг'};
    }
  }
  function activate(def,frame,cb) {
    const state=frame.editState||frame.state;
    switch(def.type){
      case 'primer':return cb.testDose(def.id);
      case 'brush':return cb.choosePitch(def.pitch);
      case 'step':return cb.touchCam(def.i);
      case 'lever':return cb.flipRoute();
      case 'pin': return cb.act({type:'note',index:def.i});
      case 'rocker':return cb.act({type:def.control,delta:def.sign*(def.control==='level'?.25:1)});
      case 'slot':
        if(cb.act({type:'delay',delta:def.i-state.delay})&&!frame.playing)cb.testDose('delay');
        return;
      case 'port':return cb.startPatch(def.id+':'+def.port);
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
  // A mechanical face for devices without WebGL. Its lobes and drawbar
  // use the very same profile and drive as the Three.js assembly.
  function flatCam(root,touch) {
    const c=IsoPieces.CAM,drive=IsoPieces.createCamDrive(),ns='http://www.w3.org/2000/svg';
    const svg=(name,parent,attrs={})=>{
      const e=document.createElementNS(ns,name);
      for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);
      parent.append(e);return e;
    };
    const minX=-1.17,minY=-1.28,w=2.95,h=2.55;
    const scene=svg('svg',root,{class:'flat-cam',viewBox:[minX,minY,w,h].join(' '),preserveAspectRatio:'none','aria-hidden':'true'});
    const path=(p,d,attrs)=>svg('path',p,{d,...attrs});
    const line=(p,d,color,width)=>path(p,d,{fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round'});
    const dot=(p,x,y,r,fill)=>svg('circle',p,{cx:x,cy:y,r,fill});
    const pinRadius=.67,low=c.low+.31,high=c.high+.31;
    line(scene,'M -1.09 -1.22 V .43 L -.70 .84 H .61 L .78 .66 H '+high,'#baa06a',.10);
    line(scene,'M '+high+' .66 H 1.57 V 1.04','#287e6d',.12);
    line(scene,'M '+low+' .66 V 1.04 H .55','#bf653b',.12);
    line(scene,'M .77 .53 H 1.65 M .77 .78 H 1.65','#908f7b',.046);
    dot(scene,low,.66,.137,'#bd714a');dot(scene,high,.66,.137,'#398b77');
    const wheel=svg('g',scene),teeth=[],stones=[];
    for(let i=0;i<8;i++){
      const arm=svg('g',wheel,{class:'flat-wheel-sector',transform:'rotate('+i*45+')'});
      sectorTap(arm,()=>touch(i));
      teeth.push(path(arm,'',{stroke:'#40514b','stroke-width':.009,'stroke-linejoin':'round'}));
      dot(arm,pinRadius,0,.083,'#384640');
      stones.push(dot(arm,pinRadius,0,.057,'#eec58a'));
    }
    dot(wheel,0,0,.30,'#394c44');dot(wheel,0,0,.215,'#c4a55f');
    dot(wheel,0,0,.119,'#498b77');dot(wheel,.26,0,.034,'#f5e6ad');
    const arm=svg('g',scene);
    // The aperture slides over one coloured conduit while the other is covered.
    path(arm,'M -.16 .51 H .57 V .82 H -.16 Z M .21 .55 a .11 .11 0 1 0 0 .22 a .11 .11 0 1 0 0 -.22 Z',
      {fill:'#a5b6a8',stroke:'#516964','stroke-width':.024,'fill-rule':'evenodd'});
    line(arm,'M 0 0 L .21 .23 V .50','#be9e5a',.061);
    dot(arm,0,0,.097,'#39483e');dot(arm,0,0,.047,'#edc676');
    const grip=dot(arm,.21,.36,.108,'#287e6d');
    let lastRoutes,lastSteps,lastAngle;
    const place=(e,x,y)=>{e.style.left=(100*(x-minX)/w)+'%';e.style.top=(100*(y-minY)/h)+'%';};
    return {
      update(frame){
        const s=frame.playing?frame.state:frame.editState||frame.state;
        const route=s.routes,pose=drive.update(frame,route);
        if(lastRoutes!==route){
          for(let i=0;i<8;i++){
            const p=teeth[i],points=[];
            for(let j=0;j<=16;j++){
              const u=-.495+.99*j/16,a=u*c.pitch,r=IsoPieces.camRadius(u,route[(i+7)%8],route[i],route[(i+1)%8]);
              points.push([Math.cos(a)*r,Math.sin(a)*r].join(' '));
            }
            p.setAttribute('d','M 0 0 L '+points.join(' L ')+' Z');
            p.setAttribute('fill',route[i]?'#63b5a2':'#e29b62');
          }
          lastRoutes=route;
        }
        if(lastSteps!==frame.steps){
          stones.forEach((e,i)=>{
            const n=frame.steps?.[i]?.activity.router[0];
            e.setAttribute('fill',n?IsoPieces.noteColor(n.pitch):'transparent');
          });lastSteps=frame.steps;
        }
        if(lastAngle!==pose.angle)wheel.setAttribute('transform','rotate('+(-pose.angle*180/Math.PI)+')');
        arm.setAttribute('transform','translate('+(pose.radius+.10)+' 0)');
        grip.setAttribute('fill',route[pose.reader]?'#287e6d':'#bf653b');
        lastAngle=pose.angle;return pose;
      },
      place(e,def,pose){
        if(def.type==='step'){
          const a=def.i*c.pitch-pose.angle;
          place(e,Math.cos(a)*pinRadius,Math.sin(a)*pinRadius);
        }else if(def.type==='lever')place(e,pose.radius+.31,.36);
        else if(def.type==='port')def.port==='straight'?place(e,1.57,1.04):place(e,.55,1.04);
      }
    };
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
      place(e,d,frame){const p=IsoPieces.scorePin(frame,d.i);
        e.style.left=(50+(p.x-.55)*100/2.6)+'%';e.style.top=(50+(p.z-.13)*100/2.6)+'%';}};
  }
  // The fallback has the same two fluid paths as the cast models. Glass shows
  // separate bands for the pitches in a dose, including after the source changes.
  function flatVessels(root,id){
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
    const guide=(linePath)=>line(linePath,'#233e36',2);
    let update;
    if(id==='copy'){
      pipe('M160 4V65 Q160 76 145 76H98V105');pipe('M160 63Q160 76 175 76H222V105');
      for(const x of [98,222])pipe('M'+x+' 158 V219');
      const wells=[98,222].map(x=>well(x-25,99,50,69));
      addPort('copy',98,218);addPort('out',222,218);
      const piston=create('g',{},diagram);
      for(const x of [98,222]){
        line('M'+x+' 65 V120','#415f58',8,piston);
        box(x-20,113,40,7,2,'#749e91','#35594f',2,piston);
      }
      box(86,57,148,11,5,'#719383','#476359',2,piston);
      box(136,41,48,17,8,'#4b796c','#365d55',2,piston);
      coords['test-copy']=[160,50];
      for(const x of [98,222])guide('M'+(x-5)+' 183 l5 6 5-6');
      update=(state,tick,phase)=>{
        const hits=tick?.activity.copy||[];
        const stroke=hits.length?Math.sin(Math.PI*phase):0;
        piston.setAttribute('transform','translate(0 '+(stroke*20)+')');
        for(const tank of wells)tank.fill(hits,phase<.4?.22+phase*1.5:1-phase);
      };
    }else{
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
      coords['test-delay']=[31,43];coords['delay-0']=[31,136];
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
    }
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
    let graphic=null,active=null, controls=[], frame=null, state=null, previewStep=-1,step=-2,pose=null,paintPitch;
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
    function rebuild(id){
      if(active&&faces.has(active))faces.get(active).shell.visible=false;
      active=id;root.dataset.part=id||'';root.hidden=!id;root.replaceChildren();controls=[];state=null;pose=null;graphic=null;
      lastScoreTime=lastScorePhase=undefined;
      if(!id)return;
      const layout=layouts[id]||[];
      if(flat&&id==='router')graphic=flatCam(root,callbacks.touchCam);
      if(flat&&id==='source')graphic=flatScore(root);
      if(flat&&(id==='copy'||id==='delay'))graphic=flatVessels(root,id);
      let face=faces.get(id);
      if(!flat&&!face){
        face=IsoPieces.serviceFace(id,pieces[id].group);faces.set(id,face);
        for(const d of layout)if(capTypes.has(d.type))face.key(d.key,d.x,d.y,d.z,d.w,d.d,d.type==='pin');
      }
      if(face)face.shell.visible=true;
      for(const d of layout){
        const e=document.createElement(['reading','event'].includes(d.type)?'span':'button');
        e.className='iso-face-control face-'+d.type;e.dataset.faceKey=d.key;
        const mark=document.createElement('i');mark.setAttribute('aria-hidden','true');e.append(mark);
        (flat&&d.type==='pin'?graphic.well:root).append(e);
        if(d.type==='brush'){
          if(d.pitch===null)mark.append(symbol('erase'));
          else for(let j=0;j<=paintTools.indexOf(d.pitch);j++)mark.append(document.createElement('b'));
        }
        if(d.type==='rocker')mark.append(symbol(d.control==='phase'?(d.sign>0?'phaseUp':'phaseDown'):(d.sign>0?'louder':'softer')));
        if(d.type==='port')mark.append(symbol('port'));
        if(d.type==='lever')mark.append(symbol('gate'));
        if(d.type==='primer')mark.append(symbol('prime'));
        if(d.type==='slot'||d.type==='reading'){
          const count=d.type==='slot'?d.i:8;
          for(let j=0;j<count;j++)mark.append(document.createElement('b'));
          if(!count)mark.className='zero';
        }
        if(e.tagName==='BUTTON'){
          e.type='button';
          const perform=()=>{
            if(d.type==='pin'&&frame.paintPitch!==undefined){
              const tones=IsoFlow.pitches(frame.editState.source.notes[d.i]);
              if(frame.paintPitch===null?tones.length:!tones.includes(frame.paintPitch))pour(e,frame.paintPitch);
            }
            activate(d,frame,callbacks);
          };
          // A moving tooth or pin keeps its identity from pointer-down to release.
          if(d.type==='step'||d.type==='pin')sectorTap(e,perform);
          else e.onclick=perform;
        }
        controls.push({d,e,mark,color:null});
      }

    }
    function render(next,id){
      frame=next;
      if(active!==id)rebuild(id);
      if(!id||!controls.length)return;
      const s=frame.editState||frame.state, cur=frame.playing?frame.tick.step:-1;
      const changed=state!==s||previewStep!==frame.previewStep||step!==cur||paintPitch!==frame.paintPitch;
      state=s;previewStep=frame.previewStep;step=cur;paintPitch=frame.paintPitch;
      if(changed&&id==='source'){
        root.toggleAttribute('data-brush',paintPitch!==undefined);
        root.style.setProperty('--brush-tone',paintPitch==null?idle:IsoPieces.noteColor(paintPitch));
      }
      // Orthographic projection is affine. Fixed face keys only need CSS
      // positions when framing changes; playback updates their ink and lamps.
      let moved=false;
      if(!flat){
        const a=projectLocal(id,0,0,0),b=projectLocal(id,1,0,1);
        moved=!pose||pose[0]!==a.x||pose[1]!==a.y||pose[2]!==b.x||pose[3]!==b.y;
        if(moved)pose=[a.x,a.y,b.x,b.y];
      }
      const camView=id!=='router'?null:flat?graphic.update(frame):IsoPieces.camPose(pieces[id].group);
      const scoreMoves=id==='source'&&(lastScoreTime!==frame.time||lastScorePhase!==frame.state.source.phase);
      if(scoreMoves){lastScoreTime=frame.time;lastScorePhase=frame.state.source.phase;}
      if(flat&&(id==='copy'||id==='delay')){
        graphic.update(frame);
        if(changed)controls.forEach(({d,e})=>graphic.place(e,d));
      }
      if(flat&&scoreMoves)graphic.update(frame);
      if(!changed&&!moved&&!camView&&!scoreMoves)return;
      const face=faces.get(id);
      for(const item of controls){
        const {d,e,mark}=item;
        const cam=d.type==='step'||d.type==='lever'?camView:null;
        if(changed){
          const result=controlData(d,state,frame);
          if(d.type==='reading')Array.from(mark.children).forEach((lamp,i)=>lamp.classList.toggle('lit',i<result.units));
          if(d.type==='event')e.dataset.sound=String(result.units>0);
          attr(e,'aria-label',result.label);
          if(result.pressed!==undefined)attr(e,'aria-pressed',result.pressed);
          if(e.tagName==='BUTTON')e.disabled=!!result.disabled;
          rgbaChoice(e,'chosen',result.chosen);rgbaChoice(e,'live',result.live);rgbaChoice(e,'rest',result.rest);
          if(result.way)e.dataset.way=result.way;
          if(result.tones){
            const signature=result.tones.join(',');
            if(item.fluid!==signature){
              item.fluid=signature;e.dataset.tones=signature;
              const colors=result.tones.map(IsoPieces.noteColor);
              e.style.setProperty('--liquid',fluidFill(colors));
              if(d.type==='event'||d.type==='pin')face?.capFluid(d.key,result.tones);
            }
          }
          if(result.color&&item.color!==result.color){
            if(!result.tones)face?.capColor(d.key,result.color);
            e.style.setProperty('--cap-tone',result.color);item.color=result.color;
          }
        }
        if(d.type==='step')rgbaChoice(e,'atReader',cam.reader===d.i);
        if(flat&&camView)graphic.place(e,d,camView);
        const scorePin=d.type==='pin';
        if(flat&&scorePin&&scoreMoves)graphic.place(e,d,frame);
        if(flat||(!moved&&!cam&&!(scoreMoves&&scorePin)))continue;
        let {x,y,z}=d;
        if(scorePin)({x,y,z}=IsoPieces.scorePin(frame,d.i));
        if(d.type==='port'){
          const p=pieces[id].ports[d.port];x=p.x;y=p.y+.09;z=p.z;
        }
        if(d.type==='step'){
          const c=IsoPieces.CAM,a=d.i*c.pitch-cam.angle;
          const radius=.651;
          x=c.scale*(c.x+Math.cos(a)*radius);z=c.scale*(c.z+Math.sin(a)*radius);
        }
        if(d.type==='lever')x=IsoPieces.CAM.scale*cam.gateX;
        const center=projectLocal(id,x,y,z),right=projectLocal(id,x+d.w,y,z),front=projectLocal(id,x,y,z+d.d);
        const w=Math.max(1,Math.hypot(right.x-center.x,right.y-center.y)),h=Math.max(1,Math.abs(front.y-center.y));
        const targetW=d.type==='event'?w:d.type==='port'?44:Math.max(44,w);
        const targetH=d.type==='event'?h:d.type==='reading'?Math.max(16,h):Math.max(44,h);
        e.style.left=center.x+'px';e.style.top=center.y+'px';e.style.width=targetW+'px';e.style.height=targetH+'px';
        e.style.setProperty('--face-size',Math.max(12,Math.min(25,w*(d.type==='pin'?.41:.29)))+'px');
      }
    }
    return {render,focusBounds:id=>bounds[id],dispose(){if(active&&faces.has(active))faces.get(active).shell.visible=false;root.remove();}};
  }
  return {mount:opts=>makeView(opts,false),mountFlat:opts=>makeView(opts,true)};
})();
