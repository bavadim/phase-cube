/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PhaseCubeConfig=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const colors={U:'#e9dca6',R:'#dc8e70',F:'#739e87',D:'#c5ad63',L:'#a4b6c3',B:'#a196b6'};
  const names={U:'верх',R:'справа',F:'спереди',D:'низ',L:'слева',B:'сзади'};
  const palette=['#507c63','#739774','#af7658','#c5966a','#588c91','#809eaf','#a183a0','#ab7270'];
  return Object.freeze({palette,colors,names,volume:.80,outputGain:1,scrambleLength:3});
});
