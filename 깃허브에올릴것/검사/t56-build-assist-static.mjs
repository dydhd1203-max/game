/* Node-only construction UI/preview checks. Actual game functions run in a DOM
   and Three.js scene without a browser, WebGL, mouse, pointer lock or network.
   Placement blockers and host-command delivery are fixtures. This does not
   substitute for browser layout checks or authoritative construction tests. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {GAME} from './gamefile.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
let domLib;
for(const c of [process.env.DOM_MODULE,'linkedom',path.join(os.tmpdir(),'zombie-dom-tests/node_modules/linkedom')].filter(Boolean)){try{domLib=require(c);break;}catch{}}
if(!domLib)throw new Error('Install linkedom or set DOM_MODULE.');
const THREE=await import(pathToFileURL(path.join(process.env.THREE_BUILD_PATH||path.join(here,'node_modules/three/build'),'three.module.js')).href);
const source=fs.readFileSync(process.argv[2]||GAME,'utf8'),{document,window}=domLib.parseHTML(source);
const code=source.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
function end(start,isFn=false){let b=0,p=0,a=0,q='',comment='',escaped=false,opened=false;
  for(let i=start;i<code.length;i++){const c=code[i],n=code[i+1];
    if(comment==='line'){if(c==='\n')comment='';continue;}if(comment==='block'){if(c==='*'&&n==='/'){comment='';i++;}continue;}
    if(q){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c===q)q='';continue;}
    if(c==='/'&&n==='/'){comment='line';i++;continue;}if(c==='/'&&n==='*'){comment='block';i++;continue;}
    if(c==='"'||c==="'"||c==='`'){q=c;continue;}if(c==='{'){b++;opened=true;}else if(c==='}')b--;else if(c==='(')p++;else if(c===')')p--;else if(c==='[')a++;else if(c===']')a--;
    if(isFn&&opened&&!b&&!p&&!a)return i+1;if(!isFn&&c===';'&&!b&&!p&&!a)return i+1;}
  throw new Error('Unterminated extraction '+start);
}
function decl(name){const m=new RegExp('(?:const|let)\\s+'+name+'\\s*=').exec(code);if(!m)throw new Error(name);return code.slice(m.index,end(m.index));}
function fn(name){const i=code.indexOf('function '+name+'(');if(i<0)throw new Error(name);return code.slice(i,end(i,true));}
function chunk(a,b){const s=code.indexOf(a),e=code.indexOf(b,s);if(s<0||e<0)throw new Error(a);return code.slice(s,e);}
Object.defineProperty(document,'activeElement',{value:document.body,writable:true,configurable:true});
window.HTMLElement.prototype.focus=function(){document.activeElement=this;};
window.HTMLElement.prototype.getBoundingClientRect=function(){return {height:84,width:600,top:Number(this.dataset.testTop||500)};};
document.exitPointerLock=()=>{};
const context=vm.createContext({THREE,document,window,console,innerWidth:360,innerHeight:640,addEventListener:window.addEventListener.bind(window)});
const fixtures=`
const G={started:true,paused:false,phase:'day',day:1,me:{g:1}},PL={down:false},GY=9,NG=5;
const scene=new THREE.Scene(),ghost=new THREE.Group(),KEY={w:true},FORT_STYLES=[0,0,0,0,0],commands=[];
let acting=true,throwing=true,wantJump=true,mvx=1,mvz=1,touchRun=true,touchJumpHeld=true;
let curTool='build',curBuild='arrow',buildMove=null,buildLineMode=false,buildLineStart=null,aimMode=false,target=null;
let work=null;const BUILD_PLANS=new Map();
const resources={w:0,s:0,g:0},blockers=new Map(),placementCalls=[];
const el=id=>document.getElementById(id),myRes=()=>resources,miniOn=()=>false,aimStru=()=>target;
const setTxt=(id,text)=>{el(id).textContent=String(text);},sfx=()=>{},toast=()=>{};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const canPlace=(t,x,z)=>blockers.get(x+','+z)||null;
const canPlaceBuilding=(t,x,z,ignore='')=>{placementCalls.push({t,x,z,ignore});return ignore==='own'?null:canPlace(t,x,z);};
const submitBuildCommand=c=>{commands.push(c);if(c.kind==='style')FORT_STYLES[G.me.g]=c.style;};
const toggleBuildLine=()=>{buildLineMode=!buildLineMode;};
const requestRepairHelp=o=>commands.push({kind:'help',id:o.id});
const ICO_DEF={},ICON={},geometryCalls=[];
const blocksOf=(...args)=>{geometryCalls.push(args);return [];};
const shortcut=(key,extra={})=>{const e=Object.assign({key,target:document.body,prevented:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}},extra);buildAssistHotkey(e);return e.prevented;};
`;
vm.runInContext([fixtures,...['BUILD','BUILD_BRANCHES','RES_IC','RES_NM','ICON_BLANK','largeIcon'].map(decl),
  chunk('const COST_MUL =','/* 배럭 등급별 병종 구성'),
  ...['bs','buildStat','buildingName','struCX','struCZ','popOpen','openPop','releaseGameInput','fortSurvived','fortStyleOf','setFortStyle','buildingGroup','iconImg'].map(fn),
  chunk('/* 건설 선택 그림도','/* 이름이 겹치는 이모지는'),
  chunk('const BUILD_ASSIST_STYLES =','/* ═══════════════════════ 로블록스 룩 1단계'),
].join('\n'),context,{timeout:10000});
const run=s=>vm.runInContext(s,context,{timeout:3000}),results=[];
function check(name,code,accept){const detail=run(code),pass=!!accept(detail);results.push({name,pass,detail});console.log((pass?'OK   ':'FAIL ')+name+' — '+JSON.stringify(detail));}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
check('Blocked placement names its reason and exact missing resources',`blockers.set('10,11','이미 설계도가 있어요');const status=buildAssistStatus('arrow',10,11,{w:2,s:1,g:0});({reason:status.reason,short:status.short,cost:BUILD.arrow.cost,ok:status.ok});`,d=>d.reason==='이미 설계도가 있어요'&&!d.ok&&d.short.find(s=>s.key==='w').amount===d.cost.w-2&&d.short.find(s=>s.key==='s').amount===d.cost.s-1);
check('Line helpers create adjacent axis-aligned cells in both directions',`[buildAssistLineCells('wwall',[3,4],[7,6]),buildAssistLineCells('swall',[3,4],[2,0])];`,d=>same(d,[[[3,4],[4,4],[5,4],[6,4],[7,4]],[[3,4],[3,3],[3,2],[3,1],[3,0]]]));
check('Line limit and invalid input avoid unbounded or broken previews',`({limit:buildAssistLineCells('wwall',[0,0],[100,0]).length,single:buildAssistLineCells('wwall',[2,3],[2,3]),wrongType:buildAssistLineCells('arrow',[0,0],[3,0]),bad:buildAssistLineCells('wwall',[NaN,0],[3,0])});`,d=>d.limit===12&&same(d.single,[[2,3]])&&!d.wrongType.length&&!d.bad.length);
check('Total wall-line shortage uses every reserved cell',`const lineStatus=buildAssistStatus('wwall',20,20,{w:2,s:0,g:0},4);({need:lineStatus.short[0].amount,w:BUILD.wwall.cost.w});`,d=>d.need===d.w*4-2);
check('Line preview matches the cell list and distinguishes blocked tiles',`buildAssistSetLine([9,11],[11,11],'wwall');const colors=[];for(let i=0;i<3;i++){const c=new THREE.Color();buildAssistState.line.getColorAt(i,c);colors.push(c.getHexString());}({count:buildAssistState.line.count,colors,visible:buildAssistState.line.visible});`,d=>d.count===3&&d.visible&&d.colors[0]!==d.colors[1]&&d.colors[0]===d.colors[2]);
check('Clearing the preview keeps reusable geometry hidden',`const lineMesh=buildAssistState.line;buildAssistClearLine();({same:lineMesh===buildAssistState.line,hidden:!lineMesh.visible});`,d=>d.same&&d.hidden);
check('Range preview uses actual branch stats and actual structure center',`const tower={t:'arrow',x:12,z:13,lv:3,branch:'sniper'};buildAssistShowRange(tower);({range:buildAssistState.range.scale.x,want:buildStat(tower,'range'),x:buildAssistState.range.position.x,z:buildAssistState.range.position.z,visible:buildAssistState.range.visible});`,d=>d.visible&&d.range===d.want&&d.range===18.5&&d.x===13&&d.z===14);
check('Non-attacking buildings do not retain a stale attack range',`buildAssistShowRange({t:'wwall',x:12,z:13});buildAssistState.range.visible;`,d=>!d);
check('HUD shows placement reason and shortage before any held action',`buildAssistInit();acting=false;ghost.visible=true;ghost.position.set(10,GY,11);buildAssistTick();({text:el('buildAssistSummary').textContent,state:el('buildAssistSummary').dataset.state,hidden:el('buildAssistSummary').hidden,style:el('buildAssistStyle').hidden,line:el('buildAssistLine').hidden});`,d=>d.text.includes('이미 설계도가 있어요')&&d.text.includes('부족')&&d.state==='blocked'&&!d.hidden&&!d.style&&d.line);
check('Wall toggle is exclusive to wall placement and announces its state',`curBuild='wwall';buildAssistTick();el('buildAssistLine').click();buildAssistTick();({hidden:el('buildAssistLine').hidden,pressed:el('buildAssistLine').getAttribute('aria-pressed')});`,d=>!d.hidden&&d.pressed==='true');
check('Move preview ignores its own footprint and never asks for building cost',`curTool='move';buildMove={id:'own',t:'arrow',x:10,z:11,lv:3,branch:'sniper'};buildAssistTick();({text:el('buildAssistSummary').textContent,range:buildAssistState.range.scale.x,ignore:placementCalls.at(-1).ignore});`,d=>d.text.includes('자원 손해 없음')&&!d.text.includes('부족')&&d.range===18.5&&d.ignore==='own');
check('Repair request button sends the aimed damaged structure',`curTool='repair';buildMove=null;target={id:'fix-me',t:'arrow',x:12,z:13,hp:5,mx:20,lv:1};buildAssistTick();el('buildAssistRepair').click();({hidden:el('buildAssistRepair').hidden,command:commands.at(-1)});`,d=>!d.hidden&&d.command.kind==='help'&&d.command.id==='fix-me');
check('Four group styles unlock exactly after nights one, two and three',`[1,2,3,4].map(day=>{G.day=day;buildAssistState.styleKey='';buildAssistStyleUI();return [...el('buildAssistStyleCards').children].map(c=>({id:c.dataset.style,locked:c.disabled,on:c.getAttribute('aria-pressed')}));});`,d=>d.every((row,i)=>row.length===4&&row.filter(c=>!c.locked).length===i&&row[0].on==='true'));
check('Unlocked style sends its actual style command and updates selected state',`el('buildAssistStyleCards').querySelector('[data-style="3"]').click();({command:commands.at(-1),selected:el('buildAssistStyleCards').querySelector('[aria-pressed="true"]').dataset.style});`,d=>d.command.kind==='style'&&d.command.style===3&&d.selected==='3');
check('Night hides the style entry and rejects opening its popup',`G.phase='night';buildAssistTick();openBuildAssistStyles();({hidden:el('buildAssistStyle').hidden,open:el('buildAssistStylePop').classList.contains('on')});`,d=>d.hidden&&!d.open);
check('Each upgrade type creates exactly its two choices using registered game-model images',`G.phase='day';['arrow','ice'].map(t=>{chooseBuildBranch({t},()=>{});const cards=[...el('buildAssistBranchCards').children];return {t,keys:cards.map(c=>c.dataset.branch),images:cards.map(c=>c.querySelector('img.ic')?.dataset.ic),text:cards.every(c=>c.textContent.trim()&&!c.textContent.includes('undefined'))};});`,d=>same(d.map(x=>x.keys),[['rapid','sniper'],['blizzard','frost']])&&d.every(x=>x.images.every((key,i)=>key==='bldspec_'+x.keys[i])&&x.text));
check('Opening the branch popup releases all movement/action input',`Object.assign(KEY,{w:true});acting=throwing=wantJump=touchRun=touchJumpHeld=true;mvx=mvz=1;chooseBuildBranch({t:'arrow'},()=>{});({key:KEY.w,acting,throwing,wantJump,touchRun,touchJumpHeld,mvx,mvz,modal:popOpen()});`,d=>d.modal&&Object.entries(d).filter(([k])=>k!=='modal').every(([,v])=>!v));
check('Choosing a branch calls back only once and closes the popup',`const picks=[];chooseBuildBranch({t:'arrow'},k=>picks.push(k));const pickButton=el('buildAssistBranchCards').firstElementChild;pickButton.click();pickButton.click();({picks,open:popOpen()});`,d=>same(d.picks,['rapid'])&&!d.open);
check('Escape cancels without selecting or leaking its key to game handlers',`let cancelledPick=false;chooseBuildBranch({t:'ice'},()=>cancelledPick=true);const escapeEvent=new window.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(escapeEvent,'key',{value:'Escape'});window.dispatchEvent(escapeEvent);({picked:cancelledPick,open:popOpen(),prevented:escapeEvent.defaultPrevented});`,d=>!d.picked&&!d.open&&d.prevented);
check('Paused/modal game hides floor previews and the helper HUD',`G.paused=true;buildAssistShowRange({t:'arrow',x:1,z:2,lv:1});buildAssistTick();({hidden:el('buildAssistDock').style.display==='none',range:buildAssistState.range.visible,line:buildAssistState.line.visible});`,d=>d.hidden&&!d.range&&!d.line);
check('Helper uses the actual raised dock top instead of only its height',`buildAssistFit(true);const normal=el('buildAssistDock').style.bottom;el('dock').dataset.testTop='450';el('dock').style.bottom='58px';buildAssistFit();({normal,raised:el('buildAssistDock').style.bottom});`,d=>d.normal==='148px'&&d.raised==='198px');
check('L listener toggles wall mode once; repeats, other buildings and input fields do not',`
  G.paused=false;G.phase='day';curTool='build';curBuild='wwall';buildLineMode=false;
  const lEvent=new window.Event('keydown',{bubbles:true,cancelable:true});Object.defineProperty(lEvent,'key',{value:'l'});window.dispatchEvent(lEvent);
  const initial=buildLineMode,repeat=shortcut('l',{repeat:true});curBuild='arrow';const wrong=shortcut('l');curBuild='wwall';const input=shortcut('l',{target:document.createElement('input')});
  ({initial,prevented:lEvent.defaultPrevented,repeat,wrong,input,mode:buildLineMode});`,d=>d.initial&&d.prevented&&d.mode&&!d.repeat&&!d.wrong&&!d.input);
check('K opens styles by keyboard only during an active day and outside other popups',`
  const opened=shortcut('k'),modal=el('buildAssistStylePop').classList.contains('on');buildAssistClose('buildAssistStylePop');
  G.phase='night';const night=shortcut('k');G.phase='day';G.started=false;const stopped=shortcut('k');G.started=true;
  el('popInfo').classList.add('on');const otherPopup=shortcut('k');el('popInfo').classList.remove('on');
  ({opened,modal,night,stopped,otherPopup});`,d=>d.opened&&d.modal&&!d.night&&!d.stopped&&!d.otherPopup);
check('J requests the damaged target while browser modifier keys remain untouched',`
  target={id:'key-repair',t:'arrow',hp:1,mx:20};const before=commands.length,requested=shortcut('j'),control=shortcut('j',{ctrlKey:true});
  target.hp=20;const full=shortcut('j');({requested,control,full,count:commands.length-before,id:commands.at(-1).id});`,d=>d.requested&&!d.control&&!d.full&&d.count===1&&d.id==='key-repair');
check('Shared work hides duplicate placement text and shows the actual plan range',`
  curTool='build';curBuild='arrow';ghost.visible=false;BUILD_PLANS.set('working',{id:'working',t:'arrow',x:3,z:4,lv:1});work={kind:'coop',id:'working'};buildAssistTick();
  ({hidden:el('buildAssistSummary').hidden,range:buildAssistState.range.visible,x:buildAssistState.range.position.x});`,d=>d.hidden&&d.range&&d.x===4);
check('Shortcut buttons expose their keyboard bindings',`['buildAssistLine','buildAssistStyle','buildAssistRepair'].map(id=>el(id).getAttribute('aria-keyshortcuts'));`,d=>same(d,['L','K','J']));
check('Eight preview factories pass actual building tier, specialization and style to geometry',`
  geometryCalls.length=0;Object.values(ICO_DEF).forEach(spec=>spec.make());({keys:Object.keys(ICO_DEF),calls:geometryCalls});`,
  d=>d.keys.length===8&&same(d.calls,[['arrow',3,'rapid',0],['arrow',3,'sniper',0],['ice',3,'blizzard',0],['ice',3,'frost',0],['barr',5,'',0],['barr',5,'',1],['barr',5,'',2],['barr',5,'',3]]));
check('Model preview keys use the existing 192px batch without moving small HUD icons',`
  ({previews:Object.keys(ICO_DEF).every(k=>largeIcon.test(k)),weapon:largeIcon.test('wpn5'),small:['bld_arrow','wood','tool_move'].some(k=>largeIcon.test(k))});`,d=>d.previews&&d.weapon&&!d.small);
check('All four group-style cards use the matching actual fort model image',`
  buildAssistState.styleKey='';buildAssistStyleUI();[...el('buildAssistStyleCards').children].map(c=>c.querySelector('img.ic')?.dataset.ic);`,d=>same(d,['fortstyle_0','fortstyle_1','fortstyle_2','fortstyle_3']));
check('Registered previews retain their auto-fill data key; unsupported icon rendering keeps a fallback',`
  const pendingArt=buildAssistArt('rapid');ICON.bldspec_rapid='data:image/png;base64,TEST';const bakedArt=buildAssistArt('rapid');window.__ICON_OFF=true;const fallbackArt=buildAssistArt('rapid');window.__ICON_OFF=false;
  ({pending:pendingArt.includes('data-ic="bldspec_rapid"'),baked:bakedArt.includes(ICON.bldspec_rapid),fallback:fallbackArt.includes('<svg')});`,d=>d.pending&&d.baked&&d.fallback);
const passed=results.filter(r=>r.pass).length;
console.log(`${passed}/${results.length} construction UI checks passed.`);
if(passed!==results.length)process.exitCode=1;
