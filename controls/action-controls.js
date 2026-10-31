/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Generic keyed action lists around a persistent hint. No puzzle rules here. */
window.PuzzleActionControls=class{
  constructor(host,{model,onMove,onPreview,onFocus}){
    Object.assign(this,{host,model,onFocus,callbacks:{perform:onMove,preview:onPreview}});this.focused=null;this.items=new Map();
    const hint=document.getElementById('hint');hint.remove();host.replaceChildren();host.setAttribute('aria-label','Действия выбранного объекта');
    this.caption=document.createElement('div');this.caption.className='puzzle-operation';this.caption.setAttribute('role','status');host.append(this.caption);
    const side=name=>{const el=document.createElement('div');el.className='puzzle-actions puzzle-actions-'+name;
      const title=document.createElement('span');title.className='puzzle-action-group';const row=document.createElement('div');row.className='puzzle-action-row';el.append(title,row);host.append(el);return{el,title,row};};
    this.left=side('left');this.hintSlot=document.createElement('span');this.hintSlot.className='hint-slot';this.hintSlot.append(hint);host.append(this.hintSlot);this.right=side('right');
    this.update(true);
  }
  update(disabled,{label=this.model.selectionLabel?.()||''}={}){
    const actions=PuzzleActions.validate(this.model.actions(this.callbacks)),split=Math.ceil(actions.length/2),seen=new Set();
    this.host.dataset.actionCount=actions.length;this.host.classList.toggle('many-actions',actions.length>2);
    this.host.style.setProperty('--left-grow',Math.max(1,split)+'fr');this.host.style.setProperty('--right-grow',Math.max(1,actions.length-split)+'fr');
    this.caption.hidden=!label;if(this.caption.textContent!==label)this.caption.textContent=label;
    const groups=[actions.slice(0,split),actions.slice(split)];
    [this.left,this.right].forEach((side,i)=>{
      const labels=new Set(groups[i].map(a=>a.group||'')),title=labels.size===1?[...labels][0]:'';
      side.title.hidden=!title;if(side.title.textContent!==title)side.title.textContent=title;
      groups[i].forEach(action=>{
        seen.add(action.id);let item=this.items.get(action.id);
        if(!item){
          const button=document.createElement('button');button.type='button';button.id=action.id;button.className='puzzle-action';
          item={button,action,iconKey:null};this.items.set(action.id,item);
          button.onclick=()=>{if(!button.disabled)item.action.onInvoke();};
          const focus=(source,active)=>{if(this.onFocus)this.onFocus(item.action,source,active);else item.action.onPreview?.(active);};
          button.onpointerenter=e=>{if(e.pointerType!=='touch'&&!button.disabled)focus('button-pointer',true);};
          button.onfocus=()=>{if(!button.disabled&&(!this.onFocus||button.matches(':focus-visible')))focus('button-keyboard',true);};
          button.onpointerleave=()=>focus('button-pointer',false);
          button.onblur=()=>focus('button-keyboard',false);
          button.onpointerdown=()=>focus('button-keyboard',false);
        }
        item.action=action;const b=item.button;
        if(b.parentElement!==side.row)side.row.append(b);
        const iconKey=JSON.stringify(action.icon);
        if(item.iconKey!==iconKey){
          b.replaceChildren();const icon=document.createElement(action.icon.src?'img':'span');
          if(action.icon.src){icon.src=action.icon.src;icon.alt='';}else icon.textContent=action.icon.text;
          icon.className='puzzle-action-icon';icon.setAttribute('aria-hidden','true');b.append(icon);item.iconKey=iconKey;
        }
        b.disabled=disabled||action.enabled===false;b.title=action.label;b.setAttribute('aria-label',action.label);
        const focused=!disabled&&this.focused?.move!=null&&JSON.stringify(action.move)===JSON.stringify(this.focused.move);
        const demo=this.focused?.source==='demonstration'&&JSON.stringify(action.move)===JSON.stringify(this.focused.move);
        b.classList.toggle('action-focused',focused||demo);
        b.classList.toggle('hinted',(focused&&this.focused.source==='hint')||demo);
        if(focused||demo)b.dataset.focusSource=this.focused.source;else delete b.dataset.focusSource;
      });
      // Reorder existing nodes only when the model actually changes its list.
      groups[i].forEach((action,index)=>{const b=this.items.get(action.id).button;if(side.row.children[index]!==b)side.row.insertBefore(b,side.row.children[index]||null);});
    });
    for(const [id,item]of this.items)if(!seen.has(id)){item.button.remove();this.items.delete(id);}
  }
  setFocus(value){this.focused=value;}
  focus(){[...this.items.values()].find(item=>!item.button.disabled)?.button.focus({preventScroll:true});}
  destroy(){for(const {button}of this.items.values())button.remove();this.items.clear();}
};
