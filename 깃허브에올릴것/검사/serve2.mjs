import http from 'http'; import fs from 'fs';
/* ★ three.js 는 이 폴더의 node_modules 에서 읽는다.
   예전엔 만든 사람 컴퓨터의 절대 경로가 박혀 있어서 다른 데선 안 돌았다. */
import path from 'path'; import { fileURLToPath } from 'url';
const SP = path.dirname(fileURLToPath(import.meta.url));
export function serve(port, file){
  return http.createServer((q,r)=>{
    /* ★ three 빌드 폴더를 통째로 내준다.
       예전엔 three.module.js 한 파일만 내줬는데, r160 이후의 three 는
       three.module.js 안에서 './three.core.js' 를 다시 부른다. 그 요청이 HTML 로 떨어져서
       "Expected a JavaScript module but got text/html" 로 페이지가 통째로 안 열렸다.
       파일 이름을 못 박지 말고 폴더를 내주면 three 버전이 바뀌어도 안 깨진다. */
    const tm = q.url.match(/^\/(three[\w.-]*\.js)(\?|$)/);
    if(tm){
      const f = SP+'/node_modules/three/build/'+tm[1];
      if(fs.existsSync(f)){ r.writeHead(200,{'Content-Type':'text/javascript'});
        return r.end(fs.readFileSync(f)); }
    }
    if(q.url.startsWith('/fb')){ r.writeHead(200,{'Content-Type':'text/javascript'}); return r.end(''); }
    let h = fs.readFileSync(file,'utf8')
      .replace('https://unpkg.com/three@0.160.0/build/three.module.js','/three.module.js')
      .replace(/https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+/g,'/fb.js');
    r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); r.end(h);
  }).listen(port);
}
