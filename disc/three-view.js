/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One musical period, three coaxial phrases and a single stationary reader.
   Audible event geometry follows the transport revision, never the pending edit. */
window.DiscView = {create({scene,resources:R,model,game,onEditPreview=()=>{}}){
  const T=THREE,TAU=Math.PI*2,wrap=n=>((n%1)+1)%1,own=x=>R.own(x);
  const modules=game.modules,periodBars=game.periodBars||4,phaseSteps=game.phaseSteps||32;
  const root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-5,5,5,-5,.1,60);
  const mesh=(g,m,parent=root)=>{const o=new T.Mesh(g,m);parent.add(o);return o;};
  const material=(color,extra={})=>R.material(color,{roughness:.67,metalness:.17,...extra});
  const ink=material('#10262b'),shell=material('#233b40'),metal=material('#69847f',{roughness:.4,metalness:.55}),cream=material('#e9e5cd'),black=material('#081c21');
  const gold=own(new T.MeshBasicMaterial({color:'#f5d994'})),lineMat=own(new T.MeshBasicMaterial({color:'#c0d3ba'}));
  const hitMaterial=own(new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));
  const box=(w,h,d,m,parent=root,b=.03)=>mesh(R.bevelBox(w,h,d,b),m,parent);
  const cyl=(radius,depth,m,parent=root)=>mesh(own(new T.CylinderGeometry(radius,radius,depth,64)),m,parent);
  const stroke=(points,color,radius=.015,parent=root)=>{const o=R.stroke(points,{color,radius});parent.add(o);return o;};
  const torus=(radius,t,m,parent=root)=>{const o=mesh(own(new T.TorusGeometry(radius,t,6,96)),m,parent);o.rotation.x=-Math.PI/2;return o;};
  const point=(turn,radius,y=0)=>new T.Vector3(Math.sin(turn*TAU)*radius,y,Math.cos(turn*TAU)*radius);
  const picks=[],rings=[],pick=(o,key,kind)=>{o.userData={key,kind};picks.push(o);return o;};
  const base=cyl(3.66,.22,ink);base.position.y=-.17;
  const baseRim=torus(3.61,.035,metal);baseRim.position.y=-.03;
  const bed=cyl(3.49,.03,black);bed.position.y=-.04;
  const master=new T.Group();root.add(master);
  for(let i=0;i<phaseSteps;i++){
    const bar=i%(phaseSteps/periodBars)===0,quarter=i%2===0,length=bar?.20:quarter?.115:.06;
    const tick=box(.018,.015,length,bar?cream:metal,master,.003);tick.position.copy(point(i/phaseSteps,3.43-length/2,.0));tick.rotation.y=i/phaseSteps*TAU;
    if(bar)stroke([point(i/phaseSteps,.70,.012).toArray(),point(i/phaseSteps,3.25,.012).toArray()],'#344e50',.011,master);
  }
  const center=cyl(.66,.10,shell);center.position.y=.02;
  const centerRim=torus(.62,.014,metal);centerRim.position.y=.08;
  const beam=stroke([[0,1.03,.73],[0,1.03,3.34]],'#e5dfc3',.014);
  // A single reader, perpendicular to every phrase. It does not move or rotate.
  const readerTip=mesh(own(new T.ConeGeometry(.11,.22,3)),gold);readerTip.rotation.x=Math.PI/2;readerTip.position.set(0,1.03,3.46);
  const front=box(7.02,.20,1.12,ink);front.position.set(0,-.16,4.20);
  let clock={position:0,periodBars,periodSeconds:6.4,playing:false,rows:[],state:null},selected=model.selected,dragging=null,disposed=false,narrow=false,viewport={width:0,height:0};
  const mobileBridge=stroke([[0,.01,3.33],[0,.01,6.80]],'#6c827a',.025);mobileBridge.visible=false;
  function text(parent,{width=1.8,height=.34,font=44,color='#e5e6d2',background=null}={}){
    const canvas=document.createElement('canvas');canvas.width=Math.round(112*width/height);canvas.height=112;
    const ctx=canvas.getContext('2d'),texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;
    const mat=own(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false})),sprite=new T.Sprite(mat);sprite.scale.set(width,height,1);parent.add(sprite);
    let cached='';return{sprite,draw(value,inkColor=color){const key=value+inkColor;if(key===cached)return;cached=key;ctx.clearRect(0,0,canvas.width,112);
      if(background){ctx.fillStyle=background;ctx.beginPath();ctx.roundRect(0,0,canvas.width,112,12);ctx.fill();}
      let size=font;ctx.font='600 '+size+'px Arial';while(size>24&&ctx.measureText(value).width>canvas.width-18){ctx.font='600 '+(--size)+'px Arial';}
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=inkColor;ctx.fillText(value,canvas.width/2,56);texture.needsUpdate=true;}};
  }
  const centerCaption=text(root,{width:.83,height:.22,font:96});centerCaption.sprite.position.set(0,.13,-.32);centerCaption.draw('ТАКТ');
  const centerText=text(root,{width:1.16,height:.42,font:96});centerText.sprite.position.set(0,.13,.04);centerText.draw('1 / '+periodBars);
  const readerText=text(root,{width:1.25,height:.32,font:90,color:'#efe4c5'});readerText.sprite.position.set(.0,1.12,3.67);readerText.draw('СЕЙЧАС');
  function arcGeometry(radius,width,start,duration){
    const a=start*TAU-Math.PI/2,b=a+Math.min(duration,.999999)*TAU,inner=radius-width/2,outer=radius+width/2,shape=new T.Shape();
    shape.moveTo(Math.cos(a)*outer,Math.sin(a)*outer);shape.absarc(0,0,outer,a,b,false);
    shape.lineTo(Math.cos(b)*inner,Math.sin(b)*inner);shape.absarc(0,0,inner,b,a,true);shape.closePath();
    const geo=own(new T.ExtrudeGeometry(shape,{depth:1,steps:1,bevelEnabled:false,curveSegments:Math.max(2,Math.ceil(duration*60))}));geo.rotateX(-Math.PI/2);return geo;
  }
  function disposeNoteGeometry(ring){
    for(const event of ring.events){ring.notes.remove(event.mesh);ring.notes.remove(event.mark);picks.splice(picks.indexOf(event.mesh),1);for(const geo of [event.mesh.geometry]){R.items.delete(geo);geo.dispose();}}
    ring.events=[];
  }
  modules.forEach((definition,index)=>{
    const radius=1.16+index*.88,color=definition.color||['#efb864','#83c8ba','#91b8e5'][index],group=new T.Group();master.add(group);
    const stripMat=material(new T.Color(color).multiplyScalar(.33)),noteMaterials=Array.from({length:12},(_,pitch)=>material(new T.Color(color).lerp(new T.Color().setHSL(pitch/12,.58,.64),.25),{roughness:.42,metalness:.12}));
    const groove=mesh(own(new T.RingGeometry(radius-.35,radius+.35,128)),stripMat,group);groove.rotation.x=-Math.PI/2;groove.position.y=.025;
    const phaseHit=pick(mesh(own(new T.RingGeometry(radius-.36,radius+.36,128)),hitMaterial,group),definition.key,'phase');phaseHit.rotation.x=-Math.PI/2;phaseHit.position.y=.045;
    const rim=torus(radius+.36,.012,metal,group);rim.position.y=.045;
    const selection=torus(radius+.38,.022,gold);selection.position.y=.062;selection.visible=false;
    const notes=new T.Group();notes.position.y=.065;group.add(notes);
    const origin=mesh(own(new T.ConeGeometry(.065,.16,3)),material(color),group);origin.rotation.x=Math.PI/2;origin.position.copy(point(0,radius+.25,.10));
    const scanner=box(.18,.08,.25,material(color),root,.03);scanner.position.set(0,1.03,radius);
    const light=mesh(own(new T.SphereGeometry(.065,12,8)),own(new T.MeshBasicMaterial({color})));light.position.set(0,1.08,radius);light.visible=false;
    const head=new T.Group();head.position.set((index-1)*2.31,0,4.17);root.add(head);
    const headBase=box(2.15,.12,.93,shell,head,.05);headBase.position.y=.02;
    const edge=stroke([[-1.01,.09,-.43],[1.01,.09,-.43],[1.01,.09,.43],[-1.01,.09,.43],[-1.01,.09,-.43]],color,.013,head);
    const name=text(head,{width:2.12,height:.44,font:88,color});name.sprite.position.set(0,.12,-.50);name.draw(definition.name);
    const toggle=cyl(.31,.12,material(color),head);toggle.position.set(-.70,.14,.04);pick(toggle,definition.key,'toggle');
    const toggleHit=pick(cyl(.44,.15,hitMaterial,head),definition.key,'toggle');toggleHit.position.copy(toggle.position);
    const powerSymbol=stroke([[-.70,.21,-.08],[-.70,.21,.08]],'#163034',.025,head);
    const toggleLabel=null;const toggleCircle=torus(.13,.016,black,head);toggleCircle.position.set(-.70,.212,.04);
    const rail=box(.055,.83,.08,metal,head,.01);rail.position.set(0,.45,.03);
    const gainGrip=box(.41,.17,.29,material(color),head,.025);gainGrip.position.set(0,.44,.03);pick(gainGrip,definition.key,'gain');
    const gainHit=pick(box(.86,.40,.60,hitMaterial,head,.02),definition.key,'gain');gainHit.position.copy(gainGrip.position);
    const gainLabel=text(head,{width:.92,height:.34,font:94});gainLabel.sprite.position.set(0,.55,.20);pick(gainLabel.sprite,definition.key,'gain');
    let cartridge=null,variantHit=null,variantLabel=null,glyph=null;
    if(definition.variants.length>1){
      cartridge=box(.96,.12,.55,material(color),head,.025);cartridge.position.set(.62,.14,.12);pick(cartridge,definition.key,'variant');
      variantHit=pick(box(1.02,.22,.79,hitMaterial,head,.02),definition.key,'variant');variantHit.position.copy(cartridge.position);
      variantLabel=text(head,{width:1.05,height:.33,font:90,color:'#e9e6d1',background:'#10262b'});variantLabel.sprite.position.set(.62,.28,.18);pick(variantLabel.sprite,definition.key,'variant');
    }
    const lead=stroke([[0,.015,radius],[(index-1)*2.31,.015,3.60],[(index-1)*2.31,.015,3.73]],color,.017);
    const markGeo=own(new T.SphereGeometry(.035,10,6)),markMat=material('#efe7ca'),allPitches=definition.variants.flatMap(v=>v.events.map(e=>e.pitch).filter(Number.isFinite)),pitchMin=Math.min(...allPitches),pitchMax=Math.max(...allPitches);
    rings.push({key:definition.key,index,definition,radius,color,group,notes,origin,phaseHit,selection,stripMat,noteMaterials,events:[],variant:-1,scanner,light,head,headBase,edge,name,toggle,toggleHit,powerSymbol,toggleCircle,toggleLabel,rail,gainGrip,gainHit,gainLabel,cartridge,variantHit,variantLabel,glyph,lead,markGeo,markMat,pitchMin,pitchMax,heard:null});
  });
  function rebuild(ring,variant){
    disposeNoteGeometry(ring);ring.variant=variant;
    const events=ring.definition.variants[variant]?.events||[];
    for(const [index,event] of events.entries()){
      const pitch=Number.isFinite(event.pitch)?((Math.round(event.pitch)%12)+12)%12:0,radialPitch=Number.isFinite(event.pitch)&&ring.pitchMax>ring.pitchMin?((event.pitch-ring.pitchMin)/(ring.pitchMax-ring.pitchMin)-.5)*.42:0;
      const r=ring.radius+radialPitch,width=Number.isFinite(event.pitch)?.115:.22,geo=arcGeometry(r,width,event.start,event.duration),m=mesh(geo,ring.noteMaterials[pitch],ring.notes);pick(m,ring.key,'phase');
      const mark=mesh(ring.markGeo,ring.markMat,ring.notes);mark.position.copy(point(event.start,r,0));
      ring.events.push({source:{...event},index,pitch,radius:r,mesh:m,mark});
    }
  }
  function renderHeard(state){
    if(!state)return;
    for(const ring of rings){const p=state.parts.find(p=>p.key===ring.key);if(!p)continue;
      ring.heard=p;if(ring.variant!==p.variant)rebuild(ring,p.variant);
      ring.group.rotation.y=p.phase*TAU;
      ring.stripMat.color.set(ring.color).multiplyScalar(p.installed?.33:.13);
      ring.noteMaterials.forEach(m=>{m.transparent=!p.installed;m.opacity=p.installed?1:.17;m.depthWrite=p.installed;});
      for(const e of ring.events){const velocity=Number(e.source.value?.velocity??1),height=p.installed?.008+p.gain*.26*Math.max(0,Math.min(1.5,Number.isFinite(velocity)?velocity:1)):.006;e.mesh.scale.y=height;e.mark.position.y=height+.018;e.mark.visible=p.installed;}
      ring.origin.visible=p.installed;ring.lead.visible=p.installed&&!narrow;
    }
  }
  function controls(){
    const state=model.snapshot();selected=model.selected;
    for(const ring of rings){const base=state.parts.find(p=>p.key===ring.key);if(!base)continue;const p=dragging?.key===ring.key?{...base,...dragging.patch}:base;
      ring.selection.visible=selected===ring.key;ring.edge.visible=selected===ring.key;
      ring.toggle.material.color.set(p.installed?ring.color:'#405456');
      ring.gainGrip.position.y=.14+p.gain*.35;ring.gainHit.position.copy(ring.gainGrip.position);ring.gainLabel.sprite.position.y=ring.gainGrip.position.y+.16;ring.gainLabel.draw(Math.round(p.gain*100)+'%');
      const n=ring.definition.variants.length;if(ring.variantLabel)ring.variantLabel.draw('Фраза '+(p.variant+1)+'/'+n);
    }
  }
  function sync(){if(disposed)return;controls();if(!clock.state||!clock.playing)renderHeard(clock.state||model.snapshot());}
  function tick(value){
    if(disposed)return false;clock={...clock,...value};renderHeard(clock.state||model.snapshot());
    const position=clock.position||0,period=clock.periodBars||periodBars,turn=position/period,phase=wrap(turn);
    master.rotation.y=-turn*TAU;centerText.draw((Math.floor(wrap(position/period)*period)+1)+' / '+period);
    for(const [i,ring] of rings.entries()){
      let strength=0;const row=clock.rows?.[i]||[],events=Array.isArray(row)?row:row.events||[];
      if(clock.playing&&ring.heard?.installed&&ring.heard.gain>0)for(const event of events){
        if(event.audible===false||event.volume===0||event.gain===0)continue;
        const age=wrap(phase-event.start)*(clock.periodSeconds||6.4),duration=Math.max(.04,(event.duration||0)*(clock.periodSeconds||6.4));
        if(age<duration)strength=Math.max(strength,.22+.78*Math.exp(-age/.07));
      }
      ring.light.visible=strength>0;ring.light.scale.setScalar(.65+strength*.85);
    }
    return true;
  }
  const selectedRing=()=>rings.find(r=>r.key===(dragging?.key||model.selected))||rings[0];
  const view={camera,sync,
    resize(aspect,width,height){
      narrow=aspect<.95;viewport={width:width||aspect*600,height:height||600};
      front.position.z=narrow?5.12:4.20;front.scale.z=narrow?3.15:1;mobileBridge.visible=narrow;
      rings.forEach((r,i)=>{
        r.head.position.set(narrow?0:(i-1)*2.31,0,narrow?3.90+i*1.15:4.17);
        r.headBase.scale.x=narrow?6.50/2.15:1;r.edge.scale.x=narrow?6.34/2.02:1;
        r.name.sprite.position.set(narrow?-2.08:0,narrow?.17:.12,narrow?0:-.50);
        r.name.sprite.scale.set(narrow?2.12:2.12,narrow?.46:.44,1);
        const toggleX=narrow?-.55:-.70,gainX=narrow?.85:0;
        r.toggle.position.x=toggleX;r.toggleHit.position.x=toggleX;r.toggleCircle.position.x=toggleX;r.powerSymbol.position.x=toggleX+.70;
        r.toggle.scale.set(narrow?1.30:1,1,narrow?1.30:1);r.toggleHit.scale.set(narrow?1.12:1,1,narrow?1.12:1);
        r.toggleCircle.scale.setScalar(narrow?1.3:1);r.powerSymbol.scale.set(1,narrow?1.3:1,narrow?1.3:1);
        r.rail.position.x=gainX;r.gainGrip.position.x=gainX;r.gainHit.position.x=gainX;r.gainLabel.sprite.position.x=gainX;
        r.gainGrip.scale.set(narrow?1.5:1,narrow?1.5:1,narrow?1.4:1);
        r.gainHit.scale.set(narrow?1.20:1,narrow?1.65:1,narrow?1.40:1);r.gainLabel.sprite.scale.set(narrow?1.06:.92,narrow?.40:.34,1);
        if(r.cartridge){r.cartridge.position.x=narrow?2.25:.62;r.variantHit.position.x=r.cartridge.position.x;
          r.cartridge.scale.set(narrow?1.20:1,1,narrow?1.20:1);r.variantHit.scale.set(narrow?1.15:1,1,narrow?1.25:1);
          r.variantLabel.sprite.position.x=r.cartridge.position.x;r.variantLabel.sprite.scale.set(narrow?1.48:1.05,narrow?.43:.33,1);}
        r.lead.visible=!!r.heard?.installed&&!narrow;
      });
      camera.position.set(0,16,8.7);camera.lookAt(0,.0,narrow?1.47:.53);
      // Keep the disc diameter unchanged on phones; spend the extra height on
      // three broad physical reader rows, not on empty margins or tiny buttons.
      const half=Math.max(narrow?4.90:4.55,3.86/aspect);camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();camera.updateMatrixWorld();root.updateMatrixWorld(true);controls();
    },
    pickTargets:()=>picks,
    hit({object}){return{key:object.userData.key,kind:object.userData.kind,selectOnly:['phase','gain'].includes(object.userData.kind),draggable:['phase','gain'].includes(object.userData.kind)};},
    locations(){root.updateMatrixWorld(true);return rings.flatMap(r=>[
      {key:r.key,kind:'phase',draggable:true,selectOnly:true,point:point(.28,r.radius,.07)},
      {key:r.key,kind:'gain',draggable:true,selectOnly:true,point:r.gainHit.getWorldPosition(new T.Vector3())},
      {key:r.key,kind:'toggle',selectOnly:false,point:r.toggleHit.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.09,0))},
      ...(r.variantHit?[{key:r.key,kind:'variant',selectOnly:false,point:r.variantHit.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.12,0))}]:[])
    ]);},
    feedback(value){selected=value?.selected??model.selected;rings.forEach(r=>{r.selection.visible=r.key===selected;r.edge.visible=r.key===selected;});},
    animate(){sync();return Promise.resolve();},
    inputPlane(){
      if(dragging?.kind==='gain')return new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()).negate(),selectedRing().gainGrip.getWorldPosition(new T.Vector3()));
      return new T.Plane(new T.Vector3(0,1,0),-.07);
    },
    beginDrag(hit,world){
      if(!world||!['phase','gain'].includes(hit.kind))return false;
      const p=model.snapshot().parts.find(p=>p.key===hit.key);if(!p)return false;
      dragging={key:hit.key,kind:hit.kind,before:{...p},start:world.clone(),angle:Math.atan2(world.x,world.z),lastAngle:Math.atan2(world.x,world.z),delta:0,patch:{}};
      // Project the initial ray onto the grip plane so the very first drag
      // sample changes gain without jumping when the input plane switches.
      if(hit.kind==='gain'){const dir=camera.getWorldDirection(new T.Vector3()),plane=view.inputPlane(),t=-(plane.normal.dot(world)+plane.constant)/plane.normal.dot(dir);dragging.start=world.clone().addScaledVector(dir,t);}
      return true;
    },
    dragTo(world){
      if(!dragging||!world)return;const d=dragging;
      if(d.kind==='phase'){
        const angle=Math.atan2(world.x,world.z);d.delta+=Math.atan2(Math.sin(angle-d.lastAngle),Math.cos(angle-d.lastAngle));d.lastAngle=angle;
        d.patch={phase:wrap(d.before.phase+d.delta/TAU)};
      }else{
        if(!d.start){d.start=world.clone();return;}
        d.patch={gain:Math.round(Math.max(0,Math.min(2,d.before.gain+(world.y-d.start.y)*1.8))*100)/100};
      }
      controls();onEditPreview({key:d.key,patch:d.patch});
    },
    endDrag(cancelled){const d=dragging;dragging=null;onEditPreview(null);controls();return !cancelled&&d&&Object.keys(d.patch).length?{key:d.key,patch:d.patch}:null;},
    clock:tick,updateMusic:tick,
    ringPath(key,steps=64){const r=rings.find(r=>r.key===key);return r?Array.from({length:steps+1},(_,i)=>point(i/steps,r.radius,.07)):[];},
    targetBounds(width=viewport.width,height=viewport.height){
      root.updateMatrixWorld(true);const result=[];
      for(const r of rings)for(const [kind,o] of [['toggle',r.toggleHit],['gain',r.gainHit],['variant',r.variantHit]]){if(!o)continue;
        o.geometry.computeBoundingBox();const box=o.geometry.boundingBox,points=[];
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).applyMatrix4(o.matrixWorld).project(camera);points.push({x:(p.x+1)*width/2,y:(1-p.y)*height/2});}
        const xs=points.map(p=>p.x),ys=points.map(p=>p.y);result.push({key:r.key,kind,left:Math.min(...xs),top:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)});
      }return result;
    },
    inspect(){root.updateMatrixWorld(true);return{layout:narrow?'stacked-readers':'front-rail',targets:view.targetBounds(),selected,position:clock.position,periodBars:clock.periodBars,cycle:clock.position/(clock.periodBars||periodBars),playing:clock.playing,dragging:dragging?.kind||null,
      rings:rings.map(r=>({key:r.key,radius:r.radius,state:r.heard&&{...r.heard},rotation:r.group.rotation.y+master.rotation.y,reader:r.scanner.position.toArray(),active:r.light.visible,
        events:r.events.map(e=>{const p=e.mark.getWorldPosition(new T.Vector3());return{index:e.index,start:e.source.start,duration:e.source.duration,pitch:e.source.pitch,point:p.toArray(),angle:wrap(Math.atan2(p.x,p.z)/TAU)};})}))};},
    dispose(){disposed=true;dragging=null;}
  };
  renderHeard(model.snapshot());controls();return view;
}};
