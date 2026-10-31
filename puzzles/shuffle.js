/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Seeded single-move selection. Puzzle models still own state and move rules. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PuzzleShuffle=factory();})(globalThis,function(){
  'use strict';
  class Generator{
    constructor(seed=1730){this.seed=seed>>>0;this.last=null;this.seen=new Set();}
    next(model,{moves=model.legalMoves(model.snapshot())}={}){
      const state=model.snapshot();this.seen.add(JSON.stringify(state));
      let candidates=moves.map(move=>({move,state:model.applyTo(state,move)})).filter(e=>!model.solved(e.state));
      if(!candidates.length)throw new Error('Нет хода для перемешивания головоломки');
      // Finite models know their exact distance; keep the short introduction
      // moving away from the goal. Beyond their diameter, prefer new states.
      const outward=typeof model.distance==='function'?candidates.filter(e=>model.distance(e.state)>model.distance(state)):[];
      const fresh=candidates.filter(e=>!this.seen.has(JSON.stringify(e.state)));
      candidates=outward.length?outward:fresh.length?fresh:candidates;
      const other=candidates.filter(e=>model.moveTarget(e.move)!==this.last);
      if(other.length)candidates=other;
      this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;
      const chosen=candidates[Math.floor(this.seed/4294967296*candidates.length)];
      this.last=model.moveTarget(chosen.move);this.seen.add(JSON.stringify(chosen.state));
      return chosen.move;
    }
  }
  return {Generator};
});
