/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Six rotary lifts and seven fixed bridges. All input uses the shared stage. */
window.FourierView={create({scene,resources,model,game,tween,onEditPreview}){
  const T=THREE,F=FourierModel,M=FourierMaze,own=x=>resources.own(x),root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-2.7,2.7,2.7,-2.7,.1,50);camera.position.set(0,10,8);camera.lookAt(0,.55,0);camera.updateMatrixWorld();
  const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
  const box=own(new T.BoxGeometry(1,1,1)),cylinder=own(new T.CylinderGeometry(1,1,1,32)),sphere=own(new T.SphereGeometry(1,16,12)),materials=new Map();
  const mat=(color,extra={})=>{const k=JSON.stringify([color,extra]);if(!materials.has(k))materials.set(k,resources.material(color,extra));return materials.get(k);};
  function mesh(parent,geometry,material,position=[0,0,0],scale=[1,1,1]){const m=new T.Mesh(geometry,material);m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;}
  const block=(p,c,position,scale)=>mesh(p,box,mat(c),position,scale);
  const round=(p,c,position,scale)=>mesh(p,cylinder,mat(c),position,scale);
  const ball=(p,c,position,r)=>mesh(p,sphere,mat(c),position,[r,r,r]);
  const vec=p=>new T.Vector3(p.x,p.y,p.z),road=0xfff5dd,stone=0xcbd4c2,brass=0xba9261,ink=0x405f52;
  block(root,stone,[0,-.13,0],[5.18,.22,3.55]);block(root,0xe7dfc7,[0,-.005,0],[5.03,.045,3.40]);
  // Fixed landings have square supports; colored octagons are the moving lifts.
  const fixed=new T.Group();root.add(fixed);
  function bridge(a,b){
    const dx=b.x-a.x,dz=b.z-a.z,n=Math.hypot(dx,dz),px=-dz/n*.12,pz=dx/n*.12;
    const points=[a,b].flatMap(p=>[[p.x+px,p.y,p.z+pz],[p.x-px,p.y,p.z-pz],[p.x+px,p.y-.09,p.z+pz],[p.x-px,p.y-.09,p.z-pz]]).flat();
    const geometry=own(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
    geometry.setIndex([0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5,0,2,1,1,2,3,4,5,6,5,7,6]);geometry.computeVertexNormals();
    mesh(fixed,geometry,mat(road,{side:T.DoubleSide}));
    for(const d of [-1,1])fixed.add(resources.stroke([[a.x+px*d,a.y+.045,a.z+pz*d],[b.x+px*d,b.y+.045,b.z+pz*d]],{color:brass,radius:.015}));
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};
    block(fixed,0xc1cbb8,[mid.x,(mid.y-.10)/2,mid.z],[.20,mid.y-.10,.20]);
    const landing=block(fixed,stone,[mid.x,mid.y-.06,mid.z],[.38,.09,.38]);landing.rotation.y=Math.atan2(dx,dz);
  }
  M.fixedLinks.forEach(({from,to})=>bridge(from,to));
  function gate(p,color,exit=false){
    round(fixed,0xaebbab,[p.x,p.y-.07,p.z],[.23,.12,.23]);
    for(const dz of [-.16,.16])block(fixed,color,[p.x,p.y+.21,p.z+dz],[.055,.42,.055]);
    const arch=mesh(fixed,own(new T.TorusGeometry(.16,.03,6,20,Math.PI)),mat(color),[p.x,p.y+.42,p.z]);arch.rotation.y=Math.PI/2;
    const flag=block(fixed,color,[p.x,p.y+.55,p.z],[.045,.16,.20]);if(exit)flag.material=mat(0xc49c56,{emissive:0x8b682c,emissiveIntensity:.1});
  }
  gate(M.start,0x4b8973);gate(M.finish,brass,true);
  const lifts=M.nodes.map((n,i)=>{
    const group=new T.Group();group.position.set(n.x,0,n.z);root.add(group);
    round(group,0xb9c7b1,[0,.035,0],[.31,.07,.31]);round(group,0xe8dfc7,[0,.079,0],[.26,.025,.26]);
    const post=round(group,brass,[0,n.height/2,0],[.10,n.height,.10]);post.userData={index:i,kind:'lift'};
    const lift=new T.Group(),rotor=new T.Group();group.add(lift);lift.add(rotor);
    const color=new T.Color(game.voices[i].color),bodyMaterial=resources.material(color,{emissive:color,emissiveIntensity:0});
    const body=mesh(rotor,own(new T.CylinderGeometry(.52,.49,.14,8)),bodyMaterial,[0,-.07,0]);body.userData={index:i,kind:'platform'};
    round(rotor,0xe7dfc8,[0,-.155,0],[.35,.035,.35]);
    for(const direction of [n.in,n.out]){
      const [x,z]=direction,a=Math.atan2(x,z),floor=block(rotor,road,[x*M.radius/2,.015,z*M.radius/2],[.23,.03,M.radius]);floor.rotation.y=a;
      const side=[-z,x];
      for(const d of [-1,1]){const rail=block(rotor,brass,[x*.34+side[0]*.13*d,.05,z*.34+side[1]*.13*d],[.025,.07,.34]);rail.rotation.y=a;}
    }
    round(rotor,road,[0,.018,0],[.14,.035,.14]);
    // Eight tiny rivets make the angular detents visible on the object.
    for(let j=0;j<8;j++){const a=j*Math.PI/4;ball(rotor,0xe9dbb9,[Math.cos(a)*.43,.015,Math.sin(a)*.43],.025);}
    const outline=mesh(lift,own(new T.TorusGeometry(.56,.025,5,8)),mat(brass,{emissive:brass,emissiveIntensity:.15}),[0,-.018,0]);outline.rotation.x=-Math.PI/2;outline.visible=false;
    const seams=['in','out'].map(side=>{
      const p=M.port(i,side),direction=n[side],cap=block(fixed,0xe7dfc7,[p.x,p.y+.018,p.z],[.24,.035,.05]);cap.rotation.y=Math.atan2(direction[0],direction[1]);
      // The line belongs to the real fixed bridge, never to a ghost preview.
      cap.material=resources.material(0xc17c66);return cap;
    });
    const pickParts=[post,...rotor.children.filter(o=>o.isMesh)];
    pickParts.forEach(part=>{part.userData={index:i,kind:part===post?'lift':'platform'};});
    return{key:F.keys[i],index:i,group,post,lift,rotor,body,bodyMaterial,outline,seams,pickParts,phase:F.homePhase[i],gain:1,reaction:0};
  });
  // A warm light travels along the connected route and waits at the first gap.
  const traveller=ball(root,0x285e4c,[M.start.x,M.start.y+.09,M.start.z],.075);traveller.material=mat(0x285e4c,{emissive:0x4a8760,emissiveIntensity:.25});
  ball(traveller,0xfff5dd,[-.022,.035,.045],.02);
  let feedback={selected:null,focus:null},dragging=null,animating=false,committed=null,disposed=false,clock={phase:0,playing:false,rows:[],periodSeconds:8};
  const valuesAt=state=>model.parameters(state).map(p=>({phase:p.phase,gain:F.gain(p)}));let display=valuesAt(model.snapshot()),maze=null,path=[],lengths=[],total=0;
  const routeLength=route=>route.slice(1).reduce((sum,p,i)=>sum+vec(p).distanceTo(vec(route[i])),0),fullLength=routeLength(M.analyze(F.keys.map(()=>({phase:0,gain:1}))).route);
  function walk(){
    if(!path.length)return;let d=Math.min(clock.phase*fullLength,Math.max(0,total-.015)),index=1;
    while(index<lengths.length&&d>lengths[index])index++;
    if(index>=path.length)index=path.length-1;
    const start=lengths[index-1]||0,span=(lengths[index]||0)-start,t=span>0?Math.max(0,Math.min(1,(d-start)/span)):0;
    traveller.position.copy(path[index-1]).lerp(path[index],t);traveller.position.y+=.09;
  }
  function draw(values){
    display=values.map(p=>({...p}));maze=M.analyze(display.map((p,i)=>({phase:p.phase-F.homePhase[i],gain:p.gain})));
    lifts.forEach((p,i)=>{
      p.phase=display[i].phase;p.gain=display[i].gain;const h=M.height(i,p.gain);
      p.lift.position.y=h;p.rotor.rotation.y=(p.phase-F.homePhase[i])*Math.PI/4;
      p.post.position.y=(h-.12)/2;p.post.scale.y=Math.max(.03,h-.12);
      p.outline.visible=p.key===feedback.selected;
      p.seams.forEach((cap,j)=>cap.material.color.set(maze.joints[i].contacts[j]>=0?0x83a68a:0xc17c66));
    });
    path=maze.route.map(vec);lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+path[i].distanceTo(path[i-1]));total=lengths.at(-1);walk();
  }
  const plane=()=>{const i=Math.max(0,F.keys.indexOf(feedback.selected)),n=M.nodes[i];return new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),new T.Vector3(n.x,M.height(i,valuesAt(model.snapshot())[i].gain),n.z));};
  function sync(){if(!animating&&!dragging&&!committed&&!disposed)draw(valuesAt(model.snapshot()));}
  const view={camera,sync,
    dispose(){disposed=true;dragging=null;},
    resize(aspect){const extent=Math.max(2.65,2.65/aspect);camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.updateMatrixWorld();},
    inputPlane:()=>dragging?.plane||plane(),
    pickTargets:()=>lifts.flatMap(p=>p.pickParts),
    hit({object}){const i=object.userData.index;return{key:F.keys[i],pieceId:i,kind:object.userData.kind,draggable:true,selectOnly:true};},
    locations(){root.updateMatrixWorld(true);return lifts.map(p=>({key:p.key,pieceId:p.index,kind:'platform',draggable:true,selectOnly:true,point:p.body.localToWorld(new T.Vector3(0,.075,0))}));},
    feedback(value){feedback=value;lifts.forEach(p=>{p.outline.visible=p.key===value.selected;});},
    updateMusic(value){
      clock=value;walk();lifts.forEach((p,i)=>{
        let hit=0;if(value.playing&&!dragging&&!animating)for(const e of value.rows[i]||[]){const age=(((value.phase-e.start)%1+1)%1)*value.periodSeconds;if(age<.12)hit=Math.max(hit,(1-age/.12)*Math.min(1,(e.volume??1)*(e.value.velocity??1)));}
        p.bodyMaterial.emissiveIntensity=(p.key===feedback.selected ? .12 : 0)+hit*.18;
      });return value.playing;
    },
    beginDrag(hit,world){
      if(animating||!world)return false;const index=F.keys.indexOf(hit.key),p=valuesAt(model.snapshot())[index];
      dragging={key:hit.key,index,before:model.snapshot(),start:world.clone(),plane:plane(),mode:hit.kind==='lift'?'gain':null,phase:p.phase,gain:p.gain,move:null};committed=null;return true;
    },
    dragTo(world){
      if(!dragging||!world)return;const d=dragging,delta=world.clone().sub(d.start),dx=delta.dot(right),dy=delta.dot(up);
      if(!d.mode)d.mode=Math.abs(dx)>Math.abs(dy)*.85?'phase':'gain';
      const phase=d.mode==='phase'?d.phase-dx*8/2.2:d.phase,gain=d.mode==='gain'?M.snapGain(d.gain+dy/M.liftRange):d.gain,values=valuesAt(d.before);
      values[d.index]={phase,gain};draw(values);d.move=model.editPoint(d.key,{phase,gain},d.before);onEditPreview(d.move,{key:d.key,phase,gain});
    },
    endDrag(cancelled){
      if(!dragging)return null;const d=dragging;dragging=null;const move=!cancelled&&d.move&&model.validMove(d.move)?d.move:null;
      committed=move?JSON.stringify(move):null;draw(valuesAt(move?model.applyTo(d.before,move):d.before));onEditPreview(null);if(!move)sync();return move;
    },
    async animate(move,before,{duration=360}={}){
      const direct=committed===JSON.stringify(move);committed=null;animating=true;
      const a=display.map(p=>({...p})),b=valuesAt(model.applyTo(before,move)),index=F.keys.indexOf(model.moveTarget(move));let delta=((b[index].phase-a[index].phase+4)%8+8)%8-4;
      if(!direct&&typeof move==='string'&&move.endsWith("'"))delta=1;if(!direct&&typeof move==='string'&&move.length===1)delta=-1;
      try{if(direct)draw(b);else await tween('move',duration,t=>draw(a.map((p,i)=>i!==index?p:{phase:p.phase+delta*t,gain:p.gain+(b[i].gain-p.gain)*t})));}finally{animating=false;sync();}
    },
    inspect(){root.updateMatrixWorld(true);return{kind:'rotary-lift-maze',selected:feedback.selected,dragging:dragging?.mode??null,display,passable:maze.passable,completed:maze.completed,correct:maze.correct,blocked:maze.blocked,
      fixedLinks:M.fixedLinks,lifts:lifts.map((p,i)=>({key:p.key,phase:p.phase,gain:p.gain,height:p.lift.position.y,rotation:p.rotor.rotation.y,
        ports:['in','out'].map(side=>p.rotor.localToWorld(new T.Vector3(M.nodes[i][side][0]*M.radius,0,M.nodes[i][side][1]*M.radius)).toArray()),contacts:maze.joints[i].contacts,errors:maze.joints[i].errors})),traveller:traveller.position.toArray()};}
  };
  sync();return view;
}};
