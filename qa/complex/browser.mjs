/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'complex-riff-ui-audio/1',engine:r.engine,physicalDevice:false,errors:[],cases:[]};
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
try{
 for(const [width,height] of [[1280,800],[390,844]]){
  const c=await r.browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(r.url+'/?debug=1&puzzle=fourier&song=turkish-circuit');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);await p.locator('#start').click();await settled(p);
  await p.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  const key=await p.evaluate(()=>FourierModel.keys[phaseCubeApp.getPuzzle().parameters().findIndex(v=>v.level>0)]);await select(p,key,width<500);
  await p.mouse.move(0,0);await p.waitForFunction(()=>!phaseCubeApp.getEqualizer().motion);
  const before=await p.evaluate(()=>{
   window.qaNodes=[...document.querySelectorAll('.score-event')];
   const m=phaseCubeApp.getPuzzle(),id=FourierModel.keys.indexOf(m.selected),score=phaseCubeApp.getEqualizer();
   return{state:m.snapshot(),id,ratio:(FourierModel.levels[m.parameters()[id].level-1]/FourierModel.levels[m.parameters()[id].level]),rows:score.rows.map(r=>[...r.positions.values()]),opacity:score.rows.map(r=>getComputedStyle(r.g).opacity),audio:phaseCubeApp.getTransport().active.meta.state};
  });
  await p.locator('#magnitude-down').hover();await p.waitForFunction(()=>!phaseCubeApp.getEqualizer().motion);
  const preview=await p.evaluate(()=>{const s=phaseCubeApp.getEqualizer();return{changed:s.forecast.changed,rows:s.rows.map(r=>[...r.positions.values()]),state:phaseCubeApp.state(),audio:phaseCubeApp.getTransport().active.meta.state,sameNodes:qaNodes.every((n,i)=>n===document.querySelectorAll('.score-event')[i]),opacity:s.rows.map(r=>getComputedStyle(r.g).opacity),filter:s.rows[FourierModel.keys.indexOf(phaseCubeApp.getPuzzle().selected)].current.querySelector('.current-event').style.filter};});
  assert.deepEqual(preview.changed,[before.id]);assert.equal(preview.state,before.state);assert.equal(preview.audio,before.audio);assert(preview.sameNodes);assert.deepEqual(preview.opacity,before.opacity);assert(preview.filter.startsWith('brightness('));
  for(let i=0;i<6;i++){
   const byId=new Map(before.rows[i].map(e=>[e.id,e]));
   for(const event of preview.rows[i]){const old=byId.get(event.id);close(event.start,old.start);event.levels.forEach((v,j)=>close(v,old.levels[j]*(i===before.id?before.ratio:1)));}
  }
  await p.locator('#magnitude-down').click();await p.mouse.move(0,0);await settled(p);await p.waitForFunction(()=>!phaseCubeApp.getEqualizer().motion);
  const after=await p.evaluate(()=>({rows:phaseCubeApp.getEqualizer().rows.map(r=>[...r.positions.values()]),state:phaseCubeApp.state(),audio:phaseCubeApp.getTransport().active.meta.state,committed:phaseCubeApp.getEqualizer().committed}));
  assert.notEqual(after.state,before.state);assert.equal(after.audio,after.state);assert.equal(after.committed,null);assert.deepEqual(after.rows,preview.rows);
  await p.locator('#undo').click();await p.mouse.move(0,0);await settled(p);assert.equal(await p.evaluate(()=>phaseCubeApp.state()),before.state);
  // A short riff repeats on the global circle; its own phase uses that shorter period.
  const short=await p.evaluate(()=>{const periods=phaseCubeApp.getPreparation().binding.periods,id=Math.max(0,periods.findIndex(p=>p<1));return{id,key:FourierModel.keys[id],period:periods[id]};});await select(p,short.key,width<500);
  await p.locator('#turn-left').hover();await p.waitForFunction(()=>!phaseCubeApp.getEqualizer().motion);
  const phase=await p.evaluate(id=>{
   const m=phaseCubeApp.getPuzzle(),music=phaseCubeApp.getMusic(),score=phaseCubeApp.getEqualizer(),f=score.forecast,source=music.rows(m.snapshot())[id],row=f.rows[id];
   return{changed:f.changed,period:f.phases[id].period,differences:row.map(e=>{const old=source.find(v=>v.id===e.id);return{delta:((e.start-old.start+1.5)%1)-.5,gain:[e.value.postgain??1,old.value.postgain??1]};}),cycles:score.rows[id].cycleTicks.length};
  },short.id);
  assert.deepEqual(phase.changed,[short.id]);close(phase.period,short.period);assert.equal(phase.cycles,Math.round(1/short.period));phase.differences.forEach(e=>{close(e.delta,-short.period/8);close(...e.gain);});
  const clock=await p.evaluate(id=>{
   const s=phaseCubeApp.getEqualizer(),row=s.rows[id],anchor=row.positions.values().next().value.start;
   return [0,.25,.5,.75].map(t=>{const global=(anchor+t*row.period)%1;s.frame(global,true);return{global,local:Number(row.g.dataset.localPhase),hand:s.sweep.getAttribute('transform'),ticks:row.cycleTicks.map(n=>['x1','y1'].map(a=>Number(n.getAttribute(a))))};});
  },short.id);
  clock.forEach((v,i)=>{close(v.local,i/4);assert(v.hand.startsWith(`rotate(${v.global*360} `));assert.deepEqual(v.ticks,clock[0].ticks);});
  assert.equal(await p.locator('#clock-hand').count(),1);
  const independentClocks=await p.evaluate(()=>{
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),score=new PuzzleEqualizer.Score(svg,phaseCubeApp.getGame().voices);
   const periods=[.25,.5,1,1/3,1/6,1],rows=periods.map((period,id)=>Array.from({length:Math.round(1/period)},(_,i)=>({id:id+':'+i,start:i*period,duration:.02,value:{velocity:.8}}))),phases=periods.map((period,i)=>({period,controlKey:FourierModel.keys[i],aligned:true,gain:1}));
   score.reduced=true;
   return periods.map((period,i)=>{score.update({rows,target:rows,phases,selectedKey:FourierModel.keys[i]});score.frame(.125,true);return{period,local:Number(score.rows[i].g.dataset.localPhase),ticks:score.rows[i].cycleTicks.length,hand:score.sweep.getAttribute('transform')};});
  });
  independentClocks.forEach(v=>{close(v.local,(.125/v.period)%1);assert.equal(v.ticks,1/v.period);assert(v.hand.startsWith('rotate(45 '));});
  await p.mouse.move(0,0);await p.screenshot({path:join(root,`qa/complex/${r.engine}-${width}.png`)});
  report.cases.push({width,height,volumeOnlySelectedRiff:true,nativeAudioCommit:true,persistentEvents:true,noOtherTrackDimming:true,ownPeriod:short.period,oneMasterLocator:true,localPhaseCorrect:true,differentPeriodsFixture:independentClocks});await c.close();
 }
 // Native audio test: the same projected riff, rendered by pinned Strudel/Superdough.
 // One context owns every node of each render; no substitute synth or gain processing.
 const c=await r.browser.newContext(),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(r.url+'/?debug=1&puzzle=fourier');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);
 report.pcm=await p.evaluate(async()=>{
  const S=strudel,app=phaseCubeApp,model=new FourierModel.Model(),base=S.note('c4 e4 g4 e4').s('sine').gain(.4).distort(.4).clip(.15),row=PhaseCubeLibrary.eventsOf(base,1).map((e,i)=>({...e,id:'0:'+i}));
  const fixture={puzzle:{manifest:FourierPuzzle.manifest,model},binding:{periods:Array(6).fill(FourierBinding.period(row))},fragments:{periodBars:1,targetRows:Array(6).fill(row),basePatterns:Array(6).fill(base)}};
  const states=[0,model.applyTo(0,'A-'),model.applyTo(model.applyTo(0,'A-'),'A-'),model.applyTo(0,"A'")];
  const jobs=states.map(state=>({pattern:PuzzleProjection.project(S,fixture,state).patterns[0],bars:1,cps:1}));
  for(const id of ['turkish-circuit','steel-shift','elise-after-hours']){
   await app.choose({songId:id,puzzleId:'fourier'});const music=app.getMusic(),song=app.getSong(),m=app.getPuzzle();
   let aligned=m.snapshot();for(const key of FourierModel.keys){const move=m.editMove(key,{phase:2,level:2},aligned);if(move)aligned=m.applyTo(aligned,move);}
   for(const state of [0,aligned])jobs.push({id,state,pattern:S.stack(song.backing,music.pattern(state)),bars:song.periodBars,cps:song.bpm/240});
  }
  let total=0;jobs.forEach(job=>{job.offset=total;job.length=job.bars/job.cps+2;total+=job.length;});
  await S.getAudioContext().close();
  const ac=new OfflineAudioContext(2,Math.ceil(total*48000),48000);S.setAudioContext(ac);S.setSuperdoughAudioController(null);await S.initAudio({maxPolyphony:4096,multiChannelOrbits:false});
  for(const [orbit,job] of jobs.entries()){
   job.events=0;
   for(const h of job.pattern.queryArc(0,job.bars,{_cps:job.cps}).filter(h=>h.hasOnset()).sort((a,b)=>Number(a.whole.begin)-Number(b.whole.begin))){
    const t=job.offset+Number(h.whole.begin)/job.cps;await S.webaudioOutput(h.withValue(v=>({...v,orbit})),t,Number(h.duration)/job.cps,job.cps,t);job.events++;
   }
  }
  const buffer=await ac.startRendering(),channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
  const results=jobs.map(({id,state,offset,length,events})=>{
   let sum=0,peak=0,count=0,clipped=0;
   for(const channel of channels)for(let i=Math.round(offset*48000);i<Math.min(channel.length,Math.round((offset+length)*48000));i++){const v=channel[i];if(!Number.isFinite(v))throw Error('Nonfinite native audio');sum+=v*v;peak=Math.max(peak,Math.abs(v));if(Math.abs(v)>=1)clipped++;count++;}
   return{id,state,rms:Math.sqrt(sum/count),peak,clipped,events};
  });
  S.resetGlobalEffects();const levels=results.slice(0,4),mixed=results.slice(4);
  return{levels,ratios:levels.map(v=>v.rms/levels[0].rms),mixed,singleContinuousContext:true,scope:'isolated distorted synth ratios plus target and one aligned-phase mix per score; not exhaustive'};
 });
 assert(report.pcm.levels[0].rms>.001);report.pcm.ratios.forEach((v,i)=>assert(Math.abs(v-[1,.75,.5,1][i])<.002,`Native gain/phase RMS ${i}: ${v}`));assert(report.pcm.mixed.every(v=>v.events>0&&v.rms>.0001&&v.clipped===0));await c.close();
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));await writeFile(join(root,`qa/complex/${r.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify({status:report.status,cases:report.cases.length,pcm:report.pcm,failure:report.failure}));
}
