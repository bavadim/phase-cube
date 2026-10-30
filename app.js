/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Viewport UI; cubejs and Strudel remain the model and sound engine. */
(() => {
  'use strict';
  const M=PhaseCube, C=PhaseCubeConfig, S=PhaseCubeSession;
  const $=id=>document.getElementById(id), cube=new Cube();
  const identity=M.snapshot(new Cube()), params=new URLSearchParams(location.search);
  const debug=params.has('debug'), {colors,names}=C;
  const celebration=PhaseCubeCelebration.create($('celebration'));
  const volume=C.volume;
  const library=new PhaseCubeLibrary.Loader(strudel,{palette:C.palette});
  let song=null,bpm=0,voices=C.palette.map((color,id)=>({name:`Деталь ${id+1}`,color})),catalog=[],loadToken=0;
  const mix=()=>({foundation:true,solo:-1,muted:[]});
  let session=S.initial(), path=[], userMoves=[], undoStack=[], seed=Number(params.get('seed'))||1730;
  let selected=0, selectedFace='F', previewMoveValue=null, affected=[], pulseTimer;
  let busy=false, seeking=false, starting=false, loading=true, draggingSeek=false, fatal=null;
  let view=null, orbit, music=null, repl, soundReady, currentRows=[], targetRows=[], visualPhase=0;
  let lastDiagnostics=0, analysisData;
  const requestedMeta=()=>({state:M.snapshot(cube),mode:'current',...mix()});
  const heardMeta=()=>transport.running&&transport.active?transport.active.meta:requestedMeta();
  const transport=new PhaseCubeTransport(strudel,{onChange:refreshTransport,onError:reportError,outputGain:C.outputGain});
  const canMove=()=>S.canMove(session)&&transport.running&&!busy&&!seeking&&!transport.pending&&!starting;
  const renderCube=()=>{if(!busy)view?.render();};

  function setDialog(id,open){
    const dialog=$(id);
    if(open&&!dialog.open)dialog.showModal();
    else if(!open&&dialog.open)dialog.close();
  }
  function refreshTransport(){updateUI();}
  function reportError(error){
    console.error(error);fatal=String(error.message||error);starting=false;
    session=S.transition(session,'pause');updateUI();
  }
  function previewMove(move){
    if(move===previewMoveValue)return;
    previewMoveValue=move;updateRows();
  }
  function clearPreview(){view?.input.resetPreview();previewMoveValue=null;}
  function selectFace(face,id){
    if(!canMove())return;
    clearPreview();selectedFace=face;if(id!=null)selected=id;
    view?.input.refresh();updateUI();renderCube();
  }
  function requestPreview(move){if(canMove())view?.input.previewMove(move);}
  function updateRows(){
    if(!music||!orbit)return;
    // The score follows the version that can actually be heard.
    const state=transport.running?heardMeta().state:M.snapshot(cube),phases=M.phases(state);
    currentRows=music.rows(state);
    const forecast=previewMoveValue&&canMove()?music.predict(previewMoveValue,state,currentRows):null;
    orbit.update({rows:currentRows,target:targetRows,phases,selected,muted:[],solo:-1,mode:'current',
      showTarget:true,pending:!!transport.pending,forecast,affected});
  }
  function updateUI(){
    if(!orbit)return;
    const state=M.snapshot(cube);
    if(session.phase==='playing'&&!starting&&!busy&&!seeking&&transport.running&&!transport.pending&&M.solved(state)){
      session=S.transition(session,'complete');celebration.play();
    }
    document.body.dataset.phase=session.phase;
    $('correct-count').innerHTML=M.correct(state)+'<span>/8</span>';
    $('correct-count').setAttribute('aria-label',M.correct(state)+' из 8 деталей на месте');
    const disabled=!canMove();
    $('touch-face').value=selectedFace;$('touch-face').disabled=disabled;
    $('touch-face').style.setProperty('--face-color',colors[selectedFace]);
    for(const [id,inverse]of [['turn-left',true],['turn-right',false]]){
      $(id).disabled=disabled;
      $(id).setAttribute('aria-label',names[selectedFace]+': '+(inverse?'против':'по')+' часовой стрелке');
    }
    $('undo').disabled=disabled||!undoStack.length;
    $('pause').disabled=!['playing','paused'].includes(session.phase)||starting||seeking;
    $('pause').setAttribute('aria-pressed',String(session.phase==='paused'));
    $('pause-icon').textContent=session.phase==='paused'?'▶':'Ⅱ';
    $('pause-label').textContent=session.phase==='paused'?'Продолжить':'Пауза';
    $('song-seek').disabled=!music||busy||seeking||starting||!!transport.pending||session.phase==='won';
    $('cube-stage').inert=disabled;$('cube-stage').setAttribute('aria-disabled',String(disabled));
    $('cube-stage').setAttribute('aria-busy',String(busy));
    $('session-feedback').textContent=fatal?'Не удалось загрузить композицию. '+fatal:loading?'Загружаем композицию…':starting?'Включаем звук…':'';
    $('start').disabled=!music||loading||starting||!!fatal;
    $('song-select').disabled=loading||starting;
    $('start').textContent=session.phase==='paused'?'Продолжить':'Начать';
    setDialog('session-overlay',session.phase==='ready'||session.phase==='paused'||starting);
    setDialog('result-dialog',session.phase==='won');
    updateRows();
    if(debug){lastDiagnostics=performance.now();$('audio-diagnostics').textContent=JSON.stringify(diagnosticSnapshot());}
  }
  async function dispatch(action){
    starting=action==='start';session=S.transition(session,action);clearPreview();updateUI();
    try{await syncAudio();}finally{starting=false;updateUI();}
    if(action==='start'&&session.phase==='playing')$('turn-right').focus({preventScroll:true});
  }
  function makePattern(state=M.snapshot(cube),respectMix=true){
    if(!music)throw new Error('Звук ещё загружается');
    return music.pattern(state,mix(),respectMix);
  }
  async function syncAudio(){
    if(!S.shouldPlay(session)){if(transport.want||transport.running)await transport.stop();return;}
    if(transport.want)return;
    await transport.start(()=>({pattern:makePattern(),meta:requestedMeta()}),bpm,volume,null,soundReady);
    transport.setBackingMix(mix());
  }
  function updateAudio(){if(transport.running&&music)transport.queue(makePattern(),requestedMeta());}
  function newPuzzle(){
    clearTimeout(pulseTimer);affected=[];clearPreview();celebration.clear();
    cube.identity();const moves=M.scramble(seed++,C.scrambleLength);cube.move(moves.join(' '));
    path=[...moves];userMoves=[];undoStack=[];selected=0;selectedFace='F';
    session=S.transition(session,'shuffle');renderCube();view?.reset();updateUI();
  }
  function pulse(ids){
    clearTimeout(pulseTimer);affected=ids;updateRows();
    pulseTimer=setTimeout(()=>{affected=[];updateRows();},650);
  }
  async function turn(move){
    if(!canMove()||!/^([URFDLB])('|2)?$/.test(move))return;
    clearPreview();selectedFace=move[0];
    const state=M.snapshot(cube),changes=music.predict(move,state,music.rows(state)).changed;
    undoStack.push({state,path:[...path],moves:[...userMoves],move});
    busy=true;affected=changes;view?.input.refresh();
    try{
      const animation=view?.animate(move);
      cube.move(move);path=M.appendPath(path,move);userMoves.push(move);session=S.transition(session,'move');
      updateUI();updateAudio();await animation;
      while(transport.pending)await new Promise(requestAnimationFrame);
      pulse(changes);
    }catch(error){reportError(error);}
    finally{busy=false;renderCube();updateUI();}
  }
  async function undo(){
    if(!canMove()||!undoStack.length)return;
    const previous=undoStack.pop(),move=M.inverse(previous.move),state=M.snapshot(cube);
    const changes=music.predict(move,state,music.rows(state)).changed;
    clearPreview();selectedFace=previous.move[0];busy=true;affected=changes;
    try{
      const animation=view?.animate(move);
      M.restore(cube,previous.state);path=previous.path;userMoves=previous.moves;
      updateUI();updateAudio();await animation;
      while(transport.pending)await new Promise(requestAnimationFrame);
      pulse(changes);
    }catch(error){reportError(error);}
    finally{busy=false;renderCube();updateUI();}
  }
  async function restart(){
    if(busy||seeking||starting)return;
    await transport.stop();transport.cursor=0;
    session=S.transition(session,'restart');newPuzzle();await dispatch('start');
  }
  async function seekSong(bar){
    if(busy||seeking||transport.pending||starting||session.phase==='won')return;
    seeking=true;updateUI();const wasPlaying=transport.want;
    try{
      await transport.stop();transport.cursor=Math.max(0,Math.min(song.bars-.25,bar));
      if(wasPlaying)await syncAudio();
    }finally{seeking=false;updateUI();}
  }
  const durationText=seconds=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  function renderSongInfo(){
    document.title=song.title+' — музыкальный кубик';
    $('session-title').textContent=$('result-title').textContent=song.title;
    for(const id of ['song-meta','result-song']){
      $(id).replaceChildren(...[song.style,`${song.bpm} BPM`,durationText(song.stats.seconds)].map(text=>{
        const span=document.createElement('span');span.textContent=text;return span;
      }));
    }
    $('song-details').textContent=`${song.bars} тактов · ${song.stats.instruments} инструментов · игровой круг ${song.periodBars} такта`;
    $('download-mp3').href=PhaseCubeBank.asset(song.download);
    $('download-mp3').download=song.title+'.mp3';
    $('song-seek').max=song.bars-.25;$('song-seek').value=0;
    $('song-select').value=song.id;
  }
  async function chooseSong(id){
    const token=++loadToken;loading=true;fatal=null;music=null;
    await transport.stop();session=S.initial();updateUI();
    try{
      const next=await library.load(id);
      await PhaseCubeBank.preload(strudel,next.pattern,next.bars);
      if(token!==loadToken)return;
      song=next;bpm=song.bpm;voices=song.game.voices;transport.setComposition(song);
      music=new PhaseCubeMusic.Music(strudel,M,Cube,song);targetRows=song.game.targetRows;
      $('orbit-score').replaceChildren();orbit=new PhaseCubeOrbit.Score($('orbit-score'),voices);
      renderSongInfo();loading=false;newPuzzle();
    }catch(error){if(token===loadToken){loading=false;reportError(error);}throw error;}
  }
  async function initSound(){
    const instance=await strudel.initStrudel({sync:false,miniAllStrings:true,
      setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window),
      prebake:()=>PhaseCubeBank.register(strudel),defaultOutput:(...args)=>transport.output(...args),
      onUpdateState:state=>{if(state.error)reportError(state.error);}
    });
    repl=instance;transport.attach(repl);catalog=await library.catalog();
    $('song-select').replaceChildren(...catalog.map(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.title;return option;}));
    const requested=params.get('song');await chooseSong(catalog.some(item=>item.id===requested)?requested:catalog[0].id);
    return instance;
  }
  function diagnosticSnapshot(){
    let peak=0,rms=0;
    if(transport.analyser){
      analysisData??=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(analysisData);
      for(const value of analysisData){peak=Math.max(peak,Math.abs(value));rms+=value*value;}rms=Math.sqrt(rms/analysisData.length);
    }
    return {build:'phase-cube/compositions1',songId:song?.id,songTitle:song?.title,stats:song?.stats,songBars:song?.bars,localBars:song?.periodBars,loading,backingStarts:transport.backingStarts||0,backingId:transport.backingId||0,
      sessionPhase:session.phase,context:strudel.getAudioContext().state,playing:transport.running,requested:transport.want,mode:'current',heardMode:heardMeta().mode,bpm,...mix(),
      selectedVoice:selected,selectedFace,moves:[...userMoves],busy,seeking,phases:M.phases(M.snapshot(cube)).map(p=>p.ticks),
      ...transport.info(),volume,outputGain:C.outputGain,masterGain:transport.master?.gain.value??0,peak,rms,error:fatal,changes:transport.changes,log:transport.log.slice(-30)};
  }
  function tick(){
    transport.poll();if(transport.running&&song)visualPhase=M.mod(transport.clock()/song.periodBars,1);
    const songBar=song?M.mod(transport.clock(),song.bars):0;
    if(song&&!draggingSeek&&!seeking){
      $('song-seek').value=Math.min(song.bars-.25,songBar);
      $('song-seek').setAttribute('aria-valuetext',(songBar*240/bpm).toFixed(1)+' с из '+(song.bars*240/bpm).toFixed(1)+' с');
    }
    const hits=voices.map((v,id)=>transport.running&&(currentRows[id]||[]).some(e=>M.mod(visualPhase-e.start,1)<.045));
    orbit.frame(visualPhase,hits,transport.running);
    if(debug&&performance.now()-lastDiagnostics>100){lastDiagnostics=performance.now();$('audio-diagnostics').textContent=JSON.stringify(diagnosticSnapshot());}
    requestAnimationFrame(tick);
  }
  orbit=new PhaseCubeOrbit.Score($('orbit-score'),voices);
  try{
    view=PhaseCubeView.create({T:window.THREE,M,colors,view:$('cube-view'),stage:$('cube-stage'),svg:$('cube-input'),
      getState:()=>M.snapshot(cube),getSelected:()=>selected,getSelectedFace:()=>selectedFace,isBusy:()=>!canMove(),
      onMove:(move,id)=>{selected=id;turn(move);},onSelect:selectFace,selectOnly:()=>true,
      onPreview:previewMove,onError:()=>{$('view-error').hidden=false;}});
  }catch(error){console.error(error);$('view-error').hidden=false;}
  $('start').onclick=()=>dispatch('start').catch(reportError);
  $('pause').onclick=()=>dispatch(session.phase==='playing'?'pause':'start').catch(reportError);
  $('undo').onclick=()=>undo().catch(reportError);
  $('play-again').onclick=()=>restart().catch(reportError);
  $('song-select').onchange=event=>{soundReady=chooseSong(event.target.value);soundReady.catch(reportError);};
  $('choose-song').onclick=async()=>{await transport.stop();session=S.initial();celebration.clear();updateUI();};
  for(const dialog of [$('session-overlay'),$('result-dialog')])dialog.addEventListener('cancel',event=>event.preventDefault());
  for(const [id,inverse]of [['turn-left',true],['turn-right',false]]){
    const move=()=>selectedFace+(inverse?"'":'');
    $(id).onclick=()=>turn(move());
    $(id).onpointerenter=event=>{if(event.pointerType!=='touch')requestPreview(move());};
    $(id).onfocus=()=>{if(matchMedia('(hover: hover)').matches)requestPreview(move());};
    $(id).onpointerleave=$(id).onblur=()=>{view?.input.previewMove(null);};
  }
  $('touch-face').onchange=event=>{selectFace(event.target.value);view?.focus(selectedFace);};
  $('song-seek').oninput=()=>{draggingSeek=true;};
  $('song-seek').onpointercancel=()=>{draggingSeek=false;};
  $('song-seek').onchange=async event=>{draggingSeek=false;await seekSong(Number(event.target.value)).catch(reportError);};
  window.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]')||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(event.ctrlKey&&event.code==='KeyZ'){event.preventDefault();undo();return;}
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.code==='Space'){
      if(event.target.closest('button'))return;
      event.preventDefault();dispatch(session.phase==='playing'?'pause':'start').catch(reportError);return;
    }
    const key=event.code?.startsWith('Key')?event.code.slice(3):event.key.toUpperCase();
    if(M.FACES.includes(key)){event.preventDefault();turn(key+(event.shiftKey?"'":''));}
  });
  window.addEventListener('pagehide',event=>{
    if(session.phase!=='won')session=S.transition(session,'pause');
    transport.stop();if(!event.persisted)view?.destroy();
  });
  soundReady=initSound();soundReady.catch(reportError);updateUI();requestAnimationFrame(tick);
  if(debug)window.phaseCubeApp={
    ready:soundReady,state:()=>M.snapshot(cube),phases:()=>M.phases(M.snapshot(cube)),turn,undo,
    reset:()=>{clearPreview();M.restore(cube,identity);path=[];userMoves=[];undoStack=[];renderCube();updateUI();updateAudio();},
    makePattern,eventsOf:PhaseCubeMusic.eventsOf,code:()=>music.code(M.snapshot(cube),mix(),bpm),
    diagnostics:diagnosticSnapshot,getSourcePattern:id=>music.basePatterns[id],getMusic:()=>music,
    sampleAudio:()=>{if(!transport.analyser)return null;const a=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(a);return Array.from(a);},
    getRepl:()=>repl,getTransport:()=>transport,getSong:()=>song,getCatalog:()=>catalog,chooseSong,seekSong
  };
})();
