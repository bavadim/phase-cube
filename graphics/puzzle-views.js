/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Presentation registry. Puzzle modules contain rules and never import renderers. */
window.PuzzleViews=(()=>{
  const views=Object.freeze({twiddle:TwiddleView.create,rubik:RubikView.create,fourier:FourierView.create,scratch:ScratchView.create,bounce:BounceView.create});
  return Object.freeze({get(id){if(!Object.hasOwn(views,id))throw new Error('Нет представления головоломки: '+id);return views[id];}});
})();
