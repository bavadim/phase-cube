/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./twiddle/module.js'),require('./rubik/module.js'),require('./fourier/module.js'),require('./scratch/module.js'));else root.PuzzleRegistry=factory(root.TwiddlePuzzle,root.RubikPuzzle,root.FourierPuzzle,root.ScratchPuzzle);})(globalThis,function(...modules){
  const get=id=>{const module=modules.find(p=>p.id===id);if(!module)throw new Error('Неизвестная головоломка: '+id);return module;};
  return {modules,get};
});
