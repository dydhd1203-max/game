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
  't55-wardrobe-static','t54-combat-static','t54-race-static','t54-zombie-static'];
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
if(args.includes('--render'))await check('t54-view');
console.log(failed?`${failed} check files failed.`:'All selected check files passed.');
process.exitCode=failed?1:0;
