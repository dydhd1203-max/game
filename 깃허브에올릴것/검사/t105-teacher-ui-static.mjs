// Actual teacher UI function: keep group/rank DOM when its visible data is the
// same. The night recorder function and call cadence stay untouched.
// Optional --baseline previous.html --bench. Node DOM timings are not FPS.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {GAME} from './gamefile.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const baselineAt=process.argv.indexOf('--baseline');
const baseline=baselineAt<0?null:fs.readFileSync(process.argv[baselineAt+1],'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const extract=source=>new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
let DOM;
for(const p of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){
  try{DOM=require(p);break;}catch{}
}
if(!DOM)throw Error('linkedom required (or set DOM_MODULE)');
const ids=['tGroups','tRank','tPerf','tMiniSt'];
function fixture(src){
  const {document}=DOM.parseHTML('<section id="popTeach"><div id="tGroups"></div><div id="tPerf"></div><table id="tRank"></table><div id="tMiniSt"></div></section>');
  const {fn,decl}=extract(src),counts={groups:0,rank:0,recorderCalls:0};
  const el=id=>document.getElementById(id);
  function instrument(node,key){
    let p=node,d;while(p&&!(d=Object.getOwnPropertyDescriptor(p,'innerHTML')))p=Object.getPrototypeOf(p);
    assert.ok(d?.get&&d?.set,'DOM innerHTML accessor');
    Object.defineProperty(node,'innerHTML',{configurable:true,get(){return d.get.call(this);},set(v){counts[key]++;d.set.call(this,v);}});
  }
  instrument(el('tGroups'),'groups');instrument(el('tRank'),'rank');
  const F=new Function('document','counts',`
    const NG=5,hudPrev={};
    ${['GCOL','MINI_NAME'].map(decl).join('\n')}
    ${src.match(/^const esc\s*=.*$/m)?.[0]||(()=>{throw Error('Actual esc declaration missing');})()}
    const G={res:Array.from({length:5},(_,g)=>({w:g*3,s:g*7,g:g*11})),mini:null,t:120};
    const STRU=new Map(Array.from({length:100},(_,i)=>[i,{g:i%5}]));
    const pcMap=new Map(Array.from({length:21},(_,i)=>['u'+i,{n:'아이'+i,g:i%5,lv:i%3+1,mined:i*2,built:i%5}]));
    const el=id=>document.getElementById(id),miniOn=()=>!!G.mini;
    let finished=4,record='저장된 밤 성능 기록';const raceFinished=()=>finished;
    const recText=()=>{counts.recorderCalls++;return record;};
    ${src.includes('function teachHTML105(')?fn('teachHTML105'):''}
    ${fn('paintTeach')}
    return {G,STRU,pcMap,hudPrev,paint:paintTeach,setRecord(v){record=v;},finish(v){finished=v;}};
  `)(document,counts);
  return {...F,counts,el,
    snapshot:()=>ids.map(id=>({id,html:el(id).innerHTML})),
    replaceContainer(id){const old=el(id),node=old.cloneNode(false);old.replaceWith(node);instrument(node,id==='tGroups'?'groups':'rank');return node;},
  };
}
const checks=[];
function check(name,run){run();checks.push(name);console.log('PASS '+name);}
check('Unchanged 21-player teacher view retains all group/rank nodes across 250 ticks',()=>{
  const F=fixture(source);F.paint();const groupNodes=[...F.el('tGroups').querySelectorAll('*')],rankNodes=[...F.el('tRank').querySelectorAll('*')];
  for(let i=1;i<250;i++)F.paint();
  assert.deepEqual(F.counts,{groups:1,rank:1,recorderCalls:250});
  assert.deepEqual([...F.el('tGroups').querySelectorAll('*')],groupNodes);
  assert.deepEqual([...F.el('tRank').querySelectorAll('*')],rankNodes);
  assert.equal(F.el('tGroups').children.length,5);assert.equal(F.el('tRank').querySelectorAll('tr').length,22);
  console.log('  retained elements: '+(groupNodes.length+rankNodes.length)+'; work '+JSON.stringify(F.counts));
});
check('Resources and building counts change only the group DOM; ranking changes only its table',()=>{
  const F=fixture(source);F.paint();const row=F.el('tRank').firstChild;
  F.G.res[0].w=999;F.STRU.set(100,{g:0});F.paint();
  assert.equal(F.counts.groups,2);assert.equal(F.counts.rank,1);assert.equal(F.el('tRank').firstChild,row);
  assert.match(F.el('tGroups').textContent,/건물 21/);assert.match(F.el('tGroups').textContent,/999/);
  const group=F.el('tGroups').firstChild;F.pcMap.get('u0').mined=1000;F.pcMap.get('u0').lv=7;F.pcMap.get('u0').built=23;F.paint();
  assert.equal(F.counts.groups,2);assert.equal(F.counts.rank,2);assert.equal(F.el('tGroups').firstChild,group);
  const first=F.el('tRank').querySelectorAll('tr')[1];assert.equal(first.children[0].textContent,'아이0');
  assert.equal(first.children[2].textContent,'Lv.7');assert.equal(first.children[3].textContent,'1000');assert.equal(first.children[4].textContent,'23');
});
check('Join, leave, rename and group changes refresh visible counts and escaped ranking names',()=>{
  const F=fixture(source);F.paint();F.pcMap.set('u22',{n:'새친구 <A&B>',g:0,lv:4,mined:500,built:2});F.paint();
  assert.equal(F.el('tRank').querySelectorAll('tr').length,23);assert.match(F.el('tGroups').firstChild.textContent,/6명/);
  assert.match(F.el('tRank').textContent,/새친구 <A&B>/);assert.equal(F.el('tRank').querySelector('a'),null);
  F.pcMap.delete('u0');F.pcMap.get('u22').g=3;F.pcMap.get('u22').n='새 이름';F.paint();
  assert.equal(F.el('tRank').querySelectorAll('tr').length,22);assert.match(F.el('tGroups').firstChild.textContent,/4명/);
  assert.match(F.el('tRank').textContent,/새 이름/);assert.doesNotMatch(F.el('tRank').textContent,/아이0/);
});
check('Mini-game and recorder text update at every original call without rebuilding unchanged tables',()=>{
  const F=fixture(source);F.paint();
  F.G.mini={k:0,st:'intro'};F.G.t=5;F.setRecord('첫 번째 밤 기록');F.paint();
  assert.match(F.el('tMiniSt').textContent,/설명 중.*5초/);assert.equal(F.el('tPerf').textContent,'첫 번째 밤 기록');
  F.G.mini.st='run';F.G.t=4.1;F.finish(6);F.setRecord('두 번째 밤 기록');F.paint();
  assert.match(F.el('tMiniSt').textContent,/골인 6명.*5초/);assert.equal(F.el('tPerf').textContent,'두 번째 밤 기록');
  F.G.mini.st='done';F.G.t=0;F.paint();assert.match(F.el('tMiniSt').textContent,/순위 발표.*0초/);
  F.G.mini=null;F.paint();assert.match(F.el('tMiniSt').textContent,/지금은 미니게임이 아닙니다/);
  assert.deepEqual(F.counts,{groups:1,rank:1,recorderCalls:5});
});
check('Replacing group/rank containers cannot leave a stale cache with an empty view',()=>{
  const F=fixture(source);F.paint();const expected=F.snapshot();
  F.replaceContainer('tGroups');F.replaceContainer('tRank');F.paint();
  assert.deepEqual(F.snapshot(),expected);assert.deepEqual(F.counts,{groups:2,rank:2,recorderCalls:2});
  F.paint();assert.deepEqual(F.counts,{groups:2,rank:2,recorderCalls:3});
});
function mutate(F,i){
  F.G.res[i%5].w++;
  if(i%4===0){const p=F.pcMap.get('u'+(i%21));if(p){p.mined+=21;p.lv++;}}
  if(i===25)F.pcMap.delete('u2');
  if(i===50)F.pcMap.set('u22',{n:'새친구 <A&B>',g:3,lv:4,mined:12,built:3});
  if(i===55)F.pcMap.get('u22').n='새 이름';
  if(i===60){F.pcMap.get('u22').g=1;F.STRU.delete(2);}
  if(i===70)F.G.mini={k:0,st:'run'};
  if(i>=70)F.G.t--;
  if(i===95)F.G.mini.st='done';
  if(i%10===0)F.setRecord('밤 성능 기록 '+i);
}
if(baseline)check('Actual baseline/current DOM and recorder calls remain identical for 350 UI ticks',()=>{
  const A=fixture(baseline),B=fixture(source);
  for(let i=0;i<350;i++){
    if(i>=250){mutate(A,i-250);mutate(B,i-250);}
    A.paint();B.paint();assert.deepEqual(B.snapshot(),A.snapshot(),'UI tick '+i);
  }
  assert.equal(A.counts.recorderCalls,350);assert.equal(B.counts.recorderCalls,350);
  assert.ok(B.counts.groups<A.counts.groups);assert.ok(B.counts.rank<A.counts.rank);
  console.log('  baseline '+JSON.stringify(A.counts)+'; current '+JSON.stringify(B.counts));
});
if(process.argv.includes('--bench')){
  assert.ok(baseline,'--bench requires --baseline previous.html');
  function bench(src){
    const F=fixture(src);F.paint();const start=performance.now();
    for(let i=0;i<250;i++)F.paint();
    return {ms:Math.round((performance.now()-start)*100)/100,groups:F.counts.groups,rank:F.counts.rank};
  }
  bench(baseline);bench(source);
  const trials=Array.from({length:5},(_,i)=>i%2?{current:bench(source),baseline:bench(baseline)}:{baseline:bench(baseline),current:bench(source)});
  const median=key=>trials.map(t=>t[key].ms).sort((a,b)=>a-b)[2];
  console.log('  isolated Node DOM / 250 unchanged ticks: '+JSON.stringify({baselineMedianMs:median('baseline'),currentMedianMs:median('current'),trials}));
}
console.log(`${checks.length}/${checks.length}`);
