/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';

export const settled=page=>page.waitForFunction(()=>{const d=phaseCubeApp.diagnostics();return !d.starting&&!d.busy&&!d.pending&&!d.loading&&!d.seeking;});
export const tap=(page,p,touch)=>touch?page.touchscreen.tap(p.x,p.y):page.mouse.click(p.x,p.y);
export const targets=page=>page.evaluate(()=>phaseCubeApp.getPresentation().locations());
export async function selectionPoint(page,key){
 // dialog.close() and the first canvas render can precede compositor hit testing.
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const all=await targets(page),p=all.find(t=>t.kind==='tile'?t.slot===(key==='A'?0:2):t.key===key);
 assert(p,'Visible selection target '+key);return p;
}
export async function actionPoint(page,key,inverted){
 const all=await targets(page);
 if(all[0].kind==='point'){
  const r=await page.locator(inverted?'#turn-left':'#turn-right').boundingBox();
  return{x:r.x+r.width/2,y:r.y+r.height/2};
 }
 if(all[0].kind==='tile'){
  // Far left/right of each block, including its shared middle column.
  return all.find(t=>t.slot===(key==='A'?(inverted?3:1):(inverted?4:2)));
 }
 const face=all.find(t=>t.kind==='seal'&&t.key===key)||all.find(t=>t.key===key);assert(face,'Visible face '+key);
 // Clip the projected face by its vertical midline and click well inside it.
 const inside=p=>inverted?p.x<=face.x:p.x>=face.x;
 const polygon=[];
 for(let i=0;i<face.region.length;i++){
  const a=face.region[i],b=face.region[(i+1)%face.region.length];
  if(inside(a))polygon.push(a);
  if(inside(a)!==inside(b)){const t=(face.x-a.x)/(b.x-a.x);polygon.push({x:face.x,y:a.y+(b.y-a.y)*t});}
 }
 assert(polygon.length>=3,'Face half has an area');
 return{x:polygon.reduce((n,p)=>n+p.x,0)/polygon.length,y:polygon.reduce((n,p)=>n+p.y,0)/polygon.length};
}
export async function select(page,key,touch){
 const before=await page.evaluate(()=>({state:phaseCubeApp.state(),moves:phaseCubeApp.getPuzzle().history.length}));
 await tap(page,await selectionPoint(page,key),touch);
 await page.waitForFunction(key=>phaseCubeApp.diagnostics().selectedFace===key,key,{timeout:3000});
 assert.equal(await page.evaluate(()=>phaseCubeApp.diagnostics().selectedFace),key);
 assert.deepEqual(await page.evaluate(()=>({state:phaseCubeApp.state(),moves:phaseCubeApp.getPuzzle().history.length})),before,'Selection must not make a move');
}
export async function turnPuzzle(page,key,inverted,touch,gesture){
 const move=key+(inverted?"'":''),p=await actionPoint(page,key,inverted);
 const before=await page.evaluate(move=>({expected:phaseCubeApp.getPuzzle().applyTo(phaseCubeApp.state(),move),moves:phaseCubeApp.getPuzzle().history.length}),move);
 if(gesture)await gesture(p);else await tap(page,p,touch);
 await page.waitForFunction(n=>phaseCubeApp.getPuzzle().history.length>n,before.moves,{timeout:3000});
 await settled(page);
 const after=await page.evaluate(()=>({state:phaseCubeApp.state(),moves:phaseCubeApp.getPuzzle().history.length,last:phaseCubeApp.getPuzzle().history.at(-1)?.move}));
 assert.equal(after.moves,before.moves+1,'Exactly one field turn '+move);
 assert.equal(after.last,move,'Turn direction '+move);
 assert.deepEqual(after.state,before.expected,'Field turn must equal model operation '+move);
 return p;
}
