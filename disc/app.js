/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* The application owns transport/lifecycle; the model, native music and view are independent. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),S=strudel,storage='biba.disc.v1.';
  const library=new PuzzleCompositions.Loader(S),controls=new DiscControls();
  const module={id:'disc',title:'Музыкальный диск',manifest:{schema:'mechanism/1',interaction:{requiresSelection:false,allowDeselect:false,hoverActions:false,buttonPreview:false}}};
  let prepared,model,engine,song,view,soundReady,previewState=null,desiredState=null;
  let loading=true,starting=false,error=null,slots={},activeSlot='a',saved=false,lastClock=null;
  let analysisData=null,previewTimer=null;
  const transport=new PhaseCubeTransport(S,{outputGain:1,onChange:update,onError:fail});
  const stage=new PuzzleStage($('disc-stage'),{onIssue:message=>{transport.stop();notice(message,true);},onRestore:update});
  const visibleState=()=>previewState||model?.snapshot();
  const heardState=()=>transport.running?(transport.active?.meta?.state||visibleState()):visibleState();
  const sameParts=(a,b)=>JSON.stringify(a?.parts)===JSON.stringify(b?.parts);

  function notice(text='',bad=false){$('notice').textContent=text;$('notice').classList.toggle('error',bad);}
  function fail(e){error=String(e?.message||e);starting=false;console.error(e);notice(error,true);if(transport.want)transport.stop();update();}
  function update(){
    controls.update({loading,starting,playing:transport.want,model,activeSlot,saved});
    stage.update(loading||starting||!model);
    if(!model)return;
    const part=visibleState().parts.find(p=>p.key===model.selected),definition=prepared.modules.find(m=>m.key===part.key);
    $('part-name').textContent=definition.name+' · '+Math.round(part.gain*100)+'%'+(part.installed?'':' · выключено');
    $('part-name').style.color=definition.color;
    view?.feedback({selected:model.selected});
  }
  function flushAudio(){
    if(!transport.running||!desiredState||transport.pending||sameParts(desiredState,transport.active?.meta?.state))return;
    transport.queue(engine.pattern(desiredState),{state:desiredState});
  }
  function queue(){desiredState=visibleState();flushAudio();}
  function clearPreview(){clearTimeout(previewTimer);previewTimer=null;previewState=null;}
  function select(key){if(loading||!model?.select(key))return;update();}
  function change(key,patch){
    if(loading||!model)return false;
    clearPreview();model.select(key);const changed=model.set(key,patch);
    queue();persist();update();return changed;
  }
  function hit(target){
    if(loading||!target?.key)return;
    select(target.key);if(target.selectOnly)return;
    const p=model.snapshot().parts.find(p=>p.key===target.key);
    if(target.kind==='toggle')change(p.key,{installed:!p.installed});
    if(target.kind==='variant'){
      const variants=prepared.modules.find(m=>m.key===p.key).variants;
      change(p.key,{variant:(p.variant+1)%variants.length});
    }
  }
  function preview(edit){
    if(loading||!model)return;
    // endDrag clears preview before Pointer delivers the committed move. Let
    // that move win before queuing audio, otherwise release briefly replays
    // the pre-gesture state. A cancelled drag still restores it here.
    if(!edit){clearPreview();queueMicrotask(()=>{queue();update();});return;}
    const next=model.snapshot(),p=next.parts.find(p=>p.key===edit.key);if(!p)return;
    Object.assign(p,edit.patch);previewState=model.normalize(next,{snap:false});
    if(!previewTimer)previewTimer=setTimeout(()=>{previewTimer=null;queue();},55);
    update();
  }
  function cancelGesture(){stage.pointer.cancel();clearPreview();}
  function undo(){if(!model||loading)return;cancelGesture();if(model.undo()){queue();persist();notice();}update();}
  async function togglePlayback(){
    if(loading||starting||!model)return;
    if(transport.want){cancelGesture();await transport.stop();update();return;}
    starting=true;error=null;notice();update();
    try{await transport.start(()=>({pattern:engine.pattern(model.snapshot()),meta:{state:model.snapshot()}}),song.bpm,1,null,soundReady);}
    catch(e){fail(e);}finally{starting=false;desiredState=model.snapshot();update();}
  }
  function read(kind){try{return JSON.parse(localStorage.getItem(storage+kind)||'null');}catch{return null;}}
  function serialize(){return{schema:'disc-scene/1',version:1,songId:song.id,state:model.snapshot(),slots,activeSlot};}
  function persist(kind='auto'){
    try{localStorage.setItem(storage+kind,JSON.stringify(serialize()));return true;}
    catch{notice('Не удалось сохранить в браузере. Можно скачать сборку через меню.',true);return false;}
  }
  function adopt(data,{record=true}={}){
    if(data?.schema!=='disc-scene/1'||data.version!==1||data.songId!==song.id)throw Error('Это не сборка музыкального диска.');
    const next=model.normalize(data.state),nextSlots={...slots};
    for(const key of ['a','b'])if(data.slots?.[key])nextSlots[key]=model.normalize(data.slots[key]);
    cancelGesture();model.restore(next,{record});slots=nextSlots;activeSlot=data.activeSlot==='b'?'b':'a';
    queue();update();
  }
  function recall(slot){if(!model||loading)return;cancelGesture();activeSlot=slot;model.restore(slots[slot]);queue();persist();update();}
  function saveSnapshot(){if(!model)return;slots[activeSlot]=model.snapshot();persist();notice('Вариант '+activeSlot.toUpperCase()+' запомнен.');update();}
  function saveScene(){if(model&&persist('saved')){saved=true;notice('Сборка сохранена.');update();}}
  function restoreScene(){try{const data=read('saved');if(data){adopt(data);persist();notice('Сохранённая сборка возвращена.');}}catch(e){notice(e.message,true);}}
  function exportScene(){
    const blob=new Blob([JSON.stringify(serialize(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='music-disc.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importScene(file){
    if(!file)return;
    try{if(file.size>100000)throw Error('Слишком большой файл сборки.');adopt(JSON.parse(await file.text()));persist();notice('Сборка открыта.');}
    catch(e){notice(e.message,true);}finally{$('scene-file').value='';}
  }
  function diagnostics(){
    let peak=0,rms=0;
    if(transport.analyser){analysisData??=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(analysisData);for(const v of analysisData){peak=Math.max(peak,Math.abs(v));rms+=v*v;}rms=Math.sqrt(rms/analysisData.length);}
    const rows=engine&&model?engine.rows(heardState()):[];
    return{schema:'disc-poc/1',selected:model?.selected,loading,starting,playing:transport.running,pending:!!transport.pending,error,historyLength:model?.history.length||0,preview:!!previewState,activeSlot,songId:song?.id,rms,peak,
      audioCycle:transport.clock(),visualCycle:lastClock?.position,
      projection:{events:rows.flat().filter(e=>e.audible!==false&&e.gain!==0).length,signature:JSON.stringify(rows.map(r=>r.map(e=>[e.start,e.duration,e.pitch,e.gain,e.value.s,e.audible])))},
      music:model?engine.diagnostics(heardState()):null,graphics:stage.info(),transport:transport.info(),view:view?.inspect?.()||null};
  }
  async function init(){
    const repl=await PuzzleAsync.wait(S.initStrudel({sync:false,miniAllStrings:true,setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window),prebake:()=>PhaseCubeBank.register(S),defaultOutput:(...args)=>transport.output(...args),onUpdateState:state=>{if(state.error)fail(state.error);}}),'Звуковой движок не загрузился.',15000);
    transport.attach(repl);
    song=await PuzzleAsync.wait(library.load('turkish-circuit'),'Не удалось загрузить мелодию.',20000);
    prepared=DiscMusic.prepare(S,song);model=DiscModel.create(prepared.modules,{phaseSteps:prepared.phaseSteps});engine=new DiscMusic.Engine(S,prepared);
    slots={a:model.snapshot(),b:model.snapshot()};saved=!!read('saved');
    const previous=read('auto');if(previous)try{adopt(previous,{record:false});}catch{notice('Начинаем новую сборку.');}
    transport.setComposition({...song,backing:S.silence});
    const viewModel={snapshot:visibleState,choices:()=>model.choices(),get selected(){return model.selected;}};
    view=stage.mount(DiscView.create,{module,model:viewModel,game:prepared,binding:{},onSelect:hit,onHover:()=>{},onMove:move=>change(move.key,move.patch),onEditPreview:preview});
    const palette=S.stack(...prepared.modules.flatMap(m=>m.variants.map(v=>v.pattern)));
    soundReady=PuzzleAsync.wait(PhaseCubeBank.preload(S,palette,prepared.periodBars),'Не загрузились звуки. Перезагрузите страницу.',30000);
    await soundReady;loading=false;desiredState=model.snapshot();$('song-title').textContent=song.title;$('song-tempo').textContent=song.bpm+' BPM';update();
    S.getAudioContext().addEventListener('statechange',()=>{if(S.getAudioContext().state!=='running'&&transport.running){cancelGesture();transport.stop();notice('Звук на паузе. Нажмите «Слушать».');}});
  }
  $('play').addEventListener('click',togglePlayback);$('undo').addEventListener('click',undo);
  $('open-library').addEventListener('click',()=>{cancelGesture();$('library').showModal();});
  for(const key of ['a','b'])$('snapshot-'+key).addEventListener('click',()=>{recall(key);$('library').close();});
  $('save-snapshot').addEventListener('click',saveSnapshot);$('save-scene').addEventListener('click',saveScene);$('restore-scene').addEventListener('click',restoreScene);
  $('export-scene').addEventListener('click',exportScene);$('import-scene').addEventListener('click',()=>$('scene-file').click());$('scene-file').addEventListener('change',e=>importScene(e.target.files[0]));
  document.addEventListener('keydown',e=>{
    if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||$('library').open)return;
    if(e.code==='Space'){e.preventDefault();togglePlayback();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}
    else if(e.code==='Escape')cancelGesture();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&transport.running){cancelGesture();transport.stop();notice('Диск на паузе.');}});
  window.addEventListener('pagehide',()=>{if(model)persist();transport.stop();});
  function frame(now){
    requestAnimationFrame(frame);transport.poll();flushAudio();
    if(view&&model){
      const position=transport.clock(),state=heardState();
      lastClock={position,phase:((position/prepared.periodBars)%1+1)%1,periodBars:prepared.periodBars,periodSeconds:prepared.periodBars*240/song.bpm,playing:transport.running,rows:engine.rows(state),state};
      (view.clock||view.updateMusic)?.(lastClock);stage.dirty=true;
    }
    stage.frame(now);
  }
  window.discTest={ready:null,state:()=>model?.snapshot(),diagnostics,locations:()=>stage.locations(),select,change,undo,stage,transport,recall,saveSnapshot,saveScene,restoreScene,
    rows:()=>engine?.rows(heardState()),serialize,adopt,view:()=>view?.inspect?.(),clock:()=>lastClock,
    ringPath:(key,steps=64)=>(view?.ringPath?.(key,steps)||[]).map(point=>stage.project(point))};
  discTest.ready=init().catch(e=>{loading=false;fail(e);});requestAnimationFrame(frame);
})();
