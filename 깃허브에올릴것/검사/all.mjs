// Windows/Linux 공통 전체 판. 목록과 합계는 all.sh 한 곳에서 읽는다.
// node all.mjs [게임파일] [동시개수=4] [시작포트]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { GAME } from './gamefile.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const config = fs.readFileSync(path.join(here, 'all.sh'), 'utf8');
const tests = config.match(/^TESTS="([^"]+)"/m)[1].split(/\s+/);
const expected = Number(config.match(/^ALL=(\d+)/m)[1]);
const file = path.resolve(process.argv[2] || GAME);
const jobs = Number(process.argv[3] || 4);
const base = Number(process.argv[4] || (20000 + Math.floor(Math.random()*20000)));
if(!Number.isInteger(jobs) || jobs < 1 || jobs > 16) throw new Error('동시개수는 1~16이어야 합니다.');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'zombie-tests-'));
console.log('검사 기록:', out);
const results = new Map();
let next = 0;
async function worker(){
  while(next < tests.length){
    const i = next++, test = tests[i], log = path.join(out, test+'.log');
    const fd = fs.openSync(log, 'w');
    const code = await new Promise(resolve=>{
      const child = spawn(process.execPath, [test+'.mjs', file, String(base+(i+1)*7)], {cwd:here, stdio:['ignore',fd,fd], windowsHide:true});
      child.on('error', error=>{ fs.writeSync(fd, String(error)); resolve(-1); });
      child.on('exit', code=>resolve(code ?? -1));
    });
    fs.closeSync(fd);
    const text = fs.readFileSync(log, 'utf8');
    const ok = (text.match(/^  OK  /gm)||[]).length;
    const bad = (text.match(/^FAIL|^  ✗ /gm)||[]).length;
    results.set(test, {ok,bad,code});
    if(bad || code !== 0 || ok+bad === 0){
      console.log(`${test}: ${ok+bad}항목 · 실패 ${bad} · 종료 ${code}`);
      console.log(bad ? text.split(/\r?\n/).filter(line=>/^FAIL|^  ✗ /.test(line)).join('\n') : text.split(/\r?\n/).slice(-10).join('\n'));
    }
  }
}
await Promise.all(Array.from({length:jobs}, ()=>worker()));
const values = [...results.values()];
const total = values.reduce((n,r)=>n+r.ok+r.bad, 0);
const failures = values.reduce((n,r)=>n+r.bad, 0);
// 실패한 assertion 때문에 exit 1인 검사는 실패 칸에서 이미 센다.
const errors = values.filter(r=>(r.code !== 0 && r.bad === 0) || r.ok+r.bad === 0).length;
console.log(`합계 ${total}항목 · 실패 ${failures} · 실행 오류 ${errors} · 동시 ${jobs}개`);
if(total !== expected) console.log(`항목이 ${expected}개여야 합니다 (${expected-total}개 모자람).`);
console.log('자세한 기록:', out);
process.exitCode = total === expected && failures === 0 && errors === 0 ? 0 : 1;
