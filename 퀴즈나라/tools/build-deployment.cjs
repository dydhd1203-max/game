'use strict';
/* A complete, repeatable Cloudflare Pages / Netlify folder. No npm dependencies. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.join(root,'배포용');
const files=require('./deployment-files.cjs');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function verify(){
  const manifest=JSON.parse(fs.readFileSync(path.join(output,'배포정보.json'),'utf8'));
  assert.deepEqual(manifest.files.map(x=>x.path),files,'Rebuild: runtime file list has changed');
  for(const entry of manifest.files){
    const source=path.join(root,entry.path),copy=path.join(output,entry.path);
    assert(fs.statSync(copy).isFile(),'Missing release file: '+entry.path);
    assert.equal(sha(source),entry.sha256,'Rebuild: source changed: '+entry.path);
    assert.equal(sha(copy),entry.sha256,'Release differs from source: '+entry.path);
  }
  console.log('배포용: '+files.length+' files exactly match the latest source');
  return manifest;
}
function build(){
  // Validate the live project before copying; stale embedded avatar pixels must
  // never produce a successful deployment package.
  require('./check-source.cjs');
  fs.mkdirSync(output,{recursive:true});
  let previous;
  try{previous=JSON.parse(fs.readFileSync(path.join(output,'배포정보.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  for(const file of files){
    const target=path.join(output,file);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(path.join(root,file),target);
  }
  // Remove only files explicitly managed by our older deployment manifest.
  for(const entry of previous?.files||[]){
    if(files.includes(entry.path))continue;
    const target=path.resolve(output,entry.path);
    assert(target.startsWith(output+path.sep),'Invalid old release path');
    fs.rmSync(target,{force:true});
  }
  const manifest={project:'퀴즈나라',format:1,builtAt:new Date().toISOString(),
    instructions:'Cloudflare Pages 또는 Netlify 수동 배포에는 이 배포용 폴더 전체를 올리세요. index.html만 올리지 마세요.',
    files:files.map(file=>({path:file,bytes:fs.statSync(path.join(root,file)).size,sha256:sha(path.join(root,file))}))};
  fs.writeFileSync(path.join(output,'배포정보.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(output,'배포안내.txt'),
    '퀴즈나라 배포\n\nCloudflare Pages Direct Upload 또는 Netlify 수동 배포에는 이 폴더 전체를 올리세요.\n'+
    'index.html, JS, CSS, assets, _headers가 함께 있어야 합니다.\n'+
    '사용자 에셋 원본 ZIP과 개발·검수 도구는 배포본에 포함하지 않습니다.\n'+
    '업데이트 후 상위 퀴즈나라 폴더에서 node tools/build-deployment.cjs를 실행해 다시 만드세요.\n'+
    'node tools/build-deployment.cjs --check로 최신 원본과 일치하는지 확인합니다.\n'+
    'GitHub 자동 배포 설정은 상위 퀴즈나라 폴더의 배포안내.md를 참고하세요.\n');
  return verify();
}
if(require.main===module){if(process.argv.includes('--check'))verify();else build();}
module.exports={build,verify,output};
