'use strict';
// Shared motion matrix and node-count table for every foundation (기준 캐릭터)
// verifier (stage 3, WP0). One definition, so the R0 signature, the garment
// matrix and later verifiers sample the same poses.
//
//   node tools/foundation-matrix.cjs            summary: sample counts and the node table
//   node tools/foundation-matrix.cjs --json     the whole matrix as JSON
//   const M=require('./foundation-matrix.cjs');
//   M.motions()                 [{id:'front/walk/3', direction, motion, k, state}] for one avatar (296)
//   M.samples({sexes,sizes,tones}) every avatar × (static + motions) with a stable key
//   M.referenceAvatar('f',4)    the studio's reference avatar (bob:1, bright:0, basic outfit)
//   M.expectedNodes(classSignature, sex, mode)  node count from NODE_TABLE
//
// Matrix (plan, verification A): 2 sexes × front/right/left/back ×
// [idle, walk, run, jump, floor-sit, sit, climb] × 8 frames + [wave, nod,
// happy] × 6 steps, plus the static render() string (no apply), at 280 and
// 120 px, skin tones 0 and 4. Each state is explicit (time, seat mode,
// reducedMotion:false), so no sample depends on the page's clock or media
// settings. A seated sample's time is the breathing time the avatar shows;
// the signature tool removes each avatar's own breathing offset (render
// serial) so the order of renders cannot change a pose.
const SEXES=Object.freeze(['m','f']);
const DIRECTIONS=Object.freeze(['front','right','left','back']);
const ACTIONS=Object.freeze(['idle','walk','run','jump','floor-sit','sit','climb']);
const FRAMES=8;
const GESTURES=Object.freeze(['wave','nod','happy']);
const GESTURE_STEPS=6;
const SIZES=Object.freeze([280,120]);
const TONES=Object.freeze([0,4]);
// Jump: take-off crouch (half, full), five flight poses by vertical speed
// (rise, slowing, apex, falling, fast fall) and the landing crouch. The game
// sends exactly these inputs (grounded + jumpStage + jumpCompression on the
// ground, vy in the air; avatar-foundation.js solve()).
const JUMP=Object.freeze([
  {grounded:true,jumpStage:'takeoff',jumpCompression:.5},{grounded:true,jumpStage:'takeoff',jumpCompression:1},
  {grounded:false,vy:480},{grounded:false,vy:240},{grounded:false,vy:0},{grounded:false,vy:-240},{grounded:false,vy:-480},
  {grounded:true,jumpStage:'landing',jumpCompression:.5}
].map(Object.freeze));
const STATIC='static';

function actionState(action,direction,k){
  const base={action,direction,time:+(k*.2).toFixed(4),reducedMotion:false};
  if(action==='walk'||action==='run'||action==='climb')return{...base,phase:k/FRAMES};
  if(action==='jump')return{...base,phase:k/FRAMES,...JUMP[k]};
  if(action==='floor-sit')return{...base,seatMode:'floor'};
  if(action==='sit')return{...base,seatMode:'desk'};
  return base;
}
function gestureState(gesture,direction,k){return{action:'idle',direction,gesture,gestureProgress:k/(GESTURE_STEPS-1),time:0,reducedMotion:false};}
const isSeated=state=>state.action==='sit'||state.action==='floor-sit';

// Every pose of one avatar, in a fixed order (direction, then action/gesture, then step).
function motions({directions=DIRECTIONS,actions=ACTIONS,gestures=GESTURES}={}){
  const out=[];
  for(const direction of directions){
    for(const action of actions)for(let k=0;k<FRAMES;k++)out.push({id:direction+'/'+action+'/'+k,direction,motion:action,k,state:actionState(action,direction,k)});
    for(const gesture of gestures)for(let k=0;k<GESTURE_STEPS;k++)out.push({id:direction+'/'+gesture+'/'+k,direction,motion:gesture,k,state:gestureState(gesture,direction,k)});
  }
  return out;
}
const avatarKey=(sex,size,tone)=>sex+'/'+size+'/t'+tone;
function samples({sexes=SEXES,sizes=SIZES,tones=TONES}={}){
  const out=[];
  for(const sex of sexes)for(const size of sizes)for(const tone of tones){
    const avatar=avatarKey(sex,size,tone);
    out.push({key:avatar+'/'+STATIC,avatar,sex,size,tone,id:STATIC,direction:'front',motion:STATIC,k:0,state:null});
    for(const m of motions())out.push({key:avatar+'/'+m.id,avatar,sex,size,tone,...m});
  }
  return out;
}

// The studio's reference avatar (avatar-standard.js). The male short:1 and
// female bob:1 paintings are the 'reference heads' with neck cuts.
const REFERENCE_HAIR=Object.freeze({m:'short:1',f:'bob:1'});
function referenceAvatar(sex,tone=0,extra={}){return{sex,sk:tone,hair:REFERENCE_HAIR[sex],expression:'bright:0',foundationOutfit:'basic',...extra};}
// The 24 painted heads: one sd-heads cell each (avatar-pixel.js hairNames /
// maleHairNames). Four female cells are not sold (short, part, messy,
// spiky); stage 3 converts them too.
const HAIRSTYLES=Object.freeze({
  m:Object.freeze(['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf']),
  f:Object.freeze(['short','bob','long','twin','pony','curly','bun','hime','part','messy','spiky','braid'])
});
const SOLD_HAIR=Object.freeze({m:HAIRSTYLES.m,f:Object.freeze(['bob','long','twin','pony','curly','bun','hime','braid'])});
// Old shop keys that resolve to another painting (index.html HAIR_ALIAS,
// avatar-pixel.js aliases / maleAliases).
const HAIR_ALIASES=Object.freeze(['buzz','longm','wave','afro','mohawk','crop']);

// Node-count table, keyed by garment class signature 'top|bottom|shoes'.
// The count is the same in every motion, gesture and direction, and for
// every garment of one class signature (a new class adds its nodes in
// prepare() hidden, and gets its own row here).
//   total: svg.querySelectorAll('*').length of the reference avatar
//          (m short:1, f bob:1). The male reference head adds 6 nodes of
//          neck-cut clip paths; every other male head gives 192.
//   body:  the same count without the head, the back hair and their clip
//          definitions (the R0 'garment' mode used from H3 on, when heads
//          change by design). Equal for both sexes and every head (checked
//          with m spiky:1 as well).
// Measured 2026-10-09 on 7a2643f (stage 2 runtime) over the whole matrix by
// tools/foundation-signature.cjs (full and garment mode, fresh and walking
// avatars); verify-reference-body and 모션-검수 record the same 198/192.
const NODE_TABLE=Object.freeze({
  'short-sleeve|shorts|low':Object.freeze({total:Object.freeze({m:198,f:192}),body:Object.freeze({m:149,f:149}),note:'basic outfit: shirt, shorts hip mesh, 2 underarm fills + lines, 2 sleeve groups (image + arm-skin clip), 2 shoes, shirt-side clip'}),
  'none|none|none':Object.freeze({total:Object.freeze({m:177,f:171}),body:Object.freeze({m:128,f:128}),note:"foundationOutfit 'body' (no garments)"})
});
const classSignature=({top='none',bottom='none',shoes='none'}={})=>top+'|'+bottom+'|'+shoes;
function expectedNodes(signature,sex,mode='total'){const row=NODE_TABLE[signature];return row?row[mode==='garment'?'body':'total'][sex]:undefined;}

module.exports=Object.freeze({SEXES,DIRECTIONS,ACTIONS,FRAMES,GESTURES,GESTURE_STEPS,SIZES,TONES,JUMP,STATIC,actionState,gestureState,isSeated,motions,samples,avatarKey,REFERENCE_HAIR,referenceAvatar,HAIRSTYLES,SOLD_HAIR,HAIR_ALIASES,NODE_TABLE,classSignature,expectedNodes});

if(require.main===module){
  const all=samples();
  if(process.argv.includes('--json'))console.log(JSON.stringify({sexes:SEXES,directions:DIRECTIONS,actions:ACTIONS,frames:FRAMES,gestures:GESTURES,gestureSteps:GESTURE_STEPS,sizes:SIZES,tones:TONES,motions:motions(),nodeTable:NODE_TABLE,samples:all.length},null,1));
  else console.log(JSON.stringify({perAvatar:1+motions().length,avatars:SEXES.length*SIZES.length*TONES.length,samples:all.length,nodeTable:NODE_TABLE},null,1));
}
