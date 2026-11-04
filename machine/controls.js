/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* The small action dock mirrors physical gestures; it owns no music rules. */
window.MachineControls=(()=>{
  class Controls{
    constructor(callbacks){this.$=id=>document.getElementById(id);this.callbacks=callbacks;this.abort=new AbortController();this.modules=[];this.currentKey=null;
      const on=(id,fn)=>this.$(id).addEventListener('click',fn,{signal:this.abort.signal});
      on('install',()=>callbacks.toggle());on('next-part',()=>{const options=this.modules.filter(m=>m.available),i=options.findIndex(m=>m.key===this.currentKey);if(options.length)callbacks.select(options[(i+1)%options.length].key);});
      on('variant',()=>callbacks.nextVariant());
    }
    mount(modules){this.modules=modules;}
    update({model,state,loading,playing,pending,activeSlot,saved}){
      const key=model.selected,m=this.modules.find(m=>m.key===key),p=state.parts.find(p=>p.key===key);if(!m||!p)return;this.currentKey=key;
      this.$('part-name').textContent=m.name+(m.available===false?' · нет в наборе':p.installed?'':' · снята');this.$('part-name').style.color=m.color;
      const install=this.$('install');install.disabled=loading||m.available===false;install.setAttribute('aria-pressed',String(p.installed));this.$('install-icon').textContent=p.installed?'−':'＋';this.$('install-label').textContent=p.installed?'Снять':'Подключить';
      this.$('variant').disabled=loading||m.variants.length<2;this.$('variant').title='Следующая фраза ('+(p.variant+1)+'/'+m.variants.length+')';this.$('next-part').disabled=loading;
      this.$('machine-status').textContent=loading?'ЗАГРУЗКА':playing?(pending?'ВСТУПЛЕНИЕ':'ИГРАЕТ'):'МАСТЕРСКАЯ';this.$('live-light').classList.toggle('on',playing);
      this.$('undo').disabled=loading||!model.history.length;this.$('snapshot-a').setAttribute('aria-pressed',String(activeSlot==='a'));this.$('snapshot-b').setAttribute('aria-pressed',String(activeSlot==='b'));this.$('save-snapshot').textContent='Запомнить '+activeSlot.toUpperCase();this.$('restore-scene').disabled=!saved||loading;
      for(const id of ['snapshot-a','snapshot-b','save-snapshot','save-scene','export-scene','import-scene'])this.$(id).disabled=loading;
    }
    destroy(){this.abort.abort();}
  }
  return{Controls};
})();
