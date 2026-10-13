// Execute the real night recorder with VM fixtures; no browser, GPU or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {GAME} from './gamefile.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
// Keep the actual localStorage restore path as well as the functions themselves.
const initStart=source.indexOf(decl('REC')),initEnd=source.indexOf('function recTick(',initStart);
assert.ok(initStart>=0&&initEnd>initStart,'Night recorder initialization exists');

function fixture(stored=[],denyStorage=false){
  const writes=[];
  const c=vm.createContext({localStorage:{
    getItem(key){assert.equal(key,'nightRec102');if(denyStorage)throw Error('storage denied');return JSON.stringify(stored);},
    setItem(key,value){if(denyStorage)throw Error('storage denied');writes.push({key,value:JSON.parse(value)});}
  }});
  vm.runInContext(`
    const G={started:false,phase:'day',day:15,host:true,t:59.5,set:{nightSec:60},wolves:[{x:3,z:0},{x:15,z:0}]};
    const GAME_VER='106차 · 검사',GFX={aa:2},renderer={getPixelRatio:()=>.85};
    const camera={position:{x:0,z:0}},pcMap=new Map(Array.from({length:23},(_,i)=>[i,{}]));
    const STRU=new Map(['arrow','arrow','ice','pulse','barr','wall','farm','gate'].map((t,i)=>[i,{t}]));
    const navigator={},document={getAnimations:()=>[{},{}]};
    let fpsVal=55,cpuLoopMs=7.44,brMs=11.56,gpuMs=15.23;
    ${decl('recCalls')}
    ${source.slice(initStart,initEnd)}
    ${fn('recTick')}
    ${fn('recText')}
    recCalls=300;recTris=4500000;
    globalThis.T={G,STRU,REC,recTick,recText,setFps(v){fpsVal=v;}};
  `,c,{timeout:1000});
  return {...c.T,writes};
}
const plain=v=>JSON.parse(JSON.stringify(v));
const legacy=day=>({day,at:'12:00',ver:'105차',pr:.85,aa:2,bat:'배터리 50%',s:[
  [0,55,5,11,8,2,0,0,23,2,140,600],
  [5,54,6,12,9,5,1,0,23,4,190,700]
]});
const results=[];
function check(name,run){
  try{run();results.push(true);console.log('PASS '+name);}
  catch(e){results.push(false);console.error('FAIL '+name+' — '+e.message);}
}

check('Only a started night creates a record',()=>{
  const t=fixture();t.recTick(5);assert.equal(t.REC.cur,null);
  t.G.phase='night';t.recTick(5);assert.equal(t.REC.cur,null);
  t.G.phase='day';t.G.started=true;t.recTick(5);assert.equal(t.REC.cur,null);
  assert.equal(t.writes.length,0);assert.match(t.recText(),/아직 기록된 밤/);
});

check('New samples preserve all 12 old columns and append structures and combat towers',()=>{
  const t=fixture();t.G.started=true;t.G.phase='night';t.recTick(.5);
  assert.equal(t.REC.cur.host,true);
  assert.deepEqual(plain(t.REC.cur.s[0]),[1,55,7.4,11.6,15.2,2,1,1,23,2,300,4500,8,5]);
  const text=t.recText();assert.match(text,/호스트/);assert.match(text,/건물8 타워5/);
  assert.match(text,/55 이상 표본 100%/);
});

check('Five-second samples recount construction changes and retain the starting role',()=>{
  const t=fixture();t.G.started=true;t.G.phase='night';t.recTick(.5);
  t.STRU.delete(0);t.G.host=false;t.G.t=54.5;t.setFps(54);
  t.recTick(4.5);assert.equal(t.REC.cur.s.length,1);
  t.recTick(.5);assert.equal(t.REC.cur.s.length,2);
  assert.deepEqual(plain(t.REC.cur.s[1].slice(12)),[7,4]);
  assert.equal(t.REC.cur.host,true);
  const text=t.recText();assert.match(text,/55 이상 표본 50%/);
  assert.match(text,/건물7 타워4/);assert.match(text,/콜백 밖/);assert.match(text,/대기/);
  assert.match(text,/표본/);assert.match(text,/합산하지/);
  assert.doesNotMatch(text,/55 넘는 비율|브라우저가 크면 HUD/);
});

check('Night completion persists the extended record and keeps the last three nights',()=>{
  const t=fixture([legacy(10),legacy(11),legacy(12)]);
  t.G.started=true;t.G.phase='night';t.recTick(.5);
  t.G.phase='day';t.recTick(.05);
  assert.equal(t.REC.cur,null);assert.equal(t.writes.length,1);
  assert.deepEqual(plain(t.REC.nights.map(n=>n.day)),[11,12,15]);
  assert.equal(t.writes[0].key,'nightRec102');
  assert.deepEqual(t.writes[0].value,plain(t.REC.nights));
  assert.equal(t.writes[0].value[2].host,true);
  assert.equal(t.writes[0].value[2].s[0].length,14);
});

check('A night without samples is discarded; guest records identify their actual role',()=>{
  const t=fixture();t.G.started=true;t.G.phase='night';t.recTick(.1);
  t.G.phase='day';t.recTick(.05);assert.equal(t.REC.cur,null);
  assert.equal(t.REC.nights.length,0);assert.equal(t.writes.length,0);
  t.G.host=false;t.G.phase='night';t.recTick(.5);
  assert.equal(t.REC.cur.host,false);assert.match(t.recText(),/손님/);
});

check('Stored 12-column records render without invented roles or missing values',()=>{
  const t=fixture([legacy(1),legacy(2),legacy(3),legacy(4)]);
  assert.deepEqual(plain(t.REC.nights.map(n=>n.day)),[2,3,4]);
  const text=t.recText(),rows=text.split('\n').filter(s=>s.trimStart().startsWith('+'));
  assert.equal(rows.length,6);assert.match(text,/55 이상 표본 50%/);
  assert.match(text,/△600K/);assert.match(text,/△700K/);
  assert.doesNotMatch(text,/undefined|NaN|Infinity|호스트|손님/);
  assert.ok(rows.every(s=>!s.includes('건물')&&!s.includes('타워')));
  assert.equal(t.writes.length,0,'Viewing old records does not rewrite their format');
});

check('Legacy and current records can be viewed together',()=>{
  const t=fixture([legacy(14)]);t.G.started=true;t.G.phase='night';t.recTick(.5);
  const text=t.recText();assert.match(text,/15일차 밤/);assert.match(text,/14일차 밤/);
  assert.doesNotMatch(text,/undefined|NaN|Infinity/);
  const rows=text.split('\n').filter(s=>s.trimStart().startsWith('+'));
  assert.equal(rows.length,3);assert.equal(rows.filter(s=>s.includes('건물')).length,1);
});

check('Summary uses every sample while detail shows only the five lowest FPS samples',()=>{
  const n=legacy(15);n.host=true;
  n.s=[60,55,54,50,40,30,20].map((fps,i)=>[i*5,fps,5,11,8,2,0,0,23,2,140,600,8,5]);
  const t=fixture([n]),text=t.recText();
  assert.match(text,/fps 최저 20 · 평균 44 · 55 이상 표본 29%/);
  const times=text.split('\n').filter(s=>s.trimStart().startsWith('+')).map(s=>Number(s.match(/\+\s*(\d+)초/)[1]));
  assert.deepEqual(times,[10,15,20,25,30]);
  assert.deepEqual(plain(t.REC.nights[0].s),n.s,'Formatting must not reorder saved samples');
});

check('Unavailable storage does not stop night recording or formatting',()=>{
  const t=fixture([],true);t.G.started=true;t.G.phase='night';t.recTick(.5);
  t.G.phase='day';t.recTick(.05);
  assert.equal(t.REC.nights.length,1);assert.match(t.recText(),/건물8 타워5/);
});

console.log(`${results.filter(Boolean).length}/${results.length} night-record checks passed.`);
if(results.some(v=>!v))process.exitCode=1;
