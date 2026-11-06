/* SPDX-License-Identifier: AGPL-3.0-or-later */
// The same axes are used on every mounting plate. Sockets are on the rim,
// Y is the shaft axis. The front (+Z) of a score wheel is its reading point.
window.IsoPieces = (() => {
  'use strict';
  const T = window.THREE;
  const TAU = Math.PI * 2;
  const vec = (x, y, z) => new T.Vector3(x, y, z);
  const pigments = {
    ivory: '#f5e8cd', edge: '#374751', ink: '#27363d', rubber: '#233239',
    mint: '#50b7a5', teal: '#237d76', orange: '#ec7851', brick: '#b45438',
    gold: '#e7b04b', brass: '#dcc18a', steel: '#adc7c3', paper: '#fff4d7',
    plum: '#8f6c95', violet: '#b494be', wood: '#a5664c',
    passive: '#737e7d', cast: '#b9c0b8'
  };
  const noteColors = [
    pigments.orange,'#d27392','#e79a68','#bd819a', '#60c5b6','#749dbe',
    '#ab9dcc','#e9af44','#ef9f79','#b9c778','#82a9ae','#b889aa'
  ];
  function noteColor(pitch) {
    if (!Number.isFinite(pitch)) return pigments.edge;
    const n=Math.round(pitch);
    if(n>=60&&n<72)return noteColors[n-60];
    return 'hsl('+Math.round((n*137.508+27)%360)+',64%,'+(43+(7*n)%22)+'%)';
  }
  const materials = new Map(), geometries = new Map();
  function paint(tone) {
    const hex = pigments[tone] || tone;
    if (!materials.has(hex)) {
      const metal = tone === 'brass' || tone === 'steel';
      materials.set(hex, tone==='glass'?new T.MeshStandardMaterial({
        color:0x9cd9d1,roughness:.20,transparent:true,opacity:.19,depthWrite:false
      }):new T.MeshStandardMaterial({
        color: hex, roughness: metal ? .42 : .64, metalness: metal ? .36 : .1
      }));
    }
    return materials.get(hex);
  }
  function geometry(key, build) {
    if (!geometries.has(key)) geometries.set(key, build());
    return geometries.get(key);
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const g = new T.Group();
    parent.add(g); g.position.set(x, y, z); return g;
  }
  function mesh(parent, shape, tone, x, y, z) {
    const m = new T.Mesh(shape, paint(tone));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    parent.add(m); return m;
  }
  function action(object, type, index) {
    object.userData.action = index === undefined ? {type} : {type,index};
    return object;
  }
  function extrude(shape, depth, bevel = 0) {
    const g = new T.ExtrudeGeometry(shape, {
      depth, steps: 1, curveSegments: 8, bevelEnabled: bevel > 0,
      bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1
    });
    g.rotateX(-Math.PI / 2);
    return g;
  }
  function rounded(w, d, r) {
    const x = w / 2, z = d / 2, p = new T.Shape();
    p.moveTo(-x+r,-z); p.lineTo(x-r,-z); p.quadraticCurveTo(x,-z,x,-z+r);
    p.lineTo(x,z-r); p.quadraticCurveTo(x,z,x-r,z); p.lineTo(-x+r,z);
    p.quadraticCurveTo(-x,z,-x,z-r); p.lineTo(-x,-z+r); p.quadraticCurveTo(-x,-z,-x+r,-z);
    return p;
  }
  // Rounded casting; coordinates are the centre, as for the cylinders.
  function plate(p, w,h,d, x,y,z, tone, corner = .1) {
    const r = Math.min(corner, w*.48, d*.48), b = Math.min(h*.09, .016, r*.5);
    const g = geometry(['plate',w,h,d,r].join(), () => {
      const shape = extrude(rounded(w-2*b,d-2*b,r-b),h-2*b,b);
      shape.translate(0,-h/2+b,0); return shape;
    });
    return mesh(p,g,tone,x,y,z);
  }
  function cyl(p, rt, rb, h, x,y,z, tone, sides = 32) {
    return mesh(p,geometry(['cyl',rt,rb,h,sides].join(), () => new T.CylinderGeometry(rt,rb,h,sides)),tone,x,y,z);
  }
  function ball(p, r, x,y,z, tone) {
    return mesh(p,geometry('ball'+r,() => new T.SphereGeometry(r,18,10)),tone,x,y,z);
  }
  function rod(p, a, b, r, tone) {
    const dir = vec(...b).sub(vec(...a)), m = cyl(p,r,r,dir.length(),0,0,0,tone,12);
    m.position.copy(vec(...a)).addScaledVector(dir,.5);
    m.quaternion.setFromUnitVectors(vec(0,1,0),dir.normalize());
    return m;
  }
  function lathe(p, points, x,y,z, tone) {
    const g = geometry('lathe'+points.flat().join(), () => new T.LatheGeometry(points.map(v=>new T.Vector2(...v)),40));
    return mesh(p,g,tone,x,y,z);
  }
  function bead(p, radius, thickness, x,y,z, tone) {
    const geo = geometry(['ring',radius,thickness].join(), () => {
      const g = new T.TorusGeometry(radius,thickness,8,48); return g.rotateX(-Math.PI/2);
    });
    return mesh(p,geo,tone,x,y,z);
  }
  function mounting(p, w, d, tone) {
    plate(p,w-.10,.11,d-.10,0,.055,0,'ink',.21);
    plate(p,w,.22,d,0,.205,0,tone,.24);
    plate(p,w-.08,.06,d-.09,0,.334,0,'ivory',.20);
  }
  // Clip parallel bands to the same meniscus. One dose containing C+E
  // keeps two separate colour bands, irrespective of camera or instrument.
  function bandGeometry(index,count) {
    return geometry('meniscus:'+index+'/'+count,()=>{
      const a=Math.acos(2*index/count-1),b=Math.acos(2*(index+1)/count-1);
      const shape=new T.Shape();
      shape.moveTo(Math.cos(a),Math.sin(a));shape.absarc(0,0,1,a,b,true);
      shape.lineTo(Math.cos(b),-Math.sin(b));shape.absarc(0,0,1,-b,-a,true);
      shape.closePath();return extrude(shape,1);
    });
  }
  function liquid(parent,x,y,z,rx,rz,h) {
    const body=group(parent,x,y,z),stripes=[];
    body.scale.set(rx,h,rz);body.visible=false;
    let last=[];
    function set(pitches){
      if(last.length===pitches.length&&last.every((p,i)=>p===pitches[i]))return;
      last=pitches.slice();body.visible=last.length>0;
      while(stripes.length<last.length)stripes.push(mesh(body,bandGeometry(0,1),'mint',0,0,0));
      stripes.forEach((band,i)=>{
        band.visible=i<last.length;
        if(band.visible){band.geometry=bandGeometry(i,last.length);band.material=paint(noteColor(last[i]));}
      });
    }
    return {body,set};
  }
  function pipe(parent,points,r,tone) {
    for(let i=1;i<points.length;i++)rod(parent,points[i-1],points[i],r,tone);
    for(const p of points.slice(1,-1))ball(parent,r,...p,tone);
  }
  function hit(frame, id) {
    return frame.playing && frame.tick.activity[id].length ? Math.max(0,1-frame.progress*2.6) : 0;
  }

  // Tooth profiles follow the 20-degree involute used on the original game
  // gear train. Changing a musical phase only indexes the separate pin sleeve.
  function gear(p, teeth, module, h, x, y, z, tone) {
    const geo = geometry(['teeth',teeth,module,h].join(), () => {
      const radius=teeth*module/2, base=radius*Math.cos(Math.PI/9), root=radius-1.25*module, tip=radius+module;
      const pitch=TAU/teeth, inv=a=>Math.tan(a)-a;
      const half=r=>Math.min(.41*pitch,.243*pitch+inv(Math.PI/9)-inv(Math.acos(Math.min(1,base/r))));
      const mid = Math.max(root,base), flank = [root,mid,(mid+tip)*.5,tip];
      const path = new T.Shape();
      for(let i=0;i<teeth;i++) {
        const points=[[-pitch*.5,root],...flank.map(r=>[-half(r),r]),...flank.slice().reverse().map(r=>[half(r),r])];
        points.forEach(([a,r],j)=>{
          const t=i*pitch+a, xx=r*Math.sin(t), zz=-r*Math.cos(t);
          if (i===0 && j===0) path.moveTo(xx,zz); else path.lineTo(xx,zz);
        });
      }
      path.closePath();
      return extrude(path,h,.006);
    });
    return mesh(p,geo,tone,x,y,z);
  }
  const sourceDrives=new WeakMap();
  function scoreAngle(frame) {
    return ((frame.time||0)*8-frame.state.source.phase)*TAU/8;
  }
  function scorePin(frame,index) {
    const a=scoreAngle(frame)-index*TAU/8;
    return {x:.55+.95*Math.sin(a),y:1.241,z:.13+.95*Math.cos(a)};
  }
  function source(root) {
    const drive={wheel:null,handle:null,angle:0,level:1};
    sourceDrives.set(root,drive);
    mounting(root,3.22,2.08,'teal');
    // The meniscus sits below the lip; the fourth glass is empty for rests.
    const pitches=window.IsoFlow.PALETTE.filter(pitch=>pitch!==null).concat(null);
    const pitchers=pitches.map((pitch,i)=>{
      const x=(i-1.5)*.8, p=group(root,x,.36,-.72);
      const tone=pitch===null?'edge':noteColor(pitch);
      cyl(p,.13,.19,.19,0,.12,0,'brass');
      cyl(p,.092,.098,.18,0,.238,0,'paper');
      lathe(p,[[.078,0],[.14,.08],[.236,.18],[.288,.25],[.295,.43],[.275,.43],[.26,.25],[.074,.05]],
        0,.285,0,'glass');
      bead(p,.292,.024,0,.715,0,'steel');
      const fill=pitch===null?null:cyl(p,.261,.121,.236,0,.521,0,tone);
      if(fill){
        bead(p,.242,.009,0,.641,0,tone);
        rod(p,[-.16,.587,-.16],[-.10,.665,-.22],.012,'paper');
      }
      return {body:p,fill,pitch};
    });
    rod(root,[-1.20,.414,-.55],[1.41,.414,-.55],.07,'teal');
    rod(root,[1.41,.414,-.55],[1.41,.40,.88],.07,'teal');
    rod(root,[1.41,.40,.88],[1.41,.31,1.08],.075,'brass');
    ball(root,.07,1.41,.414,-.55,'teal');
    const x = .55, z = .16, module = .058, big = 24, small = 14;
    const r = big*module/2, d = (big+small)*module/2;
    const rim = group(root,x,.44,z), smallRim = group(root,x-d,.435,z);
    gear(rim,big,module,.25,0,0,0,'teal');
    const smallWheel = gear(smallRim,small,module,.245,0,0,0,'brass');
    cyl(smallRim,.29,.31,.055,0,.265,0,'orange');
    cyl(smallRim,.088,.105,.10,0,.315,0,'brass',6);
    const sleeve = group(root,x,.71,z);
    action(cyl(sleeve,.63,.64,.09,0,0,0,'edge'),'phase');
    action(cyl(sleeve,.599,.612,.055,0,.062,0,'mint'),'phase');
    action(bead(sleeve,.585,.020,0,.094,0,'ivory'),'phase');
    action(cyl(sleeve,.344,.35,.033,0,.095,0,'teal'),'phase');
    action(smallWheel,'phase'); action(rim,'phase');
    const pins = Array.from({length:8},(_,i)=>{
      const a = -i*TAU/8, px=.472*Math.sin(a), pz=.472*Math.cos(a);
      const pin = action(group(sleeve,px,.102,pz),'pin',i);
      cyl(pin,.142,.13,.027,0,.003,0,'ink',24);
      bead(pin,.128,.015,0,.038,0,'steel');
      return liquid(pin,0,.023,0,.114,.114,.036);
    });
    const stem = group(root,x,.81,z);
    action(stem,'level');
    cyl(stem,.152,.152,.33,0,.06,0,'brass');
    const handle = group(stem);
    cyl(handle,.23,.20,.095,0,.04,0,'edge',24);
    cyl(handle,.191,.223,.09,0,.129,0,'gold',12);
    cyl(handle,.093,.096,.035,0,.185,0,'brass',6);
    const reader = group(root,x,.36,z+.84);
    cyl(reader,.102,.14,.18,0,.08,0,'edge');
    rod(reader,[0,.08,0],[0,.48,-.006],.055,'brass');
    rod(reader,[0,.48,-.006],[0,.515,-.338],.042,'ivory');
    const lamp = ball(reader,.061,0,.51,-.338,'orange');
    return {
      ports:{out:vec(1.41,.31,1.22)},
      update(f) {
        const {phase,level,notes}=f.state.source, turn=(f.tick.tick+f.progress)*TAU/8;
        rim.rotation.y=turn;
        // At contact, crest of the driven gear faces the gap in the driver.
        smallRim.rotation.y=-turn*big/small;
        drive.angle=scoreAngle(f);
        if(drive.wheel)drive.wheel.rotation.y=drive.angle;
        const editing=f.focusPart==='source';
        sleeve.visible=!editing;sleeve.rotation.y=turn-phase*TAU/8;
        handle.position.y=.045+.145*level;
        stem.visible=!editing;drive.level=level;
        if(drive.handle)drive.handle.position.y=1.39+.19*level;
        notes.forEach((pitch,i)=>{
          pins[i].set(IsoFlow.pitches(pitch));
        });
        const e=f.tick.activity.source[0], pulse=hit(f,'source');
        pitchers.forEach(({body,fill,pitch})=>{
          body.position.z=editing?-1.88:-.72;
          if(fill)fill.scale.y=f.tick.activity.source.some(packet=>packet.pitch===pitch)?1-.14*pulse:1;
        });
        reader.visible=!editing;
        lamp.material=paint(pulse>.12?noteColor(e.pitch):'paper');
      }
    };
  }

  function horizontalSleeve(parent,x,y,z,r,length,tone) {
    const sleeve=cyl(parent,r,r,length,x,y,z,tone,32);
    sleeve.rotation.x=Math.PI/2;return sleeve;
  }
  function copier(root) {
    mounting(root,1.75,1.60,'passive');
    // Positive-displacement twin head: the manifold charges two equal
    // cylinders. A common stroke ejects a full measure from each branch.
    const xLeft=-.44,xRight=.44,y=.57;
    pipe(root,[[0,.29,-.88],[0,.446,-.46],[0,.446,-.12]],.074,'cast');
    pipe(root,[[xLeft,.446,-.12],[xRight,.446,-.12]],.063,'passive');
    const crosshead=group(root), button=group(root,0,.664,-.56);
    plate(crosshead,1.14,.12,.15,0,y,-.56,'passive',.057);
    cyl(button,.16,.183,.10,0,-.025,0,'ink');
    cyl(button,.138,.154,.080,0,.040,0,'steel');
    const cylinders=[xLeft,xRight].map(x=>{
      horizontalSleeve(root,x,y,.08,.208,.79,'glass');
      for(const z of [-.29,.47]){
        horizontalSleeve(root,x,y,z,.222,.07,'cast');
        horizontalSleeve(root,x,y,z+.035,.191,.027,'edge');
      }
      // A slim glint reveals a curved transparent wall even when empty.
      rod(root,[x-.105,y+.176,-.23],[x-.105,y+.176,.38],.010,'ivory');
      pipe(root,[[x,y,.48],[x,.39,.66],[x,.29,.85]],.073,'passive');
      const piston=group(crosshead,x,y,-.245);
      horizontalSleeve(piston,0,0,-.16,.045,.40,'steel');
      horizontalSleeve(piston,0,0,0,.179,.065,'edge');
      horizontalSleeve(piston,0,0,.039,.174,.022,'cast');
      const dose=liquid(root,x,y,-.202,.164,.164,.62);
      dose.body.name=x===xLeft?'copy:copy':'copy:out';
      dose.body.rotation.x=Math.PI/2;
      return dose;
    });
    return {
      ports:{in:vec(0,.29,-.99),out:vec(.44,.29,.99),copy:vec(-.44,.29,.99)},
      update(frame) {
        const view=frame,batch=IsoFlow.tones(view.tick.activity.copy);
        const u=batch.length?view.progress:0;
        // Fast delivery, then both plungers retract together.
        const stroke=batch.length?Math.sin(Math.PI*u)**2:0;
        crosshead.position.z=.53*stroke;
        button.position.y=.664-.066*stroke;
        cylinders.forEach(dose=>{
          dose.set(batch);
          dose.body.position.z=-.202+crosshead.position.z;
          dose.body.scale.y=.62-crosshead.position.z;
        });
      }
    };
  }

  function delay(root) {
    mounting(root,2.09,1.37,'teal');
    const byX=-.84, socketX=i=>-.50+i*.44;
    pipe(root,[[-.70,.29,-.77],[-.70,.44,-.48],[-.84,.44,-.36],[byX,.44,.43]],.050,'steel');
    pipe(root,[[-.70,.43,-.40],[-.50,.43,-.35],[-.50,.51,-.14]],.050,'brass');
    pipe(root,[[byX,.424,.43],[.98,.424,.43],[.98,.29,.78]],.060,'teal');
    const doseValve=group(root,-.72,.531,-.51);
    cyl(doseValve,.147,.154,.10,0,-.018,0,'ink');
    cyl(doseValve,.118,.136,.10,0,.067,0,'orange');
    const direct=liquid(root,byX,.485,.0,.05,.275,.018);
    const selector=action(group(root),'delay');
    const cells=Array.from({length:IsoFlow.MAX_DELAY},(_,i)=>{
      const x=socketX(i),vial=group(root,x,0,-.012);
      cyl(vial,.202,.207,.09,0,.42,0,'edge',28);
      cyl(vial,.187,.178,.43,0,.647,0,'glass',32);
      const lip=bead(vial,.181,.024,0,.862,0,'steel');
      rod(vial,[-.116,.505,-.12],[-.116,.794,-.12],.010,'ivory');
      const contents=liquid(vial,0,.466,0,.152,.152,.32);
      contents.body.name='delay:measure-'+(i+1);
      // The tap below each cylinder leads to the common discharge pipe.
      pipe(root,[[x,.437,.105],[x,.454,.26],[x,.424,.43]],.048,'brass');
      const tap=cyl(selector,.072,.092,.08,x,.492,.235,'steel',12);
      return {lip,contents,tap};
    });
    // Short upward siphons make the order visible: only the first measure
    // is fed directly. Each subsequent measure borrows one more clock step.
    const bridges=cells.slice(1).map((_,i)=>{
      const x=socketX(i),next=socketX(i+1),bridge=group(root);
      pipe(bridge,[[x+.095,.70,-.125],[x+.095,.816,-.241],[next-.095,.816,-.241],
        [next-.095,.735,-.125]],.040,'brass');
      return bridge;
    });
    const directTap=cyl(selector,.084,.095,.08,byX,.492,.32,'steel',12);
    const cursor=bead(selector,.105,.024,0,.548,.23,'teal');
    return {
      ports:{in:vec(-.70,.29,-.87),out:vec(.98,.29,.90)},
      update(frame) {
        const view=frame,tick=view.tick,n=frame.state.delay;
        const active=i=>i===n?'teal':'steel';
        directTap.material=paint(active(0));
        const now=tick.tick, inlet=IsoFlow.tones(tick.activity.delay);
        direct.set(n===0?inlet:[]);
        doseValve.position.y=.531-(inlet.length?.047*Math.sin(Math.PI*view.progress):0);
        cursor.position.x=n?socketX(n-1):byX;
        cursor.position.z=n?.235:.32;
        bridges.forEach((bridge,i)=>{
          bridge.visible=i+1<n||tick.pockets.some(p=>p.due-p.entered>i+1);
        });
        cells.forEach(({lip,contents,tap},i)=>{
          const resident=tick.pockets.filter(p=>now-p.entered===i);
          const pitches=IsoFlow.tones(resident);
          contents.set(pitches);
          const draining=resident.some(p=>p.due===now+1);
          contents.body.scale.y=draining?.32*(1-.58*view.progress):.32;
          lip.material=paint(i<n||resident.length?'mint':'steel');
          tap.material=paint(active(i+1));
        });
      }
    };
  }

  const CAM = Object.freeze({x:-.35, z:-.105, scale:.85, low:.77, high:1.047, pitch:TAU/8});
  const travel = CAM.high-CAM.low;
  const camPoses=new WeakMap(), barrelPoses=new WeakMap();
  const barrelBase=.49, barrelSpacing=.30;
  const smooth=t=>t*t*(3-2*t);
  const wrap=(n,m)=>(n%m+m)%m;
  function camRadius(unit,previous,raised,next) {
    const current=raised?CAM.high:CAM.low;
    const adjacent=unit<0?previous:next;
    const neighbour=adjacent?CAM.high:CAM.low;
    // Rounded shoulders link different program heights. A shallow root at
    // every joint keeps all eight teeth visible even in a constant program.
    const edge=smooth(Math.max(0,(Math.abs(unit)-.32)/.18));
    return current+(neighbour-current)*.5*edge-.099*edge;
  }
  function createCamDrive() {
    const pose={angle:0,radius:CAM.low,gateX:0,reader:0,animating:false};
    let from=0,to=0,started=0,lastUnit=null,wasPlaying=false;
    return {pose,update(frame,routes){
      // At playback a boundary passes the follower on each onset. At rest
      // put the chosen lobe's flat centre under it, by the shortest rotation.
      const tick=frame.time*8;
      const unit=frame.playing?tick-.5:frame.selected==='router'?(frame.previewStep??0):Math.floor(tick);
      const now=performance.now();
      if(frame.playing){
        pose.angle=unit*CAM.pitch;pose.animating=false;
      }else{
        if(unit!==lastUnit||wasPlaying){
          from=pose.angle;to=from+wrap(unit*CAM.pitch-from+Math.PI,TAU)-Math.PI;
          started=now;pose.animating=Math.abs(to-from)>.001;
        }
        if(pose.animating){
          const k=Math.min(1,(now-started)/190);
          pose.angle=from+(to-from)*smooth(k);pose.animating=k<1;
        }
      }
      lastUnit=unit;wasPlaying=frame.playing;
      const turns=pose.angle/CAM.pitch,nearest=Math.round(turns),i=wrap(nearest,8);
      pose.reader=i;
      pose.radius=camRadius(turns-nearest,routes[(i+7)%8],routes[i],routes[(i+1)%8]);
      pose.gateX=CAM.x+pose.radius+.31;
      return pose;
    }};
  }
  function camSector(previous,raised,next) {
    return geometry(['cam-wedge',previous,raised,next].join(),()=>{
      const p=new T.Shape(), divisions=24;
      for(let j=0;j<=divisions;j++) {
        const u=-.493+j*.986/divisions, a=u*CAM.pitch;
        const r=camRadius(u,previous,raised,next);
        if(j===0)p.moveTo(r*Math.cos(a),-r*Math.sin(a));
        else p.lineTo(r*Math.cos(a),-r*Math.sin(a));
      }
      for(let j=divisions;j>=0;j--){
        const a=(-.493+j*.986/divisions)*CAM.pitch;
        p.lineTo(.328*Math.cos(a),-.328*Math.sin(a));
      }
      p.closePath();
      return extrude(p,.125,.012);
    });
  }
  function router(root) {
    const bench=group(root);bench.scale.set(CAM.scale,1,CAM.scale);
    mounting(bench,3.02,2.34,'edge');
    const {x,z,pitch}=CAM;
    const barrel=group(bench,x,0,z), rows=[];
    const shaft=cyl(bench,.115,.13,2.0,x,1.31,z,'steel',24);
    cyl(bench,.34,.40,.12,x,.414,z,'brass',40);
    const crown=cyl(bench,.22,.23,.09,x,2.19,z,'teal',24);
    const green='#287e6d', amber='#bf653b';
    const lowX=x+CAM.low+.10+.21, highX=lowX+travel;
    function outlet(px,points,tone) {
      pipe(bench,points,.085,tone);
      cyl(bench,.158,.168,.07,px,.444,.665,tone,28);
      cyl(bench,.099,.102,.035,px,.489,.665,tone===green?'#73c9ad':'#e4a06a',28);
    }
    outlet(highX,[[highX,.404,.665],[highX,.391,.91],[.88,.31,1.185]],green);
    outlet(lowX,[[lowX,.399,.665],[.49,.394,.99],[-.40,.391,.99],[-.565,.31,1.185]],amber);
    pipe(bench,[[.47,.31,-1.18],[.47,.40,-.92],[1.12,.40,-.76],[1.24,.40,-.56],
      [1.24,.40,.47],[1.11,.40,.665],[lowX,.40,.665]],.068,'brass');
    for(const zz of [.50,.826])rod(bench,[lowX-.29,.521,zz],[highX+.28,.521,zz],.036,'steel');
    const carriage=group(bench);
    const plateShape=rounded(.82,.41,.065), aperture=new T.Path();
    aperture.absarc(0,0,.113,0,TAU,true);plateShape.holes.push(aperture);
    mesh(carriage,geometry('ported-valve',()=>extrude(plateShape,.065,.007)),'steel',.21,.524,.665);
    // The selected cam presses one follower. Its vertical link transfers the
    // same horizontal displacement to the two-way valve at the mounting plate.
    rod(carriage,[0,.61,z],[.21,.59,.15],.043,'brass');
    rod(carriage,[.21,.59,.15],[.21,.578,.50],.049,'brass');
    const selector=action(group(carriage),'route-preset',0);
    const roller=cyl(selector,.102,.105,.15,0,0,z,'edge',24);
    cyl(selector,.049,.053,.027,0,.09,z,'steel',16);
    const grip=cyl(selector,.12,.13,.10,.17,.045,z+.20,'teal',24);
    const stem=cyl(carriage,.034,.034,1,0,.99,z,'brass',12);
    const drive=createCamDrive(), pose=drive.pose;
    Object.assign(pose,{count:0,selected:0,followerY:.63,rows:[]});
    camPoses.set(root,pose);barrelPoses.set(root,pose);
    let signature='', lastTime=performance.now();
    function programRows(programs){
      const next=programs.map(p=>p.routes.map(Number).join('')).join('/');
      if(next===signature)return;
      signature=next;
      while(rows.length<programs.length){
        const index=rows.length, row=action(group(barrel,0,barrelBase+index*barrelSpacing,0),'route-preset',index);
        const core=cyl(row,.625,.625,.145,0,.08,0,'brass',48);
        const cells=Array.from({length:8},(_,i)=>{
          const arm=group(row);arm.rotation.y=-i*pitch;
          return mesh(arm,camSector(false,false,false),'mint',0,.078,0);
        });
        rows.push({body:row,core,cells});
      }
      rows.forEach((row,index)=>{
        row.body.visible=index<programs.length;
        if(!row.body.visible)return;
        const routes=programs[index].routes;
        row.cells.forEach((tooth,i)=>{
          tooth.geometry=camSector(routes[(i+7)%8],routes[i],routes[(i+1)%8]);
        });
      });
      pose.count=programs.length;
      pose.rows=programs.map((_,i)=>({x:(x+.49)*CAM.scale,y:barrelBase+i*barrelSpacing+.17,z:(z+.53)*CAM.scale}));
      crown.position.y=barrelBase+(programs.length-1)*barrelSpacing+.31;
      const length=crown.position.y-.40;
      shaft.scale.y=length/2;shaft.position.y=.40+length/2;
    }
    return {
      ports:{in:vec(.4,.31,-1.16),straight:vec(.75,.31,1.16),side:vec(-.48,.31,1.16)},
      needsFrame:()=>pose.animating||Math.abs(pose.followerY-(barrelBase+pose.selected*barrelSpacing+.14))>.001,
      update(f) {
        const s=f.selected==='router'&&!f.playing?(f.editState||f.state):f.state;
        const programs=IsoFlow.routerPrograms(s), route=s.routes;
        programRows(programs);
        pose.selected=IsoFlow.routePresetIndex(s);
        drive.update(f,route);
        barrel.rotation.y=pose.angle;
        rows.forEach((row,index)=>{
          const active=index===pose.selected;
          row.core.material=paint(active?'brass':'cast');
          row.cells.forEach(tooth=>{tooth.material=paint(active?'mint':'#6e9290');});
        });
        const now=performance.now(), dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
        const target=barrelBase+pose.selected*barrelSpacing+.14;
        pose.followerY+=(target-pose.followerY)*(1-Math.exp(-24*dt));
        if(Math.abs(target-pose.followerY)<.001)pose.followerY=target;
        selector.position.y=pose.followerY;selector.userData.action.index=pose.selected;
        stem.scale.y=Math.max(.03,pose.followerY-.61);stem.position.y=(pose.followerY+.61)/2;
        carriage.position.x=x+pose.radius+.10;
        grip.material=paint(route[pose.reader]?green:amber);
      }
    };
  }

  function receiverWindow(parent,x,y,z,rx,rz,inX,inZ) {
    pipe(parent,[[inX,.30,inZ],[inX,.47,z],[x,y-.04,z]],.063,'brass');
    const base=cyl(parent,1,1,.047,x,y,z,'edge');
    base.scale.set(rx,1,rz);
    const window=liquid(parent,x,y+.025,z,rx*.89,rz*.81,.026);
    window.body.name='receiver:sight-glass';
    return (frame,id)=>{
      const sounding=frame.tick.hits[id].filter(p=>p.gain>0&&frame.progress<p.length);
      window.set(IsoFlow.tones(sounding));
    };
  }
  function keys(root) {
    mounting(root,1.91,1.51,'passive');
    plate(root,1.75,.22,1.15,0,.465,0,'passive',.14);
    plate(root,1.58,.11,.82,0,.615,.121,'ink',.04);
    plate(root,1.72,.24,.29,0,.665,-.39,'cast');
    const fill=receiverWindow(root,0,.797,-.39,.73,.113,0,-.81);
    const keyboard=[];
    for (let i=0;i<7;i++) {
      const key=group(root,(i-3)*.212,.711,-.17);
      plate(key,.197,.09,.665,0,0,.329,'paper',.034);
      keyboard.push(key);
    }
    for (const i of [0,1,3,4,5]) {
      plate(root,.108,.11,.36,(i-2.5)*.212,.798,.013,'ink',.018);
    }
    const keyIndex={60:0,64:2,67:4};
    return {ports:{in:vec(0,.29,-.94)},update(f) {
      fill(f,'keys');
      const struck=f.tick.hits.keys, strength=hit(f,'keys');
      keyboard.forEach((key,i)=>{
        key.rotation.x=struck.some(box=>keyIndex[box.pitch]===i)?strength*.16:0;
      });
    }};
  }

  function bell(root) {
    mounting(root,1.54,1.44,'passive');
    cyl(root,.475,.535,.135,.08,.423,0,'edge');
    cyl(root,.424,.450,.10,.08,.523,0,'cast');
    const dome=group(root,.08,.573,0);
    const fill=receiverWindow(root,-.08,.612,-.530,.40,.105,-.21,-.76);
    lathe(dome,[[.002,.007],[.45,.007],[.459,.035],[.435,.066],[.41,.19],
      [.35,.34],[.255,.448],[.14,.50],[.047,.524],[.002,.524]],0,0,0,'steel');
    bead(dome,.45,.021,0,.031,0,'cast');
    cyl(dome,.073,.095,.055,0,.532,0,'edge');
    ball(dome,.06,0,.584,0,'cast');
    const hammer=group(root,-.52,.43,.29);
    cyl(hammer,.088,.106,.11,0,0,0,'edge');
    rod(hammer,[0,0,0],[.10,.37,-.03],.036,'cast');
    ball(hammer,.095,.10,.37,-.03,'cast');
    return {ports:{in:vec(-.21,.29,-.90)},update(f) {
      fill(f,'bell');
      const strike=hit(f,'bell');
      hammer.rotation.z=.32-strike*.86;
      dome.rotation.z=strike*Math.sin(f.progress*Math.PI*8)*.037;
    }};
  }

  function bin(root) {
    mounting(root,1.46,1.38,'passive');
    pipe(root,[[0,.29,-.76],[0,.58,-.42],[0,.62,-.28]],.083,'cast');
    lathe(root,[[.16,0],[.32,.075],[.484,.212],[.48,.255],[.42,.25],[.23,.118],[.12,.111]],
      0,.37,.09,'steel');
    bead(root,.469,.022,0,.622,.09,'ivory');
    cyl(root,.23,.22,.032,0,.477,.09,'ink');
    for(const x of [-.117,0,.117])rod(root,[x,.504,-.077],[x,.504,.25],.020,'steel');
    const spill=liquid(root,0,.521,.09,.320,.310,.030);
    return {ports:{in:vec(0,.29,-.88)},update(f) {
      spill.set(IsoFlow.tones(f.progress<.78?f.tick.hits.bin:[]));
      const remaining=Math.max(.1,1-f.progress);
      spill.body.scale.x=.320*remaining;spill.body.scale.z=.310*remaining;
    }};
  }
  const makers = {source,copy:copier,delay,router,keys,bell,bin};
  function create(id) {
    const build=makers[id];
    if(!build) throw new RangeError('Неизвестная деталь: '+id);
    const assembly=new T.Group();
    assembly.name=id;
    const result=build(assembly);
    return {group:assembly,ports:result.ports,needsFrame:result.needsFrame,
      update(frame){
        const probe=frame.testFluid;
        if(!probe||id==='source'){result.update(frame);return;}
        result.update({...frame,tick:probe.tick,progress:probe.progress,playing:true,time:probe.age/IsoFlow.STEPS});
      }};
  }
  // The service faces are attached to the casting when the camera opens a
  // machine. Geometry and its accessible printed legends share local axes.
  function serviceFace(id,parent) {
    const shell=group(parent), caps=new Map(),windows=new Map();
    let scoreWheel;
    shell.name=id+'-service';shell.visible=false;
    if(id==='source'){
      const drive=sourceDrives.get(parent);
      scoreWheel=group(shell,.55,0,.13);drive.wheel=scoreWheel;scoreWheel.rotation.y=drive.angle;
      action(cyl(scoreWheel,1.115,1.105,.093,0,1.13,0,'edge',64),'phase');
      cyl(scoreWheel,.775,.78,.016,0,1.18,0,'teal',64);
      bead(scoreWheel,.71,.012,0,1.196,0,'mint');
      cyl(scoreWheel,.17,.20,.43,0,1.39,0,'brass',16);
      drive.handle=action(group(shell,.55,1.39+.19*drive.level,.13),'level');
      cyl(drive.handle,.27,.25,.13,0,0,0,'gold',12);
      cyl(drive.handle,.11,.13,.035,0,.09,0,'brass',12);
      for(let i=0;i<3;i++){
        const bar=group(scoreWheel);
        bar.rotation.y=i*TAU/3;
        plate(bar,.06,.016,.38,0,1.20,.44,'mint',.021);
      }
      for(const x of [-.36,1.44])rod(shell,[x,.35,.09],[x,1.135,.09],.064,'brass');
      // A fixed ivory pointer hangs just outside the lower edge of the
      // revolving program. Each head arrives here on its sounding eighth.
      rod(shell,[.55,.38,1.075],[.55,1.235,1.365],.043,'brass');
      const tip=geometry('score-read-head',()=>{
        const shape=new T.Shape();shape.moveTo(-.09,-.09);shape.lineTo(.09,-.09);
        shape.lineTo(0,.105);shape.closePath();return extrude(shape,.035,.005);
      });
      mesh(shell,tip,'paper',.55,1.24,1.335);

      for(let i=0;i<4;i++)rod(shell,[(i-1.5)*.8,.39,-1.88],[(i-1.5)*.8,.39,-.54],.055,'brass');
    }
    function key(key,x,y,z,w,d,round) {
      const pin=scoreWheel&&key.startsWith('pin-');
      const mount=pin?scoreWheel:shell;
      const px=pin?x-.55:x, pz=pin?z-.13:z;
      const wet=pin||key.startsWith('arrival-');
      const pad=round?cyl(mount,w/2,w/2+.008,.078,px,y-.045,pz,wet?'edge':'paper',32):
        plate(shell,w,.080,d,x,y-.043,z,wet?'edge':'paper',.067);
      if(wet){
        const rx=w*.43,rz=(round?w:d)*.43;
        const well=liquid(mount,px,y-.004,pz,rx,rz,.035);
        windows.set(key,well);
        if(pin)bead(mount,w*.457,.011,px,y+.002,pz,'steel');
      }
      if(pin)action(pad,'pin',Number(key.slice(4)));
      caps.set(key,pad);
    }
    function capColor(key,color){
      const cap=caps.get(key);if(cap)cap.material=paint(color);
    }
    function capFluid(key,pitches){windows.get(key)?.set(pitches);}
    return {shell,key,capColor,capFluid};
  }
  function sourcePhase(){return {x:.55,y:1.24,z:.13,radius:1.115};}
  function sourceLevel(root){return {x:.55,y:1.39+.19*(sourceDrives.get(root)?.level??1),z:.13};}
  function routerRow(root,index){return barrelPoses.get(root)?.rows[index];}
  return Object.freeze({create,noteColor,serviceFace,scorePin,sourcePhase,sourceLevel,routerRow,
    barrelPose:root=>barrelPoses.get(root),CAM,camRadius,createCamDrive,camPose:root=>camPoses.get(root)});
})();
