/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One pointer subscription per canvas; puzzle adapters receive semantic hits. */
window.PuzzlePointer = class {
  constructor(canvas,{enabled,pick,select,hover,drag}){
    Object.assign(this,{canvas,enabled,pick,select,hover,drag});
    this.events=new AbortController();this.gesture=null;
    const listen=(type,fn)=>canvas.addEventListener(type,fn,{signal:this.events.signal});
    listen('pointerdown',event=>{
      if(event.button!==0||event.isPrimary===false||this.gesture||!enabled())return;
      this.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,
        slop:event.pointerType==='touch'?12:6,hit:pick(event.clientX,event.clientY),moved:false};
      hover(this.gesture.hit);
      canvas.setPointerCapture(event.pointerId);event.preventDefault();
    });
    listen('pointermove',event=>{
      const g=this.gesture;
      if(!g){if(enabled()&&event.pointerType!=='touch')hover(pick(event.clientX,event.clientY));return;}
      if(g.id!==event.pointerId)return;
      if(Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>g.slop)g.moved=true;
      if(g.moved&&enabled()){hover(null);drag(event.clientX-g.x,event.clientY-g.y);}
      g.x=event.clientX;g.y=event.clientY;
    });
    listen('pointerup',event=>{
      const g=this.gesture;if(!g||g.id!==event.pointerId)return;
      this.cancel();
      if(!g.moved&&enabled()){
        const hit=g.hit||pick(event.clientX,event.clientY);if(hit)select(hit);
      }
      hover(event.pointerType==='touch'||!enabled()?null:pick(event.clientX,event.clientY));
    });
    listen('pointercancel',event=>{if(this.gesture?.id===event.pointerId){this.cancel();hover(null);}});
    listen('lostpointercapture',()=>this.cancel());
    listen('pointerleave',()=>{if(!this.gesture)hover(null);});
  }
  cancel(){
    const id=this.gesture?.id;this.gesture=null;
    if(id!==undefined&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
  }
  destroy(){this.events.abort();this.cancel();}
};
