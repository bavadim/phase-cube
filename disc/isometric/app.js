/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), F=window.IsoFlow, {names}=IsoPanel;
  const presets=['duet','straight','echo','answer'], storageKey='biba.note-conveyor.iso.v1';
  function presetState(id){
    const s=F.initial();
    if(id==='duet')return F.restore({...s,links:{'source:out':'router','router:straight':'keys','router:side':'bell'}});
    if(id==='straight')return F.restore({...s,links:{'source:out':'keys'}});
    if(id==='answer')return F.restore({...s,links:{'source:out':'copy','copy:out':'keys','copy:copy':'router','router:side':'bin','router:straight':'delay','delay:out':'bell'}});
    return s;
  }
  function signature(s){
    return JSON.stringify([s.source,s.routes,s.delay,Object.entries(s.links).sort()]);
  }
  const presetKeys=Object.fromEntries(presets.map(id=>[signature(presetState(id)),id]));
  let state=presetState('duet');
  try{const raw=localStorage.getItem(storageKey);if(raw)state=F.restore(JSON.parse(raw));}catch{/* A fresh bench is available if a save cannot be read. */}
  const firstStation=()=>Object.values(state.links).includes('router')?'router':'source';
  let revision=F.revision(state),scene,audio,panel,selected=firstStation(),patch=null,insert=null,previewStep=0,starting=false;
  let cachedRevision,cachedTick,eventFrame,lastLamp=-1,raf=0;
  const undo=[],lamps=Array.from({length:F.STEPS},()=>document.createElement('i'));
  $('beat').append(...lamps);
  function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
  function showPanel(){panel?.render({state,selected,patch,insert,previewStep});}
  function guide(){
    $('guidance').textContent=patch?'Выберите деталь, к которой пойдёт лента.':insert?'Коснитесь подсвеченной ленты, чтобы вставить деталь.':'Коснитесь детали на столе, чтобы открыть её управление.';
    $('cancel-mode').hidden=!(patch||insert);
    $('board').parentElement.dataset.mode=patch||insert?'edit':'overview';
  }
  function refresh(){
    $('preset').value=presetKeys[signature(state)]||'custom';$('undo').disabled=undo.length===0;
    $('part').value=selected;
    $('part-icon').replaceChildren(IsoPanel.icon(selected));
    guide();showPanel();
  }
  function updateState(next,remember=true){
    if(signature(state)===signature(next))return;
    if(remember){undo.push(state);if(undo.length>96)undo.shift();}
    state=next;revision=F.revision(next);audio?.queue(next);
    try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{/* Session edits remain usable. */}
    notice('');refresh();
  }
  function act(action){
    try{updateState(F.apply(state,action));return true;}catch(err){notice(err.message);return false;}
  }
  function patchChanged(key){patch=key;if(key)insert=null;guide();showPanel();}
  function insertChanged(node){insert=node;if(node)patch=null;guide();showPanel();}
  function cancel(){
    scene?.cancelMode?.();
    if(patch||insert){patch=null;insert=null;guide();showPanel();}
  }
  function startMode(kind,id){
    if(kind==='patch'){if(scene)scene.setPatch(id);else patchChanged(id);}
    else{if(scene)scene.setInsert(id);else insertChanged(id);}
    // When the inspector is under the canvas, bring valid drop targets back into reach.
    if(matchMedia('(max-width:850px)').matches)$('board').scrollIntoView({block:'nearest'});
  }
  function commit(action){const ok=act(action);if(ok)cancel();return ok;}
  function select(id){
    if(!Object.hasOwn(names,id))return;
    selected=id;notice('');refresh();
  }
  function rewind(){const previous=undo.pop();cancel();if(previous)updateState(previous,false);}
  function route(i){
    previewStep=i;
    if(act({type:'route',index:i})&&audio&&!audio.wanted()){
      audio.previewRoute(state,i).catch(err=>notice('Не удалось прослушать ноту. '+err.message));
    }
  }
  panel=IsoPanel.mount($('settings'),{act,cancel,
    route,
    startPatch:key=>startMode('patch',key),startInsert:id=>startMode('insert',id),
    connect:(from,to)=>commit({type:'connect',from,to}),disconnect:from=>commit({type:'disconnect',from}),
    install:(node,from)=>commit({type:'insert',node,from})
  });
  function transportUI(){
    const running=Boolean(audio?.wanted());
    $('play').disabled=!audio||starting;
    $('play').setAttribute('aria-pressed',String(running));
    $('play').querySelector('span').textContent=starting?'Запуск…':running?'Пауза':'Запустить';
  }
  async function toggleAudio(){
    if(!audio||starting)return;
    if(audio.wanted()){audio.pause();transportUI();return;}
    starting=true;transportUI();notice('');
    try{await audio.start(state);}catch(err){notice('Не удалось включить звук. '+err.message);}
    finally{starting=false;transportUI();}
  }
  function render(){
    raf=0;
    if(document.hidden)return;
    const playing=Boolean(audio?.playing()),active=(playing&&audio.audible())||revision;
    const time=Math.max(0,audio?.clock()||0),tick=Math.floor(time*F.STEPS);
    if(tick!==cachedTick||active!==cachedRevision){
      eventFrame=F.tick(active,tick);cachedTick=tick;cachedRevision=active;
    }
    const lamp=playing?eventFrame.step:-1;
    if(lamp!==lastLamp){lamps[lastLamp]?.classList.remove('on');lamps[lamp]?.classList.add('on');lastLamp=lamp;}
    const routePreview=!playing&&selected==='router'?state.routes[previewStep]:null;
    const index=selected==='source'&&playing?(eventFrame.step-active.state.source.phase+8)%8:lamp;
    panel.markStep(selected==='router'&&!playing?previewStep:index);
    scene?.render({state:active.state,editState:state,revision:active,selected,time,playing,tick:eventFrame,previewRoute:routePreview});
    raf=requestAnimationFrame(render);
  }
  Object.entries(names).forEach(([id,name])=>$('part').add(new Option(name,id)));
  $('part').onchange=()=>{const id=$('part').value;cancel();select(id);};
  $('preset').onchange=()=>{const id=$('preset').value;cancel();const next=presetState(id);selected=Object.values(next.links).includes('router')?'router':'source';previewStep=0;updateState(next);refresh();};
  $('cancel-mode').onclick=cancel;$('undo').onclick=rewind;$('play').onclick=toggleAudio;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape')cancel();
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();rewind();}
  });
  try{
    scene=window.IsoScene.mount($('board'),{select,act,notice,patchChanged,insertChanged,flipRoute:()=>route(previewStep),
      connect:(from,to)=>act({type:'connect',from,to}),disconnect:from=>act({type:'disconnect',from})});
  }catch(err){$('board').textContent='Модель требует WebGL. Все настройки доступны в панели деталей.';notice(err.message);}
  const stop=()=>{audio?.pause();transportUI();};
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stop();cancelAnimationFrame(raf);raf=0;}else if(!raf)raf=requestAnimationFrame(render);
  });
  window.addEventListener('pagehide',stop);
  window.IsoBench=Object.freeze({inspect:()=>({state,selected,patch,insert,geometry:scene?.inspect(),playing:audio?.playing(),time:audio?.clock(),active:audio?.audible()})});
  refresh();transportUI();render();
  window.IsoAudio.create({onChange:transportUI,onError:err=>notice('Ошибка звука. '+(err?.message||err))})
    .then(engine=>{audio=engine;transportUI();}).catch(err=>notice('Не удалось загрузить звук. '+err.message));
})();
