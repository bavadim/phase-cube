/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Shared native Strudel playback; musical projections are separate strategies. */
window.PuzzleMusic=(()=>{
  const eventKey=rows=>JSON.stringify(rows);
  class Music{
    constructor(S,prepared){Object.assign(this,{S,prepared,model:prepared.model,game:prepared.fragments,song:prepared.composition,puzzle:prepared.puzzle,binding:prepared.binding});this.basePatterns=this.game.basePatterns;this.localBars=this.game.periodBars;this.cache=new Map();this.displayCache=new WeakMap();}
    project(state){
      const key=JSON.stringify(state);if(this.cache.has(key))return this.cache.get(key);
      const result=PuzzleProjection.project(this.S,this.prepared,state);this.cache.set(key,result);
      if(this.cache.size>16)this.cache.delete(this.cache.keys().next().value);return result;
    }
    // Legacy name retained for callers: Fourier descriptors intentionally have no ticks/offset.
    phases(state){return this.project(state).parts;}
    shifted(state){return this.project(state).patterns;}
    rows(state){return this.project(state).rows;}
    predict(move,state,currentRows=this.rows(state)){
      const next=this.model.applyTo(state,move),phases=this.phases(next),rows=this.rows(next);
      return{move,phases,rows,changed:rows.map((row,i)=>eventKey(row)!==eventKey(currentRows[i])?i:-1).filter(i=>i>=0)};
    }
    preview(point,state,currentRows=this.rows(state),move=null){
      const result=PuzzleProjection.preview(this.prepared,state,point);
      return{point,move,continuous:true,phases:result.parts,rows:result.rows,changed:result.rows.map((row,i)=>eventKey(row)!==eventKey(currentRows[i])?i:-1).filter(i=>i>=0)};
    }
    displayWindow(cycle=0){return this.game.loopBars?Math.floor(((cycle%this.game.periodBars)+this.game.periodBars)%this.game.periodBars/this.game.loopBars):0;}
    displayRows(rows,cycle=0){
      if(!this.game.loopBars)return rows;
      const window=this.displayWindow(cycle),windows=this.game.periodBars/this.game.loopBars;
      let cached=this.displayCache.get(rows);if(!cached){cached=new Map();this.displayCache.set(rows,cached);}
      if(!cached.has(window))cached.set(window,rows.map(row=>row.filter(e=>e.start*windows>=window-1e-9&&e.start*windows<window+1-1e-9).map(e=>({...e,start:e.start*windows-window,duration:e.duration*windows}))));
      return cached.get(window);
    }
    pattern(state){return this.S.stack(...this.shifted(state));}
    code(state){return '// '+this.song.title+' / '+this.game.count+' fragments\n'+(this.puzzle.manifest.projection!=='pose-phase/1'?JSON.stringify({projection:this.binding.algorithm,state,coefficients:this.project(state).coefficients}):this.phases(state).map((p,i)=>'pieces['+i+'].late('+p.ticks+'*'+this.localBars+'/'+this.binding.gridSteps+')').join('\n'));}
  }
  return{Music};
})();
