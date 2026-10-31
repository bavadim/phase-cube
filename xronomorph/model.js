/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Independent implementation of Milne et al., NIME 2016, sections 2–3.
 * Angles encode onset times. Shape radii do not encode pitch or loudness.
 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.XronoModel=factory();})(globalThis,function(){
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
  function initial(){return{schema:'xronomorph-lab/1',mode:'pb',rpm:30,volume:1,snap:0,selected:0,
    pb:[layer(0),layer(1,'regular-3',.08),layer(2,'regular-5',.035)],
    wf:{longs:1,shorts:1,ratio:(1+Math.sqrt(5))/2,phase:0,reverse:Array(6).fill(false),layers:Array.from({length:6},(_,i)=>layer(i))}};}
  function validate(s){
    const finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
    const validLayer=p=>p&&shapes.some(x=>x.id===p.shape)&&finite(p.phase,0,1)&&typeof p.enabled==='boolean'&&instruments.some(x=>x.id===p.instrument)&&Number.isInteger(p.note)&&finite(p.note,24,96)&&finite(p.velocity,0,1)&&finite(p.gateMs,20,800)&&typeof p.complement==='boolean';
    if(s?.schema!=='xronomorph-lab/1'||!['pb','wf'].includes(s.mode)||!finite(s.rpm,8,90)||!finite(s.volume,0,1)||![0,12,16,24,30].includes(s.snap)||!Array.isArray(s.pb)||s.pb.length<1||s.pb.length>8||!s.pb.every(validLayer))throw new Error('Неверные параметры лаборатории');
    const w=s.wf;
    if(!w||![w.longs,w.shorts].every(n=>Number.isInteger(n)&&n>=1&&n<=8)||!finite(w.ratio,1,8)||!finite(w.phase,0,1)||!Array.isArray(w.reverse)||w.reverse.length!==6||w.reverse.some(x=>typeof x!=='boolean')||!Array.isArray(w.layers)||w.layers.length!==6||!w.layers.every(validLayer))throw new Error('Неверные параметры иерархии');
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
    if(s.mode==='pb')return s.pb.map((p,i)=>{
      const shape=shapes.find(x=>x.id===p.shape),points=shape.points.map(t=>wrap(t+p.phase)).sort((a,b)=>a-b);
      return{...p,id:i,points,allPoints:points,label:shape.label,balanced:true};
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
    const out=clone(s);if(!Number.isInteger(index)||index<0||index>=(s.mode==='pb'?s.pb.length:6)||!Number.isFinite(phase))throw new Error('Неверный поворот');
    const t=wrap(s.snap?Math.round(phase*s.snap)/s.snap:phase);
    if(s.mode==='pb')out.pb[index].phase=t;else out.wf.phase=t;
    return out;
  }
  function score(s){return project(s).filter(p=>p.enabled).flatMap(p=>p.points.map((t,j)=>({id:p.id+':'+j,part:p.id,start:t,gateSeconds:p.gateMs/1000,instrument:p.instrument,note:p.note,velocity:p.velocity})));}
  return{TAU,EPS,wrap,shapes,instruments,initial,validate,clone,balance,evenness,word,hierarchy,project,rotate,score};
});
