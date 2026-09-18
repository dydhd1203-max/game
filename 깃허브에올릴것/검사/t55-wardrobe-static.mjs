// Node DOM regression: lobby-only wardrobe, saved-ID migration, and equipment bag.
// No browser, GPU, mouse, network, or renderer is started.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {GAME} from './gamefile.mjs';
const require=createRequire(import.meta.url);
let dom;
for(const p of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){
  try{dom=require(p);break;}catch{}
}
if(!dom)throw new Error('linkedom is required');
const html=fs.readFileSync(process.argv[2]||GAME,'utf8'),code=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const {document}=dom.parseHTML(html);
function end(start,fn=false){
  let depth=0,paren=0,square=0,q='',comment='',escape=false,opened=false;
  for(let i=start;i<code.length;i++){
    const c=code[i],n=code[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}
    if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(q){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===q)q='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}
    if(c==='{'){depth++;opened=true;}if(c==='}')depth--;if(c==='(')paren++;if(c===')')paren--;if(c==='[')square++;if(c===']')square--;
    if(fn&&opened&&!depth&&!paren&&!square)return i+1;
    if(!fn&&c===';'&&!depth&&!paren&&!square)return i+1;
  }throw new Error('Cannot extract source');
}
const decl=n=>{const m=new RegExp('(?:const|let)\\s+'+n+'\\s*=').exec(code);if(!m)throw new Error(n);return code.slice(m.index,end(m.index));};
const fun=n=>{const i=code.indexOf('function '+n+'(');if(i<0)throw new Error(n);return code.slice(i,end(i,true));};
const a=code.indexOf('const DRESS_OPTIONS'),b=code.indexOf('/* 42차 — 공중제비',a);
const source=[`
const G={phase:'title',started:false,day:1,me:{g:1,hat:9,gls:8,clo:10}},NG=3,GCOL=['red','blue','green'];
const stored={sheepHat:13,sheepGls:5,sheepClo:7},LS={get:(k,d)=>stored[k]??d,set:(k,v)=>stored[k]=v};
const el=id=>document.getElementById(id),sfx=()=>{},pvwDress=()=>{};
const iconImg=(k,a)=>'<img class="ic" data-ic="'+k+'" alt="'+a+'">';
const KIT={wpn:1,arm:1,ownW:[true,true,true],ownA:[true,true],pot:[2,0,0,0],ammo:20};
const enhOf=()=>0,enhMul=()=>1,enhTxt=()=>'',WDAY=()=>1,stoneDmg=()=>10,TRAIT_TXT={};
const wpnNow=()=>WEAPONS[KIT.wpn],wpnDmg=()=>20,defNow=()=>5,events=[];
const equipWeapon=i=>{KIT.wpn=i;events.push(['weapon',i]);buildKitUI();};
const equipArmor=i=>{KIT.arm=i;events.push(['armor',i]);buildKitUI();};
const usePotion=i=>{KIT.pot[i]--;events.push(['potion',i]);};
const openPop=()=>{};
`,...['HAT_ICON','HAT_NAME','HATS','GLS_ICON','GLS_NAME','GLASSES','CLO_ICON','CLO_NAME','CLOTHES','WEAPONS','ARMORS','POT_SEC','POTIONS'].map(decl),
code.slice(a,b),...['KIT_TABS','KSLOT_R','KSLOT_NAME','kitTab','pickG','pickHat','pickGls','pickClo','myDress'].map(decl),
...['kitSlot','kitItems','wearDeco','kitClick','openKit','buildKitUI','buildPicker'].map(fun),
// esc deliberately remains in its temporal dead zone at first buildPicker.
`buildPicker();const esc=s=>String(s);buildKitUI();
globalThis.A={G,KIT,stored,events,HATS,GLASSES,CLOTHES,DRESS_OPTIONS,DRESS_LEGACY,dressPickId,myDress,wearDeco,kitItems,kitClick,buildPicker,buildKitUI,
setTab:t=>{kitTab=t;buildKitUI();}};`].join('\n');
const ctx=vm.createContext({document});new vm.Script(source).runInContext(ctx,{timeout:10000});
const A=ctx.A,results=[];
function check(name,ok){results.push(!!ok);console.log((ok?'OK   ':'FAIL ')+name);}
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y),cells=()=>[...document.querySelectorAll('#kitGrid .kCell')];
check('Lobby initializes before late esc helper without a runtime error',document.querySelectorAll('.dressOptionName').length>0);
check('Legacy saved selection migrates to a non-empty supported outfit',same(A.myDress(),{hat:9,gls:8,clo:10}));
check('Stable catalog array lengths preserve existing network IDs',A.HATS.length===14&&A.GLASSES.length===9&&A.CLOTHES.length===11);
for(const [kind,rows,container] of [['hat',A.HATS,'hatPick'],['gls',A.GLASSES,'glsPick'],['clo',A.CLOTHES,'cloPick']]){
  check(kind+' picker only offers the curated choices',document.querySelectorAll('#'+container+' button').length===A.DRESS_OPTIONS[kind].length);
  check(kind+' selected style and label are accessible',document.querySelectorAll('#'+container+' [aria-pressed="true"]').length===1&&[...document.querySelectorAll('#'+container+' button')].every(n=>n.getAttribute('aria-label')));
  check(kind+' every retired nonzero ID maps to a supported nonzero style',Object.entries(A.DRESS_LEGACY[kind]).every(([old,n])=>A.dressPickId(kind,+old)===n&&n>0&&A.DRESS_OPTIONS[kind].includes(n)));
  check(kind+' all visible items have valid finite geometry',A.DRESS_OPTIONS[kind].every(i=>i===0||rows[i].length>0&&rows[i].every(r=>r.slice(0,7).every(Number.isFinite)&&r.slice(3,6).every(n=>n>0))));
}
A.wearDeco('hat',3);A.wearDeco('clo',4);A.wearDeco('gls',1);
check('Hat, face accessory and clothes remain independently combinable',same(A.myDress(),{hat:3,gls:1,clo:4}));
check('Lobby choices persist to the existing storage keys',A.stored.sheepHat===3&&A.stored.sheepGls===1&&A.stored.sheepClo===4);
const before=JSON.stringify([A.myDress(),A.G.me,A.stored]);
const oldButton=document.querySelector('#hatPick button:last-child');
A.G.started=true;A.G.phase='day';oldButton.onclick();A.wearDeco('hat',4);A.wearDeco('gls',8);A.wearDeco('clo',2);A.kitClick({t:'hat',i:6});
check('Stale picker handlers and direct wardrobe calls cannot change an active game',before===JSON.stringify([A.myDress(),A.G.me,A.stored]));
A.buildPicker();check('Hidden lobby choices are disabled after the game starts',[...document.querySelectorAll('#dressPick button')].every(n=>n.disabled));
check('Bag has no avatar canvas, cosmetic slots, or cosmetic tab',!document.getElementById('kitPvw')&&!document.getElementById('kSlotL')&&!document.getElementById('kitDoll')&&!document.getElementById('kitTabs').textContent.includes('꾸미기'));
check('Bag items are owned equipment or usable potions only',A.kitItems().length===6&&A.kitItems().every(i=>['wpn','arm','pot'].includes(i.t)));
check('Bag cards expose names and readable descriptions without hover',cells().every(n=>n.tagName==='BUTTON'&&n.querySelector('.kName').textContent&&n.querySelector('.kSub').textContent));
check('Only weapon and armor occupy current-equipment slots',document.querySelectorAll('#kSlotR .kSlot').length===2);
A.kitClick({t:'wpn',i:2,on:false});check('Weapon switching remains available',A.KIT.wpn===2);
A.kitClick({t:'arm',i:1,on:true});check('Armor unequipping remains available',A.KIT.arm===0);
A.kitClick({t:'pot',i:0});check('Potion use remains available',A.KIT.pot[0]===1);
A.setTab('deco');check('Stale cosmetic tab state safely returns to equipment list',cells().length===A.kitItems().length);
check('Unknown or invalid cosmetic input cannot produce invalid indices',A.dressPickId('hat',Infinity)===0&&A.dressPickId('hat',-4)===0&&A.wearDeco('unknown',3)===false);
const failed=results.filter(v=>!v).length;console.log(`\n${results.length-failed}/${results.length} Node wardrobe checks passed. Browser rendering was not tested.`);process.exitCode=failed?1:0;
