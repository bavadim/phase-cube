/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Independent implementation of Milne et al., NIME 2016, sections 2–3.
 * Angles encode onset times. Shape radii do not encode pitch or loudness.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./tree.js'));else root.XronoModel=factory(root.XronoTree);})(globalThis,function(Tree){
  'use strict';
  const TAU=2*Math.PI,EPS=1e-9,wrap=x=>((x%1)+1)%1;
  const regular=[2,3,4,5,6,7,8,9,10,11,12,13,17,19,23,29];
  // All six rotation classes of primitive minimal binary PB patterns in Z/30.
  // Independently enumerated with exact remainders modulo cyclotomic Phi_30;
  // see verify-irregular.py. Reflections remain separate rotation classes.
  const irregular=[
    [0,1,7,13,19,20],[0,1,2,12,13,19,20],[0,1,7,11,17,18,24],
    [0,1,2,8,12,18,19,20],[0,1,7,8,14,18,20,24],[0,1,2,8,12,14,18,20,24]
  ];
  const shapes=Object.freeze([
    ...regular.map(n=>Object.freeze({id:'regular-'+n,label:n+' равных долей',points:Object.freeze(Array.from({length:n},(_,i)=>i/n)),kind:'regular'})),
    ...irregular.map((a,i)=>Object.freeze({id:'irregular-'+i,label:'Неправильная '+(i+1)+' · '+a.length+' точек',points:Object.freeze(a.map(n=>n/30)),kind:'irregular'}))
  ]);
  const instruments=Object.freeze([
    {id:'kick',label:'Бочка',sound:'xrono_kick',note:60},
    {id:'hat',label:'Хэт',sound:'xrono_hat',note:60},
    {id:'bass',label:'Бас',sound:'triangle',note:48},
    {id:'bell',label:'Колокол',sound:'sine',note:67},
    {id:'clap',label:'Хлопок',sound:'xrono_clap',note:60},
    {id:'click',label:'Щелчок',sound:'xrono_click',note:72}
  ]);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const layer=(i,shape='regular-4',phase=0)=>({shape,phase,enabled:i<3,instrument:instruments[i%6].id,note:instruments[i%6].note,velocity:.7,gateMs:i===2?110:65,complement:false});
  const initialTree=()=>({...Tree.initial(),layers:Array.from({length:6},(_,i)=>({...layer(i),enabled:true}))});
  function initial(){return{schema:'xronomorph-lab/2',mode:'pb',rpm:30,volume:1,snap:0,selected:0,
    pb:[layer(0),layer(1,'regular-3',.08),layer(2,'regular-5',.035)],
    wf:{longs:1,shorts:1,ratio:(1+Math.sqrt(5))/2,phase:0,reverse:Array(6).fill(false),layers:Array.from({length:6},(_,i)=>layer(i))},tree:initialTree()};}
  function migrate(input){const s=clone(input);if(s?.schema==='xronomorph-lab/1'){s.schema='xronomorph-lab/2';s.tree=initialTree();}return validate(s);}
  function validate(s){
    const finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
    const validLayer=p=>{
      const shape=p&&shapes.find(x=>x.id===p.shape);
      if(!shape||!finite(p.phase,0,1)||typeof p.enabled!=='boolean'||!instruments.some(x=>x.id===p.instrument)||!Number.isInteger(p.note)||!finite(p.note,24,96)||!finite(p.velocity,0,1)||!finite(p.gateMs,20,800)||typeof p.complement!=='boolean')return false;
      if(p.rhythm){Tree.validate(p.rhythm);if(JSON.stringify(p.rhythm.starts)!==JSON.stringify(shape.points))return false;}
      return true;
    };
    if(s?.schema!=='xronomorph-lab/2'||!['pb','wf','tree'].includes(s.mode)||!finite(s.rpm,8,90)||!finite(s.volume,0,1)||![0,12,16,24,30].includes(s.snap)||!Array.isArray(s.pb)||s.pb.length<1||s.pb.length>8||!s.pb.every(validLayer))throw new Error('Неверные параметры лаборатории');
    const w=s.wf;
    if(!w||![w.longs,w.shorts].every(n=>Number.isInteger(n)&&n>=1&&n<=8)||!finite(w.ratio,1,8)||!finite(w.phase,0,1)||!Array.isArray(w.reverse)||w.reverse.length!==6||w.reverse.some(x=>typeof x!=='boolean')||!Array.isArray(w.layers)||w.layers.length!==6||!w.layers.every(validLayer))throw new Error('Неверные параметры иерархии');
    Tree.validate(s.tree);if(s.tree.starts)throw new Error('У дерева ритма четыре фиксированных интервала');
    if(!Array.isArray(s.tree.layers)||s.tree.layers.length!==6||!s.tree.layers.every(validLayer))throw new Error('Неверные инструменты дерева ритма');
    if(!Number.isInteger(s.selected)||s.selected<0||s.selected>=(s.mode==='pb'?s.pb.length:6))throw new Error('Неверный выбранный слой');
    return s;
  }
  function balance(points){if(!points.length)return null;return 1-Math.hypot(points.reduce((s,t)=>s+Math.cos(TAU*t),0),points.reduce((s,t)=>s+Math.sin(TAU*t),0))/points.length;}
  function evenness(points){if(!points.length)return null;return Math.hypot(points.reduce((s,t,i)=>s+Math.cos(TAU*(t-i/points.length)),0),points.reduce((s,t,i)=>s+Math.sin(TAU*(t-i/points.length)),0))/points.length;}
  function unique(points){const out=points.map(wrap).sort((a,b)=>a-b).filter((t,i,a)=>!i||t-a[i-1]>EPS);if(out.length>1&&out[0]+1-out.at(-1)<EPS)out.pop();return out;}
  function word(longs,shorts){
    const total=longs+shorts,letters=Array.from({length:total},(_,i)=>Math.floor((i+1)*longs/total)-Math.floor(i*longs/total)?'L':'s');
    const first=letters.indexOf('L');return letters.slice(first).concat(letters.slice(0,first));
  }
  // A base boundary is (a*r+b)/(longs*r+shorts). Inverting this
  // expression keeps the grabbed point under the pointer, without rotation,
  // snapping, numeric search or following unstable higher-level vertex ids.
  function wfBoundaries(w){
    const letters=word(w.longs,w.shorts);if(w.reverse[0])letters.reverse();
    let a=0,b=0;
    return letters.map((letter,index)=>{
      const at=r=>(a*r+b)/(w.longs*r+w.shorts),time=at(w.ratio),ends=[at(1),at(8)];
      const boundary={index,letter,a,b,time,movable:a*w.shorts!==b*w.longs,min:Math.min(...ends),max:Math.max(...ends)};
      if(letter==='L')a++;else b++;return boundary;
    });
  }
  function ratioAtBoundary(w,index,time){
    const h=wfBoundaries(w)[index];
    if(!h?.movable||!Number.isFinite(time))throw Error('Эта граница интервалов неподвижна');
    const t=Math.max(h.min,Math.min(h.max,time)),r=(h.b-t*w.shorts)/(t*w.longs-h.a);
    return Math.max(1,Math.min(8,r));
  }
  function patternGeometry(p){return Tree.geometry(p.rhythm||Tree.fromPattern(shapes.find(x=>x.id===p.shape).points));}
  function divide(s,index,action){
    if(s.mode!=='pb'||!s.pb[index]||!['split','merge'].includes(action?.kind))throw Error('Выберите фигуру для деления');
    const out=clone(s),p=out.pb[index];p.rhythm=Tree.apply(p.rhythm||Tree.fromPattern(shapes.find(x=>x.id===p.shape).points),{...action,owner:0});
    if(!p.rhythm.roots.some(n=>n.children))delete p.rhythm;
    return validate(out);
  }
  function hierarchy(w){
    let letters=word(w.longs,w.shorts);if(w.reverse[0])letters.reverse();
    const total=w.longs*w.ratio+w.shorts;
    let intervals=letters.map(c=>(c==='L'?w.ratio:1)/total);
    const levels=[];
    for(let level=0;level<6;level++){
      const max=Math.max(...intervals),min=Math.min(...intervals),split=max-min>EPS;
      let t=0;const points=unique(intervals.map(length=>{const at=t;t+=length;return at;}));
      levels.push({points,intervals:intervals.slice(),split,ratio:split?max/min:1});
      if(!split)continue;
      // NIME morphisms: r>=2: L -> Ls, s -> s;
      // 1<r<2: L -> Ls, s -> L, with new L/s lengths relabelled.
      const first=Math.max(min,max-min),second=Math.min(min,max-min),reverse=w.reverse[level+1]||false;
      intervals=intervals.flatMap(length=>Math.abs(length-max)<EPS?(reverse?[second,first]:[first,second]):[length]);
    }
    return levels;
  }
  function project(s){
    validate(s);
    if(s.mode==='tree'){
      const {leaves}=Tree.geometry(s.tree);
      return s.tree.layers.map((p,id)=>{const points=leaves.filter(n=>n.owner===id).map(n=>n.start);return{...p,id,points,allPoints:points,label:instruments.find(v=>v.id===p.instrument).label};});
    }
    if(s.mode==='pb')return s.pb.map((p,i)=>{
      const shape=shapes.find(x=>x.id===p.shape),points=patternGeometry(p).leaves.map(n=>wrap(n.start+p.phase)).sort((a,b)=>a-b);
      return{...p,id:i,points,allPoints:points,label:shape.label,balanced:Math.abs(balance(points)-1)<EPS};
    });
    const levels=hierarchy(s.wf);
    return levels.map((v,i)=>{
      // Subtraction refers to the mathematical lower levels, whether muted or not.
      const lower=i?levels[i-1].points:[],raw=v.points;
      const points=(s.wf.layers[i].complement&&i?raw.filter(t=>lower.every(a=>Math.abs(t-a)>EPS)):raw).map(t=>wrap(t+s.wf.phase)).sort((a,b)=>a-b);
      return{...s.wf.layers[i],id:i,points,allPoints:raw.map(t=>wrap(t+s.wf.phase)).sort((a,b)=>a-b),label:'Уровень '+(i+1),ratio:v.ratio,split:v.split,canReverse:i===0||levels[i-1].split};
    });
  }
  function rotate(s,index,phase){
    if(s.mode==='tree')throw Error('В этом режиме редактируются деления и инструменты нот');
    const out=clone(s);if(!Number.isInteger(index)||index<0||index>=(s.mode==='pb'?s.pb.length:6)||!Number.isFinite(phase))throw new Error('Неверный поворот');
    const t=wrap(s.snap?Math.round(phase*s.snap)/s.snap:phase);
    if(s.mode==='pb')out.pb[index].phase=t;else out.wf.phase=t;
    return out;
  }
  function score(s){return project(s).filter(p=>p.enabled).flatMap(p=>p.points.map((t,j)=>({id:p.id+':'+j,part:p.id,start:t,gateSeconds:p.gateMs/1000,instrument:p.instrument,note:p.note,velocity:p.velocity})));}
  return{TAU,EPS,wrap,shapes,instruments,initial,initialTree,migrate,validate,clone,balance,evenness,word,wfBoundaries,ratioAtBoundary,hierarchy,patternGeometry,divide,project,rotate,score};
});
