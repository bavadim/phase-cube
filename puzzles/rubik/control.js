/* SPDX-License-Identifier: AGPL-3.0-or-later */
RubikPuzzle.mount=function({stage,commands,model,game,canInteract,onMove,onPreview,onSelect}){
  let selected=0,animating=false;
  stage.className='puzzle-stage cube-stage';stage.innerHTML='<div id="cube-view"></div><svg id="cube-input" aria-label="Выбранная грань"></svg><div id="view-error" hidden>3D недоступно</div>';
  stage.setAttribute('aria-label','Кубик: коснись грани для выбора, перетаскивай для осмотра');
  const view=PhaseCubeView.create({T:THREE,M:PhaseCube,colors:RubikPuzzle.colors,view:stage.querySelector('#cube-view'),stage,svg:stage.querySelector('#cube-input'),
    getState:()=>model.snapshot(),getSelected:()=>selected,getSelectedFace:()=>model.selected,isBusy:()=>!canInteract(),
    onMove,onPreview,onSelect:(face,id)=>{if(canInteract()){model.select(face);selected=id;controls.hint(null);onSelect();}},selectOnly:()=>true,
    onError:()=>{stage.querySelector('#view-error').hidden=false;}});
  const controls=new PuzzleTurnControls(commands,{model,onMove,onPreview:move=>view?.input.previewMove(move)});
  return {
    update(disabled){stage.inert=disabled;stage.setAttribute('aria-disabled',String(disabled));controls.update(disabled);if(!animating)view?.render();},
    async animate(move){animating=true;try{await view?.animate(move);}finally{animating=false;}},
    hint(move){controls.hint(move);view?.focus(model.selected);view?.input.setHint(move);},
    clearHint(){controls.hint(null);view?.input.resetPreview();},
    focus:()=>controls.focus(),destroy:()=>view?.destroy(),
    key(event){const key=event.code?.replace('Key','');if(PhaseCube.FACES.includes(key)){onMove(model.moveFor(key,event.shiftKey));return true;}return false;}
  };
};
