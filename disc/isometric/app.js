/* SPDX-License-Identifier: AGPL-3.0-or-later */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),F=window.IsoFlow,L=window.IsoLayout;
  const names={source:'Нотный насос',copy:'Двойной дозатор',delay:'Камеры задержки',router:'Задвижка',keys:'Клавиши',bell:'Колокол',bin:'Слив'};
  const ports={out:'Выход',copy:'Копия',straight:'Прямо',side:'Вбок'};
  const pitchName=n=>n==null?'Пауза':['До','До♯','Ре','Ми♭','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Си♭','Си'][n%12];
  window.IsoWorkshopLabels=Object.freeze({names,ports,pitchName});
  const presets=['hydraulic','duet','straight','echo','answer'];
  const seed=new URLSearchParams(location.search).get('preset');
  const namedPreset=presets.includes(seed)?seed:null;
  const storageKey='biba.note-conveyor.iso.v1'+(namedPreset?'.'+namedPreset:'');
  function presetState(id){
    const s=F.initial();
    if(id==='hydraulic')return F.restore({...s,source:{...s.source,notes:[[60,64],null,67,null,64,null,[60,67],null]},
      links:{'source:out':'copy','copy:out':'keys','copy:copy':'delay','delay:out':'bell'}});
    if(id==='duet')return F.restore({...s,links:{'source:out':'router','router:straight':'keys','router:side':'bell'}});
    if(id==='straight')return F.restore({...s,links:{'source:out':'keys'}});
    if(id==='answer')return F.restore({...s,links:{'source:out':'copy','copy:out':'keys','copy:copy':'router','router:side':'bin','router:straight':'delay','delay:out':'bell'}});
    return s;
  }
  const signature=s=>JSON.stringify([s.source,s.routes,s.delay,Object.entries(s.links).sort()]);
  const presetKeys=Object.fromEntries(presets.map(id=>[signature(presetState(id)),id]));
  let state=presetState(namedPreset||'hydraulic'),layout=L.initial();
  try{
    const saved=localStorage.getItem(storageKey);
    if(saved){
      const raw=JSON.parse(saved);state=F.restore(raw);
      try{layout=L.restore(raw.layout);}catch{/* Recover the music even if its arrangement is damaged. */}
    }
  }catch{/* Keep the starting assembly if a save cannot be read. */}
  let revision=F.revision(state);
  // The second cycle includes notes that crossed the bar line in the delay.
  const stepFrames=()=>Array.from({length:F.STEPS},(_,i)=>F.tick(revision,F.STEPS+i));
  let steps=stepFrames(),scene,audio,selected=null,patch=null,starting=false;
  const previewStep=0;
  let paintPitch,dose=null,lastDoseCell=state.source.notes.find(cell=>cell!==null)??60;
  let cachedRevision,cachedTick,eventFrame,raf=0,focusAfterZoom=null;
  let lastMix='';
  const undo=[],menu=$('workbench-menu');
  function bindButton(id,perform){
    const button=$(id);
    let press=null,released=-Infinity;
    button.addEventListener('pointerdown',event=>{
      if(event.isPrimary&&event.button===0)press={id:event.pointerId,x:event.clientX,y:event.clientY};
    });
    button.addEventListener('pointerup',event=>{
      const start=press;press=null;
      if(!start||start.id!==event.pointerId)return;
      released=performance.now();
      if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>14||button.disabled)return;
      event.preventDefault();perform();
    });
    button.addEventListener('pointercancel',()=>{press=null;});
    // Mobile browsers may omit click after a captured drag. Native keyboard
    // activation still comes through click; pointer release is handled above.
    button.addEventListener('click',event=>{
      if(!event.pointerType&&event.detail===0&&performance.now()-released>350)perform();
    });
  }
  function notice(text){$('notice').textContent=text;$('notice').hidden=!text;}
  function refresh(){
    const mode=!!patch,focused=!!selected&&!mode;
    $('back-to-table').hidden=!focused;
    $('return-to-shop').hidden=focused||mode;
    $('assembly').hidden=focused||mode;
    menu.hidden=mode||focused;
    if(menu.hidden)menu.open=false;
    $('cancel-mode').hidden=!mode;$('unplug').hidden=!(patch&&state.links[patch]);
    $('preset').value=presetKeys[signature(state)]||'custom';
    $('undo').disabled=!undo.length;$('undo').hidden=!undo.length||mode;
    const board=$('board');board.parentElement.dataset.mode=mode?'mount':focused?'focus':'overview';
    if(patch){
      const [id,port]=patch.split(':');
      $('status').textContent=names[id]+' · '+ports[port]+'. Коснитесь входа, чтобы подключить шланг.';
    }else{$('status').textContent=focused?names[selected]:'Весь стол';}
  }
  function save(){
    try{localStorage.setItem(storageKey,JSON.stringify({...state,layout}));}catch{/* Keep session edits when storage is unavailable. */}
  }
  function remember(){undo.push({state,layout});if(undo.length>96)undo.shift();}
  function updateState(next,record=true){
    if(signature(state)===signature(next))return;
    stopDose();
    if(record)remember();
    state=next;revision=F.revision(next);steps=stepFrames();audio?.queue(next);
    save();
    notice('');refresh();
  }
  function movePart(action){
    try{
      const next=L.move(layout,action);
      if(next===layout)return true;
      remember();layout=next;save();notice('');refresh();return true;
    }catch(error){notice(error.message);return false;}
  }
  function playPreview(request){
    if(audio&&!audio.wanted())request(audio).catch(err=>notice('Не удалось прослушать ноту. '+err.message));
  }
  function act(action){
    try{
      if(action.type==='note'&&selected==='source'&&paintPitch!==undefined&&!Object.hasOwn(action,'value')){
        action={...action,type:'pour',value:paintPitch};
      }
      updateState(F.apply(state,action));
      if(action.type==='note'||action.type==='pour'){
        const cell=state.source.notes[action.index];
        if(cell!==null)lastDoseCell=cell;
        playPreview(engine=>engine.previewPin(state,action.index));
      }
      return true;
    }catch(err){notice(err.message);return false;}
  }
  function choosePitch(pitch){
    if(selected!=='source'||!F.PALETTE.includes(pitch))return;
    paintPitch=pitch;$('status').textContent=pitch===null?'Пауза':pitchName(pitch);
    playPreview(engine=>engine.previewPitch(pitch));
  }
  function stopDose(){if(dose){dose=null;audio?.stopPreview();}}
  function testDose(station){
    if(station!==selected||!['copy','delay'].includes(station)||audio?.wanted())return;
    stopDose();
    const rev=F.testDose(state,station,lastDoseCell),start=performance.now();
    const probe={revision:rev,station,pitches:rev.dose.pitches,pitch:rev.dose.pitches[0],delay:state.delay,
      clock:()=>(performance.now()-start)/1000/(audio?.stepSeconds||30/IsoAudio.BPM)};
    dose=probe;
    playPreview(engine=>engine.previewDose(rev,clock=>{if(dose===probe)probe.clock=clock;}));
  }
  function localDoseFrame(){
    if(!dose)return null;
    const age=dose.clock(),step=Math.floor(age);
    if(step>F.MAX_DELAY){dose=null;return null;}
    if(dose.step!==step){dose.step=step;dose.tick=F.tick(dose.revision,step);}
    return {...dose,age,progress:age-step};
  }
  function patchChanged(key){patch=key;if(key)stopDose();refresh();}
  function cancel(){scene?.cancelMode();}
  function select(id){
    if(id!==null&&!F.EDITABLE.includes(id))return;
    const old=selected,keyboard=document.activeElement?.matches(':focus-visible');
    cancel();selected=id;menu.open=false;
    if(old!==id){paintPitch=undefined;stopDose();}
    notice('');refresh();
    focusAfterZoom=keyboard&&old!==id?(id?'#back-to-table':'#board [data-station="'+old+'"]'):null;
  }
  function rewind(){
    const previous=undo.pop();cancel();
    if(previous){layout=previous.layout;updateState(previous.state,false);save();refresh();}
  }
  function chooseRoutePreset(index){
    if(selected!=='router')return;
    if(act({type:'route-preset',index}))playPreview(engine=>engine.previewLoop(state));
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
    stopDose();starting=true;transportUI();notice('');
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
    const previewRoute=selected==='router'&&!patch&&!playing?state.routes[previewStep]:null;
    const mix=[...new Set(audio?.soundingPitches(active,time*F.STEPS,playing)??[])].sort((a,b)=>a-b);
    if(mix.join()!==lastMix){
      lastMix=mix.join();
      const glass=$('mix-glass');glass.dataset.pitches=lastMix;
      const bands=mix.map((p,i)=>IsoPieces.noteColor(p)+' '+(100*i/mix.length)+'% '+(100*(i+1)/mix.length)+'%');
      glass.style.setProperty('--liquid',mix.length?'linear-gradient(to right,'+bands.join(',')+')':'transparent');
    }
    scene.render({state:active.state,editState:state,layout,revision:active,selected,paintPitch,previewStep,previewRoute,steps,time,playing,tick:eventFrame,testFluid:localDoseFrame()});
    if(focusAfterZoom){
      const target=document.querySelector(focusAfterZoom);
      if(target?.getClientRects().length){target.focus({preventScroll:true});focusAfterZoom=null;}
    }
    raf=requestAnimationFrame(render);
  }
  $('preset').onchange=()=>{const id=$('preset').value;select(null);updateState(presetState(id));};
  bindButton('back-to-table',()=>select(null));bindButton('cancel-mode',cancel);
  bindButton('unplug',()=>{if(patch&&act({type:'disconnect',from:patch}))cancel();});
  bindButton('undo',rewind);bindButton('play',toggleAudio);
  document.addEventListener('pointerdown',e=>{if(menu.open&&!menu.contains(e.target))menu.open=false;});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(menu.open){menu.open=false;menu.querySelector('summary').focus();e.preventDefault();}
      else{cancel();if(selected)select(null);}
    }
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'){e.preventDefault();rewind();}
  });
  const callbacks={select,act,movePart,choosePitch,testDose,chooseRoutePreset,notice,patchChanged,
    startPatch:key=>scene.setPatch(key),
    connect:(from,to)=>act({type:'connect',from,to}),disconnect:from=>act({type:'disconnect',from})};
  scene=IsoScene.mount($('board'),callbacks)||IsoFlat.mount($('board'),callbacks);
  const stop=()=>{stopDose();audio?.pause();transportUI();};
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){stop();cancelAnimationFrame(raf);raf=0;}else if(!raf)raf=requestAnimationFrame(render);
  });
  window.addEventListener('pagehide',stop);
  window.IsoBench=Object.freeze({inspect:()=>({state,layout,selected,previewStep,patch,geometry:scene.inspect(),playing:audio?.playing(),time:audio?.clock(),active:audio?.audible()})});
  refresh();transportUI();render();
  window.IsoAudio.create({onChange:transportUI,onError:err=>notice('Ошибка звука. '+(err?.message||err))})
    .then(engine=>{audio=engine;transportUI();}).catch(err=>notice('Не удалось загрузить звук. '+err.message));
})();
