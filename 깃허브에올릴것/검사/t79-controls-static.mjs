// Execute the actual keydown listener and reload functions. --render repeats the
// controls against the whole game in a hidden, pointer-lock-protected browser.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import vm from 'node:vm';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const file=process.argv.slice(2).find(a=>!a.startsWith('--'))||GAME,source=fs.readFileSync(file,'utf8');
const parser=fs.readFileSync(path.join(here,'t54-race-static.mjs'),'utf8');
const {fn,decl}=new Function('source',parser.slice(parser.indexOf('function end('),parser.indexOf('const results=[];'))+';return {fn,decl};')(source);
let lib;for(const p of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){try{lib=require(p);break;}catch{}}
if(!lib)throw Error('linkedom required');const {document}=lib.parseHTML('<html><body></body></html>');
const inputStart=source.indexOf('/* ═══════════════════════ 입력'),kdStart=source.indexOf("addEventListener('keydown', e=>{",inputStart);
const kd=source.slice(kdStart,source.indexOf("addEventListener('keyup'",kdStart));
const c=vm.createContext({document,console}),fixture=`
const G={phase:'day',started:true,paused:false},PL={down:false},SPEC={on:false},KIT={wpn:4,ammo:200,mag:[]},KEY={},LOG={sounds:[],tool:[],aim:[]};
let aimMode=true,gunT=0,throwCd=0,throwing=false,pop=false,wantJump=false,curTool='mine',curBuild=null;
const BKEYS=[],heldAct={k:0},hudPrev={kit:''},miniOn=()=>G.phase==='mini',popOpen=()=>pop;
const wpnNow=()=>WEAPONS[KIT.wpn],window={__sfx:(...a)=>LOG.sounds.push(a)},toast=()=>{},magHudRl=()=>{};
const selectTool=t=>{curTool=t;curBuild=null;LOG.tool.push(t);};
function heldActStart(k){heldAct.k=k;}function heldActStop(){heldAct.k=0;}
function setAimMode(on){if(aimMode===on)return;aimMode=on;LOG.aim.push(on);if(!on)rlCancel();}
function addEventListener(kind,cb){if(kind==='keydown')globalThis.kd=cb;}
`;
vm.runInContext([fixture,...['WEAPONS','TOOLS','GUN_CYCLE','RLK','RL','wpnMag','rlOn','RL_SND'].map(decl),...['waiting78','pregame78','gunToggleOk','toggleGun','gunAway','pickTool','manualReload79','magNow','rlStart','rlCancel','rlTick'].map(fn),kd,`
globalThis.T={G,PL,SPEC,KIT,KEY,LOG,RL,WEAPONS,TOOLS,rlTick,rlCancel,rlOn,manualReload79,toggleGun,
get:()=>({aim:aimMode,tool:curTool,rl:rlOn(),t:RL.t,mag:KIT.mag[KIT.wpn],ammo:KIT.ammo}),
set(o){if('aim'in o)aimMode=o.aim;if('pop'in o)pop=o.pop;},
reset(){G.phase='day';G.started=true;G.paused=false;PL.down=false;SPEC.on=false;KIT.wpn=4;KIT.ammo=200;KIT.mag=[];KIT.mag[4]=12;RL.w=-1;RL.t=0;RL.b=0;RL.n=0;aimMode=true;gunT=throwCd=0;throwing=pop=false;curTool='mine';curBuild=null;heldAct.k=0;for(const k in LOG)LOG[k].length=0;}};`].join('\n'),c);
const T=c.T,checks=[],check=(name,ok,data)=>{checks.push({name,pass:!!ok,data});console.log((ok?'PASS ':'FAIL ')+name+(data===undefined?'':' '+JSON.stringify(data)));};
const key=(k,opt={})=>{const e={key:k,target:document.body,repeat:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...opt};c.kd(e);return e;};
T.reset();key('r');const begun=T.get();T.rlTick(.2);const remaining=T.RL.t;key('r');key('r',{repeat:true});
check('R starts one timed partial-magazine reload; repeat and fresh presses cannot restart it',begun.rl&&begun.mag===12&&begun.ammo===200&&T.RL.n===1&&T.RL.t===remaining&&T.get().tool==='mine');
T.rlTick(3);check('Completion uses the existing reload/ammo rules and all three existing sound beats',T.KIT.mag[4]===T.WEAPONS[4].mag&&T.KIT.ammo===200&&T.LOG.sounds.length===3&&!T.rlOn(),T.get());
const guards=[];for(const [name,set]of [['full',()=>T.KIT.mag[4]=T.WEAPONS[4].mag],['no-spare',()=>{T.KIT.ammo=12;T.KIT.mag[4]=12;}],['empty',()=>T.KIT.ammo=0],['one-shot',()=>T.KIT.wpn=2],['hidden',()=>T.set({aim:false})]]){T.reset();set();key('r');guards.push({name,blocked:!T.rlOn()&&T.RL.n===0});}
check('Full, no-spare, empty, one-shot and hidden guns do not reload or draw themselves',guards.every(v=>v.blocked),guards);
T.reset();T.KIT.wpn=5;T.KIT.ammo=7;T.KIT.mag[5]=1;key('R');T.rlTick(3);check('Two-ammo sniper partial reload only exposes the three affordable rounds, without spending or minting ammo',T.KIT.mag[5]===3&&T.KIT.ammo===7);
T.reset();key('r');T.rlTick(.2);key('t');key('t');check('T holsters once, cancels reload and selects repair; a second T never draws the gun',!T.get().aim&&!T.rlOn()&&T.get().tool==='repair'&&T.LOG.aim.length===1&&T.KIT.mag[4]===12,T.get());
const blocked=[];for(const [name,set]of [['paused',()=>T.G.paused=true],['down',()=>T.PL.down=true],['spectating',()=>T.SPEC.on=true],['popup',()=>T.set({pop:true})],['not-started',()=>T.G.started=false],...['title','lobby','intro','mini','win','lose'].map(p=>[p,()=>T.G.phase=p])]){for(const k of ['r','t']){T.reset();set();key(k);blocked.push({name,k,ok:!T.rlOn()&&T.get().aim&&T.get().tool==='mine'});}}
check('Both actions are inactive in paused/down/popup/spectator/lobby/intro/minigame/end states',blocked.every(v=>v.ok),blocked.filter(v=>!v.ok));
const mods=[];for(const opt of [{repeat:true},{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},{defaultPrevented:true}])for(const k of ['r','t']){T.reset();key(k,opt);mods.push(!T.rlOn()&&T.get().tool==='mine'&&T.get().aim);}
check('Autorepeat, browser shortcuts, IME composition and consumed events cannot trigger R/T',mods.every(Boolean));
const edits=[];for(const markup of ['<input>','<textarea></textarea>','<select></select>','<div contenteditable><span>x</span></div>','<div contenteditable="plaintext-only"><span>x</span></div>','<div contenteditable="true"><span>x</span></div>']){document.body.innerHTML=markup;const target=document.body.firstElementChild.lastElementChild||document.body.firstElementChild;for(const k of ['r','t']){T.reset();key(k,{target});edits.push(!T.rlOn()&&T.get().tool==='mine');}}
check('Typing in fields and nested editable elements is preserved',edits.every(Boolean));
T.reset();T.toggleGun();const a=T.get().aim;T.toggleGun();check('Existing right-click toggle still toggles exactly twice; repair hotbar key is T',!a&&T.get().aim&&T.TOOLS.find(t=>t.id==='repair').key==='T');
check('Help and danger messages advertise R reload/T repair without the removed T gun path',source.includes('R 재장전 · T 수리')&&!source.includes("if(k==='t') toggleGun();")&&!source.includes('🔧R')&&source.includes('<b>Q·T·E·F·V·1~6</b>'));
const out=path.resolve('artifacts/race79/controls');fs.mkdirSync(out,{recursive:true});let browserResults;
if(process.argv.includes('--render')){
 const {chromium}=await import('./pw.mjs'),{serve}=await import('./serve2.mjs');const server=serve(20619,file);let browser;const errors=[];
 try{browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});const page=await browser.newPage({viewport:{width:960,height:600}});page.on('pageerror',e=>errors.push(e.message));await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
  await page.addInitScript(()=>{localStorage.setItem('sndOn','0');const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Set();let stop=false;requestAnimationFrame=f=>{if(stop)return 0;const id=raf(t=>{pending.delete(id);f(t);});pending.add(id);return id;};window.__stopKey79=()=>{stop=true;for(const id of pending)cancel(id);pending.clear();};});
  await page.goto('http://127.0.0.1:20619/?gfx=mid',{timeout:240000,waitUntil:'load'});await page.waitForFunction(()=>__READY===true,null,{timeout:240000});
  browserResults=await page.evaluate(()=>{
   document.getElementById('iName').value='조작 검사';document.getElementById('bSolo').click();__introDone();__stopKey79();__G.phase='day';__G.paused=false;__DBG().noLogic=true;__PL.down=false;__SPEC().on=false;document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));document.activeElement?.blur();
   const rows=[],put=(name,pass,data)=>rows.push({name,pass:!!pass,data}),state=()=>({...__ctrl66(),t:__RL.t,rl:__rlOn(),mag:__KIT.mag[4],ammo:__KIT.ammo,n:__RL.n}),reset=()=>{__rlCancel();__G.phase='day';__G.paused=false;__PL.down=false;__SPEC().on=false;__KIT.wpn=4;__KIT.ammo=200;__KIT.mag[4]=12;__setAim(true,true);__setThrowCd(0);__RL.n=0;},press=(key,options={},target=document.body)=>{target.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));target.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));};
   reset();press('r');const first=state();__rlTick(.2);const t=__RL.t;press('r',{repeat:true});press('r');put('actual keydown R starts only once',first.rl&&first.mag===12&&__RL.t===t&&__RL.n===1,state());__rlTick(3);put('actual reload completes with the same total ammo',__KIT.mag[4]===25&&__KIT.ammo===200&&!__rlOn(),state());
   reset();press('r');press('t');press('t');put('actual T cancels/holsters and stays repair',!__rlOn()&&!__ctrl66().aim&&__ctrl66().tool==='repair',state());press('r');put('actual hidden gun R stays hidden',!__rlOn()&&!__ctrl66().aim);
   const cv=document.querySelector('#app > canvas');if(!cv)throw Error('Main renderer canvas missing');cv.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true,cancelable:true}));put('actual right-click still draws',__ctrl66().aim);cv.dispatchEvent(new MouseEvent('mousedown',{button:2,bubbles:true,cancelable:true}));put('actual right-click still holsters',!__ctrl66().aim);
   const guards=[];for(const phase of ['title','lobby','intro','mini','win','lose']){reset();__G.phase=phase;const tool=__ctrl66().tool;press('r');press('t');guards.push(!__rlOn()&&__ctrl66().aim&&__ctrl66().tool===tool);}for(const what of ['pause','down','spec','popup']){reset();if(what==='pause')__G.paused=true;if(what==='down')__PL.down=true;if(what==='spec')__SPEC().on=true;if(what==='popup')document.getElementById('popKit').classList.add('on');const tool=__ctrl66().tool;press('r');press('t');guards.push(!__rlOn()&&__ctrl66().aim&&__ctrl66().tool===tool);document.getElementById('popKit').classList.remove('on');}put('actual inactive phase/state guards',guards.every(Boolean),guards);
   const typing=[];for(const markup of ['<input>','<textarea></textarea>','<div contenteditable><span>x</span></div>','<div contenteditable="plaintext-only"><span>x</span></div>']){reset();const box=document.createElement('div');box.innerHTML=markup;document.body.appendChild(box);const target=box.querySelector('span')||box.firstElementChild;const tool=__ctrl66().tool;press('r',{},target);press('t',{},target);typing.push(!__rlOn()&&__ctrl66().tool===tool);box.remove();}reset();for(const opts of [{ctrlKey:true},{altKey:true},{metaKey:true},{repeat:true},{isComposing:true}]){press('r',opts);press('t',opts);typing.push(!__rlOn()&&__ctrl66().aim);}put('actual DOM typing/modifiers/IME/repeat guards',typing.every(Boolean),typing);return rows;
  });check('Full game DOM keydown/mousedown integration',browserResults.every(r=>r.pass)&&errors.length===0,{rows:browserResults,errors});
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
fs.writeFileSync(path.join(out,process.argv.includes('--render')?'browser-results.json':'static-results.json'),JSON.stringify({checks,browserResults},null,2));
console.log(`${checks.filter(r=>r.pass).length}/${checks.length}`);if(checks.some(r=>!r.pass))process.exitCode=1;
