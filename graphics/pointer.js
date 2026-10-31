/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* One pointer subscription per canvas; puzzle adapters receive semantic hits. */
window.PuzzlePointer = class {
  constructor(canvas,{enabled,pick,select,hover,drag,log=()=>{}}){
    Object.assign(this,{canvas,enabled,pick,select,hover,drag});
    this.events=new AbortController();this.gesture=null;
    const listen=(type,fn)=>canvas.addEventListener(type,fn,{signal:this.events.signal});
    listen('pointerdown',event=>{
      log('pointer.down',{id:event.pointerId,kind:event.pointerType,x:event.clientX,y:event.clientY,enabled:enabled(),previous:this.gesture?.id??null});
      if(event.button!==0||event.isPrimary===false||!enabled())return;
      // A new primary down cannot belong to the previous press. Recover when
      // the OS/browser omitted its up/cancel instead of locking input forever.
      if(this.gesture)this.cancel('new-primary-down');
      this.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,
        slop:event.pointerType==='touch'?12:6,hit:pick(event.clientX,event.clientY),moved:false};
      hover(this.gesture.hit);
      try{canvas.setPointerCapture(event.pointerId);}catch(e){log('pointer.capture-failed',{message:e.message});}
      event.preventDefault();
    });
    listen('pointermove',event=>{
      const g=this.gesture;
      if(!g){if(enabled()&&event.pointerType!=='touch')hover(pick(event.clientX,event.clientY));return;}
      if(g.id!==event.pointerId)return;
      if(Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>g.slop)g.moved=true;
      if(g.moved&&enabled()){hover(null);drag(event.clientX-g.x,event.clientY-g.y);}
      g.x=event.clientX;g.y=event.clientY;
    });
    const finish=event=>{
      log('pointer.up',{id:event.pointerId,gesture:this.gesture?.id??null,enabled:enabled()});
      const g=this.gesture;if(!g||g.id!==event.pointerId)return;
      this.cancel();
      if(!g.moved&&enabled()){
        const hit=g.hit||pick(event.clientX,event.clientY);log('pointer.hit',{key:hit?.key??null,inverted:hit?.inverted});if(hit)select(hit);
      }
      hover(event.pointerType==='touch'||!enabled()?null:pick(event.clientX,event.clientY));
    };
    listen('pointerup',finish);
    listen('pointercancel',event=>{if(this.gesture?.id===event.pointerId){this.cancel();hover(null);}});
    listen('lostpointercapture',event=>{
      log('pointer.lost-capture',{id:event.pointerId,gesture:this.gesture?.id??null});
      if(this.gesture?.id===event.pointerId&&!canvas.hasPointerCapture(event.pointerId))this.cancel('lost-capture');
    });
    listen('pointerleave',()=>{if(!this.gesture)hover(null);});
    window.addEventListener('pointerup',event=>{if(event.target!==canvas&&this.gesture?.id===event.pointerId)finish(event);},{signal:this.events.signal});
    window.addEventListener('pointercancel',event=>{if(this.gesture?.id===event.pointerId)this.cancel('window-cancel');},{signal:this.events.signal});
    window.addEventListener('blur',()=>this.cancel('blur'),{signal:this.events.signal});
    this.log=log;
  }
  cancel(reason='cancel'){
    const id=this.gesture?.id;if(id!==undefined)this.log?.('pointer.cancel',{id,reason});this.gesture=null;
    if(id!==undefined&&this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
  }
  destroy(){this.events.abort();this.cancel();}
};
