/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.PuzzleDialogs=class{
  constructor(host,{onStart,onChoose,onAgain,onMenu}){
    host.innerHTML='<dialog id="session-overlay" class="session-overlay" aria-labelledby="session-title"><div class="record-mark" aria-hidden="true"><span>◈</span></div><div class="setup-choices"><label class="song-choice"><span>Композиция</span><select id="song-select" aria-label="Композиция" disabled></select></label><label class="song-choice"><span>Головоломка</span><select id="puzzle-select" aria-label="Головоломка" disabled></select></label></div><h1 id="session-title">Музыкальная головоломка</h1><p id="song-meta" class="song-meta"></p><p id="session-feedback" class="session-feedback" role="status">Загрузка…</p><button id="start" class="primary-button" disabled>Начать</button></dialog><dialog id="result-dialog" class="result-dialog" aria-labelledby="result-title"><div id="celebration" class="celebration" aria-hidden="true" hidden></div><p class="result-caption">Композиция собрана</p><h2 id="result-title"></h2><p id="result-song" class="song-meta"></p><a id="download-mp3" class="primary-button" download>Скачать трек · MP3</a><button id="play-again" class="outline-button">Ещё раз</button><button id="choose-song" class="outline-button">Выбрать композицию</button></dialog>';
    this.root=host;this.$=id=>host.querySelector('#'+id);
    this.$('start').onclick=onStart;this.$('play-again').onclick=onAgain;this.$('choose-song').onclick=onMenu;
    for(const id of ['song-select','puzzle-select'])this.$(id).onchange=()=>onChoose({songId:this.$('song-select').value,puzzleId:this.$('puzzle-select').value});
    host.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>e.preventDefault()));
  }
  catalog(songs,puzzles){for(const[id,list]of [['song-select',songs],['puzzle-select',puzzles]])this.$(id).replaceChildren(...list.map(item=>{const o=document.createElement('option');o.value=item.id;o.textContent=item.title;return o;}));}
  update({song,puzzleId,phase,loading,starting,error}){
    if(song){
      const duration=Math.floor(song.stats.seconds/60)+':'+String(Math.floor(song.stats.seconds%60)).padStart(2,'0');
      const meta=song.style+' · '+song.bpm+' BPM · '+duration;
      document.title=song.title+' — музыкальная головоломка';this.$('session-title').textContent=this.$('result-title').textContent=song.title;
      this.$('song-meta').textContent=this.$('result-song').textContent=meta;this.$('song-select').value=song.id;
      const link=this.$('download-mp3');link.href=globalThis.PhaseCubeEmbeddedAssets?.[song.download]||song.download;link.download=song.title+'.mp3';
    }
    this.$('puzzle-select').value=puzzleId;
    this.$('session-feedback').textContent=error?'Не удалось загрузить: '+error:loading?'Загружаем композицию…':starting?'Включаем звук…':'';
    this.$('start').disabled=!song||loading||starting||!!error;this.$('start').textContent=phase==='paused'?'Продолжить':'Начать';
    for(const id of ['song-select','puzzle-select'])this.$(id).disabled=loading||starting;
    for(const[id,open]of [['session-overlay',phase==='ready'||phase==='paused'||starting],['result-dialog',phase==='won']]){
      const d=this.$(id);if(open&&!d.open)d.showModal();else if(!open&&d.open)d.close();
    }
  }
};
