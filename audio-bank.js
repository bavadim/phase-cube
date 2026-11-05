/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PhaseCubeBank=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const files = {
  "kick": [
    "assets/samples/kick/0.wav"
  ],
  "hat": [
    "assets/samples/hat/0.wav"
  ],
  "biba_snare": [
    "assets/samples/biba_snare/0.wav",
    "assets/samples/biba_snare/1.wav"
  ],
  "biba_clap": [
    "assets/samples/biba_clap/0.wav",
    "assets/samples/biba_clap/1.wav"
  ],
  "biba_open_hat": [
    "assets/samples/biba_open_hat/0.wav"
  ],
  "biba_closed_hat": [
    "assets/samples/biba_closed_hat/0.wav",
    "assets/samples/biba_closed_hat/1.wav"
  ],
  "biba_claves": [
    "assets/samples/biba_claves/0.wav"
  ],
  "biba_tx_piano": {
    "C2": "assets/samples/biba_tx_piano/C2.wav",
    "C3": "assets/samples/biba_tx_piano/C3.wav",
    "C4": "assets/samples/biba_tx_piano/C4.wav",
    "C5": "assets/samples/biba_tx_piano/C5.wav"
  },
  "biba_grand_piano": {
    "C3": "assets/samples/biba_grand_piano/C3.wav",
    "D4": "assets/samples/biba_grand_piano/D4.wav",
    "C5": "assets/samples/biba_grand_piano/C5.wav"
  }
};
  const asset = file => globalThis.PhaseCubeEmbeddedAssets?.[file] || new URL(file,document.baseURI).href;
  async function register(S){
    const map = Object.fromEntries(Object.entries(files).map(([key,v]) => [key,Array.isArray(v)?v.map(asset):Object.fromEntries(Object.entries(v).map(([n,file])=>[n,asset(file)]))]));
    await S.samples(map);
  }
  async function preload(S,pattern,bars){
    const unique=new Map();
    for(const h of pattern.queryArc(0,bars)){
      if(!h.hasOnset())continue;
      const v=h.value,entry=S.getSound(v.s);
      if(!entry)throw new Error('Не найден инструмент: '+v.s);
      const sound=entry.data??entry;
      if(sound.type==='sample'){
        const info=S.getSampleInfo(v,sound.samples);
        unique.set(info.url,[v,sound.samples]);
      }
    }
    await Promise.all([...unique.values()].map(([v,samples])=>S.getSampleBuffer(v,samples)));
    return unique.size;
  }
  return {files,register,preload,asset};
});
