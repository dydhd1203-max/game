/* 66차 CTRL — 브라우저 없이 실제 게임 소스의 함수를 떼어 와 실행한다(계산식을 복사하지 않는다).
   ① 총 조작: 우클릭 한 번 = 총 들기/넣기(잠금 있든 없든, 자동 잠금 없음) · Q·R·E·F·V·1~6 은 총을 넣고 그 도구를 바로 잡는다(알림 한 줄)
      · 6~9 물약은 총을 안 넣는다 · 쓰러짐·창·관전 중엔 그대로 · T 는 말없이 같은 동작 · 안내 글에 'T 총' 없음
   ② 도구 줄 맨 앞 총 칸: 무기 그림·짧은 이름·'우클릭' · 총을 들면 이 칸만 켜짐 · 누르면 들기/넣기
   ③ 오늘 밤 안내: 팁(대비법) 없음 — NIGHT_DEF.hint·"이렇게 대비해요"·보스 대비법 자막·내일 보스 조언 모두 없음, 분위기 한 줄만
   ④ 밤마다 다른 모습: 열 밤 + 보스 다섯의 열쇠(data-nt)가 모두 다르고, 열쇠마다 색·꾸밈 CSS 가 있다 · 밤 시작 소리 세기 0.17 이하
   ⑤ 5초 뒤 사라짐: 아침 카드 5초(4.6초부터 0.4초 흐려짐) · 밤 시작 경고도 5초 뒤 완전히 닫힘 · 보스 밤·방금 들어온 밤은 경고 없음
   ⑥ 통신: 새 코드에 통신 호출 없음
   linkedom 이 필요하다(t66-hud-static 과 같은 방식). */
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
const css=source.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
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
const noComments=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`])\/\/[^\n]*/g,'$1');

/* 게임 조각을 한 상자에서 돌린다 — 바깥 세계(3D·소리·통신)는 기록만 하는 가짜로 */
const fixture=`
const G={day:6,phase:'day',started:true,host:true,nk:3,set:{goalDay:18},me:{g:0,name:'검사'}};
const PL={down:false}; const SPEC={on:false};
let popIsOpen=false,NOW=1000,stageT=0;
const performance={now:()=>NOW};
const el=id=>document.getElementById(id);
const popOpen=()=>popIsOpen;
const LOG={aim:[],toast:[],tool:[],build:[],sfx:[],gain:[]};
let aimMode=false;
function setAimMode(on,quiet){ on=!!on; LOG.aim.push([on,!!quiet]); if(aimMode===on) return; aimMode=on; paintBar(); }
function selectTool(t){ curTool=t; curBuild=null; LOG.tool.push(t); paintBar(); }
function selectBuild(b){ if(!BUILD[b]) return; curBuild=b; curTool='build'; LOG.build.push(b); paintBar(); }
function toast(m){ LOG.toast.push(m); }
const TOOLS=[{id:'mine',name:'캐기',icon:'⛏️',key:'Q'},{id:'repair',name:'수리',icon:'🔧',key:'R'},{id:'up',name:'강화',icon:'⬆️',key:'E'},{id:'del',name:'철거',icon:'💥',key:'F'},{id:'move',name:'옮기기',icon:'↔️',key:'V'}];
const BUILD={wwall:{name:'나무벽',icon:'🪵',cost:{w:5,s:0,g:0}},swall:{name:'돌벽',icon:'🧱',cost:{w:1,s:7,g:0}}};
const BKEYS=Object.keys(BUILD);
const WEAPONS=[{n:'맨손 돌',ic:'🪨'},{n:'나무 새총',ic:'🪃'},{n:'돌 화승총',ic:'🔫'}];
const KIT={wpn:2};
const wpnNow=()=>WEAPONS[KIT.wpn];
const iconImg=(k,e)=>e;
const myRes=()=>({w:99,s:99,g:99});
let curTool='mine',curBuild=null;
/* 소리: 합성 함수는 세기(vol)만 기록한다 */
const SFX={}; const now0=()=>0;
const sfx=k=>{ LOG.sfx.push(k); if(SFX[k]) SFX[k](); };
const pluck=(f,dur,vol)=>LOG.gain.push(vol), puff=(dur,vol)=>LOG.gain.push(vol), tone=(f1,f2,dur,type,vol)=>LOG.gain.push(vol),
      noise=(dur,vol)=>LOG.gain.push(vol), crackSweep=(dur,vol)=>LOG.gain.push(vol), thump=(f1,f2,dur,vol)=>LOG.gain.push(vol);
const FX2={rareT:0,nightDay:0};
`;
const parts=[fixture,
  declaration('PROG_REF'),declaration('PROG_OVER'),declaration('progRef'),fn('prog'),fn('bossDays'),fn('bossIndex'),
  declaration('BOSS_K4'),fn('bossWolfK'),declaration('WOLF_T'),declaration('NIGHT_DEF'),
  declaration('NIGHT_LOOK'),declaration('NIGHT_LOOK_BOSS'),fn('nightLookBoss'),fn('nightArt'),fn('nightFx'),
  declaration('NIGHT_NOTE_LAST'),declaration('NIGHT_NOTE_TMR_BOSS'),declaration('NC_SHOW_MS'),
  'let ncDay = 0, ncUntil = 0, ncKey = \'\', hudMode = \'\';',
  fn('nightPreviewInfo'),fn('paintNightCard'),fn('nightCardOpen'),fn('paintNightPreview'),
  declaration('N66_MS'),'let n66Ph = \'\', n66Day = 0, n66Until = 0, n66Nt = \'\';',
  fn('night66Show'),fn('night66Hide'),fn('night66Tick'),fn('night66BossLook'),fn('night66Snd'),
  fn('gunToggleOk'),fn('toggleGun'),fn('gunAway'),fn('pickTool'),fn('pickBuild'),fn('gunShortName'),fn('afford'),
  'let barKey = \'\';',fn('paintBar'),
  `globalThis.__T={G,PL,SPEC,LOG,KIT,NIGHT_DEF,NIGHT_LOOK,NIGHT_LOOK_BOSS,NIGHT_NOTE_TMR_BOSS,NC_SHOW_MS,N66_MS,SFX,
    nightPreviewInfo,paintNightPreview,nightCardOpen,night66Tick,night66Show,night66Snd,toggleGun,pickTool,pickBuild,paintBar,gunShortName,WEAPONS,
    aim:()=>aimMode, setAim:v=>{aimMode=v;}, tool:()=>[curTool,curBuild],
    set:(k,v)=>{ if(k==='pop')popIsOpen=v; else if(k==='now')NOW=v; },
    st:()=>({n66Until,n66Ph,n66Nt,ncUntil})};`];
const ctx={document,console,setTimeout:()=>0,Math,String,Object,Array,Number,JSON,RegExp};
Object.defineProperty(document.defaultView.HTMLElement.prototype,'offsetWidth',{get(){return 1;},configurable:true});
if(!document.body.dataset)Object.defineProperty(document.defaultView.HTMLElement.prototype,'dataset',{get(){return {};},configurable:true});
vm.createContext(ctx);
vm.runInContext(parts.join('\n'),ctx,{filename:'t66-ctrl-extract.js'});
const T=ctx.__T;

let pass=0,fail=0;
function check(name,ok,detail=''){
  if(ok){pass++;console.log('PASS '+name);}else{fail++;console.log('FAIL '+name+(detail?' — '+detail:''));}
}
const $=id=>document.getElementById(id);
const reset=()=>{ for(const k of Object.keys(T.LOG)) T.LOG[k].length=0; };

/* ① 총 조작 */
reset(); T.setAim(false); T.toggleGun();
check('toggleGun raises the gun once (right click)', T.aim()===true && T.LOG.aim.length===1);
T.toggleGun();
check('...and the next one puts it away', T.aim()===false);
T.setAim(true); reset(); T.pickTool('mine');
check('Q while aiming: gun goes away quietly and the mine tool is picked',
  T.aim()===false && T.LOG.aim[0].join()==='false,true' && T.tool()[0]==='mine');
check('...with exactly one short tool toast (no second “gun away” line)', T.LOG.toast.length===1 && T.LOG.toast[0]==='⛏️ 캐기', JSON.stringify(T.LOG.toast));
T.setAim(true); reset(); T.pickBuild('wwall');
check('1 while aiming: gun goes away and the first building is picked', T.aim()===false && T.tool().join()==='build,wwall' && T.LOG.toast.join()==='🪵 나무벽');
T.setAim(false); reset(); T.pickTool('repair');
check('Without a gun the tool changes silently as before', T.tool()[0]==='repair' && T.LOG.toast.length===0);
for(const [what,set,unset] of [['down',()=>T.PL.down=true,()=>T.PL.down=false],['window',()=>T.set('pop',true),()=>T.set('pop',false)],
  ['spectate',()=>T.SPEC.on=true,()=>T.SPEC.on=false]]){
  T.setAim(true); set(); T.toggleGun(); T.pickTool('mine');
  check(`While ${what}: right click / tool keys do not change the gun`, T.aim()===true);
  unset();
}
T.G.started=false; T.setAim(false); T.toggleGun(); check('Before the game starts right click does nothing', T.aim()===false); T.G.started=true;
const mdn=noComments(code.slice(code.indexOf("addEventListener('mousedown'"),code.indexOf("addEventListener('mouseup'")));
check('mousedown: button 2 toggles the gun with or without pointer lock, never asks for a lock',
  /document\.pointerLockElement===cv\)\{[\s\S]*e\.button===2\)\{ e\.preventDefault\(\); toggleGun\(\); \}/.test(mdn)
  && /else if\(e\.button===2 && e\.target===cv\) toggleGun\(\)/.test(mdn) && !/requestPointerLock/.test(mdn), mdn.slice(0,300));
const kd=noComments(code.slice(code.indexOf("if(k===' '){ if(!e.repeat) wantJump = true;"),code.indexOf("if(k==='i'){")));
check('Q·R·E·F·V go through pickTool, 1~6 through pickBuild', ['mine','repair','up','del','move'].every(t=>kd.includes(`pickTool('${t}')`))
  && /pickBuild\(BKEYS\[\+k-1\]\)/.test(kd) && !/selectTool\(/.test(kd));
check('6~9 while aiming only drink a potion (the gun stays)', /!\(aimMode && k>='6'\)\) pickBuild/.test(kd) && /if\(k>='6' && k<='9'\)\{ usePotion\(\+k-6\); \}/.test(kd));
check('T still toggles (silently, same path as right click)', /if\(k==='t'\) toggleGun\(\);/.test(kd));
/* 안내 글에서 'T 로 총' 류가 사라졌다 — 주석은 빼고, 글(문자열·HTML)만 본다 */
const html=source.replace(/<script type="module">[\s\S]*?<\/script>/,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'');   // 글만 — HTML·CSS 주석은 뺀다
const jsText=noComments(code);
const tRe=/T 총|T 로 총|T로 총|T 로 풀|<b>T<\/b>|T 를 누르면 총|T 키로 총/;
check('No guide text explains T as the gun key (help, start screen, goal line)', !tRe.test(html) && !tRe.test(jsText),
  (html.match(tRe)||jsText.match(tRe)||[''])[0]);
check('The guide now says right click for the gun', /우클릭 총/.test(jsText) && /오른쪽 클릭/.test(html) && /우클릭 총 들기\/넣기/.test(html));

/* ② 총 칸 */
T.setAim(false); T.paintBar();
const tools=$('tools'), first=tools.firstElementChild;
check('The hotbar starts with a gun slot (icon, short name, “우클릭” key label)',
  first && first.className.includes('gun') && first.querySelector('.ky').textContent==='우클릭' && first.querySelector('.nm').textContent==='화승총'
  && first.querySelector('.ic').textContent==='🔫' && tools.children.length===1+5, first?.outerHTML?.slice(0,200));
check('Short names: last word, whole name for bare-hand stone', T.gunShortName(T.WEAPONS[2])==='화승총' && T.gunShortName(T.WEAPONS[0])==='돌');
check('Gun away: the gun slot is off and the picked tool is on', !first.className.includes(' on') && tools.querySelectorAll('.on').length===1);
T.setAim(true); T.paintBar();
const onAll=[...document.querySelectorAll('#tools .on,#bar .on')].map(e=>e.className);
check('Gun up: only the gun slot is lit', onAll.length===1 && onAll[0].includes('gun'), onAll.join('|'));
T.setAim(false); T.paintBar(); reset(); $('tools').firstElementChild.onclick();
check('Clicking the gun slot raises the gun', T.aim()===true);
reset(); [...$('tools').children][1].onclick();
check('Clicking a tool slot while aiming puts the gun away and picks it', T.aim()===false && T.tool()[0]==='mine' && T.LOG.toast.join()==='⛏️ 캐기');
T.KIT.wpn=1; T.paintBar();
check('Changing weapon repaints the gun slot', $('tools').firstElementChild.querySelector('.nm').textContent==='새총'); T.KIT.wpn=2;

/* ③ 팁 없음 */
const TIP=/세요|쌓|탑|벽을|병사|수리|막아|막고|모아|모으|대비|쏘세요|쏴요|먼저 잡|부터 잡|제격/;
const looks=[...T.NIGHT_LOOK,...T.NIGHT_LOOK_BOSS];
check('NIGHT_DEF no longer carries a how-to hint', T.NIGHT_DEF.every(d=>!('hint' in d)));
check('Every night / boss look has a mood line and a start warning with no advice',
  looks.every(L=>L.mood&&L.warn&&!TIP.test(L.mood)&&!TIP.test(L.warn)&&!L.prep), looks.filter(L=>TIP.test(L.mood+L.warn)).map(L=>L.k).join());
check('Old tip tables and the “이렇게 대비해요” list are gone',
  !/NIGHT_PREVIEW|이렇게 대비해요|ncPrep|ncHow/.test(jsText) && !/ncPrep|ncHow|이렇게 대비해요/.test(html));
check("Tomorrow's boss line is a warning only", /무언가 커다란 것이 와요/.test(T.NIGHT_NOTE_TMR_BOSS) && !TIP.test(T.NIGHT_NOTE_TMR_BOSS) && !/탑을 미리 늘려/.test(jsText));
check('Boss captions give no advice (intro / appear / half / 10%)',
  !/다섯 입구를 막고 탑을 채워요|모두 모여서 쏘세요|여럿이 같이 쏘세요|끝까지 쏘세요/.test(jsText));
check('Night-start toasts with advice are gone (host and guest)', !/다섯 입구 전부 조심|어느 입구로 올지 몰라요'/.test(jsText));
/* 카드를 실제로 그려 본다 — 열 밤 + 보스 다섯 */
const cardTexts=[];
for(let k=0;k<T.NIGHT_DEF.length;k++){
  T.G.phase='day'; T.G.day=6; T.G.nk=k; T.nightCardOpen(false); T.paintNightPreview(); T.nightCardOpen(true);
  const c=$('nightCard'); cardTexts.push([c.getAttribute('data-nt'),c.textContent,$('nightChip').getAttribute('data-nt')]);
}
const bd=[];{ let d=1; for(;d<=18;d++){ T.G.day=d; if(T.nightPreviewInfo()?.boss) bd.push(d); } }
for(const d of bd){ T.G.day=d; T.G.nk=-1; T.nightCardOpen(false); T.paintNightPreview(); T.nightCardOpen(true);
  const c=$('nightCard'); cardTexts.push([c.getAttribute('data-nt'),c.textContent,$('nightChip').getAttribute('data-nt')]); }
check('Morning cards (10 nights + bosses) show the name and mood only — no tips',
  cardTexts.length===T.NIGHT_DEF.length+bd.length && cardTexts.every(([k,t])=>k&&!TIP.test(t.replace('알았어요',''))),
  cardTexts.filter(([k,t])=>TIP.test(t.replace('알았어요',''))).map(r=>r[0]).join());

/* ④ 밤마다 다른 모습 */
const keys=cardTexts.map(r=>r[0]);
check('Each night and each boss gets its own design key (card and chip)', new Set(keys).size===keys.length && cardTexts.every(r=>r[0]===r[2]) && bd.length>=4, keys.join());
check('Boss looks follow WOLF_T boss numbers (not id ranges)', /WOLF_T\[k\], i = B && B\.boss \? B\.boss - 1/.test(code));
const cssKeys=looks.map(L=>L.k);
const colorOf=k=>(css.match(new RegExp('\\[data-nt='+k+'\\],body\\[data-n66='+k+'\\]\\{([^}]*)\\}'))||[])[1]||'';
check('Every design key has its own colour set (background, border, text)',
  cssKeys.every(k=>/--n6bg:#[0-9a-f]{6}/.test(colorOf(k))&&/--n6bd:/.test(colorOf(k))&&/--n6ink:/.test(colorOf(k)))
  && new Set(cssKeys.map(k=>colorOf(k).match(/--n6bg:(#[0-9a-f]{6})/)?.[1])).size===cssKeys.length, cssKeys.filter(k=>!colorOf(k)).join());
check('Every design key has its own decoration / motion rules',
  cssKeys.every(k=>new RegExp('\\[data-nt='+k+'\\]\\s*(\\.n6f|\\.n6a|:is)').test(css)), cssKeys.filter(k=>!new RegExp('\\[data-nt='+k+'\\]\\s*(\\.n6f|\\.n6a|:is)').test(css)).join());
check('Hungry night: teeth border, drool drops, sagging letters', /\[data-nt=hungry\] \.n6f::before/.test(css) && /n6drip/.test(css) && /n6sag/.test(css));
check('Animations are transform / opacity only (no layout, no big blurred planes)',
  [...css.matchAll(/@keyframes (n6\w+)\{([\s\S]*?)\}\s*(?=@|\/\*|\[|#|\.|$)/g)].every(m=>!/(width|height|left|top|filter|margin|padding)\s*:/.test(m[2])));
check('Reduced motion switches the night animations off', /prefers-reduced-motion:reduce\)\{ \.n6a \*/.test(css));
/* 밤 시작 소리 — 모든 밤 소리가 있고, 세기는 0.17 이하 */
reset();
for(const L of T.NIGHT_LOOK) T.night66Snd(L.snd);
check('Every night has its own start sound, each at most 0.17', T.NIGHT_LOOK.every(L=>typeof T.SFX[L.snd]==='function') && new Set(T.NIGHT_LOOK.map(L=>L.snd)).size===T.NIGHT_LOOK.length
  && T.LOG.gain.length>20 && Math.max(...T.LOG.gain)<=0.17, Math.max(...T.LOG.gain));
check('Night sounds are added in one Object.assign(SFX) block (the SFX table is untouched)', /Object\.assign\(SFX, \{\s*night66Calm/.test(code));

/* ⑤ 5초 뒤 사라짐 */
check('Morning card shows 5 s (was 9 s) and fades for 0.4 s from 4.6 s',
  T.NC_SHOW_MS===5000 && /#nightCard\.on\{display:block;animation:nc66in [^}]*nc66out \.4s ease-in 4\.6s 1 forwards\}/.test(css) && /@keyframes nc66out\{to\{opacity:0/.test(css));
check('Night-start warning shows 5 s and fades for 0.4 s from 4.6 s',
  T.N66_MS===5000 && /#n66Ban\.on\{display:flex;animation:n6banIn [^}]*n6banOut \.4s ease-in 4\.6s forwards\}/.test(css) && /@keyframes n6banOut\{to\{[^}]*opacity:0/.test(css));
T.set('now',1000); T.G.day=6; T.G.nk=3; T.G.phase='day'; T.nightCardOpen(false); T.paintNightPreview(); T.nightCardOpen(true);
T.set('now',1000+4900); T.paintNightPreview(); const cardAt49=$('nightCard').classList.contains('on');
T.set('now',1000+5010); T.paintNightPreview();
check('Card: still up at 4.9 s, folded into the chip after 5 s', cardAt49 && !$('nightCard').classList.contains('on') && !$('nightChip').hidden);
check('The chip keeps the night design (colour key)', $('nightChip').getAttribute('data-nt')==='hungry');
/* 경고: 낮 → 밤 */
T.set('now',20000); T.G.phase='day'; T.night66Tick(); T.G.phase='night'; T.night66Tick();
const ban=$('n66Ban');
check('Day → night: the themed warning appears once, by itself', ban.className==='on' && ban.getAttribute('data-nt')==='hungry' && /굶주린 밤/.test(ban.textContent));
check('The warning has no advice either', !TIP.test(ban.textContent), ban.textContent);
T.set('now',20000+4900); T.night66Tick(); const banAt49=ban.className==='on';
T.set('now',20000+5010); T.night66Tick();
check('Warning: up at 4.9 s, fully gone after 5 s (the night name stays by the date)', banAt49 && ban.className==='' && T.st().n66Nt==='hungry');
T.set('now',40000); T.G.phase='day'; T.night66Tick(); T.G.day=bd[0]; T.G.nk=-1; T.G.phase='night'; T.night66Tick();
check('Boss night: no second banner (the FX2 boss caption wears the boss look)', ban.className==='' && /b66/.test(code.slice(code.indexOf('function fx2BossIntro('),code.indexOf('function fx2BossAppear('))));
T.G.phase='day'; T.night66Tick(); T.G.day=7; T.G.nk=1; T.G.phase='night';
/* 방금 들어온 손님: 첫 상태가 밤이면 '시작' 경고는 없다 */
const t2=vm.runInContext(`(()=>{ n66Ph=''; n66Day=0; night66Tick(); return document.getElementById('n66Ban').className; })()`,ctx);
check('Joining in the middle of a night shows no start warning', t2==='');

/* ⑥ 통신 */
const i0=code.indexOf('/* ═══ 66차 CTRL — 총 조작 ═══'), i1=code.indexOf('function afford(');
const j0=code.indexOf('/* ═══════ 66차 CTRL — 밤마다 그 밤다운 모습'), j1=code.indexOf('/* 화면 모드 —');
const ctrlCode=noComments(code.slice(i0,i1)+code.slice(j0,j1)+fn('night66Show')+fn('night66Tick')+fn('night66Snd'));
check('The new CTRL code sends nothing over the network', i0>0&&i1>i0&&j0>0&&j1>j0 && !/\bnet\b|netMeta|netPC|say\(/.test(ctrlCode));

console.log(fail?`${fail} failed / ${pass+fail}`:`${pass}/${pass} CTRL checks passed (gun controls, hotbar gun slot, no night tips, per-night designs, 5 s auto-hide).`);
process.exitCode=fail?1:0;
