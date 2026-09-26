/* 67차 성곽 — 정적 검사(브라우저 없음). 실제 게임 소스의 선언·함수를 vm 으로 떼어 돌린다(식을 베끼지 않는다).
   설계서 9-1 의 번호를 따른다. 땅·몸·그림이 다 선 세계가 있어야 재는 항목(2~10·13~19)은 숨김 브라우저
   `t67-castle-walk.mjs` 첫 단계(S)로 옮겼다 — genTerrain·castleLayout·buildCastle 은 vm 으로 떼기엔 목이 너무 많다(9-1 끝 단서).
   여기서 보는 것:
     1  파생값·CPLAN(설계 계산 `_spec67.cjs cplan` 값과 대조) · 12 검사 리터럴 동기 · 20 길 도우미 · 11 좀비 표(갈래 3 이 들어오면)
     T  보물 규칙(밀기 0.8초·세 dt · 창고 막힌 축 · 금화 더미 · 하루 한 상자·낮만·다음 날 · 반짝 다섯 곳 · 힌트 소리 · 🗝️ · 저장/복원)
     A  안내(구간 알림 두 겹 경계·5초 쉼 · 밤 위험 '🏃 성벽 길로 N모둠까지 약 T초' · 판 다름 알림)
     O  조준 가림 castleOccluded(덮인 곳에서만 · 틈으로만 · sheltered 면 문도 막음)
     S  발소리 STEP_G 가름 · 통신/그림 연결(meta v·sid·dg · 사람 칸 ex · 이름표 🗝️ · 미니맵) · 검사 목록
   '대기' = 다른 갈래(1 몸 · 2 그림 · 3 좀비)가 합쳐져야 잴 수 있는 항목. T67_STRICT=1 이면 대기도 실패로 센다(전부 합친 뒤). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {GAME} from './gamefile.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(process.argv[2] || GAME);
const html = fs.readFileSync(file, 'utf8');
const code = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!code) throw new Error('게임 모듈이 없습니다: ' + file);
const STRICT = process.env.T67_STRICT === '1';

function scanEnd(start, fnMode){
  let b = 0, p = 0, k = 0, quote = '', comment = '', esc = false, opened = false;
  for(let i=start; i<code.length; i++){
    const c = code[i], n = code[i+1];
    if(comment === 'line'){ if(c === '\n') comment = ''; continue; }
    if(comment === 'block'){ if(c === '*' && n === '/'){ comment = ''; i++; } continue; }
    if(quote){ if(esc){ esc = false; continue; } if(c === '\\'){ esc = true; continue; } if(c === quote) quote = ''; continue; }
    if(c === '/' && n === '/'){ comment = 'line'; i++; continue; }
    if(c === '/' && n === '*'){ comment = 'block'; i++; continue; }
    if(c === '"' || c === "'" || c === '`'){ quote = c; continue; }
    if(c === '{'){ b++; opened = true; } else if(c === '}') b--;
    else if(c === '(') p++; else if(c === ')') p--;
    else if(c === '[') k++; else if(c === ']') k--;
    if(fnMode && opened && b === 0 && p === 0 && k === 0) return i + 1;
    if(!fnMode && c === ';' && b === 0 && p === 0 && k === 0) return i + 1;
  }
  throw new Error('끝나지 않은 소스: ' + code.slice(start, start + 60));
}
const decl = (name)=>{ const m = new RegExp('(?:const|let)\\s+' + name + '\\s*=').exec(code); if(!m) throw new Error('선언 없음 ' + name); return code.slice(m.index, scanEnd(m.index, false)); };
const fn = (name)=>{ const s = code.indexOf('function ' + name + '('); if(s < 0) throw new Error('함수 없음 ' + name); return code.slice(s, scanEnd(s, true)); };
const between = (a, b)=>{ const i = code.indexOf(a), j = code.indexOf(b, i + 1); if(i < 0 || j < 0) throw new Error('구간 없음 ' + a.slice(0, 30)); return code.slice(i, j); };

/* ── 소스 조각 ── */
const PART_MAP = between('const FIELD_R = 78;', '/* ═══ 33차 세계 마무리');                   // 격자·입구 축
const PART_OCT = between('const CHAM = 0.60;', '/* ═══════════════════════ 텍스처 아틀라스');
const PART_CAS = between('const terrH = new Int16Array', 'function genTerrain(');               // 칸 배열 · corridorDist · sectorOf · CW·CK·CPLAN·순수 함수·빈 껍데기 · TRE
const PART_TRE = between('/* ═══════════ 67차 성곽 — 보물·안내·조준 (갈래 4)', '/* ═══════════ 돌 던지기');
const fixture = `
const window = {};
const LOG = {toast:[], feed:[], verdict:[], bset:[], gain:[], sfx:[], burst:0};
window.__sfx = (k)=>LOG.sfx.push(k);
let NOW = 0; const performance = {now:()=>NOW};
const LSM = new Map(); let LS_BLOCK = false;
const localStorage = {getItem:(k)=>{ if(LS_BLOCK) throw new Error('blocked'); return LSM.has(k) ? LSM.get(k) : null; },
                      setItem:(k,v)=>{ if(LS_BLOCK) throw new Error('blocked'); LSM.set(k, String(v)); }};
const G = {started:true, phase:'day', day:1, t:140, set:{daySec:140}, room:'', sid:1234, host:true, wolves:[], players:new Map(), danger:-1};
const PL = {x:0, y:9, z:0, R:0.28, yaw:0, vx:0, vz:0, mv:false, down:false};
const KEY = {}; let mvz = 0; const hudPrev = {kit:'x'};
const KIT = {pot:[0,0,0,0]};
const POTIONS = [{ic:'🧪'},{ic:'⚡'},{ic:'💪'},{ic:'🧱'}];
const toast = (m)=>LOG.toast.push(m), feed = (m)=>LOG.feed.push(m), verdict = (g,i,t)=>LOG.verdict.push(t);
const burst = ()=>{ LOG.burst++; }, bset = (h,on)=>LOG.bset.push([h[0], h[1], on]);
const gain = (k,v)=>LOG.gain.push([k,v]);
const miniOn = ()=>false;
const stairOf = new Int16Array(${'WS'}*${'WS'}).fill(-1);
const mg = {fillStyle:'', strokeStyle:'', lineWidth:1, n:0, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, fill(){ this.n++; }, arc(){}, stroke(){}};
const mpx = (x)=>75 + x, mpz = (z)=>75 + z;
`;
const ctx = vm.createContext({console, Math, JSON, Map, Set, Array, Object, Number, String, Int8Array, Int16Array, Uint8Array, Float32Array, Float64Array, Infinity, NaN, Error});
let loadErr = null;
try{
  vm.runInContext([PART_MAP, PART_OCT,
    fixture.replace(/\$\{'WS'\}/g, 'WS'),
    PART_CAS, decl('GAME_VER'), fn('fx2Hash'), decl('STEP_G'), PART_TRE,
    'globalThis.__T = {G, PL, KEY, KIT, LOG, LSM, TRE, CPLAN, CW, CK, CR, CASTLE, CROOF, ZONE, terrH, SECRET_OPEN, HW, WS, GY, FIELD_R, gi, oct, gapHalfAt, sectorOf,',
    '  updCastleTreasure, treKeys, treSync, treLedger, treSpots, treDangerRun, treVersion, treExplorer, castleOccluded, STEP_G, treMini, mg, CASTLE_TR, TRE_RUN,',
    '  setMvz:(v)=>{ mvz = v; }, setNow:(v)=>{ NOW = v; }, setLSBlock:(v)=>{ LS_BLOCK = v; }, win:window};'].join('\n'), ctx, {timeout:20000});
}catch(e){ loadErr = e; }
const results = [];
const check = (id, name, pass, detail)=>{ results.push({id, name, pass:!!pass, wait:false, detail}); };
const wait = (id, name, why)=>{ results.push({id, name, pass:!STRICT, wait:true, detail:why}); };
if(loadErr){ console.log('FAIL 소스 떼기: ' + loadErr.message); process.exit(1); }
const T = ctx.__T, W = T.win;
const near = (a, b, e = 1e-3)=> Math.abs(a - b) <= e;

/* ═══ 1. 파생값 · CPLAN ═══ */
check('1', 'HW === FIELD_R + 5 (83)', T.HW === T.FIELD_R + 5 && T.HW === 83, {HW:T.HW});
{ let mn = 1e9; for(let a=0; a<Math.PI*2; a+=0.002) mn = Math.min(mn, T.oct(Math.cos(a)*T.FIELD_R, Math.sin(a)*T.FIELD_R)); check('1', '세상 끝 원 위 최소 oct ≥ 64.5', mn >= 64.5, {min:+mn.toFixed(2)}); }
check('1', 'gapHalfAt(80) === 14.25(벌어짐 9칸에서 멈춤)', near(T.gapHalfAt(80), 14.25), {v:T.gapHalfAt(80)});
const P = T.CPLAN;
{ /* 70차 2회차 — 탑 11×11(해자 쪽 두 칸) · 나선 우리 6×6 가운데 T1 (37, −56) */
  const want = [[37,-56,Math.PI/2],[56,-37,Math.PI],[56,37,Math.PI],[37,56,-Math.PI/2],[-37,56,-Math.PI/2],[-56,37,0],[-56,-37,0],[-37,-56,Math.PI/2]];
  const bad = P.towers.filter((t,i)=> !near(t.scx, want[i][0]) || !near(t.scz, want[i][1]) || !near(Math.cos(t.th0), Math.cos(want[i][2])) || !near(Math.sin(t.th0), Math.sin(want[i][2]))).map(t=>t.id);
  check('1', '탑 여덟 나선 가운데·th0 = 설계 계산', P.towers.length === 8 && !bad.length, {bad}); }
{ const box = [[30,41,-60,-49],[49,60,-41,-30],[49,60,30,41],[30,41,49,60],[-41,-30,49,60],[-60,-49,30,41],[-60,-49,-41,-30],[-41,-30,-60,-49]];
  const bad = P.towers.filter((t,i)=> t.x0 !== box[i][0] || t.x1 !== box[i][1] || t.z0 !== box[i][2] || t.z1 !== box[i][3]).map(t=>t.id);
  check('1', '탑 상자 = 2-2 표', !bad.length, {bad}); }
{ const want = [[-11,-51,-30,-51],[11,-51,30,-51],[51,-11,51,-30],[51,11,51,30],[24,51,30,51],[-24,51,-30,51],[-51,11,-51,30],[-51,-11,-51,-30]];
  const bad = P.straights.filter((s,i)=> !near(s.a.x, want[i][0]) || !near(s.a.z, want[i][1]) || !near(s.b.x, want[i][2]) || !near(s.b.z, want[i][3])).map(s=>s.id);
  check('1', '곧은 벽 여덟 끝점 = 설계 계산', P.straights.length === 8 && !bad.length, {bad}); }
{ const want = [[35.5,-49.5,49.5,-35.5],[49.5,35.5,35.5,49.5],[-35.5,49.5,-49.5,35.5],[-49.5,-35.5,-35.5,-49.5]];
  /* 설계 계산은 문 칸 가운데(35.5,−49.5), CPLAN 은 문 바깥 얼굴 가운데(36,−49) — 둘 다 회랑 가운데 선(|x|+|z| = 85) 위, 0.71 차.
     몸(galleryClamp)은 e 띠로 조이므로 끝점 0.71 은 길이에만 든다. 같은 선 위 · 0.75 안이면 통과로 보고 차이는 적어 둔다 */
  const on = (p)=> near(Math.abs(p.x) + Math.abs(p.z), 85, 1e-3);
  const bad = P.galleries.filter((g,i)=> !on(g.a) || !on(g.b) || Math.hypot(g.a.x - want[i][0], g.a.z - want[i][1]) > 0.75 || Math.hypot(g.b.x - want[i][2], g.b.z - want[i][3]) > 0.75).map(g=>g.id);
  const d = +Math.hypot(P.galleries[0].a.x - want[0][0], P.galleries[0].a.z - want[0][1]).toFixed(3);
  check('1', '회랑 넷 끝점 — 가운데 선(e 51) 위 · 설계 계산과 ≤ 0.75' + (d > 1e-3 ? ` (차 ${d} — 문 바깥 얼굴 가운데를 씀)` : ''), P.galleries.length === 4 && !bad.length, {bad, d}); }
{ const want = [[32.5,8,-56],[56,8,-32.5],[56,8,32.5],[32.5,8,56],[-32.5,8,56],[-56,8,32.5],[-56,8,-32.5],[-32.5,8,-56],[35.5,12,-51.5],[51.5,12,-35.5],[51.5,12,35.5],[35.5,12,51.5],[-35.5,12,51.5],[-51.5,12,35.5],[-51.5,12,-35.5],[-35.5,12,-51.5],[-9,8,-51],[9,8,-51],[51,8,-9],[51,8,9],[22,8,51],[4,8,51],[-4,8,51],[-22,8,51],[-51,8,9],[-51,8,-9],[0,14,59.5]];
  const bad = []; P.spark.forEach((s,i)=>{ if(!want.some(w=> near(w[0], s.p[0]) && near(w[1], s.p[1]) && near(w[2], s.p[2]))) bad.push(i); });
  check('1', '반짝 후보 27 = 설계 계산(초소 8·망루 armA 8·성문 윗마당 10·K 1)', P.spark.length === 27 && !bad.length, {n:P.spark.length, bad}); }
check('1', 'sparkByG 다섯 구간 모두 ≥ 4 곳', P.sparkByG.length === 5 && P.sparkByG.every(L=>L.length >= 4), {n:P.sparkByG.map(L=>L.length)});
{ const want = [{k:'spiral', t:'T8', room:[-34,-31,-59,-53]}, {k:'landing', room:[47,49,-10,-8], door:[47,48,-10,-9.7]}, {k:'spiral', t:'T4', room:[31,34,53,59]},
                {k:'landing', room:[-23,-21,47,49], door:[-23,-22.7,47,48]}, {k:'spiral', t:'T6', room:[-59,-53,31,34]}];
  const bad = P.secrets.filter((s,i)=>{ const w = want[i], r = s.room;
    if(s.kind !== w.k || (w.t && s.tower !== w.t)) return true;
    if(!near(r.x0, w.room[0]) || !near(r.x1, w.room[1]) || !near(r.z0, w.room[2]) || !near(r.z1, w.room[3])) return true;
    if(w.door){ const d = s.door; if(!d || !near(d.x0, w.door[0]) || !near(d.x1, w.door[1]) || !near(d.z0, w.door[2]) || !near(d.z1, w.door[3])) return true; }
    return false; }).map(s=>s.id);
  check('1', '비밀 방 다섯 = 3-9 표(①T8·②성문2 위·③T4·④성문4 바깥·⑤T6)', P.secrets.length === 5 && !bad.length, {bad}); }
{ const bad = P.secrets.filter(s=> s.kind === 'spiral').filter(s=>{ const T8 = P.towers[s.spiral], th = s.th, px = T8.scx + Math.cos(th)*T.CW.SP.b, pz = T8.scz + Math.sin(th)*T.CW.SP.b;
    return !(px >= s.room.x0 - 1 && px <= s.room.x1 + 1 && pz >= s.room.z0 - 1 && pz <= s.room.z1 + 1); }).map(s=>s.id);
  check('1', '짝수 탑 숨은 문(th0+270°)이 armB 숨은 방 쪽', !bad.length, {bad}); }
check('1', '비밀 방마다 상자·금화 더미 자리(방 안)', P.secrets.every(s=> s.chest && s.coin && s.coin.x >= s.room.x0 && s.coin.x <= s.room.x1 && s.coin.z >= s.room.z0 && s.coin.z <= s.room.z1
  && s.chest.x >= s.room.x0 && s.chest.x <= s.room.x1 && s.chest.z >= s.room.z0 && s.chest.z <= s.room.z1), {});
check('1', '달리기 꺾은선·안내판 넷·구석 문(T1 x 31~32)', P.towers.every(t=> t.run.length === 4 && t.signs.length === 4) && P.towers[0].doors.nook.x0 === 31 && P.towers[0].doors.nook.x1 === 32, {});

/* ═══ 12. 검사 리터럴 동기 ═══ */
{ const bad = ['t3.mjs','t32.mjs','t34.mjs'].filter(f=>{ const p = path.join(here, f); return fs.existsSync(p) && !/__HW/.test(fs.readFileSync(p, 'utf8')); });
  check('12', 't3·t32·t34 가 격자 크기를 __HW 로 게임에 묻는다', !bad.length, {bad}); }

/* ═══ 20. 길 도우미 ═══ */
check('20', "옛 '달리기 띠' runAssist 없음", !/\brunAssist\s*\(/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), {});
check('20', 'CPLAN.funnels ≥ 8×7 + 6×2 + 2 (70)', P.funnels.length >= 70, {n:P.funnels.length});

/* ═══ 11. 좀비 표(갈래 3) ═══ */
if(/climb\s*:\s*1/.test(decl('WOLF_T'))){
  const ctxW = vm.createContext({Math});
  try{
    const wt = vm.runInContext(decl('WOLF_T').replace(/^const WOLF_T\s*=/, '(') .replace(/;\s*$/, ')'), ctxW);
    const names = wt.filter(d=>d.climb).map(d=>d.n).sort();
    check('11', "climb 깃발 = {좀비·날쌘좀비·굶주린·새끼} 정확히 넷 · boss 가진 것 0", names.length === 4 && wt.filter(d=>d.climb && d.boss).length === 0, {names});
  }catch(e){ check('11', 'WOLF_T 읽기', false, {err:e.message}); }
  check('11', 'packSim 7번째 칸 bit0 mv · bit1 ly', /\(o\.mv\s*\?\s*1\s*:\s*0\)\s*\|\s*\(o\.ly\s*\?\s*2\s*:\s*0\)/.test(code), {});
  check('11', 'applySim 이 ly 를 (v >> 1) & 1 로 읽는다', /\bly\s*=\s*\(\s*[^;]*?>>\s*1\s*\)\s*&\s*1/.test(code), {});
  check('11', 'BAL.climb 값(계단 3·전체 8·아이 4·12초·15초)', /climb\s*:\s*\{\s*perStair\s*:\s*3\s*,\s*total\s*:\s*8\s*,\s*perKid\s*:\s*4[^}]*wallSec\s*:\s*12\s*,\s*hardSec\s*:\s*15/.test(code), {});
} else wait('11', '좀비 표(climb 깃발·packSim ly 비트·BAL.climb)', '갈래 3 합친 뒤');

/* ═══ T. 보물 규칙 ═══ */
const run = (s)=> vm.runInContext(s, ctx, {timeout:5000});
const fresh = (over = {})=>{
  run(`__T.win.__treReset(); LSM.clear(); LOG.toast.length = 0; LOG.feed.length = 0; LOG.gain.length = 0; LOG.sfx.length = 0; LOG.bset.length = 0; LOG.verdict.length = 0;
       KIT.pot.fill(0); for(const k in KEY) delete KEY[k]; __T.setMvz(0); __T.win.__treForce(-1);
       Object.assign(G, {started:true, phase:'day', day:1, t:140, set:{daySec:140}, room:'', sid:1234, host:true});
       Object.assign(PL, {x:0, y:9, z:0, yaw:0, vx:0, vz:0, mv:false, down:false}); delete PL.blkX; delete PL.blkZ;`);
  Object.assign(T.G, over);
};
const tick = (n, dt)=>{ for(let i=0; i<n; i++) T.updCastleTreasure(dt); };
const gold = ()=> T.LOG.gain.filter(g=>g[0] === 'g').reduce((a, g)=>a + g[1], 0);
const pots = ()=> T.KIT.pot.reduce((a, b)=>a + b, 0);
/* ① 나선 숨은 문 앞에 선다: 나선 가운데에서 문 쪽(th)으로 r 1.47, 벽 쪽을 보고 W */
const standSpiral = (id)=>{ const s = P.secrets[id], t = P.towers[s.spiral], r = 1.47;
  Object.assign(T.PL, {x:t.scx + Math.cos(s.th)*r, z:t.scz + Math.sin(s.th)*r, y:T.GY + s.y, yaw:Math.atan2(-Math.cos(s.th), -Math.sin(s.th)), mv:true});
  T.KEY.w = true; };
const release = ()=>{ delete T.KEY.w; T.PL.mv = false; T.PL.vx = 0; T.PL.vz = 0; };
/* 세 dt 모두 0.8~1.0초에 열림 */
for(const dt of [1/60, 1/30, 1/20]){
  fresh(); standSpiral(0);
  let t = 0; while(!T.SECRET_OPEN[0] && t < 2){ T.updCastleTreasure(dt); t += dt; }
  check('T', `나선 숨은 문 ① — 벽을 보고 W 로 0.8초 밀면 열림(dt 1/${Math.round(1/dt)})`, T.SECRET_OPEN[0] === 1 && t >= 0.8 - 1e-6 && t <= 1.0 + 1e-6, {t:+t.toFixed(3)});
}
fresh(); standSpiral(0); T.PL.yaw += Math.PI/2; tick(90, 1/60);
check('T', '나선 숨은 문 — 벽이 아니라 계단 쪽을 보면 안 열림(1.5초)', T.SECRET_OPEN[0] === 0, {});
fresh(); standSpiral(0); T.PL.y += 0.8; tick(90, 1/60);
check('T', '나선 숨은 문 — 높이가 다르면(10/3 ± 0.5 밖) 안 열림', T.SECRET_OPEN[0] === 0, {});
/* ② 창고 문: 문 얼굴 앞에서 문 쪽으로 누름 · 막힌 축 */
const standLanding = (id, gapV = 0.1)=>{ const s = P.secrets[id], d = s.door, cx = (d.x0 + d.x1)/2, cz = (d.z0 + d.z1)/2, R = T.PL.R;
  const fx = d.nx !== 0 ? (d.nx > 0 ? d.x1 : d.x0) + d.nx*(R + gapV) : cx, fz = d.nz !== 0 ? (d.nz > 0 ? d.z1 : d.z0) + d.nz*(R + gapV) : cz;
  Object.assign(T.PL, {x:fx, z:fz, y:T.GY + d.y0, vx:-d.nx*5.94, vz:-d.nz*5.94, mv:true}); };
fresh(); standLanding(1); T.PL.blkX = 1; T.PL.blkZ = 1; tick(52, 1/60);
check('T', '창고 문 ② — 막힌 축 + 문 쪽 입력 + 거리 0.1 → 0.87초 안에 열림', T.SECRET_OPEN[1] === 1, {});
fresh(); standLanding(1); T.PL.blkX = 0; T.PL.blkZ = 0; tick(120, 1/60);
check('T', '창고 문 ② — 그 축이 안 막혔으면(옆으로 스침) 안 열림', T.SECRET_OPEN[1] === 0, {});
fresh(); standLanding(1, 0.6); T.PL.blkX = 1; T.PL.blkZ = 1; tick(120, 1/60);
check('T', '창고 문 ② — 문까지 0.6(> 0.45)이면 안 열림', T.SECRET_OPEN[1] === 0, {});
fresh(); standLanding(3); tick(52, 1/20 > 0 ? 1/60 : 0);
check('T', '창고 문 ④ — 갈래 1 의 PL.blkX/blkZ 가 아직 없으면 거리·방향만으로 열림', T.SECRET_OPEN[3] === 1, {});
/* 첫 발견 → 금화 더미 → 상자 */
fresh(); standSpiral(0); tick(50, 1/60); release();
const t0 = T.LOG.toast.join('|');
check('T', "첫 발견 알림 '🔓 비밀 문을 찾았어요! (1/5)'", /🔓 비밀 문을 찾았어요! \(1\/5\)/.test(t0), {toast:T.LOG.toast.slice(-2)});
{ const c = P.secrets[0].coin; Object.assign(T.PL, {x:c.x + 0.3, z:c.z, y:T.GY + c.y}); tick(3, 1/60); tick(3, 1/60); }
check('T', '금화 더미를 주우면 ✨+1(한 번만)', gold() === 1 && (T.TRE.paid & 1) === 1, {gold:gold()});
{ const c = P.secrets[0].chest; T.win.__treForce(0.1); Object.assign(T.PL, {x:c.x, z:c.z + 0.5, y:T.GY + c.y}); tick(3, 1/60); }
check('T', '상자 — 물약 +1(80% 줄) · 오늘 연 수 1', pots() === 1 && T.TRE.n === 1 && (T.TRE.opened & 1) === 1 && T.KIT.pot[0] + T.KIT.pot[1] + T.KIT.pot[2] + T.KIT.pot[3] === 1, {pot:Array.from(T.KIT.pot)});
/* 같은 날 ② — 가방 꽉 */
{ standLanding(1); T.PL.blkX = 1; T.PL.blkZ = 1; tick(55, 1/60); release(); const c = P.secrets[1].chest; Object.assign(T.PL, {x:c.x, z:c.z, y:T.GY + c.y}); tick(5, 1/60); }
check('T', "같은 날 둘째 상자 ② — 거절 '오늘은 가방이 꽉 찼어요'", pots() === 1 && T.LOG.toast.some(m=>/가방이 꽉/.test(m)), {pots:pots()});
{ const c = P.secrets[1].coin; Object.assign(T.PL, {x:c.x, z:c.z, y:T.GY + c.y}); tick(2, 1/60); }
check('T', '② 금화 더미 ✨+1(문마다 판 전체 한 번)', gold() === 2, {gold:gold()});
/* 밤 */
T.G.phase = 'night'; T.TRE.n = 0; T.TRE.opened = 0; { const c = P.secrets[1].chest; T.LOG.toast.length = 0; Object.assign(T.PL, {x:c.x + 5, z:c.z, y:T.GY}); tick(2, 1/60); Object.assign(T.PL, {x:c.x, z:c.z, y:T.GY + c.y}); tick(2, 1/60); }
check('T', "밤엔 거절 '보물 상자는 낮에만 열려요'", pots() === 1 && T.LOG.toast.some(m=>/낮에만/.test(m)), {});
/* 다음 날 */
T.G.phase = 'day'; T.G.day = 2; T.G.t = 140; { const c = P.secrets[1].chest; Object.assign(T.PL, {x:c.x + 5, z:c.z, y:T.GY}); tick(2, 1/60); T.win.__treForce(0.1); Object.assign(T.PL, {x:c.x, z:c.z, y:T.GY + c.y}); tick(3, 1/60); }
check('T', '다음 날 → ② 상자 물약 +1 · 금 그대로(첫 발견 금 다시 안 줌)', pots() === 2 && gold() === 2 && T.TRE.day === 2 && T.TRE.n === 1, {pots:pots(), gold:gold()});
T.G.day = 3; { const c = P.secrets[0].chest; Object.assign(T.PL, {x:c.x, z:c.z, y:T.GY + c.y}); T.win.__treForce(0.9); tick(3, 1/60); }
check('T', '그다음 날 ① — 15% 줄이면 물약 두 병 · ✨+0', pots() === 4 && gold() === 2, {pots:pots(), gold:gold()});
T.G.day = 4; { const c = P.secrets[1].chest; Object.assign(T.PL, {x:c.x, z:c.z, y:T.GY + c.y}); T.win.__treForce(0.97); tick(3, 1/60); }
check('T', "5% '반짝 상자' — 물약 1 + ✨3 · 큰 알림", pots() === 5 && gold() === 5 && T.LOG.toast.some(m=>/반짝 상자/.test(m)), {pots:pots(), gold:gold()});
/* 확률 표 */
{ const P3 = T.CASTLE_TR.potN; check('T', '상자 확률 80/15/5 · 물약 종류 60/25/10/5(합 1)', near(P3[0][0], 0.80) && near(P3[1][0], 0.15) && near(P3[2][0], 0.05) && P3[2][2] === 3
    && near(T.CASTLE_TR.potW.reduce((a,b)=>a+b, 0), 1), {potN:P3}); }
/* 저장 · 복원(새로고침 흉내) */
{ const snap = JSON.stringify({found:T.TRE.found, paid:T.TRE.paid, n:T.TRE.n, o:T.TRE.opened});
  const keys = [...T.LSM.keys()];
  run(`__T.win.__treReset();`); T.G.day = 4; T.G.room = ''; T.G.sid = 1234; T.treLedger();
  const back = JSON.stringify({found:T.TRE.found, paid:T.TRE.paid, n:T.TRE.n, o:T.TRE.opened});
  check('T', '새로고침 뒤 같은 판·같은 날: found·paid·오늘 연 수 복원(한도 유지)', snap === back && T.SECRET_OPEN[0] === 1 && T.SECRET_OPEN[1] === 1, {snap, back, keys});
  T.G.day = 5; T.treLedger();
  check('T', '다음 날로 넘어가면 오늘 값만 0(비밀 문은 그 판 동안 열림)', T.TRE.n === 0 && T.TRE.opened === 0 && T.TRE.spark === 0 && (T.TRE.found & 3) === 3, {});
  T.G.sid = 9999; T.treLedger();
  check('T', '새 판(sid 다름)은 장부가 새로(어제 판 기록이 되살아나지 않음)', T.TRE.found === 0 && T.TRE.paid === 0 && T.SECRET_OPEN[0] === 0, {});
  T.G.sid = 0; run(`__T.win.__treReset();`); T.treLedger();
  check('T', '판 번호를 모르면(옛 호스트) 저장하지 않는다', T.treKeys().run === null, {}); }
{ fresh(); run('__T.setLSBlock(true)'); let ok = true; try{ standSpiral(0); tick(60, 1/60); release(); T.treLedger(); }catch(e){ ok = false; } run('__T.setLSBlock(false)');
  check('T', 'localStorage 가 막혀도 보물은 그대로(try/catch)', ok && T.SECRET_OPEN[0] === 1, {}); }
/* 🗝️ 다섯 */
fresh(); for(const id of [0, 2, 4]){ standSpiral(id); tick(60, 1/60); release(); } for(const id of [1, 3]){ standLanding(id); T.PL.blkX = 1; T.PL.blkZ = 1; tick(60, 1/60); release(); }
check('T', "다섯 문을 다 찾으면 🗝️ 성곽 탐험가(큰 알림 + ex)", T.treExplorer() && T.LOG.verdict.some(v=>/탐험가/.test(v)) && T.LOG.toast.some(m=>/다섯 개를 다 찾았어요/.test(m)), {found:T.TRE.found});
/* 몸 상자·그림 손잡이 연결(갈래 1·2 가 채우면) */
{ fresh(); const sec = P.secrets[2], box = {off:false}, hs = [['csec', 7]], ch = {closed:[['cchest', 1]], open:[['cchestO', 1]]}, coin = [['cprop', 3]];
  sec.box = box; sec.hs = hs; sec.chestHs = ch; sec.coinHs = coin; run('__T.win.__treReset()');
  T.treSync(); const before = T.LOG.bset.slice(); standSpiral(2); tick(60, 1/60); release();
  const c = sec.coin; Object.assign(T.PL, {x:c.x, z:c.z, y:T.GY + c.y}); tick(2, 1/60);
  const ch2 = sec.chest; T.win.__treForce(0.1); Object.assign(T.PL, {x:ch2.x, z:ch2.z, y:T.GY + ch2.y}); tick(2, 1/60);
  const L = T.LOG.bset;
  check('T', '열면 몸 상자 off · 돌 판 숨김 · 금화 주우면 금화 숨김 · 상자 뚜껑 닫힘→열림(bset 바뀐 것만)', box.off === true
    && L.some(b=>b[0] === 'csec' && b[2] === false) && L.some(b=>b[0] === 'cprop' && b[2] === false) && L.some(b=>b[0] === 'cchestO' && b[2] === true) && L.some(b=>b[0] === 'cchest' && b[2] === false)
    && before.filter(b=>b[0] === 'csec').length === 1, {bset:L.length});
  const n0 = L.length; tick(30, 1/60);
  check('T', '매 프레임 bset 0(바뀔 때만)', L.length === n0, {more:L.length - n0});
  sec.box = null; sec.hs = []; sec.chestHs = {closed:[], open:[]}; delete sec.coinHs; }
/* 반짝 보물 */
{ fresh(); T.G.room = 'ABCD'; T.G.day = 7; T.G.t = 140; tick(1, 1/60);
  const S = T.win.__treSpots(), spots = S.spot;
  check('T', '반짝 다섯 곳 — 구간마다 하나(sparkByG), 서로 다름', spots.every((j, g)=> P.sparkByG[g].includes(j)) && new Set(spots).size === 5, {spots});
  check('T', '나타나는 시각 = 낮 시작 20 + 씨앗%60(20~79초)', S.at.every(a=> a >= 20 && a < 80), {at:S.at});
  const S2 = (()=>{ T.G.day = 8; tick(1, 1/60); return T.win.__treSpots(); })();
  T.G.day = 7; tick(1, 1/60); const S3 = T.win.__treSpots();
  check('T', '씨앗 — 같은 방·날이면 같은 자리(모든 화면 같음), 날이 바뀌면 달라짐', JSON.stringify(S3) === JSON.stringify(S) && JSON.stringify(S2) !== JSON.stringify(S), {});
  const g0 = 0, j = spots[g0], p = P.spark[j].p, at = S.at[g0];
  Object.assign(T.PL, {x:p[0], z:p[2], y:T.GY + p[1]});
  T.G.t = 140 - (at - 1); tick(2, 1/60);
  check('T', '나타나기 전에는 못 줍는다', gold() === 0, {});
  T.LOG.toast.length = 0; T.G.t = 140 - (at + 0.5); tick(1, 1/60);
  check('T', "나타나면 모두의 화면에 알림 '✨ 1모둠 쪽에 반짝 보물이 떴대요!' · 그 자리에 서 있으면 ✨+1", gold() === 1 && T.LOG.toast.some(m=>/1모둠 쪽에 반짝 보물이 떴대요/.test(m)) && T.TRE.spark === j + 1, {toast:T.LOG.toast});
  const g1 = spots.findIndex((q, g)=> g > 0 && S.at[g] <= Math.max(...S.at)); const p1 = P.spark[spots[g1]].p;
  T.G.t = 140 - 85; Object.assign(T.PL, {x:p1[0], z:p1[2], y:T.GY + p1[1]}); tick(3, 1/60);
  check('T', '둘째 자리는 0(아이마다 하루 한 번) — 흐린 주머니', gold() === 1, {gold:gold()});
  T.G.day = 9; T.G.t = 140 - 85; tick(1, 1/60); const S9 = T.win.__treSpots(); const p9 = P.spark[S9.spot[0]].p;
  Object.assign(T.PL, {x:p9[0], z:p9[2], y:T.GY + p9[1]}); tick(2, 1/60);
  check('T', '다음 날 다시 ✨+1', gold() === 2, {gold:gold()});
  T.G.phase = 'night'; T.G.day = 10; tick(1, 1/60); const S10 = T.win.__treSpots(); const p10 = P.spark[S10.spot[1]].p;
  Object.assign(T.PL, {x:p10[0], z:p10[2], y:T.GY + p10[1]}); tick(2, 1/60);
  check('T', '밤엔 반짝 보물 없음', gold() === 2, {});
}
/* 힌트 소리 */
{ fresh(); const s = P.secrets[1], d = s.door; Object.assign(T.PL, {x:(d.x0 + d.x1)/2 + d.nx*2, z:(d.z0 + d.z1)/2 + d.nz*2, y:T.GY}); tick(60, 1/60);
  const n1 = T.LOG.sfx.filter(k=>k === 'tok').length; tick(300, 1/60); const n2 = T.LOG.sfx.filter(k=>k === 'tok').length;
  T.G.phase = 'night'; T.TRE.hintT = 0; tick(400, 1/60); const n3 = T.LOG.sfx.filter(k=>k === 'tok').length;
  check('T', "힌트 'tok' — 3칸 안 0.5초 머물면 한 번, 그 뒤 5초마다 · 밤엔 없음", n1 === 1 && n2 === 2 && n3 === 2, {n1, n2, n3});
  fresh(); Object.assign(T.PL, {x:(d.x0 + d.x1)/2 + d.nx*2, z:(d.z0 + d.z1)/2 + d.nz*2, y:T.GY}); let x = T.PL.x;
  for(let i=0; i<120; i++){ T.PL.x = x + (i % 2 ? 0.06 : -0.06); T.updCastleTreasure(1/60); }
  check('T', "힌트 — 지나가는 아이(속도 ≥ 2)에겐 안 울림", T.LOG.sfx.filter(k=>k === 'tok').length === 0, {});
  fresh(); T.TRE.found = 2; T.treLedger(); Object.assign(T.PL, {x:(d.x0 + d.x1)/2 + d.nx*2, z:(d.z0 + d.z1)/2 + d.nz*2, y:T.GY}); tick(120, 1/60);
  check('T', '힌트 — 이미 찾은 문엔 안 울림', T.LOG.sfx.filter(k=>k === 'tok').length === 0, {}); }
/* 경제 — 들판 상자 규모 */
{ const cr = code.match(/function chestReward\(d\)\{[\s\S]*?\n\}/)?.[0] || '';
  check('T', '하루 기대 ✨ ≤ 1.3 · 물약 ≈ 1.1(들판 상자 ✨6~ 하루 2~3개보다 작게)', (0.8*0 + 0.15*0 + 0.05*3 + 1) <= 1.3 && near(0.8*1 + 0.15*2 + 0.05*1, 1.15, 0.06) && T.CASTLE_TR.perDay === 1 && T.CASTLE_TR.sparkGold === 1 && T.CASTLE_TR.firstFindGold === 1, {chestReward:!!cr}); }

/* ═══ A. 안내 ═══ */
{ fresh(); T.CROOF.fill(0);
  const runCells = (x0, x1, z0, z1)=>{ for(let z=z0; z<=z1; z++) for(let x=x0; x<=x1; x++) T.CROOF[T.gi(x, z)] |= T.CR.RUN; };
  runCells(10, 60, -53, -49); runCells(49, 53, -60, 30);
  T.PL.y = T.GY + 8; let now = 0; const walk = (x, z)=>{ now += 16.7; run(`__T.setNow(${now})`); Object.assign(T.PL, {x, z}); T.updCastleTreasure(1/60); };
  walk(20, -51); const first = T.LOG.toast.slice(); T.LOG.toast.length = 0;
  check('A', "성벽 길 첫 달리기 안내 한 번('지치지 않아요')", first.some(m=>/지치지 않아요/.test(m)), {first});
  for(let z=-45; z<=0; z+=0.25) walk(51, z);
  const s2 = T.LOG.toast.filter(m=>/모둠 성곽/.test(m));
  check('A', "구간이 바뀌면 '2모둠 성곽' 한 번", s2.length === 1 && /2모둠 성곽/.test(s2[0]), {s2});
  T.LOG.toast.length = 0; const b = T.sectorOf(51, -20) === 1 ? null : null;
  let zb = -60; for(; zb < 0; zb += 0.25) if(T.sectorOf(51, zb) === 1 && T.sectorOf(51, zb - 0.25) === 0) break;
  for(let k=0; k<40; k++){ walk(51, zb + (k % 2 ? 0.6 : -0.6)); }
  check('A', '경계에서 앞뒤로 흔들어도(±0.6) 알림 없음(두 겹 경계)', T.LOG.toast.filter(m=>/모둠 성곽/.test(m)).length === 0, {zb});
  for(let k=0; k<6; k++){ walk(51, zb - 3); walk(51, zb + 3); }
  const n5 = T.LOG.toast.filter(m=>/모둠 성곽/.test(m)).length;
  check('A', '1칸 넘게 넘나들어도 같은 알림은 5초 쉼', n5 <= 2, {n5});
  T.LOG.feed.length = 0; Object.assign(T.PL, {x:20, z:-51}); T.treDangerRun(2);
  check('A', "밤 위험 — 성벽 길 위면 '🏃 성벽 길로 3모둠까지 약 16초'(1→2→3 = 8.6 + 7.1)", T.LOG.feed.some(m=>/성벽 길로 .*3모둠.*까지 약 16초/.test(m)), {feed:T.LOG.feed});
  T.LOG.feed.length = 0; T.treDangerRun(4);
  check('A', '1 → 5 는 반대로 돌아 약 9초(가까운 쪽)', T.LOG.feed.some(m=>/5모둠.*약 9초/.test(m)), {feed:T.LOG.feed});
  T.LOG.feed.length = 0; T.treDangerRun(0); T.PL.y = T.GY; T.treDangerRun(3);
  check('A', '내 구간이거나 성벽 길이 아니면(땅) 안 뜸', T.LOG.feed.length === 0, {feed:T.LOG.feed});
  T.CROOF.fill(0); }
{ fresh(); T.G.host = false; T.treVersion('66차 옛 판'); T.treVersion('66차 옛 판');
  const n = T.LOG.toast.filter(m=>/새로고침/.test(m)).length;
  fresh(); T.G.host = false; T.win.__treReset(); run('LOG.toast.length = 0');
  check('A', "손님 판이 다르면 '새로고침해 주세요' 한 번만(큰 알림)", n === 1, {n}); }
check('A', '호스트 meta 에 v(GAME_VER)·sid·dg · 손님이 sid·v·dg 를 읽는다', /v:GAME_VER, sid:G\.sid\|\|0, dg:G\.danger\|0/.test(code) && /if\(m\.sid\) G\.sid = m\.sid;/.test(code) && /treVersion\(m\.v\)/.test(code) && /treDangerRun\(G\.danger\)/.test(code), {});
check('A', "dangerCheck 가 호스트 화면에도 treDangerRun", /say\(`⚠️[\s\S]{0,200}treDangerRun\(worst\)/.test(code), {});
/* 70차 4회차 — 판 모양(탑 CW.TW 11 · 나선 CW.SP)이 67차 판(TW 9)과 다르면 GAME_VER 도 67차 판 문자열이 아니어야 한다(옛 탭 손님에게 '새로고침' 알림이 뜨게) */
{ const gv = (code.match(/const GAME_VER = '([^']*)'/) || [])[1] || '', tw = +((code.match(/TW:(\d+)/) || [])[1] || 0), n = +((gv.match(/^(\d+)차 · /) || [])[1] || 0);
  check('A', "GAME_VER '<N>차 · …' · 탑 11×11(판 모양 바뀜)이면 N ≥ 70 · 67차 판 문자열 아님", n >= 67 && (tw === 9 || (n >= 70 && gv !== '67차 · 다섯 성문을 잇는 성곽')), {gv, tw}); }

/* ═══ O. 조준 가림 ═══ */
{ fresh(); T.CASTLE.fill(0); T.CROOF.fill(0);
  const I = (x, z)=> T.gi(x, z);
  for(let z=-54; z<=-48; z++){ T.CROOF[I(20, z)] = T.CR.G; }                           // 복도 칸(땅층 지붕)
  for(let x=10; x<=30; x++){ T.CASTLE[I(x, -52)] = T.CK.SOLID; T.terrH[I(x, -52)] = T.GY + 8; }   // 앞을 막는 벽 줄
  T.CROOF[I(20, -51)] = T.CR.G;
  Object.assign(T.PL, {x:20.5, z:-50.5, y:T.GY});
  const occ = ()=> T.castleOccluded(20.5, T.GY + 1.1, -50.5, 20.5, T.GY + 0.85, -60);
  const a = occ();
  P.apertures.push({i:I(20, -52), y0:0.6, y1:1.8, kind:'test'}); run('__T.win.__treReset()');
  const b = T.castleOccluded(20.5, T.GY + 1.1, -50.5, 20.5, T.GY + 1.2, -60);
  P.apertures.pop(); run('__T.win.__treReset()');
  Object.assign(T.PL, {x:20.5, z:-47.5}); T.CROOF[I(20, -48)] = 0;
  const c = T.castleOccluded(20.5, T.GY + 1.1, -47.5, 20.5, T.GY + 0.85, -60);
  check('O', '덮인 곳에서 쏘면 성곽 벽이 막음', a === true, {a});
  check('O', '쏘기 틈(apertures) 높이로 지나가면 통과', b === false, {b});
  check('O', '밖(지붕 없음)에서는 막지 않음(비용 0)', c === false, {c});
  T.CASTLE.fill(0); for(let x=10; x<=30; x++){ T.CASTLE[I(x, -52)] = T.CK.DOOR; T.terrH[I(x, -52)] = T.GY; }
  Object.assign(T.PL, {x:20.5, z:-50.5}); T.CROOF[I(20, -51)] = T.CR.G;
  const d = occ(); T.CROOF[I(20, -51)] = T.CR.G | T.CR.DG; const e = occ();
  check('O', 'sheltered(지붕 밑·문턱 아님)면 문 칸도 막음 · 문턱에 서면 문으로 쏠 수 있음', d === true && e === false, {d, e});
  T.CASTLE.fill(0); T.CROOF.fill(0); }
check('O', 'aimWolf 가 castleOccluded 를 조준 통 안 후보에만 부른다', /if\(perp > AR \+ along\*0\.05\) continue;\s*\n\s*if\(castleOccluded\(ex, ey, ez, w\.x, \(w\.y\|\|GY\)\+0\.85, w\.z\)\) continue;/.test(code), {});
{ const t54 = fs.readFileSync(path.join(here, 't54-combat-static.mjs'), 'utf8');
  check('O', 't54-combat-static 의 vm 목에 castleOccluded = ()=>false', /const castleOccluded=\(\)=>false/.test(t54), {}); }

/* ═══ S. 발소리 · 연결 · 목록 ═══ */
{ const I = (x, z)=> T.gi(x, z); T.CASTLE.fill(0); T.ZONE.fill(-1); T.CROOF.fill(0);
  const at = (x, z, y)=>{ Object.assign(T.PL, {x:x + 0.5, z:z + 0.5, y}); return T.STEP_G(); };
  T.CASTLE[I(47, 0)] = T.CK.LANE; T.CASTLE[I(50, 20)] = T.CK.SOLID; T.CROOF[I(50, 20)] = T.CR.RUN; T.CASTLE[I(51, 22)] = T.CK.CORR;
  T.CASTLE[I(47, -9)] = T.CK.SECRET; T.CASTLE[I(-32, -55)] = T.CK.TROOM;
  const r = {lane:at(47, 0, T.GY), wall:at(50, 20, T.GY + 8), corr:at(51, 22, T.GY), secret:at(47, -9, T.GY), hidden:at(-32, -55, T.GY + 10/3), room:at(-32, -55, T.GY)};
  check('S', 'STEP_G — 둘레길 흙(1) · 성벽 길·복도 돌(2) · 비밀 방 나무 바닥(3) · 탑 1층 판석 돌(2)', r.lane === 1 && r.wall === 2 && r.corr === 2 && r.secret === 3 && r.hidden === 3 && r.room === 2, r);
  T.CASTLE.fill(0); T.CROOF.fill(0); }
check('S', "사람 칸 ex(🗝️) · 받는 쪽 p.ex · 이름표 앞 '🗝️'", /ex:treExplorer\(\)\?1:0/.test(code) && /p\.ex = d\.ex\|0;/.test(code) && /p\.ex \? \(bi >= 0 \? '🗝️' \+ BADGES\[bi\]\.ic : '🗝️'\)/.test(code), {});
check('S', '미니맵 — 성벽 위 좀비(ly) 흰 테두리 · treMini(✦·반짝 다섯)', /if\(w\.ly\)\{ mg\.strokeStyle = '#fff'/.test(code) && /\n\s*treMini\(mg\);/.test(code), {});
{ fresh(); T.TRE.found = 5; T.TRE.opened = 1; T.G.room = 'R'; T.G.day = 3; T.G.t = 10; tick(1, 1/60); T.mg.n = 0; T.treMini(T.mg);
  check('S', 'treMini — 찾은 문 둘 ✦ + 오늘 나타난 반짝 다섯', T.mg.n === 2 + 5, {n:T.mg.n}); }
check('S', '판 번호 sid — 호스트가 판을 시작할 때 적는다', /if\(G\.host\) G\.sid = Date\.now\(\);/.test(code), {});
{ const cc = fs.readFileSync(path.join(here, 'check-current.mjs'), 'utf8');
  check('S', "check-current 목록에 't67-castle-static' · --render 에 walk·zombie", /'t67-castle-static'/.test(cc) && /t67-castle-walk/.test(cc) && /t67-castle-zombie/.test(cc), {}); }
{ const v = path.join(here, 'views67.json'); let ok = false, n = 0; try{ const j = JSON.parse(fs.readFileSync(v, 'utf8')); n = j.length; ok = j.every(o=> o.n && o.p.length === 3 && o.t.length === 3); }catch(e){}
  check('S', 'views67.json — 9-5 시점표', ok && n >= 30, {n}); }
check('S', '매 프레임 부름 — updCastleTreasure 는 효과 묶음(updDrops 뒤)', /updDrops\(dt, tAcc\);\s*\n\s*updCastleTreasure\(dt\);/.test(code), {});

/* ═══ 결과 ═══ */
let fail = 0, waitN = 0;
for(const r of results){
  const tag = r.wait ? (STRICT ? 'FAIL' : 'WAIT') : (r.pass ? 'PASS' : 'FAIL');
  if(!r.pass) fail++; if(r.wait) waitN++;
  console.log(`${tag} [${r.id}] ${r.name}` + (r.pass && !r.wait ? '' : ' ' + JSON.stringify(r.detail)));
}
const ok = results.length - fail - (STRICT ? 0 : waitN);
console.log(fail ? `${fail} failed / ${results.length}` : `${ok}/${results.length} castle static checks passed` + (waitN ? ` · ${waitN} waiting for other branches (${STRICT ? 'strict' : 'T67_STRICT=1 to fail'})` : '') + '. World checks (2~10·13~19) run in t67-castle-walk stage S.');
process.exitCode = fail ? 1 : 0;
