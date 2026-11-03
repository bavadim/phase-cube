/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One pointer subscription per canvas; camera drags and optional model edits. */
window.PuzzlePointer=class{
  constructor(canvas,{enabled,pick,select,hover,drag,beginDrag=()=>false,moveDrag=()=>{},endDrag=()=>{},empty=()=>{},log=()=>{}}){
    Object.assign(this,{canvas,enabled,pick,select,hover,drag,beginDrag,moveDrag,endDrag,log});
    this.events=new AbortController();this.gesture=null;
    const listen=(type,fn)=>canvas.addEventListener(type,fn,{signal:this.events.signal});
    listen('pointerdown',event=>{
      log('pointer.down',{id:event.pointerId,kind:event.pointerType,x:event.clientX,y:event.clientY,enabled:enabled(),previous:this.gesture?.id??null});
      if(event.button!==0||event.isPrimary===false||!enabled())return;
      if(this.gesture)this.cancel('new-primary-down');
      this.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,
        slop:event.pointerType==='touch'?12:6,hit:pick(event.clientX,event.clientY),moved:false,custom:false};
      hover(this.gesture.hit,{pointerType:event.pointerType});
      try{canvas.setPointerCapture(event.pointerId);}catch(e){log('pointer.capture-failed',{message:e.message});}
      event.preventDefault();
    });
    listen('pointermove',event=>{
      const g=this.gesture;
      if(!g){if(enabled()&&event.pointerType!=='touch')hover(pick(event.clientX,event.clientY),{pointerType:event.pointerType});return;}
      if(g.id!==event.pointerId)return;
      if(!g.moved&&Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>g.slop){
        g.moved=true;
        if(enabled())g.custom=beginDrag(g.hit,{x:g.startX,y:g.startY})===true;
        log('pointer.drag',{key:g.hit?.key??null,custom:g.custom});
      }
      if(g.moved&&enabled()){
        hover(null);
        if(g.custom)moveDrag({x:event.clientX,y:event.clientY});else drag(event.clientX-g.x,event.clientY-g.y);
      }
      g.x=event.clientX;g.y=event.clientY;
    });
    const finish=event=>{
      log('pointer.up',{id:event.pointerId,gesture:this.gesture?.id??null,enabled:enabled()});
      const g=this.gesture;if(!g||g.id!==event.pointerId)return;
      // Release before the commit changes the session gate; its update must not
      // cancel the edit that is being submitted to the shared move pipeline.
      this.gesture=null;this.release(g.id);
      if(g.custom)endDrag(!enabled());
      else if(!g.moved&&enabled()){
        const hit=g.hit||pick(event.clientX,event.clientY);log('pointer.hit',{key:hit?.key??null,inverted:hit?.inverted});if(hit)select(hit,{pointerType:event.pointerType});else empty();
      }
      hover(event.pointerType==='touch'||!enabled()?null:pick(event.clientX,event.clientY),{pointerType:event.pointerType});
    };
    listen('pointerup',finish);
    listen('pointercancel',event=>{if(this.gesture?.id===event.pointerId){this.cancel('pointercancel');hover(null);}});
    listen('lostpointercapture',event=>{
      log('pointer.lost-capture',{id:event.pointerId,gesture:this.gesture?.id??null});
      if(this.gesture?.id===event.pointerId&&!canvas.hasPointerCapture(event.pointerId))this.cancel('lost-capture');
    });
    listen('pointerleave',()=>{if(!this.gesture)hover(null);});
    window.addEventListener('pointerup',event=>{if(event.target!==canvas&&this.gesture?.id===event.pointerId)finish(event);},{signal:this.events.signal});
    window.addEventListener('pointercancel',event=>{if(this.gesture?.id===event.pointerId)this.cancel('window-cancel');},{signal:this.events.signal});
    window.addEventListener('blur',()=>this.cancel('blur'),{signal:this.events.signal});
  }
  release(id){try{if(this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);}catch{}}
  cancel(reason='cancel'){
    const g=this.gesture;this.gesture=null;
    this.hover(null,{reason});
    if(!g)return;
    this.log('pointer.cancel',{id:g.id,reason});this.release(g.id);
    if(g.custom)this.endDrag(true);
  }
  destroy(){this.events.abort();this.cancel('destroy');}
};
