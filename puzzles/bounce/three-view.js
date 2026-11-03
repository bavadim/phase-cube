/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Six physical layers, a fixed read head, independent local loop clocks. */
window.BounceView={create({scene,resources,model,game,binding,tween,onEditPreview,onSelect}){
  const T=THREE,F=FourierModel,B=BounceTerrain,own=x=>resources.own(x),root=new T.Group();scene.add(root);
  const spacing=.80,height=i=>i*spacing,centerY=height(5)/2;
  const camera=new T.OrthographicCamera(-3,3,3,-3,.1,60);camera.position.set(9,centerY+9,9);camera.lookAt(0,centerY,0);
  const material=(color,extra={})=>resources.material(color,{transparent:true,...extra});
  function mesh(geometry,mat,parent=root){const m=new T.Mesh(geometry,mat);parent.add(m);return m;}
  const pedestal=mesh(own(new T.CylinderGeometry(2.30,2.39,.18,64)),material(0xd5ddc9));pedestal.position.y=-.24;
  const foot=mesh(own(new T.CylinderGeometry(2.17,2.26,.07,64)),material(0xf0e6cf));foot.position.y=-.11;
  const shaft=mesh(own(new T.CylinderGeometry(.14,.14,height(5)+.44,20)),material(0xafa58a,{metalness:.3}));shaft.position.y=centerY;
  const cap=mesh(own(new T.SphereGeometry(.19,20,12)),material(0xba9160));cap.position.y=height(5)+.27;
  const N=192,inner=.25,base=game.targetRows.map((row,i)=>B.attacks(row,binding.periods[i]));
  const socketGeometry=own(new T.TorusGeometry(.12,.025,7,24)),haloGeometry=own(new T.TorusGeometry(.18,.019,6,24));
  const padGeometries=Array.from({length:12},(_,i)=>own(new T.CylinderGeometry(1,1,.075,3+i)));
  const layers=F.keys.map((key,i)=>{
    const group=new T.Group();group.position.y=height(i);root.add(group);
    const rotor=new T.Group();group.add(rotor);
    const materials=[],makeMat=(color,extra={})=>{const m=material(color,extra);materials.push(m);return m;};
    const color=new T.Color(game.voices[i].color),bodyMat=makeMat(color),sideMat=makeMat(color.clone().multiplyScalar(.68));
    const positions=new Float32Array((N+1)*6),indices=[],sidePositions=new Float32Array((N+1)*6);
    for(let n=0;n<N;n++){const k=2*n;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
    const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setIndex(indices);
    const sides=own(new T.BufferGeometry());sides.setAttribute('position',new T.BufferAttribute(sidePositions,3));sides.setIndex(indices);
    const body=mesh(geometry,bodyMat,rotor);body.userData={index:i,kind:'gear'};bodyMat.side=T.DoubleSide;
    mesh(sides,sideMat,rotor).material.side=T.DoubleSide;
    const outlineGeometry=own(new T.BufferGeometry()),outlinePositions=new Float32Array(N*3);outlineGeometry.setAttribute('position',new T.BufferAttribute(outlinePositions,3));
    const outlineMat=own(new T.LineBasicMaterial({color:color.clone().multiplyScalar(.5),transparent:true}));materials.push(outlineMat);
    rotor.add(new T.LineLoop(outlineGeometry,outlineMat));
    const notes=base[i].map(event=>{
      const c=B.color(event),pad=mesh(padGeometries[B.noteClass(event)],makeMat(c),rotor);
      const socket=mesh(socketGeometry,makeMat(c,{emissive:c,emissiveIntensity:.14}),rotor);socket.rotation.x=-Math.PI/2;
      const halo=mesh(haloGeometry,makeMat(0xd96a50,{emissive:0xd96a50,emissiveIntensity:.35}),rotor);halo.rotation.x=-Math.PI/2;
      const stud=mesh(own(new T.BoxGeometry(.025,.025,.055)),makeMat(0xfff6df),rotor);
      return{event,pad,socket,halo,stud,wrong:true};
    });
    const badgePoint=B.point((B.front+1.00)/B.TAU,2.37,height(i));
    const badge=mesh(own(new T.PlaneGeometry(.40,.40)),own(new T.MeshBasicMaterial({map:resources.label(game.voices[i].color,i+1),transparent:true,depthTest:false,depthWrite:false})));badge.position.copy(badgePoint);badge.quaternion.copy(camera.quaternion);badge.renderOrder=30;badge.userData={index:i,kind:'badge'};
    return{key,index:i,group,rotor,body,geometry,positions,sides,sidePositions,outlineGeometry,outlinePositions,materials,notes,badge,opacity:1,events:base[i],gain:1};
  });
  const voices=document.createElement('div');voices.className='bounce-voices';voices.setAttribute('role','group');voices.setAttribute('aria-label','Выбор партии');
  const buttons=F.keys.map((key,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i+1;b.style.setProperty('--voice-color',game.voices[i].color);b.title=game.voices[i].name;b.setAttribute('aria-label','Партия '+(i+1)+': '+game.voices[i].name);b.onclick=()=>onSelect(selected===i?{clearSelection:true}:{key,selectOnly:true});voices.append(b);return b;});
  const instruction=document.createElement('div');instruction.className='bounce-instruction';instruction.textContent='Крутите обод · тяните от центра';
  document.getElementById('player-controls').prepend(instruction,voices);
  const readhead=document.createElement('div');readhead.className='bounce-readhead';readhead.setAttribute('aria-hidden','true');readhead.innerHTML='<svg viewBox="0 0 32 40"><path d="M16 2 29 20H21V38H11V20H3Z"/></svg>';
  document.getElementById('puzzle-stage').append(readhead);
  let selected=null,disabled=true,animating=false,dragging=null,committed=null,disposed=false,previewKey='',clock={phase:0,playing:false,periodSeconds:8};
  const valuesAt=state=>model.parameters(state).map(p=>({phase:p.phase,gain:F.gain(p)}));let display=valuesAt(model.snapshot());
  function opacity(){
    layers.forEach(layer=>{
      const alpha=selected==null||layer.index===selected?1:.10;layer.opacity=alpha;
      for(const m of layer.materials){m.opacity=alpha;m.depthWrite=alpha===1;}
      layer.badge.material.opacity=selected==null||layer.index===selected?1:.48;
    });
    buttons.forEach((b,i)=>{b.disabled=disabled;b.setAttribute('aria-pressed',String(i===selected));});
  }
  function spin(){
    const now=performance.now();
    layers.forEach((layer,i)=>{
      layer.rotor.rotation.y=B.rotation(clock.phase,binding.periods[i]);
      const local=B.wrap(clock.phase/binding.periods[i]);
      layer.notes.forEach(note=>{
        const age=B.wrap(local-note.currentTime)*binding.periods[i]*clock.periodSeconds;
        const hit=clock.playing&&age<.09&&layer.gain>0?1-age/.09:0;
        note.pad.scale.y=1+hit*.65;
        note.halo.material.emissiveIntensity=.2+(note.wrong?.25*(1+Math.sin(now/230)):0);
      });
    });
  }
  function draw(values){
    display=values.map(p=>({...p}));
    layers.forEach((layer,i)=>{
      const p=display[i],phase=p.phase-F.homePhase[i];layer.events=B.shift(base[i],phase);layer.gain=p.gain;
      for(let n=0;n<=N;n++){
        const t=n/N,a=B.point(t,inner),b=B.point(t,B.surface(layer.events,t,p.gain)),k=n*6;
        layer.positions.set([a.x,.04,a.z,b.x,.04,b.z],k);layer.sidePositions.set([b.x,-.11,b.z,b.x,.04,b.z],k);
        if(n<N)layer.outlinePositions.set([b.x,.047,b.z],n*3);
      }
      for(const geo of [layer.geometry,layer.sides]){geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();}
      layer.outlineGeometry.attributes.position.needsUpdate=true;layer.outlineGeometry.computeBoundingSphere();
      layer.notes.forEach(note=>{
        const e=note.event,t=B.wrap(e.time-phase/8),pt=B.point(t,B.crest(e,p.gain),.09),slot=B.point(e.time,B.crest(e,1),.07);
        note.pad.position.copy(pt);note.pad.scale.set(B.tokenWidth(e),1,.10);note.pad.rotation.y=-t*B.TAU;
        const mark=B.point(t,B.crest(e,p.gain)-.045,.145);note.stud.position.copy(mark);note.stud.scale.z=1+(Math.floor(Math.abs(B.pitch(e))/12)%3)*.6;note.stud.rotation.y=-t*B.TAU;
        note.socket.position.copy(slot);note.socket.scale.set(B.tokenWidth(e)/.10,1,1);
        note.halo.position.set(slot.x,.065,slot.z);note.wrong=!B.matched(e,layer.events,p.gain);note.halo.visible=note.wrong;note.currentTime=t;
      });
    });opacity();spin();
  }
  function sync(){if(!animating&&!dragging&&!committed&&!disposed&&!previewKey)draw(valuesAt(model.snapshot()));}
  function preview(value){
    if(animating||dragging||committed)return;
    const next=value?.move!=null?JSON.stringify(value.move):'';if(next===previewKey)return;previewKey=next;
    const a=display.map(p=>({...p})),b=valuesAt(next?model.applyTo(value.before??model.snapshot(),value.move):model.snapshot());
    tween('gear-preview',220,t=>draw(a.map((p,i)=>({phase:p.phase+B.delta(p.phase/8,b[i].phase/8)*8*t,gain:p.gain+(b[i].gain-p.gain)*t}))));
  }
  const view={camera,hoverActions:false,requiresSelection:true,allowDeselect:true,selectionPrompt:'Выберите шестерёнку',sync,
    dispose(){disposed=true;voices.remove();instruction.remove();readhead.remove();},
    resize(aspect){const halfHeight=Math.max(3.36,2.48/aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateMatrixWorld();},
    inputPlane:()=>new T.Plane(new T.Vector3(0,1,0),-height(dragging?.index??selected??0)),
    pickTargets:()=>[...layers.map(l=>l.body),...layers.map(l=>l.badge)],
    pickHit(hits){return hits.find(h=>h.object.userData.kind==='badge')||(selected==null?hits[0]:hits.find(h=>h.object.userData.index===selected)||hits[0]);},
    hit(intersection){const {index,kind}=intersection.object.userData;return{key:F.keys[index],pieceId:index,kind,draggable:kind==='gear',selectOnly:true};},
    locations(){root.updateMatrixWorld(true);return layers.map(l=>({key:l.key,pieceId:l.index,kind:'gear',draggable:true,selectOnly:true,point:l.badge.getWorldPosition(new T.Vector3())}));},
    feedback(value){
      disabled=document.getElementById('puzzle-stage').getAttribute('aria-disabled')==='true';const index=F.keys.indexOf(value.selected);selected=index<0?null:index;opacity();
      if(value.focus?.source!=='edit'&&value.focus?.source!=='demonstration')preview(value.focus);
    },
    updateMusic(value){const changed=clock.playing!==value.playing||clock.phase!==value.phase;clock=value;spin();return value.playing||changed;},
    beginDrag(hit,world){
      if(animating||!world)return false;selected=F.keys.indexOf(hit.key);const p=valuesAt(model.snapshot())[selected];
      tween('gear-preview',0,()=>{});previewKey='';committed=null;draw(valuesAt(model.snapshot()));
      dragging={key:hit.key,index:selected,before:model.snapshot(),start:world.clone(),previous:B.angle(world),angle:0,phase:p.phase,gain:p.gain,mode:null,move:null};return true;
    },
    dragTo(world){
      if(!dragging||!world)return;const d=dragging,a=B.angle(world);d.angle+=B.delta(d.previous,a);d.previous=a;
      const r=Math.hypot(d.start.x,d.start.z),dr=Math.hypot(world.x,world.z)-r;
      if(!d.mode)d.mode=Math.abs(d.angle*B.TAU*r)>Math.abs(dr)*.8?'phase':'gain';
      const phase=d.mode==='phase'?d.phase-d.angle*8:d.phase;
      let gain=d.mode==='gain'?Math.max(0,Math.min(2,d.gain+dr/B.gainDragSpan)):d.gain;if(Math.abs(gain-1)<.035)gain=1;gain=Math.round(gain*1e6)/1e6;
      const values=valuesAt(d.before);values[d.index]={phase,gain};draw(values);d.move=model.editMove(d.key,{phase:Math.round(phase),level:gain*4},d.before);onEditPreview(d.move,{key:d.key,phase,gain});
    },
    endDrag(cancelled){if(!dragging)return null;const d=dragging;dragging=null;onEditPreview(null);if(!cancelled&&d.move&&model.validMove(d.move)){committed=JSON.stringify(d.move);return d.move;}sync();return null;},
    async animate(move,before,{duration=360}={}){
      const direct=committed===JSON.stringify(move);committed=null;animating=true;previewKey='';tween('gear-preview',0,()=>{});
      const index=F.keys.indexOf(model.moveTarget(move)),a=display.map(p=>({...p})),b=valuesAt(model.applyTo(before,move));
      const delta=B.delta(a[index].phase/8,b[index].phase/8)*8;
      try{await tween('move',direct?140:duration,t=>draw(a.map((p,i)=>i!==index?p:{phase:p.phase+delta*t,gain:p.gain+(b[i].gain-p.gain)*t})));}finally{animating=false;sync();}
    },
    inspect(){return{selected,clock,display,layers:layers.map(l=>({index:l.index,key:l.key,opacity:l.opacity,gain:l.gain,rotation:l.rotor.rotation.y,period:binding.periods[l.index],events:l.events,wrongSlots:l.notes.filter(n=>n.wrong).length,bodyRadius:B.radius(l.gain)}))};}
  };
  sync();return view;
}};
BouncePuzzle.mount=context=>PuzzleControl.mount({...context,module:BouncePuzzle,createView:BounceView.create});
