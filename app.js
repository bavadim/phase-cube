/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Session/audio orchestration only. Puzzle rules, views, controls and partitioning live in modules. */
(() => {
  'use strict';
  const C=PhaseCubeConfig,S=PhaseCubeSession,$=id=>document.getElementById(id),params=new URLSearchParams(location.search),debug=params.has('debug');
  const library=new PhaseCubeLibrary.Loader(strudel);
  const loader=new PuzzleSessionLoader.Loader(strudel,{library,palette:C.palette,registry:PuzzleRegistry,preload:PhaseCubeBank.preload});
  const mix=()=>({foundation:true,solo:-1,muted:[]});
  let module=PuzzleRegistry.get(params.get('puzzle')||C.defaultPuzzle),model=null,control=null,music=null,game=null,song=null,catalog=[];
  let session=S.initial(),seed=Number(params.get('seed'))||1730,loading=true,starting=false,busy=false,seeking=false,error=null,loadToken=0;
  let preparation=null,loadAbort=null;
  let orbit=null,rows=[],preview=null,hintMove=null,affected=[],pulseTimer,repl,soundReady,analysisData,lastDiagnostics=0;
  const transport=new PhaseCubeTransport(strudel,{onChange:()=>updateUI(),onError:fail,outputGain:C.outputGain});
  const canMove=()=>!!model&&session.phase==='playing'&&transport.running&&!loading&&!starting&&!busy&&!seeking&&!transport.pending;
  const metadata=()=>({state:model.snapshot(),mode:'current',...mix()});
  const heardState=()=>transport.running&&transport.active?transport.active.meta.state:model.snapshot();
  const player=new PuzzlePlayer($('player-controls'),{onSeek:bar=>seekSong(bar).catch(fail),onUndo:()=>undo().catch(fail),
    onPause:()=>dispatch(session.phase==='playing'?'pause':'start').catch(fail),onHint:showHint});
  const dialogs=new PuzzleDialogs($('dialogs'),{onStart:()=>dispatch('start').catch(fail),onChoose:choice=>choose(choice).catch(fail),
    onAgain:()=>restart().catch(fail),onMenu:async()=>{await transport.stop();session=S.initial();celebration.clear();updateUI();}});
  const celebration=PhaseCubeCelebration.create($('celebration'));
  function fail(e){console.error(e);error=String(e.message||e);starting=false;session=S.transition(session,'pause');updateUI();}
  function clearHint(){hintMove=null;preview=null;control?.clearHint();}
  function updateRows(){
    if(!music||!model||!orbit)return;
    const state=heardState();rows=music.rows(state);
    const forecast=preview&&canMove()?music.predict(preview,state,rows):null;
    orbit.update({rows,target:game.targetRows,phases:music.phases(state),selected:-1,muted:[],solo:-1,mode:'current',showTarget:true,pending:!!transport.pending,forecast,affected});
  }
  function updateUI(){
    let won=false;
    if(model&&music&&!loading&&!starting&&!busy&&!seeking&&session.phase==='playing'&&transport.running&&!transport.pending&&model.solved()){
      session=S.transition(session,'complete');won=true;
    }
    document.body.dataset.phase=session.phase;document.body.dataset.puzzle=module.id;
    if(model){const n=model.correct();$('correct-count').innerHTML=n+'<span>/'+model.count+'</span>';$('correct-count').setAttribute('aria-label',n+' из '+model.count+' деталей на месте');}
    control?.update(!canMove());
    player.update({disabled:!canMove(),canUndo:!!model?.history.length,canHint:!!model?.hint(),hinted:hintMove,phase:session.phase,
      busy:loading||starting||busy||seeking||!!transport.pending,song});
    dialogs.update({song,puzzleId:module.id,phase:session.phase,loading,starting,error});
    if(won)celebration.play();
    updateRows();
  }
  async function choose({songId=song?.id||C.defaultSong,puzzleId=module.id}={}){
    const token=++loadToken,nextModule=PuzzleRegistry.get(puzzleId);
    loadAbort?.abort();const controller=new AbortController();loadAbort=controller;
    loading=true;error=null;session=S.initial();clearHint();updateUI();
    try{
      await transport.stop();const next=await loader.prepareSession({songId,puzzleId:nextModule.id,signal:controller.signal});
      if(token!==loadToken)return;
      control?.destroy();preparation=next;module=next.module;model=next.model;game=next.fragments;song=next.composition;
      model.reset(seed++,C.scrambleLength);music=new PuzzleMusic.Music(strudel,next);transport.setComposition(song);
      $('orbit-score').replaceChildren();orbit=new PuzzleEqualizer.Score($('orbit-score'),game.voices,{gridSteps:next.phaseMap.gridSteps,periodBeats:song.timing.periodBeats});
      control=module.mount({stage:$('puzzle-stage'),commands:player.commands,model,game,canInteract:canMove,
        onMove:move=>turn(move).catch(fail),onSelect:()=>{clearHint();updateUI();},onPreview:move=>{preview=move;updateRows();}});
      celebration.clear();loading=false;affected=[];updateUI();
      const url=new URL(location.href);url.searchParams.set('song',song.id);url.searchParams.set('puzzle',module.id);
      try{history.replaceState(null,'',url);}catch{}
    }catch(e){if(token!==loadToken||e.name==='AbortError')return;if(token===loadToken){loading=false;fail(e);}throw e;}
  }
  function makePattern(state=model.snapshot()){if(!music)throw new Error('Музыка ещё загружается');return music.pattern(state);}
  async function syncAudio(){
    if(!S.shouldPlay(session)){if(transport.want||transport.running)await transport.stop();return;}
    if(!transport.want)await transport.start(()=>({pattern:makePattern(),meta:metadata()}),song.bpm,C.volume,null,soundReady);
  }
  function updateAudio(){if(transport.running&&music)transport.queue(makePattern(),metadata());}
  async function dispatch(action){
    starting=action==='start';session=S.transition(session,action);clearHint();updateUI();
    try{await syncAudio();}finally{starting=false;updateUI();}
    if(action==='start'&&session.phase==='playing')control?.focus();
  }
  function pulse(ids){clearTimeout(pulseTimer);affected=ids;updateRows();pulseTimer=setTimeout(()=>{affected=[];updateRows();},650);}
  async function perform(move,isUndo=false){
    if(!canMove()||(isUndo?!model.history.length:!model.validMove(move)))return;
    if(isUndo)move=model.inverse(model.history[model.history.length-1].move);
    const before=model.snapshot(),changes=music.predict(move,before).changed;
    clearHint();model.select(move[0]);busy=true;affected=changes;
    try{
      const animation=control?.animate(move,before);
      if(isUndo)model.undo();else model.apply(move);
      updateUI();updateAudio();await animation;
      while(transport.pending)await new Promise(requestAnimationFrame);
      pulse(changes);
    }finally{busy=false;updateUI();}
  }
  const turn=move=>perform(move),undo=()=>perform(null,true);
  function showHint(){
    if(!canMove())return;const move=model.hint();if(!move)return;
    hintMove=move;control.hint(move);preview=move;updateUI();
  }
  async function restart(){
    if(loading||busy||seeking||starting)return;
    busy=true;
    await transport.stop();transport.cursor=0;clearHint();celebration.clear();clearTimeout(pulseTimer);affected=[];
    model.reset(seed++,C.scrambleLength);session=S.transition(session,'restart');busy=false;updateUI();await dispatch('start');
  }
  async function seekSong(bar){
    if(!song||busy||seeking||starting||transport.pending||session.phase==='won')return;
    seeking=true;updateUI();const playing=transport.want;
    try{await transport.stop();transport.cursor=Math.max(0,Math.min(song.bars-.25,bar));if(playing)await syncAudio();}
    finally{seeking=false;updateUI();}
  }
  async function init(){
    repl=await strudel.initStrudel({sync:false,miniAllStrings:true,setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window),
      prebake:()=>PhaseCubeBank.register(strudel),defaultOutput:(...args)=>transport.output(...args),onUpdateState:state=>{if(state.error)fail(state.error);}});
    transport.attach(repl);catalog=await library.catalog();dialogs.catalog(catalog,PuzzleRegistry.modules);
    const requested=params.get('song');await choose({songId:catalog.some(s=>s.id===requested)?requested:C.defaultSong,puzzleId:module.id});
  }
  function diagnostics(){
    let peak=0,rms=0;if(transport.analyser){analysisData??=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(analysisData);
      for(const v of analysisData){peak=Math.max(peak,Math.abs(v));rms+=v*v;}rms=Math.sqrt(rms/analysisData.length);}
    return {build:'music-puzzles/contracts1',puzzleId:module.id,pieceCount:model?.count,songId:song?.id,songTitle:song?.title,stats:song?.stats,songBars:song?.bars,localBars:song?.periodBars,
      sessionPhase:session.phase,context:strudel.getAudioContext().state,playing:transport.running,loading,starting,busy,seeking,selectedFace:model?.selected,moves:model?.moves,hint:hintMove,
      phases:model&&music?music.phases(model.snapshot()).map(p=>p.ticks):null,phaseMap:preparation?{gridSteps:preparation.phaseMap.gridSteps,...preparation.diagnostics}:null,...transport.info(),backingId:transport.backingId,volume:C.volume,masterGain:transport.master?.gain.value??0,
      peak,rms,error,changes:transport.changes,log:transport.log.slice(-30)};
  }
  function tick(){
    transport.poll();
    if(song&&model&&orbit){
      const cycle=transport.clock(),phase=((cycle/song.periodBars)%1+1)%1;
      player.frame(((cycle%song.bars)+song.bars)%song.bars,song);
      const hits=game.voices.map((v,id)=>transport.running&&(rows[id]||[]).some(e=>(phase-e.start+1)%1<.045));orbit.frame(phase,hits,transport.running);
    }
    if(debug&&performance.now()-lastDiagnostics>150){lastDiagnostics=performance.now();$('audio-diagnostics').textContent=JSON.stringify(diagnostics());}
    requestAnimationFrame(tick);
  }
  window.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||event.target.closest('input,select,textarea,[contenteditable=true]'))return;
    if(event.ctrlKey&&event.code==='KeyZ'){event.preventDefault();undo().catch(fail);return;}
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.code==='Space'&&!event.target.closest('button')){event.preventDefault();dispatch(session.phase==='playing'?'pause':'start').catch(fail);return;}
    if(canMove()&&control?.key(event))event.preventDefault();
  });
  window.addEventListener('pagehide',event=>{if(session.phase!=='won')session=S.transition(session,'pause');transport.stop();if(!event.persisted)control?.destroy();});
  soundReady=init();soundReady.catch(fail);updateUI();requestAnimationFrame(tick);
  if(debug)window.phaseCubeApp={
    ready:soundReady,diagnostics,state:()=>model.snapshot(),phases:()=>music.phases(model.snapshot()),turn,undo,hint:showHint,getPreparation:()=>preparation,
    getPuzzle:()=>model,getPuzzleModule:()=>module,getGame:()=>game,getMusic:()=>music,getSong:()=>song,getCatalog:()=>catalog,getTransport:()=>transport,getRepl:()=>repl,
    choose,chooseSong:id=>choose({songId:id}),choosePuzzle:id=>choose({puzzleId:id}),seekSong,makePattern,
    code:()=>music.code(model.snapshot()),getSourcePattern:id=>game.basePatterns[id],eventsOf:PuzzleMusic.eventsOf,
    sampleAudio:()=>{if(!transport.analyser)return null;const a=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(a);return Array.from(a);},
    reset:async()=>{busy=true;model.restore(module.create().snapshot());updateAudio();while(transport.pending)await new Promise(requestAnimationFrame);busy=false;updateUI();}
  };
})();
