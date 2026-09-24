/* Runs actual source building stats, attack cadence, splash, slow and guest FX.
   No browser, graphics process, network, input or copied combat implementation. */
import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const source=fs.readFileSync(file,'utf8');
function end(st,fun=false){let b=0,p=0,r=0,q='',co='',esc=false,open=false;
 for(let i=st;i<source.length;i++){const c=source[i],n=source[i+1];
  if(co==='l'){if(c==='\n')co='';continue;}if(co==='b'){if(c==='*'&&n==='/'){co='';i++;}continue;}
  if(q){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===q)q='';continue;}
  if(c==='/'&&n==='/'){co='l';i++;continue;}if(c==='/'&&n==='*'){co='b';i++;continue;}
  if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{'){b++;open=true;}else if(c==='}')b--;
  else if(c==='(')p++;else if(c===')')p--;else if(c==='[')r++;else if(c===']')r--;
  if(!b&&!p&&!r&&((fun&&open)||(!fun&&c===';')))return i+1;
 }throw Error('Unterminated declaration '+source.slice(st,st+60));}
const dec=n=>{const m=new RegExp('(?:const|let)\\s+'+n+'\\s*=').exec(source);if(!m)throw Error(n);return source.slice(m.index,end(m.index));};
const fn=n=>{const i=source.indexOf('function '+n+'(');if(i<0)throw Error(n);return source.slice(i,end(i,true));};
const costStart=source.indexOf('const COST_MUL ='),costEnd=source.indexOf('const SOL_COMP =',costStart);
const bookStart=source.indexOf("el('bBook').onclick ="),book=source.slice(bookStart,end(bookStart,true));
const ctx=vm.createContext({console});
const fixtures=`const G={wolves:[]},STRU=new Map(),GY=0,CRIT_MUL=2;let crit=false,clock=0;
const events=[],nodes={};const el=id=>nodes[id]||(nodes[id]={});const openPop=id=>{nodes.open=id;};
const costTxt=c=>Object.entries(c).map(([k,v])=>k+v).join(' ');
const rollCrit=()=>crit,popDmg=(...v)=>events.push({kind:'number',v,clock}),
 shootArrow=(...v)=>events.push({kind:'arrow',v,clock}),shootIce=(...v)=>events.push({kind:'ice',v,clock}),
 shootBullet=(...v)=>events.push({kind:'bullet',v,clock}),muzzleFlash=(...v)=>events.push({kind:'flash',v,clock}),
 shootOrb=(...v)=>events.push({kind:'orb',v,clock}),ring=(...v)=>events.push({kind:'ring',v,clock}),
 burst=(...v)=>events.push({kind:'burst',v,clock}),window={__sfxAt:(...v)=>events.push({kind:'sound',v,clock})},
 towerFxShot=(...v)=>events.push({kind:'towerFx',v,clock});
 const puff=(...v)=>events.push({kind:'puff',v}),tone=(...v)=>events.push({kind:'tone',v});`;
new vm.Script([fixtures,...['BUILD','BUILD_BRANCHES','MAXLV','BKEYS','SOL_COMP','WOLF_T','cliCd','SFX'].map(dec),source.slice(costStart,costEnd),
 ...['bs','cannonSpec','buildStat','buildingName','struCX','struCZ','buildingGunMuzzle','towerTarget','towerVictims','towerAttack','towerAttackTick','clientTowerFx'].map(fn),book,
 `globalThis.A={BUILD,BUILD_BRANCHES,SFX,cannonSpec,buildStat,buildingName,buildingGunMuzzle,towerTarget,towerAttack,towerAttackTick,clientTowerFx,G,STRU,cliCd,events,nodes,
 setCrit(v){crit=v;},time(v){clock=v;},book(){nodes.bBook.onclick();}};`].join('\n')).runInContext(ctx,{timeout:10000});
const A=ctx.A,results=[];
const check=(n,p,d)=>{results.push({name:n,pass:!!p,detail:d});console.log((p?'OK   ':'FAIL ')+n+(d===undefined?'':' '+JSON.stringify(d)));};
const tower=(t,lv=3,branch)=>({id:'tower',t,lv,branch,x:0,z:0,cd:0});
const wolf=(x,z,k=0,extra={})=>({x,z,y:0,k,hp:1000,mx:1000,slow:0,slowK:1,...extra});
const reset=ws=>{A.G.wolves=ws;A.events.length=0;A.STRU.clear();A.cliCd.clear();A.setCrit(false);};
check('Pulse preserves existing building order and has all seven levels',Object.keys(A.BUILD).join(',')==='wwall,swall,arrow,ice,barr,pulse'&&['hp','hi','range','area','dmg','rate'].every(k=>A.BUILD.pulse[k].length===7)&&A.BUILD.pulse.size===2);
check('Pulse uses the normal resource multiplier exactly once',JSON.stringify(A.BUILD.pulse.cost)===JSON.stringify({w:17,s:17,g:5}));
let fallback=true;for(const t of ['arrow','ice'])for(const branch of [undefined,'bad','__proto__','constructor','toString'])for(const key of ['dmg','rate','range','slow','slowT'])fallback&&=A.buildStat(tower(t,4,branch),key)===(Array.isArray(A.BUILD[t][key])?A.BUILD[t][key][3]:A.BUILD[t][key]);
check('Old saves and invalid branch values keep base behavior',fallback&&A.buildStat({t:'__proto__'},'name')===undefined&&A.buildingName({t:'missing'})==='건물');
check('Branch effects unlock at level three only',A.buildStat(tower('arrow',2,'rapid'),'rate')===1.32&&A.buildingName(tower('arrow',2,'sniper'))==='화살탑'&&A.buildingName(tower('arrow',3,'sniper'))==='대형 저격총탑');
check('Rapid and sniper have different useful tradeoffs',A.buildStat(tower('arrow',3,'rapid'),'rate')<A.buildStat(tower('arrow',3),'rate')&&A.buildStat(tower('arrow',3,'rapid'),'dmg')<A.buildStat(tower('arrow',3),'dmg')&&A.buildStat(tower('arrow',3,'sniper'),'range')>A.buildStat(tower('arrow',3),'range')&&A.buildStat(tower('arrow',3,'sniper'),'rate')>A.buildStat(tower('arrow',3),'rate'));
const base=tower('arrow'),target=wolf(3,1),neighbor=wolf(3.4,1);reset([target,neighbor]);A.towerAttackTick(base,.01);
check('Unbranched arrow still damages only its selected target',target.hp===961&&neighbor.hp===1000&&A.events.filter(e=>e.kind==='arrow').length===1);
reset([wolf(3,1)]);const quick=tower('arrow',3,'rapid');for(let i=0;i<240;i++){A.time(i/120);A.towerAttackTick(quick,1/120);}const quickShots=A.events.filter(e=>e.kind==='bullet').length;
reset([wolf(3,1)]);const slow=tower('arrow',3,'sniper');for(let i=0;i<240;i++){A.time(i/120);A.towerAttackTick(slow,1/120);}const slowShots=A.events.filter(e=>e.kind==='bullet').length;
check('Actual attack ticks use branch cadence',quickShots===3&&slowShots===1,{quickShots,slowShots});
let pulseLevels=true;for(let lv=1;lv<=7;lv++){const p=tower('pulse',lv),a=wolf(3,1),b=wolf(3.5,1),far=wolf(8,4),dead=wolf(3,1,0,{hp:0});reset([a,b,far,dead]);const hit=A.towerAttack(p,a);pulseLevels&&=hit.hits===2&&a.hp===b.hp&&a.hp<1000&&far.hp===1000&&dead.hp===0&&a.x===3&&a.slow===0;}
check('Pulse splashes living nearby targets at every level without knockback',pulseLevels);
const edgeTarget=wolf(8.8,.5),outside=wolf(10,.5);reset([edgeTarget,outside]);A.towerAttack(tower('pulse',1),edgeTarget);
check('Splash never reaches beyond tower range',edgeTarget.hp===984&&outside.hp===1000);
const armor=wolf(4,1,9),a=wolf(3,1),b=wolf(3.5,1),far=wolf(8,3);reset([a,b,armor,far]);A.towerAttack(tower('ice',3,'blizzard'),a);
check('Blizzard damages one target but slows the nearby group',a.hp===982&&b.hp===1000&&b.slow>0&&b.slowK===.70&&far.slow===0);
check('Armored zombie slow immunity survives area effects',armor.hp===1000&&armor.slow===0&&armor.slowK===1);
const frostTarget=wolf(3,1),frostNeighbor=wolf(3.5,1);reset([frostTarget,frostNeighbor]);A.towerAttack(tower('ice',3,'frost'),frostTarget);const freeze={k:frostTarget.slowK,t:frostTarget.slow};
check('Frost slows one target more strongly and for longer',frostTarget.hp===966&&freeze.k===.32&&freeze.t===3.4&&frostNeighbor.slow===0);
A.towerAttack(tower('ice',3,'blizzard'),frostTarget);check('Weaker area slow cannot erase an existing strong freeze',frostTarget.slowK===freeze.k&&frostTarget.slow===freeze.t);
const boss=wolf(3,1,7,{bi:4,addLeft:8,sumT:7}),other=wolf(4,1);reset([boss,other]);A.setCrit(true);A.towerAttack(tower('pulse',3),boss);
check('Critical splash applies once per target and leaves boss AI state intact',boss.hp===940&&other.hp===940&&boss.bi===4&&boss.addLeft===8&&boss.sumT===7);
const gone=wolf(.5,.5,0,{hp:0}),live=wolf(4,1);reset([gone,live]);check('Tower targeting skips already defeated zombies',A.towerTarget(.5,.5,10)===live);
let guests=true;for(const [t,branch,fx] of [['pulse',undefined,'towerFx'],['arrow','rapid','bullet'],['arrow','sniper','bullet'],['ice','blizzard','ice'],['ice','frost','ice']]){const a=wolf(3,1),b=wolf(3.5,1);reset([a,b]);A.STRU.set('tower',tower(t,3,branch));const before=JSON.stringify(A.G.wolves);A.clientTowerFx(.01);guests&&=before===JSON.stringify(A.G.wolves)&&A.events.some(e=>e.kind===fx)&&A.cliCd.get('tower')===A.buildStat(tower(t,3,branch),'rate');}
check('Guest effects use selected branch while never changing health or slow',guests);
const noTarget=tower('pulse');reset([]);const idle=A.towerAttackTick(noTarget,.1);check('No target uses a short retry and emits no attack',idle===false&&noTarget.cd===.25&&A.events.length===0);
A.book();const html=A.nodes.bookList.innerHTML;
check('Actual guide includes pulse and every branch with correct repair price',['대포탑','연사 기관총탑','대형 저격총탑','눈보라 얼음탑','빙결 얼음탑','🪵2'].every(s=>html.includes(s))&&!html.includes('🪵1</span>')&&A.nodes.open==='popBook');
let gunFx=true;for(const branch of ['rapid','sniper'])for(let lv=3;lv<=7;lv++)for(const [x,z]of [[5,1],[1,5],[-3,1],[1,-3]]){
 const o=tower('arrow',lv,branch),w=wolf(x,z);reset([w]);A.towerAttack(o,w);
 const shot=A.events.find(e=>e.kind==='bullet'),flash=A.events.find(e=>e.kind==='flash'),m=A.buildingGunMuzzle(o);
 gunFx&&=!!shot&&!!flash&&!A.events.some(e=>e.kind==='arrow')&&o.gunKick===1&&o.shotEnd.x===w.x&&o.shotEnd.z===w.z
  &&Math.abs(Math.hypot(m.x-1,m.z-1)-1.04)<1e-9&&Math.abs(m.y-(A.buildStat(o,'hi')-.33))<1e-9
  &&Math.abs(shot.v[0]-m.x)<1e-9&&Math.abs(shot.v[1]-m.y)<1e-9&&Math.abs(shot.v[2]-m.z)<1e-9
  &&JSON.stringify(shot.v.slice(0,3))===JSON.stringify(flash.v.slice(0,3))
  &&A.events.some(e=>e.kind==='sound'&&e.v[0]===(branch==='rapid'?'towerRapid':'towerSniper'));
}
check('Every gun level fires its muzzle tracer and flash toward targets with weapon-only recoil state',gunFx);
let oldFx=true;for(const [lv,branch]of [[2,'rapid'],[2,'sniper'],[3,undefined],[3,'unknown']]){const w=wolf(4,1),o=tower('arrow',lv,branch);reset([w]);A.towerAttack(o,w);oldFx&&=A.events.some(e=>e.kind==='arrow')&&!A.events.some(e=>e.kind==='bullet')&&o.gunKick===undefined;}
check('Unbranched, invalid and pre-level-three towers retain arrow visuals',oldFx);
reset([]);A.SFX.towerRapid();A.SFX.towerSniper();
check('Tower guns use short quiet synthetic game sounds',A.events.length===4&&A.events.every(e=>e.kind==='puff'?e.v[0]<=.04&&e.v[1]<=.05:e.kind==='tone'&&e.v[2]<=.1&&e.v[4]<=.04));
// 65차 대포탑 — 같은 대상·같은 피해를 쏘는 순간 판정하고, 포가가 표적을 향해 돌며 반동한다. 포탄·폭발·숫자는 towerFx 가 착탄 때 띄운다.
let cannon=true;for(let lv=1;lv<=7;lv++)for(const [x,z]of [[5,1],[1,5],[-3,1],[1,-3]]){
 const o=tower('pulse',lv),a=wolf(x,z),b=wolf(x+.4,z),far=wolf(x+6,z+6);reset([a,b,far]);const r=A.towerAttack(o,a);
 const fx=A.events.filter(e=>e.kind==='towerFx'),m=A.buildingGunMuzzle(o),K=A.cannonSpec(lv),dm=A.buildStat(o,'dmg');
 cannon&&=r.hits===2&&a.hp===1000-dm&&b.hp===1000-dm&&far.hp===1000&&o.gunKick===1&&Math.abs(o.gunYaw-Math.atan2(x-1,z-1))<1e-12
  &&fx.length===1&&fx[0].v[0]===o&&fx[0].v[1]===a&&fx[0].v[2].length===2&&fx[0].v[4]===dm
  &&!A.events.some(e=>e.kind==='number'||e.kind==='orb')
  &&Math.abs(Math.hypot(m.x-1,m.z-1)-Math.cos(K.pitch)*K.muzzle)<1e-9&&Math.abs(m.y-(K.py+Math.sin(K.pitch)*K.muzzle))<1e-9
  &&Math.abs(Math.atan2(m.x-1,m.z-1)-o.gunYaw)<1e-9;
}
check('Cannon aims its barrel, recoils and hands the same splash victims and damage to the shell effect',cannon);
let numbers=true;for(const [t,branch,now] of [['arrow',undefined,false],['ice','frost',false],['arrow','rapid',true],['arrow','sniper',true]]){
 const w=wolf(4,1);reset([w]);A.towerAttack(tower(t,3,branch),w);const n=A.events.filter(e=>e.kind==='number').length;
 numbers&&=n===(now?1:0)&&A.events.filter(e=>e.kind==='towerFx').length===1;}
check('Instant bullets show numbers at once; flying arrows and ice defer them to the impact effect',numbers);
reset([wolf(1,9.99),wolf(1,-8.01)]);const centerTower=tower('pulse',1);A.towerAttackTick(centerTower,.01);
check('Tower range follows the real two-cell building center on both sides',A.G.wolves[0].hp<1000&&A.G.wolves[1].hp===1000);
check('Host combat loop calls the tested attack tick',source.slice(source.indexOf('// 타워 공격 (피해는 호스트만)'),source.indexOf("qE('병정')")).includes('towerAttackTick(o,dt)'));
console.log(`${results.filter(r=>r.pass).length}/${results.length} checks passed`);process.exitCode=results.some(r=>!r.pass)?1:0;
