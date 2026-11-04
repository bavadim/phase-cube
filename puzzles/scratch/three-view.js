/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One picture, one movable cutout per instrument. Edge drag rotates; center drag swaps. */
window.ScratchView={create({scene,resources,model,game,tween,invalidate,onEditPreview}){
  const T=THREE,F=ScratchModel,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-2.2,2.2,2.2,-2.2,.1,30);camera.position.z=8;camera.lookAt(0,0,0);
  const {columns,rows,movingCells:cells,fixedCells}=game.layout,size=3,cell=size/columns,boardHeight=rows*cell;
  const position=index=>new T.Vector3((index%columns-(columns-1)/2)*cell,((rows-1)/2-Math.floor(index/columns))*cell,0);
  const centers=cells.map(position),image=new Image(),texture=resources.own(new T.Texture(image));texture.colorSpace=T.SRGBColorSpace;
  let resolveReady,rejectReady;
  const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  let textureReady=false,disposed=false,animating=false,dragging=null,committed=null,feedback={selected:null,move:null},display=model.parameters();
  image.onload=()=>{if(!disposed){textureReady=true;texture.needsUpdate=true;invalidate();resolveReady(true);}};
  image.onerror=()=>{if(!disposed)rejectReady(new Error('Не загрузилась картинка пазла. Повторите загрузку.'));};
  image.src=globalThis.PhaseCubeEmbeddedAssets?.['assets/director-puzzle.png']||'assets/director-puzzle.png?v=picture2';
  function material(color,extra={}){return resources.own(new T.MeshBasicMaterial({color,side:T.DoubleSide,...extra}));}
  // The frame and exposed sockets belong to this single object, not a control panel.
  const shellMaterial=resources.material(0x293a51,{roughness:.48,metalness:.46}),rimMaterial=resources.material(0x71849b,{roughness:.37,metalness:.65});
  const darkMaterial=resources.material(0x0b1728,{roughness:.65,metalness:.18});
  function plate(w,h,d,z,mat,bevel){const mesh=new T.Mesh(resources.bevelBox(w,h,d,bevel),mat);mesh.position.z=z;root.add(mesh);return mesh;}
  plate(size+.18,boardHeight+.18,.12,-.10,shellMaterial,.028);
  plate(size+.11,boardHeight+.11,.025,-.045,rimMaterial,.010);
  plate(size+.035,boardHeight+.035,.02,-.025,darkMaterial,.008);
  const screwGeometry=resources.own(new T.CylinderGeometry(.016,.016,.010,10));
  for(const x of[-1,1])for(const y of[-1,1]){
    const screw=new T.Mesh(screwGeometry,rimMaterial);screw.rotation.x=Math.PI/2;screw.position.set(x*(size/2+.061),y*(boardHeight/2+.061),-.030);root.add(screw);
  }
  const stripGeometry=resources.bevelBox(.26,.012,.010,.004),stripMaterial=resources.material(0x55d7dc,{roughness:.32,metalness:.25,emissive:0x31b8c3,emissiveIntensity:.45});
  for(const y of[-1,1]){
    const strip=new T.Mesh(stripGeometry,stripMaterial);strip.position.set(0,y*(boardHeight/2+.061),-.031);root.add(strip);
  }
  const artMaterial=material(0xffffff,{map:texture});
  function tile(index){
    const geometry=resources.own(new T.PlaneGeometry(cell,cell)),uv=geometry.attributes.uv,col=index%columns,row=Math.floor(index/columns);
    for(let i=0;i<uv.count;i++)uv.setXY(i,(col+uv.getX(i))/columns,(rows-1-row+uv.getY(i))/rows);
    uv.needsUpdate=true;return new T.Mesh(geometry,artMaterial);
  }
  const tileBodyGeometry=resources.bevelBox(cell-.006,cell-.006,.056,.018);
  for(const index of fixedCells){
    const center=position(index),body=new T.Mesh(tileBodyGeometry,shellMaterial),mesh=tile(index);
    body.position.copy(center);body.position.z=-.030;mesh.position.copy(center);root.add(body,mesh);
  }
  const socketGeometry=resources.own(new T.PlaneGeometry(cell,cell)),socketMaterial=material(0x101c30);
  centers.forEach(center=>{const mesh=new T.Mesh(socketGeometry,socketMaterial);mesh.position.copy(center);mesh.position.z=-.02;root.add(mesh);});
  const outlineGeometry=resources.own(new T.EdgesGeometry(resources.own(new T.PlaneGeometry(cell-.006,cell-.006))));
  const pieces=cells.map((index,source)=>{
    const group=new T.Group(),mesh=tile(index),body=new T.Mesh(tileBodyGeometry,shellMaterial);body.position.z=-.030;
    mesh.userData.source=source;group.add(body,mesh);root.add(group);
    const shadow=new T.Mesh(resources.own(new T.PlaneGeometry(cell+.025,cell+.025)),material(0x050c17,{transparent:true,opacity:.34}));shadow.position.set(.018,-.025,-.060);group.add(shadow);
    const edge=new T.LineSegments(outlineGeometry,resources.own(new T.LineBasicMaterial({color:game.voices[source].color,transparent:true,opacity:.8})));edge.position.z=.018;group.add(edge);
    const gripGeometry=resources.own(new T.RingGeometry(.022*cell,.038*cell,20)),gripMaterial=material(game.voices[source].color);
    const grips=[[-.40,-.40],[.40,-.40],[.40,.40],[-.40,.40]].map(([x,y])=>{const g=new T.Mesh(gripGeometry,gripMaterial);g.position.set(x*cell,y*cell,.022);group.add(g);return g;});
    return{source,group,mesh,edge,shadow,grips};
  });
  const targetOutline=new T.LineSegments(outlineGeometry,resources.own(new T.LineBasicMaterial({color:0xe7bc67})));targetOutline.visible=false;targetOutline.position.z=.025;root.add(targetOutline);
  function style(){
    for(const p of display){const piece=pieces[p.source],active=p.key===feedback.selected||dragging?.source===p.source;
      piece.edge.visible=true;
      piece.edge.material.opacity=active?1:p.source!==p.slot||Math.abs(p.phase%4)>1e-8?.50:.22;piece.grips.forEach(g=>{g.visible=active;});
      piece.shadow.visible=!!dragging&&dragging.source===p.source;
    }
  }
  function draw(parameters){
    display=parameters.map(p=>({...p}));
    for(const p of display){const piece=pieces[p.source];piece.group.position.copy(centers[p.slot]);piece.group.position.z=.01;piece.group.rotation.z=-p.phase*Math.PI/2;}
    targetOutline.visible=false;style();
  }
  function sync(){if(!disposed&&!animating&&!dragging&&!committed)draw(model.parameters());}
  const snapshotBySource=values=>values.slice().sort((a,b)=>a.source-b.source);
  function phaseOf(move){return typeof move==='object'?move.turns:move.endsWith("'")?-1:1;}
  const view={camera,ready,sync,
    dispose(){disposed=true;image.onload=image.onerror=null;dragging=null;resolveReady(false);},
    resize(aspect){const extent=Math.max(2.2,2.2/aspect);camera.top=extent;camera.bottom=-extent;camera.left=-extent*aspect;camera.right=extent*aspect;},
    pickTargets:()=>pieces.map(p=>p.mesh),
    hit(intersection){
      const source=intersection.object.userData.source,p=display.find(p=>p.source===source),piece=pieces[source];
      const local=piece.group.worldToLocal(intersection.point.clone()),rotate=Math.max(Math.abs(local.x),Math.abs(local.y))>.28*cell;
      return{key:p.key,pieceId:source,kind:rotate?'rotation-handle':'piece',draggable:true,selectOnly:feedback.selected!==p.key,actionCenter:piece.group.getWorldPosition(new T.Vector3()),rotate};
    },
    locations(){root.updateMatrixWorld(true);return display.flatMap(p=>{
      const g=pieces[p.source].group;
      return[[0,0,'piece'],[.41,.20,'rotation-handle']].map(([x,y,kind])=>({key:p.key,pieceId:p.source,kind,draggable:true,
        point:g.localToWorld(new T.Vector3(x*cell,y*cell,.03)),region:[[-.49,-.49],[.49,-.49],[.49,.49],[-.49,.49]].map(([x,y])=>g.localToWorld(new T.Vector3(x*cell,y*cell,.03)))}));
    });},
    feedback(value){feedback=value;style();},
    beginDrag(hit,world){
      if(animating||!world||!hit.draggable||!textureReady)return false;
      const p=model.parameters().find(p=>p.key===hit.key),local=root.worldToLocal(world.clone()),center=centers[p.slot];
      dragging={key:p.key,source:p.source,slot:p.slot,before:model.snapshot(),start:local.clone(),phase:p.phase,
        angle:Math.atan2(local.y-center.y,local.x-center.x),rotate:hit.rotate,move:null,to:null};
      committed=null;pieces[p.source].group.position.z=.10;return true;
    },
    dragTo(world){
      if(!dragging||!world)return;const d=dragging,local=root.worldToLocal(world.clone());
      if(d.rotate){
        const center=centers[d.slot],x=local.x-center.x,y=local.y-center.y;if(Math.hypot(x,y)<.08*cell)return;
        const angle=Math.atan2(y,x),delta=Math.atan2(Math.sin(angle-d.angle),Math.cos(angle-d.angle));d.angle=angle;d.phase-=delta/(Math.PI/2);
        const values=model.parameters(d.before);values[d.slot].phase=d.phase;draw(values);pieces[d.source].group.position.z=.10;
        d.move=model.editMove(d.key,d.phase,d.before);onEditPreview(d.move,{kind:'piece-phase',key:d.key,phase:d.phase});
      }else{
        const destination=centers[d.slot].clone().add(local.clone().sub(d.start));pieces[d.source].group.position.copy(destination);pieces[d.source].group.position.z=.10;
        const index=centers.findIndex(c=>Math.abs(c.x-destination.x)<.48*cell&&Math.abs(c.y-destination.y)<.48*cell);
        const to=index>=0&&index!==d.slot?model.keys[index]:null;
        targetOutline.visible=!!to;if(to)targetOutline.position.set(centers[index].x,centers[index].y,.03);
        if(to!==d.to){d.to=to;d.move=to?model.swapMove(d.key,to,d.before):null;onEditPreview(d.move,to?{kind:'piece-swap',key:d.key,to}:null);}
      }
    },
    endDrag(cancelled){
      if(!dragging)return null;const old=dragging;dragging=null;
      if(!cancelled&&old.move&&model.validMove(old.move))committed={move:JSON.stringify(old.move),phase:old.phase,rotate:old.rotate};
      onEditPreview(null);targetOutline.visible=false;
      if(committed)return old.move;
      draw(model.parameters());return null;
    },
    async animate(move,before,{duration=340}={}){
      animating=true;
      const old=committed?.move===JSON.stringify(move)?committed:null;committed=null;
      const a=model.parameters(before),b=model.parameters(model.applyTo(before,move)),isSwap=typeof move==='string'?move.endsWith('x'):move.kind==='piece-swap';
      const byA=snapshotBySource(a),byB=snapshotBySource(b),index=model.keys.indexOf(model.moveTarget(move));
      const startPositions=pieces.map(p=>p.group.position.clone());
      try{await tween('move',old?180:duration,t=>{
        if(isSwap){
          draw(a);
          pieces.forEach((piece,i)=>{const from=old?startPositions[i]:centers[byA[i].slot],to=centers[byB[i].slot];
            piece.group.position.copy(from).lerp(to,t);piece.group.position.z=.04+(byA[i].slot===byB[i].slot?0:.05);
            if(byA[i].slot!==byB[i].slot&&!old){const direction=i===a[index].source?1:-1;piece.group.position.x+=Math.sin(Math.PI*t)*.12*direction;}
          });
        }else{
          const values=a.map(p=>({...p})),from=old?.rotate?old.phase:a[index].phase,to=a[index].phase+phaseOf(move);
          // The unwrapped gesture may end near another full revolution.
          const end=old?.rotate?from+(((to-from+2)%4+4)%4-2):to;
          values[index].phase=from+(end-from)*t;draw(values);
        }
      });}finally{animating=false;draw(model.parameters());}
    }
  };
  draw(display);return view;
}};
