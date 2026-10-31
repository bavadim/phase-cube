/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select,targets} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'continuous-riff-controls/1',engine:r.engine,physicalDevice:false,cases:[],errors:[]};
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
try{
 for(const [width,height] of [[1280,800],[390,844]]){
  const c=await r.browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(r.url+'/?debug=1&puzzle=fourier&song=elise-after-hours');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);await p.locator('#start').click();await settled(p);await p.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
  await select(p,'A',width<500);await p.mouse.move(0,0);await p.waitForFunction(()=>!phaseCubeApp.getEqualizer().motion);
  const initial=await p.evaluate(()=>({state:phaseCubeApp.state(),history:phaseCubeApp.getPuzzle().history.length,p:phaseCubeApp.getPuzzle().parameters()[0],master:phaseCubeApp.diagnostics().masterGain,buses:phaseCubeApp.getTransport().entries.map(e=>e.bus.output.gain.value)}));assert.equal(initial.master,1);assert(initial.buses.every(g=>g===1));
  const start=(await targets(p)).find(t=>t.key==='A'&&t.kind==='point');await p.mouse.move(start.x,start.y);await p.mouse.down();const samples=[];
  for(const step of [.30,.35,.40]){
   const point=await p.evaluate(({initial,step})=>{const phase=initial.p.phase+step,gain=FourierModel.levels[initial.p.level]+step/5,a=phase*Math.PI/4,k=1.15/2;return phaseCubeApp.getPresentation().project(new THREE.Vector3(gain*k*Math.cos(a),gain*k*Math.sin(a),0));},{initial,step});
   await p.mouse.move(point.x,point.y,{steps:4});
   samples.push(await p.evaluate(()=>{const s=phaseCubeApp.getEqualizer(),f=s.forecast;return{state:phaseCubeApp.state(),history:phaseCubeApp.getPuzzle().history.length,continuous:f?.continuous,changed:f?.changed,point:f?.point,move:f?.move,motion:!!s.motion,heard:phaseCubeApp.getTransport().active.meta.state,rows:s.rows.map(r=>[...r.positions.values()])};}));
  }
  for(const v of samples){assert(v.continuous);assert.deepEqual(v.changed,[0]);assert.equal(v.state,initial.state);assert.equal(v.heard,initial.state);assert.equal(v.history,initial.history);assert.equal(v.move,null);assert.equal(v.motion,false);}
  assert.notDeepEqual(samples[0].rows[0],samples[1].rows[0]);assert.notDeepEqual(samples[1].rows[0],samples[2].rows[0]);assert.deepEqual(samples[0].rows.slice(1),samples[2].rows.slice(1));
  await p.mouse.up();await settled(p);assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().history.length),initial.history,'Sub-step preview does not create a no-op move');
  async function dragTo(gain,phase){
   const from=(await targets(p)).find(t=>t.key==='A'&&t.kind==='point'),to=await p.evaluate(({gain,phase})=>{const a=phase*Math.PI/4,k=1.15/2;return phaseCubeApp.getPresentation().project(new THREE.Vector3(gain*k*Math.cos(a),gain*k*Math.sin(a),0));},{gain,phase});
   await p.mouse.move(from.x,from.y);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:12});await p.mouse.up();await settled(p);
  }
  const phase=initial.p.phase;await dragTo(0,phase);assert.equal(await p.evaluate(()=>FourierModel.levels[phaseCubeApp.getPuzzle().parameters()[0].level]),0);
  assert.equal(await p.evaluate(()=>phaseCubeApp.getPuzzle().parameters()[0].phase),phase);
  await p.mouse.move(0,0);await p.waitForFunction(()=>!phaseCubeApp.getEqualizer().motion);
  const muted=await p.evaluate(()=>{const s=phaseCubeApp.getEqualizer(),row=s.rows[0];s.frame(.2,true);return{hidden:[...row.current.querySelectorAll('.current-event')].every(e=>e.style.display==='none'||e.style.opacity==='0'),flashes:row.current.querySelectorAll('.sounding').length};});assert(muted.hidden);assert.equal(muted.flashes,0);
  await dragTo(2,phase);assert.equal(await p.evaluate(()=>FourierModel.levels[phaseCubeApp.getPuzzle().parameters()[0].level]),2);assert.equal(await p.locator('#magnitude-up').isDisabled(),true);
  await p.locator('#undo').click();await settled(p);assert.equal(await p.evaluate(()=>FourierModel.levels[phaseCubeApp.getPuzzle().parameters()[0].level]),0);
  await p.locator('#magnitude-up').click();await settled(p);assert.equal(await p.evaluate(()=>FourierModel.levels[phaseCubeApp.getPuzzle().parameters()[0].level]),.25,'Plus must leave zero');
  const contour=await p.evaluate(()=>{
   const music=phaseCubeApp.getMusic(),m=phaseCubeApp.getPuzzle(),state=m.applyTo(0,"C'"),goal=music.rows(0),shift=music.rows(state),id=2;
   const shape=row=>row.map(e=>[e.start,e.duration]).sort((a,b)=>a[0]-b[0]),withNotes=row=>row.map(e=>[e.start,e.pitch]).sort((a,b)=>a[0]-b[0]);
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),s=new PuzzleEqualizer.Score(svg,phaseCubeApp.getGame().voices);s.reduced=true;
   s.update({rows:goal,target:goal,phases:music.phases(0),selectedKey:'C'});const paths=()=>[...s.rows[id].current.querySelectorAll('.current-event')].map(n=>n.getAttribute('d')).sort();const before=paths();
   s.update({rows:shift,target:goal,phases:music.phases(state),selectedKey:'C'});
   return{rhythm:[shape(goal[id]),shape(shift[id])],notes:[withNotes(goal[id]),withNotes(shift[id])],paths:[before,paths()],solved:m.solved(state),aliases:[-16,-8,0,8,16].map(n=>m.editMove('C',{phase:FourierModel.homePhase[2]+n,level:4},0))};
  });
  assert.deepEqual(contour.rhythm[0],contour.rhythm[1]);assert.notDeepEqual(contour.notes[0],contour.notes[1]);assert.notDeepEqual(contour.paths[0],contour.paths[1]);assert.equal(contour.solved,false);assert(contour.aliases.every(m=>m===null));
  await p.screenshot({path:join(root,`qa/continuous/${r.engine}-${width}.png`)});
  for(const id of ['twiddle','rubik']){await p.evaluate(id=>phaseCubeApp.choosePuzzle(id),id);await p.locator('#start').click();await settled(p);await p.locator('#hint').click();await p.locator('.puzzle-action.hinted').click();await settled(p);assert.equal(await p.locator('#puzzle-stage canvas').count(),1);}
  report.cases.push({width,height,masterGain:initial.master,busGains:initial.buses,subStepPreview:true,previewIsSilent:true,zeroAndDouble:true,zeroRetainsPhase:true,plusLeavesZero:true,pitchContourDisambiguates:true,fullTurnsAreEquivalent:true,otherPuzzles:true});await c.close();
 }
 const c=await r.browser.newContext(),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(r.url+'/?debug=1&puzzle=fourier');await p.waitForFunction(()=>window.phaseCubeApp);await p.evaluate(()=>phaseCubeApp.ready);
 report.audio=await p.evaluate(async()=>{
  const S=strudel,app=phaseCubeApp,m=new FourierModel.Model(),pattern=S.note('c4 e4 g4 e4').s('sine').gain(.4).distort(.4).clip(.15),row=PhaseCubeLibrary.eventsOf(pattern,1).map((e,i)=>({...e,id:String(i)})),game={targetRows:Array(6).fill(row),basePatterns:Array(6).fill(pattern),periodBars:1};
  const fixture={puzzle:{manifest:FourierPuzzle.manifest,model:m},binding:{periods:Array(6).fill(1)},fragments:game};
  const jobs=[0,.5,1,2].map(gain=>{const change=m.editMove('A',{phase:0,level:FourierModel.levels.indexOf(gain)}),state=change?m.applyTo(0,change):0;return{kind:'gain',gain,from:0,bars:1,cps:1,pattern:PuzzleProjection.project(S,fixture,state).patterns[0]};});
  const valueKey=h=>JSON.stringify([Number(h.whole.begin),Number(h.duration),Object.fromEntries(Object.entries(h.value).filter(([k])=>!k.startsWith('_phaseCube')).sort(([a],[b])=>a.localeCompare(b)))]);
  for(const id of ['turkish-circuit','steel-shift','elise-after-hours']){
   await app.choose({songId:id,puzzleId:'fourier'});const song=app.getSong(),music=app.getMusic(),model=app.getPuzzle();
   const direct=PhaseCubeLibrary.attacks(song.pattern,0,song.bars).map(valueKey).sort(),assembled=PhaseCubeLibrary.attacks(S.stack(song.backing,music.pattern(0)),0,song.bars).map(valueKey).sort();if(JSON.stringify(direct)!==JSON.stringify(assembled))throw Error('Lost/changed native voices: '+id);
   let doubled=0;for(const key of FourierModel.keys){const edit=model.editMove(key,{phase:2,level:8},doubled);if(edit)doubled=model.applyTo(doubled,edit);}
   for(const [kind,state,from] of [['intro',0,0],['dense',0,16],['doubled-rearranged',doubled,16]])jobs.push({id,kind,from,bars:song.periodBars,cps:song.bpm/240,pattern:S.stack(song.backing,music.pattern(state)),nativeScoreEquivalent:direct.length===assembled.length,nativeEvents:direct.length});
  }
  let total=0;for(const job of jobs){job.offset=total;job.length=job.bars/job.cps+1;total+=job.length;}
  await S.getAudioContext().close();const ac=new OfflineAudioContext(2,Math.ceil(total*48000),48000);S.setAudioContext(ac);S.setSuperdoughAudioController(null);await S.initAudio({maxPolyphony:4096,multiChannelOrbits:false});
  for(const [orbit,job]of jobs.entries())for(const h of PhaseCubeLibrary.attacks(job.pattern,job.from,job.from+job.bars).sort((a,b)=>Number(a.whole.begin)-Number(b.whole.begin))){const t=job.offset+(Number(h.whole.begin)-job.from)/job.cps;await S.webaudioOutput(h.withValue(v=>({...v,orbit})),t,Number(h.duration)/job.cps,job.cps,t);}
  const buffer=await ac.startRendering(),channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
  const results=jobs.map(({id,kind,gain,offset,length,bars,cps,nativeScoreEquivalent,nativeEvents})=>{let sum=0,peak=0,n=0,clipped=0;for(const c of channels)for(let i=Math.round(offset*48000);i<Math.min(c.length,Math.round((offset+bars/cps)*48000));i++){const x=c[i];if(!Number.isFinite(x))throw Error('Nonfinite PCM');sum+=x*x;peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>=1)clipped++;n++;}return{id,kind,gain,rms:Math.sqrt(sum/n),peak,clipped,nativeScoreEquivalent,nativeEvents};});
  S.resetGlobalEffects();return{results,ratios:results.slice(0,4).map(v=>v.rms/results[2].rms),singleContinuousContext:true,scope:'Full-song symbolic equivalence; rendered intro and dense windows plus one doubled rearrangement per score. Not an exhaustive acoustic audit.'};
 });
 report.audio.ratios.forEach((v,i)=>assert(Math.abs(v-[0,.5,1,2][i])<.002));assert(report.audio.results.every(v=>v.clipped===0));assert.deepEqual(report.errors,[]);report.status='PASS';await c.close();
}catch(e){report.status='FAIL';report.failure=e.stack;throw e;}
finally{
 const html=await readFile(join(root,'index.html'),'utf8'),files=['index.html','steel-shift-cube.html',...Array.from(html.matchAll(/(?:src|href)="([^\"]+\.(?:js|css)(?:\?[^\"]*)?)"/g),m=>m[1].split('?')[0])];
 report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(join(root,p))).digest('hex')])));await writeFile(join(root,`qa/continuous/${r.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify({status:report.status,cases:report.cases.length,audio:report.audio,failure:report.failure}));
}
