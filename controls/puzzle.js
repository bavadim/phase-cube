/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Shared selection, move preview, hint, action animation and keyboard adapter. */
window.PuzzleControl = {
  mount({presentation,module,commands,model,game,canInteract,onMove,onPreview,onSelect,createView}){
    let preview=null,armed=null;
    const feedback=()=>{if(presentation.active?.view===view)presentation.feedback({selected:model.selected,move:preview});};
    const controls=new PuzzleTurnControls(commands,{model,onMove,onPreview:move=>{preview=move;feedback();onPreview(move);}});
    const view=presentation.mount(createView,{module,model,game,onHover:hit=>{
      const move=canInteract()&&hit&&armed===model.selected&&hit.key===armed&&typeof hit.inverted==='boolean'?model.moveFor(armed,hit.inverted):null;
      if(preview!==move){preview=move;feedback();onPreview(move);}
    },onSelect:hit=>{
      if(!canInteract())return;
      if(!hit.selectOnly&&armed===model.selected&&hit.key===armed&&typeof hit.inverted==='boolean'){
        onMove(model.moveFor(armed,hit.inverted));return;
      }
      model.select(hit.key);armed=hit.key;controls.hint(null);onSelect();
    }});
    return {
      update(disabled){controls.update(disabled);presentation.update(disabled);feedback();},
      async animate(move,before){armed=model.moveTarget(move);try{await view.animate(move,before);}finally{if(presentation.active?.view===view){view.sync();feedback();}}},
      hint(move){controls.hint(move);armed=model.selected;preview=move;view.focus?.(model.selected);feedback();},
      clearHint(){controls.hint(null);preview=null;feedback();},
      resetInteraction(){armed=null;preview=null;presentation.active?.view.hover?.(null);feedback();},
      focus:()=>presentation.element.focus({preventScroll:true}),
      destroy(){if(presentation.active?.view===view)presentation.unmount();},
      key(event){const key=event.code?.replace('Key','');if(model.choices().some(c=>c.key===key)){onMove(model.moveFor(key,event.shiftKey));return true;}return false;}
    };
  }
};
