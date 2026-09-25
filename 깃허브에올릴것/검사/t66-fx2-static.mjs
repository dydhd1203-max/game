/* 66차 FX2 — 축하·드문 사건·보스 연출. 브라우저 없이 실제 게임 소스의 FX2 덩어리(fx2…·rareOf)와
   보스 날짜 함수(bossDays·bossIndex·MINI_DAYS)를 떼어 와 실행한다. 계산식을 복사하지 않고 게임 함수를 그대로 부른다.
   ① 드문 사건 — 5일차 전·보스 밤·미니게임 날 없음, 이틀 연달아 없음, 같은 사건 연달아 없음, 방 400개 평균 빈도, 끄기
   ② 결정적 — 같은 방·날이면 누구나 같은 사건 · 황금 좀비는 호스트와 손님이 같은 좀비를 고른다
   ③ 축하 줄 — 레벨 합치기·보스 끼어들기·밤엔 작게·줄 길이 상한
   ④ 보스 — 등장·절반·10%·처치(호스트는 체력 0, 손님은 사라짐+낮은 %)·시간 끝 퇴각은 처치 아님
   ⑤ 통신 — 이 덩어리는 net.child 를 부르지 않는다(보상은 기존 drop/chest/say 통로)
   ⑥ 소리 — 새 소리 전부 기존 합성 함수만 · 세기 상한
   ⑦ 배선 — 호출 지점(xpGain·bgEarn·takeJob·misWatch·buyWeapon·craftWeapon·raceDone·dreadTick)과 DOM·CSS 층
   linkedom 이 필요하다(t53-shop-static 과 같은 방식). */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {GAME} from './gamefile.mjs';

const require=createRequire(import.meta.url);
let domLib;
for(const c of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){
  try{domLib=require(c);break;}catch{}
}
if(!domLib)throw new Error('linkedom is required');
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const code=source.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!code)throw new Error('Game module not found');
function scanEnd(start,stopAtBrace=false){
  let brace=0,paren=0,bracket=0,quote='',comment='',escaped=false,opened=false;
  for(let i=start;i<code.length;i++){
    const c=code[i],n=code[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}
    if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}
    if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}
    if(c==='{'){brace++;opened=true;}else if(c==='}')brace--;
    else if(c==='(')paren++;else if(c===')')paren--;
    else if(c==='[')bracket++;else if(c===']')bracket--;
    if(stopAtBrace&&opened&&brace===0&&paren===0&&bracket===0)return i+1;
    if(!stopAtBrace&&c===';'&&brace===0&&paren===0&&bracket===0)return i+1;
  }
  throw new Error('Unterminated source: '+code.slice(start,start+70));
}
function declaration(name){const m=new RegExp('(?:const|let)\\s+'+name+'\\s*=').exec(code);
  if(!m)throw new Error('Missing declaration '+name);return code.slice(m.index,scanEnd(m.index));}
function fn(name){const start=code.indexOf('function '+name+'(');if(start<0)throw new Error('Missing function '+name);
  return code.slice(start,scanEnd(start,true));}
const B0=code.indexOf('/* ═══════════════════════ 66차 FX2'),B1=code.indexOf('Object.assign(window, {__fx2');
if(B0<0||B1<0)throw new Error('FX2 block not found');
const block=code.slice(B0,B1);

const results=[];
const check=(name,pass,detail)=>{results.push(!!pass);console.log((pass?'OK   ':'FAIL ')+name+(detail===undefined?'':' — '+JSON.stringify(detail)));};

/* 한 판(호스트 또는 손님) — 새 vm 문맥. 같은 소스를 두 번 올려 서로 다른 화면처럼 쓴다 */
function makeGame(host){
  const {document}=domLib.parseHTML(source);
  const fixture=`
  const D={rareEvents:true};
  const G={started:true,phase:'day',day:1,t:100,set:{goalDay:18,nightSec:130,daySec:140,crystalMax:200},room:'',host:${host},wolves:[],chests:[],drops:[],
    nk:-1,focus:2,crystal:200,paused:false,me:{g:0,name:'검사'}};
  const log={burst:0,spark:0,ring:0,sfx:[],shake:[],drop:[],say:[],chest:0,snd:[]};
  const THREE={Vector3:class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
      normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;this.x/=l;this.y/=l;this.z/=l;return this;}project(){this.z=0.5;return this;}},
    Quaternion:class{setFromUnitVectors(){return this;}},Matrix4:class{compose(){return this;}},
    InstancedMesh:class{constructor(){this.instanceMatrix={};}setMatrixAt(){}},BoxGeometry:class{},MeshBasicMaterial:class{}};
  const scene={add(){}},ZEROM={},camera={},innerWidth=1366,innerHeight=768;
  const PL={x:0,y:0,z:0,yaw:0};const GY=0,NG=5,ARENA_R=46,CH_MAX=3,CH_LIFE=50,MIS_XP=130;let chSeq=1;
  let stageT=0,fireN=0,fireT=0,skyK=0,metWait=20;
  const el=id=>document.getElementById(id);
  const burst=(...a)=>{log.burst+=a[4]===undefined?10:a[4];},spark=()=>{log.spark++;},ring=()=>{log.ring++;};
  const shake=(p,s)=>log.shake.push(p),sfx=k=>log.sfx.push(k),sfxFrom=k=>log.sfx.push(k);
  const tpvOn=()=>true,forward=()=>({x:0,z:-1}),terrAt=()=>0,sectorOf=()=>1;
  const chestSpot=g=>[g+0.5,3.5],netChests=()=>{log.chest++;},say=m=>log.say.push(m);
  const dropGold=w=>log.drop.push(w);
  const esc=s=>String(s),josa=(s,a,b)=>a,pcMap=new Map(),uid='me';
  const JOBS=[{ic:'🤠'}],jobName=()=>'카우보이',NIGHT_DEF=[{n:'조용한 밤'}];
  const WOLF_T={0:{hp:10},3:{n:'좀비 대장',boss:1},7:{n:'좀비왕',boss:4}};
  const isBoss=k=>!!(WOLF_T[k]&&WOLF_T[k].boss);
  const BAL={bossReward:[{w:60,s:50,g:12,heal:40}]};
  const pluck=(...a)=>log.snd.push(['pluck',a[2]]),tone=(...a)=>log.snd.push(['tone',a[4]]),puff=(...a)=>log.snd.push(['puff',a[1]]),
        noise=(...a)=>log.snd.push(['noise',a[1]]),thump=(...a)=>log.snd.push(['thump',a[3]]),crackSweep=(...a)=>log.snd.push(['crack',a[1]]);
  const now0=()=>0,SFX={};
  const setTimeout=(f)=>{f();return 0;};
  `;
  const payload=[fixture,declaration('PROG_REF'),declaration('progRef'),fn('bossDays'),fn('bossIndex'),fn('bossWolfK'),
    declaration('BOSS_K4'),declaration('MINI_DAYS'),declaration('miniDayIdx'),block,
    `globalThis.API={G,log,FX2,RARE,rareOf,fx2Cel,fx2Tick,fx2Phase,fx2MeteorPlan,fx2SfxReady,SFX,fx2Pop3D,RARE_P,bossIndex,bossDays,
      setStage:v=>{stageT=v;},fire:()=>fireN,metWait:()=>metWait,setSky:v=>{skyK=v;},doc:document};`];
  const ctx=vm.createContext({document,console,Math,JSON,Map,Set,Infinity,Object,Array,String,Number});
  new vm.Script(payload.join('\n'),{filename:'t66-fx2-actual.js'}).runInContext(ctx,{timeout:10000});
  return ctx.API;
}
const H=makeGame(true),C=makeGame(false);

// ① 드문 사건 규칙
{ const A=H,G=A.G;let tot=0,games=0,bad=[];const kinds={gold:0,meteor:0,lucky:0};
  for(let r=0;r<400;r++){ G.room='room'+r;let prev=-9,prevK=-1;games++;
    for(let d=1;d<=G.set.goalDay;d++){ const k=A.rareOf(d);if(k<0)continue;tot++;kinds[A.RARE[k].k]++;
      if(d<5)bad.push(['early',r,d]);
      if(A.bossIndex(d)>=0)bad.push(['boss',r,d]);
      if([5,10,15].includes(d))bad.push(['mini',r,d]);
      if(d===prev+1)bad.push(['consecutive',r,d]);
      if(k===prevK)bad.push(['same',r,d]);
      prev=d;prevK=k; } }
  const per=tot/games, every=14/per;
  check('No rare event before day 5, on boss nights or on minigame days; never two days in a row; never the same event twice in a row',bad.length===0,bad.slice(0,5));
  check('Rare events average about one per three days after day 4 (18-day game, 400 rooms)',every>=2.7&&every<=4.2,{perGame:+per.toFixed(2),everyDays:+every.toFixed(2),p:A.RARE_P});
  check('All three rare events occur and none dominates',Object.values(kinds).every(n=>n>tot*0.2),kinds);
  G.room='solo';G.set.rareEvents=false;const off=[...Array(18)].map((_,i)=>A.rareOf(i+1)).filter(k=>k>=0).length;G.set.rareEvents=true;
  check('Teacher setting rareEvents:false turns every rare event off',off===0,off);
  check('Teacher setting rareEvents is in window.DEFAULTS and copied into G.set (host sends it with meta.set)',
    /rareEvents:\s*true/.test(source.slice(0,6000))&&/G\.set\.rareEvents === undefined\) G\.set\.rareEvents = D\.rareEvents !== false/.test(block));
}
// ② 결정적 — 호스트와 손님
{ let same=true;for(let r=0;r<50;r++){H.G.room=C.G.room='det'+r;for(let d=1;d<=18;d++)if(H.rareOf(d)!==C.rareOf(d))same=false;}
  check('Host and guest compute the same rare event for every room/day',same);
  let differ=0;for(let r=0;r<40;r++){H.G.room='a'+r;const a=[...Array(18)].map((_,i)=>H.rareOf(i+1)).join();H.G.room='b'+r;const b=[...Array(18)].map((_,i)=>H.rareOf(i+1)).join();if(a!==b)differ++;}
  check('Different rooms get different schedules',differ>30,differ);
  // 황금 좀비 — 같은 좀비 목록이면 같은 좀비가 금빛
  let room=null,day=0;for(let r=0;r<300&&!room;r++){H.G.room='g'+r;for(let d=5;d<=18;d++)if(H.rareOf(d)>=0&&H.RARE[H.rareOf(d)].k==='gold'){room=H.G.room;day=d;break;}}
  const picks=[];
  for(const A of [H,C]){ const G=A.G;G.room=room;G.day=day;G.phase='day';A.fx2Tick(0.016);G.phase='night';G.t=120;A.fx2Tick(0.016);
    G.wolves.length=0;for(let i=0;i<12;i++)G.wolves.push({id:500+i,k:0,x:i,z:0,y:0,hp:A===H?10:100,mx:A===H?10:100});
    A.fx2Tick(0.016);A.fx2Tick(0.016);picks.push(A.FX2.gold&&A.FX2.gold.id);
    check((A===H?'Host':'Guest')+': golden zombie is tinted gold and is one of the first eight of the night',A.FX2.gold&&A.FX2.gold.col===0xffc21f&&A.FX2.gold.id>=503&&A.FX2.gold.id<=507,{id:A.FX2.gold&&A.FX2.gold.id}); }
  check('Host and guest pick the same golden zombie from the zombie ids they both already receive',picks[0]&&picks[0]===picks[1],picks);
  // 잡기 — 호스트는 체력 0, 손님은 사라짐 + 낮은 %
  const gH=H.FX2.gold;gH.hp=0;H.G.wolves.splice(H.G.wolves.indexOf(gH),1);const d0=H.log.drop.length;H.fx2Tick(0.016);
  check('Host: catching the golden zombie drops extra gold through the existing drop path (boss-sized pile)',H.log.drop.length===d0+1&&H.log.drop.at(-1).bi===0);
  const gC=C.FX2.gold;gC.hp=6;C.G.wolves.splice(C.G.wolves.indexOf(gC),1);const r0=C.FX2.stats.rare;C.fx2Tick(0.016);
  check('Guest: sees the catch celebration but never drops gold itself',C.FX2.stats.rare===r0+1&&C.log.drop.length===0);
  check('Golden zombie is drawn all gold through one flag in drawWolves (hit flash still wins)',/: w\.fx2Gold \? 0xffc21f/.test(code)&&/const hit    = !!hitCol \|\| w\.healed>0 \|\| !!w\.fx2Gold;/.test(code));
  for(const A of [H,C]){A.G.phase='day';A.G.wolves.length=0;A.fx2Tick(0.016);}
}
// 유성우 — 같은 자리·같은 때, 호스트만 금
{ let room=null,day=0;for(let r=0;r<300&&!room;r++){H.G.room='m'+r;for(let d=5;d<=18;d++)if(H.rareOf(d)>=0&&H.RARE[H.rareOf(d)].k==='meteor'){room=H.G.room;day=d;break;}}
  const plans=[];
  for(const A of [H,C]){const G=A.G;G.room=room;G.day=day;G.phase='day';A.fx2Tick(0.016);G.phase='night';G.t=A.G.set.nightSec;A.fx2Tick(0.016);
    plans.push(JSON.stringify(A.FX2.mets.map(m=>[+m.t.toFixed(3),+m.x.toFixed(3),+m.z.toFixed(3)])));}
  check('Meteor shower plans the same fall times and spots on host and guest',plans[0]===plans[1]&&H.FX2.mets.length===7,H.FX2.mets.length);
  check('Every meteor lands inside the village field and falls during the night',H.FX2.mets.every(m=>Math.hypot(m.x,m.z)<=46-5&&m.t>5&&m.t<H.FX2.nightLen-5));
  for(const A of [H,C]){const G=A.G;A.setSky(1);for(let i=0;i<Math.ceil((H.FX2.mets.at(-1).t+2)/0.05);i++){G.t-=0.05;A.fx2Tick(0.05);}}
  check('Host drops a little gold where each meteor lands (7 landings, existing drop path)',H.log.drop.filter(w=>w.bi===-1).length===7,H.log.drop.length);
  check('Guest sees every meteor land but drops nothing',C.FX2.stats.met===7&&C.log.drop.length===0,C.FX2.stats.met);
  check('Sky shooting stars are sped up on the meteor night only through the existing metWait timer',H.metWait()<=3.1);
  for(const A of [H,C]){A.G.phase='day';A.fx2Tick(0.016);}
}
// 행운의 아침 — 호스트가 상자 하나 더
{ let room=null,day=0;for(let r=0;r<300&&!room;r++){H.G.room='l'+r;for(let d=5;d<=18;d++)if(H.rareOf(d)>=0&&H.RARE[H.rareOf(d)].k==='lucky'){room=H.G.room;day=d;break;}}
  for(const A of [H,C]){const G=A.G;G.room=room;G.day=day-1;G.phase='night';A.fx2Tick(0.016);G.day=day;G.phase='day';G.chests.length=1;A.fx2Tick(0.016);
    for(let i=0;i<60;i++)A.fx2Tick(0.05);}
  check('Lucky morning: host adds one more treasure chest (up to CH_MAX) and announces it with say()',H.G.chests.length===2&&H.log.chest===1&&H.log.say.length>=1);
  check('Lucky morning: guest shows the notice but adds no chest itself',C.G.chests.length===1&&C.log.chest===0&&C.FX2.stats.rare>=1);
  const S=makeGame(true);S.G.room=room;S.G.day=day-1;S.G.phase='day';S.fx2Tick(0.016);S.G.day=day;S.fx2Tick(0.016);for(let i=0;i<60;i++)S.fx2Tick(0.05);
  check('Lucky morning still happens when the night passes inside one frame (teacher skip)',S.G.chests.length===1&&S.log.chest===1);
}
// ③ 축하 줄
{ const A=makeGame(true),G=A.G;G.phase='day';A.fx2Tick(0.016);
  A.fx2Cel({k:'lv',tt:'레벨 2!',ic:'⭐',snd:'fx2Lv'});A.fx2Cel({k:'lv',tt:'레벨 3!',ic:'⭐',snd:'fx2Lv'});A.fx2Cel({k:'lv',tt:'레벨 4!',ic:'⭐',snd:'fx2Lv'});
  check('Several level-ups at once update one banner instead of queueing three',A.FX2.q.length===0&&A.doc.querySelector('#celBan .cTt').textContent==='레벨 4!');
  A.fx2Cel({k:'mis',tt:'임무'});A.fx2Cel({k:'gun',tt:'총'});
  check('Other celebrations wait in line one at a time',A.FX2.q.length===2&&A.FX2.cur.k==='lv');
  A.fx2Cel({k:'boss',now:true,tt:'보스 처치!',big:true});
  for(let i=0;i<10;i++)A.fx2Tick(0.05);
  check('Boss defeat cuts in front of the line',A.FX2.cur&&A.FX2.cur.k==='boss'&&/big/.test(A.doc.getElementById('celBan').className));
  for(let i=0;i<9;i++)A.fx2Cel({k:'gun',tt:'총'+i});
  check('Queue is capped (a flood of small ones cannot pile up forever)',A.FX2.q.length<=6,A.FX2.q.length);
  const B=makeGame(true);B.G.phase='night';B.fx2Tick(0.016);B.fx2Cel({k:'lv',tt:'레벨 9!',sub:'C 키'});
  check('At night (fighting) a celebration is small, high and without the subtitle line',/\bnt\b/.test(B.doc.getElementById('celBan').className)&&B.doc.querySelector('#celBan .cSub').textContent==='');
  const E=makeGame(true);E.G.phase='day';E.fx2Tick(0.016);E.setStage(3);E.fx2Cel({k:'lv',tt:'x'});
  check('While the big morning title is up, the banner waits',!E.FX2.cur&&E.FX2.q.length===1);
  E.setStage(0);E.fx2Tick(0.016);const early=!E.FX2.cur;for(let i=0;i<40;i++)E.fx2Tick(0.016);
  check('…and shows about half a second after the title is gone (its fade-out)',early&&E.FX2.cur&&E.FX2.cur.k==='lv');
  const P=makeGame(true);P.log.burst=0;P.log.spark=0;P.fx2Pop3D('big',0xffd84a);
  check('3D celebration uses a small slice of the shared 160-particle pool',P.log.burst+P.log.spark<=60,{burst:P.log.burst,spark:P.log.spark});
}
// ④ 보스
{ for(const host of [true,false]){ const A=makeGame(host),G=A.G;G.day=5;G.phase='day';A.fx2Tick(0.016);G.phase='night';G.t=120;
    for(let i=0;i<30;i++)A.fx2Tick(0.05);
    const intro=A.FX2.stats.boss===1&&/on/.test(A.doc.getElementById('fx2Bars').className)&&/좀비/.test(A.doc.querySelector('#fx2Cap .n').textContent);
    const mx=host?30000:100,w={id:77,k:3,x:5,z:9,y:0,hp:mx,mx};G.wolves.push(w);A.fx2Tick(0.016);
    const appear=A.FX2.stats.boss===2&&A.FX2.arrowT>0&&A.log.shake.every(p=>p<=0.35);
    w.hp=mx*0.45;A.fx2Tick(0.2);const half=A.FX2.bossW50&&/fx2r1/.test(A.doc.getElementById('bossWrap').className)&&A.doc.getElementById('fx2BPh')?.textContent.includes('2단계');
    w.hp=mx*0.08;A.fx2Tick(0.2);const ten=A.FX2.bossW10&&/fx2r2/.test(A.doc.getElementById('bossWrap').className);
    if(host)w.hp=0;G.wolves.length=0;A.fx2Tick(0.016);
    const down=A.FX2.stats.boss===3&&A.FX2.cur&&A.FX2.cur.k==='boss'&&A.fire()>=8&&/on/.test(A.doc.getElementById('fx2Flash').className)&&!/fx2r/.test(A.doc.getElementById('bossWrap').className);
    const who=host?'Host':'Guest';
    check(who+': boss night start shows letterbox bars and the boss name caption',intro);
    check(who+': boss appearance — caption, rumble, only a weak shake (≤0.35), direction marker',appear,A.log.shake);
    check(who+': half and 10% warnings with boss bar phase text/border',half&&ten);
    check(who+': defeat — flash, speed lines, fireworks, big celebration; bar decoration cleared',down); }
  const A=makeGame(false),G=A.G;G.day=5;G.phase='day';A.fx2Tick(0.016);G.phase='night';G.t=0.5;
  const w={id:9,k:3,x:0,z:0,y:0,hp:40,mx:100};G.wolves.push(w);A.fx2Tick(0.016);G.wolves.length=0;A.fx2Tick(0.016);
  check('Guest: boss that leaves at dawn with health left is not celebrated as defeated',A.FX2.stats.boss<=2&&!(A.FX2.cur&&A.FX2.cur.k==='boss'));
  const Hh=makeGame(true);Hh.G.day=5;Hh.G.phase='day';Hh.fx2Tick(0.016);Hh.G.phase='night';Hh.G.t=0;const w2={id:3,k:3,x:0,z:0,y:0,hp:900,mx:30000};
  Hh.G.wolves.push(w2);Hh.fx2Tick(0.016);Hh.G.wolves.length=0;Hh.fx2Tick(0.016);
  check('Host: boss cleared by the night timer (hp > 0) is not celebrated',!(Hh.FX2.cur&&Hh.FX2.cur.k==='boss'));
}
// 밤을 버텼다
{ const A=makeGame(true),G=A.G;G.day=3;G.phase='day';A.fx2Tick(0.016);G.phase='night';A.fx2Tick(0.016);G.day=4;G.phase='day';G.crystal=150;A.fx2Tick(0.016);
  check('Surviving a night: fireworks at once and a small banner (3일차 밤 성공) with the crystal percentage',A.FX2.cur&&A.FX2.cur.k==='dawn'&&/3일차/.test(A.FX2.cur.tt)&&/75%/.test(A.FX2.cur.sub)&&A.fire()>=4);
  const B=makeGame(true);B.G.phase='night';B.fx2Tick(0.016);B.G.phase='day';B.fx2Tick(0.016);
  check('Joining mid-game does not celebrate a night the player did not see',!B.FX2.cur||B.FX2.cur.k!=='dawn');
}
// ⑤ 통신
check('FX2 block adds no network channel (no net.child / .set on the database)',!/net\.child|net\s*&&|\.ref\(/.test(block));
check('Rewards use only existing paths: dropGold (drop), chest list + netChests (chest), say (say) — host only',
  /if\(G\.host\) dropGold\(/.test(block)&&/if\(!G\.host \|\| G\.phase !== 'day'/.test(block)&&(block.match(/\bsay\(/g)||[]).length===1);
// ⑥ 소리
{ const A=makeGame(true);A.fx2SfxReady();const keys=Object.keys(A.SFX).filter(k=>k.startsWith('fx2'));
  const want=['fx2Lv','fx2Mis','fx2Badge','fx2Gun','fx2Big','fx2Dawn','fx2Rare','fx2BossIn','fx2Warn','fx2BossDown','fx2Whoosh','fx2Boom'];
  check('All FX2 sounds are added with one Object.assign(SFX) (the SFX table itself is untouched)',want.every(k=>keys.includes(k))&&/Object\.assign\(SFX, \{/.test(block));
  let maxV=0,ok=true;for(const k of want){A.log.snd.length=0;A.SFX[k]();if(!A.log.snd.length)ok=false;for(const [,v] of A.log.snd)maxV=Math.max(maxV,v||0);}
  check('Every FX2 sound plays through existing synth voices (pluck/tone/puff/noise/thump/crackSweep → sfxOut → bus compressor)',ok);
  check('No FX2 voice is louder than the existing loudest effects (≤ 0.2)',maxV<=0.2,maxV);
  A.log.snd.length=0;A.SFX.fx2Big();const roll=A.log.snd.filter(s=>s[0]==='puff').length;
  check('Big fanfare has a drum roll (15 snare hits) before the brass',roll>=15,roll);
}
// ⑦ 배선
{ const has=(f,re)=>re.test(fn(f));
  check('xpGain celebrates with fx2Cel (no separate toast/burst/up sound)',has('xpGain',/fx2Cel\(\{k:'lv'/)&&!has('xpGain',/toast\(|burst\(|__sfx\('up'\)/));
  check('Badge earn uses the banner (3단계 = big) instead of the center verdict',has('bgEarn',/fx2Cel\(\{k:'badge'[\s\S]*big:B\.t === 3/)&&!has('bgEarn',/verdict\(/));
  check('Friends\' tier-3 badge shows a small chip',has('badgeCheck',/fx2Chip\(/));
  check('Job change, mission, new gun (buy/craft) and race podium call the celebration',has('takeJob',/fx2Cel\(\{k:'job'/)&&has('misWatch',/fx2Cel\(\{k:'mis'/)&&
    has('buyWeapon',/fx2Cel\(\{k:'gun'/)&&has('craftWeapon',/fx2Cel\(\{k:'gun'/)&&has('raceDone',/fx2Cel\(\{k:'race'/));
  check('Job change keeps its floor effect block for the wing lane (FX2 adds no 3D there)',has('takeJob',/no3d:true/)&&has('takeJob',/jobUpFx\(|JOB_AURA/));   // 66차 WING 이 옛 JOB_AURA 공 기둥을 jobUpFx 마법진으로 바꿨다
  check('fx2Tick runs every frame from dreadTick',/function dreadTick\(dt\)\{[^}]*fx2Tick\(dt\)/.test(code));
  check('Old boss toasts and the hard 1.6 shake are gone (the staging does it once for host and guest)',
    !/window\.__shake\(1\.6/.test(fn('spawnWolf'))&&!/toast\(/.test(fn('onBossDown'))&&!/등장!', 4/.test(fn('applySim')));
  const {document}=domLib.parseHTML(source);const cel=document.getElementById('celebr');
  check('#celebr layer exists outside #hud with banner, caption, chip, bars, flash, lines, vignette and arrow',
    cel&&!cel.closest('#hud')&&['celBan','fx2Cap','celChip','fx2Bars','fx2Flash','fx2Lines','fx2Vig','fx2Arrow'].every(id=>cel.querySelector('#'+id)));
  const css=source.slice(source.indexOf('/* 66차 FX2'),source.indexOf('</style>',source.indexOf('/* 66차 FX2')));
  check('FX2 CSS lives in its own block; layer never takes clicks and sits above popups (45 > 40) but below the title screen (60)',
    /#celebr\{position:fixed;inset:0;pointer-events:none;z-index:45/.test(css));
  check('FX2 CSS animates only transform/opacity (no layout properties in keyframes)',
    (()=>{ const frames=[];let i=0;while((i=css.indexOf('@keyframes',i))>=0){ const o=css.indexOf('{',i);let d=0,j=o;
      for(;j<css.length;j++){ if(css[j]==='{')d++;else if(css[j]==='}'&&--d===0)break; } frames.push(css.slice(o,j+1));i=j; }
      return frames.length>=10&&frames.every(f=>!/\b(width|height|top|left|right|bottom|margin|padding)\s*:/.test(f)); })());
}

const failed=results.filter(v=>!v).length;
console.log(`\n${results.length-failed}/${results.length} FX2 celebration/rare-event/boss checks passed. Browser rendering is checked by screenshots.`);
process.exitCode=failed?1:0;
