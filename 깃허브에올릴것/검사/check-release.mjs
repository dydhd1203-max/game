// Final release gate only. Development checks may run while source and copies differ.
// node check-release.mjs [--copy <Desktop/index.html>] [--report <report.json>]
// CI uses the same source/deploy check; optional copies verify files actually handed to players.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
let source=path.join(root,'클로드/index.html'),deploy=path.join(root,'클로드/배포용/index.html'),report;
const copies=[],args=process.argv.slice(2);
for(let i=0;i<args.length;i++){
  const a=args[i];
  if(a==='--help'){console.log('node check-release.mjs [--source file] [--deploy file] [--copy file ...] [--report file]');process.exit(0);}
  if(!['--source','--deploy','--copy','--report'].includes(a)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Unknown or incomplete argument: '+a);
  const value=path.resolve(args[++i]);if(a==='--source')source=value;else if(a==='--deploy')deploy=value;else if(a==='--copy')copies.push(value);else report=value;
}
function read(role,file){
  try{
    const bytes=fs.readFileSync(file),text=bytes.toString('utf8');
    return {role,path:path.resolve(file),bytes:bytes.length,version:text.match(/\b(?:const|let|var)\s+GAME_VER\s*=\s*(['"])([^'"\r\n]+)\1/)?.[2]??null,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  }catch(e){return {role,path:path.resolve(file),error:e.code||e.message};}
}
const files=[read('원본',source),read('배포용',deploy),...copies.map(file=>read('실행/전달 파일',file))],reference=files[0];
let passed=!reference.error&&!!reference.version;
for(const file of files){
  const same=!file.error&&!!file.version&&file.sha256===reference.sha256;passed=passed&&same;
  console.log(`[${same?'PASS':'FAIL'}] ${file.role}: ${file.path}\n  ${file.error||((file.version||'GAME_VER 없음')+' · '+file.sha256)}`);
}
if(report){fs.mkdirSync(path.dirname(report),{recursive:true});fs.writeFileSync(report,JSON.stringify({checkedAt:new Date().toISOString(),passed,files},null,2));}
if(!passed)console.error('배포 미완료: 원본과 다른 파일 또는 읽지 못한 파일이 있습니다. 검사를 마친 원본을 배포·실행 위치에 반영한 뒤 다시 확인하세요.');
else console.log(`Release copies match (${files.length} files).`);
process.exitCode=passed?0:1;
