/* 66차 관전(쓰러졌을 때 친구 보기) — 브라우저 없이 index.html 에서 실제 함수를 뽑아 돌린다.
   보는 것: 차례(내 자리 → 우리 모둠 친구 먼저 → 다른 모둠 → 전장 전체 → 내 자리), 자동 넘기기, 보던 친구가 쓰러지면
   다음 친구, 일어나면 내 카메라, 친구 어깨 너머 카메라 거리·방향, 혼자 놀기에서 전장 전체, "일으켜 줘요" 가
   자리 통로 dn 칸의 값만 바꾸고(새 통로 없음) 10초에 한 번만 되는지, 친구 화면 알림 한 번.
   pointer lock·실제 키 입력·그림은 보지 않는다(그림은 사진으로 확인). */
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
function declaration(name){
  const m=new RegExp('(?:const|let)\\s+'+name+'\\s*=').exec(source);
  if(!m)throw new Error('Missing declaration '+name);
  return source.slice(m.index,end(m.index,false));
}
function fn(name){
  const start=source.indexOf('function '+name+'(');
  if(start<0)throw new Error('Missing function '+name);
  return source.slice(start,end(start,true));
}
const fixtures=`
const GY=10, NG=5, SHEEP_HP=100, SELF_REVIVE=24, GCOL=['#f00','#00f','#0f0','#ff0','#f0f'];
const camera=new THREE.PerspectiveCamera();
const G={started:true,phase:'night',paused:false,players:new Map(),me:{g:0,uid:'me',name:'나'}};
const PL={x:0,y:GY,z:0,yaw:0,pitch:-.3,down:false,downT:0};
let net=null, camAnc={x:0,z:0}, camDistance=2, sndOn=false, popped=false;
const pcMap=new Map(), toasts=[], feeds=[], rings=[], sounds=[];
const miniOn=()=>G.phase==='mini', popOpen=()=>popped;
const toast=m=>toasts.push(m), feed=m=>feeds.push(m), ring=(...a)=>rings.push(a);
const esc=s=>String(s), josa=(n,a,b)=>b, sfx=k=>sounds.push(k), sfxAt=k=>sounds.push(k), now0=()=>0;
const cameraClearance=(x,y,z,ox,oy,oz)=>Math.hypot(ox,oy,oz);
const fakeEl={classList:{toggle(){}},style:{},disabled:false,textContent:''};
const el=()=>fakeEl, setTxt=()=>{}, setSty=()=>{};
const document={body:fakeEl,getElementById:()=>null}, window={};
const friend=(id,g,n,x,z,extra={})=>G.players.set(id,Object.assign({uid:id,g,n,x,z,y:GY,ry:0,hp:100,down:false},extra));
function reset(){ G.players.clear(); Object.assign(PL,{x:0,y:GY,z:0,yaw:0,pitch:-.3,down:false,downT:0}); G.phase='night';
  net=null; popped=false; toasts.length=feeds.length=rings.length=sounds.length=0;
  Object.assign(SPEC,{mode:'me',uid:null,auto:false,autoT:0,snap:true,dist:null,helpT:0,helpCd:0,listT:0,on:false}); SPEC.list.length=0;
  specTick(0); }
/* goDown 의 관전 부분만(실제 goDown 은 소리·효과·HUD 를 부르므로 그 줄을 그대로 실행한다) */
function down(){ PL.down=true; PL.downT=0; ${(source.match(/SPEC\.auto = true; SPEC\.autoT = SPEC_AUTO; SPEC\.helpT = 0;/)||[''])[0]} }
`;
const context=vm.createContext({THREE,console});
vm.runInContext([
  fixtures,
  declaration('SPEC_AUTO'),declaration('SPEC_HELP_ON'),declaration('SPEC_ORB'),declaration('SPEC'),
  declaration('specOrder'),declaration('specAlive'),declaration('specReady'),declaration('_specP'),
  ...['specList','specSet','specStep','specSfx','specHelp','specHeard','specTick','specPaint','specCam'].map(fn),
].join('\n'),context,{timeout:10000});
const run=code=>vm.runInContext(code,context,{timeout:2000});
let pass=0,fail=0;
function check(name,code,accept){
  let detail,ok;
  try{detail=run('{'+code+'\n}');ok=!!accept(detail);}catch(e){detail=String(e&&e.stack||e);ok=false;}
  ok?pass++:fail++;
  console.log((ok?'OK   ':'FAIL ')+name+' — '+JSON.stringify(detail));
}

check('goDown 이 관전 자동 넘기기를 켠다(검사가 PL.down 만 켠 화면은 내 몸 그대로)',
  `/SPEC\\.auto = true; SPEC\\.autoT = SPEC_AUTO/.test(${JSON.stringify(fn('goDown'))})`, d=>d===true);
check('볼 친구 차례: 쓰러진 친구·나 빼고, 우리 모둠 먼저, 그다음 이름순',`
  reset(); friend('a',2,'가람',5,5); friend('b',0,'하늘',1,1); friend('c',0,'나래',2,2); friend('d',0,'다솜',3,3,{down:true}); friend('me',0,'나',0,0);
  specList().slice();`, d=>JSON.stringify(d)==='["c","b","a"]');
check('Q·E 차례: 내 자리 → 친구들 → 전장 전체 → 내 자리, 거꾸로도 한 바퀴',`
  reset(); friend('b',0,'하늘',1,1); friend('a',2,'가람',5,5); down(); specTick(.016);
  const fw=[]; for(let i=0;i<4;i++){ specStep(1); fw.push(SPEC.mode==='friend'?SPEC.uid:SPEC.mode); }
  const bw=[]; for(let i=0;i<4;i++){ specStep(-1); bw.push(SPEC.mode==='friend'?SPEC.uid:SPEC.mode); }
  ({fw,bw});`, d=>JSON.stringify(d.fw)==='["b","a","all","me"]'&&JSON.stringify(d.bw)==='["all","a","b","me"]');
check('쓰러지고 SPEC_AUTO 초 뒤 저절로 우리 모둠 첫 친구, 그 전엔 내 자리',`
  reset(); friend('x',3,'가람',5,5); friend('y',0,'하늘',-4,2); down();
  specTick(.5); const before=SPEC.mode; for(let t=0;t<SPEC_AUTO;t+=.1) specTick(.1);
  ({before,mode:SPEC.mode,uid:SPEC.uid,on:SPEC.on});`, d=>d.before==='me'&&d.mode==='friend'&&d.uid==='y'&&d.on);
check('혼자 놀기(볼 친구 없음): 자동으로 전장 전체 — 수정 둘레를 반지름대로 돈다',`
  reset(); down(); for(let t=0;t<SPEC_AUTO+.2;t+=.1) specTick(.1);
  const mode=SPEC.mode; SPEC.snap=true; specCam(.016); const r0=Math.hypot(camera.position.x,camera.position.z);
  const a0=Math.atan2(camera.position.x,camera.position.z);
  for(let i=0;i<120;i++) specCam(1/60); const a1=Math.atan2(camera.position.x,camera.position.z);
  const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
  const toC=new THREE.Vector3(-camera.position.x,GY+1.2-camera.position.y,-camera.position.z).normalize();
  ({mode,r0,h:camera.position.y-GY,turned:Math.abs(a1-a0),look:dir.dot(toC)});`,
  d=>d.mode==='all'&&Math.abs(d.r0-19)<.01&&d.h>6&&d.turned>.15&&d.turned<.4&&d.look>.99);
check('친구 어깨 너머: 친구 뒤 SPEC_BACK 안팎·오른쪽 어깨 옆, 친구가 보는 쪽을 본다',`
  reset(); friend('f',0,'하늘',10,-6,{ry:Math.PI/2}); down(); specTick(.016); specStep(1);
  SPEC.snap=true; PL.yaw=0; SPEC.yaw0=0; for(let i=0;i<5;i++) specCam(1/60);
  const q=G.players.get('f'), c=camera.position, d=Math.hypot(c.x-q.x,c.y-(q.y+1.3),c.z-q.z);
  const fx=-Math.sin(q.ry), fz=-Math.cos(q.ry);                      // 친구 앞쪽
  const behind=(c.x-q.x)*fx+(c.z-q.z)*fz;                            // 음수 = 뒤
  const dir=new THREE.Vector3(); camera.getWorldDirection(dir);
  ({d,behind,face:dir.x*fx+dir.z*fz});`, d=>d.d>3.3&&d.d<3.9&&d.behind<-2.5&&d.face>.9);
check('보던 친구가 쓰러지면 다음 살아 있는 친구, 모두 쓰러지면 전장 전체',`
  reset(); friend('a',0,'가',1,1); friend('b',0,'나',2,2); down(); specTick(.016); specStep(1);
  const first=SPEC.uid; G.players.get(first).down=true; specTick(.016); const second=SPEC.uid;
  G.players.get(second).down=true; specTick(.016);
  ({first,second,mode:SPEC.mode});`, d=>d.first==='a'&&d.second==='b'&&d.mode==='all');
check('다시 일어나면 내 카메라(닻을 비워 바로 붙는다)',`
  reset(); friend('a',0,'가',1,1); down(); specTick(.016); specStep(1); const was=SPEC.mode;
  PL.down=false; specTick(.016);
  ({was,mode:SPEC.mode,on:SPEC.on,anc:camAnc,cam:specCam(.016)});`, d=>d.was==='friend'&&d.mode==='me'&&!d.on&&d.anc===null&&d.cam===false);
check('미니게임에서는 관전을 켜지 않는다(그 판의 규칙 그대로)',`
  reset(); friend('a',0,'가',1,1); G.phase='mini'; down(); for(let t=0;t<3;t+=.1) specTick(.1);
  ({on:SPEC.on,mode:SPEC.mode});`, d=>!d.on&&d.mode==='me');
check('"일으켜 줘요": 혼자 놀기는 안내만, 여럿이면 3초 켜지고 10초에 한 번',`
  reset(); down(); specTick(.016); specHelp(); const solo={t:SPEC.helpT,msg:toasts.length};
  net={child(){ throw new Error('새 통로를 쓰면 안 된다'); }}; friend('a',0,'가',1,1);
  specHelp(); const on=SPEC.helpT; specTick(1); specHelp(); const again=SPEC.helpT;
  for(let t=0;t<10;t+=.5) specTick(.5); specHelp(); const later=SPEC.helpT;
  ({solo,on,again,later});`, d=>d.solo.t===0&&d.solo.msg===1&&d.on===3&&d.again<3&&d.later===3);
check('자리 통로: dn 칸 값만 1→2(칸·통로 수 그대로), 받는 쪽은 여전히 !!dn 으로 쓰러짐을 읽는다',`
  const src=${JSON.stringify(source)};
  ({send:/dn:PL\\.down\\?\\(SPEC\\.helpT>0\\?2:1\\):0/.test(src), read:/p\\.down = !!d\\.dn;/.test(src),
    heard:/const hl = d\\.dn === 2; if\\(hl && !p\\.help\\) specHeard\\(p\\); p\\.help = hl;/.test(src),
    noNewPath:!/net\\.child\\(/.test(${JSON.stringify(fn('specHelp')+fn('specHeard')+fn('specTick')+fn('specStep'))})});`,
  d=>d.send&&d.read&&d.heard&&d.noNewPath);
check('친구 화면: 부른 순간 알림 한 줄(이름·거리), 부르는 동안 발밑 금빛 고리, 내가 쓰러져 있으면 안 띄운다',`
  reset(); friend('a',1,'가람',12,0,{down:true,help:true});
  specHeard(G.players.get('a')); const n1=feeds.length, txt=feeds[0]||'';
  for(let i=0;i<60;i++) specTick(1/30); const rn=rings.length, flat=rings[0]&&rings[0][6];
  PL.down=true; specHeard(G.players.get('a'));
  ({n1,txt,rn,flat,n2:feeds.length});`, d=>d.n1===1&&/가람/.test(d.txt)&&/12칸/.test(d.txt)&&d.rn>=2&&d.rn<=3&&d.flat===true&&d.n2===1);
check('관전 키는 캡처 단계에서 Q·E·←·→·F 만 가로채고 입력란·창은 건드리지 않는다',`
  const src=${JSON.stringify(source)}; const i=src.indexOf("if(!SPEC.on || e.ctrlKey"); const blk=src.slice(i-40, i+900);
  ({capture:/}, true\\);/.test(blk), stop:/stopImmediatePropagation/.test(blk), pop:/popOpen\\(\\)/.test(blk), input:/input,textarea/.test(blk)});`,
  d=>d.capture&&d.stop&&d.pop&&d.input);
console.log(`${pass}/${pass+fail} spectate checks passed.`);
process.exitCode=fail?1:0;
