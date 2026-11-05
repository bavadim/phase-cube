/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoScene = (() => {
  const stations = {
    source: {label:'Привод',w:3.5,d:2.05,wide:[-5.1,-.4],tall:[-.4,-5.9]},
    copy: {label:'Копир',w:1.65,d:1.5,wide:[-1.35,-.4],tall:[-1.75,-2.05]},
    keys: {label:'Клавиши',w:1.65,d:1.5,wide:[2.35,-2.3],tall:[2.2,-2.05]},
    delay: {label:'Накопитель',w:2,d:1.55,wide:[1,2.1],tall:[-1.75,1.45]},
    router: {label:'Развилка',w:2.65,d:1.9,wide:[4.5,2.1],tall:[2.2,1.45]},
    bell: {label:'Колокол',w:1.65,d:1.5,wide:[7.7,.05],tall:[-1.75,5.55]},
    bin: {label:'Корзина',w:1.65,d:1.5,wide:[7.7,4.4],tall:[2.2,5.55]}
  };
  const portLabel={out:'Выход',copy:'Копия',straight:'Прямо',side:'Отвод',in:'Вход'};
  const make=(tag,cls)=>Object.assign(document.createElement(tag),{className:cls});
  function fallback(host,callbacks){
    const panel=make('div','iso-fallback');host.append(panel);
    for(const [id,s] of Object.entries(stations)){
      const b=document.createElement('button'); b.type='button';b.textContent=s.label;
      b.onclick=()=>callbacks.select(id);panel.append(b);
    }
    callbacks.notice?.('Трёхмерный вид недоступен. Выберите деталь и настройте её в панели.');
    return {render(){},setPatch(){},inspect(){return {webgl:false};},dispose(){panel.remove();}};
  }
  function mount(host,callbacks){
    host.classList.add('iso-board');
    let renderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
    catch(error){return fallback(host,callbacks);}
    const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');host.append(canvas);
    renderer.setClearColor(0xedeadd,1);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,110);
    const hemi=new THREE.HemisphereLight(0xfffaeb,0xa5ada4,1.8);scene.add(hemi);
    const sun=new THREE.DirectionalLight(0xffecce,2.25);sun.position.set(-5,12,4);scene.add(sun);
    const fill=new THREE.DirectionalLight(0xb7e5f3,.65);fill.position.set(4,5,-6);scene.add(fill);
    const physical=color=>new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.08,side:THREE.DoubleSide});
    const materials={belt:physical(0x365a52),rail:physical(0xb09b6e),tread:physical(0x728b76),target:physical(0x71b69b)};
    const table=new THREE.Group(),belts=new THREE.Group(),boxes=new THREE.Group(),marks=new THREE.Group();
    scene.add(table,belts,boxes,marks);
    const overlay=make('div','iso-overlay');host.append(overlay);
    const ns='http://www.w3.org/2000/svg',draft=document.createElementNS(ns,'svg'),wire=document.createElementNS(ns,'path');
    draft.setAttribute('class','iso-cable');draft.setAttribute('aria-hidden','true');
    for(const [k,val] of Object.entries({fill:'none',stroke:'#14715e','stroke-width':3,'stroke-linecap':'round','stroke-dasharray':'5 7'}))wire.setAttribute(k,val);
    draft.append(wire);overlay.append(draft);
    const ghost=make('span','iso-drag-label');ghost.hidden=true;overlay.append(ghost);
    const inserts=new Set(['copy','delay','router']);
    const pieces={},buttons={},sockets={},routes=new Map(),tokenPool=[],tokenMaterials=new Map();
    const tokenGeometry=new THREE.BoxGeometry(.27,.19,.22),ray=new THREE.Raycaster();
    const events=new AbortController(),opt={signal:events.signal};
    const vec=(x,y,z)=>new THREE.Vector3(x,y,z);
    let patch=null,gesture=null,frame=null,revision=null,lastState=null,linksKey=null,portrait=null,lost=false,dirty=true;
    let disposed=false,width=0,height=0,activeStation=null,lastPointerAt=-Infinity;
    // Touch can synthesize a click with detail=0. Pointer-up has already
    // committed that action. Keyboard and assistive activation still use click.
    function accessibleActivation(e){
      return !e.pointerType && e.detail===0 && performance.now()-lastPointerAt>450;
    }
    function select(id){callbacks.select(id);}
    function clearPatch(){
      if(!patch)return;
      setPatch(null);
    }
    function setPatch(key){
      patch=key||null;
      host.toggleAttribute('data-patching',!!patch);draft.style.display='none';
      for(const [k,s] of Object.entries(sockets))s.el.setAttribute('aria-pressed',String(k===patch));
      for(const [id,b] of Object.entries(buttons))b.dataset.destination=String(!!sockets[id+':in']&&id!==patch?.split(':')[0]);
      callbacks.patchChanged?.(patch);dirty=true;
    }
    function connect(id){
      if(!patch||!sockets[id+':in']||id===patch.split(':')[0])return;
      const result=callbacks.connect(patch,id);
      if(result!==false)clearPatch();
    }
    function commitPort(key){
      const [id,port]=key.split(':');
      if(port==='in'){if(patch)connect(id);else select(id);return;}
      if(key===patch){clearPatch();return;}
      select(id);setPatch(key);
    }
    function project(point){
      const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};
    }
    function socketPos(key){const s=sockets[key];return pieces[s.id].group.localToWorld(s.local.clone());}
    function placeDOM(){
      scene.updateMatrixWorld(true);camera.updateMatrixWorld();
      for(const [id,part] of Object.entries(pieces)){
        const s=stations[id],c=part.group.position.clone();c.z+=s.d*.54+.18;c.y=-.04;
        const p=project(c);
        for(const sock of Object.values(sockets).filter(s=>s.id===id)){
          const tip=project(part.group.localToWorld(sock.local.clone()));
          if(Math.abs(p.x-tip.x)<42&&p.y>tip.y-6)p.y=Math.max(p.y,tip.y+21);
        }
        buttons[id].style.left=p.x+'px';buttons[id].style.top=p.y+'px';
      }
      for(const [key,s] of Object.entries(sockets)){
        const p=project(socketPos(key));s.el.style.left=p.x+'px';s.el.style.top=p.y+'px';
      }
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
      const b=make('button','iso-caption');b.type='button';b.textContent=s.label;b.dataset.station=id;
      b.setAttribute('aria-label','Выбрать: '+s.label);
      if(inserts.has(id)){b.classList.add('iso-handle');b.title='Перетащить на ленту: '+s.label;}
      b.onclick=e=>{if(accessibleActivation(e)){if(patch)connect(id);else select(id);}};buttons[id]=b;overlay.append(b);
      for(const [port,pos] of Object.entries(p.ports)){
        const key=id+':'+port,el=make('button','iso-port');el.type='button';el.dataset.port=key;el.dataset.kind=port==='in'?'in':'out';
        el.setAttribute('aria-label',s.label+' · '+portLabel[port]);el.title=s.label+' · '+portLabel[port];
        const glyph=document.createElement('b');glyph.textContent=port==='in'?'':port==='side'||port==='copy'?'↳':'›';el.append(glyph);
        sockets[key]={id,port,el,local:pos};overlay.append(el);
        el.addEventListener('click',e=>{if(accessibleActivation(e))commitPort(key);},opt);
      }
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
    function resize(){
      if(disposed)return;
      width=Math.max(1,host.clientWidth);height=Math.max(1,host.clientHeight);
      renderer.setSize(width,height,false);
      portrait=width/height<1.18;
      const yaw=portrait?.28:.49;
      camera.position.set(yaw*20,portrait?31:26,20);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
      for(const [id,p] of Object.entries(pieces)){
        const [x,z]=stations[id][portrait?'tall':'wide'];
        p.group.position.set(x+(portrait?yaw*z:0),0,z-(portrait?0:.34*x));
      }
      const footprintsAll=footprints();
      const bounds={left:Math.min(...footprintsAll.map(o=>o.left))-.87,right:Math.max(...footprintsAll.map(o=>o.right))+.87,
        top:Math.min(...footprintsAll.map(o=>o.top))-.91,bottom:Math.max(...footprintsAll.map(o=>o.bottom))+.91};
      skinTable(bounds);
      let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
      function fit(p){p.applyMatrix4(camera.matrixWorldInverse);left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.max(top,p.y);bottom=Math.min(bottom,p.y);}
      for(const [id,p] of Object.entries(pieces)){
        const s=stations[id];
        for(const dx of [-s.w*.52-.24,s.w*.52+.48])for(const dz of [-s.d*.56-.38,s.d*.56+.48])for(const h of [-.4,1.76]) fit(p.group.position.clone().add(vec(dx,h,dz)));
      }
      const cx=(left+right)/2,cy=(top+bottom)/2,aspect=width/height;
      const half=Math.max((right-left)/(2*aspect),(top-bottom)/2)*1.035;
      camera.left=cx-half*aspect;camera.right=cx+half*aspect;camera.top=cy+half;camera.bottom=cy-half;camera.updateProjectionMatrix();
      linksKey=null;dirty=true;placeDOM();
      if(frame)render(frame);
    }
    function rebuild(links){
      clearGeometry(belts);routes.clear();const prior=[],obstacles=footprints();
      for(const [key,id] of Object.entries(links)){
        if(!sockets[key]||!sockets[id+':in'])continue;
        const plan=IsoBelts.plan(socketPos(key),socketPos(id+':in'),key.split(':')[1],obstacles,prior);
        const carrier=new THREE.Group();belts.add(carrier);
        const path=IsoBelts.build(carrier,plan,materials);
        const samples=path.getSpacedPoints(Math.max(8,Math.ceil(path.getLength()*4))).map(project);
        prior.push(plan.points);routes.set(key,{path,to:id,samples,carrier});
      }
      dirty=true;
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
      if(!frame.playing&&!dirty&&prev&&lastState===frame.state&&activeStation===frame.selected&&prev.playing===false&&prev.time===t)return;
      const key=JSON.stringify(frame.state.links);
      if(linksKey!==key){linksKey=key;rebuild(frame.state.links);}
      if(!frame.revision&&lastState!==frame.state)revision=IsoFlow.revision(frame.state);
      lastState=frame.state;
      const exact=t*8,step=Math.floor(exact),progress=exact-step;
      const tick=frame.tick||IsoFlow.tick(frame.revision||revision,step);
      let display=frame.state;
      if(gesture?.change&&gesture.hit.action && !gesture.wire){
        display=IsoFlow.apply(display,commandFor(gesture.hit.action,gesture.change));
      }
      const view={...frame,state:display,tick,progress};
      for(const part of Object.values(pieces))part.update(view);
      if(activeStation!==frame.selected||dirty){
        activeStation=frame.selected;
        for(const [id,b] of Object.entries(buttons))b.dataset.selected=String(id===activeStation);
        const piece=pieces[activeStation];selection.visible=!!piece;
        if(piece){
          const s=stations[activeStation];selection.scale.set(s.w*.58,s.d*.65,1);
          selection.position.copy(piece.group.position);selection.position.y=.012;
        }
      }
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
      const port=dom?.closest('.iso-port')?.dataset.port;
      const station=dom?.closest('.iso-caption')?.dataset.station;
      return port?{key:port,id:port.split(':')[0]}:station?{id:station}:modelHit(x,y);
    }
    function angleAt(x,y,center){
      setRay(x,y);
      const p=ray.ray.intersectPlane(new THREE.Plane(vec(0,1,0),-center.y),new THREE.Vector3());
      return p?Math.atan2(p.x-center.x,p.z-center.z):0;
    }
    function commandFor(a,delta){
      if(a.type==='pin')return {type:'note',index:a.index,delta};
      if(a.type==='clutch')return {type:'clutch'};
      return {...a,delta:a.type==='level'?delta*.25:delta};
    }
    function beltUnder(x,y,node){
      const rect=host.getBoundingClientRect(),p={x:x-rect.left,y:y-rect.top};
      let best=portrait?22:18, result=null;
      for(const [key,r] of routes){
        if(r.to===node||key.startsWith(node+':'))continue;
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
        r.carrier.children[0].material=id===key?materials.target:materials.belt;
      }
      dirty=true;
    }
    function start(e){
      if(lost||gesture||e.button!==0)return;
      const hit=targetAt(e.clientX,e.clientY);
      if(!hit){clearPatch();return;}
      e.preventDefault();
      const g={id:e.pointerId,x:e.clientX,y:e.clientY,hit,moved:false,originPatch:patch,change:0,wire:false};
      if(!patch && inserts.has(hit.id) && e.target.closest('.iso-caption')){
        g.install=true;
      }else if(hit.key&&sockets[hit.key].port!=='in'){
        g.wire=true;g.startPoint=project(socketPos(hit.key));
      }else if(!patch&&hit.action){
        const a=hit.action;
        if(a.type==='disc')g.center=hit.part.getWorldPosition(new THREE.Vector3());
        if(a.type==='phase'||a.type==='pin')g.center=pieces.source.group.localToWorld(vec(.55,.81,.16));
        if(g.center){
          g.angle=angleAt(e.clientX,e.clientY,g.center);g.turn=0;
        }
      }
      gesture=g;host.setPointerCapture(e.pointerId);
    }
    function move(e){
      if(!gesture){
        if(e.pointerType==='mouse'&&e.target===canvas)canvas.style.cursor=modelHit(e.clientX,e.clientY)?'pointer':'default';
        return;
      }
      const g=gesture;if(e.pointerId!==g.id)return;
      const dx=e.clientX-g.x,dy=e.clientY-g.y;
      if(!g.moved&&Math.hypot(dx,dy)<5)return;
      if(!g.moved){
        g.moved=true;
        // Press edits one pin. Turning the same pin moves the complete sleeve.
        if(g.hit.action?.type==='pin'&&g.center)g.hit={...g.hit,action:{type:'phase'}};
        if(g.wire){select(g.hit.id);setPatch(g.hit.key);}
        else if(!patch)select(g.hit.id);
      }
      if(g.install){
        const rect=host.getBoundingClientRect();
        const over=beltUnder(e.clientX,e.clientY,g.hit.id);
        if(over!==g.over){markBelt(over);g.over=over;}
        ghost.textContent=(over?'Врезать · ':'')+stations[g.hit.id].label;ghost.hidden=false;
        ghost.style.left=(e.clientX-rect.left)+'px';ghost.style.top=(e.clientY-rect.top)+'px';return;
      }
      if(g.wire){
        const rect=host.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,p=g.startPoint;
        draft.style.display='';wire.setAttribute('d','M '+p.x+' '+p.y+' Q '+((p.x+x)/2)+' '+(Math.min(p.y,y)-15)+' '+x+' '+y);return;
      }
      if(patch||!g.hit.action)return;
      const a=g.hit.action.type;
      if(g.center){
        const angle=angleAt(e.clientX,e.clientY,g.center);
        const step=Math.atan2(Math.sin(angle-g.angle),Math.cos(angle-g.angle));g.turn-=step;g.angle=angle;
        g.change=Math.round(g.turn/(Math.PI/4));
      }else if(a==='delay')g.change=Math.round(dx/Math.max(12,width/65));
      else if(a==='level')g.change=Math.round(-dy/Math.max(8,height/55));
      else if(a==='clutch')g.change=Math.abs(dy)>12?1:0;
      dirty=true;
    }
    function end(e,cancelled=false){
      const g=gesture;if(!g||e.pointerId!==g.id)return;
      gesture=null;dirty=true;lastPointerAt=performance.now();
      if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);
      if(g.install){ghost.hidden=true;markBelt(null);}
      if(cancelled){if(g.wire&&g.moved)clearPatch();return;}
      if(g.install&&g.moved){
        const over=beltUnder(e.clientX,e.clientY,g.hit.id);
        if(over)callbacks.act({type:'insert',node:g.hit.id,from:over});
        return;
      }
      const at=targetAt(e.clientX,e.clientY);
      if(g.wire){
        if(!g.moved){commitPort(g.hit.key);return;}
        draft.style.display='none';
        if(at&&at.id!==g.hit.id&&(!at.key||at.key.endsWith(':in')))connect(at.id);
        else if(!at&&frame?.state.links[g.hit.key]){callbacks.disconnect(g.hit.key);clearPatch();}
        else clearPatch();
        return;
      }
      if(g.originPatch){
        if(at?.id)connect(at.id);else clearPatch();
        return;
      }
      if(!g.moved)select(g.hit.id);
      const a=g.hit.action;
      if(!a)return;
      if(!g.moved){callbacks.act(commandFor(a,1));return;}
      if(g.change)callbacks.act(commandFor(a,g.change));
    }
    host.addEventListener('pointerdown',start,opt);host.addEventListener('pointermove',move,opt);
    host.addEventListener('pointerup',e=>end(e),opt);
    host.addEventListener('pointercancel',e=>end(e,true),opt);
    host.addEventListener('lostpointercapture',e=>end(e,true),opt);
    host.addEventListener('keydown',e=>{lastPointerAt=-Infinity;if(e.key==='Escape')clearPatch();},opt);
    canvas.addEventListener('webglcontextlost',e=>{
      e.preventDefault();lost=true;host.dataset.context='lost';gesture=null;clearPatch();callbacks.notice?.('Восстанавливаем трёхмерный стол. Редактор деталей доступен ниже.');
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
      return {webgl:true,contextLost:lost,portrait,nodes,ports,actions,beltPoints,links:[...routes.keys()],boxes:tokenPool.filter(m=>m.visible).length};
    }
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    return {render,setPatch,inspect,dispose(){
      disposed=true;observer.disconnect();events.abort();gesture=null;
      clearGeometry(scene,true);tokenMaterials.forEach(m=>m.dispose());Object.values(materials).forEach(m=>m.dispose());tokenGeometry.dispose();
      renderer.dispose();overlay.remove();canvas.remove();
    }};
  }
  return {mount};
})();
