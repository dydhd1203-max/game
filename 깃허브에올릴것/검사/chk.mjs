// Windows/Linux 공통 문법 검사: node chk.mjs [게임파일]
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { GAME } from './gamefile.mjs';
const file = process.argv[2] || GAME;
const html = fs.readFileSync(file, 'utf8');
const body = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!body) throw new Error('모듈 스크립트가 없습니다: ' + file);
console.log('module chars:', body.length);
const result = spawnSync(process.execPath, ['--check', '--input-type=module'], {input:body, encoding:'utf8'});
if(result.stdout) process.stdout.write(result.stdout);
if(result.stderr) process.stderr.write(result.stderr);
if(result.error) throw result.error;
if(result.status === 0) console.log('SYNTAX OK');
process.exitCode = result.status || 0;
