// UI-only browser comparison: one real WebGL background, then native RAF + UI.
// This measures style/layout/paint work; it is not gameplay FPS or 21-device load.
// node t105-ui-performance.mjs before.html [after.html] [--frames 180] [--rounds 3] [--no-trace]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';

const args=process.argv.slice(2),pos=[];
let frames=180,rounds=3,traceFrames=120,withTrace=true;
for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--no-trace')withTrace=false;
  else if(['--frames','--rounds','--trace-frames'].includes(a)){
    const n=Number(args[++i]);assert.ok(Number.isInteger(n)&&n>0,a+' needs a positive integer');
    if(a==='--frames')frames=n;else if(a==='--rounds')rounds=n;else traceFrames=n;
  }else if(a.startsWith('--'))throw Error('Unknown option '+a);else pos.push(a);
}
assert.ok(pos[0],'Supply the preserved baseline HTML');
assert.ok(frames>=24&&traceFrames>=24,'At least 24 frames are needed for both change events');
const sourceFiles=[pos[0],pos[1]||GAME],out=path.resolve('artifacts/ui-performance105');
fs.mkdirSync(out,{recursive:true});
const sha=s=>createHash('sha256').update(s).digest('hex');
const sources=sourceFiles.map(file=>{const source=fs.readFileSync(file,'utf8');return {file:path.resolve(file),sha256:sha(source),source};});
const modes=['stat-idle','teacher-stable','teacher-change','hud-change'];
const hook=String.raw`
window.__ui105={
  async prepare(mode){
    window.__uiStopGame105();
    if(!G.started){el('iName').value='UI 비교';el('bSolo').click();window.__introDone();}
    document.querySelectorAll('.pop').forEach(e=>e.classList.remove('on'));
    document.body.classList.remove('waiting78','story78');
    el('story78').hidden=true;el('lobby78').hidden=true;
    el('stageTitle').classList.remove('on');el('n66Ban').classList.remove('on');
    G.started=true;G.host=true;G.paused=false;G.phase='day';G.day=12;G.t=100000;
    G.crystal=G.set.crystalMax;G.wolves.length=0;G.soldiers.length=0;spawnQ.length=0;
    G.players.clear();pcMap.clear();
    for(let i=0;i<21;i++){
      const id=i?'ui105-'+i:uid;
      pcMap.set(id,{g:i%5,n:'친구'+String(i+1).padStart(2,'0'),lv:10+i%5,mined:i*10,built:i%4});
      if(i)G.players.set(id,{uid:id,g:i%5,n:'친구'+i,x:8+(i%5)*2,y:GY,z:8-Math.floor(i/5)*2,hp:100,down:false});
    }
    G.res=Array.from({length:NG},(_,i)=>({w:100+i*10,s:80+i*10,g:20+i,eg:0,mk:0,pk:0}));
    Object.assign(XP,{lv:10,xp:0,pts:4,st:[0,0,0,0],job:-1,jt:0});
    Object.assign(PL,{x:18,y:GY,z:-25,yaw:0,pitch:-.12,down:false,hp:100});
    KIT.wpn=4;KIT.ammo=218;KIT.mag[4]=18;setAimMode(true,true);
    for(const k of Object.keys(DBG))if(typeof DBG[k]==='boolean')DBG[k]=false;
    DBG.noLogic=true;DBG.noVoice=true;
    window.__setSky(0);updSky(0,true);paintHUD();magHudPaint();drawMini();
    camera.position.set(18,GY+6,28);camera.lookAt(0,GY+1,0);scene.updateMatrixWorld(true);
    drawFrame();renderer.getContext().finish(); // Untimed: the frozen game remains behind the actual UI.
    // Measure settled HUD bounds before the modal can obscure them. This is outside CPU timing.
    await document.fonts.ready;
    await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));
    for(let i=0;i<48;i++)await window.__uiFrame105();
    const rect=id=>{const e=el(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);
      const visible=r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';
      return {x:r.x,y:r.y,width:r.width,height:r.height,visible,area:visible?r.width*r.height:0};};
    const geometry={panels:Object.fromEntries(['resBox','nightChip','crystalWrap','grpBar','misWrap','dayBox','rankWrap','topRight2','combatHud79','dock'].map(id=>[id,rect(id)])),
      minimap:{frame:rect('miniWrap'),canvas:rect('mini')}};
    if(mode==='stat-idle')openStat();else if(mode.startsWith('teacher-'))el('bTeach').click();
    const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {mode,participants:pcMap.size,openModals:document.querySelectorAll('.pop.on').length,enabledStatButtons:document.querySelectorAll('#stList .stBig button:not(:disabled)').length,
      graphics:{...GFX,width:renderer.domElement.width,height:renderer.domElement.height},
      renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),geometry};
  },
  async warm(mode,n=48){for(let i=0;i<n;i++){
    await window.__uiFrame105();
    if(i%8===0){paintHUD();magHudPaint();if(mode.startsWith('teacher-'))paintTeach();}
  }},
  async run(mode,n,label){
    let updates=0,changes=0,previous=0,first=0,last=0;const intervals=[];
    const startMark=label+'-start',endMark=label+'-end';performance.mark(startMark);
    for(let i=0;i<n;i++){
      const t=await window.__uiFrame105();if(previous)intervals.push(t-previous);else first=t;previous=t;last=t;
      if(mode==='teacher-change'&&(i===Math.floor(n/3)||i===Math.floor(2*n/3))){
        changes++;G.res[0].w+=7;G.res[2].s+=3;
        const p=pcMap.get('ui105-1');p.mined+=211;p.built++;
      }
      if(mode==='hud-change'&&(i===Math.floor(n/3)||i===Math.floor(2*n/3))){
        changes++;PL.hp-=7;KIT.ammo-=5;KIT.mag[4]-=3;G.res[G.me.g].w+=7;
      }
      // The game paints this HUD about every .12 s: one update per eight RAF callbacks here.
      if(i%8===0){paintHUD();magHudPaint();if(mode.startsWith('teacher-'))paintTeach();updates++;}
    }
    // A RAF callback runs before rendering. Two more turns include the final update's paint.
    for(let i=0;i<2;i++)last=await window.__uiFrame105();
    performance.mark(endMark);
    return {frames:n,drainFrames:2,updates,changes,startMark,endMark,
      callbackSpanMs:last-first,rafIntervalsMs:intervals};
  },
  async diagnose(mode,n){
    // Untimed replay: observing the old table replacements must not inflate its measured CPU time.
    const mutations={groups:0,rank:0};
    if(!mode.startsWith('teacher-'))return mutations;
    const observer=new MutationObserver(records=>{for(const r of records){
      if(el('tGroups').contains(r.target)||r.target===el('tGroups'))mutations.groups++;
      if(el('tRank').contains(r.target)||r.target===el('tRank'))mutations.rank++;
    }});
    for(const id of ['tGroups','tRank'])observer.observe(el(id),{subtree:true,childList:true,attributes:true,characterData:true});
    for(let i=0;i<n;i++){
      if(mode==='teacher-change'&&(i===Math.floor(n/3)||i===Math.floor(2*n/3))){
        G.res[0].w+=7;G.res[2].s+=3;const p=pcMap.get('ui105-1');p.mined+=211;p.built++;
      }
      if(i%8===0){paintHUD();magHudPaint();paintTeach();}
    }
    await Promise.resolve();observer.disconnect();return mutations;
  },
  snapshot(mode){
    const text=id=>el(id).textContent.replace(/\s+/g,' ').trim();
    if(mode==='hud-change')return {mode,participants:pcMap.size,openModals:document.querySelectorAll('.pop.on').length,
      resources:Object.fromEntries(['rW','rS','rG','rE','rM','rP'].map(id=>[id,el(id).querySelector('b').textContent])),
      hp:text('hpNum'),hpMax:text('hpMax79'),hpFill:el('hpFill').style.width,
      ammo:text('combatAmmo79'),reserve:text('combatReserve79'),weapon:text('combatWeapon79'),status:text('combatStatus79'),capacity:text('combatCapacity79'),
      groups:text('grpBar'),day:text('dayNum'),phase:text('dayPhase'),time:text('tSec')};
    return mode==='stat-idle'?{mode,buttons:document.querySelectorAll('#stList .stBig button:not(:disabled)').length,top:text('stTop'),stats:text('stList'),derived:text('stDeriv')}
      :{mode,participants:pcMap.size,groups:text('tGroups'),rank:text('tRank'),mini:text('tMiniSt')};
  }
};
`;
const instrumented=sources.map((s,i)=>{
  const marker='onIcons(()=>{ window.__READY = true; });';assert.ok(s.source.includes(marker),'Ready hook is present');
  const file=path.join(out,'instrumented-'+i+'.html');fs.writeFileSync(file,s.source.replace(marker,hook+'\n'+marker));return file;
});
const servers=instrumented.map((f,i)=>serve(20715+i,f));
const report={note:'UI-only: native RAF and real clocks; one untimed WebGL background draw; gameplay RAF stopped. Not gameplay FPS, GPU throughput, network or real 21-device performance.',
  sources:sources.map(({source,...s})=>s),viewport:{width:1366,height:768,deviceScaleFactor:1},frames,rounds,traceFrames,
  cadence:'paintHUD/magHudPaint every eight native RAF callbacks; paintTeach only in teacher modes; teacher-change and modal-free hud-change change their data twice',
  warmup:'48 native RAF callbacks with the measured mode\'s unchanged UI update cadence, outside timing',
  fontPolicy:'Google font requests blocked equally; embedded/local fonts awaited',runs:[],traces:[],errors:[]};
const durationKeys=['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'];
const countKeys=['LayoutCount','RecalcStyleCount'];
const metricMap=result=>Object.fromEntries(result.metrics.map(m=>[m.name,m.value]));
const metricWindowMs=(a,b)=>Number.isFinite(a.Timestamp)&&Number.isFinite(b.Timestamp)&&b.Timestamp>a.Timestamp?(b.Timestamp-a.Timestamp)*1000:null;
function delta(a,b){
  const v={};for(const k of [...durationKeys,...countKeys])v[k]=(k in a&&k in b)?(b[k]-a[k])*(durationKeys.includes(k)?1000:1):null;
  return v; // Duration entries are milliseconds. Missing protocol metrics stay null.
}
const median=a=>{a=a.filter(v=>v!==null&&Number.isFinite(v)).sort((a,b)=>a-b);return a.length?a[Math.floor(a.length/2)]:null;};
const percentile=(a,p)=>{a=a.slice().sort((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:null;};
const save=()=>fs.writeFileSync(path.join(out,'comparison.json'),JSON.stringify(report,null,2));
function unionMs(ranges){
  ranges.sort((a,b)=>a[0]-b[0]);let sum=0,start,end;
  for(const [a,b]of ranges){if(start===undefined){start=a;end=b;}else if(a<=end)end=Math.max(end,b);else{sum+=end-start;start=a;end=b;}}
  return(sum+(start===undefined?0:end-start))/1000;
}
function summarizeTrace(events,run){
  const a=events.find(e=>e.name===run.startMark),b=events.find(e=>e.name===run.endMark);
  assert.ok(a&&b&&b.ts>a.ts,'Trace includes both user timing markers');
  const names=new Set(['UpdateLayoutTree','RecalculateStyles','Layout','PrePaint','Paint','RasterTask','CompositeLayers']);
  const threads=new Map(events.filter(e=>e.ph==='M'&&e.name==='thread_name').map(e=>[e.pid+':'+e.tid,e.args?.name||'']));
  const groups=new Map();
  for(const e of events){
    if(e.ph!=='X'||!names.has(e.name)||e.pid!==a.pid||!(e.dur>0))continue;
    const lo=Math.max(a.ts,e.ts),hi=Math.min(b.ts,e.ts+e.dur);if(hi<=lo)continue;
    const key=e.name+'|'+e.tid;let g=groups.get(key);
    if(!g){g={name:e.name,thread:threads.get(e.pid+':'+e.tid)||String(e.tid),mainThread:e.tid===a.tid,count:0,ranges:[]};groups.set(key,g);}
    g.count++;g.ranges.push([lo,hi]);
  }
  return {windowMs:(b.ts-a.ts)/1000,pid:a.pid,mainTid:a.tid,
    note:'Per-event, per-thread interval unions. Categories can overlap; do not sum these rows as total CPU. Raster work in other processes is outside this table. Missing rows mean not observed in this trace.',
    components:[...groups.values()].map(({ranges,...g})=>({...g,ms:unionMs(ranges)}))};
}
async function endTrace(cdp,file){
  const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');
  const result=await done;assert.equal(result.dataLossOccurred,false,'Trace buffer must not drop events');assert.ok(result.stream);
  const chunks=[];for(;;){const r=await cdp.send('IO.read',{handle:result.stream});chunks.push(Buffer.from(r.data,r.base64Encoded?'base64':'utf8'));if(r.eof)break;}
  await cdp.send('IO.close',{handle:result.stream});const data=Buffer.concat(chunks);fs.writeFileSync(file,data);
  return JSON.parse(data.toString('utf8')).traceEvents;
}
let browser;
async function visit(index,round,tracing=false){
  // Only one live game page: the other version cannot compete for CPU/compositor time.
  const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({index,round,message:e.message}));
  try{
    await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
    await context.addInitScript(()=>{
      localStorage.setItem('sndOn','0');
      let seed=105105;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      const raf=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window),pending=new Set();let stop=false;
      window.__uiFrame105=()=>new Promise(resolve=>raf(resolve));
      window.__uiStopGame105=()=>{stop=true;for(const id of pending)cancel(id);pending.clear();};
      window.requestAnimationFrame=f=>{if(stop)return 0;const id=raf(t=>{pending.delete(id);f(t);});pending.add(id);return id;};
    });
    await page.goto('http://127.0.0.1:'+(20715+index)+'/?gfx=mid',{timeout:240000,waitUntil:'load'});
    await page.waitForFunction(()=>window.__READY===true,null,{timeout:240000});
    const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable',{timeDomain:'timeTicks'});
    for(const mode of modes){
      const {geometry,...setup}=await page.evaluate(m=>__ui105.prepare(m),mode);assert.equal(setup.participants,21);
      if(mode==='stat-idle')assert.equal(setup.enabledStatButtons,4,'Four enabled buttons exercise the unchanged stat menu');
      if(mode==='hud-change')assert.equal(setup.openModals,0,'The gameplay HUD is unobscured by modals');
      await page.evaluate(async m=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await __ui105.warm(m);},mode);
      if(tracing)await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream',streamFormat:'json'});
      const before=metricMap(await cdp.send('Performance.getMetrics'));
      const label='ui105-'+mode+'-'+index+'-'+round;
      const run=await page.evaluate(({mode,n,label})=>__ui105.run(mode,n,label),{mode,n:tracing?traceFrames:frames,label});
      const after=metricMap(await cdp.send('Performance.getMetrics'));
      const snapshot=await page.evaluate(m=>__ui105.snapshot(m),mode);
      assert.equal(run.changes,mode==='teacher-change'||mode==='hud-change'?2:0);
      if(mode==='hud-change'){
        assert.equal(snapshot.openModals,0);assert.equal(snapshot.hp,'86','Both HP changes reached the HUD');
        assert.equal(snapshot.ammo,'12','Both magazine changes reached the HUD');assert.equal(snapshot.reserve,'196','Both total-ammunition changes reached the HUD');
      }
      const row={index,version:index?'after':'before',round,mode,setup,geometry,metricsWindowMs:metricWindowMs(before,after),metricsMsAndCounts:delta(before,after),
        ...run,rafIntervalMs:{median:median(run.rafIntervalsMs),p95:percentile(run.rafIntervalsMs,.95)},snapshot};
      delete row.rafIntervalsMs;
      if(tracing){
        const file=path.join(out,'trace-'+mode+'-'+(index?'after':'before')+'.json');
        const events=await endTrace(cdp,file);row.traceFile=file;row.trace=summarizeTrace(events,run);
      }
      row.mutations=await page.evaluate(({mode,n})=>__ui105.diagnose(mode,n),{mode,n:tracing?traceFrames:frames});
      row.mutationNote='Teacher-table counts only, from a separate untimed synchronous replay after metrics and trace collection. No table observer/replay in stat or HUD modes.';
      if(tracing)report.traces.push(row);else report.runs.push(row);
      save();console.log((tracing?'TRACE ':'MEASURE ')+mode+' '+row.version+' '+round+' '+JSON.stringify(row.metricsMsAndCounts)+' mutations='+JSON.stringify(row.mutations));
    }
  }finally{await context.close();}
}
try{
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  report.browser=browser.version();report.rendererPolicy='ANGLE SwiftShader software renderer; identical for both versions';
  for(let r=0;r<rounds;r++)for(const i of r%2?[1,0]:[0,1])await visit(i,r,false);
  report.summary={};
  for(const mode of modes){
    const paired=[];
    for(let r=0;r<rounds;r++){
      const A=report.runs.find(x=>x.mode===mode&&x.round===r&&x.index===0),B=report.runs.find(x=>x.mode===mode&&x.round===r&&x.index===1);
      assert.deepEqual(B.setup,A.setup,mode+' same workload/graphics');assert.deepEqual(B.snapshot,A.snapshot,mode+' same final UI data');
      assert.deepEqual(B.geometry.minimap,A.geometry.minimap,mode+' minimap canvas/frame exact rectangle');
      assert.equal(B.updates,A.updates);paired.push([A,B]);
    }
    const metrics={};for(const key of [...durationKeys,...countKeys]){
      const before=median(paired.map(p=>p[0].metricsMsAndCounts[key])),after=median(paired.map(p=>p[1].metricsMsAndCounts[key]));
      const rate=row=>row.metricsWindowMs>0&&row.metricsMsAndCounts[key]!==null?row.metricsMsAndCounts[key]/row.metricsWindowMs*1000:null;
      const beforeRate=median(paired.map(p=>rate(p[0]))),afterRate=median(paired.map(p=>rate(p[1])));
      metrics[key]={before,after,changePercent:before>0&&after!==null?(after/before-1)*100:null,
        perSecond:{before:beforeRate,after:afterRate,changePercent:beforeRate>0&&afterRate!==null?(afterRate/beforeRate-1)*100:null,
          unit:durationKeys.includes(key)?'CPU milliseconds per elapsed second':'events per elapsed second'}};
    }
    const panels={};for(const id of Object.keys(paired[0][0].geometry.panels)){
      const beforeArea=median(paired.map(p=>p[0].geometry.panels[id].area)),afterArea=median(paired.map(p=>p[1].geometry.panels[id].area));
      panels[id]={beforeArea,afterArea,changePercent:beforeArea>0?(afterArea/beforeArea-1)*100:null};
    }
    report.summary[mode]={metrics,units:'Duration fields: total milliseconds over the fixed UI workload; Count fields: event counts.',
      metricsWindowMs:{before:median(paired.map(p=>p[0].metricsWindowMs)),after:median(paired.map(p=>p[1].metricsWindowMs))},
      callbackSpanMs:{before:median(paired.map(p=>p[0].callbackSpanMs)),after:median(paired.map(p=>p[1].callbackSpanMs))},
      rateNote:'Per-second values use each run\'s CDP Performance Timestamp interval, then take the median. The CDP interval includes command boundary overhead. Keep absolute totals and raw rounds alongside rates; native RAF counts do not guarantee equal wall time.',
      geometry:{note:'Untimed before-modal bounding rectangles, after fonts/images and 48 settling RAFs. Panel areas are individual CSS px², not a union or viewport coverage estimate.',panels,minimapRectEqual:true,minimap:paired[0][0].geometry.minimap},
      finalUiDataEqual:true,rounds:paired.map(([a,b])=>({before:a.metricsMsAndCounts,after:b.metricsMsAndCounts})),
      mutations:{before:paired.map(p=>p[0].mutations),after:paired.map(p=>p[1].mutations)}};
  }
  // Trace overhead is excluded from the primary AB/BA metrics above.
  if(withTrace)for(const i of [0,1])await visit(i,'trace',true);
  assert.deepEqual(report.errors,[]);save();console.log('PASS fixed-workload UI data parity; compare raw rounds and component timings in '+path.join(out,'comparison.json'));
}finally{save();await browser?.close();await Promise.all(servers.map(s=>new Promise(resolve=>s.close(resolve))));}
