/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Cube geometry only. Renderer, pointer events, timing and disposal are shared. */
window.RubikView = {create({scene,resources,model,tween}){
  const T=THREE,M=PhaseCube,theme=PuzzleGraphics.theme;
  const normals={U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]};
  const root=new T.Group();root.rotation.set(.4,-.56,0);scene.add(root);
  const camera=new T.PerspectiveCamera(34,1,.1,100);camera.position.set(0,0,6);camera.lookAt(0,0,0);
  const box=resources.bevelBox(.97,.97,.97,.065),bodyMaterial=resources.material(0x253345,{roughness:.46,metalness:.42});
  const bezel=resources.bevelBox(.925,.925,.032,.015),bezelMaterial=resources.material(0x60758c,{roughness:.38,metalness:.68});
  const inset=resources.bevelBox(.875,.875,.018,.008),insetMaterial=resources.material(0x111b2c,{roughness:.56,metalness:.24});
  const screwGeometry=resources.own(new T.CylinderGeometry(.012,.012,.006,8)),screwMaterial=resources.material(0x9bacc0,{roughness:.36,metalness:.74});
  const screwRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2);
  const plane=resources.own(new T.PlaneGeometry(.84,.84));
  const cubies=M.POSITIONS.map((position,slot)=>{
    const group=new T.Group();root.add(group);
    group.add(new T.Mesh(box,bodyMaterial));
    const screws=resources.own(new T.InstancedMesh(screwGeometry,screwMaterial,M.CORNER_FACES[slot].length*4)),screwTransform=new T.Object3D();
    group.add(screws);let screwIndex=0;
    const stickers={};
    for(const face of M.CORNER_FACES[slot]){
      const mesh=new T.Mesh(plane,resources.own(new T.MeshBasicMaterial())),normal=new T.Vector3(...normals[face]);
      // The machined bezel stays behind the original sticker/picking surface.
      const mount=new T.Group();mount.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);
      const rim=new T.Mesh(bezel,bezelMaterial),well=new T.Mesh(inset,insetMaterial);rim.position.z=.470;well.position.z=.482;
      mount.add(rim,well);
      for(const x of[-.437,.437])for(const y of[-.437,.437]){
        screwTransform.position.set(x,y,.488).applyQuaternion(mount.quaternion);
        screwTransform.quaternion.copy(mount.quaternion).multiply(screwRotation);screwTransform.updateMatrix();
        screws.setMatrixAt(screwIndex++,screwTransform.matrix);
      }
      group.add(mount);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);mesh.position.copy(normal.multiplyScalar(.494));
      group.add(mesh);stickers[face]=mesh;
    }
    screws.instanceMatrix.needsUpdate=true;screws.computeBoundingSphere();
    return {group,stickers,position:new T.Vector3(...position).multiplyScalar(.53)};
  });
  const pickBox=new T.Mesh(resources.own(new T.BoxGeometry(2.08,2.08,2.08)),resources.own(new T.MeshBasicMaterial({visible:false})));
  root.add(pickBox);
  const frames={};
  for(const [face,n]of Object.entries(normals)){
    const group=new T.Group(),normal=new T.Vector3(...n);
    group.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);group.position.copy(normal.multiplyScalar(1.048));
    group.add(resources.stroke([[-1.02,1.02,0],[1.02,1.02,0],[1.02,-1.02,0],[-1.02,-1.02,0]],{closed:true}));
    root.add(group);frames[face]=group;
  }
  const arrows=[false,true].map(inverse=>resources.turnArrow(inverse));
  let animating=false,disposed=false,feedback={selected:model.selected,move:null};
  function refresh(){
    for(const [face,frame]of Object.entries(frames)){
      frame.visible=face===feedback.selected;
      frame.children[0].material.color.setHex(theme.accent);
    }
    arrows.forEach((arrow,i)=>{arrow.visible=!!feedback.move&&feedback.move.endsWith("'")===!!i;if(feedback.move)frames[feedback.move[0]].add(arrow);});
  }
  function sync(){
    if(animating||disposed)return;
    const state=model.snapshot();
    cubies.forEach(({group,stickers,position},slot)=>{
      root.add(group);group.position.copy(position);group.quaternion.identity();
      for(const s of M.stickers(state,slot)){
        const material=stickers[s.face].material,map=resources.label(RubikPuzzle.colors[s.color],s.id+1);
        if(material.map!==map){material.map=map;material.needsUpdate=true;}
      }
    });refresh();
  }
  const view={
    camera,resize(aspect){camera.aspect=aspect;},sync,dispose(){disposed=true;},
    pickTargets:()=>[pickBox],
    hit(intersection){
      const n=intersection.face.normal,face=Object.entries(normals).find(([,v])=>n.dot(new T.Vector3(...v))>.9)[0];
      const p=root.worldToLocal(intersection.point.clone());
      const slot=cubies.reduce((best,c,i)=>c.position.distanceToSquared(p)<cubies[best].position.distanceToSquared(p)?i:best,0);
      return {key:face,pieceId:model.snapshot().cp[slot],actionCenter:root.localToWorld(new T.Vector3(...normals[face]).multiplyScalar(1.04))};
    },
    locations(){
      root.updateMatrixWorld(true);
      return Object.entries(normals).flatMap(([key,n])=>{
        const point=root.localToWorld(new T.Vector3(...n).multiplyScalar(1.04)),normal=new T.Vector3(...n).transformDirection(root.matrixWorld);
        const rotation=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...n));
        const region=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([x,y])=>root.localToWorld(new T.Vector3(x,y,0).applyQuaternion(rotation).add(new T.Vector3(...n).multiplyScalar(1.04))));
        return normal.dot(camera.position.clone().sub(point))>.001?[{key,kind:'face',point,region}]:[];
      });
    },
    feedback(value){feedback=value;refresh();},
    drag(x,y){root.rotation.y+=x*.009;root.rotation.x+=y*.009;},
    focus(face,duration=320){
      const from=root.quaternion.clone(),to=new T.Quaternion().setFromUnitVectors(new T.Vector3(...normals[face]),new T.Vector3(0,0,1));
      // Keep neighbouring faces wide enough to tap: a nearly head-on focus
      // leaves subpixel side faces that WebKit's integer touch coordinates miss.
      to.premultiply(new T.Quaternion().setFromEuler(new T.Euler(.4,-.56,0)));
      return tween('camera',duration,t=>root.quaternion.slerpQuaternions(from,to,t));
    },
    async animate(move,before,{duration=280,demonstration=false}={}){
      animating=true;
      const normal=new T.Vector3(...normals[move[0]]),pivot=new T.Group();root.add(pivot);
      for(const {group,position}of cubies)if(position.dot(normal)>.1)pivot.add(group);
      const angle=(move.endsWith("'")?1:-1)*(move.endsWith('2')?Math.PI:Math.PI/2);
      try{
        if(demonstration){const focused=await view.focus(move[0],Math.min(80,duration/2));if(disposed||!focused)return;}
        await tween('move',duration,t=>pivot.quaternion.setFromAxisAngle(normal,angle*t));
      }
      finally{animating=false;sync();root.remove(pivot);}
    }
  };
  sync();return view;
}};
