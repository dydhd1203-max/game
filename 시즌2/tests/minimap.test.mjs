import test from 'node:test';
import assert from 'node:assert/strict';
import {createMinimap,mapObjective,mapProjection} from '../src/minimap.mjs';
import {BEACON,GATE,SPAWN} from '../src/content.mjs';

test('the map follows actual expedition objectives and keeps north above the player',()=>{
  assert.deepEqual(mapObjective({phase:'lobby'}),{...SPAWN,label:'마을 광장'});
  assert.deepEqual(mapObjective({phase:'forest',beacon:false}),{...BEACON,label:'숲의 봉화'});
  assert.deepEqual(mapObjective({phase:'forest',beacon:true}),{...GATE,label:'보스 입구'});
  assert.deepEqual(mapObjective({phase:'boss',boss:{x:8,z:-108}}),{x:8,z:-108,label:'가시등 멧돼지'});
  const north=mapProjection(0,-10,0,0,31),east=mapProjection(10,0,0,0,31);
  assert.equal(north.x,128);assert.ok(north.y<128);assert.ok(east.x>128);assert.equal(east.y,128);
  const distant=mapProjection(0,-110,0,19,31);
  assert.equal(distant.offscreen,true);assert.ok(Math.abs(distant.y-18)<1e-9);
  for(const x of [-30.35,30.35])assert.equal(mapProjection(x,-136.35,0,-54,100).offscreen,false,'full route map includes both northern boss corners');
  for(const x of [-19.85,19.85])assert.equal(mapProjection(x,28.85,0,-54,100).offscreen,false,'full route map includes both southern village corners');
});

test('one cached terrain atlas, at most 5 Hz, no work for unchanged or hidden HUD',()=>{
  let atlasCount=0,hidden=false,drawImages=0,circleDraws=0;
  const context=new Proxy({drawImage(){drawImages++;},arc(){circleDraws++;}}, {get:(target,key)=>key in target?target[key]:()=>{}});
  const attrs=new Map();
  const canvas={getContext:()=>context,closest:()=>hidden?{}:null,setAttribute:(key,value)=>attrs.set(key,value),ownerDocument:{createElement(tag){assert.equal(tag,'canvas');atlasCount++;return {getContext:()=>context};}}};
  const minimap=createMinimap(canvas),state={phase:'village',players:{me:{id:'me',x:0,z:19,yaw:0,team:0,hp:100},friend:{id:'friend',x:2,z:20,yaw:0,team:1,hp:100}}};
  assert.equal(minimap.update(state,'me',false,0),true);
  state.players.me.z=18;
  assert.equal(minimap.update(state,'me',false,199),false);
  assert.equal(minimap.update(state,'me',false,200),true);
  assert.equal(minimap.update(state,'me',false,400),false,'stationary markers should not repaint');
  hidden=true;state.players.me.z=17;
  assert.equal(minimap.update(state,'me',false,600),false);
  hidden=false;
  assert.equal(minimap.update(state,'me',true,600),true,'whole-route map redraws when opened');
  state.players.friend.x=30.35;state.players.friend.z=-136.35;
  const beforeCircleDraws=circleDraws;
  assert.equal(minimap.update(state,'me',true,800),true);
  assert.equal(circleDraws-beforeCircleDraws,2,'full-map frame paints the clip and the real far-corner friend marker');
  assert.equal(atlasCount,1);assert.equal(drawImages,4);
  assert.deepEqual(minimap.stats(),{draws:4,atlasBuilds:1,width:256,height:256,maxHz:5});
  assert.equal(canvas.width,256);assert.equal(canvas.height,256);
  assert.match(attrs.get('aria-label'),/전체 원정 지도.*북쪽.*북쪽 숲길/);
});
