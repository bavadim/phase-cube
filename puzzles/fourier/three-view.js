/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Four complex coefficients as selectable points; operations live in the dock. */
window.FourierView={create({scene,resources,model,tween}){
  const T=THREE,F=FourierModel,theme=PuzzleGraphics.theme,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-1.9,1.9,1.9,-1.9,.1,100);camera.position.z=6;camera.lookAt(0,0,0);
  const scale=2.15,colors=[0x32746b,0xba703e,0x646ca1,0xa64f70],steps=40;
  const paper=new T.Mesh(resources.own(new T.CircleGeometry(1.5,80)),resources.own(new T.MeshBasicMaterial({color:0xedeee2})));paper.position.z=-.08;root.add(paper);
  function line(count,color,{dashed=false,opacity=1}={}){
    const g=resources.own(new T.BufferGeometry());g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));
    const m=resources.own(dashed?new T.LineDashedMaterial({color,dashSize:.045,gapSize:.035,transparent:true,opacity}):new T.LineBasicMaterial({color,transparent:true,opacity}));
    const mesh=new T.Line(g,m);root.add(mesh);return mesh;
  }
  function plot(mesh,points,z=0){
    points.forEach((p,i)=>mesh.geometry.attributes.position.setXYZ(i,p[0],p[1],z));
    mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeBoundingSphere();mesh.computeLineDistances();
  }
  const circle=line(81,0xc4cfbb,{opacity:.8});plot(circle,Array.from({length:81},(_,i)=>[1.33*Math.cos(i*Math.PI/40),1.33*Math.sin(i*Math.PI/40)]),-.03);
  const xAxis=line(2,0xc4cfbb),yAxis=line(2,0xc4cfbb);plot(xAxis,[[-1.45,0],[1.45,0]],-.025);plot(yAxis,[[0,-1.45],[0,1.45]],-.025);
  const connection=line(2,theme.accent),guides=[0,1].map(()=>line(2,theme.accent,{dashed:true,opacity:.35}));
  const trails=[0,1].map(()=>line(steps+1,theme.accent,{dashed:true,opacity:.7}));
  const headGeometry=resources.own(new T.ConeGeometry(.045,.11,8));
  const heads=[0,1].map(()=>{const mesh=new T.Mesh(headGeometry,resources.own(new T.MeshBasicMaterial()));root.add(mesh);return mesh;});
  const ringGeometry=resources.own(new T.RingGeometry(.17,.185,48)),dotGeometry=resources.own(new T.CircleGeometry(.14,40));
  const haloGeometry=resources.own(new T.RingGeometry(.205,.225,48)),hitGeometry=resources.own(new T.CircleGeometry(1,40));
  const hitMaterial=resources.own(new T.MeshBasicMaterial({visible:false}));
  function numeral(number,color){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.font='700 78px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(number,64,66);
    const map=resources.own(new T.CanvasTexture(canvas));map.colorSpace=T.SRGBColorSpace;
    return new T.Mesh(resources.own(new T.PlaneGeometry(.28,.28)),resources.own(new T.MeshBasicMaterial({map,color,transparent:true,depthWrite:false})));
  }
  const points=model.choices().map((choice,i)=>{
    const group=new T.Group(),goal=new T.Group();root.add(goal,group);
    const material=resources.own(new T.MeshBasicMaterial({color:colors[i]}));
    const marker=new T.Group();marker.add(new T.Mesh(dotGeometry,material));
    const label=numeral(i+1,0xffffff);label.position.z=.02;marker.add(label);group.add(marker);
    const halo=new T.Mesh(haloGeometry,resources.own(new T.MeshBasicMaterial({color:theme.accent,transparent:true})));halo.position.z=.01;group.add(halo);
    goal.position.set(F.reference[i][0]*scale,F.reference[i][1]*scale,.06);
    goal.add(new T.Mesh(ringGeometry,material));const targetLabel=numeral(i+1,colors[i]),r=Math.hypot(...F.reference[i]);
    targetLabel.position.set(.27*F.reference[i][0]/r,.27*F.reference[i][1]/r,.005);goal.add(targetLabel);
    const hit=new T.Mesh(hitGeometry,hitMaterial);hit.position.z=.08;group.add(hit);
    return{key:choice.key,index:i,group,marker,goal,targetLabel,halo,hit};
  });
  let feedback={selected:model.selected,move:null},hover=null,animating=false,disposed=false,animationFrom=null,animationMove=null,display=model.coefficients(),previewKey=null;
  function refresh(){
    const selected=F.keys.indexOf(feedback.selected),pair=model.pair(feedback.selected);
    for(const p of points){
      p.halo.visible=p.index===selected||p.index===pair[1]||p.key===hover;
      p.halo.material.opacity=p.index===selected?1:p.key===hover ? .75 : .4;
      const z=display[p.index];p.targetLabel.visible=z.some((v,j)=>Math.abs(v-F.reference[p.index][j])>1e-7);
    }
    const [a,b]=pair;plot(connection,[display[a].map(v=>v*scale),display[b].map(v=>v*scale)],.04);
    pair.forEach((id,i)=>{guides[i].material.color.setHex(colors[id]);plot(guides[i],[display[id].map(v=>v*scale),F.reference[id].map(v=>v*scale)],.035);});
    const move=animating?animationMove:feedback.move,from=animating?animationFrom:model.snapshot();
    const nextKey=move?from+':'+move:null;
    trails.forEach((mesh,i)=>{
      mesh.visible=heads[i].visible=!!move;
      if(move&&nextKey!==previewKey){
        const id=model.pair(model.moveTarget(move))[i],path=Array.from({length:steps+1},(_,k)=>F.interpolate(from,move,k/steps)[id].map(v=>v*scale));
        mesh.material.color.setHex(colors[id]);plot(mesh,path,.045);
        const end=new T.Vector3(...path.at(-1),.05),previous=new T.Vector3(...path.at(-2),.05),direction=end.clone().sub(previous).normalize();
        heads[i].material.color.setHex(colors[id]);heads[i].position.copy(end.addScaledVector(direction,-.055));heads[i].quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);
      }
    });
    previewKey=nextKey;
  }
  function draw(coefficients){
    display=coefficients;points.forEach(p=>p.group.position.set(coefficients[p.index][0]*scale,coefficients[p.index][1]*scale,.10));refresh();
  }
  function sync(){if(!animating&&!disposed)draw(model.coefficients());}
  const view={
    camera,sync,dispose(){disposed=true;},
    resize(aspect,width,height){
      camera.left=-1.9*aspect;camera.right=1.9*aspect;
      const unit=Math.max(1,14*3.8/(height*.14)),hit=Math.max(.25,23*3.8/height);
      points.forEach(p=>{p.marker.scale.setScalar(unit);p.halo.scale.setScalar(unit);p.goal.scale.setScalar(unit);p.hit.scale.setScalar(hit);});
    },
    pickTargets:()=>points.map(p=>p.hit),
    hit(intersection){
      // Generous hit disks can overlap on phones; select the nearest visible
      // centre rather than the first mesh in the raycaster's equal-depth list.
      const at=root.worldToLocal(intersection.point.clone());
      const p=points.reduce((best,p)=>p.group.position.distanceToSquared(at)<best.group.position.distanceToSquared(at)?p:best);
      return{key:p.key,pieceId:p.index,selectOnly:true};
    },
    locations(){root.updateMatrixWorld(true);return points.map(p=>({key:p.key,kind:'point',selectOnly:true,pieceId:p.index,
      point:p.group.getWorldPosition(new T.Vector3()),region:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>p.hit.localToWorld(new T.Vector3(x,y,0)))}));},
    feedback(value){feedback=value;refresh();},hover(hit){hover=hit?.key||null;refresh();},
    async animate(move,before,{duration=360}={}){
      animating=true;animationFrom=before;animationMove=move;
      try{await tween('move',duration,t=>draw(F.interpolate(before,move,t)));}
      finally{animating=false;animationFrom=null;animationMove=null;sync();}
    }
  };
  sync();return view;
}};
FourierPuzzle.mount=context=>PuzzleControl.mount({...context,module:FourierPuzzle,createView:FourierView.create});
