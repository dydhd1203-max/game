/* Node-only shop QA: executes the game's actual shop builders and transaction
   callbacks against a DOM and in-memory resources. No browser, GPU, server,
   pointer lock, network, timers or user-input automation is started.
   Requires linkedom (local dependency, DOM_MODULE override, or the temporary
   installation at <os.tmpdir()>/zombie-dom-tests/node_modules/linkedom).
   This verifies DOM/behavior, not browser layout or rendered appearance. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {GAME} from './gamefile.mjs';

const require=createRequire(import.meta.url);
let domLib;
for(const candidate of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){
  try{domLib=require(candidate);break;}catch{}
}
if(!domLib)throw new Error('Install linkedom for this Node-only test, or set DOM_MODULE to its module path.');
const source=fs.readFileSync(process.argv[2]||GAME,'utf8');
const {document,window}=domLib.parseHTML(source);
const code=source.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!code)throw new Error('Game module not found');

// Extract original declarations, preserving strings and comments.
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
const G={day:1,phase:'day',me:{g:1,name:'테스트'}};
const GCOL=['#123','#234','#345'],hudPrev={},KIT={ownW:[],ownA:[],pot:[],enh:[],wpn:0,arm:0,ammo:0};
let netPCDirty=false;
const resources={w:0,s:0,g:0,eg:0,mk:0,pk:0},events=[];
const el=id=>document.getElementById(id),myRes=()=>resources,myFarm=()=>({hen:2,pig:1,cow:0});
const spend=c=>{for(const [k,v] of Object.entries(c)){resources[k]-=v;}events.push(['spend',{...c}]);};
const gain=(k,n)=>{resources[k]+=n;events.push(['gain',k,n]);};
const iconImg=(id,fallback)=>'<img class="ic" data-ic="'+id+'" alt="'+fallback+'">';
const esc=s=>String(s),josa=(s,a)=>a,toast=(...a)=>events.push(['toast',...a]);
const feed=()=>{},sfx=()=>{},noteRecipes=()=>{},popOpen=()=>false,buildKitUI=()=>{};
const openPop=id=>el(id).classList.add('on');
// 66차 — 새 총을 얻으면 축하 배너(fx2Cel)가 뜬다. 여기선 부른 기록만 남긴다
const fx2Cel=o=>events.push(['cel',o]),isTouch=false;
// 65차 — 총 레벨 제한. 이 파일은 돈·재고 거래를 본다(레벨이 넉넉한 아이). 레벨 잠금은 t65-weapons-static 이 본다.
const XP={lv:99};
`;
const declarations=['WEAPONS','wpnLv','wpnLvOk','TIER_ALL','TIER_NAME','ARMORS','POT_SEC','POTIONS','AMMO_PER_GOLD','FARM_ANIMALS','FARM_CAP','farmCount','WDAY','ENH_MAX','ENH_MUL','enhOf','enhMul','enhTxt'];
const funcs=['canPay','costTxt','lackTxt','equipWeapon','equipArmor','buyWeapon','buyArmor','buyAmmo','buyPotion','sellFarm'];
const binding=code.match(/document\.querySelectorAll\('#shopTabs \.btn'\)\.forEach\(b=>[\s\S]*?\}\);/)?.[0];
if(!binding)throw new Error('Actual shop category click binding not found');
const payload=[fixture,...declarations.map(declaration),...funcs.map(fn),
  chunk("let shopTab = 'w';",'/* 농장 산물을 금으로'),binding,
  `globalThis.API={KIT,resources,events,WEAPONS,ARMORS,POTIONS,FARM_ANIMALS,AMMO_PER_GOLD,
    buildShopUI,shopCard,buyWeapon,buyArmor,buyAmmo,buyPotion,doTrade,sellFarm,tradeGive,tradeGet,
    setTab:t=>{shopTab=t;buildShopUI();},setTrade:m=>{tradeMul=m;},
    reset:()=>{Object.assign(resources,{w:10000,s:10000,g:10000,eg:0,mk:0,pk:0});
      Object.assign(KIT,{ownW:WEAPONS.map((_,i)=>i===0),ownA:ARMORS.map((_,i)=>i===0),pot:POTIONS.map(()=>0),enh:WEAPONS.map(()=>0),wpn:0,arm:0,ammo:0});
      tradeMul=1;shopTab='w';events.length=0;buildShopUI();}};`
];
const context=vm.createContext({document,window,console,setTimeout:()=>0});
new vm.Script(payload.join('\n'),{filename:'actual-shop-from-game.js'}).runInContext(context,{timeout:10000});
const A=context.API,results=[];
const check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});console.log((pass?'OK   ':'FAIL ')+name+(detail===undefined?'':' — '+JSON.stringify(detail)));};
const cards=()=>[...document.querySelectorAll('#shopList .sItem')];
const byName=name=>cards().find(c=>c.querySelector('.sn')?.textContent.includes(name));
const buy=card=>{const button=card?.querySelector('button');if(!button||button.disabled)throw new Error('Expected enabled purchase button');button.click();};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const paid=(before,cost)=>Object.keys(A.resources).every(k=>before[k]-A.resources[k]===(cost[k]||0));

A.reset();
const tabs=[...document.querySelectorAll('#shopTabs .btn')];
check('Six actual shop category controls remain available',same(tabs.map(b=>b.dataset.tab),['w','a','b','p','f','x']));
const expected={w:A.WEAPONS.filter((w,i)=>i&&!w.mini&&!w.tier).length,a:A.ARMORS.length-1,b:3,p:A.POTIONS.length,f:0,x:6};
for(const tab of tabs){
  tab.click();
  check('Category '+tab.dataset.tab+' builds expected original catalog',cards().length===expected[tab.dataset.tab],{count:cards().length,expected:expected[tab.dataset.tab]});
  check('Category '+tab.dataset.tab+' has exactly one selected control',tabs.filter(b=>b.classList.contains('on')).length===1&&tab.classList.contains('on'));
  check('Category '+tab.dataset.tab+' announces selection and matching item count',tabs.filter(b=>b.getAttribute('aria-pressed')==='true').length===1&&tab.getAttribute('aria-pressed')==='true'&&document.getElementById('shopCount').textContent===cards().length+'개'&&document.getElementById('shopCategory').textContent.trim());
  check('Category '+tab.dataset.tab+' shows valid readable product text',!document.getElementById('shopList').textContent.includes('undefined')&&cards().every(c=>c.querySelector('.sn')?.textContent.trim()));
}
check('Shop category binding leaves forge controls untouched',![...document.querySelectorAll('#forgeTabs .btn')].some(b=>typeof b.onclick==='function'));
check('Shop has named modal and top/bottom close controls',document.querySelector('#popShop .popC').getAttribute('role')==='dialog'&&document.getElementById(document.querySelector('#popShop .popC').getAttribute('aria-labelledby'))?.textContent.trim()&&document.querySelectorAll('#popShop [data-close="popShop"]').length===2);
check('Shared wallet states the current team and all three resource balances',/2모둠/.test(document.getElementById('shopTeam').textContent)&&document.querySelectorAll('#shopRes .shopBalance').length===3&&[...document.querySelectorAll('#shopRes .shopBalance')].every(b=>b.getAttribute('aria-label')));

A.reset();A.setTab('w');
let before={...A.resources};buy(byName(A.WEAPONS[2].n));
check('Weapon card invokes real purchase, spends its price and equips that weapon',A.KIT.ownW[2]&&A.KIT.wpn===2&&paid(before,A.WEAPONS[2].cost));
A.KIT.ownW[1]=true;A.buildShopUI();
check('Equipped and bag-owned weapons are distinct disabled states',
  byName(A.WEAPONS[2].n).querySelector('button').disabled&&byName(A.WEAPONS[1].n).querySelector('button').disabled&&
  /들고 있음/.test(byName(A.WEAPONS[2].n).textContent)&&/가방에 있음/.test(byName(A.WEAPONS[1].n).textContent));
check('Weapon state badges and accessible purchase names match inventory',byName(A.WEAPONS[2].n).dataset.state==='equipped'&&byName(A.WEAPONS[1].n).dataset.state==='owned'&&cards().every(c=>c.querySelector('.shopBadge')?.textContent&&c.querySelector('button').getAttribute('aria-label').includes(c.querySelector('.sn').textContent)));
before={...A.resources};A.buyWeapon(2);
check('Repeated owned-weapon purchase does not spend again',same(before,{...A.resources}));

A.reset();A.setTab('a');before={...A.resources};buy(byName(A.ARMORS[2].n));
check('Armor card invokes real purchase and equips matching armor',A.KIT.ownA[2]&&A.KIT.arm===2&&paid(before,A.ARMORS[2].cost));
check('Equipped armor changes to disabled equipped label',byName(A.ARMORS[2].n).querySelector('button').disabled&&/입고 있음/.test(byName(A.ARMORS[2].n).textContent));

for(const [index,g] of [[0,1],[1,5],[2,15]]){
  A.reset();A.setTab('b');before={...A.resources};buy(cards()[index]);
  check('Ammo bundle '+g+' spends gold and grants exact ammo',A.KIT.ammo===g*A.AMMO_PER_GOLD&&paid(before,{g}));
}
for(let i=0;i<A.POTIONS.length;i++){
  A.reset();A.setTab('p');before={...A.resources};buy(byName(A.POTIONS[i].n));
  check('Potion '+i+' purchases correct inventory slot and price',A.KIT.pot[i]===1&&A.KIT.pot.filter(Boolean).length===1&&paid(before,A.POTIONS[i].cost));
}
for(const tab of ['w','a','b','p','x']){
  A.reset();Object.keys(A.resources).forEach(k=>A.resources[k]=0);A.setTab(tab);
  check('Insufficient funds disable every '+tab+' purchase',cards().length>0&&cards().every(c=>c.classList.contains('no')&&c.querySelector('button').disabled));
  if(tab!=='x')check('Insufficient '+tab+' prices show resource-specific shortages',cards().every(c=>c.dataset.state==='unaffordable'&&c.querySelector('.shopPrice.short')&&c.querySelector('.shopLack')?.textContent.includes('더 필요해요')));
}
A.reset();Object.assign(A.resources,{w:30,s:0,g:0});A.setTab('w');
check('Shortage amount is computed from balance rather than full price',/나무 5 더 필요해요/.test(byName(A.WEAPONS[1].n).querySelector('.shopLack').textContent));
A.reset();Object.keys(A.resources).forEach(k=>A.resources[k]=0);before={...A.resources};
A.buyWeapon(1);A.buyArmor(1);A.buyAmmo(1);A.buyPotion(0);A.doTrade('w','g');
check('Transaction guards still reject direct calls with insufficient funds',same(before,{...A.resources})&&!A.KIT.ownW[1]&&!A.KIT.ownA[1]&&A.KIT.ammo===0&&A.KIT.pot.every(n=>n===0));

A.reset();A.setTab('x');
const multipliers=[...document.querySelectorAll('#shopList .shopTabs .btn')];
check('Exchange offers all three volume controls',multipliers.length===3);
multipliers[1].click();
const give=A.tradeGive('w',3),get=A.tradeGet('w','s',3);before={...A.resources};buy(byName('나무 '+give+' → 돌 '+get));
check('Exchange category keeps 3x selection and actual resource exchange',A.resources.w===before.w-give&&A.resources.s===before.s+get&&cards().length===6);
check('Exchange reports merchant fee before exchanging',/수고비|줄어/.test(document.getElementById('shopList').textContent));
check('Exchange uses two resource icons in its designated card treatment',cards().every(c=>c.classList.contains('shopExchange')&&c.querySelectorAll('.si img.ic').length===2));

A.reset();A.setTab('b');document.getElementById('shopList').scrollTop=175;buy(cards()[0]);
check('Purchase refresh preserves same-category scroll position',document.getElementById('shopList').scrollTop===175);
tabs.find(t=>t.dataset.tab==='a').click();
check('Changing category resets product list to its beginning',document.getElementById('shopList').scrollTop===0);

A.reset();A.setTab('f');
check('Empty farm inventory explains collecting goods and animal vendor',cards().length===0&&/아직 바꿀 게 없어요/.test(document.getElementById('shopList').textContent)&&/동물 상인/.test(document.getElementById('shopList').textContent));
Object.assign(A.resources,{eg:2,mk:1,pk:3});A.buildShopUI();
check('Farm lists each available product plus sell-all',cards().length===4);
const egg=A.FARM_ANIMALS.find(a=>a.res==='eg');before={...A.resources};buy(byName(egg.pn));
check('Farm product card exchanges only its matching resource for gold',A.resources.eg===0&&A.resources.g===before.g+2*egg.gold&&A.resources.mk===before.mk&&A.resources.pk===before.pk);
const remainingValue=A.FARM_ANIMALS.reduce((v,a)=>v+A.resources[a.res]*a.gold,0);before={...A.resources};buy(byName('전부 바꾸기'));
check('Farm sell-all converts all remaining produce at actual catalog rates',A.resources.g===before.g+remainingValue&&['eg','mk','pk'].every(k=>A.resources[k]===0)&&cards().length===0);

// Regression for cropped cards: DOM checks cannot measure layout, but these
// source-level constraints prevent the known shrink-and-clip combination.
const css=source.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
function rulesFor(selector){
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].replace(/\/\*[\s\S]*?\*\//g,'').trim()===selector)
    .map(m=>Object.fromEntries(m[2].split(';').filter(s=>s.includes(':')).map(s=>{const i=s.indexOf(':');return [s.slice(0,i).trim(),s.slice(i+1).trim()];})));
}
const gridRules=rulesFor('#popShop #shopList'),cardRules=rulesFor('#popShop #shopList .sItem');
const bodyRules=rulesFor('#popShop #shopList .sb'),imageRules=rulesFor('#popShop #shopList .si img.ic');
check('Card grid has intrinsic rows, while only the list scrolls (CSS contract)',gridRules.some(r=>r['grid-auto-rows']==='max-content'&&r['overflow-y']==='auto'));
check('Product cards do not clip a longer description or purchase button (CSS contract)',cardRules.some(r=>r.overflow==='visible'&&r.height==='auto'&&r['min-height']==='min-content'));
check('Card body keeps content height instead of shrinking into a short row (CSS contract)',bodyRules.some(r=>r.flex==='1 0 auto'&&r.overflow==='visible'));
check('Card text, price, shortage and purchase button cannot flex-shrink (CSS contract)',rulesFor('#popShop #shopList .sb > :is(.sn,.sd,.sc,.shopLack,button)').some(r=>r['flex-shrink']==='0'));
check('Large previews retain one responsive size instead of old short-screen overrides (CSS contract)',imageRules.length===1&&imageRules[0].width==='var(--shop-preview)'&&imageRules[0].height==='var(--shop-preview)'&&imageRules[0]['max-width']==='100%');
const previewSizes=rulesFor('#popShop .popC').map(r=>r['--shop-preview']).filter(Boolean).map(parseFloat);
check('Desktop and narrow previews are at least 160 pixels (CSS contract)',previewSizes.length>=2&&previewSizes.every(n=>n>=160)&&previewSizes[0]>=176);
check('Shared wallet sits in the title row to preserve first-row purchase space',document.querySelector('.shopTop .shopWallet #shopRes')&&document.querySelector('.shopTop .shopClose'));
check('Large previews use only 12 pixels of vertical framing (CSS contract)',rulesFor('#popShop #shopList .si').some(r=>r['min-height']==='calc(var(--shop-preview) + 12px)'&&r.padding==='6px 12px'));
A.reset();A.setTab('w');
const item=A.WEAPONS[1],oldName=item.n,oldDesc=item.d;
try{
  item.n='우리 모둠이 함께 준비하는 아주 긴 이름의 나무 새총';
  item.d='친구들과 함께 자원을 모아 준비해요. '.repeat(12);
  A.buildShopUI();const longCard=byName(item.n);
  check('Long product copy is preserved with its full cost and working buy control',longCard.querySelector('.sn').textContent===item.n&&longCard.querySelector('.sd').textContent.includes(item.d)&&longCard.querySelectorAll('.shopPrice').length>0&&typeof longCard.querySelector('button').onclick==='function');
}finally{item.n=oldName;item.d=oldDesc;}

// Exercise the actual bake scheduler with a stub GPU. The parent render check
// verifies PNG dimensions; here we ensure only weapons use the larger atlas.
const iconRuns={studios:[],shots:[],slices:[],disposed:0,lost:0},pending=[];
const iconCtx=vm.createContext({window:{},console,performance:{now:()=>0},
  document:{readyState:'complete',body:{},querySelectorAll:()=>[]},
  requestAnimationFrame:f=>pending.push(f),setTimeout:f=>pending.push(f),
  ICO_DEF:{wood:{rows:[]},wpn1:{rows:[]},wpn13:{rows:[]}},ICON:{},iconsDone:false,iconWaiters:[],emoScan:()=>{},partsGroup:rows=>rows,
  mkIconStudio:(size,n)=>{iconRuns.studios.push([size,n]);return {size,cols:Math.ceil(Math.sqrt(n)),W:Math.ceil(Math.sqrt(n))*size,r:{setSize:()=>{},dispose:()=>iconRuns.disposed++,forceContextLoss:()=>iconRuns.lost++}};},
  shootIcon:(st,g,p,idx)=>iconRuns.shots.push([st.size,idx]),
  sliceIcons:(st,slots,T)=>iconRuns.slices.push([st.size,slots.map(s=>s[0])])});
new vm.Script(fn('buildIcons')+';buildIcons();').runInContext(iconCtx);
while(pending.length)pending.shift()();
check('Weapon icons bake at 192 pixels while HUD icons remain 96',same(iconRuns.slices,[[96,['wood']],[192,['wpn1','wpn13']]]));
check('Mixed resolution baking reuses and disposes one renderer once',iconRuns.studios.length===1&&iconRuns.disposed===1&&iconRuns.lost===1);
check('Fallback timer cannot bake icons twice or miscount them',iconRuns.shots.length===3&&iconCtx.window.__ICON_MS.n===3&&iconCtx.iconsDone);

const failed=results.filter(r=>!r.pass);
console.log('\n'+(results.length-failed.length)+'/'+results.length+' Node DOM checks passed. Browser layout/rendering was not tested.');
process.exitCode=failed.length?1:0;
