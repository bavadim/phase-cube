/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Distinct representations, not one alleged universal "musical Fourier" space.
 * Sources and adaptations: README.md. Normalized forward DFT, unscaled inverse. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RhythmMethods=factory();})(globalThis,function(){
'use strict';
const TAU=2*Math.PI,EPS=1e-9,clone=x=>JSON.parse(JSON.stringify(x)),wrap=x=>((x%1)+1)%1,mod=(x,n)=>((x%n)+n)%n;
const polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)],abs=z=>Math.hypot(z[0],z[1]);
function transform(input,inverse=false){const n=input.length;return Array.from({length:n},(_,k)=>{let re=0,im=0;input.forEach((z,j)=>{const t=(inverse?1:-1)*TAU*j*k/n,c=Math.cos(t),s=Math.sin(t);re+=z[0]*c-z[1]*s;im+=z[0]*s+z[1]*c;});return[re/(inverse?1:n),im/(inverse?1:n)];});}
const dft=z=>transform(z),idft=a=>transform(a,true);
const modes=['scratch','mirror','canon','dictionary'];
const descriptions={
 scratch:{title:'Деформация мотива',control:'Спектр событий',result:'Время и сила ударов',help:'Выберите коэффициент и тяните конец его стрелки. Угол и длина меняют всю фразу.',source:'Amiot, Noll, Andreatta, Agon · 2006, §2',url:'https://www.researchgate.net/publication/228916245_Fourier_Oracles_for_Computer-Aided_Improvisation',formula:'zⱼ = vⱼ exp(2πitⱼ); a = DFT(z); z′ = IDFT(a′)',guarantee:'События сохраняют идентичность; при z = 0 событие молчит. Порядок и интервалы могут меняться. Граница |z| ≤ 2 — наше ограничение силы, не теорема о хорошем ритме.'},
 mirror:{title:'Зеркальная симметрия',control:'Исходные удары и ось',result:'Симметричный результат',help:'Тяните ось зеркала. Радиус исходного удара меняет его силу. Ползунок постепенно делает рисунок симметричным.',source:'Beauguitte · 2011, §1.6; проекция на симметрию — наша адаптация',url:'https://www.atiam.ircam.fr/Archives/Stages1011/Beauguitte.pdf',formula:'Rₘx[n] = x[(m−n) mod N]; y = (1−λ/2)x + (λ/2)Rₘx',guarantee:'Сила неотрицательна, её сумма сохраняется. При λ = 1 результат точно зеркален. Позиции фиксированы; меняются акценты и паузы. Это не баланс PB.'},
 canon:{title:'Дополняющие партии',control:'Один мотив · нажмите доли',result:'Копии мотива и их вступления',help:'Меняйте мотив слева. «Подобрать вступления» ищет точное покрытие цикла. Справа тяните подписанные начала копий.',source:'Amiot, Sethares · An Algebra for Periodic Rhythms and Scales, §5',url:'https://sethares.engr.wisc.edu/paperspdf/AlgofScales.pdf',formula:'1ₐ ∗ 1ᵦ = 1; Â[k] B̂[k] = 0 при k ≠ 0',guarantee:'При точном покрытии на каждом из 16 шагов один удар. Ручное перемещение может создать пропуски и наложения — они показаны явно. Поиск исчерпывающий для этой сетки, не для всех периодов.'},
 dictionary:{title:'Словарь мотивов',control:'Фигуры-мотивы · угол и сила',result:'Сумма выбранных мотивов',help:'Нарисуйте цель на сетке и нажмите «Разложить». Выбирайте фигуру, вращайте и меняйте её силу. Можно добавлять мотивы вручную.',source:'Amiot, Sethares · §2 и §5; ограниченная дискретная адаптация',url:'https://sethares.engr.wisc.edu/paperspdf/AlgofScales.pdf',formula:'y = Σ cⱼ Tᵦⱼ mⱼ, cⱼ ≥ 0',guarantee:'Разложение минимизирует число непересекающихся мотивов из четырёх заданных семейств. Это точная целочисленная задача на 16 шагах, не общий L1-алгоритм статьи. При ремиксе совпадения складываются.'}
};
const dictionary=[{id:'hit',label:'Один удар',points:[0]},{id:'pair',label:'Пара',points:[0,8]},{id:'four',label:'Четыре',points:[0,4,8,12]},{id:'tresillo',label:'3–3–2',points:[0,6,12]}];
function scratchPreset(id='regular'){
 const times=id==='clave'?[0,3/16,6/16,10/16,12/16]:Array.from({length:8},(_,i)=>i/8);
 const source=times.map((t,j)=>polar(id==='clave'?[1,.65,.85,1,.7][j]:1,TAU*t));
 return{preset:id,source,coefficients:dft(source),selected:Math.min(2,source.length-1)};
}
function initial(){const s={schema:'rhythm-methods/1',mode:'scratch',bpm:120,volume:1,sound:'click',comparison:'result',scratch:scratchPreset(),mirror:{source:Array.from({length:16},(_,i)=>({0:1,3:.65,6:.85,9:.5,12:1}[i]||0)),axis:0,amount:1},canon:{n:16,motif:[0,1,4,5],entries:[0,2,8,10],selected:0},dictionary:{n:16,target:Array.from({length:16},(_,i)=>[0,2,4,8,10,12].includes(i)?1:0),atoms:[],selected:0}};s.dictionary.atoms=decompose(s.dictionary.target);return s;}
function scratchPoints(s,source=false){return(source?s.source:idft(s.coefficients)).map((z,j)=>({id:j,z:z.slice(),strength:abs(z),time:abs(z)>EPS?wrap(Math.atan2(z[1],z[0])/TAU):null}));}
function setCoefficient(s,k,candidate){
 if(!Number.isInteger(k)||k<0||k>=s.coefficients.length||!Array.isArray(candidate)||candidate.length!==2||!candidate.every(Number.isFinite))throw Error('Неверный коэффициент');
 const old=s.coefficients[k].slice(),cs=clone(s.coefficients),norm=abs(candidate);if(norm>2)candidate=candidate.map(v=>v*2/norm);
 const valid=c=>{cs[k]=c;return idft(cs).every(z=>abs(z)<=2+1e-10);};let limited=!valid(candidate);
 if(limited){let lo=0,hi=1;for(let j=0;j<48;j++){const t=(lo+hi)/2,c=old.map((v,i)=>v+(candidate[i]-v)*t);if(valid(c))lo=t;else hi=t;}candidate=old.map((v,i)=>v+(candidate[i]-v)*lo);}
 s.coefficients[k]=candidate;s.selected=k;return{limited};
}
function setPhase(s,k,angle){
 if(!Number.isFinite(angle)||!s.coefficients[k])throw Error('Неверная фаза');
 const c=s.coefficients[k],r=abs(c),start=Math.atan2(c[1],c[0]),cs=clone(s.coefficients);
 const at=t=>polar(r,start+(angle-start)*t),valid=t=>{cs[k]=at(t);return idft(cs).every(z=>abs(z)<=2+1e-10);};
 let low=0,high=1,limited=false;
 for(let j=1;j<=128;j++){const t=j/128;if(!valid(t)){low=(j-1)/128;high=t;limited=true;break;}}
 if(limited)for(let j=0;j<48;j++){const t=(low+high)/2;if(valid(t))low=t;else high=t;}
 s.coefficients[k]=at(limited?low:1);s.selected=k;return{limited};
}
function mirror(source,axis,amount=1){const n=source.length;return source.map((v,j)=>(1-amount/2)*v+amount/2*source[mod(axis-j,n)]);}
function mirrorError(x,axis){return x.reduce((s,v,j)=>s+Math.abs(v-x[mod(axis-j,x.length)]),0)/Math.max(EPS,x.reduce((s,v)=>s+v,0));}
function coverage(n,motif,entries){const x=Array(n).fill(0);for(const b of entries)for(const a of motif)x[mod(a+b,n)]++;return x;}
function complements(n,motif){
 if(!Number.isInteger(n)||n<1||n>16||!Array.isArray(motif)||new Set(motif).size!==motif.length||motif.some(x=>!Number.isInteger(x)||x<0||x>=n))throw Error('Неверный мотив канона');
 if(!motif.length||n%motif.length)return[];
 const full=(1<<n)-1,placements=Array.from({length:n},(_,b)=>motif.reduce((s,a)=>s|(1<<mod(a+b,n)),0)),results=[];
 function visit(mask,entries){if(mask===full){results.push(entries.slice().sort((a,b)=>a-b));return;}let first=0;while(mask&(1<<first))first++;for(let b=0;b<n;b++)if((placements[b]&(1<<first))&&!(placements[b]&mask))visit(mask|placements[b],entries.concat(b));}
 visit(0,[]);return results.sort((a,b)=>a.join(',').localeCompare(b.join(',')));
}
function atomPoints(a){const m=dictionary.find(m=>m.id===a.kind);if(!m)throw Error('Неизвестный мотив');return m.points.map(p=>mod(p+a.shift,16));}
function dictionaryResult(atoms){const x=Array(16).fill(0);for(const a of atoms)for(const j of atomPoints(a))x[j]+=a.gain;return x;}
function decompose(target){
 if(!Array.isArray(target)||target.length!==16||target.some(x=>x!==0&&x!==1))throw Error('Нужна двоичная цель из 16 шагов');
 const mask=target.reduce((s,v,i)=>s|(v<<i),0),candidates=[];
 for(const d of dictionary)for(let shift=0;shift<16;shift++){const a={kind:d.id,shift,gain:1},m=atomPoints(a).reduce((s,j)=>s|(1<<j),0);if((m&mask)===m&&!candidates.some(c=>c.mask===m))candidates.push({mask:m,atom:a});}
 candidates.sort((a,b)=>bitCount(b.mask)-bitCount(a.mask));const memo=new Map([[0,[]]]);
 function solve(rest){if(memo.has(rest))return memo.get(rest);let first=0;while(!(rest&(1<<first)))first++;let best=null;for(const c of candidates)if((c.mask&(1<<first))&&(c.mask&rest)===c.mask){const tail=solve(rest^c.mask);if(tail&&(!best||tail.length+1<best.length)){best=[c.atom,...tail];if(best.length===1)break;}}memo.set(rest,best);return best;}
 return clone(solve(mask)||[]);
}
function bitCount(mask){let n=0;for(;mask;mask&=mask-1)n++;return n;}
function sourceVector(s){switch(s.mode){case'mirror':return s.mirror.source.slice();case'canon':return coverage(16,s.canon.motif,[0]);case'dictionary':return s.dictionary.target.slice();default:return null;}}
function resultVector(s){switch(s.mode){case'mirror':return mirror(s.mirror.source,s.mirror.axis,s.mirror.amount);case'canon':return coverage(16,s.canon.motif,s.canon.entries);case'dictionary':return dictionaryResult(s.dictionary.atoms);default:return null;}}
function score(s,source=s.comparison==='source'){
 let rows;
 if(s.mode==='scratch')rows=scratchPoints(s.scratch,source).filter(e=>e.time!==null).map(e=>({start:e.time,velocity:e.strength/2,part:e.id,gain:.1}));
 else rows=(source?sourceVector(s):resultVector(s)).flatMap((v,j)=>v>EPS?[{start:j/16,velocity:Math.min(1,v/2),part:j,gain:.22}]:[]);
 // The local CC0 claves one-shot is ~40 dB below the clap/kick. A fixed trim
 // calibrates that asset; never normalize an edited pattern or its accents.
 return rows.map(e=>({...e,gain:e.gain*(s.sound==='click'?80:1),instrument:s.sound,note:s.sound==='bass'?48:s.sound==='bell'?67:60,gateSeconds:.055}));
}
function validate(s){
 const finite=(x,a,b)=>Number.isFinite(x)&&x>=a&&x<=b,ints=(xs,n)=>Array.isArray(xs)&&xs.length<=16&&xs.every(v=>Number.isInteger(v)&&v>=0&&v<n);
 if(s?.schema!=='rhythm-methods/1'||!modes.includes(s.mode)||!finite(s.bpm,50,200)||!finite(s.volume,0,1)||!['kick','hat','bass','bell','clap','click'].includes(s.sound)||!['source','result'].includes(s.comparison))throw Error('Неверный формат лаборатории');
 const a=s.scratch;if(!a||!['regular','clave'].includes(a.preset)||!Array.isArray(a.source)||![5,8].includes(a.source.length)||!Array.isArray(a.coefficients)||a.coefficients.length!==a.source.length||![a.source,a.coefficients].every(xs=>xs.every(z=>Array.isArray(z)&&z.length===2&&z.every(Number.isFinite)&&abs(z)<=2+1e-8))||idft(a.coefficients).some(z=>abs(z)>2+1e-8)||!Number.isInteger(a.selected)||a.selected<0||a.selected>=a.source.length)throw Error('Неверный спектр');
 const m=s.mirror;if(!m||!Array.isArray(m.source)||m.source.length!==16||!m.source.every(x=>finite(x,0,1))||!Number.isInteger(m.axis)||m.axis<0||m.axis>=16||!finite(m.amount,0,1))throw Error('Неверное зеркало');
 const c=s.canon;if(!c||c.n!==16||!ints(c.motif,16)||new Set(c.motif).size!==c.motif.length||!ints(c.entries,16)||!Number.isInteger(c.selected)||c.selected<0||c.selected>=Math.max(1,c.entries.length))throw Error('Неверный канон');
 const d=s.dictionary;if(!d||d.n!==16||!Array.isArray(d.target)||d.target.length!==16||d.target.some(x=>x!==0&&x!==1)||!Array.isArray(d.atoms)||d.atoms.length>16||d.atoms.some(a=>!dictionary.some(m=>m.id===a.kind)||!Number.isInteger(a.shift)||a.shift<0||a.shift>=16||!finite(a.gain,0,2))||!Number.isInteger(d.selected)||d.selected<0||d.selected>=Math.max(1,d.atoms.length))throw Error('Неверный словарь');
 return s;
}
return{TAU,EPS,clone,wrap,mod,polar,abs,dft,idft,modes,descriptions,dictionary,initial,scratchPreset,scratchPoints,setCoefficient,setPhase,mirror,mirrorError,coverage,complements,atomPoints,dictionaryResult,decompose,sourceVector,resultVector,score,validate};
});
