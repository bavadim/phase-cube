/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Fourier control surface: one hoop, three selectable modes, shared input/tweens. */
window.ScratchView={create({scene,resources,model,game,binding,tween,onEditPreview}){
  const T=THREE,F=ScratchModel,theme=PuzzleGraphics.theme,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-2,2,2,-2,.1,100);camera.position.z=6;camera.lookAt(0,0,0);
  const color=game.voices[binding.activeFragments[0]].color,center=new T.Vector3(0,.27,0),unit=.72,N=192;
  const material=(color,opacity=1)=>resources.own(new T.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:T.DoubleSide}));
  const makeLine=(count,color,opacity=1)=>{
    const geometry=resources.own(new T.BufferGeometry());geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));
    const mesh=new T.Line(geometry,resources.own(new T.LineBasicMaterial({color,transparent:true,opacity})));root.add(mesh);return mesh;
  };
  function plot(line,points,z=0){points.forEach((p,i)=>line.geometry.attributes.position.setXYZ(i,p[0],p[1],z));line.geometry.attributes.position.needsUpdate=true;line.geometry.computeBoundingSphere();}
  const polar=(radius,t)=>[center.x+Math.sin(t)*radius,center.y+Math.cos(t)*radius];
  const goal=makeLine(97,theme.ink,.5);plot(goal,Array.from({length:97},(_,i)=>polar(unit,2*Math.PI*i/96)),.01);
  const outer=makeLine(97,0xc4cfbb,.6);plot(outer,Array.from({length:97},(_,i)=>polar(unit*1.85,2*Math.PI*i/96)),-.02);
  for(let j=0;j<16;j++){const t=2*Math.PI*j/16;plot(makeLine(2,theme.ink,j%4?.22:.65),[polar(unit-.025,t),polar(unit+(j%4?.025:.075),t)],.02);}
  const ribbonGeometry=resources.own(new T.BufferGeometry());ribbonGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(N*6*3),3));
  const ribbon=new T.Mesh(ribbonGeometry,material(color));root.add(ribbon);
  const hitMaterial=resources.own(new T.MeshBasicMaterial({visible:false})),fieldHit=new T.Mesh(resources.own(new T.CircleGeometry(1.4,80)),hitMaterial);fieldHit.position.copy(center);fieldHit.position.z=-.06;root.add(fieldHit);
  const times=[...new Set(binding.activeFragments.flatMap(id=>game.targetRows[id].map(e=>e.start)))].sort((a,b)=>a-b).slice(0,96);
  const dotGeometry=resources.own(new T.CircleGeometry(.028,16)),dots=times.map(t=>{const mesh=new T.Mesh(dotGeometry,material(color));root.add(mesh);return{t,mesh};});
  function number(n){
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.font='600 80px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n,64,66);
    const map=resources.own(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;
    return new T.Mesh(resources.own(new T.PlaneGeometry(.23,.23)),resources.own(new T.MeshBasicMaterial({map,color:theme.ink,transparent:true,depthWrite:false})));
  }
  const diskGeometry=resources.own(new T.CircleGeometry(.075,24)),hitGeometry=resources.own(new T.CircleGeometry(1,32));
  const controls=F.keys.map((key,i)=>{
    const group=new T.Group();group.position.set((i-1)*1.04,-1.43,.08);root.add(group);
    const ring=new T.Mesh(resources.own(new T.RingGeometry(.27,.28,48)),material(theme.ink,.4));group.add(ring);
    const halo=new T.Mesh(resources.own(new T.RingGeometry(.31,.325,48)),material(theme.accent));group.add(halo);
    const label=number(i+1);label.position.set(0,-.46,.02);group.add(label);
    const legendHit=new T.Mesh(hitGeometry,hitMaterial);legendHit.position.copy(label.position);legendHit.position.z=.1;group.add(legendHit);
    const handle=new T.Group();group.add(handle);handle.add(new T.Mesh(diskGeometry,material(color)));
    const hit=new T.Mesh(hitGeometry,hitMaterial);hit.position.z=.1;handle.add(hit);
    const shaft=makeLine(2,color,.8),wave=makeLine(41,color,.5);
    return{key,index:i,group,handle,hit,legendHit,halo,label,shaft,wave};
  });
  let display=model.coefficients(),feedback={selected:null,move:null},animating=false,dragging=null,committed=null,disposed=false;
  function draw(c){
    display=c;
    const points=Array.from({length:N+1},(_,j)=>{const f=F.field(c,j/N);return{r:f.gain*unit,t:f.time*2*Math.PI};}),position=ribbonGeometry.attributes.position;
    for(let j=0;j<N;j++){
      const a=points[j],b=points[j+1],vertices=[[a,-1],[a,1],[b,1],[a,-1],[b,1],[b,-1]];
      vertices.forEach(([p,side],k)=>{const xy=polar(p.r+side*.012,p.t);position.setXYZ(j*6+k,...xy,.04);});
    }
    position.needsUpdate=true;ribbonGeometry.computeBoundingSphere();
    dots.forEach(({t,mesh})=>{const f=F.field(c,t);mesh.position.set(...polar(f.gain*unit,f.time*2*Math.PI),.07);});
    for(const p of controls){
      // These handles edit phase only. A fixed radius keeps small-amplitude
      // modes reachable by a finger; wave height still shows the amplitude.
      const z=c[p.index],radius=.25/Math.max(.08,Math.hypot(...z)),x=z[0]*radius,y=z[1]*radius;
      p.handle.position.set(x,y,.04);const gx=p.group.position.x,gy=p.group.position.y;
      plot(p.shaft,[[gx,gy],[gx+x,gy+y]],.1);
      const phase=Math.atan2(z[1],z[0]),amplitude=Math.hypot(...z);
      plot(p.wave,Array.from({length:41},(_,j)=>[gx+(j/40-.5)*.38,gy+Math.cos(j/40*Math.PI*2*(p.index+1)+phase)*amplitude*.1]),.09);
      p.halo.visible=feedback.selected===p.key||feedback.move===p.key+'x'||feedback.move===F.keys[(p.index+2)%3]+'x';
    }
  }
  function sync(){if(!disposed&&!animating&&!dragging)draw(model.coefficients());}
  const view={
    camera,hoverActions:false,requiresSelection:true,selectionPrompt:'Выберите волну 1, 2 или 3',sync,
    dispose(){disposed=true;dragging=null;},
    resize(aspect,width,height){
      const extent=Math.max(2.02,1.62/aspect);camera.top=extent;camera.bottom=-extent;camera.left=-extent*aspect;camera.right=extent*aspect;
      const hit=Math.max(.13,24*2*extent/height),labelScale=Math.max(1,14*2*extent/(height*.23));
      controls.forEach(p=>{p.hit.scale.setScalar(hit);p.legendHit.scale.setScalar(hit);p.label.scale.setScalar(labelScale);});
    },
    pickTargets:()=>[...controls.flatMap(p=>[p.hit,p.legendHit]),fieldHit],
    hit(intersection){
      if(intersection.object===fieldHit)return{key:model.selected,pieceId:F.keys.indexOf(model.selected),kind:'hoop',actionCenter:center.clone()};
      const p=controls.find(p=>p.hit===intersection.object||p.legendHit===intersection.object),draggable=intersection.object===p.hit;
      return{key:p.key,pieceId:p.index,kind:draggable?'point':'coefficient-label',selectOnly:true,draggable};
    },
    locations(){root.updateMatrixWorld(true);return controls.flatMap(p=>[[p.handle,p.hit,'point'],[p.legendHit,p.legendHit,'coefficient-label']].map(([object,hit,kind])=>({key:p.key,pieceId:p.index,kind,selectOnly:true,draggable:kind==='point',point:object.getWorldPosition(new T.Vector3()),
      region:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>hit.localToWorld(new T.Vector3(x,y,0)))})));},
    feedback(value){feedback=value;draw(display);},
    beginDrag(hit,world){
      if(!hit.draggable||animating||!world)return false;
      const i=F.keys.indexOf(hit.key),local=root.worldToLocal(world.clone()),origin=controls[i].group.position;
      dragging={key:hit.key,index:i,before:model.snapshot(),phase:model.parameters()[i].phase,angle:Math.atan2(local.y-origin.y,local.x-origin.x),move:null};committed=null;return true;
    },
    dragTo(world){
      if(!dragging||!world)return;
      const local=root.worldToLocal(world.clone()),origin=controls[dragging.index].group.position;
      if(Math.hypot(local.x-origin.x,local.y-origin.y)<.035)return;
      const angle=Math.atan2(local.y-origin.y,local.x-origin.x),delta=Math.atan2(Math.sin(angle-dragging.angle),Math.cos(angle-dragging.angle));
      dragging.angle=angle;dragging.phase+=delta/(Math.PI/2);
      const c=model.coefficients(dragging.before),i=dragging.index,amplitude=Math.hypot(...c[i]),phase=dragging.phase*Math.PI/2;
      c[i]=[amplitude*Math.cos(phase),amplitude*Math.sin(phase)];draw(c);
      dragging.move=model.editMove(dragging.key,dragging.phase,dragging.before);
      onEditPreview(dragging.move,{kind:'scratch-phase',key:dragging.key,phase:dragging.phase});
    },
    endDrag(cancelled){
      if(!dragging)return null;const old=dragging;dragging=null;onEditPreview(null);
      if(!cancelled&&old.move&&model.validMove(old.move)){committed=JSON.stringify(old.move);draw(model.coefficients(model.applyTo(old.before,old.move)));return old.move;}
      sync();return null;
    },
    async animate(move,before,{duration=420}={}){
      if(committed===JSON.stringify(move)){committed=null;draw(model.coefficients(model.applyTo(before,move)));return;}
      animating=true;
      try{await tween('move',duration,t=>draw(F.interpolate(before,move,t)));}
      finally{animating=false;sync();}
    }
  };
  draw(display);return view;
}};
ScratchPuzzle.mount=context=>PuzzleControl.mount({...context,module:ScratchPuzzle,createView:ScratchView.create});
