// Firebase 없는 로컬 미리보기. '혼자 하기'로 시작한 뒤 window.__* 훅으로 검사한다.
import path from 'node:path';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const file = path.resolve(process.argv[2] || GAME);
const port = Number(process.argv[3] || 8900);
const server = serve(port, file);
server.on('listening', ()=>console.log(`Local QA: http://127.0.0.1:${port}/?diag=1\nGame: ${file}\nFirebase disabled by test server.`));
