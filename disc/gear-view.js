/* SPDX-License-Identifier: AGPL-3.0-or-later */
// The external tooth profiles follow the drive. The engraved score on the
// concentric sleeve can be indexed without ever slipping the gear mesh.
window.GearTrainView = {create({scene, resources: R, model, game, onEditPreview = () => {}}) {
  const T = THREE, G = DiscGears, tau = 2 * Math.PI;
  const period = game.periodBars, challenge = game.gearChallenge;
  const own = object => R.own(object);
  const root = new T.Group();
  const camera = new T.OrthographicCamera(-6, 6, 6, -6, .1, 64);
  scene.add(root);
  const picks = [], wheels = [];
  const wrap = value => value - Math.floor(value);
  const direction = new T.Vector3(0, -1, -.64).normalize();
  const screenUp = new T.Vector3(0, -direction.z, direction.y).normalize();
  const point = (turn, radius, y = 0) => new T.Vector3(Math.sin(turn*tau)*radius, y, Math.cos(turn*tau)*radius);
  const group = parent => {const g = new T.Group(); parent.add(g); return g;};
  function mesh(parent, geometry, material) {
    const o = new T.Mesh(geometry, material); parent.add(o); return o;
  }
  const material = (color, metalness = .28) => R.material(color, {roughness: .47, metalness});
  const solid = color => own(new T.MeshBasicMaterial({color}));
  const steel = material('#426267', .52), dark = material('#1e383c'), ink = material('#142a31');
  const brass = material('#d5be82', .54), ivory = solid('#fff2cd'), gold = solid('#ffca70');
  const pale = material('#a8bbb2', .55), good = solid('#a3edc0');
  const hitMaterial=own(new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));
  const box = (parent,w,h,d,mat) => mesh(parent,R.bevelBox(w,h,d,Math.min(w,h,d)*.18),mat);
  const cylinder = (parent,r,h,mat) => mesh(parent, own(new T.CylinderGeometry(r,r,h,64)), mat);
  function ring(parent,r,thickness,mat,y) {
    const o = mesh(parent, own(new T.TorusGeometry(r,thickness,6,96)), mat);
    o.rotation.x = -Math.PI/2; o.position.y = y; return o;
  }
  function register(o, key, kind) {o.userData = {key,kind}; picks.push(o); return o;}
  const target = (key,kind) => ({key,kind,selectOnly:true,draggable:true});

  function lettering(parent, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = 384; canvas.height = Math.round(384*height/width);
    const ctx = canvas.getContext('2d'), texture = own(new T.CanvasTexture(canvas));
    texture.colorSpace = T.SRGBColorSpace;
    const sprite = new T.Sprite(own(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false})));
    sprite.scale.set(width,height,1); sprite.renderOrder=1; parent.add(sprite);
    let last;
    return {sprite, draw(name, sub, color) {
      const signature = name + sub + color;
      if (signature === last) return;
      last = signature;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [text, y, size, fill] of [
        [name,.31,.46,'#fff2d7'], [sub,.78,.37,color]
      ]) {
        ctx.font = 'bold '+(canvas.height*size)+'px sans-serif';
        ctx.fillStyle = fill; ctx.fillText(text,canvas.width/2,canvas.height*y,canvas.width-8);
      }
      texture.needsUpdate = true;
    }};
  }

  // Standard 20-degree involute flanks, including the root-to-base transition
  // on the small pinions. The crest of tooth zero points towards local +Z.
  const shapeCache = new Map();
  function gearGeometry(g) {
    if (shapeCache.has(g.teeth)) return shapeCache.get(g.teeth);
    const outline = new T.Shape(), pressure = Math.PI/9;
    const base = g.radius * Math.cos(pressure), pitch = tau/g.teeth;
    const inv = alpha => Math.tan(alpha) - alpha;
    const half = r => Math.min(.41*pitch, pitch*.243 + inv(pressure) - inv(Math.acos(Math.min(1,base/r))));
    const flank = [g.rootRadius, Math.max(g.rootRadius,base)];
    for(let step=1;step<=4;step++) flank.push(flank[1] + (g.outerRadius-flank[1])*step/4);
    let first = true;
    for(let i=0;i<g.teeth;i++){
      for(const [offset,r] of [
        [-pitch*.5,g.rootRadius], ...flank.map(r=>[-half(r),r]),
        ...flank.slice().reverse().map(r=>[half(r),r])
      ]){
        const theta = i*pitch+offset, x = r*Math.sin(theta), y = -r*Math.cos(theta);
        if (first) outline.moveTo(x,y); else outline.lineTo(x,y);
        first = false;
      }
    }
    outline.closePath();
    const geometry = own(new T.ExtrudeGeometry(outline,{depth:G.FACE_WIDTH,bevelEnabled:false,steps:1}));
    geometry.rotateX(-Math.PI/2); shapeCache.set(g.teeth,geometry);
    return geometry;
  }

  function noteArc(radius, width, from, to) {
    const span = Math.abs(to-from), inner = radius-width/2, outer=radius+width/2;
    const start = Math.min(from,to)*tau-Math.PI/2, end = start+Math.min(.9999,span)*tau;
    const shape = new T.Shape();
    shape.moveTo(outer*Math.cos(start),outer*Math.sin(start));
    shape.absarc(0,0,outer,start,end,false);
    shape.lineTo(inner*Math.cos(end),inner*Math.sin(end));
    shape.absarc(0,0,inner,end,start,true); shape.closePath();
    const geo = own(new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false,curveSegments:Math.max(3,Math.ceil(48*span))}));
    geo.rotateX(-Math.PI/2); return geo;
  }

  const top = G.FACE_WIDTH;
  const noteY = top+.09;
  const profiles = game.gearTrain;
  for (const gear of profiles) {
    const base = group(root), carriage = group(base), rim = group(carriage), sleeve = group(carriage);
    const w = {gear, key:gear.key, base,carriage,rim,sleeve,events:[],active:false};
    wheels.push(w);
    const driver = gear.key === 'drive', small = gear.radius < 1, r = gear.radius;
    const definition = game.modules.find(m => m.key === gear.key);
    w.definition = definition;
    const color = definition?.color || '#deb76d';
    const coat = material(new T.Color(color).lerp(new T.Color('#254448'),.57), .36);
    const tint = material(color,.36), light = solid(color);
    const body = mesh(rim,gearGeometry(gear), driver ? brass : steel);
    if (!driver) register(body,w.key,'gain');
    cylinder(base,r*.45,.095,ink).position.y = -.065;
    cylinder(base,r*.22,top+.10,pale).position.y = (top+.10)/2-.04;
    const cover = cylinder(sleeve,gear.rootRadius*.98,.07,driver ? dark : coat);
    cover.position.y = top+.032;
    if (!driver) register(cover,w.key,'phase');
    w.laneRadius = r*(small?.69:.77);
    const faceRadius = gear.rootRadius*.95;
    ring(sleeve,faceRadius,.012,driver?brass:steel,top+.077);

    const capRadius = r*(small?.37:.34);
    const cap = cylinder(carriage,capRadius,.125,ink);
    cap.position.y = top+.116;
    ring(carriage,capRadius,.018,driver?brass:tint,top+.173);
    w.cap = cap;
    if (!driver) register(cap,w.key,'gain');
    const text = lettering(carriage,capRadius*1.74,capRadius*.80);
    text.sprite.position.set(0,top+.22,.012);
    w.text = text;
    if (driver) {
      for(let i=0;i<4;i++){
        const stripe = box(sleeve,.037,.025,.15,ivory);
        stripe.position.copy(point(i/4,r*.64,top+.08)); stripe.rotation.y = tau*i/4;
      }
      text.draw('ВХОД','1 ТАКТ','#fad394');
      continue;
    }

    w.selection = ring(carriage,capRadius+.036,.015,ivory,top+.17);
    const phaseRef = group(carriage); w.phaseRef = phaseRef;
    const phasePeriod = challenge.phasePeriod(w.key)*period/gear.periodBars;
    const count = Math.max(1,Math.round(1/phasePeriod));
    const dialRadius = r*(small?.69:.52);
    const radialWidth = r*(small?.18:.13);
    // Target notch and score's white hairline touch only at a correct index.
    for(let j=0;j<count;j++){
      const t = j/count;
      const notch = box(phaseRef,small?.045:.066,.022,radialWidth,gold);
      notch.position.copy(point(t,dialRadius-radialWidth/2,top+.077)); notch.rotation.y = tau*t;
    }
    w.calibration = group(carriage);
    w.hand = box(w.calibration,small?.036:.051,.030,radialWidth*.72,ivory);
    w.hand.position.copy(point(0,dialRadius+radialWidth*.36,top+.087));

    // The five notches are stationary. The front collar and read head ride
    // axially with the wheel and never spin. Their middle notch is the target.
    const front = gear.outerRadius+.085;
    const width = small ? .095:.16;
    const mast = box(base,width,.81,.075,dark);
    mast.position.set(0,top+.29,front+.045); register(mast,w.key,'gain');
    const targetGain = challenge.target(w.key).gain;
    for(let i=0;i<=4;i++){
      const goal = i/2 === targetGain;
      const tick = box(base,width*(goal?1.9:1.17),goal?.037:.018,.048,goal?gold:pale);
      tick.position.set(0,top+G.lift(i/2),front+.098);
    }
    w.gauge = box(carriage,width*1.28,.050,.07,light);
    w.gauge.position.set(width*1.42,top,front+.095);
    const grip = box(carriage,width*.69,.085,.24,dark);
    grip.position.set(width*.99,top+.015,front+.005); register(grip,w.key,'gain');
    const reader = group(carriage);
    const length = front-w.laneRadius;
    const stem = box(reader,width*.85,.042,length,ink);
    stem.position.z=length/2;
    const line = box(reader,width*.32,.016,length,ivory); line.position.set(0,.030,length/2);
    const lamp = mesh(reader,own(new T.SphereGeometry(small?.041:.065,14,8)), ivory);
    lamp.scale.y=.67; lamp.position.y=.043;
    reader.position.set(0,noteY+.062,w.laneRadius);
    w.reader = reader; w.lamp=lamp; w.light=light;
    if (small) {
      // A real lift handle extends from the front collar. At phone scale the
      // cap is an inadequate touch target; keep the playable note ring free.
      const flag=group(carriage), boom=box(carriage,.065,.056,1,pale);
      const plate=box(flag,1,1,.045,ink);
      const catchArea=register(mesh(flag,own(new T.PlaneGeometry(1,1)),hitMaterial),w.key,'gain');
      catchArea.position.z=.032;
      flag.add(text.sprite); text.sprite.position.set(0,0,.037);
      w.handle={flag,boom,plate,catchArea,front:front+.11};
    }
    const beadGeometry = own(new T.SphereGeometry(small?.028:.047,10,6));
    // Game exposes only the fixed authored excerpt here. Score coordinates
    // on the sleeve are measured once, before any user edit or playback.
    const localEvents = G.oneRevolution(gear,definition.variants[0].events,period);
    const pitches = localEvents.map(e=>e.pitch).filter(Number.isFinite);
    const minPitch = Math.min(...pitches), maxPitch = Math.max(...pitches);
    for(const source of localEvents) {
      const turn = G.noteTurns(gear,source.start,period);
      const pitch = maxPitch>minPitch?(source.pitch-minPitch)/(maxPitch-minPitch)-.5:0;
      const route = w.laneRadius+pitch*r*.12;
      const duration = source.duration*period/gear.periodBars;
      const note = mesh(sleeve,noteArc(route,r*(small?.19:.082),turn,turn-gear.sign*duration),tint);
      note.position.y=noteY;
      const mark = mesh(sleeve,beadGeometry,ivory);
      mark.position.copy(point(turn,route,noteY+.037)); mark.scale.y=.63;
      register(note,w.key,'phase'); register(mark,w.key,'phase');
      w.events.push({source,mark});
    }
  }

  let selected = model.selected, drag = null, narrow = false, viewportHeight=600;
  let transport = {position:0,playing:false,rows:[],state:null};
  let controls = model.snapshot();
  let goalState = challenge.evaluate(controls);
  function refreshControls() {
    controls = model.snapshot();
    goalState = challenge.evaluate(controls);
    render();
  }
  function render() {
    // The sleeve plays the revision currently in the speaker. The clutch
    // index and axial carriage follow the hand immediately during lookahead.
    const state = transport.playing && transport.state ? transport.state : controls;
    for(const w of wheels) {
      const g = w.gear, part = state.parts.find(p=>p.key === w.key);
      w.rim.rotation.y=tau*G.rimTurns(g,transport.position);
      w.base.position.set(g.x,0,g.z);
      const control = controls.parts.find(p=>p.key === w.key);
      w.carriage.position.y = G.lift(control?.gain ?? 1);
      if(!part) {
        w.sleeve.rotation.y=tau*G.sleeveTurns(g,transport.position,0,period);
        continue;
      }
      w.heard = part;
      w.sleeve.rotation.y=tau*G.sleeveTurns(g,transport.position,part.phase,period);
      w.calibration.rotation.y=tau*G.sleeveTurns(g,transport.position,control.phase,period);
      w.phaseRef.rotation.y=tau*G.sleeveTurns(g,transport.position,challenge.target(w.key).phase,period);
      w.status = goalState.parts.find(p=>p.key===w.key);
      w.selection.visible = selected===w.key;
      w.gauge.material = w.status.gainOK ? good : w.light;
      w.hand.material = w.status.phaseOK ? good : ivory;
      w.text.draw(w.definition.name,'↕ '+Math.round(control.gain*100)+'%',w.status.matched?'#a3edc0':w.definition.color);
      const row = transport.rows?.[game.modules.indexOf(w.definition)] || [];
      const now=wrap(transport.position/period);
      // Source Haps carry their normalized start and actual gate duration; use
      // a short attack flash even for held notes to identify the exact strike.
      const flashSecs=.10/(transport.periodSeconds || 6.4);
      w.active=!!(transport.playing && part.installed && part.gain>0 && row.some(e =>
        e.audible && wrap(now-e.start)<Math.min(flashSecs,e.duration)));
      w.lamp.material = w.active ? w.light : ivory;
      w.lamp.scale.setScalar(w.active?1.65:1); w.lamp.scale.y *= .67;
    }
  }
  function resize(aspect,width,height) {
    narrow = aspect<.98; viewportHeight=height;
    const layout = narrow ? G.layout(true) : profiles;
    for(const [i,w] of wheels.entries()) {
      w.gear = layout[i]; w.base.position.set(w.gear.x,0,w.gear.z);
    }
    const x=[], y=[];
    for(const g of layout) {
      const r=g.outerRadius+.075;
      x.push(g.x-r,g.x+r);
      for(const h of [-.11,top+G.MAX_LIFT+.25])
        for(const z of [g.z-r,g.z+r+.21]) y.push(screenUp.y*h+screenUp.z*z);
    }
    const midX=(Math.min(...x)+Math.max(...x))/2, midY=(Math.min(...y)+Math.max(...y))/2;
    const center = new T.Vector3(midX,0,0).addScaledVector(screenUp,midY);
    camera.position.copy(center).addScaledVector(direction,-24); camera.lookAt(center);
    const half = Math.max((Math.max(...y)-Math.min(...y))/2,(Math.max(...x)-Math.min(...x))/(2*aspect))*1.045;
    camera.left=-half*aspect;camera.right=half*aspect;camera.bottom=-half;camera.top=half;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const unit=2*half/height;
    for(const w of wheels) {
      if(!w.handle)continue;
      const {flag,boom,plate,catchArea,front}=w.handle;
      const start=new T.Vector3(0,top+.03,front);
      const finish=start.clone().add(new T.Vector3((narrow?-26:0)*unit,0,29*unit/-screenUp.z));
      const arm=finish.clone().sub(start);
      boom.position.copy(start).lerp(finish,.5);
      boom.scale.z=arm.length(); boom.rotation.y=Math.atan2(arm.x,arm.z);
      flag.position.copy(finish); flag.quaternion.copy(camera.quaternion);
      plate.scale.set(64*unit,32*unit,1);
      catchArea.scale.set(70*unit,44*unit,1);
      w.text.sprite.scale.set(58*unit,28*unit,1);
    }
    render();
  }
  function surface(w, turn) {
    return point(turn,w.laneRadius,noteY+w.carriage.position.y).add(new T.Vector3(w.gear.x,0,w.gear.z));
  }
  function plane() {
    return new T.Plane(new T.Vector3(0,1,0), -(drag?.y ?? 0));
  }
  function angle(w,p) {return Math.atan2(p.x-w.gear.x,p.z-w.gear.z);}
  const view = {
    camera,resize,pickTargets:()=>picks,
    hit:({object})=>target(object.userData.key,object.userData.kind),
    sync:refreshControls, animate(){refreshControls();return Promise.resolve();},
    feedback(value){selected=value?.selected ?? model.selected;render();},
    clock(value){transport=value;render();},
    inputPlane:plane,
    beginDrag(hit,world) {
      const w=wheels.find(w=>w.key===hit.key);
      if(!w?.definition || !world || !['phase','gain'].includes(hit.kind))return false;
      const part=model.snapshot().parts.find(p=>p.key===w.key);
      const y=surface(w,0).y;
      const start=world.clone().addScaledVector(direction,(y-world.y)/direction.y);
      drag={w,kind:hit.kind,key:w.key,before:part,y,start,last:angle(w,start),delta:0,patch:null};
      return true;
    },
    dragTo(world) {
      if(!drag || !world)return;
      const d=drag;
      if(d.kind==='gain'){
        const pixels = world.clone().sub(d.start).dot(screenUp)*viewportHeight/(camera.top-camera.bottom);
        d.patch={gain:Math.max(0,Math.min(2,d.before.gain+pixels/65))};
      } else {
        const a=angle(d.w,world),step=a-d.last; d.last=a;
        d.delta+=Math.atan2(Math.sin(step),Math.cos(step));
        d.patch={phase:wrap(d.before.phase+G.phaseFromDrag(d.w.gear,d.delta/tau,period))};
      }
      onEditPreview({key:d.key,patch:d.patch});
    },
    endDrag(cancelled) {
      const d=drag;drag=null;onEditPreview(null);
      return !cancelled && d?.patch ? {key:d.key,patch:d.patch}:null;
    },
    locations() {
      root.updateMatrixWorld(true);
      return wheels.filter(w=>w.definition).flatMap(w=>[
        {...target(w.key,'phase'),point:surface(w,.27)},
        {...target(w.key,'gain'),point:w.handle ? w.handle.catchArea.getWorldPosition(new T.Vector3()) : new T.Vector3(w.gear.x,w.carriage.position.y+top+.179,w.gear.z)}
      ]);
    },
    ringPath(key,steps=64){
      const w=wheels.find(w=>w.key===key);
      return w?.definition ? Array.from({length:steps+1},(_,i)=>surface(w,i/steps)) : [];
    },
    inspect() {
      root.updateMatrixWorld(true);
      return {layout:narrow?'portrait':'landscape',position:transport.position,periodBars:period,playing:transport.playing,selected,dragging:drag?.kind||null,
        wheels:wheels.map(w=>{
          const g=w.gear, bottom=w.carriage.position.y;
          return {key:w.key,teeth:g.teeth,periodBars:g.periodBars,radius:g.radius,outerRadius:g.outerRadius,rootRadius:g.rootRadius,
            sign:g.sign,direction:g.sign,meshOffset:g.meshOffset,rotation:w.rim.rotation.y,meshTurns:w.rim.rotation.y/tau,
            bottom,top:bottom+top,faceWidth:top,center:[g.x,bottom+top,g.z],
            reader:w.reader?.getWorldPosition(new T.Vector3()).toArray() || null,
            state:w.heard?{...w.heard}:null,control:controls.parts.find(p=>p.key===w.key)??null,
            indexTurns:w.calibration ? w.calibration.rotation.y/tau : null,active:w.active,phaseOK:w.status?.phaseOK,gainOK:w.status?.gainOK,
            events:w.events.map(({source,mark},index)=>{
              const p=mark.getWorldPosition(new T.Vector3());
              return {id:source.id,index,start:source.start*period/g.periodBars,sourceStart:source.start,pitch:source.pitch,
                duration:source.duration*period/g.periodBars,point:p.toArray(),angle:wrap(angle(w,p)/tau)};
            })
          };
        })};
    },
    dispose(){drag=null;}
  };
  view.updateMusic=view.clock;
  resize(1.5,900,600);
  return view;
}};
