/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One action focus drives the model highlight, bottom button and score preview. */
window.PuzzleControl = {
  mount({presentation,module,commands,model,game,binding,canInteract,onMove,onPreview,onSelect,createView}){
    let armed=null,disabled=true,demonstrating=false,view=null,controls=null;
    const hasSelection=()=>!view?.requiresSelection||armed!=null;
    const updateControls=()=>controls?.update(disabled||!hasSelection(),{label:hasSelection()?model.selectionLabel?.(focus.current?.point)||'':view.selectionPrompt||'Выберите объект'});
    const feedback=()=>{if(presentation.active?.view===view)presentation.feedback({selected:hasSelection()?model.selected:null,move:focus.current?.move||null,focus:focus.current});};
    const focus=new PuzzleActionFocus({
      resolve:value=>{
        if(!model.choices().some(c=>c.key===value.key))return null;
        if(value.source!=='demonstration'&&!canInteract())return null;
        return value.move==null||model.validMove(value.move,value.before??model.snapshot())?value:null;
      },
      onChange:value=>{
        if(value){model.select(value.key);if(value.source==='hint'||value.source==='field'&&value.move!=null)armed=value.key;}
        controls?.setFocus(value);updateControls();feedback();onPreview(value?.move||null,value);
      }
    });
    const intent=(move,extra={})=>({key:model.moveTarget(move),move,...extra});
    const fromHit=hit=>hit?.move??(hit&&typeof hit.inverted==='boolean'?model.moveFor(hit.key,hit.inverted):null);
    controls=new PuzzleActionControls(commands,{model,onMove,onPreview:()=>{},onFocus:(action,source,active)=>{
      if(active&&canInteract()&&action.move!=null)focus.set(source,intent(action.move,{owner:action.id}));
      else focus.clear(source,action.id);
    }});
    view=presentation.mount(createView,{module,model,game,binding,onMove,
      onEditPreview:(move,point)=>{if(point)focus.set('edit',{key:point.key,move,point});else if(move)focus.set('edit',intent(move));else focus.clear('edit');},
      onHover:(hit,event={})=>{
        if(view?.hoverActions===false){focus.clear('field');return;}
        if(event.pointerType==='touch')return;
        if(hit&&canInteract())focus.set('field',{key:hit.key,move:fromHit(hit)});else focus.clear('field');
      },
      onSelect:(hit,event={})=>{
        if(!canInteract())return;
        const move=fromHit(hit);
        if(!hit.selectOnly&&move&&model.validMove(move)&&(event.pointerType!=='touch'||armed===model.selected&&hit.key===armed)){
          onMove(move);return;
        }
        focus.reset();model.select(hit.key);armed=hit.key;onSelect();feedback();
      }
    });
    return {
      ready:view.ready||Promise.resolve(true),
      update(value){
        disabled=value;if(disabled&&!demonstrating)focus.reset();else focus.refresh();
        controls.setFocus(focus.current);updateControls();presentation.update(disabled);feedback();
      },
      async animate(move,before,options={}){
        armed=model.moveTarget(move);demonstrating=!!options.demonstration;
        if(demonstrating)focus.set('demonstration',intent(move,{before}),{exclusive:true});
        try{await view.animate(move,before,options);}finally{if(presentation.active?.view===view){
          demonstrating=false;focus.clear('demonstration');view.sync();feedback();
        }}
      },
      hint(move){armed=model.moveTarget(move);focus.set('hint',intent(move),{exclusive:true});view.focus?.(model.selected);},
      clearHint(){focus.reset();},
      resetInteraction(){armed=null;focus.reset();feedback();},
      focusState:()=>focus.current,
      selection:()=>hasSelection()?model.selected:null,
      focus:()=>presentation.element.focus({preventScroll:true}),
      destroy(){focus.reset();controls.destroy();if(presentation.active?.view===view)presentation.unmount();},
      key(event){const key=event.code?.replace('Key','');if(model.choices().some(c=>c.key===key)){onMove(model.moveFor(key,event.shiftKey));return true;}return false;}
    };
  }
};
