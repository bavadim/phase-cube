/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Equal-weight attacks on the unit circle. Each construction node has zero
 * resultant; inserting/removing a complete subtree and rotating a whole part
 * preserve that invariant. Pairs/triples are a subset of PB, not all PB rhythms. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.XronoModel=factory();})(globalThis,function(){
  'use strict';
  const TAU=2*Math.PI,EPS=1e-8,BALANCE_EPS=1e-8,maxEvents=128,wrap=x=>((x%1)+1)%1,clone=v=>JSON.parse(JSON.stringify(v));
  const instruments=Object.freeze([
    {id:'kick',label:'Бочка',sound:'xrono_kick',note:60},
    {id:'hat',label:'Хэт',sound:'xrono_hat',note:60},
    {id:'bass',label:'Бас',sound:'triangle',note:48},
    {id:'bell',label:'Колокол',sound:'sine',note:67},
    {id:'clap',label:'Хлопок',sound:'xrono_clap',note:60},
    {id:'click',label:'Щелчок',sound:'xrono_click',note:72}
  ]);
  const part=i=>({instrument:instruments[i].id,note:instruments[i].note,velocity:.7,gateMs:i===2?110:65,enabled:true,phase:0,nextId:1,groups:[]});
  const initial=()=>({schema:'balanced-rhythm/1',rpm:30,volume:1,selected:0,arity:2,migration:null,parts:instruments.map((_,i)=>part(i))});
  const finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
  function balance(points){
    const x=points.reduce((s,t)=>s+Math.cos(TAU*t),0),y=points.reduce((s,t)=>s+Math.sin(TAU*t),0),n=points.length;
    return{x:n?x/n:0,y:n?y/n:0,residual:Math.hypot(x,y),empty:!n};
  }
  const own=n=>n.kind==='fixed'?n.points:Array.from({length:n.order},(_,k)=>wrap(n.at+k/n.order));
  function inspect(p){
    const rows=[];
    const visit=(n,parent,depth)=>{const row={id:n.id,parent,depth,node:n,points:own(n),subtreeIds:[n.id],count:own(n).length};rows.push(row);for(const c of n.children){const sub=visit(c,n.id,depth+1);row.subtreeIds.push(...sub.subtreeIds);row.count+=sub.count;}return row;};
    p.groups.forEach(n=>visit(n,null,0));return rows;
  }
  const events=p=>inspect(p).flatMap(g=>g.points.map((time,k)=>({index:g.id+':'+k,group:g.id,time}))).sort((a,b)=>a.time-b.time);
  function checkPoints(points){
    if(!Array.isArray(points)||points.length>maxEvents||points.some((t,i)=>(!finite(t,0,1)||t===1)||i&&t-points[i-1]<=EPS)||points.length>1&&points[0]+1-points.at(-1)<=EPS)throw Error('Ноты совпадают или выходят за пределы цикла');
  }
  function validate(s){
    if(s?.schema!=='balanced-rhythm/1'||!finite(s.rpm,8,90)||!finite(s.volume,0,1)||![2,3].includes(s.arity)||!Array.isArray(s.parts)||s.parts.length<1||s.parts.length>14||!Number.isInteger(s.selected)||s.selected<0||s.selected>=s.parts.length)throw Error('Неверные параметры ритма');
    for(const p of s.parts){
      if(!p||!instruments.some(i=>i.id===p.instrument)||!Number.isInteger(p.note)||!finite(p.note,24,96)||!finite(p.velocity,0,1)||!finite(p.gateMs,20,800)||typeof p.enabled!=='boolean'||!finite(p.phase,0,1)||!Number.isSafeInteger(p.nextId)||!Array.isArray(p.groups))throw Error('Неверные параметры инструмента');
      const ids=new Set();let total=0;
      const visit=(n,depth)=>{
        if(!n||depth>64||!Number.isSafeInteger(n.id)||n.id<1||ids.has(n.id)||!Array.isArray(n.children))throw Error('Неверное дерево групп');
        ids.add(n.id);
        if(n.kind==='orbit'){if(![2,3].includes(n.order)||(!finite(n.at,0,1)||n.at===1))throw Error('Неверная пара или тройка');}
        else if(n.kind==='fixed'){checkPoints(n.points);if(n.points.length<2)throw Error('Пустая импортированная группа');}
        else throw Error('Неизвестная группа');
        const points=own(n);total+=points.length;if(total>maxEvents)throw Error('Достигнут предел: 128 нот на инструмент');
        if(balance(points).residual>BALANCE_EPS)throw Error('Группа нарушает баланс');
        n.children.forEach(c=>visit(c,depth+1));
      };
      p.groups.forEach(n=>visit(n,0));if(p.nextId<=Math.max(0,...ids))throw Error('Неверный счётчик групп');
      const points=events(p).map(e=>e.time);checkPoints(points);if(balance(points).residual>BALANCE_EPS)throw Error('Инструмент нарушает баланс');
    }
    return s;
  }
  function arcs(p){
    const e=events(p);if(!e.length)return[{index:0,start:0,length:1,empty:true,left:null,right:null}];
    return e.map((a,index)=>({index,start:a.time,length:(e[index+1]?.time??e[0].time+1)-a.time,empty:false,left:a.group,right:e[(index+1)%e.length].group}));
  }
  // Allowed anchor domains are analytic complements of collision intervals.
  // A packet is accepted atomically; coincident notes are never deduplicated.
  function allowed(p,order,clearance=EPS*2){
    if(![2,3].includes(order)||events(p).length+order>maxEvents)return[];
    let ranges=[[0,1]];
    for(const e of events(p))for(let k=0;k<order;k++){
      const t=wrap(e.time-k/order);
      for(const shift of [-1,0,1]){const a=t+shift-clearance,b=t+shift+clearance;ranges=ranges.flatMap(([l,r])=>b<=l||a>=r?[[l,r]]:[[l,Math.max(l,a)],[Math.min(r,b),r]].filter(([x,y])=>y-x>EPS*2));}
    }
    return ranges;
  }
  function splitOptions(p,order,arc,domains=allowed(p,order)){
    const l=arc.empty?0:arc.start+EPS*2,r=arc.empty?1:arc.start+arc.length-EPS*2;
    const ranges=domains.flatMap(([a,b])=>[0,1].map(k=>[Math.max(l,a+k),Math.min(r,b+k)])).filter(([a,b])=>b-a>EPS*2);
    const middle=arc.empty?0:arc.start+arc.length/2;
    if(ranges.some(([a,b])=>middle>=a&&middle<=b))return{at:middle,ranges};
    const best=ranges.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))[0];return{at:best?(best[0]+best[1])/2:null,ranges};
  }
  function preview(s,index,arcIndex,at,order=s.arity){
    const p=s.parts[index],arc=p&&arcs(p)[arcIndex];
    const no=reason=>({valid:false,reason,points:Number.isFinite(at)&&[2,3].includes(order)?Array.from({length:order},(_,k)=>wrap(at+k/order)):[],at,order,affected:[]});
    if(!arc||!Number.isInteger(arcIndex))return no('Дуга уже изменилась');
    if(![2,3].includes(order))return no('Выберите пару или тройку');
    if(events(p).length+order>maxEvents)return no('Достигнут предел: 128 нот');
    if(at==null)at=splitOptions(p,order,arc).at;
    if(!Number.isFinite(at)||!arc.empty&&(at<=arc.start+EPS||at>=arc.start+arc.length-EPS))return no('Перемещайте точку внутри выбранной дуги');
    const points=Array.from({length:order},(_,k)=>wrap(at+k/order)),old=events(p);
    if(points.some(t=>old.some(e=>Math.abs(wrap(t-e.time+.5)-.5)<=EPS)))return no('Одна из связанных нот совпадает с существующей');
    const affected=arcs(p).filter(a=>a.empty||points.some(t=>{const d=wrap(t-a.start);return d>EPS&&d<a.length-EPS;})).map(a=>a.index);
    return{valid:true,reason:'',points,at,order,affected};
  }
  function parentFor(p,arc){
    const map=new Map(inspect(p).map(g=>[g.id,g.parent]));let a=arc.left,b=arc.right;const ancestors=new Set();
    while(a!=null){ancestors.add(a);a=map.get(a);}while(b!=null){if(ancestors.has(b))return b;b=map.get(b);}return null;
  }
  function apply(s,index,action){
    validate(s);if(!Number.isInteger(index)||!s.parts[index]||!action)throw Error('Выберите инструмент');
    const out=clone(s),p=out.parts[index];
    if(action.kind==='split'){
      const v=preview(s,index,action.arc,action.at,action.order??s.arity);if(!v.valid)throw Error(v.reason);
      const parent=parentFor(p,arcs(p)[action.arc]),node={id:p.nextId++,kind:'orbit',order:v.order,at:wrap(v.at),children:[]};
      (parent==null?p.groups:inspect(p).find(g=>g.id===parent).node.children).push(node);
    }else if(action.kind==='merge'){
      if(!Number.isInteger(action.group)||!inspect(p).some(g=>g.id===action.group))throw Error('Выберите целую группу');
      const prune=list=>list.filter(n=>n.id!==action.group).map(n=>({...n,children:prune(n.children)}));p.groups=prune(p.groups);
    }else throw Error('Неизвестное действие');
    return validate(out);
  }
  function rotate(s,index,phase){
    validate(s);if(!Number.isInteger(index)||!s.parts[index]||!Number.isFinite(phase))throw Error('Неверный поворот');
    const out=clone(s);out.parts[index].phase=wrap(phase);return validate(out);
  }
  function project(s){
    validate(s);return s.parts.map((p,id)=>{
      const e=events(p).map(a=>({...a,time:wrap(a.time+p.phase)})).sort((a,b)=>a.time-b.time),points=e.map(a=>a.time);
      return{...p,id,events:e,points,balance:balance(points),label:instruments.find(i=>i.id===p.instrument).label};
    });
  }
  const score=s=>project(s).filter(p=>p.enabled).flatMap(p=>p.events.map(e=>({id:p.id+':'+e.index,part:p.id,start:e.time,gateSeconds:p.gateMs/1000,instrument:p.instrument,note:p.note,velocity:p.velocity})));
  function migrate(input){
    if(input?.schema==='balanced-rhythm/1')return validate(clone(input));
    let old;
    if(input?.schema==='rhythm-arcs/1')old=clone(input);
    else if(['xronomorph-lab/1','xronomorph-lab/2'].includes(input?.schema)&&Array.isArray(input.pb)&&input.pb.length>=1&&input.pb.length<=8){
      const irregular=[[0,1,7,13,19,20],[0,1,2,12,13,19,20],[0,1,7,11,17,18,24],[0,1,2,8,12,18,19,20],[0,1,7,8,14,18,20,24],[0,1,2,8,12,14,18,20,24]];
      old={...input,parts:input.pb.map(p=>{
        let points;
        if(p.rhythm){
          const t=p.rhythm;if(!Array.isArray(t.starts)||!Array.isArray(t.roots)||t.starts.length!==t.roots.length||t.starts.length>29)throw Error('Неверное старое дерево');
          points=[];const visit=(n,start,length,depth)=>{if(!n||depth>2)throw Error('Неверное старое деление');if(n.children){if(n.children.length!==2)throw Error('Неверное старое деление');visit(n.children[0],start,length/2,depth+1);visit(n.children[1],start+length/2,length/2,depth+1);}else points.push(start);};
          t.roots.forEach((n,i)=>visit(n,t.starts[i],(t.starts[i+1]??1)-t.starts[i],0));
        }else if(/^regular-\d+$/.test(p.shape)){const n=+p.shape.slice(8);if(n<2||n>29)throw Error('Неверная старая фигура');points=Array.from({length:n},(_,i)=>i/n);}
        else{const row=irregular[+String(p.shape).replace('irregular-','')];if(!row)throw Error('Неизвестная старая фигура');points=row.map(n=>n/30);}
        return{...p,points};
      }),selected:input.mode==='pb'?input.selected:0};
    }else throw Error('Неизвестное сохранение');
    if(!Array.isArray(old.parts)||old.parts.length<1||old.parts.length>14)throw Error('Неверное сохранение');
    const s=initial(),skipped=[];s.rpm=old.rpm;s.volume=old.volume;
    s.parts=old.parts.map((p,index)=>{
      checkPoints(p.points);const keep=balance(p.points).residual<=BALANCE_EPS;
      if(!keep)skipped.push({index,instrument:p.instrument,count:p.points.length});
      return{instrument:p.instrument,note:p.note,velocity:p.velocity,gateMs:p.gateMs,enabled:p.enabled,phase:wrap(p.phase),nextId:keep&&p.points.length?2:1,groups:keep&&p.points.length?[{id:1,kind:'fixed',points:p.points.slice(),children:[]}]:[]};
    });
    for(let i=0;i<instruments.length;i++)if(!s.parts.some(p=>p.instrument===instruments[i].id))s.parts.push(part(i));
    s.selected=Number.isInteger(old.selected)&&old.selected>=0&&old.selected<old.parts.length?old.selected:0;
    s.migration={sourceSchema:input.schema,skipped};return validate(s);
  }
  return{TAU,EPS,BALANCE_EPS,maxEvents,wrap,clone,instruments,initial,validate,balance,inspect,events,arcs,allowed,splitOptions,preview,apply,rotate,project,score,migrate};
});
