/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./twiddle/module.js'),require('./rubik/module.js'));else root.PuzzleRegistry=factory(root.TwiddlePuzzle,root.RubikPuzzle);})(globalThis,function(...modules){
  const get=id=>{const module=modules.find(p=>p.id===id);if(!module)throw new Error('Неизвестная головоломка: '+id);return module;};
  return {modules,get};
});
