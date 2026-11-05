/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoScene = (() => {
  // The four live stations on the Duet bench read left-to-right. Spare
  // modules stay within reach, in a separate row on portrait displays.
  const stations = {
    source:{label:'Шестерня',w:3.5,d:2.05,wide:[-4.50,-1.30],tall:[-1.95,-3.35]},
    router:{label:'Развилка',w:2.65,d:1.9,wide:[-.10,-1.30],tall:[2.05,-3.35]},
    keys:{label:'Клавиши',w:1.65,d:1.5,wide:[4.05,-2.80],tall:[2.12,-.02]},
    bell:{label:'Колокол',w:1.65,d:1.5,wide:[4.05,.25],tall:[-1.92,-.02]},
    copy:{label:'Копир',w:1.65,d:1.5,wide:[-4.08,2.30],tall:[-2.83,3.18]},
    delay:{label:'Задержка',w:2,d:1.55,wide:[-.30,2.50],tall:[-.06,3.18]},
    bin:{label:'Корзина',w:1.65,d:1.5,wide:[4.05,3.45],tall:[2.75,3.18]}
  };
  const inserts=new Set(['copy','delay','router']);
  const make=(tag,cls)=>Object.assign(document.createElement(tag),{className:cls});
  function allowed(state,action) {
    try { IsoFlow.apply(state,action); return true; }
    catch { return false; }
  }
  function reachable(links) {
    const active=new Set(['source']);
    function walk(id) {
      for(const port of IsoFlow.PORTS[id]){
        const to=links[id+':'+port];
        if(to&&!active.has(to)){active.add(to);walk(to);}
      }
    }
    walk('source');
    return active;
  }
  function mount(host,callbacks){
    host.classList.add('iso-board');
    let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
    catch{return null;}
    const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.append(canvas);
    renderer.setClearColor(0xedeadd,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,110);
    const hemi=new THREE.HemisphereLight(0xfffaeb,0xa5ada4,1.8);scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffecce,2.25);sun.position.set(-5,12,4);scene.add(sun);
    const fill=new THREE.DirectionalLight(0xb7e5f3,.65);fill.position.set(4,5,-6);scene.add(fill);
    const physical=color=>new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.08,side:THREE.DoubleSide});
    const materials={belt:physical(0x365a52),rail:physical(0xb09b6e),tread:physical(0x728b76),
      target:physical(0x229071),pick:physical(0x9cce9e),a:physical(0x247e77),b:physical(0xc46437),
      chosenA:physical(0x168e7f),chosenB:physical(0xe47a3c),quiet:physical(0x8d998b),
      arrow:new THREE.MeshBasicMaterial({color:0xfff5d2,side:THREE.DoubleSide})};
    const table=new THREE.Group(),belts=new THREE.Group(),boxes=new THREE.Group(),marks=new THREE.Group();
    scene.add(table,belts,boxes,marks);
    const overlay=make('div','iso-overlay');host.append(overlay);
    const ghost=make('span','iso-drag-label');ghost.hidden=true;overlay.append(ghost);
    const pieces={},buttons={},sockets={},routes=new Map(),tokenPool=[],tokenMaterials=new Map();
    const tokenGeometry=new THREE.BoxGeometry(.27,.19,.22),ray=new THREE.Raycaster();
    const mutedMaterials=new Map(),originalMaterial=new WeakMap();
    const dormantTone=new THREE.Color(0xc9c6b4);
    function setDormant(part,off){
      if(part.dormant===off)return;
      part.dormant=off;
      part.group.traverse(mesh=>{
        const material=mesh.material;
        if(!material?.color)return;
        if(!off){mesh.material=originalMaterial.get(material)||material;return;}
        if(!mutedMaterials.has(material)){
          const muted=material.clone();
          muted.color.lerp(dormantTone,.68);
          mutedMaterials.set(material,muted);originalMaterial.set(muted,material);
        }
        mesh.material=mutedMaterials.get(material);
      });
    }
    const events=new AbortController(),opt={signal:events.signal};
    const vec=(x,y,z)=>new THREE.Vector3(x,y,z);
    let patch=null,insert=null,gesture=null,frame=null,revision=null,lastState=null,linksKey=null,portrait=null,lost=false,dirty=true;
    let disposed=false,width=0,height=0,activeStation=null,lastPointerAt=-Infinity,modeState=null;
    let face=null,overview=null,pose=null,focusId=null,transition=null,litOutlet=null;
    const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let targetStations=new Set(),targetBelts=new Set(),activeStations=new Set();
    // Touch can synthesize a click with detail=0. Pointer-up has already
    // committed that action. Keyboard and assistive activation still use click.
    function accessibleActivation(e){
      return !e.pointerType && e.detail===0 && performance.now()-lastPointerAt>450;
    }
    function select(id){callbacks.select(id);}
    function syncTargets(){
      const state=frame?.editState||frame?.state;
      if(!state)return;
      modeState=state;
      activeStations=reachable(state.links);
      targetStations=new Set();
      targetBelts=new Set();
      if(patch) for(const id of Object.keys(stations)){
        if(allowed(state,{type:'connect',from:patch,to:id}))targetStations.add(id);
      }
      if(insert) for(const from of Object.keys(state.links)){
        if(allowed(state,{type:'insert',node:insert,from}))targetBelts.add(from);
      }
      for(const [id,b] of Object.entries(buttons)){
        b.dataset.active=String(activeStations.has(id));
        b.dataset.destination=String(targetStations.has(id));
        b.disabled=!!insert || (!!patch && !targetStations.has(id));
        b.setAttribute('aria-label',(patch?'Соединить с деталью ':'Выбрать: ')+stations[id].label);
      }
      placeInsertButtons();markBelt(null);dirty=true;
    }
    function clearPatch(){if(patch)setPatch(null);}
    function setPatch(key){
      if(key&&insert)setInsert(null);
      patch=key||null;host.toggleAttribute('data-patching',!!patch);
      callbacks.patchChanged?.(patch);syncTargets();
    }
    function setInsert(id){
      if(id&&patch)setPatch(null);
      insert=inserts.has(id)?id:null;host.toggleAttribute('data-inserting',!!insert);
      callbacks.insertChanged?.(insert);syncTargets();
    }
    function cancelMode(){if(patch)setPatch(null);if(insert)setInsert(null);}
    function connect(id){
      if(targetStations.has(id)&&callbacks.connect(patch,id)!==false)clearPatch();
    }
    function install(id,from){
      if(from&&callbacks.act({type:'insert',node:id,from})!==false)setInsert(null);
    }
    function project(point){
      const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};
    }
    function socketPos(key){const s=sockets[key];return pieces[s.id].group.localToWorld(s.local.clone());}
    function placeDOM(){
      scene.updateMatrixWorld(true);camera.updateMatrixWorld();
      for(const [id,part] of Object.entries(pieces)){
        const s=stations[id],c=part.group.position.clone();
        c.z+=s.d*.54;c.y=-.03;
        const button=buttons[id];
        button.hidden=!!focusId||!!transition;
        if(button.hidden)continue;
        const p=project(c),w=button.offsetWidth;
        button.style.left=Math.max(w/2+2,Math.min(width-w/2-2,p.x))+'px';
        button.style.top=Math.max(22,Math.min(height-22,p.y+8))+'px';
      }
    }
    function placeInsertButtons(){
      const occupied=[];
      for(const [key,r] of routes){
        const b=r.mountButton;
        b.hidden=!insert||!!transition||!targetBelts.has(key);
        if(b.hidden)continue;
        const n=r.samples.length-1;
        let point=r.samples[Math.floor(n/2)],best=-Infinity;
        for(let i=1;i<n;i++){
          const p=r.samples[i],screenSpace=Math.min(p.x,width-p.x,p.y,height-p.y);
          const gap=Math.min(65,...occupied.map(q=>Math.hypot(q.x-p.x,q.y-p.y)));
          const score=gap+Math.min(28,screenSpace)-Math.abs(i/n-.5)*23;
          if(score>best){best=score;point=p;}
        }
        const x=Math.max(24,Math.min(width-24,point.x)),y=Math.max(24,Math.min(height-24,point.y));
        b.style.left=x+'px';b.style.top=y+'px';occupied.push({x,y});
      }
    }
    function projectLocal(id,x,y,z){
      return project(pieces[id].group.localToWorld(vec(x,y,z)));
    }
    function clearGeometry(group,ownMaterials=false){
      const shapes=new Set(),mats=new Set();
      group.traverse(o=>{if(o.geometry)shapes.add(o.geometry);if(o.isInstancedMesh)o.dispose();if(ownMaterials&&o.material){
        for(const m of [].concat(o.material))mats.add(m);
      }});
      shapes.forEach(g=>g.dispose());mats.forEach(m=>{m.map?.dispose();m.dispose();});group.clear();
    }
    function skinTable(bounds){
      clearGeometry(table,true);
      const {left,right,top,bottom}=bounds,w=right-left,d=bottom-top,cx=(left+right)/2,cz=(top+bottom)/2;
      const base=new THREE.Mesh(new THREE.BoxGeometry(w,.25,d),physical(0xdddcc8));base.position.set(cx,-.16,cz);table.add(base);
      const edge=new THREE.Mesh(new THREE.BoxGeometry(w+.03,.15,d+.03),physical(0x95a394));edge.position.set(cx,-.35,cz);table.add(edge);
      const grid=[];
      for(let x=Math.ceil(left);x<right;x+=1)grid.push(x,-.028,top,x,-.028,bottom);
      for(let z=Math.ceil(top);z<bottom;z+=1)grid.push(left,-.028,z,right,-.028,z);
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));
      table.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x71877a,transparent:true,opacity:.14})));
      const feetMat=new THREE.MeshBasicMaterial({color:0x334b3b,transparent:true,opacity:.1,depthWrite:false});
      for(const [id,p] of Object.entries(pieces)){
        const shade=new THREE.Mesh(new THREE.CircleGeometry(1,32),feetMat);shade.rotation.x=-Math.PI/2;
        shade.position.copy(p.group.position).add(vec(.04,-.014,.08));shade.scale.set(stations[id].w*.55,stations[id].d*.6,1);table.add(shade);
      }
    }
    for(const [id,s] of Object.entries(stations)){
      const p=IsoPieces.create(id);pieces[id]=p;p.group.userData.station=id;scene.add(p.group);
      const b=make('button','iso-caption');b.type='button';b.dataset.station=id;
      const name=make('span','iso-name');name.textContent=s.label;b.append(name);
      b.setAttribute('aria-label','Выбрать: '+s.label);
      b.onclick=e=>{if(accessibleActivation(e)){if(patch)connect(id);else if(!insert)select(id);}};
      buttons[id]=b;overlay.append(b);
      for(const [port,local] of Object.entries(p.ports))sockets[id+':'+port]={id,local};
    }
    const selectionMaterial=new THREE.MeshBasicMaterial({color:0x26785c,depthWrite:false});
    const selection=new THREE.Mesh(new THREE.RingGeometry(.95,1,64),selectionMaterial);
    selection.rotation.x=-Math.PI/2;selection.visible=false;marks.add(selection);
    function footprints(){
      return Object.entries(pieces).map(([id,p])=>{
        const {x,z}=p.group.position,{w,d}=stations[id];
        return {left:x-w/2-.04,right:x+w/2+.04,top:z-d/2-.04,bottom:z+d/2+.04};
      });
    }
    const framingCamera=new THREE.OrthographicCamera();
    function orient(cam,yaw,alt){
      cam.position.set(20*yaw,20*alt,20);cam.lookAt(0,0,0);cam.updateMatrixWorld();
    }
    function fit(id){
      const yaw=id ? .055 : (portrait ? .23 : .35);
      const alt=id ? 1.83 : (portrait ? 1.45 : 1.2);
      orient(framingCamera,yaw,alt);
      const rect=new THREE.Box2(),point=new THREE.Vector2();
      function corner(local,station){
        const world=pieces[station].group.localToWorld(local).applyMatrix4(framingCamera.matrixWorldInverse);
        rect.expandByPoint(point.set(world.x,world.y));
      }
      for(const station of id?[id]:Object.keys(pieces)){
        const {w,d}=stations[station];
        const bounds=id&&face?.focusBounds(id);
        const min=bounds?.[0]||[-w*.52-.24,-.4,-d*.56-.38];
        const max=bounds?.[1]||[w*.52+.48,1.76,d*.56+.48];
        for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]])corner(vec(x,y,z),station);
      }
      const center=rect.getCenter(point),cx=center.x,cy=center.y,size=rect.getSize(point);
      const insetX=id?Math.min(32,width*.045):width*.01;
      const insetY=id?Math.max(24,Math.min(50,height*.065)):height*.01;
      const sy=height/Math.max(1,height-2*insetY),sx=width/Math.max(1,width-2*insetX);
      const half=Math.max(size.x*height/width*sx,size.y*sy)/2;
      // A tall phone has space below the step keys for the outgoing belt.
      // Spend the spare headroom there while keeping the full keypad in view.
      const pixel=2*half/height;
      const lift=id==='router'&&height>width
        ? Math.min(64,Math.max(0,((half-size.y/2)/pixel-20)*.62))
        : 0;
      return {cx,cy:cy-lift*pixel,half,yaw,alt};
    }
    function placeCamera(next){
      pose=next;
      orient(camera,pose.yaw,pose.alt);
      const dx=pose.half*width/height;
      camera.left=pose.cx-dx;camera.right=pose.cx+dx;
      camera.top=pose.cy+pose.half;camera.bottom=pose.cy-pose.half;
      camera.updateProjectionMatrix();
      for(const route of routes.values())route.samples=route.worldSamples.map(project);
      placeDOM();placeInsertButtons();dirty=true;
    }
    function aim(id,animate=true){
      focusId=id;host.toggleAttribute('data-detail',!!id);
      const target=id?fit(id):overview;
      if(animate&&pose&&!reduceMotion.matches){
        transition={from:pose,to:target,begin:performance.now()};
      }else{transition=null;placeCamera(target);}
      dirty=true;
    }
    function moveCamera(){
      if(!transition)return;
      const {from,to,begin}=transition,k=Math.min(1,(performance.now()-begin)/330),blend=k*k*(3-2*k);
      if(k===1){transition=null;placeCamera(to);return;}
      const result={};
      for(const key of Object.keys(to))result[key]=THREE.MathUtils.lerp(from[key],to[key],blend);
      placeCamera(result);
    }
    function resize(){
      if(disposed)return;
      width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);
      renderer.setSize(width,height,false);portrait=width/height<1.18;
      const yaw=portrait?.23:.35;
      for(const [id,p] of Object.entries(pieces)){
        const [x,z]=stations[id][portrait?'tall':'wide'];
        p.group.position.set(x+(portrait?yaw*z:0),0,z-(portrait?0:.25*x));
      }
      const footprintsAll=footprints();
      const bounds={left:Math.min(...footprintsAll.map(o=>o.left))-.87,right:Math.max(...footprintsAll.map(o=>o.right))+.87,
        top:Math.min(...footprintsAll.map(o=>o.top))-.91,bottom:Math.max(...footprintsAll.map(o=>o.bottom))+.91};
      skinTable(bounds);scene.updateMatrixWorld(true);
      overview=fit(null);
      aim(frame?.selected&&!patch&&!insert?frame.selected:null,false);
      linksKey=null;dirty=true;
      if(frame)render(frame);
    }
    function travelArrows(carrier,path){
      // A line of raised arrows identifies the chosen belt even with the motor stopped.
      const shape=new THREE.Shape();
      shape.moveTo(-.125,-.08);shape.lineTo(0,.075);shape.lineTo(.125,-.08);
      shape.lineTo(.125,-.01);shape.lineTo(0,.145);shape.lineTo(-.125,-.01);shape.closePath();
      const geo=new THREE.ShapeGeometry(shape);geo.rotateX(Math.PI/2);
      const length=path.getLength(),count=Math.max(1,Math.round(length/.61));
      const arrows=new THREE.InstancedMesh(geo,materials.arrow,count),stamp=new THREE.Object3D();
      for(let i=0;i<count;i++){
        const t=(i+.5)/count,dir=path.getTangentAt(t);
        stamp.position.copy(path.getPointAt(t));stamp.position.y+=.036;
        stamp.rotation.y=Math.atan2(dir.x,dir.z);stamp.updateMatrix();arrows.setMatrixAt(i,stamp.matrix);
      }
      carrier.add(arrows);arrows.visible=false;
      return arrows;
    }
    function rebuild(links){
      for(const route of routes.values())route.mountButton.remove();
      clearGeometry(belts);routes.clear();const prior=[],obstacles=footprints();
      for(const [key,id] of Object.entries(links)){
        if(!sockets[key]||!sockets[id+':in'])continue;
        const plan=IsoBelts.plan(socketPos(key),socketPos(id+':in'),key.split(':')[1],obstacles,prior);
        const carrier=new THREE.Group();belts.add(carrier);
        const path=IsoBelts.build(carrier,plan,materials);
        const tone=key==='router:straight'?materials.a:key==='router:side'?materials.b:materials.belt;
        const worldSamples=path.getSpacedPoints(Math.max(8,Math.ceil(path.getLength()*4)));
        const arrows=key.startsWith('router:')?travelArrows(carrier,path):null;
        const ends=[[key.split(':')[0],key.split(':')[1],socketPos(key)],[id,'in',socketPos(id+':in')]];
        for(const [station,port,pos] of ends){
          if(station==='router')continue; // Its two coloured rails already span the pedestal.
          const vertical=port==='copy';
          const shoe=new THREE.Mesh(new THREE.BoxGeometry(vertical?.36:.43,.09,vertical?.43:.36),tone);
          shoe.position.copy(pos);shoe.position.y=.24;
          if(vertical)shoe.position.z-=.20;
          else shoe.position.x+=(port==='in'?.20:-.20);
          carrier.add(shoe);
        }
        const mountButton=make('button','iso-insert-point');mountButton.type='button';mountButton.textContent='+';
        mountButton.title='Вставить между деталями «'+stations[key.split(':')[0]].label+'» и «'+stations[id].label+'»';
        mountButton.setAttribute('aria-label',mountButton.title);
        mountButton.dataset.insertBelt=key;
        mountButton.onclick=()=>{if(insert)install(insert,key);};
        overlay.append(mountButton);
        prior.push(plan.points);routes.set(key,{path,to:id,worldSamples,samples:worldSamples.map(project),arrows,carrier,tone,mountButton});
      }
      placeInsertButtons();markBelt(null);
    }
    function tokenAt(i){
      if(!tokenPool[i]){const m=new THREE.Mesh(tokenGeometry,materials.tread);tokenPool[i]=m;boxes.add(m);}
      return tokenPool[i];
    }
    // An event's path is the full history of this particular box, including
    // the copier outlet. Share a trunk until the press divides it. The next
    // attack determines arrival time; a real pocket interrupts the journey.
    let forecastRevision=null, forecastStep=null, journeys=[];
    function forecast(active,step) {
      if(forecastRevision===active&&forecastStep===step)return;
      forecastRevision=active;forecastStep=step;
      const events=IsoFlow.tick(active,step).edges, byPath=new Map();
      const segments=events.map(edge=>{
        const segment={edge,children:[],start:0,end:1};
        byPath.set(edge.origin+edge.path,segment);
        return segment;
      });
      const roots=[];
      for(const s of segments){
        const e=s.edge, parent=byPath.get(e.origin+e.path.slice(0,e.path.lastIndexOf('/')));
        if(parent&&!(e.from==='delay:out'&&active.state.delay>0))parent.children.push(s);
        else roots.push(s);
      }
      function depth(s){s.depth=1+Math.max(0,...s.children.map(depth));return s.depth;}
      function time(s,start){s.start=start;s.end=start+(1-start)/s.depth;for(const child of s.children)time(child,s.end);}
      for(const r of roots){depth(r);time(r,0);}
      journeys=segments;
    }
    function showFlow(active,step,progress,playing){
      let used=0;
      if(playing){
        forecast(active,step+1);
        for(const s of journeys){
          if(progress<s.start||progress>=s.end)continue;
          const edge=s.edge,route=routes.get(edge.from);if(!route||edge.to!==route.to)continue;
          const token=tokenAt(used++),color=IsoPieces.noteColor(edge.pitch);
          if(!tokenMaterials.has(color))tokenMaterials.set(color,physical(color));
          token.material=tokenMaterials.get(color);token.visible=true;
          const along=(progress-s.start)/(s.end-s.start);
          token.position.copy(route.path.getPointAt(along));
          token.scale.set(1,.72+Math.min(1.6,edge.gain??1)*.44,.65+edge.length*.5);
          token.position.y+=.10*token.scale.y+.02;
          const dir=route.path.getTangentAt(along);token.rotation.y=Math.atan2(dir.x,dir.z);
        }
      }
      for(let i=used;i<tokenPool.length;i++)tokenPool[i].visible=false;
    }
    function render(next){
      if(disposed)return;
      const prev=frame;frame=next;
      if(lost || !width || !frame.state)return;
      const t=Number.isFinite(frame.time)?frame.time:0;
      if(modeState!==(frame.editState||frame.state))syncTargets();
      const focused=patch||insert?null:frame.selected||null;
      if(focusId!==focused)aim(focused);
      moveCamera();
      const outlet=focused==='router'?'router:'+(modeState.routes[frame.previewStep??0]?'straight':'side'):null;
      if(outlet!==litOutlet){litOutlet=outlet;markBelt(null);}
      if(!frame.playing&&!dirty&&prev&&lastState===frame.state&&activeStation===frame.selected&&prev.playing===false&&prev.time===t&&prev.previewRoute===frame.previewRoute&&prev.previewStep===frame.previewStep)return;
      const connections=(patch||insert||focused)?modeState.links:frame.state.links;
      const key=JSON.stringify(connections);
      if(linksKey!==key){linksKey=key;rebuild(connections);}
      if(!frame.revision&&lastState!==frame.state)revision=IsoFlow.revision(frame.state);
      lastState=frame.state;
      const exact=t*8,step=Math.floor(exact),progress=exact-step;
      const tick=frame.tick||IsoFlow.tick(frame.revision||revision,step);
      let display=frame.state;
      if(gesture?.change&&gesture.edit){
        display=IsoFlow.apply(display,commandFor(gesture.edit,gesture.change));
      }
      const displayTick=!frame.playing&&typeof frame.previewRoute==='boolean'?{...tick,straight:frame.previewRoute}:tick;
      const view={...frame,state:display,tick:displayTick,progress};
      for(const [id,part] of Object.entries(pieces)){
        const asleep=!activeStations.has(id)&&id!==frame.selected&&!patch&&!insert&&!tick.activity[id]?.length;
        if(asleep&&part.dormant)continue;
        if(!asleep)setDormant(part,false);
        part.update(view);
        if(asleep)setDormant(part,true);
      }
      if(activeStation!==frame.selected||dirty){
        activeStation=frame.selected;
        for(const [id,b] of Object.entries(buttons)){
          b.dataset.selected=String(id===activeStation);
          b.setAttribute('aria-pressed',String(id===activeStation));
        }
        const piece=pieces[activeStation];selection.visible=!!piece&&!focusId&&!patch&&!insert;
        if(piece){
          const s=stations[activeStation];selection.scale.set(s.w*.58,s.d*.65,1);
          selection.position.copy(piece.group.position);selection.position.y=.012;
        }
      }
      face?.render(frame,transition?null:focused);
      showFlow(frame.revision||revision,step,progress,frame.playing);dirty=false;
      try{renderer.render(scene,camera);}catch(error){if(!renderer.getContext().isContextLost())throw error;}
    }
    function setRay(x,y){
      const rect=canvas.getBoundingClientRect();ray.setFromCamera({x:(x-rect.left)/width*2-1,y:1-(y-rect.top)/height*2},camera);
    }
    function modelHit(x,y){
      setRay(x,y);const hit=ray.intersectObjects(Object.values(pieces).map(p=>p.group),true).find(h=>{
        for(let o=h.object;o;o=o.parent)if(!o.visible)return false;
        return true;
      });
      if(!hit)return null;
      let action=null,part=null;
      for(let object=hit.object;object;object=object.parent){
        if(!action&&object.userData.action){action=object.userData.action;part=object;}
        if(object.userData.station)return {id:object.userData.station,action,part};
      }
      return null;
    }
    function targetAt(x,y){
      const dom=document.elementFromPoint(x,y);
      const station=dom?.closest('.iso-caption')?.dataset.station;
      return station?{id:station}:modelHit(x,y);
    }
    function angleAt(x,y,center){
      setRay(x,y);
      const p=ray.ray.intersectPlane(new THREE.Plane(vec(0,1,0),-center.y),new THREE.Vector3());
      return p?Math.atan2(p.x-center.x,p.z-center.z):0;
    }
    function commandFor(a,delta){
      if(a.type==='pin')return {type:'note',index:a.index,delta};
      return {...a,delta:a.type==='level'?delta*.25:delta};
    }
    function beltUnder(x,y,node){
      const rect=host.getBoundingClientRect(),p={x:x-rect.left,y:y-rect.top};
      let best=25, result=null;
      for(const [key,r] of routes){
        if(r.to===node||key.startsWith(node+':')||(insert&&!targetBelts.has(key)))continue;
        for(let i=1;i<r.samples.length;i++){
          const a=r.samples[i-1],b=r.samples[i],dx=b.x-a.x,dy=b.y-a.y;
          const at=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
          const d=Math.hypot(p.x-a.x-at*dx,p.y-a.y-at*dy);
          if(d<best){best=d;result=key;}
        }
      }
      return result;
    }
    function markBelt(key){
      for(const [id,r] of routes){
        let tone=r.tone;
        if(litOutlet&&r.arrows)tone=id===litOutlet?(id==='router:straight'?materials.chosenA:materials.chosenB):materials.quiet;
        if(r.arrows)r.arrows.visible=id===litOutlet;
        r.carrier.children[0].material=id===key?materials.target:insert&&targetBelts.has(id)?materials.pick:tone;
      }
      dirty=true;
    }
    function start(e){
      if(lost||gesture||transition||e.button!==0||e.target.closest('[data-face],[data-insert-belt]'))return;
      const hit=targetAt(e.clientX,e.clientY);
      if((!hit&&!insert)||(focusId&&hit?.id!==focusId))return;
      const g={id:e.pointerId,x:e.clientX,y:e.clientY,hit,moved:false,change:0,patch,insert};
      if(!insert&&!patch&&hit){
        // Choosing a station is its own gesture, even when the tap lands
        // precisely on a note. Only an already selected part can be edited.
        g.edit=frame?.selected===hit.id && (hit.id==='source'||hit.id==='delay') ? hit.action : null;
        const label=e.target.closest('.iso-caption');
        g.handle=inserts.has(hit.id)&&!!label;
        g.flip=hit.action?.type==='lever' && frame?.selected==='router' && !label;
        if(g.edit?.type==='phase'||g.edit?.type==='pin'){
          g.center=pieces.source.group.localToWorld(vec(.55,.81,.16));
          g.angle=angleAt(e.clientX,e.clientY,g.center);g.turn=0;
        }
      }
      e.preventDefault();
      gesture=g;host.setPointerCapture(e.pointerId);
    }
    function move(e){
      if(!gesture){
        if(e.pointerType==='mouse'&&e.target===canvas){
          const target=insert?beltUnder(e.clientX,e.clientY,insert):modelHit(e.clientX,e.clientY);
          canvas.style.cursor=target&&(!patch||targetStations.has(target.id))?'pointer':'default';
          if(insert)markBelt(target);
        }
        return;
      }
      const g=gesture;if(e.pointerId!==g.id)return;
      const dx=e.clientX-g.x,dy=e.clientY-g.y;
      if(!g.moved&&Math.hypot(dx,dy)<7)return;
      if(!g.moved){
        g.moved=true;
        if(g.edit?.type==='pin'&&g.center)g.edit={type:'phase'};
        if(g.handle){select(g.hit.id);setInsert(g.hit.id);}
      }
      if(g.handle){
        const rect=host.getBoundingClientRect();
        const over=beltUnder(e.clientX,e.clientY,g.hit.id);
        if(over!==g.over){markBelt(over);g.over=over;}
        ghost.textContent=(over?'Врезать · ':'')+stations[g.hit.id].label;ghost.hidden=false;
        ghost.style.left=(e.clientX-rect.left)+'px';ghost.style.top=(e.clientY-rect.top)+'px';return;
      }
      if(g.insert){markBelt(beltUnder(e.clientX,e.clientY,g.insert));return;}
      if(!g.edit)return;
      if(g.center){
        const angle=angleAt(e.clientX,e.clientY,g.center);
        g.turn-=Math.atan2(Math.sin(angle-g.angle),Math.cos(angle-g.angle));g.angle=angle;
        g.change=Math.round(g.turn/(Math.PI/4));
      }else if(g.edit.type==='delay')g.change=Math.round(dx/Math.max(12,width/65));
      else if(g.edit.type==='level')g.change=Math.round(-dy/Math.max(8,height/55));
      dirty=true;
    }
    function end(e,cancelled=false){
      const g=gesture;if(!g||e.pointerId!==g.id)return;
      gesture=null;dirty=true;lastPointerAt=performance.now();
      if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);
      ghost.hidden=true;
      if(cancelled){
        if(g.handle&&g.moved)setInsert(null);
        return;
      }
      if(g.insert||g.handle&&g.moved){
        const module=g.insert||g.hit.id, over=beltUnder(e.clientX,e.clientY,module);
        if(over)install(module,over);
        else if(g.handle)setInsert(null);
        return;
      }
      if(g.patch){
        const hit=targetAt(e.clientX,e.clientY);if(hit)connect(hit.id);
        return;
      }
      if(g.moved){
        if(g.edit&&g.change)callbacks.act(commandFor(g.edit,g.change));
      }else if(g.flip && targetAt(e.clientX,e.clientY)?.id==='router' &&
        !document.elementFromPoint(e.clientX,e.clientY)?.closest('.iso-caption')){
        callbacks.flipRoute?.();
      }else if(g.edit)callbacks.act(commandFor(g.edit,1));
      else if(g.hit&&g.hit.id!==focusId)select(g.hit.id);
    }
    host.addEventListener('pointerdown',start,opt);host.addEventListener('pointermove',move,opt);
    host.addEventListener('pointerup',e=>end(e),opt);
    host.addEventListener('pointercancel',e=>end(e,true),opt);
    host.addEventListener('lostpointercapture',e=>end(e,true),opt);
    host.addEventListener('keydown',()=>{lastPointerAt=-Infinity;},opt);
    canvas.addEventListener('webglcontextlost',e=>{
      e.preventDefault();lost=true;host.dataset.context='lost';gesture=null;ghost.hidden=true;cancelMode();
      callbacks.notice?.('Восстанавливаем трёхмерный стол…');
    },opt);
    canvas.addEventListener('webglcontextrestored',()=>{
      lost=false;delete host.dataset.context;lastState=null;callbacks.notice?.('');resize();
    },opt);
    function inspect(){
      const rect=host.getBoundingClientRect(),client=p=>({x:p.x+rect.left,y:p.y+rect.top});
      const nodes={},ports={},actions=[];
      for(const [id,piece] of Object.entries(pieces)){
        const p=piece.group.position.clone();p.y=.56;nodes[id]=client(project(p));
        piece.group.traverse(o=>{
          const a=o.userData.action;if(!a)return;
          const shape=new THREE.Box3().setFromObject(o);
          const center=shape.getCenter(new THREE.Vector3());
          const candidates=[center];
          for(const x of [.2,.5,.8])for(const z of [.2,.5,.8]){
            candidates.push(vec(THREE.MathUtils.lerp(shape.min.x,shape.max.x,x),shape.max.y-.005,THREE.MathUtils.lerp(shape.min.z,shape.max.z,z)));
          }
          for(const c of candidates){
            const screen=client(project(c)),hit=targetAt(screen.x,screen.y);
            if(hit?.id===id&&hit.action?.type===a.type&&hit.action.index===a.index){actions.push({id,...a,...screen});break;}
          }
        });
      }
      for(const k of Object.keys(sockets))ports[k]=client(project(socketPos(k)));
      const beltPoints=Object.fromEntries([...routes].map(([key,r])=>[key,r.samples.map(client)]));
      return {webgl:true,contextLost:lost,portrait,focus:focusId,zoom:overview.half/pose.half,settling:!!transition,selectedBranch:litOutlet,nodes,ports,actions,beltPoints,links:[...routes.keys()],boxes:tokenPool.filter(m=>m.visible).length};
    }
    face=window.IsoFace?.mount({overlay,pieces,projectLocal,callbacks:{startPatch:setPatch,startInsert:setInsert,...callbacks}});
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    return {render,setPatch,setInsert,cancelMode,inspect,dispose(){
      disposed=true;observer.disconnect();events.abort();gesture=null;face?.dispose();
      clearGeometry(scene,true);mutedMaterials.forEach(m=>m.dispose());tokenMaterials.forEach(m=>m.dispose());Object.values(materials).forEach(m=>m.dispose());tokenGeometry.dispose();
      renderer.dispose();overlay.remove();canvas.remove();
    }};
  }
  return {mount};
})();
