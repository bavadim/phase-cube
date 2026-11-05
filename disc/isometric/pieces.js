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
  function source(root) {
    mounting(root,3.22,2.08,'teal');
    // A separate milk-glass throat under each flared enamel hopper reveals
    // its supply of C, E or G. The reader points at the approaching pin.
    const pitchers = window.IsoFlow.PALETTE.filter(p => p !== null).map((pitch,i) => {
      const p = group(root,-1.13 + .72*i, .37,-.71);
      cyl(p,.17,.20,.14,0,.07,0,'edge');
      cyl(p,.104,.104,.23,0,.23,0,'paper');
      rod(p,[0,.088,.01],[0,.050,.253],.067,'steel');
      lathe(p,[[.095,0],[.11,0],[.12,.12],[.31,.40],[.32,.45],[.285,.45],[.085,.13],[.067,.06]],
        0,.30,0,noteColor(pitch));
      bead(p,.303,.024,0,.75,0,'ivory');
      const note = ball(p,.115,0,.67,0,noteColor(pitch));
      return {body:p,note,pitch};
    });
    rod(root,[-1.13,.418,-.46],[1.41,.418,-.46],.071,'teal');
    rod(root,[1.41,.418,-.46],[1.41,.396,.16],.071,'teal');
    rod(root,[1.41,.396,.16],[1.65,.340,.16],.075,'brass');
    ball(root,.075,1.41,.418,-.46,'teal');
    ball(root,.075,1.41,.396,.16,'teal');
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
      ports:{out:vec(1.79,.29,.16)},
      update(f) {
        const {phase,level,notes}=f.state.source, turn=(f.tick.tick+f.progress)*TAU/8;
        rim.rotation.y=turn;
        // At contact, crest of the driven gear faces the gap in the driver.
        smallRim.rotation.y=-turn*big/small;
        sleeve.rotation.y=turn-phase*TAU/8;
        handle.position.y=.045+.145*level;
        notes.forEach((pitch,i)=>{
          const cap=pins[i], rest=pitch===null;
          cap.scale.setScalar(rest?.50:1); cap.position.y=rest?.010:.066;
          cap.material=paint(rest?'steel':noteColor(pitch));
        });
        const e=f.tick.activity.source[0], pulse=hit(f,'source');
        pitchers.forEach(({body,note,pitch})=>{
          // The feed bowls retract below the raised programming rim.
          body.scale.y=f.selected==='source'?.47:1;
          note.position.y=.68+(e?.pitch===pitch?pulse*.09:0);
        });
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
    return {
      ports:{in:vec(-1.06,.29,0),out:vec(1.08,.29,0),copy:vec(.36,.29,1.00)},
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
    return {
      ports:{in:vec(-1.2,.29,0),out:vec(1.2,.29,0)},
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

  function router(root) {
    mounting(root,2.31,1.81,'edge');
    const pivotX=-.40, pivotZ=-.21;
    const colors={straight:'#247e77',side:'#c46437'};
    // A recessed track has raised cast lips. Its ends meet the belt sockets.
    // Shape coordinates below are in the same top-down X,Z plane as the belts.
    function track(points, tone, name) {
      const curve=new T.CatmullRomCurve3(points.map(([x,z])=>vec(x,0,z)));
      const spine=curve.getSpacedPoints(22);
      const normals=spine.map((p,i)=>{
        const previous=spine[Math.max(0,i-1)], next=spine[Math.min(spine.length-1,i+1)];
        return vec(previous.z-next.z,0,next.x-previous.x).normalize();
      });
      function strip(left,right,base,height,pigment) {
        const shape=new T.Shape();
        function add(p,index,offset,first) {
          const x=p.x+offset*normals[index].x,z=p.z+offset*normals[index].z;
          if(first) shape.moveTo(x,-z); else shape.lineTo(x,-z);
        }
        spine.forEach((p,i)=>add(p,i,left,i===0));
        for(let i=spine.length-1;i>=0;i--) add(spine[i],i,right,false);
        shape.closePath();
        return mesh(root,geometry('turnout-'+name+'-'+left+'-'+right,()=>extrude(shape,height,.006)),pigment,0,base,0);
      }
      strip(-.187,.187,.355,.039,'edge');
      strip(-.212,-.166,.375,.067,tone);
      strip(.166,.212,.375,.067,tone);
    }
    track([[-1.33,.4],[-1.14,.4],[-.92,.29],[-.70,-.01],[pivotX,pivotZ]],'steel','in');
    track([[.20,pivotZ],[.52,pivotZ],[.75,-.11],[1.09,.32],[1.34,.4]],colors.straight,'straight');
    track([[-.09,.29],[.04,.51],[.12,.73],[.13,1.10]],colors.side,'side');
    cyl(root,.47,.50,.06,pivotX,.407,pivotZ,'ink');

    // One pivoting bridge carries a broad white arrow. The bridge points at
    // the physical chute that will accept a box arriving in this eighth.
    const switchRail=action(group(root,pivotX,.437,pivotZ),'lever');
    const bed=plate(switchRail,1.08,.13,.49,.39,.069,0,colors.straight,.13);
    const arrowShape=new T.Shape();
    arrowShape.moveTo(.05,-.078);
    arrowShape.lineTo(.46,-.078); arrowShape.lineTo(.46,-.185);
    arrowShape.lineTo(.80,0); arrowShape.lineTo(.46,.185);
    arrowShape.lineTo(.46,.078); arrowShape.lineTo(.05,.078); arrowShape.closePath();
    mesh(switchRail,geometry('turnout-arrow',()=>extrude(arrowShape,.016,.003)),'paper',0,.140,0);
    cyl(root,.092,.122,.11,pivotX,.588,pivotZ,'brass',24);

    return {
      ports:{in:vec(-1.33,.29,.4),straight:vec(1.34,.29,.4),side:vec(.13,.29,1.10)},
      update(frame) {
        const straight=frame.previewRoute ?? frame.tick.straight;
        switchRail.rotation.y=straight?0:-Math.atan2(.50,.31);
        bed.material=paint(straight?colors.straight:colors.side);
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
    return {ports:{in:vec(-1.16,.29,.02)},update(f) {
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
    return {ports:{in:vec(-.97,.29,0)},update(f) {
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
    return {ports:{in:vec(-.93,.29,0)},update(f) {
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
    return {group:assembly,ports:result.ports,update:result.update};
  }
  // The service faces are attached to the casting when the camera opens a
  // machine. Geometry and its accessible printed legends share local axes.
  function serviceFace(id,parent) {
    const shell=group(parent), caps=new Map();
    shell.name=id+'-service';shell.visible=false;
    function casework(w,d,x,z,tone) {
      plate(shell,w,.19,d,x,.23,z,'edge',.13);
      plate(shell,w-.04,.10,d-.05,x,.37,z,tone,.11);
      for(const dx of [-1,1])for(const dz of [-1,1]) {
        cyl(shell,.025,.032,.016,x+dx*(w/2-.085),.43,z+dz*(d/2-.085),'brass',8);
      }
    }
    if(id==='router') {
      casework(3.09,1.78,0,-1.84,'teal');
      for(const x of [-.81,.81])cyl(shell,.11,.11,.39,x,.285,-.95,'brass').rotation.z=Math.PI/2;
    }
    if(id==='source'){
      const ring=new T.Shape();ring.absarc(.55,-.13,1.11,0,TAU,false);
      const opening=new T.Path();opening.absarc(.55,-.13,.74,0,TAU,true);ring.holes.push(opening);
      mesh(shell,geometry('service-score-ring',()=>extrude(ring,.085,.015)),'edge',0,1.095,0);
      for(const x of [-.36,1.44])rod(shell,[x,.35,.09],[x,1.135,.09],.064,'brass');
      rod(shell,[1.68,.30,.19],[1.68,.31,.78],.040,'brass');
      plate(shell,.56,.073,.19,1.55,.33,.78,'brass',.04);
      casework(3.24,.94,0,1.67,'teal');
      for(const x of [-1,1])rod(shell,[x,.23,.82],[x,.23,1.39],.075,'brass');
    }
    if(id==='delay'){
      casework(2.96,.93,0,1.15,'plum');
      for(const x of [-.74,.74])rod(shell,[x,.23,.57],[x,.23,1.04],.070,'steel');
    }
    if(['keys','bell','bin'].includes(id)){
      casework(2.80,1.16,0,1.34,'edge');
      for(const x of [-.46,.46])rod(shell,[x,.23,.57],[x,.23,1.05],.060,'brass');
    }
    function key(key,x,y,z,w,d,round) {
      const pad=round?cyl(shell,w/2,w/2+.008,.078,x,y-.045,z,'paper',32):
        plate(shell,w,.080,d,x,y-.043,z,'paper',.067);
      caps.set(key,pad);
    }
    function capColor(key,color){
      const cap=caps.get(key);if(cap)cap.material=paint(color);
    }
    return {shell,key,capColor};
  }
  return Object.freeze({create,noteColor,serviceFace});
})();
