// No browser launch: verify cursor-release behavior and the test browser guard in a VM.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { GAME } from './gamefile.mjs';
const html=fs.readFileSync(GAME,'utf8'), source=fs.readFileSync(new URL('./pw.mjs',import.meta.url),'utf8');
const handlers={},cv={},KEY={w:true,shift:true};let exits=0;
const doc={pointerLockElement:cv,hidden:false,addEventListener:(k,f)=>handlers[k]=f,exitPointerLock:()=>exits++};
const state={KEY,cv,document:doc,acting:true,throwing:true,wantJump:true,mvx:1,mvz:1,touchRun:true,touchJumpHeld:true,addEventListener:(k,f)=>handlers[k]=f};
vm.createContext(state);
const a=html.indexOf('function releaseGameInput()'),b=html.indexOf("addEventListener('mousemove'",a);
assert.ok(a>=0&&b>a);vm.runInContext(html.slice(a,b),state);
handlers.pointerlockchange();assert.equal(KEY.w,true,'Acquiring the lock keeps gameplay input');
doc.pointerLockElement=null;handlers.pointerlockchange();assert.ok(Object.values(KEY).every(x=>!x));
assert.equal(state.acting,false);assert.equal(state.throwing,false);assert.equal(state.mvx,0);
doc.pointerLockElement=cv;KEY.w=true;handlers.blur();assert.equal(KEY.w,false);assert.equal(exits,1);
KEY.w=true;handlers.visibilitychange();assert.equal(KEY.w,true,'Visible tab should not reset input');
doc.hidden=true;handlers.visibilitychange();assert.equal(KEY.w,false);assert.equal(exits,2);
assert.equal(/setTimeout\(\(\)=>cv\.requestPointerLock\(\)/.test(html),false,'No delayed automatic lock');
let actualRequests=0,initCount=0;
class FakeElement { requestPointerLock(){actualRequests++;} }
const initContext=vm.createContext({Element:FakeElement});
const context={addInitScript:async fn=>{initCount++;vm.runInContext(`(${fn.toString()})()`,initContext);}};
const browser={newContext:async()=>context,newPage:async()=>({context:()=>context})};
const pa=source.indexOf('function protectBrowser('),pb=source.indexOf('async function launch(',pa);
const protect=vm.runInNewContext(`(${source.slice(pa,pb).trim()})`);
protect(browser);await browser.newContext();await browser.newPage();
await new FakeElement().requestPointerLock();assert.equal(actualRequests,0);assert.equal(initCount,1);
console.log('PASS: lock release, focus/tab loss, input reset, no automatic lock, test pointer-lock guard (no browser launched).');
