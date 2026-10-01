/* Actual teacher navigation and saved-question reuse, with isolated local demo storage. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const checks=[],errors=[],geometry=[];
  const url=new URL(process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/');
  const suffix=decodeURIComponent(new URL('.',url).pathname).split('/').filter(Boolean).join('-');
  const out=path.resolve(__dirname,'../검증/교사-관리',suffix);fs.mkdirSync(out,{recursive:true});
  url.searchParams.set('demo','1');url.searchParams.set('role','teacher');url.searchParams.set('session','teacher-management-'+Date.now());
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated teacher checks */',contentType:'text/javascript'}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url.href);await page.waitForSelector('.teacher-library');await page.evaluate(()=>document.fonts.ready);
    const oldBank=await page.evaluate(async()=>(await QPDemo.db.ref('quiz/bank').once()).val());
    assert.deepEqual(await page.locator('.teacher-top .tabs [data-t]').evaluateAll(nodes=>nodes.map(n=>n.dataset.t)),['quizzes','classroom','kids']);
    assert.equal(await page.locator('.teacher-top [data-t="quizzes"]').getAttribute('aria-current'),'page');
    assert.equal(await page.locator('.teacher-top [data-t="make"]').count(),1);
    for(const old of ['live','legacy','fash'])assert.equal(await page.locator('.teacher-top [data-t="'+old+'"]').count(),0);
    assert.equal(await page.locator('.teacher-quiz-card').count(),Object.keys(oldBank).length);
    assert.equal(await page.locator('#teacherQuizCount').innerText(),Object.keys(oldBank).length+'개 퀴즈');
    await page.locator('#teacherQuizSearch').fill('OX');assert.equal(await page.locator('.teacher-quiz-card').count(),1);
    assert.match(await page.locator('.teacher-quiz-card h3').innerText(),/OX/);assert.equal(await page.locator('#teacherQuizCount').innerText(),'1개 퀴즈');
    await page.locator('#teacherQuizSearch').fill('없는 제목');assert.equal(await page.locator('.teacher-quiz-card').count(),0);assert.equal(await page.locator('#teacherQuizCount').innerText(),'0개 퀴즈');
    await page.locator('#teacherQuizSearch').fill('');
    checks.push('Teacher entry opens one saved-quiz library with working title search/count; navigation contains only 내 퀴즈, 수업 관리, 학생 관리 plus the new-quiz action');

    await page.locator('.teacher-top [data-t="make"]').click();await page.waitForSelector('.class-picker');
    assert.equal(await page.locator('[data-class-mode]').count(),5);assert.equal(await page.locator('.class-bank-list').count(),0);
    assert.equal(await page.locator('[data-class-set]').count(),0);
    await page.locator('[data-class-mode="free"]').click();await page.locator('[data-class-new]').click();await page.waitForSelector('.qpb-builder');
    const title='교사 관리 저장·재사용 검수';
    await page.locator('[data-field="title"]').fill(title);
    await page.locator('.qpb-sidebar [data-add="choice"]').click();
    await page.locator('[data-field="q"]').fill('숲속 마을의 우리 반은 몇 반인가요?');
    await page.locator('[data-field="a"]').fill('3반');
    for(const [row,value] of ['1반','2반','4반'].entries())await page.locator('[data-field="choice"][data-row="'+row+'"]').fill(value);
    await page.locator('.qpb-sidebar [data-add="short"]').click();
    await page.locator('[data-field="q"]').fill('영어 알파벳 15번째 글자는?');await page.locator('[data-field="a"]').fill('O');
    await page.locator('[data-field="aliases"]').fill('o, 오');
    await page.locator('.qpb-toolbar [data-action="save"]').click();await page.waitForFunction(()=>document.querySelector('[data-save-state]')?.classList.contains('is-saved'));
    const saved=await page.evaluate(async()=>{const bank=(await QPDemo.db.ref('quiz/bank').once()).val();return Object.entries(bank).find(([,s])=>s.title==='교사 관리 저장·재사용 검수');});
    assert(saved);const [setId,set]=saved;assert.equal(set.mode,'free');assert.equal(set.qs.length,2);assert.equal(set.qs[1].type,'short');assert.equal(set.qs[1].a,'O');
    const sourceQuestions=structuredClone(set.qs);
    await page.locator('.qpb-back').click();await page.waitForSelector('.teacher-library');
    assert.equal(await page.locator('.teacher-quiz-card').count(),Object.keys(oldBank).length+1);
    const card=()=>page.locator('.teacher-quiz-card[data-quiz="'+setId+'"]');
    await card().locator('[data-edit]').click();await page.waitForSelector('.qpb-builder');
    assert.equal(await page.locator('[data-field="title"]').inputValue(),title);
    assert.equal(await page.locator('[data-field="q"]').inputValue(),sourceQuestions[0].q);assert.equal(await page.locator('[data-field="a"]').inputValue(),'3반');
    await page.locator('[data-select="1"]').click();assert.equal(await page.locator('[data-field="a"]').inputValue(),'O');
    assert.equal(await page.locator('[data-field="aliases"]').inputValue(),'o, 오');
    await page.locator('[data-field="q"]').fill('수정한 알파벳 15번째 글자는?');
    await page.locator('.qpb-toolbar [data-action="save"]').click();await page.waitForFunction(()=>document.querySelector('[data-save-state]')?.classList.contains('is-saved'));
    await page.locator('.qpb-back').click();await page.waitForSelector('.teacher-library');
    await card().locator('[data-edit]').click();await page.waitForSelector('.qpb-builder');await page.locator('[data-select="1"]').click();
    assert.equal(await page.locator('[data-field="q"]').inputValue(),'수정한 알파벳 15번째 글자는?');assert.equal(await page.locator('[data-field="a"]').inputValue(),'O');
    await page.locator('.qpb-back').click();await page.waitForSelector('.teacher-library');
    checks.push('New quiz uses only the five-mode chooser; actual choice/short questions save, return to the library, reopen and preserve a corrected question plus typed O answer and aliases');

    const sessionIds=[];
    for(const [mode,delivery] of [['team','live'],['round','solo']]){
      await card().locator('[data-quiz-mode]').selectOption(mode);
      await card().locator('[data-launch="'+delivery+'"]').click();await page.waitForSelector('.qpc-setup');
      assert.equal(await page.locator('input[name="delivery"][value="'+delivery+'"]').isChecked(),true);
      assert.equal(await page.locator('input[name="title"]').inputValue(),title);
      assert.equal(await page.locator('input[name="count"]').inputValue(),'2');
      if(mode==='team'){assert.equal(await page.locator('select[name="teamCount"]').count(),1);assert.equal(await page.locator('input[name="teamAssign"][value="random"]').isChecked(),true);}
      if(mode==='round'){assert.equal(await page.locator('[data-round-timer]').isVisible(),true);assert.equal(await page.locator('[data-total-timer]').isVisible(),true);}
      await page.locator('input[name="title"]').fill(title+' · '+delivery);
      await page.locator('.qpc-form [type="submit"]').click();await page.waitForSelector('.qpc-dashboard');
      assert.equal(await page.locator('.teacher-top [data-t="classroom"]').getAttribute('aria-current'),'page');
      const session=await page.evaluate(async({title,delivery})=>Object.entries((await QPDemo.db.ref('quiz/classrooms').once()).val()).find(([,s])=>s.title===title+' · '+delivery),{title,delivery});
      assert(session);sessionIds.push(session[0]);assert.equal(session[1].mode,mode);assert.equal(session[1].delivery,delivery);
      assert.equal(session[1].status,delivery==='live'?'lobby':'playing');assert.equal(session[1].questions.length,2);
      assert.equal(session[1].questions[1].q,'수정한 알파벳 15번째 글자는?');assert.equal(session[1].questions[1].a,'O');
      await page.locator('.qpc-dashboard [data-action="back"]').click();await page.waitForSelector('.class-hub');
      assert.equal(await page.locator('.class-session-card[data-session="'+session[0]+'"]').count(),1);
      await page.locator('.teacher-top [data-t="quizzes"]').click();await page.waitForSelector('.teacher-library');
    }
    const after=await page.evaluate(async()=>(await QPDemo.db.ref('quiz/bank').once()).val());
    for(const [id,original] of Object.entries(oldBank))assert.deepEqual(after[id],original,'Existing question bank must not be overwritten: '+id);
    assert.equal(after[setId].qs.length,2);assert.equal(after[setId].qs[0].a,'3반');assert.equal(after[setId].qs[1].a,'O');
    checks.push('The same saved questions launch team/live and round/solo sessions with correct delivery presets; mode changes and publishing preserve the original OX bank and all saved questions');

    await page.evaluate(async id=>{
      await QPClassroom.end(QPDemo.db,id);
      for(const [key,name,gold] of [['teacher_qa_a','관리 학생 가',100],['teacher_qa_b','관리 학생 나',200]])await QPDemo.db.ref('quiz/users/'+key).set({name,pin:'qa-pin',gold,av:QPGame.newAvatar(),owned:{},stat:{solved:2,correct:1},day:{}});
    },sessionIds[0]);
    await page.locator('.teacher-top [data-t="classroom"]').click();await page.waitForSelector('.class-hub');
    await page.waitForFunction(id=>!document.querySelector('.class-session-card[data-session="'+id+'"]'),sessionIds[0]);
    assert.equal(await page.locator('.class-session-card[data-session="'+sessionIds[1]+'"]').count(),1);
    assert.equal(await page.locator('[data-ended-list]').count(),0);
    await page.locator('[data-ended-toggle]').click();assert.equal(await page.locator('[data-ended-list] [data-session="'+sessionIds[0]+'"]').count(),1);
    await page.locator('[data-ended-toggle]').click();assert.equal(await page.locator('[data-ended-list]').count(),0);
    await page.locator('.class-hub [data-new]').click();await page.waitForSelector('.teacher-library');
    checks.push('Class management shows active sessions first, reveals ended sessions only on request, and returns to the saved-quiz library');

    for(const viewport of [{width:1860,height:900},{width:1366,height:768},{width:1280,height:632},{width:1024,height:632}]){
      await page.setViewportSize(viewport);
      const record={viewport,views:[]};
      for(const [nav,selector,name] of [['quizzes','.teacher-library','내퀴즈'],['make','.class-picker','새퀴즈'],['classroom','.class-hub','수업관리'],['kids','#kBox','학생관리']]){
        await page.locator('.teacher-top [data-t="'+nav+'"]').click();await page.waitForSelector(selector);
        if(nav==='kids')await page.waitForSelector('#kBox [data-pin]');
        const dimensions=await page.evaluate(()=>{
          const controls=[...document.querySelectorAll('.teacher-top [data-t],.teacher-top #tbOut')].map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {text:n.textContent.trim(),x:r.x,y:r.y,right:r.right,bottom:r.bottom,font:parseFloat(s.fontSize),stroke:s.webkitTextStrokeWidth,shadow:s.textShadow};});
          const rows=[...document.querySelectorAll('.teacher-quiz-card,.class-mode,.class-mode-preview,.class-session-card,#kBox .setrow')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right};});
          return {width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,controls,rows};
        });
        assert(dimensions.docWidth<=viewport.width+1,'Teacher document overflow '+name+' '+viewport.width);
        assert(dimensions.controls.every(r=>r.x>=0&&r.y>=0&&r.right<=viewport.width+1&&r.bottom<=viewport.height),'Teacher navigation clipped '+name+' '+viewport.width);
        assert(dimensions.controls.every(r=>r.font>=14&&r.stroke==='0px'&&r.shadow==='none'),'Teacher navigation must use legible plain labels');
        assert(dimensions.rows.every(r=>r.x>=0&&r.right<=viewport.width+1),'Teacher content clipped horizontally '+name+' '+viewport.width);
        if(nav==='make'){assert.equal(await page.locator('.class-bank-list').count(),0);assert.equal(await page.locator('[data-class-mode]').count(),5);}
        if(nav==='kids'){
          assert.equal(await page.locator('#kBox [data-pin]').count(),2);assert.equal(await page.locator('#kBox [data-gold]').count(),2);assert.equal(await page.locator('#kGiveAll').count(),1);
        }
        await page.screenshot({path:path.join(out,name+'-'+viewport.width+'.png')});record.views.push({name,...dimensions});
      }
      geometry.push(record);
    }
    checks.push('All four teacher views fit 1860, 1366, 1280 and 1024 PC widths; navigation is at least 14px with no text stroke/shadow, and student PIN/gold controls remain available');
    assert.deepEqual(errors,[]);const result={previewURL:new URL('.',url).href,checks,geometry,errors};
    fs.writeFileSync(path.join(out,'검사결과.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks,viewports:geometry.map(x=>x.viewport),errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
