/* 65차 — 새 총 여섯 + 레벨 제한. 브라우저 없이 실제 게임 소스의 WEAPONS·구매·조합·장착·상점/대장간 카드·
   경주 상·불붙이기 함수를 떼어 와 실행한다. 계산식을 복사하지 않고 게임 함수를 그대로 부른다.
   ① 0~13 번 이름이 그대로(저장·통신 ID) ② 14~19 등급 수 일반3·레어2·유니크1 ③ 레벨이 모자라면 구매·조합 거절, 넉넉하면 허락
   ④ 이미 가진 총은 레벨과 상관없이 장착 ⑤ 새 총 초당 피해가 설계 표(plan65/weapons65-balance.md) 범위 안.
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
const {document,window}=domLib.parseHTML(source);
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
function chunk(from,to){const start=code.indexOf(from),end=code.indexOf(to,start);
  if(start<0||end<0)throw new Error('Missing chunk '+from);return code.slice(start,end);}

const fixture=`
const G={day:1,phase:'day',me:{g:0,name:'검사'},wolves:[],host:true};
const GCOL=['#123'],hudPrev={},KIT={ownW:[],ownA:[],pot:[],enh:[],wpn:0,arm:0,ammo:0};
const XP={lv:1};
let netPCDirty=false;
const resources={w:0,s:0,g:0,eg:0,mk:0,pk:0},events=[];
const el=id=>document.getElementById(id),myRes=()=>resources,myFarm=()=>({hen:0,pig:0,cow:0});
const spend=c=>{for(const [k,v] of Object.entries(c)){resources[k]-=v;}events.push(['spend',{...c}]);};
const gain=(k,n)=>{resources[k]+=n;};
const gainAll=c=>{for(const [k,v] of Object.entries(c))resources[k]+=v;events.push(['gainAll',{...c}]);};
const iconImg=(id,fallback)=>'<img class="ic" data-ic="'+id+'" alt="'+fallback+'">';
const esc=s=>String(s),josa=(s,a)=>a,toast=(...a)=>events.push(['toast',...a]);
const feed=()=>{},noteRecipes=()=>{},popOpen=()=>false,buildKitUI=()=>{},forward=()=>({x:0,z:-1});
const PL={x:0,y:0,z:0,hp:50};const GY=0;
const burstLog=[];const burst=(...a)=>burstLog.push(a);
const hits=[];const extraHit=(o,d)=>{hits.push([o.id,d]);o.hp-=d;};
const window={};let enhBusy=false;
// 66차 — 새 총을 얻으면 축하 배너(fx2Cel)가 뜬다. 여기선 부른 기록만 남긴다
const fx2Cel=o=>events.push(['cel',o]),isTouch=false;
`;
const decls=['WEAPONS','MINI_GUN','TRAIT_TXT','TIER_TXT','TIER_COL','wpnLv','wpnLvOk','TIER_ALL','TIER_NAME',
  'ARMORS','POT_SEC','POTIONS','AMMO_PER_GOLD','FARM_ANIMALS','FARM_CAP','farmCount','WDAY',
  'ENH_MAX','ENH_ODDS','ENH_SAFE','ENH_DROP','ENH_MUL','ENH_COST','enhOf','enhMul','enhTxt',
  'BURN_N','burns'];
const funcs=['canPay','costTxt','lackTxt','equipWeapon','equipArmor','buyWeapon','buyArmor','buyAmmo','buyPotion','sellFarm',
  'enhCost','craftable','craftWeapon','raceGiveWeapon','burnStart','burnTick'];
const forgeUI=chunk('let forgeTab = ','/* 강화 한 번');
const payload=[fixture,...decls.map(declaration),...funcs.map(fn),
  chunk("let shopTab = 'w';",'/* 농장 산물을 금으로'),
  forgeUI.replace(/let forgeTab = [^;]*;/,"let forgeTab = 'craft';"),
  `globalThis.API={KIT,XP,G,resources,events,hits,WEAPONS,TIER_NAME,wpnLv,wpnLvOk,buildShopUI,buildForgeUI,
    buyWeapon,craftable,craftWeapon,equipWeapon,raceGiveWeapon,burnStart,burnTick,burns,
    setTab:t=>{shopTab=t;buildShopUI();},setForge:t=>{forgeTab=t;buildForgeUI();},
    reset:(lv,rich)=>{XP.lv=lv;const v=rich?100000:0;Object.assign(resources,{w:v,s:v,g:v,eg:v,mk:v,pk:v});
      Object.assign(KIT,{ownW:WEAPONS.map((_,i)=>i===0),ownA:ARMORS.map((_,i)=>i===0),pot:POTIONS.map(()=>0),enh:WEAPONS.map(()=>0),wpn:0,arm:0,ammo:0});
      events.length=0;shopTab='w';}};`];
const ctx=vm.createContext({document,console,setTimeout:()=>0,Math,JSON});
new vm.Script(payload.join('\n'),{filename:'t65-actual-weapons.js'}).runInContext(ctx,{timeout:10000});
const A=ctx.API,W=A.WEAPONS,results=[];
const check=(name,pass,detail)=>{results.push(!!pass);console.log((pass?'OK   ':'FAIL ')+name+(detail===undefined?'':' — '+JSON.stringify(detail)));};

// ① 저장·통신 ID — 0~13 은 한 칸도 안 움직인다
const OLD=['맨손 돌','나무 새총','돌 화승총','쇠 소총','연발총','금빛 저격총','수정 광선총','연습용 총',
  '참나무 강궁','흑요석 산탄총','황금 연발총','목장 장총','천둥 벼락총','화염 대포'];
check('Weapons 0-13 keep their saved/network IDs (names match)',OLD.every((n,i)=>W[i]&&W[i].n===n),W.slice(0,14).map(w=>w.n));
check('Six new weapons are appended as 14-19',W.length===20,{length:W.length});
const NEW=W.slice(14);
// ② 등급 수
const tierCount=t=>NEW.filter(w=>(w.tier||'common')===t).length;
check('New weapons are 3 common, 2 rare, 1 unique',tierCount('common')===3&&tierCount('rare')===2&&tierCount('unique')===1,
  NEW.map(w=>[w.n,w.tier||'common']));
check('Every weapon declares a level requirement (1..35)',W.every(w=>Number.isInteger(w.lv)&&w.lv>=1&&w.lv<=35),W.map(w=>w.lv));
check('Starter stone, slingshot and practice gun need no level',[0,1,7].every(i=>W[i].lv===1));
check('Commons are sold for resources; rares/uniques craft from an existing lower-level weapon',
  NEW.every((w,k)=>w.tier?(!w.cost&&w.mat&&W[w.from]&&w.from!==14+k&&W[w.from].lv<=w.lv):(w.cost&&!w.mat&&!w.mini)));
check('Every trait used has a readable name',W.every(w=>!w.trait||vm.runInContext('!!TRAIT_TXT['+JSON.stringify(w.trait)+']',ctx)));
check('New weapons carry all fields used by firing, tracers, sound and held models',
  NEW.every(w=>['n','ic','lv','dmg','cd','rng','ammo','col','tr','mz','len','aimR','kick','snd','d'].every(k=>w[k]!==undefined&&w[k]!==null&&w[k]!=='')));
{ const sfx=code.slice(code.indexOf('const SFX = {'),code.indexOf('const SFX = {')+60000);
  check('Every weapon sound is an existing SFX entry',W.every(w=>new RegExp('\\b'+w.snd+'\\s*:').test(sfx)),W.map(w=>w.snd)); }
{ const arr=code.slice(code.indexOf('const gunModels = ['),scanEnd(code.indexOf('const gunModels = [')));
  const makers=[...arr.matchAll(/mk[A-Za-z]+\(\)/g)].map(m=>m[0]);
  check('Held gun model list has one model per weapon ID',makers.length===W.length,{makers:makers.length,weapons:W.length});
  check('New held models are six distinct functions',new Set(makers.slice(14)).size===6&&makers.slice(14).every(m=>!makers.slice(0,14).includes(m)),makers.slice(14));
  check('Every weapon has a baked shop/bag icon definition',W.every((_,i)=>new RegExp('\\bwpn'+i+':\\{').test(code))); }

// ⑤ 설계 표 범위 — 초당 피해 dmg/cd (강화·날짜 전)
const DPS=i=>W[i].dmg/W[i].cd;
const RANGE={14:[60,90],15:[115,140],16:[190,225],17:[130,170],18:[170,215],19:[200,240]};
check('New weapon DPS stays inside the balance table ranges',Object.entries(RANGE).every(([i,[lo,hi]])=>DPS(+i)>=lo&&DPS(+i)<=hi),
  Object.keys(RANGE).map(i=>[W[i].n,Math.round(DPS(+i))]));
const oldRare=[8,9,10,11].map(DPS),oldUnique=[12,13].map(DPS);
check('New rares sit inside the existing rare DPS band (143-221)',[17,18].every(i=>DPS(i)>=Math.min(...oldRare)-5&&DPS(i)<=Math.max(...oldRare)));
check('New unique sits inside the existing unique DPS band (208-273)',DPS(19)>=Math.min(...oldUnique)&&DPS(19)<=Math.max(...oldUnique));
check('Rare/unique hit damage stays in the existing bands (rare 95-210, unique 150-260)',[17,18].every(i=>W[i].dmg>=95&&W[i].dmg<=210)&&W[19].dmg>=150&&W[19].dmg<=260);
const shopOrder=W.map((w,i)=>i).filter(i=>i&&!W[i].mini&&!W[i].tier).sort((a,b)=>W[a].lv-W[b].lv);
check('Shop commons rise in DPS as their level rises (no cheaper-level gun beats a later one)',
  shopOrder.every((i,k)=>!k||DPS(i)>DPS(shopOrder[k-1])),shopOrder.map(i=>[W[i].n,W[i].lv,Math.round(DPS(i))]));

// ③ 레벨 잠금 — 구매
A.reset(1,true);A.setTab('w');
const card=i=>[...document.querySelectorAll('#shopList .sItem')].find(c=>c.querySelector('.sn').textContent.startsWith(W[i].n));
{ const c=card(14);
  check('Low level: shop card is locked, grey and shows the level',c&&c.classList.contains('lock')&&c.dataset.state==='locked'&&
    c.querySelector('button').disabled&&/레벨 4부터/.test(c.querySelector('button').textContent)&&/Lv 4/.test(c.querySelector('.wLv').textContent)&&c.querySelector('.wLv').classList.contains('need')&&/레벨 부족/.test(c.querySelector('.shopBadge').textContent));
  check('Level-1 weapons stay purchasable at level 1',!card(1).classList.contains('lock')&&!card(1).querySelector('button').disabled); }
let before=JSON.stringify(A.resources);A.buyWeapon(14);
check('Direct buy call below the level is refused and spends nothing',!A.KIT.ownW[14]&&before===JSON.stringify(A.resources)&&A.events.some(e=>e[0]==='toast'&&/레벨/.test(e[1])));
A.XP.lv=4;A.buyWeapon(14);
check('At the level, the same buy succeeds and pays the listed price',A.KIT.ownW[14]&&A.KIT.wpn===14&&A.resources.w===100000-W[14].cost.w);
A.reset(35,true);before=JSON.stringify(A.resources);A.buyWeapon(17);A.buyWeapon(7);
check('Crafted and practice weapons cannot be bought from the shop',!A.KIT.ownW[17]&&!A.KIT.ownW[7]&&before===JSON.stringify(A.resources));
A.reset(1,true);A.setTab('w');
check('Every shop card shows a tier and a level tag',[...document.querySelectorAll('#shopList .sItem')].every(c=>c.querySelector('.wTier')&&c.querySelector('.wLv')));
check('Shop lists weapons in level order',(()=>{const lv=[...document.querySelectorAll('#shopList .wLv')].map(e=>+e.textContent.replace(/\D/g,''));return lv.every((v,k)=>!k||v>=lv[k-1]);})());

// ③ 레벨 잠금 — 조합
A.reset(1,true);A.KIT.ownW[15]=true;A.KIT.ownW[14]=true;
check('Crafting below the level is not allowed even with base gun and materials',!A.craftable(17)&&!A.craftable(18));
before=JSON.stringify(A.resources);A.craftWeapon(17);
check('Direct craft call below the level is refused',!A.KIT.ownW[17]&&A.KIT.ownW[14]&&before===JSON.stringify(A.resources));
A.setForge('craft');
{ const c=[...document.querySelectorAll('#forgeList .sItem')].find(c=>c.querySelector('.sn').textContent.startsWith(W[17].n));
  check('Forge recipe card is locked with its level',c&&c.classList.contains('lock')&&c.querySelector('button').disabled&&/레벨 8/.test(c.textContent)); }
A.XP.lv=W[17].lv;A.craftWeapon(17);
check('At the level, crafting consumes the base gun and makes the rare',A.KIT.ownW[17]&&!A.KIT.ownW[14]&&A.KIT.wpn===17);
A.reset(W[19].lv,true);A.KIT.ownW[18]=true;A.craftWeapon(19);
check('Unique crafts from the new rare at its level',A.KIT.ownW[19]&&!A.KIT.ownW[18]);

// ④ 이미 가진 총은 레벨과 상관없이 든다
A.reset(1,false);A.KIT.ownW[19]=true;A.KIT.ownW[16]=true;A.equipWeapon(19);
const e19=A.KIT.wpn===19;A.equipWeapon(16);
check('Owned weapons equip regardless of level',e19&&A.KIT.wpn===16);
A.equipWeapon(5);check('Not-owned weapons still cannot be equipped',A.KIT.wpn===16);

// 경주 상 — 레벨을 안 본다(상이니까), 새 레어·유니크도 받을 수 있다
A.reset(1,false);const got=new Set();
for(let k=0;k<40;k++){A.KIT.ownW=W.map((_,i)=>i===0);const r=A.raceGiveWeapon('unique');if(r.got)got.add(W.findIndex((w,i)=>A.KIT.ownW[i]&&w.tier==='unique'));}
check('Race 1st-place prize ignores level and can include the new unique',got.has(19)&&[...got].every(i=>W[i].tier==='unique'),[...got]);

// 새 특성 불붙이기 — 같은 추가 명중 길(extraHit)로 세 번
{ const wolf={id:7,hp:1000,x:0,y:0,z:0};A.G.wolves.length=0;A.G.wolves.push(wolf);A.hits.length=0;
  A.burnStart(wolf,100);A.burnStart(wolf,100);
  for(let t=0;t<40;t++)A.burnTick(0.1);
  check('Burn ticks three times through extraHit and does not stack',A.hits.length===3&&A.hits.every(h=>h[0]===7&&h[1]===15)&&A.burns.length===0,A.hits);
  const dead={id:8,hp:5,x:0,y:0,z:0};A.G.wolves.push(dead);A.hits.length=0;A.burnStart(dead,100);dead.hp=0;A.burnTick(1);
  check('Burn stops on a dead zombie',A.hits.length===0&&A.burns.length===0); }
check('Burn is wired into the trait dispatcher and the frame loop',/W\.trait === 'burn'\) burnStart\(/.test(code)&&/burnTick\(dt\)/.test(code));

const failed=results.filter(v=>!v).length;
console.log(`\n${results.length-failed}/${results.length} weapon/level checks passed. Browser rendering was not tested.`);
process.exitCode=failed?1:0;
