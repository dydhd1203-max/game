/* Real laptop shop controls and text, in an isolated local preview only. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../검증');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const categories=['expression','hair','top','bottom','shoes','hat','glass','face','ear','neck','back','pet','effect','bg','frame'];

(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  const results=[];
  try{
    for(const [width,height] of [[1024,768],[1280,720],[1366,768],[1860,900]]){
      const context=await browser.newContext({viewport:{width,height}});
      await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated shop readability QA */',contentType:'text/javascript'}));
      const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(new URL('?demo=1&user=상점검증&session=shop-readable-'+width+'-'+Date.now(),base).href);
      await page.waitForFunction(()=>window.QPGame&&QPGame.getMe()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready);
      await page.evaluate(()=>document.fonts.ready);
      await page.locator('.qp-demo-toolbar [data-shop]').click();
      await page.waitForSelector('#pvStage > svg');
      const tabs=await page.locator('#shTabs [data-c]').evaluateAll(nodes=>nodes.map(n=>{
        const r=n.getBoundingClientRect(),label=n.querySelector('span'),lr=label.getBoundingClientRect(),s=getComputedStyle(n);
        const blockers=[];let parent=n.parentElement;
        while(parent){const ps=getComputedStyle(parent),pr=parent.getBoundingClientRect();
          if(/hidden|clip|auto|scroll/.test(ps.overflowX)&&(r.left<pr.left-1||r.right>pr.right+1))blockers.push(parent.id||parent.className);
          if(/hidden|clip|auto|scroll/.test(ps.overflowY)&&(r.top<pr.top-1||r.bottom>pr.bottom+1))blockers.push(parent.id||parent.className);
          parent=parent.parentElement;
        }
        const points=[[r.left+3,r.top+r.height/2],[r.right-3,r.top+r.height/2],[r.left+r.width/2,r.top+3],[r.left+r.width/2,r.bottom-3],[r.left+r.width/2,r.top+r.height/2]];
        return {key:n.dataset.c,text:label.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},font:parseFloat(s.fontSize),inViewport:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,unobscured:points.every(([x,y])=>n.contains(document.elementFromPoint(x,y))),blockers,labelFits:lr.left>=r.left&&lr.right<=r.right&&lr.top>=r.top&&lr.bottom<=r.bottom};
      }));
      assert.deepEqual(tabs.map(t=>t.key),categories,'All fifteen public categories must appear in order');
      for(const tab of tabs){assert(tab.inViewport&&tab.unobscured&&tab.labelFits&&!tab.blockers.length,'Category must be fully visible and clickable: '+JSON.stringify({width,...tab}));assert(tab.font>=14,'Category text must remain at least 14px: '+JSON.stringify({width,...tab}));}

      const texts=await page.locator('.qp-village-shop :is(.nm2,.pr,.shop-info-title,.shop-detail-price,.pnl-h,.shop-fitting-controls .btn,.qp-shop-switch .tab,#shTabs .tab)').evaluateAll(nodes=>nodes.filter(n=>n.textContent.trim()).map(n=>{
        const s=getComputedStyle(n);return {text:n.textContent.trim(),font:parseFloat(s.fontSize),stroke:parseFloat(s.webkitTextStrokeWidth)||0,shadow:s.textShadow,clipped:n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1};
      }));
      for(const text of texts){assert(text.font>=14&&text.stroke===0&&text.shadow==='none'&&!text.clipped,'Shop text must have readable unoutlined letters and enough space: '+JSON.stringify({width,...text}));}

      // Keyboard focus and activation must work on the actual category controls.
      const topTab=page.locator('#shTabs [data-c="top"]');await page.keyboard.press('Tab');await topTab.focus();
      const focus=await topTab.evaluate(n=>{const s=getComputedStyle(n);return {active:document.activeElement===n,visible:n.matches(':focus-visible'),outline:s.outlineStyle,outlineWidth:parseFloat(s.outlineWidth)};});
      assert(focus.active&&focus.visible&&focus.outline!=='none'&&focus.outlineWidth>0,'Keyboard focus must visibly identify the category control: '+JSON.stringify({width,focus}));
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#shTabs [data-c="top"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#shTabs [aria-pressed="true"]').count(),1);
      assert.equal(await page.locator('#shGrid [data-id]').count(),14);
      const first=page.locator('#shGrid [data-id]').first(),firstId=await first.getAttribute('data-id');
      await first.click();
      assert.equal(await page.locator('#shGrid [data-id="'+firstId+'"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#shGrid [aria-pressed="true"]').count(),1);
      assert.equal(await page.locator('#pvStage [data-qpc-category="top"]').count(),1,'Selecting a garment must show the actual painted fitting preview');
      const detail=await page.locator('#shInfo :is(.shop-info-title,.shop-detail-price,.btn)').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n);return {text:n.textContent.trim(),font:parseFloat(s.fontSize),stroke:parseFloat(s.webkitTextStrokeWidth)||0,shadow:s.textShadow};}));
      for(const text of detail)assert(text.font>=14&&text.stroke===0&&text.shadow==='none','Selected product name, price and action must remain readable: '+JSON.stringify({width,...text}));
      const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth+1,shop:document.querySelector('.qp-village-shop').getBoundingClientRect().right>innerWidth+1}));
      assert(!overflow.document&&!overflow.shop,'The shop must fit the laptop viewport without horizontal overflow: '+JSON.stringify({width,overflow}));
      await page.screenshot({path:path.join(out,'상점-가독성-'+width+'.png')});
      await page.locator('#shTabs [data-c="hat"]').click();await page.locator('#shGrid [data-none]').click();
      const beforeNone=await page.evaluate(()=>JSON.parse(JSON.stringify(QPGame.getMe())));
      await page.locator('#shPal button[data-i="6"]').click();
      assert.equal(await page.locator('#shInfo .shop-info-title').textContent(),'안 쓰기','Selecting a colour after the removable-item tile must keep the empty preview');
      assert.equal(await page.locator('#btnWear').textContent(),'벗기');
      const afterNone=await page.evaluate(()=>JSON.parse(JSON.stringify(QPGame.getMe())));
      assert.deepEqual(afterNone.av,beforeNone.av);assert.deepEqual(afterNone.owned,beforeNone.owned);assert.equal(afterNone.gold,beforeNone.gold);
      await page.evaluate(()=>QPGame.go('login'));await page.locator('#lgId').fill('학생 이름');
      await page.locator('#lgId').press('Home');await page.locator('#lgId').press('Shift+ArrowRight');await page.locator('#lgId').press('Shift+ArrowRight');
      const selectable=await page.locator('#lgId').evaluate(input=>({style:getComputedStyle(input).userSelect,focus:document.activeElement===input,start:input.selectionStart,end:input.selectionEnd}));
      assert(selectable.focus&&selectable.start===0&&selectable.end===2&&selectable.style!=='none','The actual student-name input must keep keyboard selection');
      assert.deepEqual(errors,[]);results.push({width,height,tabs,texts,detail,focus,selectable,overflow,noneColourSafe:true,errors});
      await context.close();
    }
    fs.writeFileSync(path.join(out,'상점-가독성-검증.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results.map(r=>({width:r.width,height:r.height,categories:r.tabs.length,plainTextChecks:r.texts.length+r.detail.length,keyboardFocus:r.focus,errors:r.errors})),null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
