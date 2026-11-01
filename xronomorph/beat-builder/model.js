/* SPDX-License-Identifier: AGPL-3.0-or-later */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../algorithms/model.js'));else root.BeatBuilder=factory(root.RhythmMethods);})(globalThis,function(R){
'use strict';
const N=16,TAU=2*Math.PI,EPS=1e-8,clone=R.clone,wrap=R.wrap;
const voices=[
 {id:'kick',label:'Бочка',role:'Опора',color:'#ff805b',sound:'xrono_kick',trim:.32},
 {id:'clap',label:'Хлопок',role:'Акцент',color:'#cfadff',sound:'xrono_clap',trim:.28},
 {id:'hat',label:'Хэт',role:'Движение',color:'#72d8b3',sound:'xrono_hat',trim:.22},
 {id:'click',label:'Перкуссия',role:'Ответ',color:'#ffc566',sound:'xrono_click',trim:18}
];
const presets=[
 {id:'four',label:'Пульс',detail:'4 ровных удара',points:[0,4,8,12]},
 {id:'backbeat',label:'Бэкбит',detail:'На 2 и 4',points:[4,12]},
 {id:'offbeat',label:'Между долями',detail:'Ответ бочке',points:[2,6,10,14]},
 {id:'eighths',label:'Восьмые',detail:'8 ровных ударов',points:[0,2,4,6,8,10,12,14]},
 {id:'tresillo',label:'3–3–2',detail:'Короткий мотив',points:R.dictionary.find(d=>d.id==='tresillo').points},
 {id:'empty',label:'С чистого листа',detail:'Нарисовать вручную',points:[]}
];
const events=(points,velocity=.8)=>points.map(time=>({time:time/N,velocity}));
function initial(){
 const tracks=voices.map((v,i)=>({id:v.id,sound:v.id,gain:[.85,.72,.55,.65][i],mute:false,solo:false,events:events([[0,4,8,12],[4,12],[2,6,10,14],[3,10,15]][i],[.95,.8,.7,.55][i])}));
 tracks[2].events.forEach((e,i)=>e.velocity=i%2?.5:.7);
 return{schema:'beat-builder/1',title:'После дейлика',bpm:128,patterns:{A:clone(tracks),B:clone(tracks)},chain:['A','A','A','B']};
}
function validate(p){
 const finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
 if(p?.schema!=='beat-builder/1'||typeof p.title!=='string'||p.title.length>80||!finite(p.bpm,50,200)||!Array.isArray(p.chain)||p.chain.length!==4||p.chain.some(x=>!['A','B'].includes(x)))throw Error('Нужен проект beat-builder/1 с вариантами A и B');
 for(const key of ['A','B']){
  const ts=p.patterns?.[key];if(!Array.isArray(ts)||ts.length!==4)throw Error('Нужны четыре партии');
  ts.forEach((t,i)=>{if(t?.id!==voices[i].id||!voices.some(v=>v.id===t.sound)||!finite(t.gain,0,1)||typeof t.mute!=='boolean'||typeof t.solo!=='boolean'||!Array.isArray(t.events)||t.events.length>64||t.events.some(e=>!Number.isFinite(e.time)||e.time<0||e.time>=1||!finite(e.velocity,0,1)))throw Error('Неверная партия '+key);});
 }
 return p;
}
function grid(track){const x=Array(N).fill(0);for(const e of track.events)x[R.mod(Math.round(e.time*N),N)]+=e.velocity;return x;}
function isGrid(track){return track.events.every(e=>Math.abs(e.time*N-Math.round(e.time*N))<1e-6);}
function fromGrid(x){return x.flatMap((v,i)=>v>EPS?[{time:i/N,velocity:Math.min(1,v)}]:[]);}
function rotate(es,amount){return es.map(e=>({...e,time:wrap(e.time+amount)}));}
function swing(es,amount){return es.map(e=>({...e,time:wrap(e.time+(Math.floor(e.time*N+1e-7)%2?amount/(2*N):0))}));}
function accent(es,amount){return es.map(e=>({...e,velocity:e.velocity*(1-amount*(Math.abs(e.time*4-Math.round(e.time*4))<1e-6?0:.7))}));}
function mirror(es,axis,amount){const x=grid({events:es});if(x.some(v=>v>1+EPS))throw Error('Для зеркала оставьте не более одного полного удара на клетку.');return fromGrid(R.mirror(x,axis,amount));}
function complement(reference,count){
 const occupied=grid(reference),free=Array.from({length:N},(_,i)=>i).filter(i=>occupied[i]<EPS);
 const take=Math.min(count,free.length),picked=Array.from({length:take},(_,j)=>free[Math.floor(j*free.length/take)]);
 return{events:events(picked,.65),available:free.length,exact:false};
}
function canon(reference){
 if(!isGrid(reference))return{error:'Для точного дополнения нужна сетка 1/16. Свободный рисунок можно дополнить обычным ответом.'};
 const motif=grid(reference).flatMap((x,i)=>x>EPS?[i]:[]),solutions=R.complements(N,motif);
 // Pick a cover containing the actual, unshifted reference. Other copies
 // become the new party; the reference track is never replaced.
 const entries=solutions.find(xs=>xs.includes(0));
 if(!entries)return{error:'Копиями этого мотива нельзя без наложений закрыть 16 шагов. Попробуйте обычный ответ.'};
 const rest=entries.filter(x=>x!==0),coverage=R.coverage(N,motif,rest);
 return{events:fromGrid(coverage.map(x=>x*.6)),copies:rest.length,entries:rest,exact:true};
}
function fill(es,count){return es.filter(e=>e.time<.75-EPS).concat(events(Array.from({length:count},(_,i)=>12+i*4/count),.65).map((e,i)=>({...e,velocity:.5+.4*(i+1)/count})));}
function scratch(es,k,phase,magnitude){
 if(!es.length)return{events:[],limited:false};
 const source=es.map(e=>R.polar(e.velocity*2,TAU*e.time)),s={source,coefficients:R.dft(source),selected:k};
 const old=s.coefficients[k],base=R.abs(old)>1e-10?Math.atan2(old[1],old[0]):0;
 const result=R.setCoefficient(s,k,R.polar(magnitude,base+phase));
 return{events:R.scratchPoints(s).filter(e=>e.time!==null).map(e=>({time:e.time,velocity:Math.min(1,e.strength/2)})),limited:result.limited};
}
function analysis(track,reference){
 const x=grid(track),r=reference?grid(reference):Array(N).fill(0),hits=track.events.filter(e=>e.velocity>EPS).length;
 const coincident=track.events.filter(e=>reference?.events.some(a=>Math.abs(wrap(e.time-a.time+.5)-.5)<1e-5)).length;
 const z=track.events.reduce((s,e)=>[s[0]+Math.cos(TAU*e.time),s[1]+Math.sin(TAU*e.time)],[0,0]);
 return{hits,coincident,free:x.filter((v,i)=>v<EPS&&r[i]<EPS).length,balance:hits?R.abs(z)/hits:0,onGrid:isGrid(track),atoms:isGrid(track)?R.decompose(x.map(v=>v>EPS?1:0)):null};
}
function score(p,{pattern='A',chain=false}={}){
 const sequence=chain?p.chain:Array(4).fill(pattern),out=[];
 sequence.forEach((key,bar)=>{
  const tracks=p.patterns[key],solo=tracks.some(t=>t.solo);
  tracks.forEach((t,i)=>{if(t.mute||(solo&&!t.solo))return;const v=voices.find(v=>v.id===t.sound);
   t.events.forEach(e=>{if(e.velocity>EPS&&t.gain>0)out.push({start:(bar+e.time)/4,velocity:e.velocity,gain:v.trim*t.gain,part:i,instrument:t.sound,note:60,gateSeconds:.055});});
  });
 });return out;
}
function exportStrudel(p,sampleBase){
 validate(p);const base=new URL(sampleBase);if(!['https:','http:'].includes(base.protocol))throw Error('Для экспорта нужна HTTP-ссылка на семплы');
 const literal=s=>"'"+s.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'";
 const lines=['// Beat Builder · '+p.title.replace(/[\r\n\u2028\u2029]/g,' '),'// Одна Strudel-итерация = такт 4/4. Четыре такта повторяются по кругу.',`setcpm(${p.bpm} / 4)`,`samples({ xrono_kick: ['kick/0.wav'], xrono_hat: ['biba_closed_hat/0.wav'], xrono_clap: ['biba_clap/0.wav'], xrono_click: ['biba_claves/0.wav'] }, ${literal(base.href)})`];
 for(const key of ['A','B']){
  lines.push(`const ${key} = stack(`);const tracks=p.patterns[key],solo=tracks.some(t=>t.solo),rows=[];
  tracks.forEach(t=>{
   if(t.mute||(solo&&!t.solo)||!t.events.length||!t.gain)return;const v=voices.find(v=>v.id===t.sound),gridOK=isGrid(t)&&grid(t).every(x=>x<=1)&&new Set(t.events.map(e=>Math.round(e.time*N))).size===t.events.length;
   const finish=`.note(60).gain(${v.trim*t.gain}).attack(.003).decay(.05).sustain(.25).release(.035)`;
   if(gridOK){const x=grid(t);rows.push(`  s(${JSON.stringify(x.map(n=>n>EPS?v.sound:'~').join(' '))}).velocity(${JSON.stringify(x.map(n=>Number(n.toFixed(9))).join(' '))}).legato(${.055/(240/p.bpm/N)})${finish}`);}
   else for(const e of t.events.filter(e=>e.velocity>EPS))rows.push(`  s('${v.sound}').late(${e.time}).velocity(${e.velocity}).legato(${.055/(240/p.bpm)})${finish}`);
  });
  lines.push(rows.length?rows.join(',\n'):'  silence',')');
 }
 lines.push(`cat(${p.chain.join(', ')})`);return lines.join('\n')+'\n';
}
return{N,TAU,EPS,clone,wrap,voices,presets,events,initial,validate,grid,isGrid,fromGrid,rotate,swing,accent,mirror,complement,canon,fill,scratch,analysis,score,exportStrudel};
});
