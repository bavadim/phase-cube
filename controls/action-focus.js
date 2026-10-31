/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Logical action focus. Hover and keyboard temporarily override a pinned hint. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PuzzleActionFocus=factory();})(globalThis,function(){
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  return class{
    constructor({resolve=value=>value,onChange=()=>{}}={}){Object.assign(this,{resolve,onChange});this.sources=new Map();this.current=null;this.serial=0;}
    set(source,intent,{exclusive=false}={}){
      if(exclusive)this.sources.clear();
      if(intent)this.sources.set(source,{...intent,source,serial:++this.serial});else this.sources.delete(source);
      this.refresh();
    }
    clear(source,owner){const old=this.sources.get(source);if(old&&(owner==null||old.owner===owner)){this.sources.delete(source);this.refresh();}}
    reset(){this.sources.clear();this.refresh();}
    refresh(){
      let next=null;
      for(const entry of [...this.sources.values()].sort((a,b)=>b.serial-a.serial)){
        const resolved=this.resolve(entry);
        if(resolved){const {serial,...value}=resolved;next=value;break;}
        this.sources.delete(entry.source);
      }
      if(!same(this.current,next)){this.current=next;this.onChange(next);}
      return this.current;
    }
  };
});
