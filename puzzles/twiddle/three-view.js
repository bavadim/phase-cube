/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Orthographic board. Rendering, picking and QA all use these same Three objects. */
window.TwiddleView = {create({scene,resources,model,game,tween}){
  const T=THREE,theme=PuzzleGraphics.theme,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-1.9,1.9,1.9,-1.9,.1,100);camera.position.set(4,6,5);camera.lookAt(0,0,0);
  const base=new T.Mesh(resources.own(new T.BoxGeometry(3.16,.16,2.16)),resources.material(0xbdcbb0));base.position.y=-.2;root.add(base);
  const box=resources.own(new T.BoxGeometry(.93,.2,.93)),edges=resources.own(new T.EdgesGeometry(box));
  const edgeMaterial=resources.own(new T.LineBasicMaterial({color:theme.ink})),top=resources.own(new T.PlaneGeometry(.88,.88));
  const hitGeometry=resources.own(new T.BoxGeometry(.99,.04,.99)),hitMaterial=resources.own(new T.MeshBasicMaterial({visible:false}));
  const pieces=game.voices.map((voice,id)=>{
    const group=new T.Group(),body=new T.Mesh(box,resources.material(voice.color));
    const label=new T.Mesh(top,resources.own(new T.MeshBasicMaterial({map:resources.label(voice.color,id+1)})));
    label.rotation.x=-Math.PI/2;label.position.y=.104;
    const hit=new T.Mesh(hitGeometry,hitMaterial);hit.position.y=.14;hit.userData.pieceId=id;
    group.add(body,new T.LineSegments(edges,edgeMaterial),label,hit);root.add(group);return{group,hit,slot:id};
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
