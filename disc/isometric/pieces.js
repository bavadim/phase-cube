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
    plum: '#8f6c95', violet: '#b494be', wood: '#a5664c'
  };
  const noteColors = [
    pigments.orange,'#d27392','#e79a68','#bd819a', '#60c5b6','#749dbe',
    '#ab9dcc','#e9af44','#ef9f79','#b9c778','#82a9ae','#b889aa'
  ];
  function noteColor(pitch) {
    if (!Number.isFinite(pitch)) return pigments.edge;
    return noteColors[((Math.round(pitch) % 12) + 12) % 12];
  }
  const materials = new Map(), geometries = new Map();
  function paint(tone) {
    const hex = pigments[tone] || tone;
    if (!materials.has(hex)) {
      const metal = tone === 'brass' || tone === 'steel';
      materials.set(hex, new T.MeshStandardMaterial({
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
    const drive={wheel:null,angle:0};
    sourceDrives.set(root,drive);
    mounting(root,3.22,2.08,'teal');
    // Three pitch wells and an empty one for rests share the same rim and axle.
    const pitches=window.IsoFlow.PALETTE.filter(pitch=>pitch!==null).concat(null);
    const pitchers=pitches.map((pitch,i)=>{
      const x=(i-1.5)*.8, p=group(root,x,.36,-.72);
      const tone=pitch===null?'edge':noteColor(pitch);
      cyl(p,.13,.19,.19,0,.12,0,'brass');
      cyl(p,.092,.098,.18,0,.238,0,'paper');
      lathe(p,[[.078,0],[.098,0],[.124,.15],[.31,.39],[.315,.43],[.27,.43],[.080,.11],[.065,.025]],
        0,.285,0,tone);
      bead(p,.296,.022,0,.718,0,'ivory');
      const note=pitch===null?null:ball(p,.108,0,.63,0,tone);
      return {body:p,note,pitch};
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
    for (let i=0;i<3;i++) {
      const a=i*TAU/3; cyl(smallRim,.048,.046,.018,.195*Math.sin(a),.303,.195*Math.cos(a),'brick',14);
    }
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
      cyl(pin,.142,.13,.027,0,.003,0,'ink',20);
      const cap=cyl(pin,.122,.125,.095,0,.044,0,'paper',20);
      return cap;
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
        notes.forEach((pitch,i)=>{
          const cap=pins[i], rest=pitch===null;
          cap.scale.setScalar(rest?.50:1); cap.position.y=rest?.010:.066;
          cap.material=paint(rest?'steel':noteColor(pitch));
        });
        const e=f.tick.activity.source[0], pulse=hit(f,'source');
        pitchers.forEach(({body,note,pitch})=>{
          body.position.z=editing?-1.88:-.72;
          if(note)note.position.y=.63+(e?.pitch===pitch?pulse*.09:0);
        });
        reader.visible=!editing;
        lamp.material=paint(pulse>.12?noteColor(e.pitch):'paper');
      }
    };
  }

  function copier(root) {
    mounting(root,1.75,1.60,'brick');
    plate(root,1.48,.095,1.05,0,.42,.08,'edge',.13);
    const head=group(root,0,0,.04);
    [-.43,.43].forEach(x=>{
      plate(root,.57,.07,.69,x,.495,.1,'brass',.07);
      cyl(root,.086,.105,.92,x,.86,-.48,'steel');
      cyl(root,.14,.14,.09,x,.452,-.48,'ink');
      plate(head,.47,.16,.55,x,.74,.065,'orange',.08);
      cyl(head,.09,.14,.22,x,.92,.065,'brass');
      rod(head,[x,1.052,.065],[x,1.052,-.52],.052,'ivory');
      cyl(head,.114,.114,.15,x,1.053,-.52,'brick');
    });
    plate(root,1.06,.115,.24,0,1.318,-.48,'brick',.081);
    plate(head,1.34,.16,.31,0,1.085,.065,'ivory',.10);
    rod(root,[0,.39,-.44],[0,1.38,-.44],.11,'edge');
    plate(root,.31,.16,.65,0,1.34,-.21,'brick');
    const shaft=cyl(root,.068,.068,.37,0,1.18,.065,'steel');
    for(const x of [-.44,.44])rod(root,[x,.40,.41],[x,.30,.85],.065,'brass');
    return {
      ports:{in:vec(0,.29,-.99),out:vec(.44,.29,.99),copy:vec(-.44,.29,.99)},
      update(f) {
        const drop=.17*hit(f,'copy'); head.position.y=-drop;
        shaft.position.y=1.18-drop/2; shaft.scale.y=1+drop/.37;
      }
    };
  }

  function delay(root) {
    mounting(root,2.09,1.37,'plum');
    const handle=action(group(root),'delay'), pockets=[];
    for (const z of [-.38,.38]) rod(handle,[-.93,.565,z],[.94,.565,z],.045,'steel');
    for (let i=0;i<window.IsoFlow.MAX_DELAY;i++) {
      const p=group(handle);
      plate(p,.32,.085,.68,0,.49,0,'edge',.055);
      for(const z of [-.29,.29]) plate(p,.31,.18,.075,0,.58,z,'violet',.03);
      plate(p,.052,.23,.63,-.14,.60,0,'plum',.022);
      const note=plate(p,.220,.17,.28,0,.63,0,'gold',.035);
      pockets.push({p,note});
    }
    const slider=group(handle,0,0,-.39);
    cyl(slider,.09,.12,.23,0,.68,0,'brass');
    cyl(slider,.161,.186,.12,0,.84,0,'plum',16);
    cyl(slider,.124,.151,.029,0,.916,0,'paper',16);
    rod(root,[-.70,.30,-.76],[-.70,.42,-.34],.065,'brass');
    rod(root,[.89,.42,.34],[.98,.30,.73],.065,'brass');
    return {
      ports:{in:vec(-.70,.29,-.87),out:vec(.98,.29,.90)},
      update(f) {
        const count=f.state.delay, slots=f.tick.pockets;
        pockets.forEach(({p,note},i)=>{
          const value=slots.find(packet=>f.tick.tick-packet.entered===i);
          p.visible=i<count || Boolean(value);
          p.position.x=-.70+i*.40;
          note.visible=Boolean(value);
          if(value) note.material=paint(noteColor(value.pitch));
        });
        slider.position.x=-.90+count*.40;
      }
    };
  }

  const CAM = Object.freeze({x:-.35, z:-.105, scale:.85, low:.77, high:1.047, pitch:TAU/8});
  const travel = CAM.high-CAM.low;
  const camPoses=new WeakMap();
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
    cyl(bench,.665,.69,.082,x,.405,z,'edge',48);
    // The black waist and axle are part of this same cam, not a second wheel.
    const wheel=group(bench,x,.49,z);
    cyl(wheel,.633,.626,.122,0,.035,0,'brass',56);
    const cells=Array.from({length:8},(_,i)=>{
      const arm=action(group(wheel),'cam',i);arm.rotation.y=-i*pitch;
      const tooth=mesh(arm,camSector(false,false,false),'mint',0,.078,0);
      const rim=cyl(arm,.101,.119,.032,.613,.222,0,'ink',24);
      const bead=cyl(arm,.071,.077,.039,.613,.245,0,'gold',24);
      return {tooth,rim,bead};
    });
    cyl(wheel,.335,.343,.154,0,.137,0,'edge',48);
    cyl(wheel,.234,.256,.155,0,.262,0,'brass',8);
    cyl(wheel,.112,.134,.055,0,.358,0,'teal',16);
    // Single permanent brass rivet sets the origin of the cycle.
    cyl(wheel,.040,.046,.019,.265,.224,0,'paper',16);
    const green='#287e6d', amber='#bf653b';
    const lowX=x+CAM.low+.10+.21, highX=lowX+travel;
    function outlet(px,points,tone) {
      for(let i=1;i<points.length;i++)rod(bench,points[i-1],points[i],.085,tone);
      for(const p of points.slice(1,-1))ball(bench,.085,...p,tone);
      cyl(bench,.158,.168,.07,px,.444,.665,tone,28);
      cyl(bench,.099,.102,.035,px,.489,.665,tone===green?'#73c9ad':'#e4a06a',28);
    }
    outlet(highX,[[highX,.404,.665],[highX,.391,.91],[.88,.31,1.185]],green);
    outlet(lowX,[[lowX,.399,.665],[.49,.394,.99],[-.40,.391,.99],[-.565,.31,1.185]],amber);
    // Incoming manifold under the cam and the bearings on which the valve slides.
    const inlet=[[.47,.31,-1.18],[.47,.40,-.92],[1.12,.40,-.76],[1.24,.40,-.56],
      [1.24,.40,.47],[1.11,.40,.665],[lowX,.40,.665]];
    for(let i=1;i<inlet.length;i++)rod(bench,inlet[i-1],inlet[i],.068,'brass');
    for(const p of inlet.slice(1,-1))ball(bench,.068,...p,'brass');
    for(const zz of [.50,.826])rod(bench,[lowX-.29,.521,zz],[highX+.28,.521,zz],.036,'steel');
    const carriage=action(group(bench,0,0,0),'lever');
    const plateShape=rounded(.82,.41,.065), aperture=new T.Path();
    aperture.absarc(0,0,.113,0,TAU,true);plateShape.holes.push(aperture);
    mesh(carriage,geometry('ported-valve',()=>extrude(plateShape,.065,.007)),'steel',.21,.524,.665);
    rod(carriage,[0,.645,z],[.21,.609,.11],.043,'brass');
    rod(carriage,[.21,.609,.11],[.21,.578,.50],.049,'brass');
    cyl(carriage,.102,.105,.151,0,.630,z,'edge',24);
    cyl(carriage,.049,.053,.031,0,.720,z,'brass',16);
    const grip=cyl(carriage,.115,.148,.095,.21,.658,.333,'teal',24);
    bead(carriage,.095,.013,.21,.708,.333,'ivory');
    const drive=createCamDrive();
    camPoses.set(root,drive.pose);
    let lastRoutes,lastScore;
    return {
      ports:{in:vec(.4,.31,-1.16),straight:vec(.75,.31,1.16),side:vec(-.48,.31,1.16)},
      needsFrame:()=>drive.pose.animating,
      update(f) {
        const s=f.selected==='router'&&!f.playing?(f.editState||f.state):f.state;
        const route=s.routes,pose=drive.update(f,route);
        wheel.rotation.y=pose.angle;
        if(lastRoutes!==route){
          cells.forEach(({tooth},i)=>{
            tooth.geometry=camSector(route[(i+7)%8],route[i],route[(i+1)%8]);
            tooth.material=paint(route[i]?'#63b5a2':'#e29b62');
          });
          lastRoutes=route;
        }
        if(lastScore!==f.steps){
          cells.forEach(({rim,bead},i)=>{
            const note=f.steps?.[i]?.activity.router[0];
            rim.scale.setScalar(note?1:.65);bead.visible=!!note;
            if(note)bead.material=paint(noteColor(note.pitch));
          });
          lastScore=f.steps;
        }
        carriage.position.x=x+pose.radius+.10;
        grip.material=paint(route[pose.reader]?green:amber);
      }
    };
  }

  function keys(root) {
    mounting(root,1.91,1.51,'brick');
    plate(root,1.75,.22,1.15,0,.465,0,'wood',.14);
    plate(root,1.58,.11,.82,0,.615,.121,'ink',.04);
    plate(root,1.72,.24,.29,0,.665,-.39,'orange');
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
      const struck=f.tick.hits.keys, strength=hit(f,'keys');
      keyboard.forEach((key,i)=>{
        key.rotation.x=struck.some(box=>keyIndex[box.pitch]===i)?strength*.16:0;
      });
    }};
  }

  function bell(root) {
    mounting(root,1.54,1.44,'teal');
    cyl(root,.475,.535,.135,.08,.423,0,'edge');
    cyl(root,.424,.450,.10,.08,.523,0,'brass');
    const dome=group(root,.08,.573,0);
    lathe(dome,[[.002,.007],[.45,.007],[.459,.035],[.435,.066],[.41,.19],
      [.35,.34],[.255,.448],[.14,.50],[.047,.524],[.002,.524]],0,0,0,'gold');
    bead(dome,.45,.021,0,.031,0,'brass');
    cyl(dome,.073,.095,.055,0,.532,0,'edge');
    ball(dome,.06,0,.584,0,'brass');
    const hammer=group(root,-.52,.43,.29);
    cyl(hammer,.088,.106,.11,0,0,0,'edge');
    rod(hammer,[0,0,0],[.10,.37,-.03],.036,'brass');
    ball(hammer,.095,.10,.37,-.03,'orange');
    return {ports:{in:vec(-.21,.29,-.90)},update(f) {
      const strike=hit(f,'bell');
      hammer.rotation.z=.32-strike*.86;
      dome.rotation.z=strike*Math.sin(f.progress*Math.PI*8)*.037;
    }};
  }

  function bin(root) {
    mounting(root,1.46,1.38,'plum');
    cyl(root,.32,.29,.10,0,.423,0,'edge');
    const can=group(root,0,.46,0);
    cyl(can,.28,.27,.051,0,.026,0,'ink');
    for(let i=0;i<12;i++) {
      const a=i*TAU/12, b=a+.14;
      rod(can,[.285*Math.sin(a),.025,.285*Math.cos(a)],
        [.423*Math.sin(b),.665,.423*Math.cos(b)],.026,'steel');
    }
    for(const y of [.18,.40]) bead(can,.285+.204*y,.018,0,y,0,'steel');
    bead(can,.425,.036,0,.674,0,'teal');
    const scrap=plate(can,.18,.16,.23,0,0,0,'gold',.025);
    return {ports:{in:vec(0,.29,-.88)},update(f) {
      const note=f.tick.hits.bin[0];
      scrap.visible=Boolean(f.playing && note && f.progress<.61);
      if(scrap.visible) {
        scrap.position.y=.83-1.8*f.progress*f.progress;
        scrap.rotation.set(f.progress*2.9,0,f.progress*1.6);
        scrap.material=paint(noteColor(note.pitch));
      }
    }};
  }
  const makers = {source,copy:copier,delay,router,keys,bell,bin};
  function create(id) {
    const build=makers[id];
    if(!build) throw new RangeError('Неизвестная деталь: '+id);
    const assembly=new T.Group();
    assembly.name=id;
    const result=build(assembly);
    return {group:assembly,ports:result.ports,update:result.update,needsFrame:result.needsFrame};
  }
  // The service faces are attached to the casting when the camera opens a
  // machine. Geometry and its accessible printed legends share local axes.
  function serviceFace(id,parent) {
    const shell=group(parent), caps=new Map();
    let scoreWheel;
    shell.name=id+'-service';shell.visible=false;
    function casework(w,d,x,z,tone) {
      plate(shell,w,.19,d,x,.23,z,'edge',.13);
      plate(shell,w-.04,.10,d-.05,x,.37,z,tone,.11);
      for(const dx of [-1,1])for(const dz of [-1,1]) {
        cyl(shell,.025,.032,.016,x+dx*(w/2-.085),.43,z+dz*(d/2-.085),'brass',8);
      }
    }
    if(id==='source'){
      const drive=sourceDrives.get(parent);
      scoreWheel=group(shell,.55,0,.13);drive.wheel=scoreWheel;scoreWheel.rotation.y=drive.angle;
      cyl(scoreWheel,1.115,1.105,.093,0,1.13,0,'edge',64);
      cyl(scoreWheel,.775,.78,.016,0,1.18,0,'teal',64);
      bead(scoreWheel,.71,.012,0,1.196,0,'mint');
      cyl(scoreWheel,.205,.230,.13,0,1.245,0,'brass',8);
      cyl(scoreWheel,.103,.122,.022,0,1.324,0,'teal');
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
      // Pull-out service shelf stops short of the output jack.
      casework(2.91,.94,-.36,1.67,'teal');
      for(let i=0;i<4;i++)rod(shell,[(i-1.5)*.8,.39,-1.88],[(i-1.5)*.8,.39,-.54],.055,'brass');
      for(const x of [-1,1])rod(shell,[x,.23,.82],[x,.23,1.39],.075,'brass');
    }
    if(id==='delay'){
      casework(2.80,.93,-.66,1.15,'plum');
      for(const x of [-.80,.38])rod(shell,[x,.23,.57],[x,.23,1.04],.070,'steel');
    }
    if(['keys','bell','bin'].includes(id)){
      casework(2.80,1.16,0,1.34,'edge');
      for(const x of [-.46,.46])rod(shell,[x,.23,.57],[x,.23,1.05],.060,'brass');
    }
    function key(key,x,y,z,w,d,round) {
      const pin=scoreWheel&&key.startsWith('pin-');
      const mount=pin?scoreWheel:shell;
      const px=pin?x-.55:x, pz=pin?z-.13:z;
      const pad=round?cyl(mount,w/2,w/2+.008,.078,px,y-.045,pz,'paper',32):
        plate(shell,w,.080,d,x,y-.043,z,'paper',.067);
      if(pin)action(pad,'pin',Number(key.slice(4)));
      caps.set(key,pad);
    }
    function capColor(key,color){
      const cap=caps.get(key);if(cap)cap.material=paint(color);
    }
    return {shell,key,capColor};
  }
  return Object.freeze({create,noteColor,serviceFace,scorePin,CAM,camRadius,createCamDrive,camPose:root=>camPoses.get(root)});
})();
