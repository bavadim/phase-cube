/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A finite set of attacks on a cyclic time axis, independently per instrument.
 * Rotation moves the whole set; arc splitting inserts an attack. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.XronoModel=factory();})(globalThis,function(){
  'use strict';
  const TAU=2*Math.PI,EPS=1e-8,maxEvents=128,wrap=x=>((x%1)+1)%1,clone=v=>JSON.parse(JSON.stringify(v));
  const instruments=Object.freeze([
    {id:'kick',label:'Бочка',sound:'xrono_kick',note:60},
    {id:'hat',label:'Хэт',sound:'xrono_hat',note:60},
    {id:'bass',label:'Бас',sound:'triangle',note:48},
    {id:'bell',label:'Колокол',sound:'sine',note:67},
    {id:'clap',label:'Хлопок',sound:'xrono_clap',note:60},
    {id:'click',label:'Щелчок',sound:'xrono_click',note:72}
  ]);
  const part=i=>({instrument:instruments[i].id,note:instruments[i].note,velocity:.7,gateMs:i===2?110:65,enabled:true,phase:0,points:[]});
  const initial=()=>({schema:'rhythm-arcs/1',rpm:30,volume:1,selected:0,parts:instruments.map((_,i)=>part(i))});
  function validate(s){
    const finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b;
    if(s?.schema!=='rhythm-arcs/1'||!finite(s.rpm,8,90)||!finite(s.volume,0,1)||!Array.isArray(s.parts)||s.parts.length<1||s.parts.length>14||!Number.isInteger(s.selected)||s.selected<0||s.selected>=s.parts.length)throw Error('Неверные параметры ритма');
    for(const p of s.parts){
      if(!p||!instruments.some(i=>i.id===p.instrument)||!Number.isInteger(p.note)||!finite(p.note,24,96)||!finite(p.velocity,0,1)||!finite(p.gateMs,20,800)||typeof p.enabled!=='boolean'||!finite(p.phase,0,1)||!Array.isArray(p.points)||p.points.length>maxEvents||p.points.some((t,i)=>!finite(t,0,1-EPS)||i&&t-p.points[i-1]<=EPS)||p.points.length>1&&p.points[0]+1-p.points.at(-1)<=EPS)throw Error('Неверные ноты инструмента');
    }
    return s;
  }
  function arcs(p){
    if(!p.points.length)return[{index:0,start:0,length:1,empty:true}];
    return p.points.map((start,index)=>({index,start,length:(p.points[index+1]??p.points[0]+1)-start,empty:false}));
  }
  function apply(s,index,action){
    validate(s);if(!Number.isInteger(index)||!s.parts[index]||!action)throw Error('Выберите инструмент');
    const out=clone(s),p=out.parts[index];
    if(action.kind==='split'){
      if(p.points.length>=maxEvents)throw Error('Достигнут предел: 128 нот на инструмент');
      const arc=arcs(p)[action.arc];if(!Number.isInteger(action.arc)||!arc)throw Error('Дуга уже изменилась');
      const at=action.at??(arc.empty?0:arc.start+arc.length/2);
      if(!Number.isFinite(at)||!arc.empty&&(at<=arc.start+EPS||at>=arc.start+arc.length-EPS))throw Error('Выберите точку внутри дуги');
      p.points.push(wrap(at));p.points.sort((a,b)=>a-b);
    }else if(action.kind==='merge'){
      if(!Number.isInteger(action.event)||action.event<0||action.event>=p.points.length)throw Error('Нота уже изменилась');
      p.points.splice(action.event,1);
    }else throw Error('Неизвестное действие с дугой');
    return validate(out);
  }
  function rotate(s,index,phase){
    validate(s);if(!Number.isInteger(index)||!s.parts[index]||!Number.isFinite(phase))throw Error('Неверный поворот');
    const out=clone(s);out.parts[index].phase=wrap(phase);return out;
  }
  function project(s){
    validate(s);return s.parts.map((p,id)=>{
      const events=p.points.map((t,index)=>({index,time:wrap(t+p.phase)})).sort((a,b)=>a.time-b.time);
      return{...p,id,events,points:events.map(e=>e.time),label:instruments.find(i=>i.id===p.instrument).label};
    });
  }
  const score=s=>project(s).filter(p=>p.enabled).flatMap(p=>p.events.map(e=>({id:p.id+':'+e.index,part:p.id,start:e.time,gateSeconds:p.gateMs/1000,instrument:p.instrument,note:p.note,velocity:p.velocity})));
  function migrate(input){
    if(input?.schema==='rhythm-arcs/1')return validate(clone(input));
    if(!['xronomorph-lab/1','xronomorph-lab/2'].includes(input?.schema)||!Array.isArray(input.pb)||input.pb.length<1||input.pb.length>8)throw Error('Неизвестное сохранение');
    // Only convert old rotating/dividing figures. The previous storage entry
    // is retained; retired PB/WF operations are not part of the live editor.
    const irregular=[[0,1,7,13,19,20],[0,1,2,12,13,19,20],[0,1,7,11,17,18,24],[0,1,2,8,12,18,19,20],[0,1,7,8,14,18,20,24],[0,1,2,8,12,14,18,20,24]];
    const s=initial();s.rpm=input.rpm;s.volume=input.volume;s.parts=input.pb.map(p=>{
      let points;
      if(p.rhythm){
        const t=p.rhythm,starts=t.starts;if(!Array.isArray(starts)||!Array.isArray(t.roots)||starts.length!==t.roots.length||starts.length>29)throw Error('Неверное старое дерево');
        points=[];const visit=(n,start,length,depth)=>{if(!n||depth>2)throw Error('Неверное старое деление');if(n.children){if(n.children.length!==2)throw Error('Неверное старое деление');visit(n.children[0],start,length/2,depth+1);visit(n.children[1],start+length/2,length/2,depth+1);}else points.push(start);};
        t.roots.forEach((n,i)=>visit(n,starts[i],(starts[i+1]??1)-starts[i],0));
      }else if(/^regular-\d+$/.test(p.shape)){const n=+p.shape.slice(8);if(n<2||n>29)throw Error('Неверная старая фигура');points=Array.from({length:n},(_,i)=>i/n);}
      else{const row=irregular[+String(p.shape).replace('irregular-','')];if(!row)throw Error('Неизвестная старая фигура');points=row.map(n=>n/30);}
      return{instrument:p.instrument,note:p.note,velocity:p.velocity,gateMs:p.gateMs,enabled:p.enabled,phase:wrap(p.phase),points};
    });
    for(let i=0;i<instruments.length;i++)if(!s.parts.some(p=>p.instrument===instruments[i].id))s.parts.push(part(i));
    s.selected=input.mode==='pb'&&Number.isInteger(input.selected)&&input.selected<input.pb.length?input.selected:0;
    return validate(s);
  }
  return{TAU,EPS,maxEvents,wrap,clone,instruments,initial,validate,arcs,apply,rotate,project,score,migrate};
});
