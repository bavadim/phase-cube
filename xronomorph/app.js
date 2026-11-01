/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const M=XronoModel,$=id=>document.getElementById(id),storage='biba-balanced-rhythm/1',history=[];
  let state=M.initial(),rows=[],rotationBefore=null,error=null;
  try{const saved=localStorage.getItem(storage)||localStorage.getItem('biba-rhythm-arcs/1')||localStorage.getItem('biba-xronomorph/1');if(saved)state=M.migrate(JSON.parse(saved));}catch{}
  const save=()=>{try{localStorage.setItem(storage,JSON.stringify(state));}catch{}};
  const fail=e=>{error=String(e.message||e);$('error').textContent=error;$('error').hidden=false;updateTransport();};
  const audio=new XronoAudio.Transport(strudel,{onChange:updateTransport,onError:fail});
  // Browsers may suppress the compatibility click following a touch drag.
  // Activate touch controls on a completed pointer tap; retain native mouse
  // and keyboard clicks, and consume the duplicate compatibility click.
  function activate(button,run){
    let press=null,ignoreClickUntil=0;
    button.addEventListener('pointerdown',e=>{if(!button.disabled&&e.button===0)press={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};});
    button.addEventListener('pointermove',e=>{if(press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>12)press.moved=true;});
    button.addEventListener('pointercancel',()=>{press=null;});
    button.addEventListener('pointerup',e=>{const p=press;press=null;if(button.disabled||e.pointerType==='mouse'||!p||p.id!==e.pointerId||p.moved)return;ignoreClickUntil=performance.now()+500;e.preventDefault();run();});
    button.addEventListener('click',e=>{if(button.disabled)return;if(e.detail===0||e.pointerType==='mouse'||performance.now()>ignoreClickUntil)run();else e.preventDefault();});
  }
  const remember=before=>{if(JSON.stringify(before.parts)===JSON.stringify(state.parts))return;history.push(before);if(history.length>48)history.shift();};
  const noteCount=n=>n+' '+(n%10===1&&n%100!==11?'нота':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'ноты':'нот');
  const view=new XronoView($('diagram'),{
    onPreview:text=>{$('preview-status').textContent=text;},
    onSelect:id=>{state={...state,selected:id};view.removeGroup=null;render();save();},
    onAction:action=>{try{const before=M.clone(state);state=M.apply(state,state.selected,action);error=null;$('error').hidden=true;view.removeGroup=null;remember(before);render();save();}catch(e){fail(e);}},
    onRotateStart:()=>{rotationBefore=M.clone(state);},
    onRotate:(id,phase)=>{state=M.rotate(state,id,phase);render();},
    onRotateEnd:cancel=>{if(!rotationBefore)return;if(cancel)state=rotationBefore;else remember(rotationBefore);rotationBefore=null;render();save();},
    onNudge:(id,delta)=>{const before=M.clone(state);state=M.rotate(state,id,state.parts[id].phase+delta);remember(before);render();save();}
  });
  const buttons=state.parts.map((p,id)=>{
    const div=document.createElement('div');div.className='layer-row';
    const enabled=document.createElement('input');enabled.type='checkbox';enabled.setAttribute('aria-label','Звук: '+M.instruments.find(i=>i.id===p.instrument).label);
    activate(enabled,()=>{view.end(null,true);state.parts[id].enabled=!state.parts[id].enabled;render();save();});
    const button=document.createElement('button');button.type='button';button.style.setProperty('--part',view.color(p));
    const swatch=document.createElement('span');swatch.className='swatch';swatch.setAttribute('aria-hidden','true');
    const name=document.createElement('span');name.className='name';name.textContent=M.instruments.find(i=>i.id===p.instrument).label;
    const count=document.createElement('small');button.append(swatch,name,count);activate(button,()=>{view.end(null,true);state={...state,selected:id};view.removeGroup=null;render();save();});
    div.append(enabled,button);$('layers').append(div);return{enabled,button,count};
  });
  function updateTransport(){
    $('play').disabled=audio.starting;$('play').textContent=audio.starting?'Загрузка…':audio.running?'Стоп':'Слушать';$('play').setAttribute('aria-pressed',String(audio.running));
    $('audio-state').textContent=audio.starting?'Готовим звук…':audio.running?'Играет':error?'Можно повторить запуск':'Готов к прослушиванию';
  }
  function render(){
    rows=M.project(state);audio.update(state);view.set(state,rows);
    rows.forEach((row,i)=>{const b=buttons[i];b.enabled.checked=row.enabled;b.button.setAttribute('aria-pressed',String(i===state.selected));b.count.textContent=noteCount(row.points.length);});
    for(const id of ['rpm','volume'])if($(id).value!==String(state[id]))$(id).value=state[id];
    $('rpm-value').textContent=Number(state.rpm.toFixed(1))+' об/мин · '+Number((60/state.rpm).toFixed(2))+' с';$('volume-value').textContent=Math.round(state.volume*100)+'%';
    const row=rows[state.selected];$('geometry-status').textContent=row.label+' · '+noteCount(row.points.length)+' · '+Math.round(row.phase*360)+'°';
    $('gesture-help').textContent=row.points.length?'Тяните ноту — вращается весь инструмент. Тяните «+» внутри дуги — все связанные точки перемещаются вместе. «−» в дереве удаляет целую ветвь.':'Выберите пару или тройку. Нажмите «+» или потяните его по кругу: все связанные ноты появятся одновременно.';
    document.querySelectorAll('[data-order]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.order===state.arity)));
    renderTree();
    $('undo').disabled=!history.length;updateTransport();
  }
  function renderTree(){
    const p=state.parts[state.selected],tree=$('group-tree'),focused=document.activeElement?.closest?.('[data-remove-group]')?.dataset.removeGroup;
    tree.replaceChildren();$('tree-empty').hidden=!!p.groups.length;
    const info=new Map(M.inspect(p).map(g=>[g.id,g]));
    const branch=(nodes,parent)=>{for(const n of nodes){
      const li=document.createElement('li'),row=document.createElement('div');row.className='branch';
      const label=document.createElement('span');label.textContent=(n.kind==='fixed'?'Импорт':n.order===2?'Пара':'Тройка')+' · '+noteCount(info.get(n.id).points.length);
      const remove=document.createElement('button');remove.type='button';remove.textContent='−';remove.dataset.removeGroup=n.id;remove.setAttribute('aria-label','Удалить ветвь: '+noteCount(info.get(n.id).count));
      const highlight=()=>view.removal(n.id),clear=()=>view.removal(null);
      remove.addEventListener('pointerenter',highlight);remove.addEventListener('pointerleave',clear);remove.addEventListener('focus',highlight);remove.addEventListener('blur',clear);
      activate(remove,()=>{view.end(null,true);const before=M.clone(state);state=M.apply(state,state.selected,{kind:'merge',group:n.id});view.removeGroup=null;remember(before);render();save();});
      row.append(label,remove);li.append(row);parent.append(li);
      if(n.children.length){const list=document.createElement('ol');li.append(list);branch(n.children,list);}
    }};
    branch(p.groups,tree);if(focused)tree.querySelector(`[data-remove-group="${focused}"]`)?.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-order]').forEach(button=>activate(button,()=>{view.end(null,true);state.arity=+button.dataset.order;view.hover=null;render();save();}));
  const migration=state.migration;
  if(migration?.skipped?.length){
    $('migration').hidden=false;
    $('migration-text').textContent='В прежнем рисунке '+migration.skipped.length+' '+(migration.skipped.length===1?'партия нарушала':'партии нарушали')+' баланс. Эти партии здесь пусты; исходное сохранение оставлено отдельно. Остальные партии перенесены.';
    const key=migration.sourceSchema==='rhythm-arcs/1'?'biba-rhythm-arcs/1':'biba-xronomorph/1';
    activate($('download-legacy'),()=>{const raw=localStorage.getItem(key);if(!raw)return fail('Исходное сохранение недоступно в этом браузере');const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='rhythm-before-balance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  }
  activate($('play'),()=>{error=null;$('error').hidden=true;if(audio.running)audio.stop();else audio.start(state);});
  for(const id of ['rpm','volume'])$(id).addEventListener('input',()=>{const value=+$(id).value;view.end(null,true);state[id]=value;render();save();});
  activate($('undo'),()=>{view.end(null,true);if(!history.length)return;const before=history.pop();state.parts=before.parts.map((p,i)=>({...p,enabled:state.parts[i].enabled}));state={...state,selected:before.selected};view.removeGroup=null;view.hover=null;render();save();});
  function tick(){view.tick(audio.clock(),audio.running,audio.events,strudel.getAudioContext().currentTime);requestAnimationFrame(tick);}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){view.end(null,true);audio.stop();}});window.addEventListener('pagehide',()=>{view.end(null,true);audio.stop();});
  render();save();tick();
  window.xronoLab={state:()=>M.clone(state),rows:()=>M.clone(rows),audio,view,model:M,history:()=>history.length};
})();
