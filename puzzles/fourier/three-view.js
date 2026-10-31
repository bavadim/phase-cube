/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One polar chart. Views preview edits; only the shared dispatcher commits them. */
window.FourierView={create({scene,resources,model,tween,onEditPreview}){
  const T=THREE,F=FourierModel,theme=PuzzleGraphics.theme,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-1.9,1.9,1.9,-1.9,.1,100);camera.position.z=6;camera.lookAt(0,0,0);
  const scale=1.15/.6,colors=[0x32746b,0xba703e,0x646ca1,0xa64f70],steps=40;
  function line(count,color,{dashed=false,opacity=1}={}){
    const g=resources.own(new T.BufferGeometry());g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));
    const m=resources.own(dashed?new T.LineDashedMaterial({color,dashSize:.045,gapSize:.035,transparent:true,opacity}):new T.LineBasicMaterial({color,transparent:true,opacity}));
    const mesh=new T.Line(g,m);root.add(mesh);return mesh;
  }
  function plot(mesh,points,z=0){
    points.forEach((p,i)=>mesh.geometry.attributes.position.setXYZ(i,p[0],p[1],z));
    mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeBoundingSphere();mesh.computeLineDistances();
  }
  for(const radius of F.levels){const mesh=line(81,0xc4cfbb);plot(mesh,Array.from({length:81},(_,i)=>[radius*scale*Math.cos(i*Math.PI/40),radius*scale*Math.sin(i*Math.PI/40)]),-.03);}
  plot(line(2,0xc4cfbb),[[-1.25,0],[1.25,0]],-.025);plot(line(2,0xc4cfbb),[[0,-1.25],[0,1.25]],-.025);
  const targetLine=line(2,theme.ink,{dashed:true,opacity:.45}),trail=line(steps+1,theme.accent,{dashed:true,opacity:.7});
  const dotGeometry=resources.own(new T.CircleGeometry(.12,40)),haloGeometry=resources.own(new T.RingGeometry(.155,.18,40));
  const hitGeometry=resources.own(new T.CircleGeometry(1,40)),hitMaterial=resources.own(new T.MeshBasicMaterial({visible:false}));
  const headGeometry=resources.own(new T.ConeGeometry(.055,.15,8));
  function text(number,color){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#ffffff';ctx.font='700 78px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(number,64,66);
    const map=resources.own(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;
    return new T.Mesh(resources.own(new T.PlaneGeometry(.27,.27)),resources.own(new T.MeshBasicMaterial({map,color,transparent:true,depthWrite:false})));
  }
  const target=new T.Mesh(resources.own(new T.RingGeometry(.14,.16,48)),resources.own(new T.MeshBasicMaterial({color:theme.ink})));root.add(target);
  const points=model.choices().map((choice,i)=>{
    const group=new T.Group(),marker=new T.Group(),legend=new T.Group();root.add(group,legend);
    const material=resources.own(new T.MeshBasicMaterial({color:colors[i]}));
    marker.add(new T.Mesh(dotGeometry,material));const label=text(i+1,0xffffff);label.position.z=.02;marker.add(label);group.add(marker);
    const halo=new T.Mesh(haloGeometry,resources.own(new T.MeshBasicMaterial({color:theme.accent})));halo.position.z=.01;group.add(halo);
    const hit=new T.Mesh(hitGeometry,hitMaterial);hit.position.z=.08;group.add(hit);
    const legendLabel=text(i+1,colors[i]);legend.add(legendLabel);const legendHalo=new T.Mesh(haloGeometry,resources.own(new T.MeshBasicMaterial({color:theme.accent})));legend.add(legendHalo);
    const legendHit=new T.Mesh(hitGeometry,hitMaterial);legend.add(legendHit);
    const shaft=line(2,colors[i]),head=new T.Mesh(headGeometry,material);root.add(head);
    return{key:choice.key,index:i,group,marker,halo,hit,legend,legendLabel,legendHalo,legendHit,shaft,head};
  });
  let feedback={selected:model.selected,move:null},hover=null,animating=false,disposed=false,dragging=null,committed=null;
  let animationFrom=null,animationMove=null,display=model.coefficients(),previewKey=null;
  function refresh(){
    const selected=F.keys.indexOf(feedback.selected);
    for(const p of points){
      const active=p.index===selected;p.halo.visible=p.legendHalo.visible=active;
      p.shaft.material.opacity=active?1:.55;
      const z=display[p.index],v=new T.Vector3(z[0]*scale,z[1]*scale,0),direction=v.clone().normalize();
      p.group.position.set(v.x,v.y,.12);plot(p.shaft,[[0,0],[v.x,v.y]],.02);
      p.head.position.copy(v.addScaledVector(direction,-.15));p.head.position.z=.03;
      p.head.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);
    }
    const goal=F.reference[selected].map(v=>v*scale);target.position.set(...goal,.07);plot(targetLine,[[0,0],goal],.01);
    const move=animating?animationMove:feedback.move,from=animating?animationFrom:model.snapshot(),key=move?JSON.stringify([from,move]):null;
    trail.visible=!!move&&!dragging&&model.validMove(move,from);
    if(trail.visible&&key!==previewKey){
      const id=F.keys.indexOf(model.moveTarget(move));
      plot(trail,Array.from({length:steps+1},(_,k)=>F.interpolate(from,move,k/steps)[id].map(v=>v*scale)),.04);
    }
    previewKey=key;
  }
  function draw(values){display=values;refresh();}
  function sync(){if(!animating&&!dragging&&!disposed)draw(model.coefficients());}
  const view={
    camera,sync,dispose(){disposed=true;dragging=null;},
    resize(aspect,width,height){
      camera.left=-1.9*aspect;camera.right=1.9*aspect;
      const unit=Math.max(1,14*3.8/(height*.12)),hit=Math.max(.22,23*3.8/height),edge=1.9-hit-.06;
      points.forEach((p,i)=>{
        p.marker.scale.setScalar(unit);p.halo.scale.setScalar(unit);p.hit.scale.setScalar(hit);
        p.legendLabel.scale.setScalar(unit);p.legendHalo.scale.setScalar(unit);p.legendHit.scale.setScalar(hit);
        p.legend.position.set((i%2?1:-1)*edge,(i<2?1:-1)*edge,.15);
      });target.scale.setScalar(unit);
    },
    pickTargets:()=>points.flatMap(p=>[p.hit,p.legendHit]),
    hit(intersection){
      const at=root.worldToLocal(intersection.point.clone()),targets=points.flatMap(p=>[{p,kind:'point',group:p.group},{p,kind:'coefficient-label',group:p.legend}]);
      targets.sort((a,b)=>a.group.position.distanceToSquared(at)-b.group.position.distanceToSquared(at));
      // Coincident tips retain the selected coefficient. The fixed numbered
      // labels in the same Three model can always select each hidden vector.
      const first=targets[0],selected=targets.find(t=>t.p.key===model.selected&&t.kind===first.kind&&Math.abs(t.group.position.distanceToSquared(at)-first.group.position.distanceToSquared(at))<1e-5),chosen=selected||first;
      return{key:chosen.p.key,pieceId:chosen.p.index,selectOnly:true,kind:chosen.kind,draggable:chosen.kind==='point'};
    },
    locations(){root.updateMatrixWorld(true);return points.flatMap(p=>[[p.group,p.hit,'point'],[p.legend,p.legendHit,'coefficient-label']].map(([group,hit,kind])=>({key:p.key,kind,selectOnly:true,draggable:kind==='point',pieceId:p.index,
      point:group.getWorldPosition(new T.Vector3()),region:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>hit.localToWorld(new T.Vector3(x,y,0)))})));},
    feedback(value){feedback=value;refresh();},hover(hit){hover=hit?.key||null;},
    beginDrag(hit){
      if(!hit.draggable||animating)return false;
      dragging={key:hit.key,before:model.snapshot(),move:null};committed=null;return true;
    },
    dragTo(world){
      if(!dragging||!world)return;
      const p=root.worldToLocal(world.clone()),i=F.keys.indexOf(dragging.key),length=Math.hypot(p.x,p.y);
      const previous=display[i],angle=length>1e-6?Math.atan2(p.y,p.x):Math.atan2(previous[1],previous[0]),radius=Math.max(.2,Math.min(.6,length/scale));
      const z=[radius*Math.cos(angle),radius*Math.sin(angle)],values=model.coefficients(dragging.before);values[i]=z;draw(values);
      const move=model.editMove(dragging.key,model.snap(z),dragging.before);
      if(JSON.stringify(move)!==JSON.stringify(dragging.move)){dragging.move=move;onEditPreview(move);}
    },
    endDrag(cancelled){
      if(!dragging)return null;const old=dragging;dragging=null;onEditPreview(null);
      if(!cancelled&&old.move&&model.validMove(old.move)){
        committed=JSON.stringify(old.move);draw(model.coefficients(model.applyTo(old.before,old.move)));return old.move;
      }
      sync();return null;
    },
    async animate(move,before,{duration=360}={}){
      if(committed===JSON.stringify(move)){committed=null;draw(model.coefficients(model.applyTo(before,move)));return;}
      animating=true;animationFrom=before;animationMove=move;
      try{await tween('move',duration,t=>draw(F.interpolate(before,move,t)));}
      finally{animating=false;animationFrom=null;animationMove=null;sync();}
    }
  };
  sync();return view;
}};
FourierPuzzle.mount=context=>PuzzleControl.mount({...context,module:FourierPuzzle,createView:FourierView.create});
