/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PuzzleContract=factory();})(globalThis,function(){
  'use strict';
  const key=state=>JSON.stringify(state);
  function inspect(puzzle){
    const spec=puzzle.manifest,model=puzzle.create();
    if(spec?.schema!=='music-puzzle/1'||!Number.isInteger(spec.version)||spec.version<1)throw new Error('Неподдерживаемый контракт головоломки');
    if(spec.id!==puzzle.id)throw new Error('id манифеста не совпадает с модулем головоломки');
    for(const field of ['pieceIds','poseIds'])if(!Array.isArray(spec[field])||!spec[field].length||new Set(spec[field]).size!==spec[field].length)throw new Error('Неверный домен '+field);
    if(spec.pieceIds.some(id=>!Number.isInteger(id))||spec.pieceIds.some((id,i)=>id!==i))throw new Error('Деталям нужны последовательные числовые id');
    if(spec.pieceIds.length!==model.count)throw new Error('Число деталей не совпадает с манифестом');
    if(spec.poseIds.some(id=>!['number','string'].includes(typeof id)))throw new Error('Положениям нужны строковые или числовые id');
    if(!['single-reference','all-solved-to-reference'].includes(spec.goalPolicy))throw new Error('Не задана политика музыкальной цели');
    for(const name of ['initialState','legalMoves','applyTo','inverse','placements','solved'])if(typeof model[name]!=='function')throw new Error('Отсутствует метод головоломки: '+name);
    const initial=model.initialState();
    if(!model.solved(initial))throw new Error('Исходная цель не собрана');
    project({manifest:spec,model},initial);
    return {manifest:spec,model};
  }
  function project(puzzle,state){
    const {manifest:spec,model}=puzzle;
    // This is an explicit terminal-goal policy, not a change of frame on every move.
    const canonical=spec.goalPolicy==='all-solved-to-reference'&&model.solved(state)?model.initialState():state;
    const result=model.placements(canonical),ids=new Set();
    if(result.length!==spec.pieceIds.length)throw new Error('Неверное число положений деталей');
    for(const p of result){
      if(!spec.pieceIds.includes(p.pieceId)||ids.has(p.pieceId)||!spec.poseIds.includes(p.poseId))throw new Error('Положение вне контракта головоломки');
      ids.add(p.pieceId);
    }
    return [...result].sort((a,b)=>a.pieceId-b.pieceId);
  }
  function probes(puzzle,{stateLimit=192,edgeLimit=384,seed=1730}={}){
    const {model}=puzzle,states=new Map(),edges=new Map();
    const add=s=>{const k=key(s);if(!states.has(k))states.set(k,s);return k;};
    const edge=(state,move)=>{const next=model.applyTo(state,move),a=add(state),b=add(next),k=[a,b].sort().join('|');if(key(model.applyTo(next,model.inverse(move)))!==a)throw new Error('Обратный ход не восстанавливает состояние');if(!edges.has(k))edges.set(k,{before:a,after:b});return next;};
    const exact=typeof model.allStates==='function';
    if(exact){
      for(const state of model.allStates())add(state);
      const expected=states.size;
      for(const state of [...states.values()])for(const move of model.legalMoves(state))edge(state,move);
      if(states.size!==expected)throw new Error('Заявленный полный граф не замкнут');
    }else{
      let x=seed>>>0;
      const random=n=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x%n;};
      const goals=model.goalStates?.()||[model.initialState()];
      // Include transitions from every accepted target, including rotated cubes.
      for(const state of goals){add(state);for(const move of model.legalMoves(state))edge(state,move);}
      let state=model.initialState();
      for(let i=0;i<stateLimit&&edges.size<edgeLimit;i++){
        const moves=model.legalMoves(state);state=edge(state,moves[random(moves.length)]);
        if(i%12===11)state=model.initialState();
      }
    }
    const entries=[...states].map(([id,state])=>({id,state,placements:project(puzzle,state),solved:model.solved(state)}));
    return {states:entries,edges:[...edges.values()],coverage:exact?'complete':'sampled'};
  }
  return {inspect,project,probes};
});
