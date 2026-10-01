/* Run against preview-server.cjs; all account writes use the isolated demo adapter. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const url=new URL(process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/');
  const previewURL=new URL('.',url).href;
  const suffix=decodeURIComponent(new URL('.',url).pathname).split('/').filter(Boolean).join('-');
  const out=path.resolve(__dirname,'../검증/로그인-포커스',suffix);fs.mkdirSync(out,{recursive:true});
  url.searchParams.set('demo','1');url.searchParams.set('role','login');url.searchParams.set('session','login-focus-'+Date.now());
  const checks=[],errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated login focus checks */',contentType:'text/javascript'}));
    // Keep QPDemo's local database but skip its automatic student entry so the
    // first rendered login page can be exercised without a production account.
    const marker="  addEventListener('DOMContentLoaded',async()=>{";
    await context.route('**/demo.js',async route=>{
      const response=await route.fetch();assert(response.ok(),'Demo adapter is missing from the tested preview path');
      const demo=await response.text();assert(demo.includes(marker),'Demo adapter boot marker is missing');
      await route.fulfill({response,body:demo.replace(marker,"  if(params.get('role')==='login') return;\n"+marker)});
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url.href);
    await page.waitForSelector('#lgId');
    const active=()=>page.evaluate(()=>document.activeElement.id);
    const pin=()=>page.locator('#lgDots').inputValue();
    const focus=()=>page.evaluate(()=>({active:document.activeElement.id,visible:[...document.querySelectorAll('#login :focus-visible')].map(n=>n.id),outline:getComputedStyle(document.activeElement).outlineStyle}));

    assert.equal(await active(),'lgId');
    await page.keyboard.type('kid12');assert.equal(await pin(),'');
    await page.keyboard.press('Tab');assert.equal(await active(),'lgDots');
    let state=await focus();assert.deepEqual(state.visible,['lgDots']);assert.equal(state.outline,'solid');
    await page.screenshot({path:path.join(out,'비밀번호-키보드포커스.png')});
    await page.keyboard.type('3456');assert.equal(await pin(),'3456');
    await page.keyboard.press('Tab');assert.equal(await active(),'lgGo');
    state=await focus();assert.deepEqual(state.visible,['lgGo']);
    await page.keyboard.type('9999');assert.equal(await pin(),'3456');
    await page.keyboard.press('Backspace');assert.equal(await pin(),'3456');
    await page.keyboard.press('Shift+Tab');assert.equal(await active(),'lgDots');
    await page.keyboard.press('End');await page.keyboard.press('Backspace');assert.equal(await pin(),'345');
    await page.keyboard.press('Shift+Tab');assert.equal(await active(),'lgId');
    assert.equal(await page.locator('#lgId').inputValue(),'kid12');
    checks.push('Cold entry focuses ID; Tab and Shift+Tab follow ID → password → entry button, and the visible focus ring matches the typing target');
    checks.push('ID digits and digits/Backspace while the entry button is focused do not change the password');

    await page.locator('#lgLab').click();assert.equal(await active(),'lgDots');
    assert.equal(await page.locator('#lgDots').getAttribute('type'),'password');
    await page.locator('#lgDots').fill('12ab');assert.equal(await pin(),'12');
    await page.locator('#lgDots').fill('1234');
    await page.locator('#lgPad button').filter({hasText:/^◀$/}).click();assert.equal(await active(),'lgDots');assert.equal(await pin(),'123');
    await page.locator('#lgPad button').filter({hasText:/^4$/}).click();assert.equal(await active(),'lgDots');assert.equal(await pin(),'1234');
    await page.locator('#lgPad button').filter({hasText:/^지움$/}).click();assert.equal(await pin(),'');assert.equal(await active(),'lgDots');
    checks.push('Clicking the password label focuses a masked numeric field; onscreen digits, erase and Backspace stay connected to that field');

    await page.locator('#lgId').fill('kid12');await page.locator('#lgId').press('Enter');assert.equal(await active(),'lgDots');
    await page.locator('#lgGo').click();assert.equal(await active(),'lgDots');assert.match(await page.locator('#lgMsg').innerText(),/숫자 4개/);
    await page.locator('#lgId').fill('');await page.locator('#lgGo').click();assert.equal(await active(),'lgId');
    checks.push('Enter on ID moves to password; invalid ID/password submission places focus on the field that needs correction');

    await page.locator('#lgNew').click();assert.equal(await active(),'lgId');
    await page.keyboard.type('focus12');assert.equal(await pin(),'');
    await page.keyboard.press('Enter');assert.equal(await active(),'lgDots');
    await page.keyboard.type('1234');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#lgLab').textContent==='한 번 더');assert.equal(await active(),'lgDots');assert.equal(await pin(),'');
    await page.keyboard.type('4321');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#lgMsg').textContent.includes('두 번이 서로 달라요'));assert.equal(await active(),'lgDots');assert.equal(await pin(),'');
    await page.keyboard.type('1234');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#lgLab').textContent==='한 번 더');
    await page.keyboard.type('1234');await page.keyboard.press('Enter');
    await page.waitForSelector('#mShop');assert.equal(await page.evaluate(()=>QPGame.getMe().name),'focus12');
    checks.push('Keyboard-only signup confirms the PIN twice, recovers from a mismatch, and opens the student lobby');

    await page.locator('#tbOut').click();await page.locator('#mOut').click();await page.waitForSelector('#lgId');
    assert.equal(await active(),'lgId');await page.keyboard.type('focus12');await page.keyboard.press('Enter');
    await page.keyboard.type('9999');await page.keyboard.press('Enter');
    await page.waitForFunction(()=>document.querySelector('#lgMsg').textContent.includes('비밀번호가 달라요'));assert.equal(await active(),'lgDots');assert.equal(await pin(),'');
    await page.keyboard.type('1234');await page.keyboard.press('Tab');assert.equal(await active(),'lgGo');await page.keyboard.press('Enter');
    await page.waitForSelector('#mShop');assert.equal(await page.evaluate(()=>QPGame.getMe().name),'focus12');
    checks.push('Logout returns to ID focus; a wrong PIN returns to password focus; Enter on the focused entry button signs in correctly');

    for(const viewport of [{width:1280,height:632},{width:1024,height:632}]){
      await page.setViewportSize(viewport);
      await page.evaluate(()=>{localStorage.removeItem('qz_login');QPGame.go('login');});
      await page.keyboard.press('Tab');assert.equal(await active(),'lgDots');
      const boxes=await page.evaluate(()=>['lgId','lgDots','lgGo'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
      assert(boxes.every(r=>r.x>=0&&r.y>=0&&r.right<=viewport.width&&r.bottom<=viewport.height),'Login controls must remain visible on notebook screens');
      assert(boxes[0].bottom<=boxes[1].y,'ID and password fields must not overlap');
      assert(boxes[0].right<=boxes[2].x&&boxes[1].right<=boxes[2].x,'Entry button must not cover either field');
      await page.screenshot({path:path.join(out,'비밀번호-포커스-'+viewport.width+'.png')});
    }
    checks.push('ID, password and entry button remain visible and separate at 1280×632 and 1024×632 notebook sizes');

    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'검사결과.json'),JSON.stringify({previewURL,checks,errors},null,2));
    console.log(JSON.stringify({previewURL,checks,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
