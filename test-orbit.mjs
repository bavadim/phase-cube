/* SPDX-License-Identifier: AGPL-3.0-or-later */
import assert from 'node:assert/strict';
import {pure,Fraction,stack} from '@strudel/core';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const O=require('./orbit.js');
let states=0,events=0,wrapped=0;
for(const density of [1,2,3,4,8])for(let tick=0;tick<24;tick++){
  const p=pure({note:36,s:'sine'}).fast(density).late(Fraction([tick,24]));
  const haps=p.queryArc(0,1).filter(h=>h.hasOnset());
  assert.equal(haps.length,density);
  for(const h of haps){
    const start=Number(h.whole.begin),duration=Number(h.whole.end.sub(h.whole.begin)),parts=O.segments(start,duration);
    assert(Math.abs(parts.reduce((s,[a,b])=>s+b-a,0)-duration)<1e-10,'native event duration is preserved around seam');
    assert(parts.every(([a,b])=>a>=0&&b<=1&&b>a),'all circular intervals remain within cycle');
    assert(parts.every(([a,b])=>!O.arc(200,a,b).includes('NaN')),'finite SVG paths');
    if(parts.length===2)wrapped++;
    events++;
  }
  states++;
}
const chord=stack(...[48,51,55,58].map(note=>pure({note,s:'triangle'}))).late(Fraction([23,24]));
assert.equal(chord.queryArc(0,1).filter(h=>h.hasOnset()).length,4,'polyphonic simultaneous events survive native query');
const report={status:'PASS',scope:'Real upstream Pattern/queryArc events mapped to circular intervals; no browser, audio or artistic claim',nativeStates:states,nativeEvents:events,wrappedEvents:wrapped,polyphony:4};
fs.writeFileSync(new URL('./qa/orbit-native-report.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
