/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoScene = (() => {
  const stations = {
    source:{label:'Шестерня',w:3.22,d:2.08,h:1.49},
    router:{label:'Развилка',w:2.56,d:1.99,h:1.05},
    keys:{label:'Клавиши',w:1.91,d:1.51,h:.98},
    bell:{label:'Колокол',w:1.54,d:1.44,h:1.28},
    copy:{label:'Копир',w:1.75,d:1.6,h:1.51},
    delay:{label:'Задержка',w:2.09,d:1.37,h:1.05},
    bin:{label:'Корзина',w:1.46,d:1.38,h:1.15}
  };
  // The validated patch is acyclic. Layer by upstream depth so even a
  // custom order of processors has outlets facing its downstream inputs.
  function layout(links,portrait){
    const processors=['copy','router','delay'], sinks=['bell','keys','bin'];
    const upstream=id=>Object.keys(links).filter(key=>links[key]===id);
    const owner=key=>key.split(':')[0];
    const rank=id=>id==='source'?0:Math.max(1,...upstream(id).map(key=>rank(owner(key))+1));
    const live=reachable(links);
    const last=Math.max(...processors.map(rank))+1;
    const rows=Array.from({length:last+1},()=>[]);
    rows[0].push('source');
    const loose=[];
    for(const id of processors){
      if(!upstream(id).length&&!Object.keys(links).some(key=>owner(key)===id))loose.push(id);
      else rows[rank(id)].push(id);
    }
    for(const id of loose){
      // On a tall phone park one idle unit beside the hopper. Additional
      // spare units share an intermediate row, leaving room for finger targets.
      const shelf=portrait&&rows[0].length===1?rows[0]:
        rows.slice(1,last).reduce((a,b)=>b.length<a.length?b:a);
      shelf.push(id);
    }
    rows[last]=sinks;
    const result={};
    let z=0,prevDepth=0;
    for(let i=0;i<rows.length;i++){
      const row=rows[i], depth=Math.max(...row.map(id=>stations[id].d));
      const branchX=id=>{
        const parents=upstream(id);
        if(!parents.length)return id==='source'?0:Infinity;
        return parents.reduce((sum,key)=>{
          const split=key.split(':'),port=split[1];
          const offset=port==='copy'||port==='side'?-.5:.5;
          return sum+(result[owner(key)]?.x??0)+offset;
        },0)/parents.length;
      };
      row.sort((a,b)=>branchX(a)-branchX(b));
      // Centre the live path when spare stations fit to either side.
      if(row.length===3&&row.filter(id=>live.has(id)).length===1)row.unshift(row.pop());
      const gap=portrait?.27:.46;
      const width=row.reduce((sum,id)=>sum+stations[id].w,0)+gap*(row.length-1);
      let x=-width/2;
      if(i)z+=(prevDepth+depth)/2+.98;
      for(const id of row){
        result[id]={x:x+stations[id].w/2,z:i===0&&id!=='source'?z+.43:z};
        x+=stations[id].w+gap;
      }
      prevDepth=depth;
    }
    return result;
  }
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
    const ghost=make('span','iso-drag-ring');ghost.hidden=true;overlay.append(ghost);
    const pieces={},buttons={},sockets={},routes=new Map(),tokenPool=[],tokenMaterials=new Map();
    const tokenGeometry=new THREE.SphereGeometry(.122,12,8),ray=new THREE.Raycaster();
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
    let face=null,overview=null,pose=null,focusId=null,transition=null,litOutlet=null,layoutKey=null;
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
        c.y=s.h*.37;
        const button=buttons[id];
        button.hidden=!!focusId||!!transition;
        if(button.hidden)continue;
        const p=project(c),scale=height/(2*pose.half);
        const smallSide=Math.min(s.w,s.d);
        const size=Math.max(44,Math.min(96,smallSide*scale*.72));
        button.style.width=size+'px';button.style.height=size+'px';
        button.style.left=p.x+'px';button.style.top=p.y+'px';
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
        shade.position.copy(p.group.position).add(vec(.04,-.014,.08));shade.rotation.z=-p.group.rotation.y;shade.scale.set(stations[id].w*.55,stations[id].d*.6,1);table.add(shade);
      }
    }
    function axisOf(port){
      return vec(0,0,port==='in'?-1:1);
    }
    // A socket belongs to its chassis even when its cable is unplugged.
    function addSocket(piece,s,port,local){
      const axis=axisOf(port),up=vec(0,1,0);
      const flange=Math.abs(local.z)-s.d*.5;
      function sleeve(back,front,r,mat,sides){
        const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,front-back,sides),mat);
        mesh.position.copy(local).addScaledVector(axis,(back+front)*.5);
        mesh.quaternion.setFromUnitVectors(up,axis);piece.group.add(mesh);
      }
      sleeve(-flange-.085,.002,.126,materials.rail,12);
      sleeve(-flange-.05,-flange+.018,.156,materials.belt,6);
      sleeve(-.035,.009,.143,materials.rail,12);
      sleeve(.009,.012,.082,materials.belt,12);
    }
    for(const [id,s] of Object.entries(stations)){
      const p=IsoPieces.create(id);pieces[id]=p;p.group.userData.station=id;scene.add(p.group);
      const b=make('button','iso-part-hit');b.type='button';b.dataset.station=id;
      b.setAttribute('aria-label','Выбрать: '+s.label);
      b.onclick=e=>{if(accessibleActivation(e)){if(patch)connect(id);else if(!insert)select(id);}};
      buttons[id]=b;overlay.append(b);
      for(const [port,local] of Object.entries(p.ports)){
        sockets[id+':'+port]={id,local};addSocket(p,s,port,local);
      }
    }
    const selectionMaterial=new THREE.MeshBasicMaterial({color:0x26785c,depthWrite:false});
    const selection=new THREE.Mesh(new THREE.RingGeometry(.95,1,64),selectionMaterial);
    selection.rotation.x=-Math.PI/2;selection.visible=false;marks.add(selection);
    function footprints(){
      return Object.entries(pieces).map(([id,p])=>{
        const {x,z}=p.group.position,{w,d}=stations[id];
        return {left:x-w/2,right:x+w/2,top:z-d/2,bottom:z+d/2};
      });
    }
    const framingCamera=new THREE.OrthographicCamera();
    function orient(cam,yaw,alt){
      cam.position.set(20*Math.sin(yaw),20*alt,20*Math.cos(yaw));cam.lookAt(0,0,0);cam.updateMatrixWorld();
    }
    function fit(id){
      const yaw=id ? .045 : (portrait ? .055 : .080);
      const alt=id ? 1.83 : (portrait ? 1.55 : .97);
      orient(framingCamera,yaw,alt);
      const rect=new THREE.Box2(),point=new THREE.Vector2();
      function corner(local,station){
        const world=pieces[station].group.localToWorld(local).applyMatrix4(framingCamera.matrixWorldInverse);
        rect.expandByPoint(point.set(world.x,world.y));
      }
      for(const station of id?[id]:Object.keys(pieces)){
        const {w,d,h}=stations[station];
        const bounds=id&&face?.focusBounds(id);
        const min=bounds?.[0]||[-w*.5-.09,-.13,-d*.5-.12];
        const max=bounds?.[1]||[w*.5+.13,h,d*.5+.12];
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
    function placeStations(links){
      const positions=layout(links,portrait);
      for(const [id,p] of Object.entries(pieces)){
        const {x,z}=positions[id];p.group.position.set(x,0,z);
      }
      const footprintsAll=footprints();
      const bounds={left:Math.min(...footprintsAll.map(o=>o.left))-.39,right:Math.max(...footprintsAll.map(o=>o.right))+.39,
        top:Math.min(...footprintsAll.map(o=>o.top))-.39,bottom:Math.max(...footprintsAll.map(o=>o.bottom))+.39};
      skinTable(bounds);scene.updateMatrixWorld(true);
      overview=fit(null);
      aim(frame?.selected&&!patch&&!insert?frame.selected:null,false);
      linksKey=null;dirty=true;layoutKey=JSON.stringify(links);
    }
    function resize(){
      if(disposed)return;
      width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);
      renderer.setSize(width,height,false);portrait=width/height<1.18;
      placeStations((frame?.editState||frame?.state)?.links||{});
      if(frame)render(frame);
    }
    function travelArrows(carrier,path){
      const length=path.getLength(),count=Math.max(1,Math.round(length/1.05));
      const cone=new THREE.ConeGeometry(.13,.23,10);
      const arrows=new THREE.InstancedMesh(cone,materials.arrow,count),stamp=new THREE.Object3D(),up=vec(0,1,0);
      for(let i=0;i<count;i++){
        const t=(i+.5)/count;
        stamp.position.copy(path.getPointAt(t));stamp.quaternion.setFromUnitVectors(up,path.getTangentAt(t));
        stamp.updateMatrix();arrows.setMatrixAt(i,stamp.matrix);
      }
      carrier.add(arrows);arrows.visible=false;return arrows;
    }
    function socketDir(key) {
      const [owner,port]=key.split(':');
      return axisOf(port).applyQuaternion(pieces[owner].group.quaternion);
    }
    function rebuild(links){
      for(const route of routes.values())route.mountButton.remove();
      clearGeometry(belts);routes.clear();
      const prior=[],chassis=footprints();
      const jacks=Object.keys(sockets).map(key=>{
        const p=socketPos(key),inside=p.clone().addScaledVector(socketDir(key),-.24),r=.14;
        return {key,left:Math.min(p.x,inside.x)-r,right:Math.max(p.x,inside.x)+r,
          top:Math.min(p.z,inside.z)-r,bottom:Math.max(p.z,inside.z)+r};
      });
      for(const [key,id] of Object.entries(links)){
        const input=id+':in';
        if(!sockets[key]||!sockets[input])continue;
        const obstacles=chassis.concat(jacks.filter(jack=>jack.key!==key&&jack.key!==input));
        const path=IsoBelts.plan(socketPos(key),socketPos(input),socketDir(key),socketDir(input),obstacles,prior);
        const carrier=new THREE.Group();belts.add(carrier);
        const jacket=IsoBelts.build(carrier,path,materials);
        const tone=key==='router:straight'?materials.a:key==='router:side'?materials.b:materials.belt;
        const worldSamples=path.getSpacedPoints(Math.max(14,Math.ceil(path.getLength()*13)));
        const arrows=key.startsWith('router:')?travelArrows(carrier,path):null;
        const mountButton=make('button','iso-insert-point');mountButton.type='button';
        mountButton.setAttribute('aria-label','Вставить между деталями «'+stations[key.split(':')[0]].label+'» и «'+stations[id].label+'»');
        mountButton.dataset.insertBelt=key;
        mountButton.onclick=()=>{if(insert)install(insert,key);};
        overlay.append(mountButton);prior.push(worldSamples);
        routes.set(key,{path,to:id,worldSamples,samples:worldSamples.map(project),arrows,jacket,tone,mountButton});
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
          token.scale.set(1,.8+Math.min(2,edge.gain??1)*.38,1.35+.28*edge.length);
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
      const connections=(patch||insert||focused)?modeState.links:frame.state.links;
      const key=JSON.stringify(connections);
      if(layoutKey!==key)placeStations(connections);
      if(focusId!==focused)aim(focused);
      moveCamera();
      const straight=frame.playing?frame.tick?.straight??frame.state.routes[Math.floor(t*8)%8]:modeState.routes[frame.previewStep??0];
      const outlet=focused==='router'?'router:'+(straight?'straight':'side'):null;
      if(outlet!==litOutlet){litOutlet=outlet;markBelt(null);}
      if(!frame.playing&&!pieces.router.needsFrame?.()&&!dirty&&prev&&lastState===frame.state&&activeStation===frame.selected&&prev.playing===false&&prev.time===t&&prev.previewRoute===frame.previewRoute&&prev.previewStep===frame.previewStep&&prev.paintPitch===frame.paintPitch)return;
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
      const view={...frame,state:display,tick:displayTick,progress,focusPart:transition?null:focused};
      for(const [id,part] of Object.entries(pieces)){
        const asleep=!activeStations.has(id)&&id!==frame.selected&&!patch&&!insert&&!tick.activity[id]?.length;
        if(asleep&&part.dormant)continue;
        const muted=asleep||!!focused&&focused!==id;
        if(!muted)setDormant(part,false);
        part.update(view);
        if(muted)setDormant(part,true);
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
      face?.render(view,view.focusPart);
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
      const station=dom?.closest('.iso-part-hit')?.dataset.station;
      return station?{id:station}:modelHit(x,y);
    }
    function angleAt(x,y,center){
      setRay(x,y);
      const p=ray.ray.intersectPlane(new THREE.Plane(vec(0,1,0),-center.y),new THREE.Vector3());
      return p?Math.atan2(p.x-center.x,p.z-center.z):0;
    }
    function commandFor(a,delta){
      if(a.type==='pin'){
        return frame.paintPitch===undefined?{type:'note',index:a.index,delta}:{type:'note',index:a.index,value:frame.paintPitch};
      }
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
        let tone=activeStations.has(id.split(':')[0])?r.tone:materials.quiet;
        if(litOutlet&&r.arrows)tone=id===litOutlet?(id==='router:straight'?materials.chosenA:materials.chosenB):materials.quiet;
        if(r.arrows)r.arrows.visible=id===litOutlet;
        r.jacket.material=id===key?materials.target:insert&&targetBelts.has(id)?materials.pick:tone;
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
        const overviewHit=e.target.closest('.iso-part-hit');
        g.handle=inserts.has(hit.id)&&!!overviewHit;
        if(frame?.selected==='router'&&!overviewHit){
          if(hit.action?.type==='cam')g.cam=hit.action.index;
          g.flip=hit.action?.type==='lever';
        }
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
        ghost.dataset.ready=String(!!over);ghost.hidden=false;
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
      }else if(g.cam!==undefined){
        callbacks.touchCam?.(g.cam);
      }else if(g.flip && targetAt(e.clientX,e.clientY)?.id==='router' &&
        !document.elementFromPoint(e.clientX,e.clientY)?.closest('.iso-part-hit')){
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
      const cableLengths=Object.fromEntries([...routes].map(([key,r])=>[key,r.path.getLength()]));
      const cableHeights=Object.fromEntries([...routes].map(([key,r])=>[key,Math.max(...r.worldSamples.map(p=>p.y))]));
      return {webgl:true,cableLengths,cableHeights,contextLost:lost,portrait,focus:focusId,zoom:overview.half/pose.half,settling:!!transition,selectedBranch:litOutlet,nodes,ports,actions,beltPoints,links:[...routes.keys()],boxes:tokenPool.filter(m=>m.visible).length};
    }
    face=window.IsoFace?.mount({overlay,pieces,projectLocal,callbacks:{startPatch:setPatch,startInsert:setInsert,...callbacks}});
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    return {render,setPatch,setInsert,cancelMode,inspect,dispose(){
      disposed=true;observer.disconnect();events.abort();gesture=null;face?.dispose();
      clearGeometry(scene,true);mutedMaterials.forEach(m=>m.dispose());tokenMaterials.forEach(m=>m.dispose());Object.values(materials).forEach(m=>m.dispose());tokenGeometry.dispose();
      renderer.dispose();overlay.remove();canvas.remove();
    }};
  }
  return {mount,layout};
})();
