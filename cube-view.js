/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Three.js scene and animation. State and audio stay in their own modules. */
window.PhaseCubeView=(()=>{
  'use strict';
  function create({T,M,colors,view,stage,svg,getState,getSelected,getSelectedFace,isBusy,onMove,onPreview,onError,onSelect,selectOnly}) {
    let inputView,renderCube,animateTurn,resetView,focusFace;
    if(!T)throw new Error('Three.js не загрузился');
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(34,1,.1,100);
    camera.position.set(0,0,6.5);camera.lookAt(0,0,0);
    let renderer;
    try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch(e){onError(e);return null;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;view.append(renderer.domElement);
    scene.add(new T.HemisphereLight(0xfffdf1,0x789075,2.2));
    const light=new T.DirectionalLight(0xfff5df,3);light.position.set(-3,6,5);light.castShadow=true;
    light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-4;light.shadow.camera.right=4;light.shadow.camera.top=4;light.shadow.camera.bottom=-4;scene.add(light);
    const root=new T.Group();root.rotation.set(.40,-.56,0);root.position.y=.10;scene.add(root);
    const floor=new T.Mesh(new T.PlaneGeometry(12,12),new T.ShadowMaterial({color:0x5a7052,opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.69;floor.receiveShadow=true;scene.add(floor);
    let cubies=[], stickers=[], textures=new Map(), anim=null, viewTween=null;
    const normals={U:[0,1,0],R:[1,0,0],F:[0,0,1],D:[0,-1,0],L:[-1,0,0],B:[0,0,-1]};
    const materials={body:new T.MeshStandardMaterial({color:0x314c3c,roughness:.7}),edge:new T.LineBasicMaterial({color:0x203c30,transparent:true,opacity:.7})};
    const geo=new T.BoxGeometry(.97,.97,.97), edgeGeo=new T.EdgesGeometry(geo), stickerGeo=new T.PlaneGeometry(.82,.82);
    function stickerTexture(color,id) {
      const key=color+id;if(textures.has(key))return textures.get(key);
      const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
      x.fillStyle=colors[color];x.beginPath();x.roundRect(1,1,254,254,22);x.fill();
      x.strokeStyle='#263c31';x.lineWidth=6;x.stroke();
      x.fillStyle='#263c31';x.textAlign='center';x.textBaseline='middle';x.font='700 94px Arial';x.fillText(String(id+1),128,117);
      x.fillStyle='#263c3144';
      for(let i=0;i<5;i++){x.beginPath();x.roundRect(70+i*25,184-(i%3)*6,12,19+(i%3)*6,3);x.fill();}
      const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;textures.set(key,texture);return texture;
    }
    function clear() {
      if(anim){root.remove(anim.pivot);anim=null;}
      for(const group of cubies){group.removeFromParent();group.traverse(o=>{if(o.isMesh&&o.material!==materials.body)o.material.dispose();});}
      for(const child of [...root.children])if(child.userData.turnPivot)root.remove(child);
      cubies=[];stickers=[];
    }
    renderCube=()=>{
      clear();const s=getState();
      for(let slot=0;slot<8;slot++){
        const group=new T.Group();group.position.fromArray(M.POSITIONS[slot].map(x=>x*.53));group.userData={slot,id:s.cp[slot]};
        const body=new T.Mesh(geo,materials.body);body.castShadow=true;group.add(body);
        group.add(new T.LineSegments(edgeGeo,materials.edge));
        for(const sticker of M.stickers(s,slot)){
          const material=new T.MeshStandardMaterial({map:stickerTexture(sticker.color,sticker.id),roughness:.74,metalness:0,emissive:sticker.face===getSelectedFace()?0x293c1c:0x000000,emissiveIntensity:.24});
          const plane=new T.Mesh(stickerGeo,material), normal=new T.Vector3(...normals[sticker.face]);
          plane.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),normal);plane.position.copy(normal.multiplyScalar(.493));
          plane.userData={face:sticker.face,id:sticker.id};group.add(plane);stickers.push(plane);
        }
        root.add(group);cubies.push(group);
      }
      inputView?.refresh();
    };
    animateTurn=move=>new Promise(resolve=>{
      const normal=new T.Vector3(...normals[move[0]]), pivot=new T.Group();pivot.userData.turnPivot=true;root.add(pivot);
      for(const group of cubies)if(group.position.dot(normal)>.1){root.remove(group);pivot.add(group);}
      const angle=(move.endsWith("'")?1:-1)*(move.endsWith('2')?Math.PI:Math.PI/2);
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){resolve();return;}
      anim={pivot,normal,angle,start:performance.now(),duration:270,resolve};
    });
    resetView=()=>{viewTween=null;root.rotation.set(.40,-.56,0);inputView?.refresh();};
    focusFace=face=>{
      const target=new T.Quaternion().setFromUnitVectors(new T.Vector3(...normals[face]),new T.Vector3(0,0,1));
      target.premultiply(new T.Quaternion().setFromEuler(new T.Euler(.18,-.18,0)));
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){root.quaternion.copy(target);inputView?.refresh();}
      else viewTween={from:root.quaternion.clone(),to:target,start:performance.now(),duration:320};
    };
    const resize=()=>{const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(view);resize();
    let frameId;
    inputView=new PhaseCubeInput.Input({T,stage,view,svg,root,camera,getStickers:()=>stickers,isBusy,
      onMove,onPreview,onSelect,selectOnly,getSelectedFace,onDrag:()=>{viewTween=null;}});
    function frame(now){
      if(viewTween){const v=viewTween,t=Math.min(1,(now-v.start)/v.duration);root.quaternion.slerpQuaternions(v.from,v.to,t*t*(3-2*t));if(t===1)viewTween=null;}
      if(anim){
        const a=anim, t=Math.min(1,(now-a.start)/a.duration),ease=t*t*(3-2*t);a.pivot.quaternion.setFromAxisAngle(a.normal,a.angle*ease);
        if(t===1){anim=null;a.resolve();}
      }
      renderer.render(scene,camera);inputView.update();frameId=requestAnimationFrame(frame);
    }
    renderCube();frameId=requestAnimationFrame(frame);
    return {input:inputView,render:renderCube,animate:animateTurn,reset:resetView,focus:focusFace,
      destroy(){cancelAnimationFrame(frameId);observer.disconnect();clear();textures.forEach(t=>t.dispose());
        geo.dispose();edgeGeo.dispose();stickerGeo.dispose();materials.body.dispose();materials.edge.dispose();renderer.dispose();}
    };
  }

  return {create};
})();
