import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeason1MotionFeedback} from '../src/motion-feedback-season1.mjs';
import {advanceSeason1Motion,resetSeason1Motion} from '../src/locomotion-season1.mjs';

test('actual first/double jump triggers one original FOV kick each; landing, sprint and airborne cues render',()=>{
  const kicks=[],draws=[];
  const feedback=createSeason1MotionFeedback({punch:n=>kicks.push(n),random:()=>.5});
  const p=resetSeason1Motion({id:'me',x:0,z:0,hp:100,online:true});
  feedback.update(p,1/60);
  let jumpSeq=0,airDraws=0,landingDraws=0;
  for(let frame=0;frame<180;frame++){
    if(frame===30||frame===40)jumpSeq++;
    advanceSeason1Motion(p,{mx:frame<25?1:0,sprint:frame<25,jumpSeq},1/60);
    feedback.update(p,1/60);
    draws.length=0;feedback.render(1/60,(...values)=>draws.push(values));
    if(p.air)airDraws+=draws.length;if(p.land>0)landingDraws+=draws.length;
    assert.ok(draws.length<=64);assert.ok(draws.every(row=>row.slice(1,7).every(Number.isFinite)));
  }
  assert.deepEqual(kicks,[2,3.2]);assert.ok(airDraws>0&&landingDraws>0);
  assert.equal(feedback.stats().live,0,'transient particles expire while standing still');
});

test('particle work is bounded, respects culling/pause and never replays a fresh joined airborne pose',()=>{
  const kicks=[],feedback=createSeason1MotionFeedback({punch:n=>kicks.push(n),random:()=>.5});
  feedback.burst(0,.1,0,0xffffff,200);
  assert.equal(feedback.stats().live,64);
  let drawn=0;feedback.render(0,()=>drawn++,()=>false);assert.equal(drawn,0);
  assert.equal(feedback.stats().live,64);
  const p={id:'guest',x:0,z:0,y:2,vy:3,jumps:1,ground:false,hp:100};
  feedback.update(p,.016);feedback.update(p,.016,{paused:true});
  assert.deepEqual(kicks,[]);
  feedback.reset();assert.equal(feedback.stats().live,0);
  feedback.update({...p,y:.08,ground:true},.016,{phase:'lobby'});
  feedback.update(p,.016,{phase:'lobby'});assert.deepEqual(kicks,[]);
});
