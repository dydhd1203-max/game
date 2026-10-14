/* Operator (운영자) account: real login form, 운영자 tab, operator screen, quiz builder and 학생 관리,
   with isolated local demo storage (?demo=1). Never writes to Firebase and never moves the mouse. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  const checks=[],errors=[],geometry=[];
  const url=new URL(process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/');
  const suffix=decodeURIComponent(new URL('.',url).pathname).split('/').filter(Boolean).join('-');
  const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(__dirname,'../검증/운영자-관리'),suffix);fs.mkdirSync(out,{recursive:true});
  url.searchParams.set('demo','1');url.searchParams.set('session','operator-management-'+Date.now());
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated operator checks */',contentType:'text/javascript'}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
    await page.goto(url.href);await page.waitForFunction(()=>window.QPGame&&QPGame.getMe());
    assert.equal(await page.locator('#tbAdmin').count(),0,'A student must not see the 운영자 tab');
    await page.evaluate(()=>{localStorage.removeItem('qz_login');QPGame.go('login');});await page.waitForSelector('#lgId');
    assert.equal(await page.locator('#lgT').count(),0,'The separate 선생님 들어가기 button is removed');
    const login=async(id,pin)=>{await page.fill('#lgId',id);await page.fill('#lgDots',pin);await page.click('#lgGo');};
    await login('선생님','0000');await page.waitForFunction(()=>/비밀번호가 달라요/.test(document.getElementById('lgMsg').textContent));
    assert.equal(await page.evaluate(async()=>(await QPDemo.db.ref('quiz/users/선생님').once()).val()),null,'A wrong PIN must not create the operator record');
    await page.click('#lgNew');await login('선생님','1234');await page.waitForFunction(()=>/쓸 수 없어요/.test(document.getElementById('lgMsg').textContent));
    await page.click('#lgNew');
    checks.push('Login form has no 선생님 button; the operator id refuses a wrong PIN and refuses sign-up');

    await login('선생님','1362');await page.waitForSelector('#tbAdmin');
    const record=await page.evaluate(async()=>(await QPDemo.db.ref('quiz/users/선생님').once()).val());
    assert.equal(record.gold,0);assert.equal(record.pin,await page.evaluate(()=>window.ADMIN_PIN_HASH));assert.equal(record.pinView,undefined);assert(record.av&&record.av.hair);
    assert.equal(await page.evaluate(()=>QPGame.getMe().k),'선생님');
    assert.equal(await page.locator('#tbAdmin').innerText(),'운영자');
    assert.equal(await page.locator('#tbQuiz').count(),1,'The operator plays the game like a student (QUIZQUIZ button present)');
    await page.waitForTimeout(800);await page.screenshot({path:path.join(out,'운영자-게임-위쪽띠.png')});
    checks.push('Correct PIN creates a normal user record (gold 0, avatar, no visible PIN) and enters the village with the 운영자 tab');

    await page.click('#tbAdmin');await page.waitForSelector('.teacher-library');await page.evaluate(()=>document.fonts.ready);
    const oldBank=await page.evaluate(async()=>(await QPDemo.db.ref('quiz/bank').once()).val());
    assert.match(await page.locator('.teacher-top .nm').innerText(),/^운영자 화면 — /);
    assert.deepEqual(await page.locator('.teacher-top .tabs [data-t]').evaluateAll(nodes=>nodes.map(n=>n.dataset.t)),['quizzes','kids']);
    assert.equal(await page.locator('.teacher-top [data-t="make"]').count(),1);assert.equal(await page.locator('#tQuizQuiz').count(),1);
    assert.equal(await page.locator('#tBack').count(),1);assert.equal(await page.locator('.teacher-top #tbOut').count(),0);
    for(const old of ['classroom','live','legacy','fash'])assert.equal(await page.locator('.teacher-top [data-t="'+old+'"]').count(),0);
    assert.equal(await page.locator('[data-launch],[data-quiz-mode]').count(),0,'수업 열기·혼자 풀기·놀이 방식 controls are removed');
    assert.equal(await page.locator('.teacher-quiz-card').count(),Object.keys(oldBank).length);
    assert.equal(await page.locator('#teacherQuizCount').innerText(),Object.keys(oldBank).length+'개 퀴즈');
    await page.locator('#teacherQuizSearch').fill('OX');assert.equal(await page.locator('.teacher-quiz-card').count(),1);assert.equal(await page.locator('#teacherQuizCount').innerText(),'1개 퀴즈');
    await page.locator('#teacherQuizSearch').fill('없는 제목');assert.equal(await page.locator('.teacher-quiz-card').count(),0);
    await page.locator('#teacherQuizSearch').fill('');
    await page.screenshot({path:path.join(out,'운영자-화면-내퀴즈.png')});
    checks.push('운영자 tab opens the operator screen: 내 퀴즈 (search/count) and 학생 관리 tabs, 새 퀴즈 만들기, QUIZQUIZ 방, 돌아가기; class tabs and launch buttons are gone');

    await page.locator('.teacher-top [data-t="make"]').click();await page.waitForSelector('.qpb-builder');
    assert.equal(await page.locator('.qpb-stepbar,.qpb-mode-chip,.qpb-mode-card,[data-class-mode]').count(),0,'Builder opens directly at question editing');
    const title='운영자 저장·재사용 검수';
    await page.locator('[data-field="title"]').fill(title);
    await page.locator('.qpb-sidebar [data-add="choice"]').click();
    await page.locator('[data-field="q"]').fill('숲속 마을의 우리 반은 몇 반인가요?');
    await page.locator('[data-field="a"]').fill('3반');
    for(const [row,value] of ['1반','2반','4반'].entries())await page.locator('[data-field="choice"][data-row="'+row+'"]').fill(value);
    await page.locator('.qpb-sidebar [data-add="short"]').click();
    await page.locator('[data-field="q"]').fill('영어 알파벳 15번째 글자는?');await page.locator('[data-field="a"]').fill('O');
    await page.locator('[data-field="aliases"]').fill('o, 오');
    await page.screenshot({path:path.join(out,'운영자-새퀴즈-편집.png')});
    await page.locator('.qpb-toolbar [data-action="save"]').click();await page.waitForFunction(()=>document.querySelector('[data-save-state]')?.classList.contains('is-saved'));
    const saved=await page.evaluate(async t=>{const bank=(await QPDemo.db.ref('quiz/bank').once()).val();return Object.entries(bank).find(([,s])=>s.title===t);},title);
    assert(saved);const [setId,set]=saved;assert.equal(set.qs.length,2);assert.equal(set.qs[1].type,'short');assert.equal(set.qs[1].a,'O');
    await page.locator('[data-field="q"]').fill('수정한 알파벳 15번째 글자는?');
    await page.locator('.qpb-toolbar [data-action="next"]').click();await page.waitForSelector('.teacher-library');
    assert.equal(await page.locator('.teacher-top [data-t="quizzes"]').getAttribute('aria-current'),'page');
    assert.equal(await page.locator('.teacher-quiz-card').count(),Object.keys(oldBank).length+1);
    const card=page.locator('.teacher-quiz-card[data-quiz="'+setId+'"]');
    await card.locator('[data-edit]').click();await page.waitForSelector('.qpb-builder');
    assert.equal(await page.locator('[data-field="title"]').inputValue(),title);
    await page.locator('[data-select="1"]').click();assert.equal(await page.locator('[data-field="q"]').inputValue(),'수정한 알파벳 15번째 글자는?');
    assert.equal(await page.locator('[data-field="aliases"]').inputValue(),'o, 오');
    await page.locator('.qpb-back').click();await page.waitForSelector('.teacher-library');
    const after=await page.evaluate(async()=>(await QPDemo.db.ref('quiz/bank').once()).val());
    for(const [id,original] of Object.entries(oldBank))assert.deepEqual(after[id],original,'Existing question bank must not be overwritten: '+id);
    const qq=await page.evaluate(id=>({list:QPGame.getBank()[id]&&QPGame.getBank()[id].qs.length}),setId);assert.equal(qq.list,2);
    checks.push('새 퀴즈 만들기 opens the builder at question editing; 저장 and 저장하고 내 퀴즈로 save to quiz/bank and return to 내 퀴즈; 문제 수정 reopens the saved set; other sets untouched');

    await page.evaluate(async()=>{
      for(const [key,name,gold] of [['operator_qa_a','관리 학생 가',100],['operator_qa_b','관리 학생 나',200]])await QPDemo.db.ref('quiz/users/'+key).set({name,pin:'qa-pin',pinView:'1111',gold,av:QPGame.newAvatar(),owned:{},stat:{solved:2,correct:1},day:{}});
    });
    await page.locator('.teacher-top [data-t="kids"]').click();await page.waitForSelector('#kBox [data-pin]');
    assert.equal(await page.locator('#kAdminPin').count(),0,'The old 운영자 비밀번호 setting is removed');
    assert.equal(await page.locator('#kBox [data-pin="선생님"]').count(),0,'The operator account is not listed among students');
    page.on('dialog',d=>d.type()==='prompt'?d.accept('50'):d.accept());
    await page.locator('#kBox [data-pin="operator_qa_a"]').click();
    await page.waitForFunction(async()=>(await QPDemo.db.ref('quiz/users/operator_qa_a/pinView').once()).val()==='0000');
    await page.locator('#kBox [data-gold="operator_qa_b"]').click();
    await page.waitForFunction(async()=>(await QPDemo.db.ref('quiz/users/operator_qa_b/gold').once()).val()===250);
    await page.waitForSelector('#kBox [data-del="operator_qa_a"]');
    await page.locator('#kBox [data-del="operator_qa_a"]').click();
    await page.waitForFunction(async()=>(await QPDemo.db.ref('quiz/users/operator_qa_a').once()).val()===null);
    await page.screenshot({path:path.join(out,'운영자-학생관리.png')});
    checks.push('학생 관리 resets a PIN to 0000, gives gold and deletes an account; the operator itself is not listed');

    for(const viewport of [{width:1860,height:900},{width:1366,height:768},{width:1280,height:632},{width:1024,height:632}]){
      await page.setViewportSize(viewport);
      const views=[];
      for(const [nav,selector,name] of [['quizzes','.teacher-library','내퀴즈'],['make','.qpb-builder','새퀴즈'],['kids','#kBox [data-gold]','학생관리']]){
        await page.locator('.teacher-top [data-t="'+nav+'"]').click();await page.waitForSelector(selector);
        const dimensions=await page.evaluate(()=>{
          const controls=[...document.querySelectorAll('.teacher-top [data-t],.teacher-top #tBack,.teacher-top #tQuizQuiz')].map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom,font:parseFloat(getComputedStyle(n).fontSize)};});
          return {docWidth:document.documentElement.scrollWidth,controls};
        });
        assert(dimensions.docWidth<=viewport.width+1,'Operator document overflow '+name+' '+viewport.width);
        assert(dimensions.controls.every(r=>r.x>=0&&r.y>=0&&r.right<=viewport.width+1&&r.bottom<=viewport.height),'Operator navigation clipped '+name+' '+viewport.width+' '+JSON.stringify(dimensions.controls));
        views.push({name,...dimensions});
      }
      geometry.push({viewport,views});
    }
    await page.setViewportSize({width:1366,height:768});
    checks.push('Operator navigation fits 1860, 1366, 1280 and 1024 PC widths without horizontal overflow');

    await page.locator('#tBack').click();await page.waitForSelector('#tbAdmin');
    assert.equal(await page.evaluate(()=>!!QPGame.getVillage()),true,'돌아가기 returns to the game (village)');
    await page.locator('#tbQuiz').click();await page.waitForSelector('.qq-root');await page.waitForSelector('#tbBack');
    await page.locator('#tbBack').click();await page.waitForFunction(()=>!!QPGame.getVillage());
    checks.push('돌아가기 returns to the village; the operator QUIZQUIZ back button also returns to the game');

    const reload=await context.newPage();reload.on('pageerror',e=>errors.push(e.message));
    await reload.goto(url.href.replace(/([?&])demo=1/,'$1demo=1&role=admin'));await reload.waitForSelector('#tbAdmin');
    assert.equal(await reload.evaluate(()=>QPGame.getMe().k),'선생님');await reload.close();
    checks.push('Demo role=admin enters the same operator account with the 운영자 tab');
    assert.deepEqual(errors,[]);const result={previewURL:new URL('.',url).href,checks,geometry,errors};
    fs.writeFileSync(path.join(out,'검사결과.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks,viewports:geometry.map(x=>x.viewport),errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
