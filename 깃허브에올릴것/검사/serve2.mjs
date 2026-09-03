import http from 'http'; import fs from 'fs';
/* ★ three.js 는 이 폴더의 node_modules 에서 읽는다.
   예전엔 만든 사람 컴퓨터의 절대 경로가 박혀 있어서 다른 데선 안 돌았다. */
import path from 'path'; import { fileURLToPath } from 'url';
const SP = path.dirname(fileURLToPath(import.meta.url));
export function serve(port, file){
  return http.createServer((q,r)=>{
    if(q.url.startsWith('/three.module.js')){ r.writeHead(200,{'Content-Type':'text/javascript'});
      return r.end(fs.readFileSync(SP+'/node_modules/three/build/three.module.js')); }
    if(q.url.startsWith('/fb')){ r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(''); }
    let h = fs.readFileSync(file,'utf8')
      .replace('https://unpkg.com/three@0.160.0/build/three.module.js','/three.module.js')
      .replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+/g,'/fb.js');
    r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(h);
  }).listen(port);
}
