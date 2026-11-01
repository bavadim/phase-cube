/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* A rhythm partition: four root intervals, at most two binary subdivisions.
 * Each leaf owns exactly one onset. Painting transfers that onset between
 * instruments; it never stacks another copy at the same time. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.XronoTree=factory();})(globalThis,function(){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v)),maxDepth=2,owner=n=>Number.isInteger(n)&&n>=0&&n<6;
  const initial=()=>({roots:[{owner:0},{owner:0},{owner:0},{owner:4}]});
  const fromPattern=starts=>({starts:[...starts],roots:starts.map(()=>({owner:0}))});
  function validate(tree){
    if(!tree||!Array.isArray(tree.roots))throw Error('Неверные корни ритма');
    if(tree.starts){
      if(!Array.isArray(tree.starts)||tree.starts.length!==tree.roots.length||tree.starts.length<2||tree.starts.length>29||tree.starts[0]!==0||tree.starts.some((t,i)=>!Number.isFinite(t)||t<0||t>=1||i&&t<=tree.starts[i-1]))throw Error('Неверные интервалы фигуры');
    }else if(tree.roots.length!==4)throw Error('Неверные корни ритма');
    function visit(n,depth){
      if(!n||typeof n!=='object'||Array.isArray(n))throw Error('Неверный узел ритма');
      if(n.children){
        if(depth>=maxDepth||!Array.isArray(n.children)||n.children.length!==2||Object.hasOwn(n,'owner'))throw Error('Неверное деление интервала');
        n.children.forEach(c=>visit(c,depth+1));
      }else if(!owner(n.owner))throw Error('Неверный инструмент ноты');
    }
    tree.roots.forEach(n=>visit(n,0));return tree;
  }
  function geometry(tree){
    validate(tree);const leaves=[],branches=[];
    function visit(n,key,start,length,depth){
      const item={key,start,length,depth};
      if(n.children){branches.push(item);visit(n.children[0],key+'L',start,length/2,depth+1);visit(n.children[1],key+'R',start+length/2,length/2,depth+1);}
      else leaves.push({...item,owner:n.owner,canSplit:depth<maxDepth});
    }
    const starts=tree.starts||[0,.25,.5,.75];
    tree.roots.forEach((n,i)=>visit(n,String(i),starts[i],(starts[i+1]??1)-starts[i],0));return{leaves,branches};
  }
  function locate(tree,key){
    const match=typeof key==='string'&&/^(0|[1-9]\d?)([LR]{0,2})$/.exec(key);
    if(!match||+match[1]>=tree.roots.length)throw Error('Неверный адрес ветки');
    let parent=tree.roots,index=+match[1],node=parent[index];
    for(const c of match[2]){if(!node.children)throw Error('Ветка уже изменилась');parent=node.children;index=c==='L'?0:1;node=parent[index];}
    return{node,parent,index,depth:match[2].length};
  }
  function apply(tree,action){
    validate(tree);if(!action||!['split','merge','paint'].includes(action.kind))throw Error('Неверное действие с ритмом');
    const out=clone(tree),at=locate(out,action.key),n=at.node;
    if(action.kind==='split'){
      if(n.children||at.depth>=maxDepth||!owner(action.owner))throw Error('Интервал больше не делится');
      at.parent[at.index]={children:[{owner:n.owner},{owner:action.owner}]};
    }else if(action.kind==='merge'){
      if(!n.children)throw Error('У этой ноты нет развилки');
      let first=n;while(first.children)first=first.children[0];at.parent[at.index]={owner:first.owner};
    }else{
      if(n.children||!owner(action.owner))throw Error('Выберите ноту для передачи');
      n.owner=action.owner;
    }
    validate(out);return out;
  }
  return{initial,fromPattern,validate,geometry,apply,maxDepth};
});
