/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.PuzzlePlayer=class{
  constructor(host,{onSeek,onUndo,onPause,onHint}){
    host.innerHTML='<label class="song-seek"><span class="sr-only">Позиция в композиции</span><input id="song-seek" type="range" min="0" max="1" step="0.25" value="0" aria-label="Позиция в композиции"></label><div class="puzzle-command cube-command" role="group" aria-label="Поворот выбранного блока"></div><div class="secondary-actions"><button id="undo" class="secondary-button" aria-label="Отменить ход"><span aria-hidden="true">↩</span><span class="action-label">Отменить</span></button><span class="hint-host"></span><button id="pause" class="secondary-button" aria-label="Пауза"><span id="pause-icon" aria-hidden="true">Ⅱ</span><span class="action-label" id="pause-label">Пауза</span></button></div>';
    this.commands=host.querySelector('.puzzle-command');this.seek=host.querySelector('#song-seek');this.undo=host.querySelector('#undo');this.pause=host.querySelector('#pause');
    this.dragging=false;this.seek.oninput=()=>{this.dragging=true;};this.seek.onpointercancel=()=>{this.dragging=false;};
    this.seek.onchange=()=>{this.dragging=false;onSeek(Number(this.seek.value));};this.undo.onclick=onUndo;this.pause.onclick=onPause;
    this.hint=new PuzzleHint(host.querySelector('.hint-host'),onHint);
  }
  update({disabled,canUndo,canHint,hinted,phase,busy,song}){
    this.undo.disabled=disabled||!canUndo;this.pause.disabled=busy||!['playing','paused'].includes(phase);
    this.pause.setAttribute('aria-pressed',String(phase==='paused'));this.pause.setAttribute('aria-label',phase==='paused'?'Продолжить':'Пауза');
    this.pause.querySelector('#pause-icon').textContent=phase==='paused'?'▶':'Ⅱ';this.pause.querySelector('#pause-label').textContent=phase==='paused'?'Продолжить':'Пауза';
    this.seek.disabled=busy||!song||phase==='won';if(song)this.seek.max=song.bars-.25;
    this.hint.update(!disabled&&canHint,hinted);
  }
  frame(bar,song){if(song&&!this.dragging){this.seek.value=Math.min(song.bars-.25,bar);this.seek.setAttribute('aria-valuetext',(bar*240/song.bpm).toFixed(1)+' с из '+song.stats.seconds.toFixed(1)+' с');}}
};
