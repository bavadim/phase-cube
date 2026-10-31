/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.PuzzleTurnControls=class{
  constructor(host,{model,onMove,onSelect,onPreview}){
    this.model=model;this.host=host;this.hinted=null;
    const hint=document.getElementById('hint');hint.remove();
    host.innerHTML='<button id="turn-left" class="turn-button" aria-label="Поворот против часовой стрелки">↶</button><span class="hint-slot"></span><button id="turn-right" class="turn-button" aria-label="Поворот по часовой стрелке">↷</button>';
    host.querySelector('.hint-slot').append(hint);
    this.buttons=[host.querySelector('#turn-left'),host.querySelector('#turn-right')];
    this.buttons.forEach((b,i)=>{
      const move=()=>model.moveFor(model.selected,i===0);
      b.onclick=()=>onMove(move());
      b.onpointerenter=e=>{if(e.pointerType!=='touch')onPreview(move());};
      b.onpointerleave=b.onblur=()=>onPreview(null);
    });
  }
  update(disabled){
    this.buttons.forEach((b,i)=>{b.disabled=disabled;b.classList.toggle('hinted',this.hinted===this.model.moveFor(this.model.selected,i===0));
      b.setAttribute('aria-label',this.model.choices().find(c=>c.key===this.model.selected).label+': '+(i===0?'против':'по')+' часовой стрелке');});
  }
  hint(move){this.hinted=move;if(move)this.model.select(move[0]);}
  focus(){this.buttons[1].focus({preventScroll:true});}
};
