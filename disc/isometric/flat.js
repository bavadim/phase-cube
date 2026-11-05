/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoFlat = {
  mount(host,callbacks) {
    const fleet=document.createElement('div'),detail=document.createElement('div');
    fleet.className='flat-overview';detail.className='iso-flat-face';
    host.replaceChildren(fleet,detail);
    const face=IsoFace.mountFlat({overlay:detail,callbacks});
    let frame,patch=null,insert=null,lastState,lastFocus;
    function can(action){try{IsoFlow.apply(frame.editState,action);return true;}catch{return false;}}
    function choice(label,handler){
      const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=handler;fleet.append(b);return b;
    }
    function draw(){
      if(!frame)return;
      const s=frame.editState,focused=!patch&&!insert&&frame.selected;
      lastState=s;lastFocus=focused;
      fleet.hidden=!!focused;detail.hidden=!focused;
      fleet.replaceChildren();
      if(focused)return;
      const {names}=IsoWorkshopLabels;
      if(insert){
        for(const [from,to] of Object.entries(s.links)){
          const edit={type:'insert',node:insert,from};
          if(to===insert||from.startsWith(insert+':')||!can(edit))continue;
          choice('＋ '+names[from.split(':')[0]]+' → '+names[to],()=>{if(callbacks.act(edit))setInsert(null);});
        }
      }else{
        for(const [id,name] of Object.entries(names)){
          if(patch&&!can({type:'connect',from:patch,to:id}))continue;
          const b=choice(name,()=>{if(patch){if(callbacks.connect(patch,id))setPatch(null);}else callbacks.select(id);});
          b.dataset.station=id;
        }
      }
    }
    function setPatch(key){patch=key;if(key&&insert)setInsert(null);callbacks.patchChanged(patch);draw();}
    function setInsert(id){insert=id;if(id&&patch)setPatch(null);callbacks.insertChanged(insert);draw();}
    function cancelMode(){if(patch)setPatch(null);if(insert)setInsert(null);}
    return {setPatch,setInsert,cancelMode,
      render(next){
        frame=next;
        const focus=!patch&&!insert&&frame.selected;
        if(lastState!==frame.editState||lastFocus!==focus)draw();
        face.render(frame,focus||null);
      },
      inspect:()=>({webgl:false,focus:lastFocus||null})
    };
  }
};
