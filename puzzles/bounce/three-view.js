/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Six physical layers inside the shared equalizer; independent local loop clocks. */
window.BounceView={create({scene,resources,model,game,binding,tween,onEditPreview}){
  const T=THREE,F=FourierModel,B=BounceTerrain,own=x=>resources.own(x),root=new T.Group();scene.add(root);
  const spacing=.80,height=i=>i*spacing,centerY=height(5)/2;
  const camera=new T.OrthographicCamera(-3,3,3,-3,.1,60);camera.position.set(9,centerY+9,9);camera.lookAt(0,centerY,0);
  const material=(color,extra={})=>resources.material(color,{transparent:true,...extra});
  function mesh(geometry,mat,parent=root){const m=new T.Mesh(geometry,mat);parent.add(m);return m;}
  function fittings(geometry,mat,poses,parent=root){
    const m=own(new T.InstancedMesh(geometry,mat,poses.length)),transform=new T.Matrix4();
    poses.forEach(([p,angle=0],i)=>{transform.makeRotationY(angle);transform.setPosition(p.x,p.y,p.z);m.setMatrixAt(i,transform);});
    m.instanceMatrix.needsUpdate=true;parent.add(m);return m;
  }
  // Machined housings are geometry, not painted rings. The only moving/raycasted
  // surface remains the original gear; all trim shares its layer's transparency.
  function chamfered(radius,depth,bevel=.025,segments=32){
    const h=depth/2,b=Math.min(bevel,h,radius);
    return own(new T.LatheGeometry([[0,-h],[radius-b,-h],[radius,-h+b],[radius,h-b],[radius-b,h],[0,h]].map(p=>new T.Vector2(...p)),segments));
  }
  const shell=material(0x243346,{roughness:.68,metalness:.16}),dark=material(0x101824,{roughness:.78}),metal=material(0x667d91,{roughness:.39,metalness:.67});
  const cyan=material(0x62dce8,{emissive:0x24b9ce,emissiveIntensity:.42,roughness:.4});
  const pedestal=mesh(chamfered(2.39,.25,.055,48),shell);pedestal.position.y=-.30;
  const gasket=mesh(chamfered(2.31,.035,.009,48),dark);gasket.position.y=-.162;
  const deck=mesh(chamfered(2.25,.075,.025,48),metal);deck.position.y=-.112;
  const inset=mesh(chamfered(2.17,.028,.010,48),dark);inset.position.y=-.067;
  const shaft=mesh(own(new T.CylinderGeometry(.14,.14,height(5)+.44,20)),metal);shaft.position.y=centerY;
  const cap=mesh(chamfered(.23,.16,.04,16),shell);cap.position.y=height(5)+.22;
  const capInset=mesh(chamfered(.155,.018,.006,16),metal);capInset.position.y=height(5)+.307;
  const footGeometry=chamfered(.24,.12,.025,12),boltGeometry=chamfered(.047,.018,.006,6);
  const boltSlotGeometry=resources.bevelBox(.039,.005,.009,.002);
  const ventGeometry=resources.bevelBox(.055,.012,.22,.012);
  const feet=[],bolts=[],slots=[],vents=[];
  for(let i=0;i<8;i++){
    const p=B.point((i+.5)/8,2.04,-.047);bolts.push([p]);slots.push([{...p,y:p.y+.012},-i*B.TAU/8]);
    if(i%2===0)feet.push([B.point((i+.5)/8,1.80,-.465)]);
  }
  for(let i=0;i<12;i++){
    const t=(i-5.5)*.013+.625;vents.push([B.point(t,1.97,-.048),-t*B.TAU]);
  }
  fittings(footGeometry,dark,feet);fittings(boltGeometry,metal,bolts);fittings(boltSlotGeometry,dark,slots);fittings(ventGeometry,dark,vents);
  const lightGeometry=own(new T.TorusGeometry(2.29,.013,6,32,.36));
  for(let i=0;i<3;i++){const light=mesh(lightGeometry,cyan);light.rotation.set(-Math.PI/2,0,i*B.TAU/3+.18);light.position.y=-.192;}
  const N=192,inner=.25,base=game.targetRows.map((row,i)=>B.attacks(row,binding.periods[i]));
  const socketGeometry=own(new T.TorusGeometry(.12,.025,7,24));
  const padGeometries=Array.from({length:12},(_,i)=>own(new T.CylinderGeometry(1,1,.075,3+i)));
  const collarGeometry=chamfered(.34,.095,.025,24),bearingGeometry=chamfered(.265,.12,.018,24);
  const hubBandGeometry=own(new T.TorusGeometry(.289,.013,6,32));
  const studGeometry=resources.bevelBox(.025,.025,.055,.004),fluteGeometry=resources.bevelBox(.026,.009,.19,.004);
  const layers=F.keys.map((key,i)=>{
    const group=new T.Group();group.position.y=height(i);root.add(group);
    const rotor=new T.Group(),targets=new T.Group();group.add(rotor,targets);
    const materials=[],makeMat=(color,extra={})=>{const m=material(color,extra);materials.push(m);return m;};
    const color=new T.Color(game.voices[i].color),bodyMat=makeMat(new T.Color(0x293a4d).lerp(color,.12),{roughness:.65,metalness:.2});
    const sideMat=makeMat(0x111c2a,{roughness:.48,metalness:.3}),edgeMat=makeMat(0x657c92,{roughness:.38,metalness:.6});
    const recessMat=makeMat(0x101824),hubMat=makeMat(0x31455c,{roughness:.48,metalness:.38});
    const collar=mesh(collarGeometry,hubMat,rotor);collar.position.y=.083;
    const bearing=mesh(bearingGeometry,edgeMat,rotor);bearing.position.y=.155;
    const band=mesh(hubBandGeometry,makeMat(color,{emissive:color,emissiveIntensity:.18}),rotor);band.rotation.x=-Math.PI/2;band.position.y=.124;
    const hubBolts=[],hubSlots=[],flutes=[];
    for(let n=0;n<4;n++){
      const p=B.point((n+.5)/4,.43,.056);hubBolts.push([p]);hubSlots.push([{...p,y:.068},-n*Math.PI/2]);flutes.push([B.point(n/4,.67,.049),-n*Math.PI/2]);
    }
    fittings(boltGeometry,edgeMat,hubBolts,rotor);fittings(boltSlotGeometry,recessMat,hubSlots,rotor);fittings(fluteGeometry,recessMat,flutes,rotor);
    const positions=new Float32Array((N+1)*6),indices=[],sidePositions=new Float32Array((N+1)*6),surfaceUV=new Float32Array((N+1)*4),sideUV=new Float32Array((N+1)*4);
    for(let n=0;n<N;n++){const k=2*n;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
    for(let n=0;n<=N;n++)sideUV.set([n/N*4,0,n/N*4,1],n*4);
    const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('uv',new T.BufferAttribute(surfaceUV,2));geometry.setIndex(indices);
    const sides=own(new T.BufferGeometry());sides.setAttribute('position',new T.BufferAttribute(sidePositions,3));sides.setAttribute('uv',new T.BufferAttribute(sideUV,2));sides.setIndex(indices);
    const body=mesh(geometry,bodyMat,rotor);body.userData={index:i,kind:'gear'};bodyMat.side=T.DoubleSide;
    mesh(sides,sideMat,rotor).material.side=T.DoubleSide;
    const bevelPositions=new Float32Array((N+1)*6),bevelUV=new Float32Array((N+1)*4),bevelGeometry=own(new T.BufferGeometry());
    bevelGeometry.setAttribute('position',new T.BufferAttribute(bevelPositions,3));bevelGeometry.setAttribute('uv',new T.BufferAttribute(bevelUV,2));bevelGeometry.setIndex(indices.slice().reverse());
    mesh(bevelGeometry,edgeMat,rotor);
    const outlineGeometry=own(new T.BufferGeometry()),outlinePositions=new Float32Array(N*3);outlineGeometry.setAttribute('position',new T.BufferAttribute(outlinePositions,3));
    const outlineMat=own(new T.LineBasicMaterial({color:color.clone().multiplyScalar(.82),transparent:true}));materials.push(outlineMat);
    rotor.add(new T.LineLoop(outlineGeometry,outlineMat));
    const noteMaterials=new Map(),studMat=makeMat(0xf7f1d8,{roughness:.5});
    const notes=base[i].map(event=>{
      const c=B.color(event);if(!noteMaterials.has(c))noteMaterials.set(c,makeMat(c,{emissive:c,emissiveIntensity:.14,roughness:.5}));
      const pad=mesh(padGeometries[B.noteClass(event)],noteMaterials.get(c),rotor);
      const socket=mesh(socketGeometry,noteMaterials.get(c),targets);socket.rotation.x=-Math.PI/2;
      const stud=mesh(studGeometry,studMat,rotor);
      return{event,pad,socket,stud};
    });
    return{key,index:i,group,rotor,targets,body,geometry,positions,surfaceUV,sides,sidePositions,bevelGeometry,bevelPositions,bevelUV,outlineGeometry,outlinePositions,materials,notes,opacity:1,events:base[i],gain:null};
  });
  let selected=null,animating=false,dragging=null,committed=null,disposed=false,clock={phase:0,position:0,playing:false,periodSeconds:8};
  const valuesAt=state=>model.parameters(state).map(p=>({phase:p.phase,gain:F.gain(p)}));let display=valuesAt(model.snapshot());
  function opacity(){
    layers.forEach(layer=>{
      const alpha=selected==null||layer.index===selected?1:.10;layer.opacity=alpha;
      for(const m of layer.materials){m.opacity=alpha;m.depthWrite=alpha===1;}
    });
  }
  function spin(){
    layers.forEach((layer,i)=>{
      const rotation=B.rotation(clock.phase,binding.periods[i]);
      layer.targets.rotation.y=rotation;
      layer.rotor.rotation.y=rotation-(display[i].phase-F.homePhase[i])*B.TAU/8;
      const local=B.wrap(clock.phase/binding.periods[i]);
      layer.notes.forEach(note=>{
        const age=B.wrap(local-note.currentTime)*binding.periods[i]*clock.periodSeconds;
        const hit=clock.playing&&age<.09&&layer.gain>0?1-age/.09:0;
        note.pad.scale.y=1+hit*.65;
      });
    });
  }
  function draw(values){
    display=values.map(p=>({...p}));
    layers.forEach((layer,i)=>{
      const p=display[i],phase=p.phase-F.homePhase[i];layer.events=B.shift(base[i],phase);
      // Phase is a transform, not a rebuild. Only radial gain changes the mesh.
      if(layer.gain!==p.gain){
        layer.gain=p.gain;
        for(let n=0;n<=N;n++){
          const t=n/N,a=B.point(t,inner),b=B.point(t,B.surface(base[i],t,p.gain)),k=n*6;
          layer.positions.set([a.x,.04,a.z,b.x,.04,b.z],k);layer.sidePositions.set([b.x,-.11,b.z,b.x,.04,b.z],k);
          layer.surfaceUV.set([a.x/4+.5,a.z/4+.5,b.x/4+.5,b.z/4+.5],n*4);
          const lip=B.point(t,B.surface(base[i],t,p.gain)-.035),rim=B.point(t,B.surface(base[i],t,p.gain)-.006);
          layer.bevelPositions.set([lip.x,.041,lip.z,rim.x,.047,rim.z],k);
          layer.bevelUV.set([lip.x/4+.5,lip.z/4+.5,rim.x/4+.5,rim.z/4+.5],n*4);
          if(n<N)layer.outlinePositions.set([b.x,.048,b.z],n*3);
        }
        for(const geo of [layer.geometry,layer.sides,layer.bevelGeometry]){geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();}
        layer.geometry.attributes.uv.needsUpdate=true;layer.bevelGeometry.attributes.uv.needsUpdate=true;
        layer.outlineGeometry.attributes.position.needsUpdate=true;layer.outlineGeometry.computeBoundingSphere();
        layer.notes.forEach(note=>{
          const e=note.event,t=e.time,pt=B.point(t,B.crest(e,p.gain),.09),slot=B.point(t,B.crest(e,1),.07);
          note.pad.position.copy(pt);note.pad.scale.set(B.tokenWidth(e),1,.10);note.pad.rotation.y=-t*B.TAU;
          const mark=B.point(t,B.crest(e,p.gain)-.045,.145);note.stud.position.copy(mark);note.stud.scale.z=1+(Math.floor(Math.abs(B.pitch(e))/12)%3)*.6;note.stud.rotation.y=-t*B.TAU;
          note.socket.position.copy(slot);note.socket.scale.set(B.tokenWidth(e)/.10,1,1);
        });
      }
      layer.notes.forEach(note=>{note.currentTime=B.wrap(note.event.time-phase/8);});
    });opacity();spin();
  }
  function updateHold(){
    if(!dragging)return;
    const d=dragging,phase=B.heldPhase(d.phase,d.position,clock.position,binding.periods[d.index]),values=valuesAt(d.before);
    values[d.index]={phase,gain:d.gain};draw(values);
    d.move=model.editPoint(d.key,{phase,gain:d.gain},d.before);
    onEditPreview(d.move,{key:d.key,phase,gain:d.gain});
  }
  function sync(){if(!animating&&!dragging&&!committed&&!disposed)draw(valuesAt(model.snapshot()));}
  const view={camera,sync,
    dispose(){disposed=true;dragging=null;},
    resize(aspect){const halfHeight=Math.max(3.36,2.48/aspect);camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateMatrixWorld();},
    inputPlane:()=>new T.Plane(new T.Vector3(0,1,0),-height(dragging?.index??selected??0)),
    pickTargets:()=>layers.map(l=>l.body),
    hit({object}){const index=object.userData.index;return{key:F.keys[index],pieceId:index,kind:'gear',draggable:true,pressable:true,selectOnly:true};},
    locations(){return layers.map(l=>{const p=B.point(B.front/B.TAU,.92,height(l.index)+.04);return{key:l.key,pieceId:l.index,kind:'gear',draggable:true,pressable:true,selectOnly:true,point:new T.Vector3(p.x,p.y,p.z)};});},
    feedback(value){const index=F.keys.indexOf(value.selected);selected=index<0?null:index;opacity();},
    updateMusic(value){const changed=clock.playing!==value.playing||clock.phase!==value.phase;clock={...value,position:value.position??value.phase};if(dragging)updateHold();else spin();return value.playing||changed;},
    beginDrag(hit,world){
      if(animating||!world)return false;selected=F.keys.indexOf(hit.key);const p=valuesAt(model.snapshot())[selected];
      committed=null;draw(valuesAt(model.snapshot()));
      dragging={key:hit.key,index:selected,before:model.snapshot(),start:world.clone(),position:clock.position,phase:p.phase,gain:p.gain,move:null};
      updateHold();return true;
    },
    dragTo(world){
      // Tangential pointer movement never rotates the gear. While it is held,
      // a radial pull can still adjust size/gain; phase follows elapsed audio time.
      if(!dragging||!world)return;const d=dragging,initial=valuesAt(d.before)[d.index].gain;
      const dr=Math.hypot(world.x,world.z)-Math.hypot(d.start.x,d.start.z);
      d.gain=B.snapGain(initial+dr/B.gainDragSpan);updateHold();
    },
    endDrag(cancelled){
      if(!dragging)return null;if(!cancelled)updateHold();const d=dragging;dragging=null;
      // Keep the display until animate() consumes this edit; clearing focus may sync the view.
      const move=!cancelled&&d.move&&model.validMove(d.move)?d.move:null;
      committed=move?JSON.stringify(move):null;
      draw(valuesAt(move?model.applyTo(d.before,move):d.before));onEditPreview(null);
      if(move)return move;sync();return null;
    },
    async animate(move,before,{duration=360}={}){
      const direct=committed===JSON.stringify(move);committed=null;animating=true;
      const index=F.keys.indexOf(model.moveTarget(move)),a=display.map(p=>({...p})),b=valuesAt(model.applyTo(before,move));
      const delta=B.delta(a[index].phase/8,b[index].phase/8)*8;
      try{if(direct)draw(b);else await tween('move',duration,t=>draw(a.map((p,i)=>i!==index?p:{phase:p.phase+delta*t,gain:p.gain+(b[i].gain-p.gain)*t})));}finally{animating=false;sync();}
    },
    inspect(){
      root.updateMatrixWorld(true);
      return{selected,holding:dragging?.index??null,clock,display,layers:layers.map(l=>{
        const pads=l.notes.map(n=>n.pad.getWorldPosition(new T.Vector3())),sockets=l.notes.map(n=>n.socket.getWorldPosition(new T.Vector3()));
        return{index:l.index,key:l.key,opacity:l.opacity,gain:l.gain,rotation:l.rotor.rotation.y,targetRotation:l.targets.rotation.y,period:binding.periods[l.index],seatStep:model.seatSteps[l.index],events:l.events,bodyRadius:B.radius(l.gain),
          angularErrors:pads.map(p=>Math.min(...sockets.map(s=>Math.abs(B.delta(Math.atan2(p.x,p.z)/B.TAU,Math.atan2(s.x,s.z)/B.TAU))))),
          seatErrors:pads.map(p=>Math.min(...sockets.map(s=>Math.hypot(p.x-s.x,p.z-s.z))))};
      })};
    }
  };
  sync();return view;
}};
