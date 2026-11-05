/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.IsoPanel = (() => {
  'use strict';
  const names={source:'Шестерня',copy:'Копир',delay:'Задержка',router:'Развилка',keys:'Клавиши',bell:'Колокол',bin:'Корзина'};
  const ports={out:'Выход',copy:'Копия',straight:'→ Прямо',side:'↳ Вбок'};
  const shapes={
    source:'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2 M19 12a7 7 0 1 1-14 0 7 7 0 1 1 14 0 M14 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
    copy:'M2 12h6c4 0 3-6 7-6h6m-4-3 4 3-4 3M8 12c4 0 3 6 7 6h6m-4-3 4 3-4 3',
    delay:'M3 6h18v12H3z M8 6v12m5-12v12m5-12v12',
    router:'M2 12h8l5-6h6m-4-3 4 3-4 3M10 12l5 6h6m-4-3 4 3-4 3',
    keys:'M2 6h20v13H2z M6 6v7m5-7v7m5-7v7m-9 2v4m5-4v4m5-4v4',
    bell:'M4 17h16l-2-3v-3a6 6 0 0 0-12 0v3z M10 20q2 2 4 0 M12 3v2',
    bin:'M4 6h16m-14 0 1.5 14h9L18 6M9 4h6m-5 5 .5 8m3.5-8-.5 8'
  };
  function icon(key){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
    svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','part-symbol');svg.setAttribute('aria-hidden','true');
    path.setAttribute('d',shapes[key]);svg.append(path);return svg;
  }
  function el(tag,cls,text){
    const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
  }
  function button(text,key,handler,cls){
    const b=el('button',cls,text);b.type='button';b.dataset.key=key;b.onclick=handler;return b;
  }
  const pitchName=p=>p==null?'—':['До','До♯','Ре','Ми♭','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Си♭','Си'][p%12];
  const targetName=(s,key)=>names[s.links[key]]||'Свободно';
  const can=(state,action)=>{try{IsoFlow.apply(state,action);return true;}catch{return false;}};
  function beltName(from,to){
    const [owner,port]=from.split(':');
    return names[owner]+(IsoFlow.PORTS[owner].length>1?' ('+ports[port].toLowerCase()+')':'')+' → '+names[to];
  }
  function mount(host,actions){
    let previousStation='',grid=[],lastStep=-1;
    function markStep(step){
      if(lastStep===step)return;
      if(grid[lastStep])grid[lastStep].removeAttribute('data-current');
      if(grid[step])grid[step].dataset.current='true';
      lastStep=step;
    }
    function render({state:s,selected:id,patch,insert,previewStep}){
      const expanded=previousStation===id&&host.querySelector('details')?.open;
      const focusKey=host.contains(document.activeElement)?document.activeElement.dataset.key:null;
      previousStation=id;host.replaceChildren();grid=[];lastStep=-1;
      const addTitle=text=>host.append(el('h2','',text));
      const help=text=>host.append(el('p','help',text));
      const routeLabel=k=>targetName(s,'router:'+k);
      const ins=IsoFlow.revision(s);
      const ticks=Array.from({length:8},(_,i)=>IsoFlow.tick(ins,8+i));
      function sequence(title,buttons){
        const group=el('div','step-grid');group.setAttribute('role','group');group.setAttribute('aria-label',title);
        grid=buttons; group.append(...buttons);host.append(group);
      }
      function step(i,head,value,onClick){
        const pad=button('','step-'+i,onClick,'step-pad');
        const top=el('span','pad-top');
        top.append(el('small','',String(i+1)),el('span','note-name',head));
        pad.append(top,el('strong','',value));return pad;
      }
      function stepper(label,value,type,increment,downDisabled=false,upDisabled=false){
        const row=el('div','control-row'),buttons=el('div','step-buttons');
        const less=button('−',type+'-down',()=>actions.act({type,delta:-increment}));
        const more=button('+',type+'-up',()=>actions.act({type,delta:increment}));
        less.setAttribute('aria-label','Уменьшить: '+label);more.setAttribute('aria-label','Увеличить: '+label);
        less.disabled=downDisabled;more.disabled=upDisabled;
        buttons.append(less,more);row.append(el('span','',label+' · '+value),buttons);return row;
      }
      function installOptions(node){
        return Object.entries(s.links).filter(([from,to])=>to!==node&&!from.startsWith(node+':')&&can(s,{type:'insert',node,from}));
      }
      const isEditable=['copy','router','delay'].includes(id), connected=Object.values(s.links).includes(id);
      if(patch||insert){
        const list=el('div','mode-options');
        if(patch){
          addTitle('Куда провести ленту?');
          help(names[patch.split(':')[0]]+' · '+ports[patch.split(':')[1]]+'. Выберите деталь на столе или здесь.');
          for(const [dest,name] of Object.entries(names)){
            if(s.links[patch]===dest||!can(s,{type:'connect',from:patch,to:dest}))continue;
            const b=button(name,'to-'+dest,()=>actions.connect(patch,dest));b.prepend(icon(dest));list.append(b);
          }
          if(s.links[patch])list.append(button('Отсоединить от «'+targetName(s,patch)+'»','unplug',()=>actions.disconnect(patch)));
        }else{
          addTitle('В какую ленту вставить?');
          help(names[insert]+'. Выберите подсвеченную ленту на столе или её концы здесь.');
          for(const [from,to] of installOptions(insert)){
            list.append(button(beltName(from,to),'insert-'+from,()=>actions.install(insert,from)));
          }
        }
        host.append(list,button('Отмена','mode-cancel',actions.cancel,'full-btn'));
      }else{
        if(id==='router'){
          addTitle('Куда идёт нота?');
          help('Нажмите ноту, чтобы сменить её маршрут. Стрелка на столе меняет тот же шаг.');
          const pads=s.routes.map((straight,i)=>{
            const way=straight?'straight':'side',pitch=ticks[i].activity.router[0]?.pitch;
            const dest=routeLabel(way),name=pitchName(pitch);
            const arrow=straight?'→':'↳';
            const pad=step(i,pitch==null?'':name,pitch==null?'Пауза':dest,()=>actions.route(i));
            pad.querySelector('small').after(el('span','step-direction',arrow));
            pad.dataset.way=straight?'A':'B';pad.dataset.rest=String(pitch==null);
            pad.setAttribute('aria-label','Шаг '+(i+1)+', '+(pitch==null?'пауза':name)+', '+ports[way]+' в '+dest+'. Сменить выход');
            pad.title=(i+1)+' · '+ports[way]+' · '+dest;
            if(i===previewStep)pad.dataset.chosen='true';
            return pad;
          });
          sequence('Маршрут по восьмым',pads);
          const status=el('p','route-status');
          const chosen=s.routes[previewStep]?'straight':'side';
          status.textContent='Выбран шаг '+(previewStep+1)+' · '+ports[chosen]+' · '+routeLabel(chosen);
          status.setAttribute('role','status');host.append(status);
        }else if(id==='source'){
          addTitle('Ноты на шестерне');help('Каждое нажатие меняет ноту. Прочерк оставляет паузу.');
          sequence('Восемь нот',s.source.notes.map((pitch,i)=>{
            const pad=step(i,'',pitchName(pitch),()=>actions.act({type:'note',index:i}));
            pad.dataset.rest=String(pitch==null);pad.setAttribute('aria-label','Сменить ноту на шаге '+(i+1));return pad;
          }));
          host.append(stepper('Сдвиг',s.source.phase+' / 8','phase',1),
            stepper('Громкость',Math.round(s.source.level*100)+'%','level',.25,s.source.level<=0,s.source.level>=2));
        }else if(id==='delay'){
          addTitle('Через сколько восьмых?');help('Один карман удерживает ноту на одну восьмую.');
          const choices=el('div','choice-row');
          for(let n=0;n<=IsoFlow.MAX_DELAY;n++){
            const b=button(String(n),'delay-'+n,()=>actions.act({type:'delay',delta:n-s.delay}));
            b.setAttribute('aria-label','Задержка: '+n+' восьмых');b.setAttribute('aria-pressed',String(s.delay===n));choices.append(b);
          }
          host.append(choices);
        }else if(id==='copy'){
          addTitle('Одна нота, два выхода');
          help('Копир отправляет одинаковые ноты по обеим лентам. Подключите второй инструмент, чтобы услышать их вместе.');
        }else{
          addTitle(id==='bin'?'Что попадает в корзину':'Что звучит за оборот');
          const seq=el('div','note-sequence');
          ticks.forEach(t=>seq.append(el('span','',t.hits[id].map(box=>pitchName(box.pitch)).join(' + ')||'—')));
          host.append(seq);
        }
        if(IsoFlow.PORTS[id].length){
          const makeInsert=()=>button('Вставить в ленту','mount',()=>actions.startInsert(id),'full-btn'+(connected?'':' primary'));
          if(isEditable&&!connected&&installOptions(id).length)host.append(makeInsert());
          const details=el('details');
          details.open=Boolean(expanded||id==='copy');
          details.append(el('summary','','Подключения'));
          for(const port of IsoFlow.PORTS[id]){
            const key=id+':'+port,row=el('div','connection');
            const b=button(targetName(s,key)+' ›','wire-'+key,()=>actions.startPatch(key),'link-btn');
            b.setAttribute('aria-label','Подключить: '+names[id]+', '+ports[port]);
            row.append(el('span',port==='straight'?'way-a':port==='side'?'way-b':'',ports[port]),b);details.append(row);
          }
          if(isEditable&&connected){
            if(installOptions(id).length)details.append(makeInsert());
            details.append(button('Пустить в обход','bypass',()=>actions.act({type:'bypass',node:id}),'full-btn'));
          }
          host.append(details);
        }else{
          const list=Object.entries(s.links).filter(([,to])=>to===id).map(([from])=>names[from.split(':')[0]]);
          help(list.length?'Принимает от: '+list.join(', ')+'.':'Вход свободен. Выберите деталь, от которой хотите провести ленту.');
        }
      }
      if(focusKey)host.querySelector('[data-key="'+CSS.escape(focusKey)+'"]')?.focus({preventScroll:true});
    }
    return {render,markStep};
  }
  return {names,icon,mount};
})();
