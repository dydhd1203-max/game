/* 게임 파일이 어디 있나 — 검사마다 절대 경로를 박아 두면 폴더를 옮길 때 통째로 죽는다.
   (실제로 그랬다: '클로드/' 아래로 옮긴 뒤 t3~t12 가 전부 "파일 없음" 으로 안 돌았다.)
   argv 로 주면 그걸 쓰고, 안 주면 알 만한 자리를 차례로 찾는다. */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [
  path.join(HERE, '..', 'index.html'),            // 검사/ 옆
  path.join(HERE, '..', '..', '클로드', 'index.html'),
  path.join(HERE, '..', '..', 'index.html'),
];
export const GAME = (()=>{
  for(const c of CANDIDATES) if(fs.existsSync(c)) return c;
  return CANDIDATES[0];                            // 없으면 첫 후보 — 오류 메시지에 경로가 뜬다
})();
