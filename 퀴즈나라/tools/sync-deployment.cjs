const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),targets=[path.join(root,'퀴즈게임')];
if(process.argv.includes('--root-deployment'))targets.push(path.resolve(root,'..','퀴즈게임'));
const files=require('./deployment-files.cjs');
for(const target of targets)for(const file of files){
  const out=path.join(target,file);fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.copyFileSync(path.join(root,file),out);
}
console.log('퀴즈 배포 파일 '+files.length+'개를 '+targets.length+'개 배포 폴더의 최신 원본과 맞췄습니다.');
