/* 66차 HUD — 브라우저 없이 실제 게임 소스의 HUD 함수를 떼어 와 실행한다(계산식을 복사하지 않는다).
   ① 오늘 밤 미리 보기: 밤 구성표마다 그림·대비 두 줄 · 보스 밤/내일 보스/마지막 밤 · 손님이 밤 번호를 모르면 기다린다
   ② 아침 카드: 날짜 글씨가 걷힌 뒤 하루 한 번 열리고, 정해진 시간 뒤 칩으로 접히고, 밤이 되면 둘 다 사라진다
   ③ 화면 모드: body 에 낮/밤/미니게임 중 하나 + 보스 표시만 붙는다
   ④ 알림 중복: toast 직후 같은 그림으로 시작하는 내 feed 줄·이미 떠 있는 같은 줄은 건너뛴다
   ⑤ 통신: meta 로 보내는 값은 그대로, 66차 HUD 코드에는 통신 호출이 없다
   ⑥ 자리 규칙: 미니게임 판이 화면 위 가운데에 자리를 갖는다 · 밤에 숨기는 판 · 같은 알림을 여러 곳에 띄우던 줄이 사라졌다
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
const {document}=domLib.parseHTML(source);
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

const fixture=`
const G={day:1,phase:'day',started:true,host:true,nk:-1,set:{goalDay:18},me:{g:0,name:'검사'}};
let stageT=0,popIsOpen=false,NOW=1000;
const performance={now:()=>NOW};
const el=id=>document.getElementById(id);
const popOpen=()=>popIsOpen;
`;
const parts=[fixture,
  declaration('PROG_REF'),declaration('PROG_OVER'),declaration('progRef'),fn('prog'),fn('bossDays'),fn('bossIndex'),
  declaration('BOSS_K4'),fn('bossWolfK'),declaration('WOLF_T'),declaration('NIGHT_DEF'),declaration('NIGHT_FIXED'),
  fn('nightPool'),fn('pickNight'),fn('josa'),
  declaration('NIGHT_PREVIEW'),declaration('NIGHT_PREVIEW_BOSS'),declaration('NC_SHOW_MS'),
  'let ncDay = 0, ncUntil = 0, ncKey = \'\', hudMode = \'\';',
  fn('nightPreviewInfo'),fn('paintNightCard'),fn('nightCardOpen'),fn('paintNightPreview'),fn('paintHudMode'),
  'let toastT = 0;',declaration('toastAt').replace(/;$/,'')+';',declaration('HUD_TAG_RE'),fn('hudLead'),fn('toast'),fn('feed'),
  `globalThis.__T={G,NIGHT_DEF,NIGHT_PREVIEW,NC_SHOW_MS,bossDays,pickNight,nightPreviewInfo,paintNightPreview,paintHudMode,
    nightCardOpen,toast,feed,hudLead,set:(k,v)=>{ if(k==='stageT')stageT=v; else if(k==='pop')popIsOpen=v; else if(k==='now')NOW=v; },
    st:()=>({ncDay,ncUntil,hudMode})};`];
/* linkedom 에 없는 것만 채운다 — offsetWidth(되감기용)·setTimeout(feed 가 8초 뒤 지운다) */
const ctx={document,console,setTimeout:()=>0,Math,String,Object,Array,Number,JSON,RegExp};
Object.defineProperty(document.defaultView.HTMLElement.prototype,'offsetWidth',{get(){return 1;},configurable:true});
vm.createContext(ctx);
vm.runInContext(parts.join('\n'),ctx,{filename:'t66-hud-extract.js'});
const T=ctx.__T;

let pass=0,fail=0;
function check(name,ok,detail=''){
  if(ok){pass++;console.log('PASS '+name);}else{fail++;console.log('FAIL '+name+(detail?' — '+detail:''));}
}
const $=id=>document.getElementById(id);
const len=s=>[...s].length;

/* ① 구성표 */
check('Every night theme has a preview picture and two short prep lines',
  T.NIGHT_PREVIEW.length===T.NIGHT_DEF.length && T.NIGHT_PREVIEW.every(p=>p.ic&&p.prep.length===2&&p.prep.every(x=>len(x)>=6&&len(x)<=24)),
  JSON.stringify(T.NIGHT_PREVIEW.map(p=>p.prep.map(len))));
const G=T.G, bd=T.bossDays();
const seen=[];
for(let d=1;d<=G.set.goalDay;d++){
  G.day=d; G.nk = bd.includes(d) ? -1 : T.pickNight(d, G.nk);
  const I=T.nightPreviewInfo();
  seen.push([d,I&&I.boss,I&&I.name,I&&I.tmrBoss,I&&I.last]);
}
check('Boss days show a boss preview with the name only once (picture separate)',
  seen.filter(r=>r[1]).length===bd.length && seen.filter(r=>r[1]).every(r=>!/^\P{L}/u.test(r[2])), JSON.stringify(seen.filter(r=>r[1])));
check('The day before each boss says tomorrow is a boss night',
  seen.every(r=>r[3]===(!bd.includes(r[0]) && bd.includes(r[0]+1))), JSON.stringify(seen.map(r=>r[3]?r[0]:0).filter(Boolean)));
check('Only the goal day is marked as the last night', seen.filter(r=>r[4]).map(r=>r[0]).join()===String(G.set.goalDay));
check('Days 1-4 preview the fixed nights (same answer on every screen)',
  seen.slice(0,4).map(r=>r[2]).join('|')===[0,1,2,3].map(i=>T.NIGHT_DEF[i].n).join('|'), seen.slice(0,4).map(r=>r[2]).join('|'));
G.day=7; G.nk=-1;
check('A guest who has not received the night number yet shows nothing (no guessing)', T.nightPreviewInfo()===null);

/* ② 아침 카드 → 칩 → 밤 */
G.day=6; G.nk=3; G.phase='day'; T.set('stageT',2); T.set('now',1000);
T.paintNightPreview();
check('While the day title is showing the card waits but the chip is ready',
  !$('nightCard').classList.contains('on') && !$('nightChip').hidden && /굶주린 밤/.test($('nightChip').textContent));
T.set('stageT',0); T.paintNightPreview();
check('After the day title the card opens once with the night name, hint and prep lines',
  $('nightCard').classList.contains('on') && /굶주린 밤/.test($('nightCard').textContent)
  && $('nightCard').querySelectorAll('.ncPrep li').length===2 && $('nightCard').textContent.includes(T.NIGHT_DEF[3].hint)
  && $('nightChip').classList.contains('cardOn'));
T.set('now',1000+T.NC_SHOW_MS+10); T.paintNightPreview();
check('The card folds into the chip after its time', !$('nightCard').classList.contains('on') && !$('nightChip').classList.contains('cardOn'));
T.set('now',1000+T.NC_SHOW_MS*3); T.paintNightPreview();
check('It does not open again the same day', !$('nightCard').classList.contains('on') && T.st().ncDay===6);
$('nightChip').onclick=null; T.nightCardOpen(true);
check('The chip can reopen the card', $('nightCard').classList.contains('on'));
G.phase='night'; T.paintNightPreview();
check('At night both the card and the chip are gone', !$('nightCard').classList.contains('on') && $('nightChip').hidden);
G.phase='day'; G.day=7; G.nk=-1; T.set('now',99999); T.paintNightPreview();
check('Next morning without a night number yet: no card until it arrives', !$('nightCard').classList.contains('on') && $('nightChip').hidden);
G.nk=5; T.paintNightPreview();
check('When meta.nk arrives the card opens with that night', $('nightCard').classList.contains('on') && $('nightCard').textContent.includes(T.NIGHT_DEF[5].n));
T.nightCardOpen(false); G.day=bd[0]; G.nk=-1; T.paintNightPreview();
check('Boss morning shows the boss card', $('nightCard').classList.contains('on') && $('nightCard').classList.contains('boss') && $('nightChip').classList.contains('boss'));
T.nightCardOpen(false); G.day=bd[0]+1; G.nk=0; T.set('pop',true); T.paintNightPreview();
check('The card waits while a window (shop etc.) is open', !$('nightCard').classList.contains('on'));
T.set('pop',false); T.paintNightPreview();
check('...and opens when the window closes', $('nightCard').classList.contains('on'));

/* ③ 화면 모드 */
const cls=()=>['hud66-day','hud66-night','hud66-mini','hud66-boss'].filter(c=>document.body.classList.contains(c)).join(',');
const modes=[];
for(const [ph,boss] of [['day',false],['night',false],['night',true],['mini',false],['day',false]]){ G.phase=ph; T.paintHudMode(boss); modes.push(cls()); }
check('Body carries exactly one screen mode (+boss)', modes.join('|')==='hud66-day|hud66-night|hud66-night,hud66-boss|hud66-mini|hud66-day', modes.join('|'));

/* ④ 알림 중복 */
const feedN=()=>$('feed').children.length;
$('feed').innerHTML='';
T.set('now',50000); T.toast('⭐ 레벨 8! — C 키를 눌러 스텟을 찍으세요',3.2,'#ffe066');
T.feed('⭐ <b style="color:#123">검사</b> <b>레벨 8</b> — 스텟 1점을 받았어요 (C)');
check('A feed line right after a toast with the same picture is skipped on my screen', feedN()===0);
T.feed('🪵 <b>검사</b>가 나무를 캤어요');
check('A different message still goes into the feed', feedN()===1);
T.feed('🪵 <b>검사</b>가 나무를 캤어요');
check('The same line twice shows once', feedN()===1);
T.set('now',51000); T.feed('⭐ <b>친구</b>가 레벨 9가 됐어요');
check('Later messages with the same picture are kept (only the same moment is merged)', feedN()===2);
check('hudLead reads the first picture past tags', T.hudLead('<b>👑 우두머리</b>')==='👑' && T.hudLead('레벨')==='');

/* ⑤ 통신 */
const i0=code.indexOf('/* ═══════ 66차 HUD — 화면 모드 · 오늘 밤 미리 보기'), i1=code.indexOf('function paintKit(');
const hudBlock=code.slice(i0,i1).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');   // 주석은 빼고 본다
check('The 66 HUD block sends nothing over the network', i0>0 && i1>i0 && !/\bnet\b|netMeta|netPC|say\(/.test(hudBlock));
check('meta still carries the same fields (nk was already there since 36)',
  /net\.child\('meta'\)\.set\(\{ph:G\.phase, day:G\.day, t:Math\.round\(G\.t\*10\)\/10, focus:G\.focus, nk:G\.nk,\s*crystal:Math\.round\(G\.crystal\*10\)\/10, host:uid, set:G\.set, ts:Date\.now\(\),\s*pz:G\.paused\?1:0, mis:G\.mis\|0, misD:G\.misD\|0\}\)/.test(code));
check('The host still picks the night in the morning before sending meta',
  /G\.nk = bossIndex\(G\.day\) >= 0 \? -1 : pickNight\(G\.day, G\.nkPrev\);[\s\S]{0,400}netMeta\(\);/.test(code));

/* ⑥ 자리 규칙·중복 줄 */
const css=source.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
check('The minigame board has a place at the top centre', /#miniBar\{position:absolute;left:50%;top:12px/.test(css) && /#miniBar\.on\{display:block\}/.test(css));
check('At night the XP row, farm row and level ranking are hidden', /body\.hud66-night #resFarm,body\.hud66-night #lvRow,body\.hud66-night #rankWrap\{display:none!important\}/.test(css));
check('At night the boss bar comes right under the crystal', /body\.hud66-night #bossWrap\{order:1\}/.test(css));
check("Morning 'tonight is ...' feed line is gone (the card says it on every screen)", !/오늘 밤은 '\$\{N\.n\}'/.test(code));
check('The boss-day toast + feed pair in showStage is gone', !/toast\('⚠️ 오늘 밤은 보스입니다!'/.test(code) && !/내일 밤은 보스입니다\./.test(code));
check('New HUD nodes exist and keep old test selectors', ['nightChip','nightCard','feed','toast','resBox','crystalWrap','dayBox','misWrap','bossWrap','miniBar','topLeft','topMid','topRight'].every(id=>$(id)));

console.log(fail?`${fail} failed / ${pass+fail}`:`${pass}/${pass} HUD checks passed. Browser layout is checked with screenshots.`);
process.exitCode=fail?1:0;
