/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PhaseCubeConfig=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const colors={U:'#e9dca6',R:'#dc8e70',F:'#739e87',D:'#c5ad63',L:'#a4b6c3',B:'#a196b6'};
  const names={U:'верх',R:'справа',F:'спереди',D:'низ',L:'слева',B:'сзади'};
  const palette=['#507c63','#739774','#af7658','#c5966a','#588c91','#809eaf','#a183a0','#ab7270'];
  const voices=palette.map((color,id)=>({name:`Рифф · ${String(id+1).padStart(2,'0')}`,color,sound:`steel_riff_${id}`,source:`riffThemeALoop · ${(id*.5).toFixed(1)}–${((id+1)*.5).toFixed(1)} такта`}));
  const sections=[{from:0,to:4,name:'ВОРОТА ЦЕХА'},{from:4,to:8,name:'ЗАПУСК'},{from:8,to:16,name:'ГОРНЫЙ КОРОЛЬ'},{from:16,to:24,name:'СБОРОЧНАЯ ЛИНИЯ'},{from:24,to:28,name:'ОТКЛЮЧЕНИЕ'},{from:28,to:32,name:'ДАВЛЕНИЕ'},{from:32,to:40,name:'ПЕРЕГРУЗКА'},{from:40,to:44,name:'НОЧНАЯ СМЕНА'},{from:44,to:48,name:'ФИНАЛ'}];
  return Object.freeze({voices,colors,names,sections,bars:48,localBars:4,bpm:140,volume:.80,outputGain:1,scrambleLength:3});
});
