/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openBrowser,root} from '../modules/browser.mjs';
import {settled,select,targets} from '../modules/field-input.mjs';
const r=await openBrowser(),report={schema:'scratch-browser/1',engine:r.engine,physicalDevice:false,cases:[],errors:[]};
try{
  for(const [width,height]of [[1280,800],[390,844]]){
    const context=await r.browser.newContext({viewport:{width,height},isMobile:width<500,hasTouch:width<500}),page=await context.newPage();
    page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(r.url+'/?debug=1&puzzle=scratch&song=turkish-circuit');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
    assert.equal(await page.locator('#puzzle-select option[value="scratch"]').textContent(),'Портрет директора');
    await page.waitForFunction(()=>[...phaseCubeApp.getPresentation().active.resources.items].some(r=>r.isTexture&&r.image?.naturalWidth>0));
    await page.locator('#start').click();await settled(page);await page.waitForFunction(()=>phaseCubeApp.diagnostics().rms>.0001);
    assert.equal(await page.locator('.puzzle-action:enabled').count(),0);
    await select(page,'A',width<500);assert.equal(await page.locator('.puzzle-action:enabled').count(),3);
    const initial=await page.evaluate(()=>({state:phaseCubeApp.state(),history:phaseCubeApp.getPuzzle().history.length,phase:phaseCubeApp.getPuzzle().parameters()[0].phase,active:[phaseCubeApp.getPuzzle().parameters()[0].source],swapped:phaseCubeApp.getPuzzle().parameters().slice(0,2).map(p=>p.source).sort()}));
    await page.locator('#swap-piece').hover();await page.waitForFunction(()=>!!phaseCubeApp.getEqualizer().forecast);
    assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.changed),initial.swapped);
    await page.mouse.move(0,0);await page.waitForFunction(()=>!phaseCubeApp.getEqualizer().forecast);
    const from=(await targets(page)).find(p=>p.key==='A'&&p.kind==='rotation-handle');await page.mouse.move(from.x,from.y);await page.mouse.down();
    const samples=[];
    for(const step of [.40,.45,.90]){
      const destination=await page.evaluate(({from,step})=>{
        const stage=phaseCubeApp.getPresentation(),center=stage.locations().find(p=>p.key==='A'&&p.kind==='piece'),origin=stage.unproject(center.x,center.y);
        return stage.project(stage.unproject(from.x,from.y).sub(origin).applyAxisAngle(new THREE.Vector3(0,0,1),-step*Math.PI/2).add(origin));
      },{from,step});
      await page.mouse.move(destination.x,destination.y,{steps:5});
      samples.push(await page.evaluate(()=>{const f=phaseCubeApp.getEqualizer().forecast;return{state:phaseCubeApp.state(),history:phaseCubeApp.getPuzzle().history.length,continuous:f?.continuous,changed:f?.changed,rows:JSON.stringify(f?.rows),heard:phaseCubeApp.getTransport().active.meta.state};}));
    }
    for(const sample of samples){assert.equal(sample.state,initial.state);assert.equal(sample.heard,initial.state);assert.equal(sample.history,initial.history);assert(sample.continuous);assert.deepEqual(sample.changed,initial.active);}
    assert.notEqual(samples[0].rows,samples[1].rows,'Preview must not snap to a quarter phase');
    await page.mouse.up();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.length),initial.history+1);
    await page.locator('#undo').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),initial.state);
    const places=(await targets(page)).filter(p=>p.kind==='piece'),a=places.find(p=>p.key==='A'),c=places.find(p=>p.key==='C');
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(c.x,c.y,{steps:16});
    assert.deepEqual(await page.evaluate(()=>phaseCubeApp.getEqualizer().forecast.changed),await page.evaluate(()=>{const p=phaseCubeApp.getPuzzle().parameters();return[p[0].source,p[2].source].sort();}));
    await page.mouse.up();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.at(-1).move.kind),'piece-swap');
    await page.locator('#undo').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),initial.state);
    await select(page,'B',width<500);await page.locator('#swap-piece').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.getPuzzle().history.at(-1).move),'Bx');
    await page.locator('#undo').click();await settled(page);assert.equal(await page.evaluate(()=>phaseCubeApp.state()),initial.state);
    await page.screenshot({path:join(root,`qa/scratch/${r.engine}-${width}.png`)});
    const geometry=await page.evaluate(()=>({canvas:document.querySelectorAll('#puzzle-stage canvas').length,overflow:document.documentElement.scrollWidth>innerWidth,info:phaseCubeApp.getPresentation().info()}));
    assert.equal(geometry.canvas,1);assert(!geometry.overflow);
    for(const songId of ['turkish-circuit','steel-shift','elise-after-hours']){
      if(songId!=='turkish-circuit'){await page.evaluate(songId=>phaseCubeApp.chooseSong(songId),songId);await page.locator('#start').click();await settled(page);}
      let n=0;
      while(await page.evaluate(()=>!phaseCubeApp.getPuzzle().solved())){
        await page.locator('#hint').click();await page.locator('.puzzle-action.hinted').click();await settled(page);assert(++n<=8);
      }
      assert(await page.locator('#result-dialog').isVisible());assert(await page.locator('#celebration').isVisible());
    }
    for(const puzzleId of ['fourier','twiddle','rubik']){
      await page.evaluate(puzzleId=>phaseCubeApp.choosePuzzle(puzzleId),puzzleId);await page.locator('#start').click();await settled(page);
      await page.locator('#hint').click();await page.locator('.puzzle-action.hinted').click();await settled(page);
    }
    report.cases.push({width,height,continuousPreview:true,silentPreview:true,dragCommitUndo:true,swapUndo:true,allThreeSongsSolved:true,oldPuzzles:true,geometry});
    await context.close();
  }
  if(r.engine==='chromium'){
    const context=await r.browser.newContext(),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    await page.goto(r.url+'/?debug=1&puzzle=scratch');await page.waitForFunction(()=>window.phaseCubeApp);await page.evaluate(()=>phaseCubeApp.ready);
    report.audio=await page.evaluate(async()=>{
      const S=strudel,app=phaseCubeApp,jobs=[];
      const valueKey=h=>JSON.stringify([Number(h.whole.begin),Number(h.duration),Object.fromEntries(Object.entries(h.value).filter(([k])=>!k.startsWith('_phaseCube')).sort(([a],[b])=>a.localeCompare(b)))]);
      for(const songId of ['turkish-circuit','steel-shift','elise-after-hours']){
        await app.chooseSong(songId);const music=app.getMusic(),song=app.getSong(),game=app.getGame(),m=app.getPuzzle();
        const original=PhaseCubeLibrary.attacks(song.pattern,0,song.bars).map(valueKey).sort(),assembled=PhaseCubeLibrary.attacks(S.stack(song.backing,music.pattern(0)),0,song.bars).map(valueKey).sort();
        if(JSON.stringify(original)!==JSON.stringify(assembled))throw Error('Original score mismatch '+songId);
        const active=game.targetRows.map((_,i)=>i);
        const worst=m.allStates().map(state=>({state,energy:music.rows(state).reduce((sum,row,i)=>sum+(active.includes(i)?row.reduce((v,e)=>v+(e.volume??1)**2,0):0),0)})).sort((a,b)=>b.energy-a.energy)[0].state;
        for(const [kind,state]of [['goal',0],['high-gain',worst]])jobs.push({songId,kind,state,from:16,bars:game.periodBars,cps:song.bpm/240,pattern:S.stack(song.backing,music.pattern(state)),nativeScoreEvents:original.length});
      }
      let total=0;for(const job of jobs){job.offset=total;total+=job.bars/job.cps+1;}
      await S.getAudioContext().close();const ac=new OfflineAudioContext(2,Math.ceil(total*48000),48000);S.setAudioContext(ac);S.setSuperdoughAudioController(null);await S.initAudio({maxPolyphony:4096,multiChannelOrbits:false});
      for(const[orbit,job]of jobs.entries())for(const h of PhaseCubeLibrary.attacks(job.pattern,job.from,job.from+job.bars).sort((a,b)=>Number(a.whole.begin)-Number(b.whole.begin))){const at=job.offset+(Number(h.whole.begin)-job.from)/job.cps;await S.webaudioOutput(h.withValue(v=>({...v,orbit})),at,Number(h.duration)/job.cps,job.cps,at);}
      const buffer=await ac.startRendering(),channels=[buffer.getChannelData(0),buffer.getChannelData(1)];
      return jobs.map(job=>{let sum=0,peak=0,clipped=0,n=0;for(const channel of channels)for(let i=Math.round(job.offset*48000);i<Math.round((job.offset+job.bars/job.cps)*48000);i++){const x=channel[i];if(!Number.isFinite(x))throw Error('Invalid PCM');sum+=x*x;peak=Math.max(peak,Math.abs(x));clipped+=Math.abs(x)>=1;n++;}return{songId:job.songId,kind:job.kind,state:job.state,rms:Math.sqrt(sum/n),peak,clipped,nativeScoreEvents:job.nativeScoreEvents};});
    });
    assert(report.audio.every(a=>a.rms>.0001&&a.clipped===0));await context.close();
  }
  assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;throw error;}
finally{
  const files=['index.html','app.js','puzzle-contract.js','music-projection.js','music.js','graphics/stage.js','assets/director-puzzle.png','controls/puzzle.js','controls/equalizer.js','puzzles/scratch/model.js','puzzles/scratch/binding.js','puzzles/scratch/module.js','puzzles/scratch/three-view.js'];
  report.sourceSha256=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(join(root,file))).digest('hex')])));
  await writeFile(join(root,`qa/scratch/${r.engine}-report.json`),JSON.stringify(report,null,2)+'\n');await r.close();console.log(JSON.stringify({status:report.status,cases:report.cases.length,audio:report.audio,failure:report.failure}));
}
