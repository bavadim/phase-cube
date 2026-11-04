/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Orthographic board. Rendering, picking and QA all use these same Three objects. */
window.TwiddleView = {create({scene,resources,model,game,tween}){
  const T=THREE,theme=PuzzleGraphics.theme,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-1.9,1.9,1.9,-1.9,.1,100);camera.position.set(4,6,5);camera.lookAt(0,0,0);
  const shellMaterial=resources.material(0x26364b,{roughness:.50,metalness:.42}),darkMaterial=resources.material(0x0d1929,{roughness:.73,metalness:.15});
  const rimMaterial=resources.material(0x5c7188,{roughness:.37,metalness:.65}),fastenerMaterial=resources.material(0xa1b1c3,{roughness:.33,metalness:.72});
  const base=new T.Mesh(resources.bevelBox(3.16,.16,2.16,.045),shellMaterial);base.position.y=-.2;root.add(base);
  const underside=new T.Mesh(resources.bevelBox(3.07,.075,2.07,.025),darkMaterial);underside.position.y=-.30;root.add(underside);
  const socketGeometry=resources.bevelBox(.985,.035,.985,.016);
  for(let slot=0;slot<6;slot++){
    const socket=new T.Mesh(socketGeometry,darkMaterial);socket.position.set(slot%3-1,-.113,Math.floor(slot/3)-.5);root.add(socket);
  }
  const screwGeometry=resources.own(new T.CylinderGeometry(.021,.021,.012,10));
  for(const x of[-1.52,1.52])for(const z of[-1.02,1.02]){
    const screw=new T.Mesh(screwGeometry,fastenerMaterial);screw.position.set(x,-.115,z);root.add(screw);
  }
  const ventGeometry=resources.bevelBox(.13,.018,.008,.003);
  for(let i=-2;i<=2;i++){
    const vent=new T.Mesh(ventGeometry,darkMaterial);vent.position.set(i*.18,-.205,1.079);root.add(vent);
  }
  const box=resources.bevelBox(.93,.2,.93,.045),capGeometry=resources.bevelBox(.907,.032,.907,.014);
  const trimGeometry=resources.bevelBox(.935,.022,.935,.009),top=resources.own(new T.PlaneGeometry(.88,.88));
  const hitGeometry=resources.own(new T.BoxGeometry(.99,.04,.99)),hitMaterial=resources.own(new T.MeshBasicMaterial({visible:false}));
  const pieces=game.voices.map((voice,id)=>{
    const group=new T.Group(),body=new T.Mesh(box,shellMaterial);
    const trim=new T.Mesh(trimGeometry,resources.material(voice.color,{roughness:.42,metalness:.3,emissive:voice.color,emissiveIntensity:.16}));trim.position.y=-.025;
    const cap=new T.Mesh(capGeometry,rimMaterial);cap.position.y=.079;
    const label=new T.Mesh(top,resources.own(new T.MeshBasicMaterial({map:resources.label(voice.color,id+1)})));
    label.rotation.x=-Math.PI/2;label.position.y=.104;
    const hit=new T.Mesh(hitGeometry,hitMaterial);hit.position.y=.14;hit.userData.pieceId=id;
    group.add(body,trim,cap,label,hit);root.add(group);return{group,hit,slot:id};
  });
  const frames=['A','B'].map((key,i)=>{
    const left=i-1.5,frame=resources.stroke([[left,.16,-1],[left+2,.16,-1],[left+2,.16,1],[left,.16,1]],{radius:.022,closed:true});
    root.add(frame);return{key,frame};
  });
  const arrows=[false,true].map(inverse=>{const arrow=resources.turnArrow(inverse);arrow.rotation.x=-Math.PI/2;root.add(arrow);return arrow;});
  let animating=false,disposed=false,feedback={selected:model.selected};
  function refresh(){
    for(const {key,frame}of frames){frame.visible=key===feedback.selected;frame.material.color.setHex(theme.accent);}
    arrows.forEach((arrow,i)=>{arrow.visible=!!feedback.move&&feedback.move.endsWith("'")===!!i;arrow.position.set(feedback.move?.[0]==='A'?-.5:.5,.18,0);});
  }
  function sync(){
    if(animating||disposed)return;
    model.snapshot().forEach((id,slot)=>{pieces[id].slot=slot;pieces[id].group.position.set(slot%3-1,0,Math.floor(slot/3)-.5);});refresh();
  }
  const view={
    camera,resize(aspect){camera.left=-1.9*aspect;camera.right=1.9*aspect;camera.top=1.9;camera.bottom=-1.9;},sync,dispose(){disposed=true;},
    pickTargets:()=>pieces.map(p=>p.hit),
    hit(intersection){
      const id=intersection.object.userData.pieceId,column=pieces[id].slot%3,key=column===0?'A':column===2?'B':model.selected;
      return {pieceId:id,column,key,actionCenter:root.localToWorld(new T.Vector3(key==='A'?-.5:.5,.16,0))};
    },
    locations(){root.updateMatrixWorld(true);return pieces.map(({group,slot},pieceId)=>({kind:'tile',slot,pieceId,column:slot%3,point:group.localToWorld(new T.Vector3(0,.16,0)),
      region:[[-.495,-.495],[.495,-.495],[.495,.495],[-.495,.495]].map(([x,z])=>group.localToWorld(new T.Vector3(x,.16,z)))}));},
    feedback(value){feedback=value;refresh();},
    async animate(move,before,{duration=300}={}){
      animating=true;
      const ring=TwiddleModel.rings[move[0]],cx=move[0]==='A'?-.5:.5,sign=move.endsWith("'")?-1:1;
      try{await tween('move',duration,t=>{
        const a=sign*t*Math.PI/2;
        ring.forEach(slot=>{const x=slot%3-1-cx,z=Math.floor(slot/3)-.5;
          pieces[before[slot]].group.position.set(cx+x*Math.cos(a)-z*Math.sin(a),Math.sin(t*Math.PI)*.12,x*Math.sin(a)+z*Math.cos(a));});
      });}finally{animating=false;sync();}
    }
  };
  sync();return view;
}};
