/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Free-play lifecycle. Scores, state, audio projection, view and DOM controls remain separate. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),S=strudel,params=new URLSearchParams(location.search);
  const library=new PuzzleCompositions.Loader(S),storagePrefix='biba.machine.v1.';
  const module={id:'machine',title:'Музыкальная машина',manifest:{schema:'mechanism/1',interaction:{requiresSelection:false,allowDeselect:false,hoverActions:false,buttonPreview:false}}};
  let prepared=null,model=null,engine=null,song=null,view=null,loading=true,starting=false,error=null,loadToken=0,previewState=null,previewTimer=null,queuedPreview=false;
  let activeSlot='a',slots={},catalog=[],saved=false,lastNotice='',analysisData=null,soundReady=null,desiredState=null,hovered=null;
  const transport=new PhaseCubeTransport(S,{outputGain:1,onChange:()=>update(),onError:fail});
  const stage=new PuzzleStage($('machine-stage'),{onIssue:message=>{transport.stop();notify(message);},onRestore:()=>update()});
  const controls=new MachineControls.Controls({select,toggle:()=>change(model.selected,{installed:!model.snapshot().parts.find(p=>p.key===model.selected).installed}),nextVariant:()=>nextVariant(model.selected)});
  const visibleState=()=>previewState||model?.snapshot();
  const heardState=()=>transport.active?.meta?.state||visibleState();
  function notify(text,isError=false){lastNotice=text;$('notice').textContent=text;$('notice').classList.toggle('error',isError);}
  function fail(e){error=String(e?.message||e);starting=false;console.error(e);notify(error,true);if(transport.want)transport.stop();update();}
  function readSave(kind,id=song?.id){try{return JSON.parse(localStorage.getItem(storagePrefix+kind+'.'+id)||'null');}catch{return null;}}
  function serialize(){return{schema:'mechanism-scene/1',version:1,songId:song.id,compositionVersion:song.version||1,state:model.snapshot(),slots,activeSlot,savedAt:new Date().toISOString()};}
  function persist(kind='auto'){try{localStorage.setItem(storagePrefix+kind+'.'+song.id,JSON.stringify(serialize()));return true;}catch{notify('Браузер не сохранил сборку. Кнопка «Файл» скачает её на устройство.',true);return false;}}
  function adopt(data){
    if(data?.schema!=='mechanism-scene/1'||data.version!==1||data.songId!==song.id)return false;
    const next=model.normalize(data.state),nextSlots={...slots};
    for(const k of ['a','b'])if(data.slots?.[k])nextSlots[k]=model.normalize(data.slots[k]);
    model.restore(next,{record:false});slots=nextSlots;
    activeSlot=['a','b'].includes(data.activeSlot)?data.activeSlot:'a';return true;
  }
  function update(){
    const disabled=loading||starting;
    $('play').disabled=disabled||!model;$('play-icon').textContent=transport.want?'Ⅱ':'▶';$('play-label').textContent=loading?'Загрузка':starting?'Запускаем':transport.want?'Пауза':'Слушать';
    $('song-select').disabled=loading||starting;
    if(!model)return;
    controls.update({model,state:visibleState(),rows:engine.rows(visibleState()),loading:disabled,playing:transport.running,pending:!!transport.pending,song,activeSlot,saved});
    stage.update(disabled);view?.feedback({selected:model.selected});
    instruction();
  }
  function instruction(){
    if(!model)return;
    const text=previewState?'Отпустите, чтобы оставить. Отмена вернёт прежнее звучание.':hovered?.kind==='variant'?'Картридж: повторное нажатие меняет музыкальную фразу.':hovered?.kind==='phase'?'Крутите ручку для сдвига. Повторное нажатие — один шаг.':'Корпус: потяните вверх для громкости. Повторное нажатие — снять / вставить.';
    $('scene-instruction').textContent=text;
  }
  function flushAudio(){
    if(!transport.running||!engine||!desiredState||transport.pending)return;
    if(JSON.stringify(desiredState.parts)===JSON.stringify(transport.active?.meta?.state?.parts))return;
    transport.queue(engine.pattern(desiredState),{state:desiredState});
  }
  function queue(){desiredState=visibleState();flushAudio();}
  function clearPreview(){clearTimeout(previewTimer);previewTimer=null;queuedPreview=false;previewState=null;}
  function select(key){if(loading||!model||!model.select(key))return;clearPreview();queue();update();}
  function nextVariant(key){const m=prepared.modules.find(m=>m.key===key),p=model.snapshot().parts.find(p=>p.key===key);if(m?.variants.length>1)change(key,{variant:(p.variant+1)%m.variants.length});}
  function hit(hit,event){
    if(loading||!hit?.key)return;
    if(!event||model.selected!==hit.key){select(hit.key);return;}
    const p=model.snapshot().parts.find(p=>p.key===hit.key);
    if(hit.kind==='variant')nextVariant(hit.key);
    else if(hit.kind==='phase')change(hit.key,{phase:p.phase+1/8});
    else change(hit.key,{installed:!p.installed});
  }
  function preview(key,patch){
    if(loading||!model)return;
    if(!patch){clearPreview();queue();update();return;}
    const raw=model.snapshot(),part=raw.parts.find(p=>p.key===key);if(!part)return;Object.assign(part,patch);previewState=model.normalize(raw);
    // Coalesce pointer events; they are an audition, one committed edit goes to undo.
    if(!queuedPreview){queuedPreview=true;previewTimer=setTimeout(()=>{queuedPreview=false;queue();},90);}
    update();
  }
  function change(key,patch){
    if(loading||!model)return false;clearPreview();model.select(key);const changed=model.set(key,patch);
    queue();persist();update();return changed;
  }
  function undo(){if(loading||!model)return;clearPreview();if(model.undo()){queue();persist();notify('Предыдущее звучание возвращено.');}update();}
  function recall(slot){if(loading||!model||!slots[slot])return;clearPreview();activeSlot=slot;model.restore(slots[slot]);queue();persist();notify('Вариант '+slot.toUpperCase()+'. Можно продолжать эксперимент.');update();}
  function saveSnapshot(){if(loading||!model)return;slots[activeSlot]=model.snapshot();persist();notify('Запомнили вариант '+activeSlot.toUpperCase()+'.');update();}
  function saveScene(){if(loading||!model)return;if(persist('saved')){saved=true;notify('Сборка сохранена в этом браузере. Кнопка «Файл» скачает копию.');}update();}
  function restoreScene(){if(loading||!model)return;const data=readSave('saved');if(!data)return;try{const before=model.snapshot();if(adopt(data)){const after=model.snapshot();model.restore(before,{record:false});model.restore(after);clearPreview();queue();persist();notify('Сохранённая сборка возвращена.');update();}}catch(e){notify('Не удалось прочитать сохранение: '+e.message,true);}}
  function exportScene(){
    if(loading||!model)return;const blob=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='night-shift-'+song.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Файл сборки сохранён. Это настройки машины, не запись аудио.');
  }
  async function importScene(file){
    if(!file||loading)return;
    try{
      if(file.size>100000)throw Error('Файл слишком большой для сборки машины.');
      const data=JSON.parse(await file.text());
      if(data?.schema!=='mechanism-scene/1'||data.version!==1||!catalog.some(s=>s.id===data.songId))throw Error('Это не поддерживаемая сборка машины.');
      if(data.songId!==song.id)await chooseSong(data.songId);
      if(song.id!==data.songId||error)throw Error('Не удалось открыть нужный музыкальный набор.');
      const before=model.snapshot();if(!adopt(data))throw Error('Не удалось прочитать сборку.');
      const after=model.snapshot();model.restore(before,{record:false});model.restore(after);clearPreview();queue();persist();notify('Сборка открыта. Можно продолжать играть.');update();
    }catch(e){notify(e.message||'Не удалось открыть файл.',true);}
    finally{$('scene-file').value='';}
  }
  async function togglePlayback(){
    if(loading||starting||!model)return;
    if(transport.want){await transport.stop();update();return;}
    starting=true;error=null;notify('');update();
    // start() resumes AudioContext synchronously in this trusted button gesture.
    try{await transport.start(()=>({pattern:engine.pattern(model.snapshot()),meta:{state:model.snapshot()}}),song.bpm,1,null,soundReady);}
    catch(e){fail(e);}finally{starting=false;update();}
  }
  async function chooseSong(id){
    const token=++loadToken;loading=true;clearPreview();desiredState=null;stage.pointer.cancel();update();notify('Готовим детали из композиции…');
    try{
      await transport.stop();if(token!==loadToken)return;
      const nextSong=await PuzzleAsync.wait(library.load(id),'Не удалось загрузить композицию.',20000);if(token!==loadToken)return;
      const next=MachineMusic.prepare(S,nextSong);prepared=next;song=nextSong;model=MachineModel.create(prepared.modules);engine=new MachineMusic.Engine(S,prepared);activeSlot='a';
      const initial=model.snapshot(),full=model.snapshot();full.parts.forEach(p=>{p.installed=prepared.modules.find(m=>m.key===p.key).available;});slots={a:initial,b:full};
      saved=!!readSave('saved');try{adopt(readSave('auto'));}catch{notify('Старое сохранение не подошло. Начинаем новую сборку.');}
      // Every voice belongs to a detachable module. The old transport may own
      // a backing bus, but its pattern is silence in this creative session.
      transport.setComposition({...song,backing:S.silence});
      controls.mount(prepared.modules);
      const viewModel={snapshot:visibleState,choices:()=>model.choices(),get selected(){return model.selected;}};
      view=stage.mount(MachineView.create,{module,model:viewModel,game:{modules:prepared.modules},binding:{},
        onSelect:hit,onHover:target=>{hovered=target;instruction();},onMove:move=>change(move.key,move.patch),onEditPreview:edit=>edit?preview(edit.key,edit.patch):preview(model.selected,null)});
      soundReady=PuzzleAsync.wait(PhaseCubeBank.preload(S,song.pattern,song.bars),'Не загрузились звуковые детали. Повторите выбор композиции.',30000);
      await soundReady;if(token!==loadToken)return;
      loading=false;error=null;desiredState=model.snapshot();$('song-select').value=song.id;$('song-title').textContent=song.title;$('song-tempo').textContent=song.bpm+' BPM';
      const url=new URL(location.href);url.searchParams.set('song',song.id);try{history.replaceState(null,'',url);}catch{}
      notify('Выберите деталь на машине. Все настройки — на ней самой.');update();
    }catch(e){if(token!==loadToken)return;loading=false;fail(e);}
  }
  function diagnostics(){
    let peak=0,rms=0;if(transport.analyser){analysisData??=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(analysisData);for(const v of analysisData){peak=Math.max(peak,Math.abs(v));rms+=v*v;}rms=Math.sqrt(rms/analysisData.length);}
    const rows=engine&&model?engine.rows(visibleState()):[];
    return{schema:'machine-poc/1',selected:model?.selected,historyLength:model?.history.length||0,loading,starting,pending:!!transport.pending,playing:transport.running,rms,peak,error,songId:song?.id,activeSlot,preview:!!previewState,
      projection:{events:rows.reduce((sum,row)=>sum+row.length,0),signature:JSON.stringify(rows.map(row=>row.map(e=>[e.start,e.duration,e.pitch,e.gain,e.value.s])))},
      music:engine&&model?engine.diagnostics(visibleState()):null,graphics:stage.info(),transport:transport.info()};
  }
  async function init(){
    const repl=await PuzzleAsync.wait(S.initStrudel({sync:false,miniAllStrings:true,setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window),prebake:()=>PhaseCubeBank.register(S),defaultOutput:(...args)=>transport.output(...args),onUpdateState:state=>{if(state.error)fail(state.error);}}),'Звуковой движок не загрузился.',15000);
    transport.attach(repl);catalog=await library.catalog();$('song-select').replaceChildren(...catalog.map(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.title;return o;}));
    await chooseSong(catalog.some(s=>s.id===params.get('song'))?params.get('song'):'turkish-circuit');
    S.getAudioContext().addEventListener('statechange',()=>{if(S.getAudioContext().state!=='running'&&transport.running){transport.stop();notify('Звук приостановлен браузером. Нажмите «Слушать».');}});
  }
  $('play').addEventListener('click',togglePlayback);$('undo').addEventListener('click',undo);$('song-select').addEventListener('change',e=>{chooseSong(e.target.value);$('library').close();});
  $('open-library').addEventListener('click',()=>$('library').showModal());
  $('snapshot-a').addEventListener('click',()=>{recall('a');$('library').close();});$('snapshot-b').addEventListener('click',()=>{recall('b');$('library').close();});$('save-snapshot').addEventListener('click',saveSnapshot);
  $('save-scene').addEventListener('click',saveScene);$('restore-scene').addEventListener('click',restoreScene);$('export-scene').addEventListener('click',exportScene);
  $('import-scene').addEventListener('click',()=>$('scene-file').click());$('scene-file').addEventListener('change',e=>importScene(e.target.files[0]));
  document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();togglePlayback();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&transport.running){transport.stop();notify('Машина на паузе. Ваша сборка сохранена.');}});
  window.addEventListener('pagehide',()=>{if(model)persist();transport.stop();});
  function frame(now){
    requestAnimationFrame(frame);transport.poll();flushAudio();
    if(view&&model){const position=transport.clock(),phase=((position/prepared.periodBars)%1+1)%1;view.updateMusic?.({position,phase,periodBars:prepared.periodBars,periodSeconds:prepared.periodBars*240/song.bpm,playing:transport.running,rows:engine.rows(heardState())});stage.dirty=true;$('clock-progress').style.width=(phase*100)+'%';}
    stage.frame(now);
  }
  window.machineApp={ready:null,state:()=>model?.snapshot(),diagnostics,select,change,chooseSong,undo,stage,transport,recall,saveSnapshot,saveScene,restoreScene};
  machineApp.ready=init().catch(e=>{loading=false;fail(e);});requestAnimationFrame(frame);
})();
