/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A boardroom: fixed seats identify riffs, swivel is phase, gas lift is gain. */
window.FourierView={create({scene,resources,model,game,tween,onEditPreview}){
  const T=THREE,F=FourierModel,theme=PuzzleGraphics.theme,root=new T.Group();scene.add(root);
  const camera=new T.OrthographicCamera(-2.75,2.75,2.75,-2.75,.1,60);camera.position.set(0,9,8);camera.lookAt(0,.85,0);
  const liftBase=.36,liftRange=.58,spinDistance=2.4;
  const box=resources.own(new T.BoxGeometry(1,1,1)),ball=resources.own(new T.SphereGeometry(1,12,8));
  const cylinder=resources.own(new T.CylinderGeometry(1,1,1,12)),materials=new Map();
  const mat=color=>{if(!materials.has(color))materials.set(color,resources.material(color));return materials.get(color);};
  function mesh(parent,geometry,color,position,scale){const m=new T.Mesh(geometry,mat(color));m.position.set(...position);m.scale.set(...scale);parent.add(m);return m;}
  const block=(parent,color,position,scale)=>mesh(parent,box,color,position,scale);
  const ellipsoid=(parent,color,position,scale)=>mesh(parent,ball,color,position,scale);
  const tube=(parent,color,position,scale)=>mesh(parent,cylinder,color,position,scale);
  function label(text,{color='#263e33',background=null,size=.28}={}){
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
    const ctx=canvas.getContext('2d');if(background){ctx.fillStyle=background;ctx.fillRect(0,0,256,128);}
    ctx.fillStyle=color;ctx.font='700 84px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,128,69);
    const texture=resources.own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;
    return new T.Mesh(resources.own(new T.PlaneGeometry(size*2,size)),resources.own(new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false})));
  }
  // A single low office plinth makes the six mechanisms one object.
  block(root,0xc4cfb8,[0,-.10,0],[4.45,.16,3.75]);
  block(root,0xe4d7b7,[0,-.005,0],[4.32,.05,3.62]);
  // The shared table stays behind the people, leaving the moving seats exposed.
  block(root,0x9e7855,[0,.66,-1.91],[4.16,.12,.48]);
  for(const x of [-1.8,1.8])block(root,0x435749,[x,.30,-1.91],[.09,.62,.30]);
  const screen=new T.Group();screen.position.set(0,1.2,-2.05);root.add(screen);
  block(screen,0x334c41,[0,0,0],[1.24,.74,.06]);block(screen,0xc4d4b5,[0,0,.04],[1.10,.60,.02]);
  const title=label('SYNC',{color:'#263e33',size:.21});title.position.set(0,.13,.06);screen.add(title);
  for(let i=0;i<3;i++)block(screen,0x729575,[-.32+i*.32,-.13,.065],[.15,.06+i*.065,.025]);
  const skin=[0xe1ae82,0xbd8766,0xf0c4a0,0xd8a07a,0xb98565,0xf0c39b];
  const hair=[0x47382c,0x9f543a,0x343d39,0xc99c60,0x574338,0x62534b];
  const people=model.choices().map((choice,i)=>{
    const base=new T.Group();base.position.set((i%3-1)*1.35,0,(i<3?-1:1)*.87);root.add(base);
    const color=game.voices[i].color;
    // Five-spoke feet remain fixed; the upholstered chair/person swivels above them.
    tube(base,0x344b42,[0,.06,0],[.11,.12,.11]);
    for(let j=0;j<5;j++){
      const a=j*Math.PI*2/5,foot=block(base,0x4c6054,[Math.sin(a)*.18,.04,Math.cos(a)*.18],[.055,.055,.43]);foot.rotation.y=a;
      ellipsoid(base,0x263b33,[Math.sin(a)*.37,.045,Math.cos(a)*.37],[.065,.05,.065]);
    }
    const post=tube(base,0xa1b0a4,[0,.3,0],[.055,.6,.055]);
    const seat=new T.Group();base.add(seat);
    ellipsoid(seat,color,[0,.02,0],[.40,.09,.36]);
    const back=ellipsoid(seat,color,[0,.37,-.29],[.38,.43,.085]);
    block(seat,0x334c41,[0,.13,-.30],[.10,.40,.07]);
    for(const x of [-.37,.37]){
      block(seat,0x344b42,[x,.15,0],[.045,.30,.045]);block(seat,0x344b42,[x,.31,.015],[.09,.055,.40]);
    }
    // Chibi office workers have a real front/back and distinct silhouettes.
    ellipsoid(seat,color,[0,.37,.015],[.25,.33,.18]);
    block(seat,0xf2e6cb,[0,.49,.175],[.13,.23,.025]);
    const tie=block(seat,i%2?0xb96f42:0x334c41,[.015,.38,.20],[.052,.21,.025]);tie.rotation.z=-.10;
    tube(seat,skin[i],[0,.70,.02],[.085,.12,.085]);
    ellipsoid(seat,skin[i],[0,.88,.035],[.24,.26,.22]);
    ellipsoid(seat,hair[i],[0,1.025,-.025],[.25,.145,.22]);
    if(i%3===1)ellipsoid(seat,hair[i],[.19,1.10,-.10],[.12,.15,.12]);
    if(i===4)ellipsoid(seat,hair[i],[0,.78,.16],[.18,.075,.07]);
    for(const x of [-.09,.09]){
      ellipsoid(seat,0x263c34,[x,.90,.237],[.022,.033,.015]);
      const brow=block(seat,hair[i],[x,.96,.23],[.065,.018,.025]);brow.rotation.z=x>0?-.13:.13;
    }
    ellipsoid(seat,skin[i],[.012,.855,.255],[.045,.05,.06]);
    block(seat,0x8e5945,[.012,.785,.23],[.073,.015,.017]);
    if(i%3===0){
      for(const x of [-.095,.095]){const ring=new T.Mesh(resources.own(new T.TorusGeometry(.066,.012,5,16)),mat(0x263e33));ring.position.set(x,.90,.25);seat.add(ring);}
      block(seat,0x263e33,[0,.90,.25],[.065,.014,.015]);
    }
    const hands=[];
    for(const x of [-.17,.17]){
      ellipsoid(seat,0x45544c,[x,-.16,.21],[.10,.23,.10]);ellipsoid(seat,0x263c34,[x,-.34,.29],[.12,.07,.19]);
      hands.push(ellipsoid(seat,skin[i],[x*1.5,.31,.20],[.07,.075,.09]));
    }
    // Different props help identify sound sources without an external legend.
    if(i%3===0){tube(seat,0xf5ead5,[.29,.39,.22],[.06,.14,.06]);}
    else if(i%3===1){const laptop=block(seat,0x586c60,[0,.22,.29],[.34,.025,.23]);laptop.rotation.x=.20;}
    else {const notebook=block(seat,0xd0ae6f,[-.26,.30,.22],[.10,.18,.035]);notebook.rotation.z=.20;}
    const badge=label(String(i+1),{color:'#ffffff',background:color,size:.17});badge.position.set(0,.47,-.385);badge.rotation.y=Math.PI;seat.add(badge);
    const number=label(String(i+1),{color:game.voices[i].color,size:.24});number.position.set(0,.07,.51);number.rotation.x=-Math.PI/2;base.add(number);
    const outline=new T.Mesh(resources.own(new T.TorusGeometry(.49,.027,5,48)),resources.own(new T.MeshBasicMaterial({color:theme.accent})));outline.rotation.x=-Math.PI/2;outline.position.y=.09;base.add(outline);
    const arrow=new T.Mesh(resources.own(new T.ConeGeometry(.08,.17,3)),mat(0xc69c58));arrow.rotation.x=Math.PI/2;arrow.position.set(0,.08,.42);base.add(arrow);
    const talk=new T.Group();seat.add(talk);
    for(let j=0;j<3;j++)ellipsoid(talk,color,[.32+j*.07,1.03+j*.07,.08],[.027,.027,.027]);
    talk.visible=false;
    const pick=new T.Mesh(resources.own(new T.PlaneGeometry(1.00,1.15)),resources.own(new T.MeshBasicMaterial({visible:false,side:T.DoubleSide})));base.add(pick);pick.userData.index=i;
    return{key:choice.key,index:i,base,seat,post,back,number,outline,pick,hands,talk,reaction:0,gain:1,phase:F.homePhase[i]};
  });
  let feedback={selected:null,move:null},animating=false,disposed=false,dragging=null,committed=null,display=model.parameters().map(p=>({phase:p.phase,gain:F.gain(p)}));
  const selected=()=>people.find(p=>p.key===feedback.selected);
  function draw(values){
    display=values.map(p=>({...p}));
    people.forEach((p,i)=>{
      p.gain=values[i].gain;p.phase=values[i].phase;
      const height=liftBase+liftRange*p.gain;p.seat.position.y=height;
      p.seat.rotation.y=(p.phase-F.homePhase[i])*Math.PI/4;
      p.post.position.y=height/2;p.post.scale.y=height;
      p.outline.visible=p.key===feedback.selected;
      // Billboard pick envelopes stay attached to their own chair at every level.
      p.pick.position.set(0,height+.88,0);p.pick.quaternion.copy(camera.quaternion);
    });
  }
  const valuesAt=state=>model.parameters(state).map(p=>({phase:p.phase,gain:F.gain(p)}));
  function sync(){if(!animating&&!dragging&&!committed&&!disposed)draw(valuesAt(model.snapshot()));}
  const view={camera,sync,
    dispose(){disposed=true;dragging=null;},
    resize(aspect){
      const extent=Math.max(2.75,2.5/aspect);camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;
      camera.updateMatrixWorld();draw(display);
    },
    pickTargets:()=>people.map(p=>p.pick),
    hit(intersection){
      const cursor=intersection.point.clone().project(camera);
      const p=people.map(p=>({p,d:p.pick.getWorldPosition(new T.Vector3()).project(camera).sub(cursor).setZ(0).lengthSq()})).sort((a,b)=>a.d-b.d)[0].p;
      return{key:p.key,pieceId:p.index,kind:'chair',draggable:true,selectOnly:true};
    },
    locations(){root.updateMatrixWorld(true);return people.map(p=>({key:p.key,pieceId:p.index,kind:'chair',draggable:true,selectOnly:true,
      point:p.pick.getWorldPosition(new T.Vector3()),region:[[-.5,-.575],[.5,-.575],[.5,.575],[-.5,.575]].map(([x,y])=>p.pick.localToWorld(new T.Vector3(x,y,0)))}));},
    feedback(value){feedback=value;people.forEach(p=>{p.outline.visible=p.key===value.selected;});},
    updateMusic({phase,playing,rows,periodSeconds}){
      let changed=false;
      people.forEach((p,i)=>{
        let reaction=0;
        if(playing&&!dragging&&!animating&&!feedback.focus)for(const e of rows[i]||[]){
          const age=(((phase-e.start)%1+1)%1)*periodSeconds;
          if(age<.14)reaction=Math.max(reaction,(1-age/.14)*Math.min(1,(e.volume??1)*(e.value.velocity??1)));
        }
        if(Math.abs(reaction-p.reaction)>.002){p.reaction=reaction;p.hands.forEach((hand,j)=>hand.position.y=.31+reaction*(j?.07:.12));p.talk.visible=reaction>.1;changed=true;}
      });
      return changed;
    },
    beginDrag(hit,world){
      if(animating||!world)return false;const index=F.keys.indexOf(hit.key),p=valuesAt(model.snapshot())[index];
      dragging={key:hit.key,index,before:model.snapshot(),start:world.clone(),mode:null,phase:p.phase,gain:p.gain,move:null};committed=null;return true;
    },
    dragTo(world){
      if(!dragging||!world)return;const d=dragging,dx=world.x-d.start.x,dy=world.y-d.start.y;
      if(!d.mode)d.mode=Math.abs(dx)>Math.abs(dy)*.70?'phase':'gain';
      const phase=d.mode==='phase'?d.phase+dx*8/spinDistance:d.phase;
      const gain=d.mode==='gain'?Math.max(0,Math.min(2,d.gain+dy/liftRange)):d.gain;
      // A small detent at the reference gain makes the exact target reachable.
      const finalGain=Math.abs(gain-1)<.025?1:Math.round(gain*1e6)/1e6;
      const values=valuesAt(d.before);values[d.index]={phase,gain};draw(values);
      d.move=model.editPoint(d.key,{phase,gain:finalGain},d.before);
      onEditPreview(d.move,{key:d.key,phase,gain});
    },
    endDrag(cancelled){
      if(!dragging)return null;const old=dragging;dragging=null;onEditPreview(null);
      if(!cancelled&&old.move&&model.validMove(old.move)){committed=JSON.stringify(old.move);return old.move;}
      sync();return null;
    },
    async animate(move,before,{duration=360}={}){
      const direct=committed===JSON.stringify(move);committed=null;animating=true;
      const a=direct?display.map(p=>({...p})):valuesAt(before),b=valuesAt(model.applyTo(before,move)),index=F.keys.indexOf(model.moveTarget(move));
      let delta=((b[index].phase-a[index].phase+4)%8+8)%8-4;
      if(!direct&&typeof move==='string'&&move.endsWith("'"))delta=1;
      if(!direct&&typeof move==='string'&&move.length===1)delta=-1;
      try{await tween('move',direct?140:duration,t=>draw(a.map((p,i)=>i!==index?p:{phase:p.phase+delta*t,gain:p.gain+(b[i].gain-p.gain)*t})));}
      finally{animating=false;sync();}
    }
  };
  sync();return view;
}};
FourierPuzzle.mount=context=>PuzzleControl.mount({...context,module:FourierPuzzle,createView:FourierView.create});
