/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Action descriptors belong to models; callbacks enter the shared move pipeline. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PuzzleActions=factory();})(globalThis,function(){
  function move(model,{perform=()=>{},preview=()=>{}}={},action){
    const enabled=model.validMove(action.move);
    return {...action,enabled,onInvoke:()=>{if(enabled&&model.validMove(action.move))return perform(action.move);},
      onPreview:active=>preview(active&&enabled?action.move:null)};
  }
  function turns(model,callbacks){
    const selected=model.choices().find(c=>c.key===model.selected).label;
    return [true,false].map((inverted,i)=>move(model,callbacks,{id:i?'turn-right':'turn-left',
      label:selected+': '+(inverted?'против':'по')+' часовой стрелке',icon:{text:inverted?'↶':'↷'},move:model.moveFor(model.selected,inverted)}));
  }
  function validate(actions){
    if(!Array.isArray(actions)||new Set(actions.map(a=>a.id)).size!==actions.length)throw new Error('Действиям нужны уникальные id');
    for(const a of actions)if(!/^[a-z][\w-]*$/i.test(a.id)||typeof a.label!=='string'||!a.label||typeof a.onInvoke!=='function'||
      !a.icon||!['text','src'].some(key=>typeof a.icon[key]==='string'&&a.icon[key]))throw new Error('Неверный паспорт действия');
    return actions;
  }
  return{move,turns,validate};
});
