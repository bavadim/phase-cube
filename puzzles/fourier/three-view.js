/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Fourier contour and unitary coefficient rotors; all input stays in PuzzleControl. */
window.FourierView={create({scene,resources,model,tween}){
  const T=THREE,F=FourierModel,theme=PuzzleGraphics.theme,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-1.9,1.9,1.9,-1.9,.1,100);camera.position.z=6;camera.lookAt(0,0,0);
  const padGeometry=resources.own(new T.CircleGeometry(1.12,80));
  const pad=new T.Mesh(padGeometry,resources.material(0xe1e8d6));pad.position.set(0,.45,-.08);root.add(pad);
  const energy=Math.sqrt(F.reference.flat().reduce((s,x)=>s+x*x,0)*2),count=160;
  function curve(color,dashed=false){
    const geometry=resources.own(new T.BufferGeometry());geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(count*3),3));
    const material=resources.own(dashed?new T.LineDashedMaterial({color,dashSize:.045,gapSize:.035}):new T.LineBasicMaterial({color}));
    const line=new T.LineLoop(geometry,material);root.add(line);return line;
  }
  const target=curve(0x80958a,true),current=curve(theme.accent);
  function contour(line,coefficients){
    const attr=line.geometry.attributes.position;
    for(let j=0;j<count;j++){
      const t=j/count,a=t*Math.PI*2,value=FourierBinding.field(coefficients,t),r=.78+.20*value/energy;
      attr.setXYZ(j,Math.sin(a)*r,.45+Math.cos(a)*r,.04);
    }
    attr.needsUpdate=true;line.geometry.computeBoundingSphere();line.computeLineDistances();
  }
  contour(target,F.reference);
  const disk=resources.own(new T.CylinderGeometry(.42,.42,.09,40));disk.rotateX(Math.PI/2);
  const hitGeometry=resources.own(new T.BoxGeometry(1.05,1.05,.15)),hitMaterial=resources.own(new T.MeshBasicMaterial({visible:false}));
  const sealHit=new T.Mesh(padGeometry,hitMaterial);sealHit.position.copy(pad.position);root.add(sealHit);
  const controls=model.choices().map((choice,i)=>{
    const group=new T.Group();group.position.set((i===2?0:i===0?-1.02:1.02),-.95,0);root.add(group);
    const material=resources.material(theme.paper),body=new T.Mesh(disk,material);group.add(body);
    const ring=resources.stroke(Array.from({length:48},(_,j)=>{const a=j*Math.PI/24;return[Math.cos(a)*.40,Math.sin(a)*.40,.06];}),{radius:.017,closed:true});group.add(ring);
    const label=new T.Mesh(resources.own(new T.PlaneGeometry(.46,.46)),resources.own(new T.MeshBasicMaterial({map:resources.label('#fcfaf2',i===2?'↔':i===0?'C₁':'C₂')})));label.position.z=.055;group.add(label);
    const needle=resources.stroke([[0,0,.085],[.35,0,.085]],{radius:.022});needle.visible=i!==2;group.add(needle);
    const dot=new T.Mesh(resources.own(new T.SphereGeometry(.034,8,6)),resources.own(new T.MeshBasicMaterial({color:theme.hover})));dot.visible=i!==2;group.add(dot);
    if(i!==2){const c=F.reference[i];dot.position.set(c[0]*.42,c[1]*.42,.095);}
    const hit=new T.Mesh(hitGeometry,hitMaterial);hit.userData.key=choice.key;group.add(hit);return{key:choice.key,group,hit,ring,material,needle,index:i};
  });
  const arrows=[false,true].map(inverse=>{const a=resources.turnArrow(inverse);a.scale.setScalar(.5);a.position.z=.11;return a;});
  let feedback={selected:model.selected,move:null},hover=null,animating=false,disposed=false;
  function refresh(){
    for(const c of controls){c.ring.visible=c.key===feedback.selected||c.key===hover;c.ring.material.color.setHex(c.key===feedback.selected?theme.accent:theme.hover);}
    arrows.forEach((arrow,i)=>{arrow.visible=!!feedback.move&&feedback.move.endsWith("'")===!!i;if(feedback.move)controls.find(c=>c.key===model.moveTarget(feedback.move)).group.add(arrow);});
  }
  function draw(coefficients){
    contour(current,coefficients);
    controls.slice(0,2).forEach((c,i)=>{const z=coefficients[i];c.needle.rotation.z=Math.atan2(z[1],z[0]);c.needle.scale.x=Math.hypot(...z)/Math.sqrt(energy*energy/2);});refresh();
  }
  function sync(){if(!animating&&!disposed)draw(model.coefficients());}
  const view={camera,sync,resize(aspect){camera.left=-1.9*aspect;camera.right=1.9*aspect;},dispose(){disposed=true;},
    pickTargets:()=>[...controls.map(c=>c.hit),sealHit],
    hit(intersection){const key=intersection.object.userData.key||model.selected,c=controls.find(c=>c.key===key);return{key,actionCenter:(intersection.object===sealHit?sealHit:c.group).getWorldPosition(new T.Vector3())};},
    locations(){root.updateMatrixWorld(true);return[...controls.map(c=>({key:c.key,kind:'control',point:c.group.getWorldPosition(new T.Vector3()),region:[[-.525,-.525],[.525,-.525],[.525,.525],[-.525,.525]].map(([x,y])=>c.group.localToWorld(new T.Vector3(x,y,.075)))})),
      {key:model.selected,kind:'seal',point:sealHit.getWorldPosition(new T.Vector3()),region:[[-.78,-.78],[.78,-.78],[.78,.78],[-.78,.78]].map(([x,y])=>sealHit.localToWorld(new T.Vector3(x,y,0)))}];},
    feedback(value){feedback=value;refresh();},hover(hit){hover=hit?.key||null;refresh();},
    async animate(move,before){animating=true;try{await tween('move',420,t=>draw(F.interpolate(before,move,t)));}finally{animating=false;sync();}}
  };
  sync();return view;
}};
FourierPuzzle.mount=context=>PuzzleControl.mount({...context,module:FourierPuzzle,createView:FourierView.create});
