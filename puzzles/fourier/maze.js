/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Physical ports and reachability. No renderer, DOM or musical state encoding. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.FourierMaze=factory();})(globalThis,function(){
  'use strict';
  const radius=.51,liftRange=.50,gains=Object.freeze([0,.5,1,1.5,2]),gainStep=.5,epsilon=1e-7;
  const nodes=Object.freeze([
    {x:-1.35,z:.85,height:.70,in:[-1,0],out:[0,-1]},
    {x:-1.35,z:-.85,height:1.04,in:[0,1],out:[1,0]},
    {x:0,z:-.85,height:1.04,in:[-1,0],out:[0,1]},
    {x:0,z:.85,height:.70,in:[0,-1],out:[1,0]},
    {x:1.35,z:.85,height:.70,in:[-1,0],out:[0,-1]},
    {x:1.35,z:-.85,height:1.04,in:[0,1],out:[1,0]}
  ].map(n=>Object.freeze({...n,in:Object.freeze(n.in),out:Object.freeze(n.out)})));
  const start=Object.freeze({x:-2.40,y:.70,z:.85}),finish=Object.freeze({x:2.40,y:1.04,z:-.85});
  const snapGain=gain=>{if(!Number.isFinite(gain))throw new Error('Неверная высота платформы');return gains[Math.round(Math.max(0,Math.min(2,gain))/gainStep)];};
  const height=(i,gain)=>nodes[i].height+(gain-1)*liftRange;
  function point(i,[x,z],phase=0,gain=1){
    const n=nodes[i],a=phase*Math.PI/4,c=Math.cos(a),s=Math.sin(a);
    // Exactly the same Y rotation as Three.js, independently testable.
    return{x:n.x+x*c+z*s,y:height(i,gain),z:n.z-x*s+z*c};
  }
  const port=(i,side,phase=0,gain=1)=>point(i,nodes[i][side].map(n=>n*radius),phase,gain);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  function passage(i,phase=0,gain=1,reverse=false){
    const n=nodes[i],u=reverse?n.out:n.in,v=reverse?n.in:n.out,result=[point(i,u.map(x=>x*radius),phase,gain),point(i,u.map(x=>x*.18),phase,gain)];
    for(let j=1;j<=8;j++){const t=j/8;result.push(point(i,[0,1].map(k=>.18*((1-t)**2*u[k]+t*t*v[k])),phase,gain));}
    result.push(point(i,v.map(x=>x*radius),phase,gain));return result;
  }
  const fixedLinks=Object.freeze(Array.from({length:7},(_,i)=>Object.freeze({from:i===0?start:port(i-1,'out'),to:i===6?finish:port(i,'in')})));
  function analyze(poses){
    if(poses.length!==nodes.length||poses.some(p=>!Number.isFinite(p.phase)||!Number.isFinite(p.gain)))throw new Error('Неверные положения лабиринта');
    const adjacency=new Map(),edge=(a,b)=>{if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a).add(b);adjacency.get(b).add(a);};
    edge('start','fixed:0:in');edge('fixed:5:out','finish');
    for(let i=0;i<5;i++)edge('fixed:'+i+':out','fixed:'+(i+1)+':in');
    const joints=poses.map((p,i)=>{
      const moving=['in','out'].map(side=>port(i,side,p.phase,p.gain)),fixed=['in','out'].map(side=>port(i,side));
      const errors=fixed.map(f=>moving.map(m=>distance(f,m))),contacts=errors.map(row=>row.findIndex(d=>d<epsilon));
      edge('moving:'+i+':0','moving:'+i+':1');
      contacts.forEach((m,j)=>{if(m>=0)edge('fixed:'+i+':'+(j?'out':'in'),'moving:'+i+':'+m);});
      return{index:i,moving,fixed,errors,contacts,connected:contacts.every(c=>c>=0)};
    });
    const reached=new Set(['start']),queue=['start'];for(let j=0;j<queue.length;j++)for(const v of adjacency.get(queue[j])||[])if(!reached.has(v)){reached.add(v);queue.push(v);}
    const route=[start,port(0,'in')];let blocked=null,completed=0;
    for(let i=0;i<nodes.length;i++){
      const joint=joints[i],pose=poses[i],entry=joint.contacts[0];
      if(entry<0){blocked={index:i,side:'in',point:joint.fixed[0]};break;}
      route.push(...passage(i,pose.phase,pose.gain,entry===1));
      if(joint.contacts[1]!==1-entry){blocked={index:i,side:'out',point:joint.moving[1-entry]};break;}
      completed++;route.push(fixedLinks[i+1].to);
    }
    return{passable:reached.has('finish'),correct:joints.filter(j=>j.connected).length,completed,joints,route,blocked};
  }
  return{nodes,radius,liftRange,gains,gainStep,epsilon,start,finish,height,point,port,passage,fixedLinks,snapGain,analyze};
});
