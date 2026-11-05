/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),F=window.IsoFlow;
  const names={source:'Шестерня',copy:'Копир',delay:'Задержка',router:'Развилка',keys:'Клавиши',bell:'Колокол',bin:'Корзина'};
  const ports={out:'Выход',copy:'Копия',straight:'Прямо',side:'Вбок'};
  const pitchName=n=>n==null?'Пауза':['До','До♯','Ре','Ми♭','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Си♭','Си'][n%12];
  window.IsoWorkshopLabels=Object.freeze({names,ports,pitchName});
  const presets=['duet','straight','echo','answer'],storageKey='biba.note-conveyor.iso.v1';
  function presetState(id){
    const s=F.initial();
    if(id==='duet')return F.restore({...s,links:{'source:out':'router','router:straight':'keys','router:side':'bell'}});
    if(id==='straight')return F.restore({...s,links:{'source:out':'keys'}});
    if(id==='answer')return F.restore({...s,links:{'source:out':'copy','copy:out':'keys','copy:copy':'router','router:side':'bin','router:straight':'delay','delay:out':'bell'}});
    return s;
  }
  const signature=s=>JSON.stringify([s.source,s.routes,s.delay,Object.entries(s.links).sort()]);
  const presetKeys=Object.fromEntries(presets.map(id=>[signature(presetState(id)),id]));
  let state=presetState('duet');
  try{const raw=localStorage.getItem(storageKey);if(raw)state=F.restore(JSON.parse(raw));}catch{/* Start from the duet if a saved bench cannot be read. */}
  let revision=F.revision(state);
  // The second cycle includes notes that crossed the bar line in the delay.
  const stepFrames=()=>Array.from({length:F.STEPS},(_,i)=>F.tick(revision,F.STEPS+i));
  let steps=stepFrames(),scene,audio,selected=null,patch=null,insert=null,previewStep=0,picked=false,starting=false;
  let cachedRevision,cachedTick,eventFrame,lastLamp=-1,raf=0,focusAfterZoom=null;
  const undo=[],lamps=Array.from({length:F.STEPS},()=>document.createElement('i'));
  $('beat').append(...lamps);
  function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
  function refresh(){
    const mode=!!(patch||insert),focused=!!selected&&!mode;
    const movable=['copy','router','delay'].includes(selected);
    const links=Object.entries(state.links);
    $('back-to-table').hidden=!focused;
    $('return-to-shop').hidden=focused||mode;
    $('assembly').hidden=focused||mode;
    $('mount-part').hidden=!(focused&&movable&&links.some(([key,to])=>to!==selected&&!key.startsWith(selected+':')));
    $('bypass-part').hidden=!(focused&&movable&&links.some(([,to])=>to===selected));
    $('cancel-mode').hidden=!mode;$('unplug').hidden=!(patch&&state.links[patch]);
    $('preset').value=presetKeys[signature(state)]||'custom';$('undo').disabled=undo.length===0;
    const board=$('board');board.parentElement.dataset.mode=mode?'mount':focused?'focus':'overview';
    if(patch){
      const [id,port]=patch.split(':');
      $('status').textContent=names[id]+' · '+ports[port]+'. Выберите приёмник провода.';
    }else if(insert){$('status').textContent='Выберите соединение для детали «'+names[insert]+'».';}
    else{$('status').textContent=focused?names[selected]:'Весь стол';}
  }
  function updateState(next,remember=true){
    if(signature(state)===signature(next))return;
    if(remember){undo.push(state);if(undo.length>96)undo.shift();}
    state=next;revision=F.revision(next);steps=stepFrames();audio?.queue(next);
    try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{/* Keep session edits when storage is unavailable. */}
    notice('');refresh();
  }
  function act(action){try{updateState(F.apply(state,action));return true;}catch(err){notice(err.message);return false;}}
  function patchChanged(key){patch=key;if(key)insert=null;refresh();}
  function insertChanged(id){insert=id;if(id)patch=null;refresh();}
  function cancel(){scene?.cancelMode();}
  function select(id){
    if(id!==null&&!Object.hasOwn(names,id))return;
    const old=selected,keyboard=document.activeElement?.matches(':focus-visible');
    cancel();selected=id;if(old!==id)picked=false;notice('');refresh();
    focusAfterZoom=keyboard&&old!==id?(id?'#back-to-table':'#board [data-station="'+old+'"]'):null;
  }
  function rewind(){const previous=undo.pop();cancel();if(previous)updateState(previous,false);}
  function audition(){
    if(audio&&!audio.wanted())audio.previewRoute(state,previewStep).catch(err=>notice('Не удалось прослушать ноту. '+err.message));
  }
  function announceCamStep(){
    const port=state.routes[previewStep]?'straight':'side';
    const dest=names[state.links['router:'+port]]||'Выход свободен';
    $('status').textContent='Положение '+(previewStep+1)+' · '+ports[port]+' · '+dest;
  }
  function pickStep(i){
    if(!Number.isInteger(i)||i<0||i>=F.STEPS)return;
    previewStep=i;picked=true;announceCamStep();audition();
  }
  function flipRoute(){
    if(act({type:'route',index:previewStep})){picked=true;announceCamStep();audition();}
  }
  function touchCam(i){
    if(picked&&i===previewStep)flipRoute();
    else pickStep(i);
  }
  function transportUI(){
    const running=Boolean(audio?.wanted());
    $('play').disabled=!audio||starting;
    $('play').setAttribute('aria-pressed',String(running));
    $('play').setAttribute('aria-label',starting?'Запуск':running?'Пауза':'Запустить');
  }
  async function toggleAudio(){
    if(!audio||starting)return;
    if(audio.wanted()){audio.pause();transportUI();return;}
    starting=true;transportUI();notice('');
    try{await audio.start(state);}catch(err){notice('Не удалось включить звук. '+err.message);}
    finally{starting=false;transportUI();}
  }
  function render(){
    raf=0;if(document.hidden)return;
    const playing=Boolean(audio?.playing()),active=(playing&&audio.audible())||revision;
    const time=Math.max(0,audio?.clock()||0),tick=Math.floor(time*F.STEPS);
    if(tick!==cachedTick||active!==cachedRevision){
      eventFrame=F.tick(active,tick);cachedTick=tick;cachedRevision=active;
    }
    const lamp=playing?eventFrame.step:-1;
    if(lamp!==lastLamp){lamps[lastLamp]?.classList.remove('on');lamps[lamp]?.classList.add('on');lastLamp=lamp;}
    const previewRoute=selected==='router'&&!patch&&!insert&&!playing?state.routes[previewStep]:null;
    scene.render({state:active.state,editState:state,revision:active,selected,previewStep,picked,previewRoute,steps,time,playing,tick:eventFrame});
    if(focusAfterZoom){
      const target=document.querySelector(focusAfterZoom);
      if(target?.getClientRects().length){target.focus({preventScroll:true});focusAfterZoom=null;}
    }
    raf=requestAnimationFrame(render);
  }
  $('preset').onchange=()=>{const id=$('preset').value;select(null);previewStep=0;updateState(presetState(id));};
  $('back-to-table').onclick=()=>select(null);$('cancel-mode').onclick=cancel;
  $('mount-part').onclick=()=>scene.setInsert(selected);
  $('bypass-part').onclick=()=>act({type:'bypass',node:selected});
  $('unplug').onclick=()=>{if(patch&&act({type:'disconnect',from:patch}))cancel();};
  $('undo').onclick=rewind;$('play').onclick=toggleAudio;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(patch||insert)cancel();else if(selected)select(null);}
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();rewind();}
  });
  const callbacks={select,act,notice,patchChanged,insertChanged,pickStep,touchCam,flipRoute,
    startPatch:key=>scene.setPatch(key),startInsert:id=>scene.setInsert(id),
    connect:(from,to)=>act({type:'connect',from,to}),disconnect:from=>act({type:'disconnect',from})};
  scene=IsoScene.mount($('board'),callbacks)||IsoFlat.mount($('board'),callbacks);
  const stop=()=>{audio?.pause();transportUI();};
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stop();cancelAnimationFrame(raf);raf=0;}else if(!raf)raf=requestAnimationFrame(render);
  });
  window.addEventListener('pagehide',stop);
  window.IsoBench=Object.freeze({inspect:()=>({state,selected,previewStep,patch,insert,geometry:scene.inspect(),playing:audio?.playing(),time:audio?.clock(),active:audio?.audible()})});
  refresh();transportUI();render();
  window.IsoAudio.create({onChange:transportUI,onError:err=>notice('Ошибка звука. '+(err?.message||err))})
    .then(engine=>{audio=engine;transportUI();}).catch(err=>notice('Не удалось загрузить звук. '+err.message));
})();
