/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Session/audio orchestration only. Puzzle rules, views, controls and partitioning live in modules. */
(() => {
  'use strict';
  const C=PhaseCubeConfig,S=PhaseCubeSession,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),debug=params.has('debug'),build='music-puzzles/components5';
  const library=new PuzzleCompositions.Loader(strudel);
  const loader=new PuzzleSessionLoader.Loader(strudel,{library,palette:C.palette,registry:PuzzleRegistry,preload:PhaseCubeBank.preload});
  const mix=()=>({foundation:true,solo:-1,muted:[]});
  let module=PuzzleRegistry.get(params.get('puzzle')||C.defaultPuzzle),model=null,control=null,music=null,game=null,song=null,catalog=[];
  let session=S.initial(),seed=Number(params.get('seed'))||1730,loading=true,starting=false,busy=false,seeking=false,error=null,loadToken=0;
  let preparation=null,loadAbort=null,presentation=null,loadError=false,loadingMessage='Запускаем музыкальный движок…';
  let shuffle=null,shuffleAbort=null,playToken=0;
  let notice='',lastFrame=performance.now();
  const recorder=new PuzzleDiagnostics.Recorder({build,snapshot:reportSnapshot});
  let displayWindow=null,orbit=null,rows=[],repl,soundReady,analysisData,lastDiagnostics=0;
  const transport=new PhaseCubeTransport(strudel,{onChange:()=>updateUI(),onError:fail,outputGain:C.outputGain});
  const canMove=()=>!!model&&session.phase==='playing'&&transport.running&&!loading&&!starting&&!busy&&!seeking&&!transport.pending;
  const metadata=()=>({state:model.snapshot(),mode:'current',...mix()});
  const heardState=()=>transport.running&&transport.active?transport.active.meta.state:model.snapshot();
  const player=new PuzzlePlayer($('player-controls'),{onSeek:bar=>seekSong(bar).catch(fail),onUndo:()=>undo().catch(fail),
    onPause:()=>dispatch(session.phase==='playing'?'pause':'start').catch(fail),onHint:showHint});
  const dialogs=new PuzzleDialogs($('dialogs'),{onStart:()=>dispatch('start').catch(fail),onChoose:choice=>choose(choice).catch(fail),
    onRetry:()=>{if(loadError||!song)location.reload();else{error=null;dispatch('start').catch(fail);}},
    onAgain:()=>restart().catch(fail),onMenu:()=>choose().catch(fail),onReport:()=>recorder.share()});
  const celebration=PhaseCubeCelebration.create($('celebration'));
  function cancelOperation(){
    ++playToken;
    shuffleAbort?.abort();shuffleAbort=null;presentation?.stopTween('camera');presentation?.stopTween('move');presentation?.pointer.cancel();
  }
  const newShuffle=()=>({total:Math.max(1,Math.floor(module.shuffleSteps??C.scrambleLength)),moves:[],complete:false});
  const lockState=()=>({phase:session.phase,busy,starting,seeking,pending:!!transport.pending,context:strudel.getAudioContext().state});
  function stopSound(){try{return transport.stop().catch(e=>recorder.record('audio.stop-error',PuzzleDiagnostics.brief(e)));}catch(e){recorder.record('audio.stop-error',PuzzleDiagnostics.brief(e));return Promise.resolve();}}
  function pauseSession(message=''){
    recorder.record('session.pause',{message,before:lockState()});notice=message;cancelOperation();starting=false;busy=false;seeking=false;
    if(session.phase!=='won')session=S.transition(session,'pause');
    orbit?.cancel();updateUI();const stopped=stopSound();recorder.save();return stopped;
  }
  function fail(e){
    recorder.record('session.error',{...PuzzleDiagnostics.brief(e),before:lockState()});console.error(e);error=String(e.message||e);loading=false;
    pauseSession();
  }
  function clearHint(){control?.clearHint();}
  function updateRows(){
    if(!music||!model||!orbit)return;
    const state=heardState();rows=music.rows(state);
    const focus=control?.focusState(),forecast=canMove()?(focus?.point?music.preview(focus.point,state,rows,focus.move):focus?.move?music.predict(focus.move,state,rows):null):null;
    const cycle=transport.clock();displayWindow=music.displayWindow(cycle);
    if(forecast)forecast.rows=music.displayRows(forecast.rows,cycle);
    orbit.update({rows:music.displayRows(rows,cycle),target:music.displayRows(game.targetRows,cycle),phases:music.phases(state),pending:!!transport.pending,forecast,selectedKey:control?.selection()});
  }
  function updateUI(){
    let won=false;
    if(model&&music&&!loading&&!starting&&!busy&&!seeking&&session.phase==='playing'&&transport.running&&!transport.pending&&model.solved()){
      session=S.transition(session,'complete');won=true;
    }
    document.body.dataset.phase=session.phase;document.body.dataset.puzzle=module.id;
    if(model){const n=model.correct();$('correct-count').innerHTML=n+'<span>/'+model.count+'</span>';$('correct-count').setAttribute('aria-label',n+' из '+model.count+' '+(module.progressLabel||'деталей на месте').replace('\n',' '));}
    const progress=session.phase==='shuffling'?'Перемешиваем\n'+shuffle.moves.length+' / '+shuffle.total:module.progressLabel||'деталей\nна месте';
    if($('progress-label').innerText!==progress)$('progress-label').innerText=progress;
    control?.update(!canMove());
    player.update({disabled:!canMove(),canUndo:!!model?.history.length,canHint:!!model?.hint(),hinted:control?.focusState()?.source==='hint',phase:session.phase,
      busy:loading||starting||busy||seeking||!!transport.pending,song});
    dialogs.update({song,puzzleId:module.id,phase:session.phase,loading,starting,error,loadingMessage,notice,blocked:!!presentation?.contextLost});
    if(won)celebration.play();
    updateRows();
  }
  async function choose({songId=song?.id||C.defaultSong,puzzleId=module.id}={}){
    const token=++loadToken,nextModule=PuzzleRegistry.get(puzzleId);
    recorder.record('session.choose',{songId,puzzleId});cancelOperation();starting=false;busy=false;notice='';
    loadAbort?.abort();const controller=new AbortController();loadAbort=controller;
    loading=true;loadError=false;error=null;loadingMessage='Готовим композицию и головоломку…';session=S.initial();clearHint();updateUI();
    try{
      await transport.stop();const next=await PuzzleAsync.wait(loader.prepareSession({songId,puzzleId:nextModule.id,signal:controller.signal}),'Подготовка композиции не завершилась. Проверьте соединение и повторите загрузку.',30000);
      if(token!==loadToken)return;
      control?.destroy();preparation=next;module=next.module;model=next.model;game=next.fragments;song=next.composition;
      model.reset(seed++);shuffle=newShuffle();music=new PuzzleMusic.Music(strudel,next);transport.setComposition(song);
      $('orbit-score').replaceChildren();orbit=new PuzzleEqualizer.Score($('orbit-score'),game.voices,{periodBeats:song.timing.periodBeats,periodSeconds:song.periodBars*240/song.bpm});
      control=PuzzleControl.mount({module,createView:PuzzleViews.get(module.id),presentation,commands:player.commands,model,game,binding:next.binding,canInteract:canMove,
        onMove:move=>turn(move).catch(fail),onSelect:()=>{clearHint();updateUI();},onPreview:()=>{
          updateRows();player.hint.update(canMove()&&!!model?.hint(),control?.focusState()?.source==='hint');
        }});
      await PuzzleAsync.wait(control.ready,'Не загрузилось изображение головоломки. Повторите загрузку.',15000);
      if(token!==loadToken)return;
      celebration.clear();loading=false;updateUI();
      const url=new URL(location.href);url.searchParams.set('song',song.id);url.searchParams.set('puzzle',module.id);
      try{history.replaceState(null,'',url);}catch{}
    }catch(e){if(token!==loadToken||e.name==='AbortError')return;if(token===loadToken){controller.abort();loadError=true;loading=false;fail(e);}throw e;}
  }
  function makePattern(state=model.snapshot()){if(!music)throw new Error('Музыка ещё загружается');return music.pattern(state);}
  async function syncAudio(){
    if(!S.shouldPlay(session)){if(transport.want||transport.running)await transport.stop();return;}
    if(!transport.want)await transport.start(()=>({pattern:makePattern(),meta:metadata()}),song.bpm,C.volume,null,soundReady);
  }
  function updateAudio(){if(transport.running&&music)transport.queue(makePattern(),metadata());}
  async function awaitAudio(token){
    const deadline=performance.now()+4000;
    while(transport.pending&&token===playToken){
      if(strudel.getAudioContext().state!=='running'){pauseSession('Звук был прерван. Нажмите «Продолжить».');return false;}
      if(performance.now()>deadline)throw new Error('Звук не ответил. Сохраните отчёт об ошибке и попробуйте продолжить.');
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    return token===playToken;
  }
  async function demonstrateShuffle(level){
    const controller=new AbortController(),token=playToken;shuffleAbort=controller;
    recorder.record('shuffle.begin');
    const active=()=>!controller.signal.aborted&&shuffle===level&&session.phase==='shuffling'&&transport.running;
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    try{
      // Let the player see and hear the reference before the first operation.
      if(!level.moves.length)await wait(C.shufflePreviewMs);
      while(active()&&level.moves.length<level.total){
        const before=model.snapshot(),move=model.shuffle();
        recorder.record('shuffle.move',{move});
        level.moves.push(move);
        // shuffle() already advanced the model. Start the animation before any
        // UI sync, so the view keeps the previous geometry until the turn ends.
        const animation=control.animate(move,before,{demonstration:true,duration:C.shuffleMoveMs});
        updateUI();updateAudio();await animation;
        if(!active())return;
        await wait(C.shuffleHoldMs);
      }
      // Show three turns in about a second; do not wait for an audio quarter
      // after every visual step. The final mix must settle before unlocking.
      if(active()&&!await awaitAudio(token))return;
      if(active()){
        recorder.record('shuffle.complete');
        level.complete=true;clearHint();control.resetInteraction();
        session=S.transition(session,'shuffle-complete');
      }
    }finally{if(shuffleAbort===controller)shuffleAbort=null;}
  }
  async function dispatch(action){
    if(action==='pause')return pauseSession();
    if(loading||starting||busy)return;
    recorder.record('session.start',{before:lockState()});notice='';
    const token=++playToken,level=shuffle,demonstration=action==='start'&&!level.complete;
    starting=action==='start';busy=demonstration;session=S.transition(session,demonstration?'shuffle-start':action);clearHint();updateUI();
    try{
      // Keep AudioContext.resume() in the original trusted click stack.
      await syncAudio();
      if(token!==playToken)return;
      starting=false;updateUI();
      if(demonstration&&session.phase==='shuffling'&&transport.running)await demonstrateShuffle(level);
    }finally{if(token===playToken){starting=false;busy=false;updateUI();}}
    if(action==='start'&&session.phase==='playing')control?.focus();
  }
  async function perform(move,isUndo=false){
    if(!canMove()||(isUndo?!model.history.length:!model.validMove(move)))return;
    if(isUndo)move=model.inverse(model.history[model.history.length-1].move);
    const token=playToken,before=model.snapshot(),forecast=music.predict(move,before);
    recorder.record('move.begin',{move,isUndo,before});
    orbit.commit(music.displayRows(forecast.rows,transport.clock()));clearHint();model.select(model.moveTarget(move));busy=true;
    try{
      const animation=control?.animate(move,before);
      if(isUndo)model.undo();else model.apply(move);
      updateUI();updateAudio();await PuzzleAsync.wait(animation,'Анимация не завершилась. Сохраните отчёт об ошибке.',4000);
      if(!await awaitAudio(token))return;
      recorder.record('move.end',{move,state:model.snapshot()});
    }finally{if(token===playToken){busy=false;updateUI();}}
  }
  const turn=move=>perform(move),undo=()=>perform(null,true);
  function showHint(){
    if(!canMove())return;const move=model.hint();if(!move)return;
    control.hint(move);updateUI();
  }
  async function restart(){
    if(loading||busy||seeking||starting)return;
    cancelOperation();
    // stop() mutes synchronously; start() waits for its drain internally. Do not
    // await here and lose Safari's trusted activation on the replay button.
    transport.stop();transport.cursor=0;clearHint();orbit?.cancel();celebration.clear();
    model.reset(seed++);shuffle=newShuffle();control.resetInteraction();session=S.transition(session,'restart');updateUI();await dispatch('start');
  }
  async function seekSong(bar){
    if(!song||busy||seeking||starting||transport.pending||session.phase==='won')return;
    seeking=true;updateUI();const playing=transport.want,token=playToken;
    try{await transport.stop();if(token!==playToken)return;transport.cursor=Math.max(0,Math.min(song.bars-.25,bar));if(playing)await syncAudio();}
    finally{if(token===playToken){seeking=false;updateUI();}}
  }
  async function init(){
    presentation=new PuzzleStage($('puzzle-stage'),{log:(type,data)=>recorder.record(type,{...data,gate:lockState()}),onIssue:pauseSession,onRestore:updateUI});
    const ctx=strudel.getAudioContext();
    ctx.addEventListener('statechange',()=>{
      recorder.record('audio.state',{state:ctx.state,wanted:transport.want,starting});
      // seek/start can briefly want playback while resume() is still pending.
      // Only a context that had actually started is an unexpected interruption.
      if(ctx.state!=='running'&&transport.want&&transport.running)pauseSession('Звук был прерван. Нажмите «Продолжить».');
    });
    repl=await PuzzleAsync.wait(strudel.initStrudel({sync:false,miniAllStrings:true,setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window),
      prebake:()=>PhaseCubeBank.register(strudel),defaultOutput:(...args)=>transport.output(...args),onUpdateState:state=>{if(state.error)fail(state.error);}}),'Музыкальный движок не загрузился. Повторите загрузку.',15000);
    transport.attach(repl);loadingMessage='Загружаем список композиций…';updateUI();catalog=await PuzzleAsync.wait(library.catalog(),'Список композиций не загрузился. Проверьте соединение и повторите загрузку.',15000);dialogs.catalog(catalog,PuzzleRegistry.modules);
    const requested=params.get('song');await choose({songId:catalog.some(s=>s.id===requested)?requested:C.defaultSong,puzzleId:module.id});
  }
  function diagnostics(){
    let peak=0,rms=0;if(transport.analyser){analysisData??=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(analysisData);
      for(const v of analysisData){peak=Math.max(peak,Math.abs(v));rms+=v*v;}rms=Math.sqrt(rms/analysisData.length);}
    return {build,frameAgeMs:Math.round(performance.now()-lastFrame),graphics:presentation?.info(),puzzleId:module.id,pieceCount:model?.count,fragmentCount:game?.count,songId:song?.id,songTitle:song?.title,stats:song?.stats,songBars:song?.bars,localBars:song?.periodBars,
      shuffle:shuffle?{total:shuffle.total,moves:[...shuffle.moves],complete:shuffle.complete}:null,
      sessionPhase:session.phase,context:strudel.getAudioContext().state,playing:transport.running,loading,starting,busy,seeking,selectedFace:model?.selected,moves:model?.moves,
      hint:control?.focusState()?.source==='hint'?control.focusState().move:null,actionFocus:control?.focusState()||null,
      phases:model&&music?music.phases(model.snapshot()).map(p=>p.ticks??null):null,projection:preparation?.binding.algorithm,binding:preparation?{gridSteps:preparation.binding.gridSteps,...preparation.diagnostics}:null,...transport.info(),backingId:transport.backingId,volume:C.volume,masterGain:transport.master?.gain.value??0,
      peak,rms,error,changes:transport.changes,log:transport.log.slice(-30)};
  }
  function reportSnapshot(){
    const d=diagnostics();return{...d,moves:undefined,log:undefined,seed:seed-1,state:model?.snapshot(),playerMoveCount:model?.moves.length,playerMoves:model?.moves.slice(-128),
      audioEvents:transport.log.slice(-20),audioChanges:transport.changes.slice(-40)};
  }
  function tick(now){
    requestAnimationFrame(tick);lastFrame=now;
    try{
    transport.poll();
    presentation?.frame(now);
    if(song&&model&&orbit){
      const cycle=transport.clock(),phase=((cycle/song.periodBars)%1+1)%1;
      if(displayWindow!==music.displayWindow(cycle))updateRows();
      player.frame(((cycle%song.bars)+song.bars)%song.bars,song);
      orbit.frame(phase,transport.running,now);
      if(presentation?.active?.view.updateMusic?.({phase,position:cycle/song.periodBars,playing:transport.running,rows:music.rows(heardState()),periodSeconds:song.periodBars*240/song.bpm}))presentation.dirty=true;
    }
    if(debug&&performance.now()-lastDiagnostics>150){lastDiagnostics=performance.now();$('audio-diagnostics').textContent=JSON.stringify(diagnostics());}
    }catch(e){fail(e);}
  }
  window.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
    if(event.ctrlKey&&event.code==='KeyZ'){event.preventDefault();undo().catch(fail);return;}
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.code==='Space'&&!event.target.closest('button')){event.preventDefault();dispatch(session.phase==='playing'?'pause':'start').catch(fail);return;}
    if(canMove()&&control?.key(event))event.preventDefault();
  });
  document.addEventListener('visibilitychange',()=>{recorder.record('page.visibility',{value:document.visibilityState});if(document.hidden&&transport.want)pauseSession('Игра была свёрнута. Нажмите «Продолжить».');});
  window.addEventListener('pagehide',event=>{pauseSession();if(!event.persisted)presentation?.destroy();});
  soundReady=init();soundReady.catch(e=>{loadError=true;fail(e);});updateUI();requestAnimationFrame(tick);
  if(debug)window.phaseCubeApp={
    ready:soundReady,diagnostics,state:()=>model.snapshot(),phases:()=>music.phases(model.snapshot()),turn,undo,hint:showHint,getPreparation:()=>preparation,getPresentation:()=>presentation,getEqualizer:()=>orbit,
    report:()=>recorder.report(),
    getPuzzle:()=>model,getPuzzleModule:()=>module,getGame:()=>game,getMusic:()=>music,getSong:()=>song,getCatalog:()=>catalog,getTransport:()=>transport,getRepl:()=>repl,
    choose,chooseSong:id=>choose({songId:id}),choosePuzzle:id=>choose({puzzleId:id}),seekSong,makePattern,
    code:()=>music.code(model.snapshot()),getSourcePattern:id=>game.basePatterns[id],eventsOf:PuzzleMusic.eventsOf,
    sampleAudio:()=>{if(!transport.analyser)return null;const a=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(a);return Array.from(a);},
    reset:async()=>{const token=playToken;busy=true;model.restore(module.create().snapshot());updateAudio();await awaitAudio(token);if(token===playToken){busy=false;updateUI();}}
  };
})();
