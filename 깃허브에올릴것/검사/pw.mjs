/* ═══ 검사용 브라우저를 여는 자리 한 곳 (49차d) ═══
   ⚠️ 왜 이 파일이 생겼나 — **옛 headless_shell 로 띄우면 게임 페이지가 메모리를 계속 먹었다.**
   48차부터 전체 판이 3분 반이면 OOM 으로 죽어서 검사를 못 돌렸다. 49차d 에 원인을 찾았다:

     · 시작 화면은 안 샌다. 게임에 들어가면 샌다.
     · requestAnimationFrame 을 막아 **한 프레임도 안 그려도** 계속 샌다 → 그리기 코드 탓이 아니다.
     · JS 는 아무것도 안 만든다(setTimeout·DOM·오디오 노드·three 객체·힙 전부 평평).
     · GPU 프로세스는 평평하고 **렌더러와 브라우저 프로세스의 익명 메모리**가 자란다.
       Performance 지표로는 20초 중 10초가 'TaskOther'(스크립트·레이아웃·스타일 0), ProcessTime 25초
       → 래스터 스레드가 계속 돈다.
     · **WebGL 캔버스를 DOM 에서 빼면 딱 멎는다.** 감추기·1×1 로 줄이기·컨텍스트 버리기·dispose 는
       소용없고, 나머지 캔버스 넷(pvw·mini·jobShot·kitPvw)을 빼도 소용없다.
     · 최소 three 페이지(인스턴스 2000개)는 같은 브라우저에서 **안 샌다** → 브라우저만의 탓도 아니다.

   고친 방법: **새 헤드리스(진짜 크롬, channel:'chromium')로 띄운다.** 같은 판에서 잰 값 —

       옛 headless_shell   87.8 MB/s ·  0.2fps
       새 헤드리스          -1.2 MB/s ·  2.9fps      ← 안 새고 14배 빠르다

   쓰는 법: 검사 파일들은 playwright 를 직접 부르지 말고 여기서 가져온다.
       import { chromium } from './pw.mjs';
   옛날 방식으로 돌려 보고 싶으면  PW_CHANNEL=off  를 앞에 붙인다. */
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

/* 지정한 설치본 → 저장소 설치본 → 번들 → 예전 Linux 환경 순서로 찾는다.
   게임 파일에는 의존성을 더하지 않고 검사에서만 쓰는 Playwright 다. */
const candidates = [
  process.env.PW_MODULE,
  'playwright',
  path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'),
  '/opt/node22/lib/node_modules/playwright/index.mjs'
].filter(Boolean);
let playwright;
for(const candidate of candidates){
  try{
    playwright = await import(path.isAbsolute(candidate) ? pathToFileURL(candidate).href : candidate);
    break;
  }catch(e){
    if(candidate === process.env.PW_MODULE) throw e;
    if(e.code !== 'ERR_MODULE_NOT_FOUND' && e.code !== 'MODULE_NOT_FOUND') throw e;
  }
}
if(!playwright) throw new Error('Playwright를 찾지 못했습니다. npm i -D playwright 또는 PW_MODULE=<index.mjs 절대 경로>를 사용하세요.');
const pw = playwright.chromium;
const CHANNEL = process.env.PW_CHANNEL;

// 자동 검사가 운영체제 커서를 잡지 못하게 한다. 페이지가 시작/클릭에서 요청하더라도
// 실제 pointer lock은 일어나지 않으며, 사용자의 마우스는 검사와 독립적으로 남는다.
function protectBrowser(browser){
  const guarded = new WeakSet();
  const protectContext = async context=>{
    if(!guarded.has(context)){
      await context.addInitScript(()=>{
        Element.prototype.requestPointerLock = function(){ return Promise.resolve(); };
      });
      guarded.add(context);
    }
    return context;
  };
  const newContext=browser.newContext.bind(browser), newPage=browser.newPage.bind(browser);
  browser.newContext=async options=>protectContext(await newContext(options));
  browser.newPage=async options=>{ const page=await newPage(options); await protectContext(page.context()); return page; };
  return browser;
}

async function launch(opts = {}){
  opts = {...opts, headless:true};
  /* Windows의 최신 Chrome은 옛 --use-gl=swiftshader 경로에서 고품질 그림자의
     WebGL 컨텍스트를 잃는다. 같은 소프트웨어 렌더러를 ANGLE 경로로 선택한다.
     Linux 검사 환경의 기존 GL 설정은 그대로 둔다. */
  if(process.platform === 'win32' && opts.args?.includes('--use-gl=swiftshader')){
    const args = opts.args.filter(arg=>arg !== '--use-gl=swiftshader');
    if(!args.some(arg=>arg.startsWith('--use-angle='))) args.push('--use-angle=swiftshader');
    opts = {...opts, args};
  }
  if(process.env.PW_EXECUTABLE_PATH) return protectBrowser(await pw.launch({...opts, executablePath:process.env.PW_EXECUTABLE_PATH}));
  if(CHANNEL === 'off' || opts.executablePath) return protectBrowser(await pw.launch(opts));
  const channels = CHANNEL ? [CHANNEL] : ['chromium', 'chrome', 'msedge'];
  let lastError;
  for(const channel of channels){
    try{ return protectBrowser(await pw.launch({...opts, channel})); }
    catch(e){ lastError = e; }
  }
  {
    /* 그 채널이 안 깔린 기계도 있다 — 그러면 옛 방식으로 그냥 돈다(느리고 새지만 돌기는 한다) */
    if(!launch.warned){ launch.warned = true;
      console.log('[pw.mjs] channel=' + channels.join('/') + ' 로 못 띄웠다 — 옛 headless_shell 로 간다: ' + String(lastError).slice(0, 90)); }
    return protectBrowser(await pw.launch(opts));
  }
}

export const chromium = new Proxy(pw, {
  get(t, k){
    if(k === 'launch') return launch;
    const v = t[k];
    return typeof v === 'function' ? v.bind(t) : v;
  }
});
