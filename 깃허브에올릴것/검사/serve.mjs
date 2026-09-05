/* 옛 검사들(t3·t4·t6)이 부르는 이름. 그것들은 `serve(포트)` 처럼 파일을 안 넘긴다 —
   그래서 여기서 게임 파일의 기본값을 채워 준다. 알맹이는 serve2.mjs 하나뿐이다.
   ★ 저장소에 이 파일이 빠져 있어서 t3·t4·t6 이 "모듈 없음" 으로 통째로 죽어 있었다.
     검사가 안 돌면 검사가 아니다. */
import { serve as serve2 } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
export function serve(port, file){ return serve2(port, file || process.argv[2] || GAME); }
