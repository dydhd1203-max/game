// Actual paintKit DOM regression: ammunition changes preserve potion controls,
// while equipment, buffs, purchases and explicit invalidation still refresh.
// 105: attack/defense use fixed swords/shield icons across equipment changes.
// Node DOM work counts are not browser/GPU timings or classroom FPS claims.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {GAME} from './gamefile.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const file=process.argv[2]||GAME,source=fs.readFileSync(file,'utf8');
const baselineAt=process.argv.indexOf('--baseline');
const baseline=baselineAt<0?null:fs.readFileSync(process.argv[baselineAt+1],'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const extract=source=>new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
let lib;
for(const p of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){
  try{lib=require(p);break;}catch{}
}
if(!lib)throw Error('linkedom required (or set DOM_MODULE)');
const checks=[];
function check(name,run){run();checks.push(name);console.log('PASS '+name);}
function fixture(src){
  const {document}=lib.parseHTML(src),{fn,decl}=extract(src),counts={writes:0,buttons:0};
  const byId=id=>document.getElementById(id);
  function countSetter(obj,key){
    let p=obj,d;
    while(p&&!(d=Object.getOwnPropertyDescriptor(p,key)))p=Object.getPrototypeOf(p);
    if(!d?.get||!d?.set)throw Error('Missing DOM accessor '+key);
    Object.defineProperty(obj,key,{configurable:true,get(){return d.get.call(this);},set(v){counts.writes++;d.set.call(this,v);}});
  }
  for(const id of ['stAtk','stDef']){
    const e=byId(id);countSetter(e.firstChild,'nodeValue');countSetter(e,'title');countSetter(e.querySelector('b'),'textContent');
    const toggle=e.classList.toggle.bind(e.classList);e.classList.toggle=(...args)=>{counts.writes++;return toggle(...args);};
  }
  countSetter(byId('stAmmo').querySelector('b'),'textContent');
  countSetter(byId('mbThrow').querySelector('.ic'),'textContent');countSetter(byId('mbThrow').lastChild,'nodeValue');
  countSetter(byId('potRow'),'innerHTML');
  const create=document.createElement.bind(document);document.createElement=(tag,...args)=>{if(tag==='button')counts.buttons++;return create(tag,...args);};
  const c=vm.createContext({document,console});
  vm.runInContext(`
const KIT={wpn:4,arm:0,ammo:200,pot:[2,3,1,4],bAtk:0,bDef:0,bSpd:0,enh:Array(30).fill(0)};
const G={day:1},XP={st:[0,0,0,0]},hudPrev={},used=[];
let atk=30,def=0;
const el=id=>document.getElementById(id),wpnNow=()=>WEAPONS[KIT.wpn],wpnDmg=()=>atk,defNow=()=>def;
const enhOf=i=>KIT.enh[i]||0,enhTxt=e=>e?' +'+e:'';
function usePotion(i){if(KIT.pot[i]>0){KIT.pot[i]--;used.push(i);hudPrev.kit='';}}
${['POT_SEC','WEAPONS','ARMORS','POTIONS'].map(decl).join('\n')}
${fn('paintKit')}
globalThis.T={KIT,G,XP,hudPrev,used,WEAPONS,ARMORS,POTIONS,paint:paintKit,setNumbers(a,d){atk=a;def=d;},numbers:()=>({atk,def})};
`,c);
  const T=c.T;
  return {T,document,counts,el:byId,resetCounts(){counts.writes=counts.buttons=0;},snapshot(){
    return ['stAtk','stDef','stAmmo','mbThrow','potRow'].map(id=>{const e=byId(id);return {id,html:e.innerHTML,title:e.title,cls:e.className,display:e.style.display};});
  }};
}
const F=fixture(source),T=F.T;
function expected(f){
  const {T,el}=f,W=T.WEAPONS[T.KIT.wpn],A=T.ARMORS[T.KIT.arm],{atk,def}=T.numbers();
  assert.equal(el('stAtk').firstChild.nodeValue,'⚔️','Attack keeps the fixed swords icon, not the equipped weapon icon');
  assert.equal(el('stDef').firstChild.nodeValue,'🛡️','Defense keeps the fixed shield icon, not the equipped armor icon');
  assert.equal(el('stAtk').querySelector('b').textContent,String(atk));assert.equal(el('stDef').querySelector('b').textContent,String(def));
  assert.equal(el('stAmmo').querySelector('b').textContent,String(T.KIT.ammo));
  assert.equal(el('stAtk').title,'공격력 — '+W.n+(T.KIT.enh[T.KIT.wpn]?' +'+T.KIT.enh[T.KIT.wpn]:''));
  assert.equal(el('stDef').title,'방어력 — '+A.n);
  assert.equal(el('mbThrow').querySelector('.ic').textContent,W.ic);assert.equal(el('mbThrow').lastChild.nodeValue,T.KIT.wpn?' 쏘기':' 던지기');
  assert.equal(el('stAmmo').style.display,(T.KIT.wpn>0&&W.ammo>0)||T.KIT.ammo>0?'':'none');
  assert.equal(el('stAtk').classList.contains('buffed'),T.KIT.bAtk>0);assert.equal(el('stDef').classList.contains('buffed'),T.KIT.bDef>0);
  const visible=T.POTIONS.map((P,i)=>({P,i,n:T.KIT.pot[i]})).filter(p=>p.n>0),buttons=[...el('potRow').children];
  assert.equal(buttons.length,visible.length);
  for(let k=0;k<buttons.length;k++){const {P,i,n}=visible[k],b=buttons[k];assert.equal(b.textContent,P.ic+n+(i+6));assert.equal(b.title,P.n+' — '+P.d);}
}
check('Fixed stat icons, equipment numbers, touch action and potion labels match current game data',()=>{T.paint();expected(F);});
check('200 ammunition updates create no potion buttons and only write the ammunition number',()=>{
  const buttons=[...F.el('potRow').children],handlers=buttons.map(b=>b.onclick);F.resetCounts();
  for(let n=199;n>=0;n--){T.KIT.ammo=n;T.paint();expected(F);}
  assert.equal(F.counts.buttons,0);assert.equal(F.counts.writes,200);
  assert.deepEqual([...F.el('potRow').children],buttons);assert.deepEqual(buttons.map(b=>b.onclick),handlers);
  console.log('  work: '+JSON.stringify(F.counts));
});
check('Unchanged HUD ticks and unchanged explicit invalidation do no DOM work',()=>{
  F.resetCounts();for(let i=0;i<100;i++)T.paint();T.hudPrev.kit='';T.paint();assert.deepEqual(F.counts,{writes:0,buttons:0});
});
check('Weapon, armor, enhancement, stat/buff/day changes retain fixed stat icons, current numbers and stable potion controls',()=>{
  const buttons=[...F.el('potRow').children];
  for(const change of [()=>T.KIT.wpn=0,()=>T.KIT.arm=1,()=>{T.KIT.wpn=5;T.KIT.enh[5]=6;},()=>{T.XP.st[0]++;T.setNumbers(75,3);},()=>{T.KIT.bAtk=8;T.KIT.bDef=7;T.setNumbers(120,28);},()=>{T.KIT.bAtk=T.KIT.bDef=0;T.setNumbers(75,3);},()=>{T.G.day++;T.setNumbers(80,3);}]){change();T.paint();expected(F);assert.deepEqual([...F.el('potRow').children],buttons);}
});
check('Explicit invalidation recalculates numeric outputs even with the same input cache key',()=>{
  T.setNumbers(91,15);T.hudPrev.kit='';T.paint();expected(F);
});
check('Preserved potion click handlers consume the right slot once and refresh its count',()=>{
  for(let i=0;i<T.POTIONS.length;i++){
    const b=[...F.el('potRow').children].find(b=>b.querySelector('b').textContent===String(i+6)),before=T.KIT.pot[i];
    b.click();assert.equal(T.KIT.pot[i],before-1);assert.equal(T.used[T.used.length-1],i);T.paint();expected(F);
  }
  assert.equal(T.used.length,T.POTIONS.length);
});
check('Potion purchase, exhaustion and a new-game inventory replacement rebuild only when counts change',()=>{
  T.KIT.pot[2]=2;T.paint();expected(F);T.KIT.pot.fill(0);T.paint();expected(F);assert.equal(F.el('potRow').children.length,0);
  T.KIT.pot=[1,0,2,0];T.hudPrev.kit='';T.paint();expected(F);
});
if(baseline)check('Before/after DOM parity across ammunition, equipment, potion and invalidation transitions',()=>{
  const A=fixture(baseline),B=fixture(source),apply=f=>{f.T.paint();return f.snapshot();};
  const scenarios=[()=>{},...Array.from({length:200},(_,i)=>T=>{T.KIT.ammo=199-i;}),T=>{T.KIT.wpn=0;},T=>{T.KIT.arm=1;},T=>{T.KIT.wpn=5;T.KIT.enh[5]=6;},T=>{T.KIT.bAtk=10;T.setNumbers(60,20);},T=>{T.KIT.bAtk=0;T.KIT.bDef=10;T.XP.st[0]=2;T.setNumbers(70,25);},T=>{T.G.day++;T.setNumbers(73,25);},T=>{T.KIT.pot=[0,1,2,0];},T=>{T.KIT.pot=[0,0,0,0];},T=>{T.KIT.pot=[1,1,1,1];},T=>{T.setNumbers(200,80);T.hudPrev.kit='';}];
  for(const change of scenarios){change(A.T);change(B.T);assert.deepEqual(apply(A),apply(B));}
  console.log('  baseline work: '+JSON.stringify(A.counts)+'; optimized work: '+JSON.stringify(B.counts));
});
console.log(`${checks.length}/${checks.length}`);
