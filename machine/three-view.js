/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* The assembled instrument's physical view. State, sound and pointer ownership stay outside. */
window.MachineView = {create({scene, resources:R, model, game, onEditPreview=()=>{}, tween}) {
  const T=THREE, TAU=Math.PI*2, own=x=>R.own(x), root=new T.Group(); scene.add(root);
  const camera=new T.OrthographicCamera(-6,6,4.5,-4.5,.1,80);
  const mesh=(g,m,parent=root)=>{const o=new T.Mesh(g,m);parent.add(o);return o;};
  const mat=(color,extra={})=>R.material(color,{roughness:.58,metalness:.26,...extra});
  const ink=mat('#10292e'), edge=mat('#365059'), dark=mat('#071c22'), cream=mat('#d9d8b7'), brass=mat('#b49a68',{metalness:.7,roughness:.35});
  const rubber=mat('#162025',{roughness:.95,metalness:0}), glass=mat('#bed7ca',{transparent:true,opacity:.2,roughness:.25,metalness:.1,depthWrite:false});
  const glow=own(new T.MeshBasicMaterial({color:'#a9e5c9'}));
  const cylinder=(r,h,m,parent=root,segments=24)=>mesh(own(new T.CylinderGeometry(r,r,h,segments)),m,parent);
  const box=(w,h,d,m,parent=root,b=.035)=>mesh(R.bevelBox(w,h,d,b),m,parent);
  const sphere=(r,m,parent=root)=>mesh(own(new T.SphereGeometry(r,16,10)),m,parent);
  const tube=(points,color,radius=.025,parent=root)=>{const o=R.stroke(points,{color,radius});parent.add(o);return o;};
  const torus=(radius,t,m,parent=root)=>mesh(own(new T.TorusGeometry(radius,t,8,40)),m,parent);
  const groups=game.modules||[], picks=[], stations=[];
  const bench=new T.Group();root.add(bench);
  const slab=box(11,.35,7,ink,bench,.1);slab.position.y=-.44;
  const top=box(10.8,.07,6.8,edge,bench,.02);top.position.y=-.23;
  const inlay=box(10.58,.04,6.58,dark,bench,.01);inlay.position.y=-.174;
  const feet=[];
  for(let i=0;i<4;i++){const f=box(.52,.18,.48,rubber,bench);f.position.y=-.69;feet.push(f);}
  const beltGroup=new T.Group();root.add(beltGroup);
  const drive=new T.Group();root.add(drive);
  const driveBase=cylinder(.63,.12,brass,drive,48);driveBase.position.y=.02;
  const driveDisk=cylinder(.56,.15,ink,drive,48);driveDisk.position.y=.14;
  const driveRing=torus(.45,.025,glow,drive);driveRing.rotation.x=-Math.PI/2;driveRing.position.y=.23;
  const rotor=new T.Group();rotor.position.y=.25;drive.add(rotor);
  for(let i=0;i<3;i++){const spoke=box(.075,.04,.67,brass,rotor,.012);spoke.rotation.y=i*TAU/3;spoke.position.set(Math.sin(i*TAU/3)*.11,0,Math.cos(i*TAU/3)*.11);}
  const hub=cylinder(.11,.10,cream,rotor,16);hub.position.y=.035;
  const hand=sphere(.052,glow,rotor);hand.position.set(0,.04,.45);
  const beltLights=[];
  for(let i=0;i<24;i++){const dot=sphere(.026,glow,beltGroup);beltLights.push(dot);}
  let layout='wide',beltPath=null,clock={position:0,phase:0,periodBars:4,periodSeconds:6.4,playing:false,rows:[]},dragging=null,selected=model.selected,disposed=false;
  function tagged(o,key,kind='body'){o.userData={key,kind};picks.push(o);return o;}
  const hitMaterial=own(new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,color:0xffffff}));
  // Device labels are part of the rendered object, not a second DOM inspector.
  function labelSprite(parent,width=2.55,height=.60){
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=120;
    const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;
    const material=own(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false}));
    const sprite=new T.Sprite(material);sprite.scale.set(width,height,1);sprite.renderOrder=100;parent.add(sprite);
    let cached='';
    return {sprite,draw(name,sub,color){const signature=[name,sub,color].join('|');if(signature===cached)return;cached=signature;
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,120);ctx.fillStyle='#0c222a';ctx.beginPath();ctx.roundRect(0,0,512,120,15);ctx.fill();
      ctx.strokeStyle=color;ctx.lineWidth=3;ctx.stroke();ctx.textAlign='center';ctx.fillStyle='#e6e9d7';let fontSize=54;ctx.font='600 '+fontSize+'px Arial';while(fontSize>32&&ctx.measureText(name).width>468){fontSize--;ctx.font='600 '+fontSize+'px Arial';}ctx.fillText(name,256,50);
      ctx.fillStyle=color;ctx.font='500 29px Arial';ctx.fillText(sub,256,94,480);texture.needsUpdate=true;
    }};
  }
  function cartridgeFace(parent,definition){
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=112;
    const texture=own(new T.CanvasTexture(canvas));texture.colorSpace=T.SRGBColorSpace;
    const material=own(new T.MeshBasicMaterial({map:texture}));
    const surface=mesh(own(new T.PlaneGeometry(1.14,.40)),material,parent);surface.position.set(0,0,.105);
    let cached='';
    return {surface,draw(part){const variant=definition.variants[part.variant],signature=part.variant+':'+(variant?.events.length||0);if(signature===cached)return;cached=signature;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#d9d8b7';ctx.fillRect(0,0,320,112);ctx.fillStyle='#19363b';ctx.font='600 29px Arial';ctx.fillText(definition.variants.length?'РИФ '+(part.variant+1)+' / '+definition.variants.length:'НЕТ ПАРТИИ',15,34);
      ctx.fillStyle='#29474b';ctx.font='29px Arial';ctx.fillText('›',286,34);ctx.strokeStyle='#9a9e8c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(14,91);ctx.lineTo(304,91);ctx.stroke();
      for(const e of variant?.events||[]){const x=15+e.start*285,y=47+(((e.pitch??0)%12)/12)*24;ctx.fillStyle=definition.color;ctx.fillRect(x,y,Math.max(3,e.duration*260),8);ctx.fillStyle='#274048';ctx.fillRect(x,y,3,8);}
      texture.needsUpdate=true;
    }};
  }
  function headFor(key,parent,c,light){
    const moving=[];
    if(key==='pulse'){
      const drum=cylinder(.58,.43,c,parent);drum.position.set(-.28,.3,0);
      const rim=cylinder(.62,.08,brass,parent);rim.position.set(-.28,.55,0);
      const membrane=cylinder(.54,.025,cream,parent);membrane.position.set(-.28,.602,0);
      for(let i=0;i<8;i++){const peg=box(.055,.32,.055,brass,parent,.008);const a=i*TAU/8;peg.position.set(-.28+Math.sin(a)*.6,.3,Math.cos(a)*.6);}
      const support=box(.19,1.2,.2,edge,parent);support.position.set(.72,.62,-.12);
      const pivot=new T.Group();pivot.position.set(.72,1.19,-.12);parent.add(pivot);
      const arm=box(1.05,.12,.12,brass,pivot);arm.position.x=-.44;
      const mallet=box(.23,.27,.27,c,pivot);mallet.position.set(-.92,-.16,0);
      const head=box(.27,.08,.29,cream,pivot);head.position.set(-.92,-.32,0);
      return {beat(hit,cycle){pivot.rotation.z=.1+hit*.2;membrane.scale.y=1+hit*2;},parts:[drum,membrane]};
    }
    if(key==='bass'){
      const bellows=new T.Group();parent.add(bellows);
      for(let i=0;i<9;i++){
        const fold=box(.11,.95-i%2*.09,.78-i%2*.07,i%2?ink:c,bellows,.015);fold.position.set((i-4)*.13,.58,0);
      }
      const left=box(.17,1.05,.89,brass,parent);left.position.set(-.69,.58,0);
      const right=box(.17,1.05,.89,brass,parent);right.position.set(.69,.58,0);
      const mouth=box(.25,.44,.45,dark,parent);mouth.position.set(.91,.54,0);
      for(let i=0;i<4;i++){const vent=box(.018,.31,.03,brass,parent,.003);vent.position.set(1.04,.54,(i-1.5)*.1);}
      const pipe=torus(.29,.075,brass,parent);pipe.position.set(-.86,.6,0);pipe.rotation.y=Math.PI/2;
      return {beat(hit,cycle){const x=1-hit*.25;bellows.scale.x=x;left.position.x=-.69*x;right.position.x=.69*x;},parts:[bellows]};
    }
    if(key==='percussion'){
      const topbar=box(1.9,.12,.14,brass,parent);topbar.position.set(0,1.4,0);
      for(const x of [-.89,.89]){const post=box(.09,1.38,.1,edge,parent);post.position.set(x,.68,0);}
      const tubes=[];
      for(let i=0;i<5;i++){
        const p=new T.Group();p.position.set((i-2)*.32,1.34,0);parent.add(p);
        const length=.55+i*.11,t=cylinder(.09,length,i%2?cream:c,p,12);t.position.y=-length/2-.1;
        const string=box(.012,.1,.012,brass,p,.003);string.position.y=-.05;tubes.push(p);
      }
      const clapper=sphere(.13,brass,parent);clapper.position.set(0,.57,.27);
      return {beat(hit,cycle){tubes.forEach((t,i)=>t.rotation.x=hit*Math.sin(cycle*TAU*8+i)*.35);clapper.position.z=.25+hit*.3;},parts:tubes};
    }
    if(key==='melody'){
      const housing=box(1.98,.22,1.05,c,parent);housing.position.y=.2;
      const ribbon=box(1.3,.026,.69,cream,parent,.002);ribbon.position.y=.43;
      const rolls=[];
      for(const x of [-.8,.8]){
        const roller=cylinder(.24,.86,brass,parent);roller.rotation.x=Math.PI/2;roller.position.set(x,.49,0);rolls.push(roller);
        for(const z of [-.47,.47]){const rim=cylinder(.29,.055,ink,parent);rim.rotation.x=Math.PI/2;rim.position.set(x,.49,z);}
      }
      const holes=own(new T.InstancedMesh(R.bevelBox(.038,.009,.05,.002),dark,192));parent.add(holes);
      let notes=[],layoutKey='';const stamp=new T.Object3D();
      const reader=box(.13,.1,.87,brass,parent);reader.position.set(.06,.59,0);
      const lightBar=box(.025,.025,.7,light,parent,.005);lightBar.position.set(.02,.65,0);
      return {
        setEvents(events){const key=events.map(e=>[e.start,e.pitch]).join('|');if(key!==layoutKey){layoutKey=key;notes=events.slice(0,192);holes.count=notes.length;}},
        beat(hit,cycle,localPhase){
          rolls.forEach(o=>o.rotation.z=cycle*TAU*2);
          notes.forEach((event,i)=>{stamp.position.set((((event.start-localPhase)%1+1)%1-.5)*1.12,.45,(((event.pitch??i)%5)-2)*.12);stamp.updateMatrix();holes.setMatrixAt(i,stamp.matrix);});
          holes.instanceMatrix.needsUpdate=true;lightBar.scale.y=1+hit*3;
        },parts:[ribbon]};
    }
    if(key==='texture'){
      const plate=box(1.95,.17,1.05,c,parent);plate.position.y=.25;
      const comb=[];
      for(let i=0;i<9;i++){
        const length=.65+Math.sin(i*.65)*.25,t=box(.11,.045,length,i%2?cream:brass,parent,.012);t.position.set((i-4)*.19,.37,-.15);comb.push(t);
      }
      const bar=box(1.9,.09,.13,edge,parent);bar.position.set(0,.44,-.49);
      const arch=torus(.56,.055,brass,parent);arch.position.set(0,.64,.2);arch.scale.set(1.35,.55,1);
      const bead=sphere(.14,c,parent);bead.position.set(0,.63,.2);
      return {beat(hit,cycle){comb.forEach((t,i)=>{t.position.y=.37+hit*Math.sin(i+cycle*TAU*10)*.06;});bead.position.x=Math.sin(cycle*TAU)*.6;},parts:comb};
    }
    const tank=cylinder(.43,1.05,c,parent,6);tank.position.set(-.28,.65,0);
    const lower=cylinder(.47,.12,brass,parent,6);lower.position.set(-.28,.13,0);
    const upper=cylinder(.47,.1,cream,parent,6);upper.position.set(-.28,1.2,0);
    const window=box(.27,.57,.025,glass,parent);window.position.set(-.28,.68,.379);
    const airBulb=sphere(.15,light,parent);airBulb.position.set(-.28,.6,.2);
    const nozzle=mesh(own(new T.ConeGeometry(.37,.65,24,1,true)),brass,parent);nozzle.rotation.z=Math.PI/2;nozzle.position.set(.49,.85,0);
    const mouth=cylinder(.36,.025,dark,parent);mouth.rotation.z=Math.PI/2;mouth.position.set(.81,.85,0);
    const rim=torus(.36,.038,cream,parent);rim.rotation.y=Math.PI/2;rim.position.set(.84,.85,0);
    return {beat(hit,cycle){airBulb.scale.setScalar(1+hit*.6);tank.scale.y=1+hit*.04;},parts:[tank]};
  }
  groups.forEach((definition,index)=>{
    const key=definition.key,station=new T.Group();root.add(station);
    const c=mat(definition.color),light=own(new T.MeshBasicMaterial({color:definition.color}));
    const base=box(2.63,.16,2.35,ink,station,.065);base.position.y=.0;
    const inset=box(2.46,.035,2.17,dark,station,.012);inset.position.y=.099;
    const border=R.stroke([[-1.25,.125,-1.1],[1.25,.125,-1.1],[1.25,.125,1.1],[-1.25,.125,1.1]],{color:definition.color,radius:.016,closed:true});station.add(border);
    const body=new T.Group();body.position.y=.12;station.add(body);
    const instrument=headFor(key,body,c,light);
    // Engagement opacity belongs to this device. Never fade a shared brass or
    // cream material, which would also fade another connected instrument.
    const localMaterials=new Map();
    body.traverse(o=>{if(!o.isMesh)return;const source=o.material;
      if(!localMaterials.has(source)){const m=own(source.clone());m.userData.baseOpacity=source.opacity;m.userData.baseTransparent=source.transparent;m.userData.baseDepthWrite=source.depthWrite;localMaterials.set(source,m);}
      o.material=localMaterials.get(source);
    });
    const pickHeight={pulse:1.38,bass:1.20,percussion:1.48,melody:.82,texture:1.10,air:1.30}[key]||1.3;
    const bodyPick=tagged(box(2.1,pickHeight,1.36,hitMaterial,station),key,'gain');bodyPick.position.set(0,.12+pickHeight/2,-.13);
    const socket=box(1.48,.035,.17,brass,station,.009);socket.position.set(0,.12,.64);
    for(let j=0;j<6;j++){const port=box(.07,.018,.06,dark,station,.002);port.position.set((j-2.5)*.2,.145,.64);}
    const dialGroup=new T.Group();dialGroup.position.set(.78,.29,1.01);station.add(dialGroup);
    const dial=cylinder(.265,.085,edge,dialGroup,32);dial.rotation.x=Math.PI/2;
    const dialFace=cylinder(.22,.01,cream,dialGroup,32);dialFace.rotation.x=Math.PI/2;dialFace.position.z=.049;
    const dialHit=tagged(mesh(own(new T.CircleGeometry(.34,32)),hitMaterial,dialGroup),key,'phase');dialHit.position.z=.07;
    const needle=box(.032,.17,.019,c,dialGroup,.006);needle.position.set(0,.075,.06);
    const needleRoot=new T.Group();dialGroup.remove(needle);needleRoot.add(needle);dialGroup.add(needleRoot);
    const led=sphere(.055,light,station);led.position.set(-1.04,.21,.98);
    const cartridge=new T.Group();cartridge.position.set(-.35,.32,1.02);station.add(cartridge);
    const casing=box(1.28,.50,.21,c,cartridge,.035);
    const cartridgeArt=cartridgeFace(cartridge,definition);
    const cartridgePick=tagged(box(1.34,.55,.27,hitMaterial,cartridge,.02),key,'variant');cartridgePick.position.z=.025;
    const pull=box(.22,.09,.14,brass,cartridge,.015);pull.position.set(0,.285,.02);
    const nameplate=labelSprite(station);nameplate.sprite.position.set(0,-.12,1.48);
    const gainRail=box(.045,1.2,.065,brass,station,.009);gainRail.position.set(-1.12,.77,.63);
    const gainKnob=box(.20,.11,.17,c,station,.025);gainKnob.position.set(-1.12,.85,.67);
    const gainPick=tagged(box(.38,.25,.29,hitMaterial,station,.02),key,'gain');gainPick.position.copy(gainKnob.position);
    for(let i=0;i<4;i++){const mark=box(.08,.02,.025,cream,station,.004);mark.position.set(-1.01,.22+i*.35,.65);}
    const phaseTicks=[];
    for(let i=0;i<8;i++){const mark=box(.02,.045,.015,brass,dialGroup,.004),a=i*TAU/8;mark.position.set(Math.sin(a)*.29,Math.cos(a)*.29,.045);mark.rotation.z=-a;phaseTicks.push(mark);}

    const posts=[];
    for(const x of [-.95,.95]){
      const post=cylinder(.045,1.5,edge,station,8);post.position.set(x,.85,-.67);posts.push(post);
    }
    const connector=box(.23,.07,.5,brass,station);connector.position.set(0,.04,-1.27);
    const selection=R.stroke([[-1.29,.15,-1.14],[1.29,.15,-1.14],[1.29,.15,1.14],[-1.29,.15,1.14]],{color:'#ffe6b1',radius:.027,closed:true});station.add(selection);selection.visible=false;
    stations.push({key,index,definition,group:station,body,bodyPick,instrument,border,selection,dial:needleRoot,dialGroup,cartridge,cartridgePick,cartridgeArt,nameplate,gainKnob,gainPick,led,connector,c,light,posts,pickHeight,gain:1,installed:true,preview:null});
  });
  let linkObjects=[];
  function links(){
    for(const o of linkObjects){root.remove(o);for(const item of [o.geometry,o.material]){R.items.delete(item);item.dispose();}}
    linkObjects=[];
    const mobile=layout==='tall', w=mobile?6.1:10.8,d=mobile?10.35:6.5;
    slab.scale.set(w/11,1,d/7);top.scale.set(w/11,1,d/7);inlay.scale.set(w/11,1,d/7);
    feet.forEach((f,i)=>f.position.set((i%2?1:-1)*(w/2-.5),-.69,(i<2?1:-1)*(d/2-.45)));
    const points=mobile?[[-.36,.035,-4.5],[.36,.035,-4.5],[.36,.035,4.5],[-.36,.035,4.5]]:[[-4.83,.035,-.30],[4.83,.035,-.30],[4.83,.035,.30],[-4.83,.035,.30]];
    const path=points.map(p=>new T.Vector3(...p));path.push(path[0].clone());beltPath=new T.CurvePath();
    for(let i=1;i<path.length;i++)beltPath.add(new T.LineCurve3(path[i-1],path[i]));
    const belt=tube([...points,points[0]],'#486567',.085);linkObjects.push(belt);
    const inner=tube([...points.map(p=>[p[0],p[1]+.05,p[2]]),[points[0][0],points[0][1]+.05,points[0][2]]],'#bdd6bd',.014);linkObjects.push(inner);
    stations.forEach((s,i)=>{
      const x=mobile?(i%2?1.60:-1.60):(i%3-1)*3.38,z=mobile?(Math.floor(i/2)-1)*3.12:(i<3?-1.95:1.95);
      s.group.position.set(x,0,z);
      const p=mobile?[[x,0,z],[x*.3,.0,z],[Math.sign(x)*.36,.0,z]]:[[x,0,z],[x,0,z*.3],[x,0,Math.sign(z)*.3]];
      const pipe=tube(p,'#243f46',.092);linkObjects.push(pipe);
      const wire=tube(p.map(a=>[a[0],a[1]+.07,a[2]]),s.definition.color,.025);linkObjects.push(wire);s.wire=wire;
    });
  }
  function sync(){
    if(disposed)return;
    const state=model.snapshot();selected=model.selected??selected;
    stations.forEach(s=>{
      const p=state.parts.find(p=>p.key===s.key);if(!p)return;
      const current=dragging?.key===s.key?{...p,...dragging.patch}:p;
      s.installed=current.installed;s.gain=current.gain;s.phase=current.phase;
      s.instrument.setEvents?.(s.definition.variants[current.variant]?.events||[]);
      // Lift has a literal acoustic reading: raised components are louder. Removed heads remain on the dock, disengaged.
      s.body.position.y=.12+(current.installed?current.gain*.28:.60);
      s.body.scale.setScalar(current.installed?1:.88);
      s.body.traverse(o=>{if(o.isMesh&&o.material!==hitMaterial){const m=o.material;m.transparent=m.userData.baseTransparent||!current.installed;m.opacity=m.userData.baseOpacity*(current.installed?1:.28);m.depthWrite=m.userData.baseDepthWrite&&current.installed;}});
      s.bodyPick.scale.y=current.installed?1:.88;s.bodyPick.position.y=s.body.position.y+s.pickHeight*s.bodyPick.scale.y/2;
      s.dial.rotation.z=-current.phase*TAU;
      s.gainKnob.position.y=.24+current.gain*.70;s.gainPick.position.copy(s.gainKnob.position);
      s.cartridgeArt.draw(current);
      s.nameplate.draw(s.definition.name||s.key,(s.definition.available===false?'НЕТ ПАРТИИ':current.installed?'ВКЛ · '+Math.round(current.gain*100)+'%':'НЕ ПОДКЛЮЧЕНО')+' · '+Math.round(current.phase*8)+'/8',s.definition.color);
      s.led.scale.setScalar(current.installed?1:.5);s.selection.visible=s.key===selected;s.nameplate.sprite.visible=s.key===selected;
      s.border.visible=current.installed;s.wire&&(s.wire.visible=current.installed);
    });
  }
  function animateSound(){
    const cycle=clock.position||0,period=clock.periodBars||game.periodBars||4,phase=((cycle/period)%1+1)%1;
    rotor.rotation.y=-cycle*TAU;
    if(beltPath)beltLights.forEach((p,i)=>{p.position.copy(beltPath.getPoint(((i/24+cycle*.18)%1+1)%1));p.position.y+=.05;p.visible=clock.playing;});
    stations.forEach((s,i)=>{
      const row=clock.rows?.[i]||[], events=Array.isArray(row)?row:row.events||[];let strength=0;
      if(clock.playing&&s.installed&&s.gain>0)for(const event of events){const t=event.start??event.time??0,age=((phase-t)%1+1)%1*(clock.periodSeconds||6.4);if(age<.2)strength=Math.max(strength,1-age/.2);}
      s.instrument.beat(strength,clock.playing&&s.installed?cycle:0,phase-(s.phase||0)/period);
      s.led.scale.setScalar(s.installed?.85+strength*.65:.4);
    });
  }
  function selectedStation(){return stations.find(s=>s.key===(dragging?.key||model.selected||selected))||stations[0];}
  const view={camera,
    resize(aspect){
      const next=aspect<.95?'tall':'wide';if(next!==layout||!beltPath){layout=next;links();sync();}
      camera.position.set(layout==='tall'?0:4.5,layout==='tall'?20:16,layout==='tall'?10:12);camera.lookAt(0,.2,0);
      const half=layout==='tall'?Math.max(5.7,3.70/aspect):Math.max(4.45,6.25/aspect);
      camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      stations.forEach(s=>{s.dialGroup.rotation.x=layout==='tall'?-Math.PI/3:-Math.PI/4;s.cartridge.rotation.x=s.dialGroup.rotation.x;});root.updateMatrixWorld(true);
    },
    sync, pickTargets:()=>picks,
    hit({object}){return {key:object.userData.key,kind:object.userData.kind,selectOnly:true,draggable:object.userData.kind!=='variant'};},
    locations(){return stations.flatMap(s=>[
      {key:s.key,kind:'gain',selectOnly:true,draggable:true,point:s.bodyPick.getWorldPosition(new T.Vector3())},
      {key:s.key,kind:'phase',selectOnly:true,draggable:true,point:s.dialGroup.localToWorld(new T.Vector3(0,.18,.08))},
      {key:s.key,kind:'variant',selectOnly:true,draggable:false,point:s.cartridgePick.localToWorld(new T.Vector3(0,0,.14))}
    ]);},
    feedback(value){selected=value?.selected??model.selected;stations.forEach(s=>{s.selection.visible=s.key===selected;s.nameplate.sprite.visible=s.key===selected;});},
    animate(){sync();return Promise.resolve();},
    inputPlane(){const s=selectedStation();return new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()).negate(),s.dialGroup.getWorldPosition(new T.Vector3()));},
    beginDrag(hit,point){
      if(!point||hit.kind==='variant')return false;const s=stations.find(s=>s.key===hit.key),p=model.snapshot().parts.find(p=>p.key===hit.key);if(!s||!p)return false;
      const center=s.dialGroup.getWorldPosition(new T.Vector3()),local=s.dialGroup.worldToLocal(point.clone());
      dragging={key:hit.key,kind:hit.kind,start:point.clone(),before:p,center,dial:s.dialGroup,angle:Math.atan2(local.y,local.x),patch:{}};
      return true;
    },
    dragTo(point){
      if(!point||!dragging)return;const d=dragging;
      if(d.kind==='phase'){
        const local=d.dial.worldToLocal(point.clone()),angle=Math.atan2(local.y,local.x),delta=Math.atan2(Math.sin(angle-d.angle),Math.cos(angle-d.angle));
        d.patch={phase:((Math.round((d.before.phase-delta/TAU)*8)/8)%1+1)%1};
      }else d.patch={gain:Math.round(Math.max(0,Math.min(1.5,d.before.gain+(point.y-d.start.y)*.8))*20)/20};
      sync();onEditPreview({key:d.key,patch:d.patch},{key:d.key,...d.patch});
    },
    endDrag(cancelled){const d=dragging;dragging=null;onEditPreview(null);sync();if(cancelled||!d||!Object.keys(d.patch).length)return null;return{key:d.key,patch:d.patch};},
    updateMusic(value){clock={...clock,...value};animateSound();return clock.playing;},
    inspect(){return {layout,selected,parts:stations.map(s=>({key:s.key,installed:s.installed,gain:s.gain,position:s.group.position.toArray()})),clock:{position:clock.position,playing:clock.playing}};},
    dispose(){disposed=true;dragging=null;}
  };
  links();sync();return view;
}};
