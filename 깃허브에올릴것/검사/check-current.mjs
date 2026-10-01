// Current, focused checks with compact output and at most one hidden browser.
// node check-current.mjs [game.html] [--render]
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {GAME} from './gamefile.mjs';
const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..'),args=process.argv.slice(2);
const game=path.resolve(args.find(a=>!a.startsWith('--'))||GAME);
const names=['chk','input52-static','t53-static','t54-avatar-static','t53-shop-static',
  't55-wardrobe-static','t54-combat-static','t54-race-static','t54-zombie-static',
  't56-buildings-static','t56-building-combat-static','t56-build-assist-static','t56-build-coop-static',
  't57-avatar-geometry-static','t57-motion-static','t57-render-static','t58-job-art-static','t58-motion-static',
  't59-zombie-shape-static','t59-zombie-attachment-static','t60-zombie-wrap-static','t61-avatar-clearance-static',
  't65-weapons-static',
  't66-hud-static','t66-fx2-static','t66-spec-static','t66-wing-static','t66-sound-static','t66-ctrl-static',
  't67-castle-static','t69-enh-static','t68-reload-static','t68-motion-static','t73-network-static','t76-race-network-static','t76-wall-orientation-static',
  't77-grass-static','t77-job-fx-static','t77-wing-motion-static','t77-race-toys-static','t77-candy-static','t77-race-continuity-static','t77-race-camera-static','t77-tower-static','t77-zombie-balance-static','t78-zombie-art-static','t78-lobby-reset-static','t82-race-chute-static','t82-race-jump-audio-static',
  't79-build-idle-static','t79-donut-art-static','t79-market-art-static','t79-merchant-static','t79-race-physics-static','t79-tower-audio-static','t79-reload-audio-static','t79-bgm-static','t79-build-audio-static','t79-zombie-stairs-static','t79-hit-feedback-static','t79-shoulder-static','t79-shoulder-fx-static','t79-controls-static'];
let failed=0;
async function check(name){
  try{
    const {stdout}=await run(process.execPath,[path.join(here,name+'.mjs'),game],
      {cwd:root,windowsHide:true,maxBuffer:4*1024*1024,timeout:name==='t73-performance'?600000:240000,env:{...process.env,T67_STRICT:'1'}});
    console.log('[PASS] '+name+' — '+stdout.trim().split(/\r?\n/).at(-1));
  }catch(e){failed++;console.error('[FAIL] '+name+'\n'+(e.stdout||'')+(e.stderr||e.message));}
}
// Source/CPU checks run in small batches; rendered checks never overlap.
if(!args.includes('--browser-smoke'))for(let i=0;i<names.length;i+=3)await Promise.all(names.slice(i,i+3).map(check));
if(args.includes('--browser-smoke') || args.includes('--render')){
  await check('t73-classroom');await check('t73-performance');
  await check('t74-race-view');
  await check('t75-race-playview'); // Actual start camera + every section, not only an overview/clear route.
  await check('t82-chute-camera-view'); // 82차: actual game-loop camera stays outside the U roller coaster and its candies at 30/60/120 Hz; live ride reaches the kicker's landing.
  await check('t76-wall-view'); // All five gates: preview, plan, completion, upgrade and move.
  await check('t78-lobby-view'); // Waiting clock, shared dressing, teacher start and five-second story.
  await check('t78-lobby-network'); // Real room listeners with a local Firebase mock, no production writes.
  await check('t82-rejoin-group-network'); // 82차: reload/rejoin enters the team picked on the entry screen (lobby, mid-game, new lesson); old team keeps its resources.
  await check('t79-entry-view'); // Entry fields, front-facing wardrobe and renderer reuse on desktop/mobile.
  await check('t79-cosmetic-view'); // Shared geometry for nine new cosmetics and all six job outfits.
  await check('t79-build-unstick-view'); // Actual movement after building over the player, including walls and ice towers.
  await check('t79-npc-cull-view'); // Offscreen merchants stop drawing, then restore when players return to the village.
  await check('t79-zombie-stairs-view'); // Real host simulation: stair pillars, ground pursuit, climbing and placed walls.
  await check('t79-hit-feedback-view'); // Real stone arrival, gun impacts, recoil and guest flash recovery.
  await check('t79-shoulder-view'); // Curved promotion armor, arm clearance and a fixed 21-player rendering budget.
  await check('t79-combat-hud-view'); // Actual health/ammo state, reload progress and small-screen layout.
  await check('t81-shadow-view'); // 81차: shadow-pass order keeps the shadow map and screen byte-identical; ?diag Shift+9 restores every toggle.
}
if(args.includes('--browser-smoke')){await check('t72-hand-grip');await check('t71-castle-shot');}
if(args.includes('--render')){await check('t54-view');await check('t56-build-view');await check('t57-character-view');await check('t62-motion-view');await check('t59-zombie-view');
  await check('t67-castle-walk');await check('t67-castle-zombie');   // 67차 성곽 — 걷기·보물·좀비(다른 갈래가 합쳐지기 전 항목은 '대기')
  await check('t69-enh');   // 69차 강화 룬 빛 — 떨림·셰이더·유령 빛·강화 순간
  await check('t70-castle-teach');   // 70차 2회차 — 선생님 새 요청(나선 손잡이·넓히기·낮은 턱·계단 몸·좀비 계단 벽) · 든 것 VM_Z(C1 픽셀)
  await check('t71-castle-shot');   // 71·72차 — 성벽 총알 규칙 · 몸 내밀어 쏘기·카메라
  await check('t68-hand-view');await check('t71-hand-fix');
  await check('t72-hand-grip');}   // 72차 — 손가락으로 쥔다(C 입이 쥔 부품 쪽 · 1인칭·3인칭·친구) · 꺼내기 첫 컷 · 새총·활 놓은 손   // 총 다루기 70차 — 오른손잡이 손·부품 움직임·어깨 너머 가림 · 71차 — 새총 조준점 비움·강궁 화살통 길·장전 손잡이·탄 보이기·지렛대·팔뚝 굴림·노리쇠 손·3인칭 활·터치 재장전
console.log(failed?`${failed} check files failed.`:'All selected check files passed.');
process.exitCode=failed?1:0;
