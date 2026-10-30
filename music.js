/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Native Strudel patterns, event comparison and read-only move forecasts. */
window.PhaseCubeMusic=(()=>{
  'use strict';
  const controls=['gain','attack','decay','sustain','release','lpf','hpf','pan'];
  function eventsOf(pattern){
    return pattern.queryArc(0,1).filter(h=>h.hasOnset()).map(h=>({
      start:Number(h.whole.begin),duration:Number(h.whole.end.sub(h.whole.begin)),value:h.value
    }));
  }
  function eventKey(events){
    return events.map(e=>JSON.stringify([Math.round(e.start*1e9),Math.round(e.duration*1e9),e.value])).sort().join('|');
  }
  class Music {
    constructor(S,M,Cube,voices){
      Object.assign(this,{S,M,Cube,voices});
      this.basePatterns=voices.map(v=>{
        let p=v.sound?S.note(v.notes).s(v.sound):S.s(v.notes);
        for(const k of controls)if(v[k]!=null)p=p[k](v[k]);
        return p;
      });
    }
    shifted(state){
      const phases=this.M.phases(state);
      return this.basePatterns.map((p,id)=>p.late(this.S.Fraction([phases[id].ticks,24])));
    }
    rows(state){return this.shifted(state).map(eventsOf);}
    predict(move,state,currentRows){
      const next=new this.Cube();this.M.restore(next,state);next.move(move);
      const before=this.M.phases(state),phases=this.M.phases(this.M.snapshot(next));
      const rows=this.rows(this.M.snapshot(next));
      return {move,phases,rows,
        phaseChanged:phases.filter((p,id)=>p.ticks!==before[id].ticks).map(p=>p.id),
        changed:rows.map((r,id)=>eventKey(r)!==eventKey(currentRows[id])?id:-1).filter(id=>id>=0)};
    }
    pattern(state,{foundation=true,solo=-1,muted=[]},respectMix=true){
      const layers=[];
      if(foundation&&(!respectMix||solo<0))layers.push(this.S.s('kick*4').gain(.22));
      this.shifted(state).forEach((p,id)=>{
        if(!respectMix||(!muted.includes(id)&&(solo<0||solo===id)))layers.push(p);
      });
      return layers.length?this.S.stack(...layers):this.S.silence;
    }
    code(state,{foundation,solo,muted},bpm){
      const phases=this.M.phases(state),lines=[`setcps(${bpm} / 240)`,'stack('];
      if(foundation&&solo<0)lines.push('  s("kick*4").gain(0.22),');
      this.voices.forEach((v,id)=>{
        const params=controls.filter(k=>v[k]!=null).map(k=>`.${k}(${v[k]})`).join('');
        let line=`  ${v.sound?'note':'s'}(${JSON.stringify(v.notes)})${v.sound?`.s(${JSON.stringify(v.sound)})`:''}${params}.late(${phases[id].ticks}/24)`;
        if(muted.includes(id)||(solo>=0&&solo!==id))line+='.gain(0)';
        lines.push(line+`, // ${id+1}: ${v.name}`);
      });
      return [...lines,')'].join('\n');
    }
  }
  return {Music,eventsOf};
})();
