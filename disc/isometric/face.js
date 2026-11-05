/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoFace=(()=>{
  'use strict';
  const bounds={
    router:[[-1.62,-.04,-2.79],[1.91,.84,1.54]],
    source:[[-1.74,-.04,-1.36],[2.12,1.53,2.29]],
    delay:[[-1.54,-.04,-.96],[1.63,1.14,1.75]],
    copy:[[-1.17,-.05,-.88],[1.60,1.52,1.40]],
    keys:[[-1.47,-.08,-.93],[1.47,1.05,2.02]],
    bell:[[-1.47,-.07,-.92],[1.47,1.48,2.02]],
    bin:[[-1.47,-.08,-.84],[1.47,1.20,2.02]]
  };
  const idle='#e5e4d2', ivory='#fff0ce', green='#92d2b7', amber='#f6ba88';
  const row=(type,key,x,y,z,w,d,extra={})=>({type,key,x,y,z,w,d,...extra});
  const outlet=(id,port,x,y,z)=>row('port','port-'+id+':'+port,x,y,z,.9,.46,{port,id});
  const layouts={
    router:[
      ...Array.from({length:8},(_,i)=>row('step','step-'+i,(i%4-1.5)*.736,.517,Math.floor(i/4)*.79-2.242,.674,.693,{i})),
      row('lever','lever',-.12,.64,-.175,.90,.56),
      outlet('router','straight',1.19,.50,.42),outlet('router','side',.13,.45,1.29)
    ],
    source:[
      ...Array.from({length:8},(_,i)=>{const a=-i*Math.PI/4;
        return row('pin','pin-'+i,.55+.95*Math.sin(a),1.241,.13+.95*Math.cos(a),.43,.43,{i});
      }),
      ...['phase','level'].flatMap((control,i)=>[-1,1].map((sign,j)=>
        row('rocker',control+(sign<0?'-down':'-up'),-.81+1.62*i+(j-.5)*.72,.51,1.79,.63,.50,{control,sign}))),
      row('reading','phase-value',-.81,.43,1.39,1.32,.28,{control:'phase'}),
      row('reading','level-value',.81,.43,1.39,1.32,.28,{control:'level'}),
      outlet('source','out',1.59,.395,.78)
    ],
    delay:[...Array.from({length:5},(_,i)=>row('slot','delay-'+i,(i-2)*.55,.53,1.18,.48,.64,{i})),outlet('delay','out',1.11,.46,.18)],
    copy:[outlet('copy','out',1.04,.49,.14),outlet('copy','copy',.25,.47,1.15)],
    ...Object.fromEntries(['keys','bell','bin'].map(id=>[id,Array.from({length:8},(_,i)=>
      row('event','arrival-'+i,(i%4-1.5)*.64,.50,1.12+Math.floor(i/4)*.46,.59,.42,{id,i}))]))
  };
  const capTypes=new Set(['pin','rocker','slot','step','event']);
  function setText(e,t){if(e.textContent!==t)e.textContent=t;}
  function attr(e,k,v){if(e.getAttribute(k)!==String(v))e.setAttribute(k,String(v));}
  function rgbaChoice(e,name,value){if(value)e.dataset[name]='true';else delete e.dataset[name];}
  function controlData(def,s,frame){
    const {names,ports,pitchName}=window.IsoWorkshopLabels;
    const chosen=frame.previewStep??0, playStep=frame.playing?frame.tick.step:-1;
    const {type,i,sign,control,port,id}=def;
    if(type==='step'){
      const direct=s.routes[i], recipient=names[s.links['router:'+(direct?'straight':'side')]]||'Свободно';
      const hits=frame.steps?.[i]?.activity?.router||[], name=hits.length?pitchName(hits[0].pitch):'—';
      return {top:String(i+1),main:name,mark:direct?'→':'↳',chosen:chosen===i,live:playStep===i,
        color:direct?green:amber,rest:!hits.length,pressed:chosen===i,
        label:'Шаг '+(i+1)+', '+(hits.length?name:'пауза')+', '+recipient+'. Показать путь'};
    }
    if(type==='lever')return {main:'Сменить путь',label:'Перевести стрелку для шага '+(chosen+1)};
    if(type==='pin'){
      const pitch=s.source.notes[i], name=pitch==null?'—':pitchName(pitch);
      return {top:String(i+1),main:name,live:playStep>=0&&(playStep-s.source.phase+8)%8===i,
        color:pitch==null?idle:IsoPieces.noteColor(pitch),label:'Штифт '+(i+1)+', '+(pitch==null?'пауза':name)+'. Сменить ноту'};
    }
    if(type==='reading'){
      const name=control==='phase'?'Сдвиг':'Громкость', value=control==='phase'?s.source.phase+'/8':Math.round(s.source.level*100)+'%';
      return {main:name+' '+value,label:name+' '+value};
    }
    if(type==='rocker'){
      const isLevel=control==='level';
      return {main:sign===1?'+':'−',label:(isLevel?'Громкость':'Сдвиг')+(sign===1?' больше':' меньше'),
        color:ivory,disabled:isLevel&&(sign>0?s.source.level>=2:s.source.level<=0)};
    }
    if(type==='slot')return {main:String(i),chosen:s.delay===i,pressed:s.delay===i,
      label:'Задержка: '+i+' восьмых',color:s.delay===i?'#bda4cb':ivory};
    if(type==='event'){
      const hits=frame.steps?.[i]?.hits[id]||[];
      const pitches=hits.map(h=>pitchName(h.pitch)),list=[...new Set(pitches)];
      const main=list.map(p=>pitches.filter(v=>v===p).length>1?p+'×'+pitches.filter(v=>v===p).length:p).join('·')||'—';
      return {top:String(i+1),main,label:'Шаг '+(i+1)+': '+(main==='—'?'пауза':main),
        color:hits.length?'#e7dbb3':'#b5beb0',live:playStep===i};
    }
    if(type==='port'){
      const connected=names[s.links[id+':'+port]]||'Свободно';
      const pointed=id==='router'&&(s.routes[chosen]?port==='straight':port==='side');
      return {main:connected,mark:port==='side'||port==='copy'?'↳':'→',chosen:pointed,way:port,
        label:ports[port]+' → '+connected+'. Переподключить ленту'};
    }
  }
  function activate(def,frame,cb) {
    const state=frame.editState||frame.state;
    switch(def.type){
      case 'step': return cb.pickStep(def.i);
      case 'lever':return cb.flipRoute();
      case 'pin': return cb.act({type:'note',index:def.i});
      case 'rocker':return cb.act({type:def.control,delta:def.sign*(def.control==='level'?.25:1)});
      case 'slot':return cb.act({type:'delay',delta:def.i-state.delay});
      case 'port':return cb.startPatch(def.id+':'+def.port);
    }
  }
  function makeView({overlay,pieces,projectLocal,callbacks},flat){
    const root=document.createElement('div');root.dataset.face='';
    root.className='iso-face'+(flat?' is-flat':'');overlay.append(root);
    const faces=new Map();
    let active=null, controls=[], frame=null, state=null, previewStep=-1,step=-2,pose=null;
    function rebuild(id){
      if(active&&faces.has(active))faces.get(active).shell.visible=false;
      active=id;root.hidden=!id;root.replaceChildren();controls=[];state=null;pose=null;
      if(!id)return;
      const layout=layouts[id]||[];
      let face=faces.get(id);
      if(!flat&&!face){
        face=IsoPieces.serviceFace(id,pieces[id].group);faces.set(id,face);
        for(const d of layout)if(capTypes.has(d.type))face.key(d.key,d.x,d.y,d.z,d.w,d.d,d.type==='pin');
      }
      if(face)face.shell.visible=true;
      for(const d of layout){
        const e=document.createElement(['reading','event'].includes(d.type)?'span':'button');
        e.className='iso-face-control face-'+d.type;e.dataset.faceKey=d.key;
        const top=document.createElement('small'),main=document.createElement('strong'),mark=document.createElement('i');
        e.append(top,main,mark);root.append(e);
        if(e.tagName==='BUTTON'){
          e.type='button';e.onclick=()=>activate(d,frame,callbacks);
        }
        controls.push({d,e,top,main,mark,color:null});
      }

    }
    function render(next,id){
      frame=next;
      if(active!==id)rebuild(id);
      if(!id||!controls.length)return;
      const s=frame.editState||frame.state, cur=frame.playing?frame.tick.step:-1;
      const changed=state!==s||previewStep!==frame.previewStep||step!==cur;
      state=s;previewStep=frame.previewStep;step=cur;
      // Orthographic projection is affine. Fixed face keys only need CSS
      // positions when framing changes; playback updates their ink and lamps.
      let moved=false;
      if(!flat){
        const a=projectLocal(id,0,0,0),b=projectLocal(id,1,0,1);
        moved=!pose||pose[0]!==a.x||pose[1]!==a.y||pose[2]!==b.x||pose[3]!==b.y;
        if(moved)pose=[a.x,a.y,b.x,b.y];
      }
      if(!changed&&!moved)return;
      const face=faces.get(id);
      for(const item of controls){
        const {d,e,top,main,mark}=item;
        if(changed){
          const result=controlData(d,state,frame);
          setText(top,result.top||'');setText(main,result.main);setText(mark,result.mark||'');
          attr(e,'aria-label',result.label);
          if(result.pressed!==undefined)attr(e,'aria-pressed',result.pressed);
          if(e.tagName==='BUTTON')e.disabled=!!result.disabled;
          rgbaChoice(e,'chosen',result.chosen);rgbaChoice(e,'live',result.live);rgbaChoice(e,'rest',result.rest);
          if(result.way)e.dataset.way=result.way;
          if(result.color&&item.color!==result.color){
            face?.capColor(d.key,result.color);e.style.setProperty('--cap-tone',result.color);item.color=result.color;
          }
        }
        if(!moved)continue;
        const center=projectLocal(id,d.x,d.y,d.z),right=projectLocal(id,d.x+d.w,d.y,d.z),front=projectLocal(id,d.x,d.y,d.z+d.d);
        const w=Math.max(1,Math.hypot(right.x-center.x,right.y-center.y)),h=Math.max(1,Math.abs(front.y-center.y));
        const targetW=d.type==='event'?w:d.type==='port'?Math.min(122,Math.max(60,w)):Math.max(d.type==='pin'?42:44,w);
        const targetH=d.type==='event'?h:d.type==='reading'?Math.max(16,h):Math.max(44,h);
        e.style.left=center.x+'px';e.style.top=center.y+'px';e.style.width=targetW+'px';e.style.height=targetH+'px';
        e.style.setProperty('--face-size',Math.max(12,Math.min(25,w*(d.type==='pin'?.41:.29)))+'px');
      }
    }
    return {render,focusBounds:id=>bounds[id],dispose(){if(active&&faces.has(active))faces.get(active).shell.visible=false;root.remove();}};
  }
  return {mount:opts=>makeView(opts,false),mountFlat:opts=>makeView(opts,true)};
})();
