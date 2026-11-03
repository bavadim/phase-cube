/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.BounceView={create({scene,resources,model,game,binding,tween,onEditPreview,onSelect}){
  const T=THREE,F=FourierModel,B=BounceTerrain,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-2.6,2.6,2.6,-2.6,.1,40);camera.position.set(0,0,12);camera.lookAt(0,0,0);
  const own=x=>resources.own(x),material=(color,extra={})=>resources.material(color,extra);
  const sphere=own(new T.SphereGeometry(1,24,16));
  function mesh(geometry,mat,parent=root){const m=new T.Mesh(geometry,mat);parent.add(m);return m;}
  function disc(r,color,z){const m=mesh(own(new T.CircleGeometry(r,96)),material(color));m.position.z=z;return m;}
  disc(2.19,0xd6ddca,-.28);disc(2.12,0xfaf5e7,-.25);disc(1.28,0xe8eddd,-.04);
  const trim=mesh(own(new T.TorusGeometry(2.12,.025,8,120)),material(0xb5c4a4));trim.position.z=-.16;
  // A quiet clock face: time runs clockwise from the notch at twelve o'clock.
  for(let i=0;i<16;i++){
    const p=B.point(i/16,2.04),tick=mesh(own(new T.BoxGeometry(i%4===0?.035:.018,i%4===0?.10:.045,.015)),material(i?0xa7b59a:0xb9753c));
    tick.position.set(p.x,p.y,-.15);tick.rotation.z=-i/16*Math.PI*2;
  }
  const segmentCount=384,positions=new Float32Array((segmentCount+1)*6),indices=[];
  for(let i=0;i<segmentCount;i++){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setIndex(indices);
  const road=mesh(geometry,material(game.voices[0].color,{side:T.DoubleSide}));
  const borderPositions=new Float32Array(segmentCount*3),borderGeometry=own(new T.BufferGeometry());borderGeometry.setAttribute('position',new T.BufferAttribute(borderPositions,3));
  const border=new T.LineLoop(borderGeometry,own(new T.LineBasicMaterial({color:0x304b40})));root.add(border);
  const padGeometry=own(new T.SphereGeometry(1,12,8)),targetGeometry=own(new T.TorusGeometry(.052,.012,6,20));
  const padMaterial=material(game.voices[0].color),gold=own(new T.MeshBasicMaterial({color:0xb7813d}));
  const beats=new T.Group(),targets=new T.Group();root.add(beats,targets);
  const pads=[],sockets=[];
  const maxEvents=Math.max(...game.targetRows.map((row,i)=>B.attacks(row,binding.periods[i]).length));
  for(let i=0;i<maxEvents;i++){pads.push(mesh(padGeometry,padMaterial,beats));sockets.push(mesh(targetGeometry,gold,targets));}
  const marble=new T.Group();root.add(marble);
  const body=mesh(sphere,material(0xfffdf0,{roughness:.22,metalness:.08}),marble);body.scale.setScalar(B.ballRadius);
  const stripe=mesh(own(new T.TorusGeometry(B.ballRadius*.94,.018,8,32)),material(0xdc7c44),marble);stripe.rotation.x=.7;
  const shine=mesh(sphere,own(new T.MeshBasicMaterial({color:0xffffff})),marble);shine.scale.set(.027,.018,.018);shine.position.set(-.027,.027,.082);
  const shadow=mesh(own(new T.CircleGeometry(.10,24)),own(new T.MeshBasicMaterial({color:0x263e33,transparent:true,opacity:.17,depthWrite:false})));shadow.scale.y=.48;
  const flash=mesh(own(new T.TorusGeometry(.12,.013,6,32)),gold);flash.visible=false;
  const trail=Array.from({length:5},(_,i)=>{const m=mesh(sphere,own(new T.MeshBasicMaterial({color:0xd9904e,transparent:true,opacity:.15-i*.023,depthWrite:false})));m.scale.setScalar(.045-i*.006);return m;});
  const pick=mesh(own(new T.RingGeometry(1.24,2.28,96)),own(new T.MeshBasicMaterial({visible:false,side:T.DoubleSide})));pick.position.z=.5;
  // Native-size buttons stay usable even when the musical circle gets small.
  const voices=document.createElement('div');voices.className='bounce-voices';voices.setAttribute('role','group');voices.setAttribute('aria-label','Партия на дорожке');
  const buttons=F.keys.map((key,i)=>{const b=document.createElement('button');b.type='button';b.textContent=i+1;b.style.setProperty('--voice-color',game.voices[i].color);b.title=game.voices[i].name;b.setAttribute('aria-label','Дорожка '+(i+1)+': '+game.voices[i].name);b.onclick=()=>onSelect({key,selectOnly:true});voices.append(b);return b;});
  document.getElementById('player-controls').prepend(voices);
  const caption=document.createElement('div');caption.className='bounce-center';caption.innerHTML='<span class="bounce-name"></span><strong></strong>';
  document.getElementById('puzzle-stage').append(caption);
  const instruction=document.createElement('div');instruction.className='bounce-instruction';instruction.textContent='Крутите дорожку. От центра — громче.';voices.before(instruction);
  let selected=0,feedback={},disabled=true,animating=false,dragging=null,committed=null,disposed=false,events=[],clock={phase:0,playing:false,periodSeconds:8};
  const base=game.targetRows.map((row,i)=>B.attacks(row,binding.periods[i]));
  const valuesAt=state=>model.parameters(state).map(p=>({phase:p.phase,gain:F.gain(p)}));
  let display=valuesAt(model.snapshot());
  function drawBall(){
    const p=display[selected],local=B.wrap(clock.phase/binding.periods[selected]),flight=B.flight(events,local,p.gain),point=B.point(local,flight.radius);
    marble.position.set(point.x,point.y,.19);marble.rotation.z=-local*Math.PI*8;
    const squish=clock.playing?flight.impact:0;marble.scale.set(1+squish*.16,1-squish*.18,1);
    const ground=B.point(local,B.surface(events,local,p.gain)+.055);shadow.position.set(ground.x,ground.y,.065);shadow.material.opacity=.17*(1-Math.min(.75,(flight.radius-B.radius)*.6));
    flash.visible=clock.playing&&flight.impact>.05&&p.gain>0;flash.position.set(point.x,point.y,.075);flash.scale.setScalar(1+(1-flight.impact)*1.2);
    trail.forEach((m,i)=>{m.visible=clock.playing;const t=B.wrap(local-(i+1)*.006),f=B.flight(events,t,p.gain),pt=B.point(t,f.radius);m.position.set(pt.x,pt.y,.10);});
  }
  function draw(values){
    display=values.map(p=>({...p}));const p=display[selected];events=B.shift(base[selected],p.phase-F.homePhase[selected]);
    road.material.color.set(game.voices[selected].color);padMaterial.color.set(game.voices[selected].color);
    for(let i=0;i<=segmentCount;i++){
      const t=i/segmentCount,inside=B.point(t,1.27),outside=B.point(t,B.surface(events,t,p.gain)),k=i*6;
      positions.set([inside.x,inside.y,0,outside.x,outside.y,0],k);
      if(i<segmentCount)borderPositions.set([outside.x,outside.y,.025],i*3);
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();borderGeometry.attributes.position.needsUpdate=true;borderGeometry.computeBoundingSphere();
    pads.forEach((m,i)=>{const e=events[i];m.visible=!!e;if(e){const pt=B.point(e.time,B.crest(e,p.gain));m.position.set(pt.x,pt.y,.055);m.scale.set(B.tokenWidth(e),.055,.045);m.rotation.z=-e.time*Math.PI*2;}});
    sockets.forEach((m,i)=>{const e=base[selected][i];m.visible=!!e;if(e){const pt=B.point(e.time,B.crest(e,1));m.position.set(pt.x,pt.y,.09);m.scale.set(B.tokenWidth(e)/.052*1.2,1.2,1);m.rotation.z=-e.time*Math.PI*2;}});
    const aligned=Math.abs(B.delta(F.homePhase[selected]/8,p.phase/8))<1e-7&&Math.abs(p.gain-1)<1e-7;
    caption.querySelector('.bounce-name').textContent=game.voices[selected].name;caption.querySelector('strong').textContent=Math.round(p.gain*100)+'%';caption.dataset.aligned=aligned;
    buttons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===selected));b.disabled=disabled;});drawBall();
  }
  function sync(){if(!animating&&!dragging&&!committed&&!disposed)draw(valuesAt(model.snapshot()));}
  const view={camera,hoverActions:false,requiresSelection:false,sync,
    dispose(){disposed=true;voices.remove();instruction.remove();caption.remove();},
    resize(aspect){const extent=Math.max(2.56,2.56/aspect);camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.updateMatrixWorld();},
    pickTargets:()=>[pick],hit:()=>({key:F.keys[selected],pieceId:selected,kind:'terrain',draggable:true,selectOnly:true}),
    locations(){return[{key:F.keys[selected],pieceId:selected,kind:'terrain',draggable:true,selectOnly:true,point:new T.Vector3(0,1.68,.5)}];},
    feedback(value){feedback=value;disabled=document.getElementById('puzzle-stage').getAttribute('aria-disabled')==='true';const index=F.keys.indexOf(value.selected);if(index>=0&&index!==selected){selected=index;draw(display);}buttons.forEach((b,i)=>{b.disabled=disabled;b.setAttribute('aria-pressed',String(i===selected));});},
    updateMusic(value){const changed=clock.playing!==value.playing||clock.phase!==value.phase;clock=value;drawBall();return value.playing||changed;},
    beginDrag(hit,world){
      if(animating||!world)return false;const p=valuesAt(model.snapshot())[selected];dragging={key:hit.key,index:selected,before:model.snapshot(),start:world.clone(),previous:B.angle(world),angle:0,phase:p.phase,gain:p.gain,mode:null,move:null};committed=null;return true;
    },
    dragTo(world){
      if(!dragging||!world)return;const d=dragging,a=B.angle(world);d.angle+=B.delta(d.previous,a);d.previous=a;
      const dr=Math.hypot(world.x,world.y)-Math.hypot(d.start.x,d.start.y);
      if(!d.mode)d.mode=Math.abs(d.angle*Math.PI*2*1.7)>Math.abs(dr)*.8?'phase':'gain';
      const phase=d.mode==='phase'?d.phase-d.angle*8:d.phase;
      let gain=d.mode==='gain'?Math.max(0,Math.min(2,d.gain+dr/.9)):d.gain;if(Math.abs(gain-1)<.03)gain=1;gain=Math.round(gain*1e6)/1e6;
      const values=valuesAt(d.before);values[d.index]={phase,gain};draw(values);
      d.move=model.editMove(d.key,{phase:Math.round(phase),level:gain*4},d.before);onEditPreview(d.move,{key:d.key,phase,gain});
    },
    endDrag(cancelled){if(!dragging)return null;const d=dragging;dragging=null;onEditPreview(null);if(!cancelled&&d.move&&model.validMove(d.move)){committed=JSON.stringify(d.move);return d.move;}sync();return null;},
    async animate(move,before,{duration=360}={}){
      const direct=committed===JSON.stringify(move);committed=null;animating=true;
      const index=F.keys.indexOf(model.moveTarget(move));selected=index;
      const a=direct?display.map(p=>({...p})):valuesAt(before),b=valuesAt(model.applyTo(before,move));let delta=B.delta(a[index].phase/8,b[index].phase/8)*8;
      if(!direct&&typeof move==='string'&&move.endsWith("'"))delta=1;if(!direct&&typeof move==='string'&&move.length===1)delta=-1;
      try{await tween('move',direct?140:duration,t=>draw(a.map((p,i)=>i!==index?p:{phase:p.phase+delta*t,gain:p.gain+(b[i].gain-p.gain)*t})));}finally{animating=false;sync();}
    },
    inspect(){const p=display[selected],time=B.wrap(clock.phase/binding.periods[selected]);return{selected,events,period:binding.periods[selected],clock,display,flight:B.flight(events,time,p.gain)};}
  };
  sync();return view;
}};
BouncePuzzle.mount=context=>PuzzleControl.mount({...context,module:BouncePuzzle,createView:BounceView.create});
