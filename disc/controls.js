/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.DiscControls=class{
  update({loading,starting,playing,model,activeSlot,saved}){
    const $=id=>document.getElementById(id);
    $('play').disabled=loading||starting||!model;
    $('play-icon').textContent=playing?'Ⅱ':'▶';
    $('play-label').textContent=loading?'Загрузка…':starting?'Включаем…':playing?'Пауза':'Слушать';
    $('undo').disabled=loading||!model?.history.length;
    $('open-library').disabled=loading;
    for(const id of ['snapshot-a','snapshot-b','save-snapshot','save-scene','export-scene','import-scene'])$(id).disabled=loading;
    $('snapshot-a').setAttribute('aria-pressed',String(activeSlot==='a'));
    $('snapshot-b').setAttribute('aria-pressed',String(activeSlot==='b'));
    $('save-snapshot').textContent='Запомнить '+activeSlot.toUpperCase();
    $('restore-scene').disabled=loading||!saved;
  }
};
