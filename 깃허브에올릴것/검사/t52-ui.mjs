/* 밝은 UI 회귀검사 — 실제 창을 열고 배경/본문 대비·글자 굵기·넘침·선택 표시를 잰다. */
import { chromium } from './pw.mjs';
import { serve } from './serve2.mjs';
import { GAME } from './gamefile.mjs';
const srv = serve(+(process.argv[3] || 9252), process.argv[2] || GAME);
const browser = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const results=[],errors=[];
const ok=(name,pass,value='')=>results.push([name,!!pass,String(value)]);
try{
  const pg=await browser.newPage({viewport:{width:1366,height:768}});
  pg.on('pageerror',e=>errors.push(e.message));
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/',{waitUntil:'load',timeout:60000});
  await pg.waitForFunction('window.__READY===true',null,{timeout:60000});
  const title=await pg.evaluate(()=>{
    const q=s=>getComputedStyle(document.querySelector(s));
    return {bg:q('.card').backgroundColor,ink:q('.card').color,body:q('body').fontWeight,button:q('#bSolo').fontWeight,family:q('body').fontFamily};
  });
  ok('시작 카드는 밝고 본문은 남색이다',/255, 253, 247/.test(title.bg)&&/36, 63, 85/.test(title.ink),JSON.stringify(title));
  ok('한국어 고딕 본문 400·단추 600으로 굵기를 나눈다',title.family.includes('Noto Sans KR')&&title.body==='400'&&title.button==='600');
  await pg.focus('#iName');await pg.keyboard.press('Tab');
  const focus=await pg.evaluate(()=>({width:getComputedStyle(document.activeElement).outlineWidth,style:getComputedStyle(document.activeElement).outlineStyle}));
  ok('키보드로 이동한 입력칸에 초점 테가 보인다',parseFloat(focus.width)>=2&&focus.style==='solid',JSON.stringify(focus));
  await pg.fill('#iName','밤지킴이');
  await pg.locator('#bSolo').click();
  await pg.waitForFunction('window.__G.started===true',null,{timeout:60000});
  await pg.evaluate(()=>{window.__introDone();window.__XP.lv=15;window.__XP.pts=15;window.__paintHUD();});
  const hud=await pg.evaluate(()=>{
    const ids=['resBox','crystalWrap','dayBox'];
    return ids.map(id=>{const c=getComputedStyle(document.getElementById(id));return [id,c.backgroundColor,c.color,c.backdropFilter];});
  });
  ok('HUD 세 판은 밝고 흐림 효과가 없다',hud.every(x=>/255, 253, 247/.test(x[1])&&x[3]==='none'),JSON.stringify(hud));
  const slot=await pg.evaluate(()=>{const e=document.querySelector('.slot.on'),c=getComputedStyle(e);return {bg:c.backgroundColor,border:c.borderColor,shadow:c.boxShadow,weight:getComputedStyle(e.querySelector('.nm')).fontWeight};});
  ok('고른 도구는 민트 배경과 짙은 테로 구분한다',slot.bg==='rgb(217, 242, 231)'&&slot.border==='rgb(39, 135, 97)'&&slot.shadow.includes('inset'),JSON.stringify(slot));
  ok('작은 핫바 이름에는 굵은 글씨를 쓰지 않는다',+slot.weight<=500,slot.weight);
  const popupRows=await pg.evaluate(()=>{
    const lum=rgb=>rgb.map(v=>v/255).reduce((s,v,i)=>s+[.2126,.7152,.0722][i]*(v<=.04045?v/12.92:((v+.055)/1.055)**2.4),0);
    const rgb=s=>(s.match(/[\d.]+/g)||[]).map(Number);
    const bg=e=>{for(let n=e;n;n=n.parentElement){const c=rgb(getComputedStyle(n).backgroundColor);if(c.length&&(c.length<4||c[3]>.9))return c.slice(0,3);}return [255,253,247];};
    const out=[];
    for(const [name,fn] of [['스텟','__openStat'],['가방','__openKit'],['칭호','__openBadge'],['상점','__openShop'],['대장간','__openForge'],['농장','__openFarm'],['도움말','help']]){
      document.querySelectorAll('.pop.on').forEach(p=>p.classList.remove('on'));
      if(fn==='help')document.getElementById('bBook').click();else window[fn]();
      const pop=document.querySelector('.pop.on .popC');if(!pop){out.push({name,missing:true});continue;}
      const bad=[];
      for(const e of pop.querySelectorAll('*')){
        const cs=getComputedStyle(e),text=[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.nodeValue.trim()).join('').trim();
        if(!text||e.getClientRects().length===0||cs.visibility==='hidden'||+cs.opacity<.4||e.closest(':disabled'))continue;
        const a=lum(rgb(cs.color).slice(0,3)),b=lum(bg(e)),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        if(ratio<4.5)bad.push((e.className||e.tagName)+' '+text.slice(0,15)+' '+ratio.toFixed(2));
      }
      const c=getComputedStyle(pop);out.push({name,bg:c.backgroundColor,over:pop.scrollWidth-pop.clientWidth,bad});
    }
    document.querySelectorAll('.pop.on').forEach(p=>p.classList.remove('on'));
    return out;
  });
  for(const row of popupRows){
    ok(row.name+' 창이 크림 바탕으로 열린다',!row.missing&&row.bg==='rgb(255, 253, 247)',JSON.stringify(row));
    ok(row.name+' 창 본문 대비가 4.5:1 이상이다',!row.missing&&row.bad.length===0,row.bad?.slice(0,8).join(' / '));
    ok(row.name+' 창이 가로로 넘치지 않는다',!row.missing&&row.over<=1,row.over);
  }
  for(const [width,height] of [[1366,768],[1024,640],[820,500],[760,420]]){
    await pg.setViewportSize({width,height});
    const measure=await pg.evaluate(()=>{
      window.__openStat();const p=document.querySelector('#popStat .popC');
      const r=p.getBoundingClientRect(),over=p.scrollWidth-p.clientWidth;document.querySelectorAll('.pop.on').forEach(e=>e.classList.remove('on'));
      const d=document.getElementById('dock').getBoundingClientRect();
      return {over,inside:r.left>=-1&&r.right<=innerWidth+1,dock:d.left>=-1&&d.right<=innerWidth+1};
    });
    ok(width+'×'+height+' 스텟 창과 핫바가 화면 안에 들어간다',measure.over<=1&&measure.inside&&measure.dock,JSON.stringify(measure));
  }
  ok('브라우저 실행 오류가 없다',errors.length===0,errors.join(' | '));
}finally{await browser.close();srv.close();}
let failed=0;
for(const [name,pass,value] of results){if(!pass)failed++;console.log((pass?'  OK  ':'FAIL  ')+name+(value?' → '+value:''));}
console.log(failed?failed+'개 실패 / '+results.length+'항목':results.length+'항목 전부 통과');
process.exit(failed?1:0);
