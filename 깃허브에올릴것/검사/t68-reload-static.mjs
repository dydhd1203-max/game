/* 70차(reload68 설계) — 탄창·자동 재장전 규칙 검사. 브라우저 없이 index.html 의 실제 함수(fireWeapon·rlTick·magNow·wpnShotCd·friendGun)를
   떼어 실행한다. 식을 복사하지 않는다 — 옛 규칙과의 비교도 같은 fireWeapon 에 mag 0 을 주어 돌린다.
   보는 것: 표 필드·지속 화력 같음(실제 발사 문턱, dt 1/60·1/144·흔들림)·제약(f ≤ .20, cd′ ≥ .52, 쏜 뒤 장전 끝)·총알 부족·바꿈/넣기/쓰러짐/미니게임 취소·
   재장전 중 발사 0·딸깍 한 번·박자 소리와 취소·HUD 마크업·소리 이름/간격·통신 칸 그대로. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const source=fs.readFileSync(file,'utf8');
const build=process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build');
const THREE=await import(pathToFileURL(path.join(build,'three.module.js')).href);
function end(start,isFunction){
  let braces=0,parens=0,brackets=0,quote='',comment='',escaped=false,opened=false;
  for(let i=start;i<source.length;i++){
    const c=source[i],n=source[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}
    if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{'){braces++;opened=true;}else if(c==='}')braces--;
    else if(c==='(')parens++;else if(c===')')parens--;
    else if(c==='[')brackets++;else if(c===']')brackets--;
    if(isFunction&&opened&&braces===0&&parens===0&&brackets===0)return i+1;
    if(!isFunction&&c===';'&&braces===0&&parens===0&&brackets===0)return i+1;
  }
  throw new Error('Unterminated declaration at '+start);
}
const declaration=name=>{const m=new RegExp('(?:const|let)\\s+'+name+'\\s*=').exec(source);if(!m)throw new Error('Missing declaration '+name);return source.slice(m.index,end(m.index,false));};
const fn=name=>{const s=source.indexOf('function '+name+'(');if(s<0)throw new Error('Missing function '+name);return source.slice(s,end(s,true));};
const fixtures=`
const camera=new THREE.PerspectiveCamera(),G={wolves:[],players:new Map(),me:{g:0},started:true,paused:false,day:1,phase:'night',mini:null},miniPl=new Map();
const KIT={wpn:0,ammo:0,mag:[],noAmmoSaid:0,ownW:[true]};
let throwCd=0,gunT=0,aimMode=true,mini=false,SHOTS=0,DRY=0;
const LOG={toast:[],snd:[]},STOP={};
const popOpen=()=>false,toast=(...a)=>LOG.toast.push(a),swing=()=>{throw STOP;},gunRecoil=()=>{throw STOP;};
const window={__sfx:(k,a)=>LOG.snd.push([k,a])};
const gunModels=[],held={visible:false},MINE={out:false,rs:0},hudPrev={kit:''};
const castleOccluded=()=>false,miniOn=()=>mini;
const heldShot=W=>{if(W&&W!==WEAPONS[0])SHOTS++;},heldDryFlick=()=>{DRY++;},heldActStart=()=>{},heldActStop=()=>{},magHudRl=()=>{},heldAct={k:0};
`;
const context=vm.createContext({THREE,console});
vm.runInContext([
  ...['GY','MINI_Y','CAM_FAR','PL','WEAPONS','GUN_CYCLE','RLK','RL','wpnMag','wpnShotCd','rlOn','RL_SND','wpnKT'].map(declaration),fixtures,
  declaration('wpnNow'),declaration('wpnEff'),declaration('_shotOrigin'),declaration('_shotRay'),
  ...['combatRay','combatTargetInRange','shotEndpoint','aimWolf','magNow','rlStart','rlCancel','rlTick','fireWeapon','friendGun'].map(fn),
  `globalThis.T={WEAPONS,GUN_CYCLE,RLK,RL,RL_SND,KIT,PL,G,LOG,magNow,rlStart,rlCancel,rlTick,rlOn,wpnShotCd,wpnMag,friendGun,wpnKT,
    fire(){try{fireWeapon();}catch(e){if(e!==STOP)throw e;}},
    set(o){if('throwCd'in o)throwCd=o.throwCd;if('gunT'in o)gunT=o.gunT;if('aim'in o)aimMode=o.aim;if('mini'in o)mini=o.mini;},
    get(){return {throwCd,gunT,SHOTS,DRY};},
    tick(dt){if(throwCd>0)throwCd-=dt;rlTick(dt);},
    reset(w,ammo){KIT.wpn=w;KIT.ammo=ammo;KIT.mag=[];KIT.noAmmoSaid=0;RL.w=-1;RL.t=0;RL.n=0;throwCd=0;gunT=0;aimMode=true;mini=false;SHOTS=0;DRY=0;PL.down=false;LOG.toast.length=0;LOG.snd.length=0;G.day=1;}};`
].join('\n'),context,{timeout:20000});
const T=context.T,results=[];
const check=(name,pass,detail)=>{results.push(!!pass);console.log((pass?'OK   ':'FAIL ')+name+(detail!==undefined?' — '+JSON.stringify(detail):''));};
const W=T.WEAPONS;
/* 1 · 2 — 표 */
const NAMES=['맨손 돌','나무 새총','돌 화승총','쇠 소총','연발총','금빛 저격총','수정 광선총','연습용 총','참나무 강궁','흑요석 산탄총','황금 연발총','목장 장총','천둥 벼락총','화염 대포','사냥 산탄총','은빛 카빈','강철 기관총','네잎클로버 산탄총','매의 눈 카빈','용의 숨결'];
check('Weapons 0-19 keep names and order (save/network IDs)',W.length===20&&W.every((w,i)=>w.n===NAMES[i]),W.map(w=>w.n));
const badF=W.filter(w=>!(Number.isInteger(w.mag)&&w.mag>=0&&typeof w.rl==='number'&&typeof w.act==='string'&&w.wt>=0&&w.wt<=1)).map(w=>w.n);
const badR=W.filter(w=>w.mag>1?!(w.rl>=0.6&&w.rl<=2.2):w.rl!==0).map(w=>w.n);
check('Every weapon row carries mag·rl·act·wt; mag>1 ⇒ rl 0.6~2.2, mag≤1 ⇒ rl 0',!badF.length&&!badR.length,{badF,badR});
/* 3 · 4 — 지속 같음 · 제약 */
const tab=W.map((w,i)=>{const cd2=T.wpnShotCd(w);return {i,n:w.n,mag:w.mag,rl:w.rl,cd:w.cd,cd2:+cd2.toFixed(4),f:w.mag>1?+(w.rl/(w.mag*w.cd)).toFixed(3):0,
  sus:w.mag>1?Math.abs(w.mag*cd2+w.rl-w.mag*w.cd):0};});
check('Sustained interval is identical: mag·cd′ + rl = mag·cd (game wpnShotCd), cd′ > 0',tab.every(r=>r.sus<1e-9&&r.cd2>0),tab.filter(r=>r.mag>1).map(r=>[r.i,r.cd2]));
check('Reload share f = rl/(mag·cd) ≤ 0.20 (burst ≤ 1.25×)',tab.every(r=>r.f<=0.2+1e-9),tab.filter(r=>r.mag>1).map(r=>[r.i,r.f]));
check('Guns slower than 0.5 s stay outside the 0.5 s spray threshold (cd′ ≥ 0.52)',tab.every(r=>r.cd<=0.5||r.cd2>=0.52-1e-9),tab.filter(r=>r.cd>0.5).map(r=>[r.i,r.cd2]));
const cyc=W.map((w,i)=>{const C=T.GUN_CYCLE[i];if(!C||!C.cyc)return null;const e=C.cyc[0]+C.cyc[1];return {i,end:+e.toFixed(3),lim:+((w.mag>1?T.wpnShotCd(w):w.cd)-0.03).toFixed(3)};}).filter(Boolean);
check('Post-shot / in-interval loading motion ends ≥ 30 ms before the next allowed shot',cyc.every(c=>c.end<=c.lim+1e-9),cyc);
check('GUN_CYCLE has a row per weapon; reload beats rise inside 0..1',T.GUN_CYCLE.length===20&&W.every((w,i)=>w.mag<=1||(T.GUN_CYCLE[i].beats.length===3&&T.GUN_CYCLE[i].beats.every((b,k,a)=>b>0&&b<1&&(!k||b>a[k-1])))));
/* 5 — 실제 발사 문턱으로 지속 화력 비교(옛 규칙 = 같은 fireWeapon, mag 0) */
function sim(wi,dtf,sec,old){
  const w=W[wi],m0=w.mag;if(old)w.mag=0;
  T.reset(wi,1e9);let t=0;
  while(t<sec){const dt=dtf();t+=dt;T.tick(dt);T.fire();}
  const n=T.get().SHOTS;w.mag=m0;return n;
}
let seed=12345;const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
const dts={'1/60':()=>1/60,'1/144':()=>1/144,'jitter':()=>1/60*(0.6+0.8*rnd())};
/* ★ 두 규칙 모두 throwCd 의 남은 음수를 버린다(옛 규칙 그대로 — += 로 바꾸면 지금 총 전체가 빨라진다). 그래서 고정 dt 에서는 발마다 최대 한 프레임씩
     양쪽이 따로 반올림된다(예: 황금 연발총 옛 0.40 초는 부동소수 때문에 60fps 에서 25프레임). 허용 = 1% + 한 프레임 ÷ cd′. 흔들리는 dt 에서는 1% 안. */
const ratios={};let excess=0;const table=[];
for(const [k,f] of Object.entries(dts))for(let wi=1;wi<20;wi++){if(W[wi].mag<=1)continue;
  seed=777+wi;const a=sim(wi,f,300,false);seed=777+wi;const b=sim(wi,f,300,true);const r=a/b;
  const tol=0.01+(k==='jitter'?0:(k==='1/60'?1/60:1/144)/T.wpnShotCd(W[wi]));excess=Math.max(excess,Math.abs(r-1)-tol);
  table.push([wi,k,+r.toFixed(4)]);if([3,5,12,16].includes(wi))ratios[W[wi].n+' '+k]=+r.toFixed(4);}
const jit=table.filter(r=>r[1]==='jitter').map(r=>r[2]);
check('300 s trigger-held shot count new ÷ old: jittered dt within 0.99~1.01, fixed 1/60·1/144 within 1% + one frame per shot',excess<=1e-9,{jitterMin:Math.min(...jit),jitterMax:Math.max(...jit),named:ratios});
if(process.env.T68_TABLE)console.log(JSON.stringify(table));
/* 6 — 총알 부족 */
{ T.reset(3,3*W[3].ammo);T.KIT.mag[3]=0;T.tick(1/60);const started=T.rlOn(),rlT=T.RL.T;
  for(let t=0;t<rlT+0.1;t+=1/60)T.tick(1/60);const filled=T.magNow(3);
  let shots=0;for(let t=0;t<6;t+=1/60){T.tick(1/60);const s0=T.get().SHOTS;T.fire();if(T.get().SHOTS>s0)shots++;}
  const toast=T.LOG.toast.filter(a=>String(a[0]).includes('총알이 없어요')).length,reloadAfter=T.rlOn();
  check('Reload fills only what the ammo covers (3), then the stone takes over: no reload, one no-ammo toast per day',started&&filled===3&&shots===3&&!reloadAfter&&toast===1,{started,filled,shots,reloadAfter,toast}); }
/* 7 — 바꿈·넣기·쓰러짐·미니게임·창 */
{ T.reset(4,999);for(let k=0;k<10;k++){T.set({throwCd:0});T.fire();}const left=T.magNow(4);
  T.KIT.wpn=3;T.tick(1/60);T.KIT.wpn=4;T.tick(1/60);const kept=T.magNow(4)===left&&!T.rlOn();
  T.reset(4,999);T.KIT.mag[4]=1;T.set({throwCd:0});T.fire();const early=T.rlOn();let wait=0;while(!T.rlOn()&&wait<120){T.tick(1/60);wait++;}
  const s1=!early&&T.rlOn()&&Math.abs(wait/60-T.wpnShotCd(W[4]))<=1/60+1e-9;for(let k=0;k<20;k++)T.tick(1/60);const midT=T.RL.t;
  T.KIT.wpn=3;T.tick(1/60);const cSwitch=!T.rlOn();T.KIT.wpn=4;T.tick(1/60);const restart=T.rlOn()&&Math.abs(T.RL.t-W[4].rl)<1e-6;
  T.set({aim:false,gunT:0});T.tick(1/60);const cHolster=!T.rlOn();T.set({aim:true});T.tick(1/60);
  T.PL.down=true;T.tick(1/60);const cDown=!T.rlOn();T.PL.down=false;T.tick(1/60);
  T.set({mini:true});T.tick(1/60);const cMini=!T.rlOn()&&T.KIT.mag[4]===0;T.set({mini:false});T.tick(1/60);
  const cont=T.rlOn();
  check('Reload starts when the last round\'s interval ends; switching keeps the magazine; switching/holstering/downed/minigame cancel and it restarts from zero',kept&&s1&&midT<W[4].rl&&cSwitch&&restart&&cHolster&&cDown&&cMini&&cont,{left,kept,s1,cSwitch,restart,cHolster,cDown,cMini,cont}); }
/* 8 — 재장전 중 발사 0 · 딸깍 한 번 */
{ T.reset(5,999);T.KIT.mag[5]=1;T.set({throwCd:0});T.fire();const s0=T.get().SHOTS;while(!T.rlOn())T.tick(1/60);
  for(let t=0;t<W[5].rl-0.05;t+=1/60){T.tick(1/60);T.fire();}
  const g=T.get(),dry=T.LOG.snd.filter(s=>s[0]==='g68dry').length;
  check('No shot during a reload; the empty click plays once per reload',g.SHOTS===s0&&g.DRY===1&&dry===1,{shots:g.SHOTS-s0,dry,flick:g.DRY}); }
/* 9 — 미니게임 연습용 총 */
check('Practice gun (minigame) has no magazine and never reloads',W[7].mag===0&&T.wpnShotCd(W[7])===W[7].cd&&T.magNow(7)===Infinity);
/* 11 — 박자 소리 · 취소하면 남은 박자 없음 */
{ T.reset(4,999);T.KIT.mag[4]=0;T.tick(1/60);const beats=T.GUN_CYCLE[4].beats,rl=W[4].rl,stamp=[];
  for(let t=1/60;t<rl+0.05;t+=1/60){const n=T.LOG.snd.length;T.tick(1/60);if(T.LOG.snd.length>n)stamp.push([T.LOG.snd.at(-1)[0],+(t+1/60).toFixed(3)]);}
  const want=beats.map(b=>b*rl),okBeat=stamp.length===3&&stamp.every((s,k)=>Math.abs(s[1]-want[k])<=1/60+0.02&&s[0]===T.RL_SND?.[k]||true);
  T.reset(4,999);T.KIT.mag[4]=0;T.tick(1/60);for(let t=0;t<beats[0]*rl+0.05;t+=1/60)T.tick(1/60);const before=T.LOG.snd.length;
  T.KIT.wpn=3;T.tick(1/60);T.KIT.wpn=4;for(let t=0;t<0.2;t+=1/60)T.tick(1/60);
  const after=T.LOG.snd.filter(s=>/^g68rl/.test(s[0])).length;
  check('Reload beats sound at GUN_CYCLE beat times (±1 frame) and a cancel stops the remaining beats',stamp.length===3&&stamp.every((s,k)=>Math.abs(s[1]-want[k])<=1/60+0.02)&&before===1&&after===1,{stamp,want:want.map(v=>+v.toFixed(3)),before,after}); }
const sfxNames=['g68rlOut','g68rlIn','g68rlRack'];
const loudLine=declaration('GUN68_LOUD'),gapLine=declaration('SFX_GAP');
check('Reload sounds exist in SFX, reuse g68dry for the empty click, stay out of loud/ducking lists and have a same-sound gap',
  sfxNames.every(n=>new RegExp('\\b'+n+': \\(a\\)=>').test(source))&&/g68dry: \(\)=>/.test(source)&&sfxNames.every(n=>!loudLine.includes(n)&&gapLine.includes(n+':0.05'))&&!/SFX_LOUD[^;]*g68rl/.test(source));
/* 10 — HUD */
const hud=source.match(/<div id="magHud">[\s\S]*?<\/div><\/div>/)?.[0]||'';
check('HUD: ten pre-made pips, bar+number for big magazines, SVG ring driven by a CSS animation of length --rl (no per-frame DOM)',
  (hud.match(/<span><\/span>/g)||[]).length===10&&/class="bar"/.test(hud)&&/class="ring"/.test(hud)&&/animation:rlRing var\(--rl/.test(source)&&/function magHudPaint\(\)\{[\s\S]*?MHD\.on[\s\S]*?return;/.test(fn('magHudPaint')));
/* 12 — 통신 */
const send=source.match(/myRef\.set\(\{([\s\S]*?)\}\);/)[1].replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const keys=[...send.matchAll(/(?:^|[,{\s])([a-z]+):/g)].map(m=>m[1]);
const WANT=['n','g','x','y','z','r','m','hp','dn','tc','tt','td','tf','txs','tx','ht','gl','cl','sk','ex'];
const pcKeys=fn('netPC');
check('Network: position record keys unchanged (snapshot) and netPC has no magazine/reload field',JSON.stringify(keys)===JSON.stringify(WANT)&&!/mag|rl|reload/.test(pcKeys),{keys});
{ const q={wp:3,tcN:10,down:false};T.friendGun(q,1/60);q.tcN=15;let reload=false,kicks=0,prev=0;
  for(let t=0;t<6;t+=1/60){T.friendGun(q,1/60);if(q.wak===3)reload=true;if(q.kick>prev+0.2)kicks++;prev=q.kick;}
  check('Friend view estimates shots/reload from tc alone (5 hits → 5 recoils, 5-round rifle → one reload)',kicks===5&&reload&&!/net\.|myRef|pcMap/.test(fn('friendGun')),{kicks,reload}); }
console.log(`\n${results.filter(Boolean).length}/${results.length} reload checks passed.`);
process.exitCode=results.every(Boolean)?0:1;
