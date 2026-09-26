/* 70차(reload68 §8.3) — 총 다루기 모션 곡선 검사. 게임의 트랙 표(TK_*)·trackEval·kfv·gun3Motion 을 떼어 1/240 초로 떠 본다(브라우저 없음).
   보는 것: 할당 0 · 끊김 없음(화면 밖 '뚝' 구간만 예외) · 끝 = 견착(시작 자세) · 예비(반대로 조금)·넘침(E_back) · 카메라 굴림 ≤ 0.6° ·
   세 박(빠짐·꽂힘·철컥) = 소리 박자 ±20ms · 쏜 뒤 장전(노리쇠·펌프·레버) = 기계음 시각 · 무게가 무거울수록 느린 꺼내기 · 3인칭 재장전 동선. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(process.argv[2]||path.join(here,'../../클로드/index.html'));
const source=fs.readFileSync(file,'utf8');
const chunk=(a,b)=>{const s=source.indexOf(a),e=source.indexOf(b,s);if(s<0||e<0)throw new Error('Missing chunk '+a);return source.slice(s,e);};
function end(start){let b=0,q='',c='',esc=false,op=false;for(let i=start;i<source.length;i++){const ch=source[i],n=source[i+1];
  if(c==='l'){if(ch==='\n')c='';continue;}if(c==='b'){if(ch==='*'&&n==='/'){c='';i++;}continue;}
  if(q){if(esc){esc=false;continue;}if(ch==='\\'){esc=true;continue;}if(ch===q)q='';continue;}
  if(ch==='/'&&n==='/'){c='l';i++;continue;}if(ch==='/'&&n==='*'){c='b';i++;continue;}if(ch==='"'||ch==="'"||ch==='`'){q=ch;continue;}
  if(ch==='{'){b++;op=true;}else if(ch==='}')b--;if(op&&b===0)return i+1;}throw new Error('unterminated');}
const fn=name=>{const s=source.indexOf('function '+name+'(');return source.slice(s,end(s));};
const decl=name=>{const m=new RegExp('(?:const|let)\\s+'+name+'\\s*=').exec(source);let i=m.index,b=0,p=0,k=0,q='';for(;i<source.length;i++){const ch=source[i];
  if(q){if(ch===q&&source[i-1]!=='\\')q='';continue;}if(ch==='"'||ch==="'"||ch==='`'){q=ch;continue;}
  if(ch==='{')b++;else if(ch==='}')b--;else if(ch==='(')p++;else if(ch===')')p--;else if(ch==='[')k++;else if(ch===']')k--;else if(ch===';'&&!b&&!p&&!k)break;}return source.slice(m.index,i+1);};
const ctx=vm.createContext({console,Math,Float32Array});
vm.runInContext([decl('WEAPONS'),decl('GUN_CYCLE'),decl('RLK'),chunk('const EZ = [','const heldAct = '),decl('wpnKT'),fn('cycTrack'),fn('rlTrack'),fn('caseDelay'),
  chunk('const G3 = {','function gun3Motion('),fn('gun3Motion'),decl('wpnShotCd'),decl('wpnMag'),
  `globalThis.M={WEAPONS,GUN_CYCLE,RLK,EZ,CHN,CH,CHI,HP,TR,kfv,trackEval,TK_DRAW,TK_HOLS,TK_CYC,TK_RL,TK_DRY,TK_TRIG,wpnKT,cycTrack,rlTrack,caseDelay,gun3Motion,G3,wpnShotCd,wpnMag,D2R};`].join('\n'),ctx);
const M=ctx.M,res=[];const check=(n,p,d)=>{res.push(!!p);console.log((p?'OK   ':'FAIL ')+n+(d!==undefined?' — '+JSON.stringify(d):''));};
const W=M.WEAPONS;
/* 할당 0 */
check('trackEval/kfv allocate nothing (no new/array/object literal/closure inside)',!/new |\[\]|=>|\{\s*\w+\s*:/.test(fn('kfv')+fn('trackEval')));
/* 트랙 목록 */
const tracks=[];for(const [k,t] of Object.entries(M.TK_RL))tracks.push(['reload '+k,t]);for(const [k,t] of Object.entries(M.TK_CYC))tracks.push(['cycle '+k,t]);
tracks.push(['dry',M.TK_DRY],['trigger',M.TK_TRIG]);
const ev=(t,c,p)=>M.kfv(t[c],p);
/* 끝 = 시작 자세(견착) */
const bad=[];for(const [n,t] of tracks)for(let c=0;c<M.CH;c++){if(!t[c])continue;const a=ev(t,c,0),b=ev(t,c,1);if((Math.abs(a)>1e-6&&!(M.CHN[c]==='MV'&&/pouch|arrow/.test(n)))||Math.abs(b)>1e-6)bad.push([n,M.CHN[c],+a.toFixed(4),+b.toFixed(4)]);}
check('Every reload / post-shot / click track starts and ends exactly at the shouldered pose (the released stone/arrow is gone at the shot)',bad.length===0,bad.slice(0,6));
check('Draw ends at the shouldered pose; holster ends lowered out of view',M.CHN.every((k,c)=>!M.TK_DRAW[c]||Math.abs(ev(M.TK_DRAW,c,1))<1e-6)&&ev(M.TK_HOLS,M.CHI.GY,1)<-0.25);
/* 끊김 — 1/240 초 격자에서 이웃 값 차(화면 밖 '뚝' 열쇠(곡선 6)는 예외) */
const jumps=[];for(const [n,t] of tracks)for(let c=0;c<M.CH;c++){const a=t[c];if(!a)continue;
  for(let i=1;i<a.length/3;i++){const e=a[i*3+2]|0,t0=a[i*3-3],t1=a[i*3];if(e===6)continue;
    const hold=i+1<a.length/3&&(a[i*3+5]|0)===6;
    const v0=M.kfv(a,t0+1e-7),v1=M.kfv(a,t1-1e-7);if(t1-t0<1e-4&&Math.abs(a[i*3+1]-a[i*3-2])>1e-6&&!hold)jumps.push([n,M.CHN[c],t0]);}}
check('No channel jumps except the off-screen swaps (hand already below the frame)',jumps.length===0,jumps.slice(0,6));
/* 예비와 넘침 */
const rl=Object.entries(M.TK_RL),antic=rl.filter(([k,t])=>{const a=t[M.CHI.ROL];if(!a)return false;const v1=a[4],v2=a[7];return Math.sign(v1)!==Math.sign(v2)&&Math.abs(v1)<=0.25*Math.abs(v2);}).map(([k])=>k);
const over=rl.filter(([k,t])=>t.some(a=>a&&(a[a.length-1]===4||a[a.length-1]===5||a.some((v,i)=>i%3===2&&(v===4||v===5))))).map(([k])=>k);
check('Reloads anticipate (a small opposite roll first) and settle with overshoot (E_back)',rl.every(([k])=>k==='belt'||antic.includes(k))&&over.length===rl.length,{antic,over});
{ const e=M.EZ[4],pk=Math.max(...Array.from({length:200},(_,i)=>e(i/199)));check('E_back(1.2) overshoots about 5%',pk>1.03&&pk<1.08,{peak:+pk.toFixed(4)}); }
/* 카메라 */
let cr=0;for(const [n,t] of tracks){const a=t[M.CHI.CR];if(a)for(let p=0;p<=1;p+=1/240)cr=Math.max(cr,Math.abs(M.kfv(a,p)));}
check('Camera roll from motion ≤ 0.6° and clamped in code; no camera pitch channel (aim unchanged)',cr<=0.6*M.D2R+1e-9&&/heldCamRoll = Math\.max\(-0\.6\*D2R, Math\.min\(0\.6\*D2R/.test(source)&&!M.CHN.includes('CP'),{deg:+(cr/M.D2R).toFixed(3)});
/* 세 박 = 소리(재장전) — 빠짐: 탄창이 움직이기 시작 · 꽂힘: 왼손이 탄창 구멍에 닿는 순간(LY → 0) · 철컥: 노리쇠·장전 손잡이가 가장 뒤 */
const beatErr=[];
for(let i=0;i<20;i++){const w=W[i];if(w.mag<=1)continue;const C=M.GUN_CYCLE[i],t=M.rlTrack(i);if(!['box','drum'].includes(C.rk))continue;
  const at=(c,pred)=>{for(let p=0;p<=1;p+=1/2400)if(pred(M.kfv(t[c],p),p))return p;return NaN;};
  const out=C.rk==='drum'?at(M.CHI.MH,v=>v>0.5):at(M.CHI.MAG,v=>v>0.001),ins=at(M.CHI.LY,(v,p)=>p>0.5&&v>=-1e-4),rack=at(M.CHI.BOLT,(v,p)=>p>0.7&&v>=0.99*M.kfv(t[M.CHI.BOLT],0.855));
  const e=[out-C.beats[0],ins-C.beats[1],rack-C.beats[2]].map(v=>+(v*w.rl*1000).toFixed(1));if(e.some(v=>!(Math.abs(v)<=20)))beatErr.push([w.n,e]);}
check('Magazine reload beats (out · seated · rack) land within ±20 ms of the sound beats',beatErr.length===0,beatErr);
/* 쏜 뒤 장전 = 기계음 시각(GUN_CYCLE 한 표를 소리와 같이 읽는다) */
check('Bolt/pump/lever sounds read GUN_CYCLE start times (one table for sound and motion)',[3,5,9,11,14,17,18].every(i=>source.includes('GUN_CYCLE['+i+'].cyc[0]')));
const ejErr=W.map((w,i)=>{const d=M.caseDelay(i);return d>0&&d>=M.wpnShotCd(w)-0.03?[w.n,d]:null;}).filter(Boolean);
check('Shell ejection of bolt/pump/lever guns happens when the action is back, before the next allowed shot',ejErr.length===0&&M.caseDelay(3)>M.GUN_CYCLE[3].cyc[0]&&M.caseDelay(4)===0,ejErr);
/* 무게 */
const kt=W.map(w=>M.wpnKT(w)),order=[...W].map((w,i)=>[w.wt,kt[i]]).sort((a,b)=>a[0]-b[0]);
check('Heavier guns draw/holster slower (time factor 0.85 + 0.35·wt rises with weight)',order.every((v,i)=>!i||v[1]>=order[i-1][1])&&Math.abs(M.wpnKT(W[16])-1.2)<1e-9);
/* 3인칭 재장전 동선 */
{ const TG={magC:[.14,.02]};let seq=[],fin=true,lw=0,la=0;
  for(let i=0;i<=40;i++){const g=M.gun3Motion({wak:3,wap:i/40,wrk:M.RLK.box,wact:'smg'},TG);fin&&=Object.values(g).every(Number.isFinite);
    if(g.la>0.9&&!seq.includes('mag'))seq.push('mag');if(g.lw>0.9&&!seq.includes('waist'))seq.push('waist');if(g.mh>0.5&&!seq.includes('carry'))seq.push('carry');
    if(i===40){lw=g.lw;la=g.la;} }
  const g0=M.gun3Motion({wak:3,wap:0,wrk:0},TG),rest=Math.abs(g0.rol)+g0.la+g0.lw<1e-9;
  check('3rd person reload: left hand goes magazine → waist → carries the new magazine back, head nods, ends at rest',fin&&seq.join()==='mag,waist,carry'&&lw<1e-6&&la<1e-6&&rest,{seq}); }
{ const TG={magC:[.14,.02]};const d0=M.gun3Motion({wak:2,wap:0},TG).draw,d1=M.gun3Motion({wak:2,wap:1},TG).draw,h1=M.gun3Motion({wak:4,wap:1},TG).draw;
  check('3rd person draw rises from the right hip and holster returns to it',Math.abs(d0-1)<1e-9&&Math.abs(d1)<1e-6&&Math.abs(h1-1)<1e-9); }
console.log(`\n${res.filter(Boolean).length}/${res.length} motion checks passed.`);
process.exitCode=res.every(Boolean)?0:1;
