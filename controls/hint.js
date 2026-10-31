/* SPDX-License-Identifier: AGPL-3.0-or-later */
window.PuzzleHint=class{
  constructor(host,onRequest){
    this.button=document.createElement('button');this.button.id='hint';this.button.className='secondary-button';
    this.button.textContent='Подсказка';this.button.setAttribute('aria-pressed','false');this.button.onclick=onRequest;host.append(this.button);
  }
  update(available,active){this.button.disabled=!available;this.button.setAttribute('aria-pressed',String(!!active));}
};
