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
  't67-castle-static','t69-enh-static','t68-reload-static','t68-motion-static'];   // 70차 — 탄창·자동 재장전·총 다루기 모션
let failed=0;
async function check(name){
  try{
    const {stdout}=await run(process.execPath,[path.join(here,name+'.mjs'),game],
      {cwd:root,windowsHide:true,maxBuffer:4*1024*1024,timeout:180000});
    console.log('[PASS] '+name+' — '+stdout.trim().split(/\r?\n/).at(-1));
  }catch(e){failed++;console.error('[FAIL] '+name+'\n'+(e.stdout||'')+(e.stderr||e.message));}
}
// Source/CPU checks run in small batches; rendered checks never overlap.
for(let i=0;i<names.length;i+=3)await Promise.all(names.slice(i,i+3).map(check));
if(args.includes('--render')){await check('t54-view');await check('t56-build-view');await check('t57-character-view');await check('t62-motion-view');await check('t59-zombie-view');
  await check('t67-castle-walk');await check('t67-castle-zombie');
  await check('t69-enh');
  await check('t68-hand-view');}   // 70차 — 오른손잡이 손·부품 움직임·어깨 너머 가림   // 69차 강화 룬 빛 — 떨림·셰이더·유령 빛·강화 순간   // 67차 성곽 — 걷기·보물·좀비(다른 갈래가 합쳐지기 전 항목은 '대기')
console.log(failed?`${failed} check files failed.`:'All selected check files passed.');
process.exitCode=failed?1:0;
