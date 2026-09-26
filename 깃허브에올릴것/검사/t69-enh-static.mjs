/* 69차 — 강화 룬 빛(명세 plan65/enh69.md) 정적 검사. 브라우저 없이 게임 소스를 읽어 약속을 못 박는다.
   ① ENH_COL 한 벌·ENH_FX 표(테 줄 수 = 단계 · 선 세기 순증가 · 떨림 상한) ② 1인칭 룬 셰이더(opaque_fragment 앞 · 실패 감지 · 깊이 누르기)
   ③ HELD_VC 는 절대 안 누른다 ④ 번짐 패스(실루엣 단색 없음 · 깊이 버퍼 · 그림자 지도 보호) ⑤ 3인칭 공 빛 없음·정원·그림자
   ⑥ 진열은 원래 재질·층 0 ⑦ 매 프레임 할당 0(updEnhHeld·updSparks·gunGlowPass) ⑧ 화면 흔들림 없음(강화 실패) ⑨ UI 테·◆·이름표 ⑩ 화염 깊이 누르기 */
import fs from 'node:fs';
import vm from 'node:vm';
import {GAME} from './gamefile.mjs';
const src = fs.readFileSync(process.argv[2] || GAME, 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, info)=>{ if(cond) pass++; else { fail++; console.log('✗ ' + name + (info !== undefined ? '  — ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); } };
function body(name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i), q = '', c2 = '';
  for(let k=j;k<src.length;k++){ const c = src[k], n = src[k+1];
    if(c2 === 'l'){ if(c === '\n') c2 = ''; continue; } if(c2 === 'b'){ if(c === '*' && n === '/'){ c2 = ''; k++; } continue; }
    if(q){ if(c === '\\'){ k++; continue; } if(c === q) q = ''; continue; }
    if(c === '/' && n === '/'){ c2 = 'l'; continue; } if(c === '/' && n === '*'){ c2 = 'b'; continue; }
    if(c === '"' || c === "'" || c === '`'){ q = c; continue; }
    if(c === '{') d++; else if(c === '}'){ d--; if(d === 0) return src.slice(i, k+1); } }
  return '';
}
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
/* ① 표 */
const colSrc = src.match(/const ENH_COL = \[null,[\s\S]*?\];/)[0], fxSrc = src.match(/const ENH_FX = \[[\s\S]*?\];/)[0];
const ENH_COL = vm.runInNewContext(colSrc.replace('const ENH_COL =', '(').replace(/;$/, ')')), ENH_FX = vm.runInNewContext(fxSrc.replace('const ENH_FX =', '(').replace(/;$/, ')'));
ok('ENH_COL 여섯 단계 색(+1 초록 · +2 보라 · +3 금 · +4 분홍 · +5 파랑 · +6 진홍)', ENH_COL.slice(1).map(c=>c.a.toString(16)).join(',') === '3ddc84,9a6bff,ffc23a,ff4fd8,4aa8ff,ff4a2a', ENH_COL.slice(1).map(c=>c.a.toString(16)));
const hue = h=>{ const r=(h>>16&255)/255, g=(h>>8&255)/255, b=(h&255)/255, M=Math.max(r,g,b), m=Math.min(r,g,b), d=M-m; if(!d) return 0;
  let x = M===r ? ((g-b)/d)%6 : M===g ? (b-r)/d+2 : (r-g)/d+4; return (x*60+360)%360; };
const hd = (a,b)=>{ const d = Math.abs(hue(a)-hue(b)); return Math.min(d, 360-d); };
ok('이웃 단계 색상각 차 ≥ 30°(단계 구별)', [1,2,3,4,5].every(e=> hd(ENH_COL[e].a, ENH_COL[e+1].a) >= 30), [1,2,3,4,5].map(e=> Math.round(hd(ENH_COL[e].a, ENH_COL[e+1].a))));
ok('테 줄 수 = 단계(아이가 센다)', ENH_FX.every((f,i)=> f.ring === i));
ok('선 세기 I · 3인칭 glow 순증가, I ≤ 1', ENH_FX.every((f,i)=> i === 0 || (f.I > ENH_FX[i-1].I && f.glow > ENH_FX[i-1].glow && f.I <= 1)));
ok('번짐 세기 gg ≤ .32', ENH_FX.every(f=> f.gg <= 0.32));
ok('떨림 — +3 까지 0, +4 부터, +6 ≤ .0022칸(예전 .0078) · 3인칭 ≤ .0030', ENH_FX.slice(0,4).every(f=> !f.sh && !f.sh3) && ENH_FX[4].sh > 0 && ENH_FX[6].sh <= 0.0022 && ENH_FX[6].sh3 <= 0.0030);
ok('강화색에 무기 예광색(tr)·크림을 안 쓴다', !/FX\.col \|\| (wpnNow\(\)|W)\.tr/.test(src));
/* ② 1인칭 셰이더 */
const addRune = body('addRune');
ok('룬은 #include <opaque_fragment> 앞에 끼운다(Lambert·Phong 모두)', /replace\('#include <opaque_fragment>', RUNE_FS_BODY \+ '#include <opaque_fragment>'\)/.test(addRune));
ok('치환 실패 감지(runeFail + console.warn)', /runeFail = true/.test(addRune) && /console\.warn\('rune inject fail'/.test(addRune));
ok('Lambert 전용 문자열 치환(outgoingLight = reflectedLight…)에 기대지 않는다', !/replace\('vec3 outgoingLight = reflectedLight/.test(src));
ok('깊이 누르기 VM_Z = mix(-gl_Position.w, …, 0.02)', /const VM_Z = '#include <project_vertex>\\n  gl_Position\.z = mix\(-gl_Position\.w, gl_Position\.z, 0\.02\);'/.test(src) && /replace\('#include <project_vertex>', VM_Z\)/.test(addRune));
ok('70차 — 선 심은 칠하기(mix · 금 위 금도 읽힌다) · 림·총구 화염은 스크린 · 상한 .95', /outgoingLight = mix\(outgoingLight, core, coreK\)/.test(src) && /min\(E2 \+ uGunFlash, vec3\(0\.95\)\) \* \(1\.0 - clamp\(outgoingLight, 0\.0, 1\.0\)\)/.test(src) && /mix\(mix\(col, uRB, 0\.75 \* sim\), vec3\(1\.0\), 0\.35 \* sim\)/.test(src));
ok('70차 — 첫 테(+1)는 총구가 아니라 기관부 쪽(.25) · +1 도 윗면 상감 선 한 줄(1인칭·3인칭 같은 순서)', /float dR = abs\(s - 0\.25\);\n\s*if\(uRRing > 1\.5\) dR = min\(dR, abs\(s - 0\.04\)\)/.test(src) && /float dR = abs\(s - 0\.25\);/.test(src.slice(src.indexOf('const GEAR_RUNE_FS'))) && ENH_FX[1].lng === 1);
ok('70차 — 새총·강궁은 룬 자리를 90° 돌려 자루→갈래로 새기고 나무에 불로 지진 룬(.5) · 용의 숨결은 글자 0', /1: \{rot:_rotX90, [^}]*wood:0\.5\}/.test(src) && /8: \{rot:_rotX90, [^}]*wood:0\.5\}/.test(src) && /19:\{gly:0\}/.test(src) && /if\(OV\.rot\) M\.premultiply\(OV\.rot\)/.test(src) && /base\.userData\.heldWood \? \(OV\.wood \|\| 0\)/.test(src));
ok('원래 emissive 를 지우지 않는다(특수 부품 제 빛)', !/emissive = new THREE\.Color\(0\); c\.material\.emissiveIntensity = 0/.test(src));
ok('손·팔(HELD_ARM)도 깊이를 누른다 · HELD_VC 는 절대 안 누른다', /HELD_ARM\.onBeforeCompile = sh=>\{ sh\.vertexShader = sh\.vertexShader\.replace\('#include <project_vertex>', VM_Z\)/.test(src) && !/HELD_VC\.onBeforeCompile/.test(src) && !/HELD_VC\.transparent\s*=/.test(src));
ok('70차 — 손(HELD_ARM)도 층 1 · 번짐 원천에서는 검은 가림막(uGlowOnly) — 장갑에 룬 번짐이 새지 않는다', /HELD_ARM\.onBeforeCompile[\s\S]{0,500}if\(uGlowOnly > 0\.5\) outgoingLight = vec3\(0\.0\)/.test(src) && /if\(isHandMat\(c\)\)\{ c\.layers\.enable\(1\)/.test(src) && !/c\.layers\.disable\(1\)/.test(src));
ok('원래 재질은 WeakMap(RUNE_BASE) — userData 에 재질을 안 넣는다', /const RUNE_BASE = new WeakMap\(\)/.test(src) && !/userData\.(base|orig)Mat\s*=/.test(src));
ok('쇠 표시 aRune — partMesh·bakeHeld(bakeList) 가 달고 합친다', /setAttribute\('aRune'/.test(body('partMesh')) && /aRune/.test(body('bakeHeld') + body('bakeList')));
/* ④ 번짐 패스 */
const gp = body('gunGlowPass');
ok('번짐 원천은 제 재질 + uGlowOnly(실루엣 단색 overrideMaterial 없음)', !/overrideMaterial/.test(gp) && /uGlowOnly\.value = 1/.test(gp) && !/mSil/.test(src));
ok('rtA 깊이 버퍼(총 자기 가림)', /GG\.rtA = new THREE\.WebGLRenderTarget\(w, h, \{depthBuffer:true\}\)/.test(src));
ok('번짐 패스가 그림자 지도를 층 1 만으로 다시 그리지 않는다', /shadowMap\.autoUpdate = false/.test(gp));
ok('held 가 안 보이면(3인칭) 번짐 패스를 안 돈다', /if\(GG\.k <= 0 \|\| !held\.visible\) return;/.test(gp));
/* ⑤ 3인칭 */
ok('P_gunF 정원 = MAXP × TPGUN_GLOW(강화 공 빛 몫 0) · 그림자 끔', /MAXP\*TPGUN_GLOW, 1\);/.test(src) && /P_gunF\.castShadow = false/.test(src));
ok('3인칭 강화 공 빛(총열 감싸기·총구 불티 공) 없음', !/glow\(B\[0\],B\[1\]/.test(src) && !/const glow=\(f,u,w,h,d\)=>setIR\(P_gunF/.test(src));
ok('3인칭 룬 셰이더(gearRune) · LOD 평균 물듦 · 스크린식', /customProgramCacheKey = \(\)=> 'gearRune'/.test(src) && /0\.06 \+ glow \* 0\.09/.test(src) && /aEnhS/.test(src));
ok('3인칭 떨림 2.2/2.9Hz(t*14 · t*18) · 손잡이를 축으로 한 몸(손잡이 f 0 은 안 움직인다)', /Math\.sin\(t\*14 \+ \(s\.ph\|\|0\)\*7\)\*s3/.test(src) && /r\[1\]\+shU\*r\[0\]\*shF/.test(src) && !/const q = j === 2 \? 0 : sh;/.test(src));
/* ⑥ 진열 */
const dc = body('dispClone');
ok('진열 복제는 원래 재질·층 0(유령 빛 0)', /RUNE_BASE\.get\(o\.material\)/.test(dc) && /o\.layers\.set\(0\)/.test(dc));
/* ⑦ 매 프레임 할당 0 */
for(const f of ['updEnhHeld', 'updSparks', 'gunGlowPass', 'waveHeadAtMuzzle', 'runeHead', 'runeDropK']){
  /* 불러온 뒤 한 번만 도는 준비(gunGlowInit · fsQuad 없을 때 · 조명 층)는 뺀다 */
  const b = noComments(body(f)).replace(/^function[^{]*\{/, '').replace(/if\(!fsQuad\)\{[^}]*\}/, '').replace(/if\(!GG\.lit\)\{[^\n]*\n/, '');
  const inner = f === 'updSparks' ? b.replace(/const born = \([\s\S]*?\};/, m=> m) : b;
  ok('매 프레임 할당 0 — ' + f, b.length > 20 && !/\bnew [A-Z]/.test(inner.replace(/gunGlowInit\(\);/, '')) && !/\.clone\(/.test(inner) && !/=\s*\[/.test(inner) && !/=\s*\{[^}]/.test(inner.replace(/\$\{/g, '')), f);
}
/* ⑧ 흔들림 */
const er = body('enhResult');
ok('강화 실패에 화면 흔들림(__shake) 없음', !/__shake/.test(noComments(er)));
ok('+6 은 큰 배너(enh6) · 새 소리 enhMax · 깨어남 gunWake', /k:'enh6', big:true/.test(er) && /'enhMax'/.test(er) && /gunWake\[i\] = 1/.test(er) && /enhMax:/.test(src) && /enhWake:/.test(src));
ok('떨림 envelope — 쏘는 중·잔떨림 중 0(shEnv)', /const busy = g68Jit > 0 \|\| flashT > 0 \|\| enhShotAgo < 0\.40 \|\| heldActOn\(\);/.test(src) && /Math\.sin\(gunShakeT\*14\)/.test(src));
/* ⑨ UI */
ok('CSS 테 변수 --e1~--e6 · 토스트 z 44 · 움직임 줄이기', /--e1:#1fa862;--e2:#7a4fe0;--e3:#d99a10;--e4:#d63bb4;--e5:#2f86e0;--e6:#e0321c/.test(src) && /#toast\{z-index:44\}/.test(src) && /prefers-reduced-motion:reduce\)\{ \.kCell\.e5 \.kArt::before/.test(src));
ok('◆ 칸(enhDots) — 가방·장착·대장간·상점', (src.match(/enhDots\(/g) || []).length >= 6);
ok('이름표 ◆ — +4 이상, 키에 단계', /function setTag\(t, text, color, lv, bic, ee\)/.test(src) && /\(ee\|\|0\)/.test(body('setTag')));
/* ⑩ 화염 */
ok('1인칭 총구 화염 깊이 누르기(uVM)', /gl_Position\.z = mix\(gl_Position\.z, mix\(-gl_Position\.w, gl_Position\.z, 0\.02\), uVM\)/.test(src));
ok('화염이 든 총을 비춤 — 재질 반복 대신 uGunFlash 유니폼', /RUNE_U\.uGunFlash\.value\.copy\(flashMat\.color\)/.test(src) && !/for\(const m of gg\.mats\)/.test(src));
console.log(fail ? `${fail} failed, ${pass} passed` : `t69-enh-static: ${pass} passed`);
process.exitCode = fail ? 1 : 0;
