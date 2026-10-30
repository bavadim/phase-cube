/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Browser controller: session intent, UI bindings and coordination of native modules. */
(() => {
  'use strict';
  const M=PhaseCube, C=PhaseCubeConfig, S=PhaseCubeSession;
  const $=id=>document.getElementById(id), cube=new Cube();
  const identity=M.snapshot(new Cube()), params=new URLSearchParams(location.search);
  const debug=params.has('debug'), {voices,colors,names}=C;
  let session=S.initial(), path=[], scrambleMoves=[], userMoves=[], undoStack=[];
  let selected=0, solo=-1, muted=new Set(), foundation=true, showTarget=true;
  let bpm=C.bpm, volume=C.volume, seed=Number(params.get('seed'))||1730;
  let busy=false, view=null, orbit, music=null, repl, soundReady, fatal=null;
  let selectedFace='F', hintMove=null, previewMoveValue=null, forecast=null;
  let currentRows=[], targetRows=[], visualPhase=0, lastDiagnostics=0, analysisData;
  const transport=new PhaseCubeTransport(strudel,{onChange:refreshTransport,onError:reportError});
  const mix=()=>({foundation,solo,muted:[...muted]});
  const requestedMeta=()=>({state:session.mode==='target'?structuredClone(identity):M.snapshot(cube),mode:session.mode,...mix()});
  const heardMeta=()=>transport.running&&transport.active?transport.active.meta:requestedMeta();
  const renderCube=()=>{if(!busy)view?.render();};

  function refreshTransport(){
    $('tempo').disabled=transport.want;
    $('tempo').title=transport.want?'Меняется во время паузы':'';
    if(fatal)$('audio-status').textContent=fatal;
    else if(transport.want&&!transport.running)$('audio-status').textContent='Включаем звук…';
    else if(transport.pending)$('audio-status').textContent='Изменение прозвучит со следующего такта.';
    else if(transport.running)$('audio-status').textContent=session.mode==='target'?'Слушаешь цель. Сравни её со своим рисунком.':'Наведи на плитку, чтобы спланировать ход.';
    else $('audio-status').textContent=session.phase==='paused'?'Игра на паузе. Кубик сохранён.':'Прослушай цель или начни игру.';
    updateUI();
  }
  function reportError(error){
    console.error(error);fatal=String(error.message||error);
    session=S.transition(session,'pause');
    $('engine-led').className='led error';$('engine-label').textContent='Не удалось включить звук';
    refreshTransport();
  }
  function createControls(){
    voices.forEach((v,id)=>{
      const row=document.createElement('div');row.className='track';row.dataset.id=id;
      row.style.setProperty('--track-color',v.color);row.style.setProperty('--side-index',id%4);
      row.innerHTML=`<div class="track-meta"><span class="track-symbol">${id+1}</span><button class="track-name" aria-label="Выбрать: ${v.name}" aria-pressed="false">${v.name}</button></div><div class="track-sub"><span class="phase-value"></span><div class="track-switches"><button class="solo-button" title="Соло" aria-label="Соло: ${v.name}" aria-pressed="false">S</button><button class="mute-button" title="Выключить партию" aria-label="Выключить: ${v.name}" aria-pressed="false">×</button></div></div>`;
      row.querySelector('.track-name').onclick=()=>selectVoice(id);
      row.querySelector('.solo-button').onclick=()=>toggleSolo(id);
      row.querySelector('.mute-button').onclick=()=>toggleMute(id);
      $('tracks').append(row);
      const option=document.createElement('option');option.value=id;option.textContent=`${id+1}. ${v.name}`;$('track-select').append(option);
    });
    orbit=new PhaseCubeOrbit.Score($('orbit-score'),voices,selectVoice);
  }
  function selectVoice(id){selected=id;updateUI();renderCube();}
  function toggleSolo(id){solo=solo===id?-1:id;updateUI();updateAudio();}
  function toggleMute(id){muted.has(id)?muted.delete(id):muted.add(id);updateUI();updateAudio();}
  function requestPreview(move){view?.input?view.input.previewMove(move):previewMove(move);}
  function previewMove(move){
    if(move===previewMoveValue)return;
    previewMoveValue=move;if(move)selectedFace=move[0];
    updateMoveControls();updateRows();
  }
  function clearHint(){hintMove=null;view?.input.resetPreview();previewMove(null);updateMoveControls();}
  function updateMoveControls(){
    const disabled=busy||!S.canMove(session);
    document.querySelectorAll('.face-binding').forEach(button=>{
      button.style.setProperty('--binding-color',colors[button.dataset.face]);
      button.classList.toggle('is-active',button.dataset.face===selectedFace);button.disabled=disabled;
      button.title=`${names[button.dataset.face]} · нажать: ↷ · Shift + нажатие: ↶`;
    });
    for(const [id,inverse]of [['turn-left',true],['turn-right',false]]){
      const button=$(id),direction=inverse?'против часовой стрелки':'по часовой стрелке';
      button.setAttribute('aria-label',`${selectedFace}: ${direction}`);
      button.title=`${names[selectedFace]} · ${direction} · ${inverse?'Shift + ':''}${selectedFace}`;
      button.disabled=disabled;button.classList.toggle('hinted',hintMove===selectedFace+(inverse?"'":''));
    }
    $('hint').classList.toggle('ready',!!hintMove);
  }
  function updateRows(){
    if(!music)return;
    const heard=heardMeta();
    // Until a bar transaction commits, show the revision that is actually heard.
    const state=transport.running&&heard.mode==='current'?heard.state:M.snapshot(cube),phases=M.phases(state);
    currentRows=music.rows(state);
    forecast=previewMoveValue&&S.canMove(session)&&!busy&&!transport.pending?music.predict(previewMoveValue,state,currentRows):null;
    orbit.update({rows:currentRows,target:targetRows,phases,selected,muted:heard.muted,solo:heard.solo,mode:heard.mode,showTarget,pending:!!transport.pending,forecast});
    $('tracks').classList.toggle('has-move-preview',!!forecast);
    document.querySelectorAll('.track').forEach((row,id)=>{
      const changed=!!forecast?.changed.includes(id),pv=row.querySelector('.phase-value');
      row.classList.toggle('will-change',changed);
      pv.textContent=changed?`${phases[id].ticks} → ${forecast.phases[id].ticks}`:phases[id].ticks===0?'✓ фаза цели':`+${phases[id].ticks}/24`;
      pv.title=changed?`Позиции в цикле: ${phases[id].ticks}/24 → ${forecast.phases[id].ticks}/24`:'';
    });
    $('preview-legend').hidden=!forecast?.changed.length;
    $('move-preview').classList.toggle('has-move',!!previewMoveValue);
    if(previewMoveValue){
      const detail=forecast?(forecast.changed.length?`изменятся партии ${forecast.changed.map(id=>id+1).join(', ')}`:'рисунок не изменится'):busy?'поворот…':'прогноз после границы такта';
      $('move-preview').textContent=`${previewMoveValue[0]} ${previewMoveValue.endsWith("'")?'↶':'↷'} · ${detail}`;
    }else $('move-preview').textContent=S.canMove(session)?'Наведи на половину плитки — увидишь результат хода':'Цель — вернуть музыкальные фразы на место';
  }
  function updateUI(){
    if(!orbit)return;
    const state=M.snapshot(cube),done=M.solved(state),heard=heardMeta();
    const phases=M.phases(transport.running&&heard.mode==='current'?heard.state:state),active=S.canMove(session);
    document.body.dataset.phase=session.phase;
    $('correct-count').innerHTML=`${M.correct(state)}<span>/8</span>`;
    $('state-badge').textContent=done?'Собран':'Перемешан';$('state-badge').classList.toggle('success',done);
    $('completion-label').textContent=done?'композиция собрана':'деталей на месте';
    $('mode-badge').textContent=transport.pending?'После такта':heard.mode==='target'?'Звучит цель':session.phase==='ready'?'Готов к старту':session.phase==='paused'?'Пауза':'Твой микс';
    const target=session.mode==='target';
    $('listen-target').setAttribute('aria-pressed',target);$('listen-target').classList.toggle('selected',target);
    $('listen-target-label').textContent=target?(active?'Вернуться к игре':'Остановить образец'):'Прослушать цель';
    $('session-overlay').hidden=active;
    $('session-title').textContent=session.phase==='paused'?'Пауза':'Собери грув';
    $('session-description').textContent=session.phase==='paused'?'Кубик и твой рисунок сохранены.':'Послушай цель и верни фразы на место.';
    $('start').textContent=session.phase==='paused'?'Продолжить':'Начать';
    $('start').disabled=!music||!!fatal;
    $('cube-stage').inert=!active;$('cube-stage').setAttribute('aria-disabled',!active);
    $('cube-stage').setAttribute('aria-busy',String(busy));
    $('pause').disabled=session.phase==='ready';$('pause').setAttribute('aria-pressed',session.phase==='paused');
    $('pause-label').textContent=session.phase==='paused'?'Продолжить':'Пауза';
    $('pause-icon').textContent=session.phase==='paused'?'▶':'Ⅱ';
    $('scramble').disabled=busy;$('hint').disabled=busy||!active||done||!path.length;
    $('hint-text').textContent=hintMove?`Грань ${hintMove[0]} · нажми подсвеченную стрелку у кубика.`:'';
    document.querySelectorAll('.track').forEach((row,id)=>{
      row.classList.toggle('selected',selected===id);
      row.classList.toggle('is-muted',heard.muted.includes(id)||(heard.solo>=0&&heard.solo!==id));
      row.classList.toggle('waiting',!!transport.pending&&phases[id].ticks!==M.phases(state)[id].ticks);
      row.querySelector('.track-name').setAttribute('aria-pressed',selected===id);
      for(const [selector,on]of [['.solo-button',solo===id],['.mute-button',muted.has(id)]]){
        const button=row.querySelector(selector);button.classList.toggle('on',on);button.setAttribute('aria-pressed',on);
      }
    });
    $('track-select').value=selected;
    for(const [id,on]of [['track-solo',solo===selected],['track-mute',muted.has(selected)]]){$(id).setAttribute('aria-pressed',on);$(id).classList.toggle('on',on);}
    $('track-mute').textContent=muted.has(selected)?'Включить':'Выключить';
    updateMoveControls();updateRows();
    if(debug){lastDiagnostics=performance.now();$('audio-diagnostics').textContent=JSON.stringify(diagnosticSnapshot(heard));}
  }
  async function dispatch(action){
    session=S.transition(session,action);
    if(!S.canMove(session))clearHint();
    updateUI();await syncAudio();
  }
  function makePattern(state=session.mode==='target'?identity:M.snapshot(cube),respectMix=true){
    if(!music)throw new Error('Звук ещё загружается');
    return music.pattern(state,mix(),respectMix);
  }
  async function syncAudio(){
    if(!S.shouldPlay(session)){if(transport.want||transport.running)await transport.stop();return;}
    if(transport.want){updateAudio();return;}
    await transport.start(()=>({pattern:makePattern(),meta:requestedMeta()}),bpm,volume,null,soundReady);
  }
  function updateAudio(){if(transport.running&&music)transport.queue(makePattern(),requestedMeta());}
  function newPuzzle(){
    if(busy)return;
    clearHint();cube.identity();scrambleMoves=M.scramble(seed++,C.scrambleLength);cube.move(scrambleMoves.join(' '));
    path=[...scrambleMoves];userMoves=[];undoStack=[];session=S.transition(session,'shuffle');
    renderCube();updateUI();syncAudio().catch(reportError);
  }
  async function turn(move,origin='player'){
    if(busy||!S.canMove(session)||!/^([URFDLB])('|2)?$/.test(move))return;
    clearHint();selectedFace=move[0];
    const previous={state:M.snapshot(cube),path:[...path],moves:[...userMoves],move};
    busy=true;view?.input.refresh();
    if(origin!=='undo')undoStack.push(previous);
    try{
      const animation=view?.animate(move);
      cube.move(move);path=M.appendPath(path,move);userMoves.push(move);session=S.transition(session,'move');
      updateUI();updateAudio();await animation;
    }catch(error){reportError(error);}
    finally{busy=false;renderCube();updateUI();}
  }
  async function undo(){
    if(busy||!S.canMove(session)||!undoStack.length)return;
    const previous=undoStack.pop();clearHint();selectedFace=previous.move[0];busy=true;
    try{
      const animation=view?.animate(M.inverse(previous.move));
      M.restore(cube,previous.state);path=previous.path;userMoves=previous.moves;session=S.transition(session,'move');
      updateUI();updateAudio();await animation;
    }catch(error){reportError(error);}
    finally{busy=false;renderCube();updateUI();}
  }
  function showHint(){
    if(!S.canMove(session)||!path.length||busy)return;
    hintMove=M.inverse(path[path.length-1]);selectedFace=hintMove[0];
    view?.focus(selectedFace);view?.input.setHint(hintMove);if(!view)previewMove(hintMove);updateUI();
  }
  function initSound(){
    return strudel.initStrudel({sync:false,miniAllStrings:true,
      setInterval:window.setInterval.bind(window),clearInterval:window.clearInterval.bind(window),
      prebake:()=>strudel.samples(PHASE_CUBE_SAMPLES),defaultOutput:(...args)=>transport.output(...args),
      onUpdateState:state=>{if(state.error)reportError(state.error);}
    }).then(instance=>{
      repl=instance;transport.attach(repl);repl.scheduler.setCps(bpm/240);
      music=new PhaseCubeMusic.Music(strudel,M,Cube,voices);targetRows=music.rows(identity);
      $('engine-led').className='led ready';$('engine-label').textContent='Звук готов';refreshTransport();return instance;
    }).catch(reportError);
  }
  function diagnosticSnapshot(heard){
    let peak=0,rms=0;
    if(transport.analyser){
      analysisData??=new Float32Array(transport.analyser.fftSize);transport.analyser.getFloatTimeDomainData(analysisData);
      for(const value of analysisData){peak=Math.max(peak,Math.abs(value));rms+=value*value;}rms=Math.sqrt(rms/analysisData.length);
    }
    return {build:'client-app/1 · bar-transport/2',sessionPhase:session.phase,context:strudel.getAudioContext().state,
      playing:transport.running,requested:transport.want,mode:session.mode,heardMode:heard.mode,bpm,...mix(),
      selectedVoice:selected,selectedFace,hint:hintMove,moves:[...userMoves],busy,phases:M.phases(M.snapshot(cube)).map(p=>p.ticks),
      preview:forecast?{move:forecast.move,changed:forecast.changed,phaseChanged:forecast.phaseChanged,phases:forecast.phases.map(p=>p.ticks)}:null,
      ...transport.info(),masterGain:transport.master?.gain.value??0,peak,rms,error:fatal,changes:transport.changes,log:transport.log.slice(-30)};
  }
  function tick(){
    transport.poll();if(transport.running)visualPhase=M.mod(transport.clock(),1);
    $('cycle-position').innerHTML=`${String(Math.min(23,Math.floor(visualPhase*24))).padStart(2,'0')}<span>/24</span>`;
    const heard=heardMeta(),rows=heard.mode==='target'?targetRows:currentRows;
    if(transport.pending)$('audio-status').textContent=`Новый рисунок через ${Math.max(0,transport.pending.audioBegin-strudel.getAudioContext().currentTime).toFixed(1)} с`;
    const hits=voices.map((v,id)=>transport.running&&!heard.muted.includes(id)&&(heard.solo<0||heard.solo===id)&&(rows[id]||[]).some(e=>M.mod(visualPhase-e.start,1)<.045));
    document.querySelectorAll('.track').forEach((row,id)=>row.classList.toggle('playing-note',hits[id]));
    orbit.frame(visualPhase,hits,transport.running);
    if(debug&&performance.now()-lastDiagnostics>100){lastDiagnostics=performance.now();$('audio-diagnostics').textContent=JSON.stringify(diagnosticSnapshot(heard));}
    requestAnimationFrame(tick);
  }

  createControls();
  try{view=PhaseCubeView.create({T:window.THREE,M,colors,view:$('cube-view'),stage:$('cube-stage'),svg:$('cube-input'),
    getState:()=>M.snapshot(cube),getSelected:()=>selected,isBusy:()=>busy||!S.canMove(session),
    onMove:(move,id)=>{selected=id;turn(move);},onPreview:previewMove,onError:()=>{$('view-error').hidden=false;}});
  }catch(error){console.error(error);$('view-error').hidden=false;}
  $('start').onclick=()=>dispatch('start').catch(reportError);
  $('listen-target').onclick=()=>dispatch('target').catch(reportError);
  $('pause').onclick=()=>dispatch(session.phase==='playing'?'pause':'start').catch(reportError);
  $('scramble').onclick=newPuzzle;$('hint').onclick=showHint;
  document.querySelectorAll('.face-binding').forEach(button=>{
    const move=event=>button.dataset.face+(event.shiftKey?"'":'');
    button.onclick=event=>turn(move(event));
    button.onpointerenter=button.onpointermove=button.onfocus=event=>requestPreview(move(event));
    button.onpointerleave=button.onblur=()=>requestPreview(null);
  });
  for(const [id,inverse]of [['turn-left',true],['turn-right',false]]){
    $(id).onclick=()=>turn(selectedFace+(inverse?"'":''));
    $(id).onpointerenter=$(id).onfocus=()=>requestPreview(selectedFace+(inverse?"'":''));
    $(id).onpointerleave=$(id).onblur=()=>requestPreview(null);
  }
  $('view-reset').onclick=()=>view?.reset();
  $('foundation').onchange=event=>{foundation=event.target.checked;updateUI();updateAudio();};
  $('show-target').onchange=event=>{showTarget=event.target.checked;updateUI();};
  $('tempo').oninput=event=>{bpm=Number(event.target.value);$('tempo-value').textContent=bpm+' BPM';repl?.scheduler.setCps(bpm/240);updateUI();};
  $('volume').oninput=event=>{volume=Number(event.target.value);$('volume-value').textContent=Math.round(volume*100)+'%';if(transport.want)transport.setVolume(volume);};
  $('track-select').onchange=event=>selectVoice(Number(event.target.value));
  $('track-solo').onclick=()=>toggleSolo(selected);$('track-mute').onclick=()=>toggleMute(selected);
  window.addEventListener('keydown',event=>{
    if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(event.key==='Escape'&&hintMove){clearHint();updateUI();return;}
    if(event.ctrlKey&&event.code==='KeyZ'){event.preventDefault();undo();return;}
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.code==='Space'){
      if(event.target.closest('button,[role="button"]'))return;
      event.preventDefault();dispatch(session.phase==='playing'?'pause':'start').catch(reportError);return;
    }
    const key=event.code?.startsWith('Key')?event.code.slice(3):event.key.toUpperCase();
    if(key==='S'){event.preventDefault();toggleSolo(selected);return;}
    if(M.FACES.includes(key)){event.preventDefault();turn(key+(event.shiftKey?"'":''));}
  });
  window.addEventListener('pagehide',event=>{session=S.transition(session,'pause');transport.stop();if(!event.persisted)view?.destroy();});
  soundReady=initSound();newPuzzle();requestAnimationFrame(tick);
  if(debug)window.phaseCubeApp={
    ready:soundReady,state:()=>M.snapshot(cube),phases:()=>M.phases(M.snapshot(cube)),turn,undo,
    reset:()=>{clearHint();M.restore(cube,identity);path=[];userMoves=[];undoStack=[];renderCube();updateUI();updateAudio();},
    makePattern,eventsOf:PhaseCubeMusic.eventsOf,code:()=>music.code(M.snapshot(cube),mix(),bpm),
    diagnostics:()=>diagnosticSnapshot(heardMeta()),getSourcePattern:id=>music.basePatterns[id],getRepl:()=>repl,getTransport:()=>transport
  };
})();
