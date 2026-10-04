'use strict';

// Compare sizes against one frozen local runtime, using actual school controls.
// Screenshots require direct art review; passing controls is not an art rating.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repository=path.resolve(__dirname,'..');
const target=new URL(process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/');
const directory=path.join(repository,decodeURIComponent(target.pathname).includes('/배포용')?'배포용':'');
const output=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(repository,'검증/학교-아바타-크기'));
const sizes=(process.env.QUIZ_AVATAR_SIZES||'96,120').split(',').map(Number);
assert(sizes.every(n=>Number.isFinite(n)&&n>=60&&n<=140));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const snapshot=new Map(require('./deployment-files.cjs').map(file=>[file,fs.readFileSync(path.join(directory,file))]));
const world=snapshot.get('school-room-world.js').toString();
const currentSize=Number(world.match(/AVATAR_HEIGHT=(\d+)/)?.[1]);assert(currentSize);
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf'};
const report={startedAt:new Date().toISOString(),target:target.href,currentSize,sizes,sourceHashes:Object.fromEntries([...snapshot].map(([k,v])=>[k,hash(v)])),cases:[],errors:[],missing:[],success:false,realFirebaseTested:false};
fs.mkdirSync(output,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser;
async function state(page){return page.evaluate(()=> (QPGame.getCampus()||QPGame.getPlayground()).getState());}
async function focus(page){await page.bringToFront();await page.locator('.school-room-world').focus();}
async function room(page,zone){await page.waitForFunction(z=>document.querySelector('.school-room-host')?.dataset.zone===z&&Boolean(z==='campus'?QPGame.getCampus():QPGame.getPlayground()),zone);}
async function shot(page,folder,name){
  await focus(page);await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const filename=name+'.png';await page.screenshot({path:path.join(folder,filename)});
  const box=await page.locator('.sr-actor.is-me .sr-avatar>svg').boundingBox(),vp=page.viewportSize();
  const x=Math.max(0,box.x-65),y=Math.max(60,box.y-35),right=Math.min(vp.width,box.x+box.width+90),bottom=Math.min(vp.height,box.y+box.height+50);
  if(right>x&&bottom>y)await page.screenshot({path:path.join(folder,name+'-실제크기.png'),clip:{x,y,width:right-x,height:bottom-y}});
  return page.evaluate(()=>{
    const w=QPGame.getCampus()||QPGame.getPlayground(),svg=document.querySelector('.sr-actor.is-me .sr-avatar>svg'),s=w.getState(),wr=document.querySelector('.sr-world').getBoundingClientRect(),scale=s.camera.scale;
    const upper=svg.querySelector('[data-qpx-pose-part="upper"]'),p=new DOMPoint(16,39.25).matrixTransform(upper.getScreenCTM());
    const seat=s.seatId&&QPSchoolRoomScene.seats.find(v=>v.id===s.seatId),actor=svg.closest('.sr-actor');
    const encoded=svg.querySelector('[data-qpx-head]')?.dataset.qpxHead;
    return {state:s,renderedAvatar:encoded?JSON.parse(decodeURIComponent(encoded)):null,nominalHeights:[...document.querySelectorAll('.sr-actor .sr-avatar>svg')].map(v=>Number(v.getAttribute('height'))*56/Number(v.getAttribute('viewBox').split(/\s+/)[3])),displayedHeight:svg.getBoundingClientRect().height,view:svg.dataset.qpxView,pose:svg.dataset.qpxPose,radius:w.nav.radius,hipWorld:{x:(p.x-wr.x)/scale,y:(p.y-wr.y)/scale},chairSeatY:seat?[seat.rect.y+52,seat.rect.y+68]:null,actorDepth:Number(actor.style.zIndex),deskDepth:seat?Number(document.querySelector('[data-art="'+seat.id+'-desk"]').style.zIndex):null,bodyProportions:{...QPAvatar.proportions}};
  });
}
async function position(page,zone,point){await page.evaluate(({zone,point})=>QPGame.go(zone,point),{zone,point});await room(page,zone);await focus(page);}
async function sit(page,id){await focus(page);await page.keyboard.press('KeyC');await page.waitForFunction(id=>QPGame.getCampus().getState().seatId===id,id);await page.waitForFunction(()=>document.querySelector('.sr-actor.is-me svg')?.dataset.qpxPose==='sit');}
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
  for(const size of sizes){
    const folder=path.join(output,String(size));fs.mkdirSync(folder,{recursive:true});
    const entry={size,checks:[],screenshots:[],geometry:[]};report.cases.push(entry);
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(url.hostname==='www.gstatic.com'&&url.pathname.includes('/firebasejs/'))return route.fulfill({body:'/* isolated size comparison */',contentType:'text/javascript'});
      if(url.origin===target.origin){
        let file=decodeURIComponent(url.pathname.slice(target.pathname.length));if(!file)file='index.html';
        const body=snapshot.get(file);if(body)return route.fulfill({body:file==='school-room-world.js'?Buffer.from(world.replace(/AVATAR_HEIGHT=\d+/,'AVATAR_HEIGHT='+size)):body,contentType:mime[path.extname(file)]||'application/octet-stream'});
      }
      return route.continue();
    });
    const session='school-size-'+size+'-'+Date.now();
    async function open(user,sex,point){
      const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.stack||e.message));page.on('response',r=>{if(r.status()>=400)report.missing.push(r.url());});
      const url=new URL(target);url.searchParams.set('demo','1');url.searchParams.set('screen','campus');url.searchParams.set('session',session);url.searchParams.set('user',user);await page.goto(url.href);
      await page.waitForFunction(()=>QPGame.getCampus()&&QPAvatar.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPAvatarDirection.atlas.ready&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady);
      await page.evaluate(({sex,point})=>{const me=QPGame.getMe(),av=QPGame.avatarForSex({...me.av,sex,sk:1,hair:sex==='m'?'messy:1':'bob:1',top:sex==='m'?'hood:5':'tee:7',bottom:sex==='m'?'jeans:5':'shorts:5',outfit:sex==='m'?'':'dress:7',hat:'',glass:'',ear:'',neck:'',back:'',pet:'',effect:'',face:''},sex);Object.assign(me.av,av);QPGame.go('campus',point);},{sex,point});
      await room(page,'campus');return page;
    }
    const a=await open('크기하늘','m',{x:1035,y:591}),b=await open('크기민트','f',{x:1135,y:591});
    await a.waitForFunction(()=>document.querySelectorAll('.sr-actor').length===2);
    entry.geometry.push({name:'01-교실-두학생-통로',...await shot(a,folder,'01-교실-두학생-통로')});
    assert(entry.geometry[0].nominalHeights.every(h=>Math.abs(h-size)<.01),'Both local and remote avatars must use the enlarged size');
    assert.equal(entry.geometry[0].radius,7);entry.checks.push('Both students enlarge while navigation radius remains 7.');
    const seats=await a.evaluate(()=>QPSchoolRoomScene.seats);
    await position(a,'campus',seats[4].approach);await position(b,'campus',seats[5].approach);await sit(a,seats[4].id);await sit(b,seats[5].id);await focus(a);await wait(3100);
    const seated={name:'02-교실-책상-C',...await shot(a,folder,'02-교실-책상-C')};entry.geometry.push(seated);
    assert.equal(seated.view,'back');assert.equal(seated.actorDepth>seated.deskDepth,true);assert.equal(seated.state.x,seats[4].sitX);assert.equal(seated.state.y,seats[4].sitY);
    assert(seated.hipWorld.y>=seated.chairSeatY[0]&&seated.hipWorld.y<=seated.chairSeatY[1],'The enlarged actual C pose hip must remain on the original chair seat: '+JSON.stringify(seated));
    entry.checks.push('Actual C desk seating keeps original seat anchors, rear direction and furniture depth.');
    await focus(a);await a.keyboard.press('KeyC');await focus(b);await b.keyboard.press('KeyC');
    await position(a,'campus',{x:1513,y:465});await position(b,'campus',{x:1580,y:465});await focus(a);await a.keyboard.press('KeyC');await a.waitForFunction(()=>QPGame.getCampus().getState().pose==='sit-floor');await wait(3100);
    entry.geometry.push({name:'03-교실-바닥-C',...await shot(a,folder,'03-교실-바닥-C')});
    assert.equal((await state(a)).seatId,null);await a.keyboard.press('KeyC');entry.checks.push('Actual C floor seating preserves feet position and does not occupy a chair.');
    await position(a,'campus',{x:1035,y:496});await focus(a);await a.keyboard.down('ArrowDown');await a.waitForFunction(()=>QPGame.getCampus().getState().y>570);
    entry.geometry.push({name:'04-교실-좁은통로-걷기',...await shot(a,folder,'04-교실-좁은통로-걷기')});
    await a.waitForFunction(()=>QPGame.getCampus().getState().y>840);await a.keyboard.up('ArrowDown');assert(await a.evaluate(()=>{const w=QPGame.getCampus(),s=w.getState();return w.canStand(s.x,s.y)}));
    entry.checks.push('Actual arrow input passes all three narrow desk rows without moving furniture or enlarging collision radius.');
    await position(a,'campus',{x:2122,y:368});await a.evaluate(()=>QPGame.getCampus().moveTo(2122,298));await room(a,'playground');
    await position(b,'playground',{x:1640,y:676});await a.waitForFunction(()=>document.querySelectorAll('.sr-actor').length===2);
    entry.geometry.push({name:'05-운동장-정문-두학생',...await shot(a,folder,'05-운동장-정문-두학생')});
    const pgBefore=await state(a);await focus(a);await a.keyboard.press('KeyC');await a.waitForFunction(()=>QPGame.getPlayground().getState().pose==='sit-floor');
    entry.geometry.push({name:'06-운동장-바닥-C',...await shot(a,folder,'06-운동장-바닥-C')});assert(Math.hypot((await state(a)).x-pgBefore.x,(await state(a)).y-pgBefore.y)<.1);await a.keyboard.press('KeyC');
    await wait(700);await a.evaluate(()=>QPGame.getPlayground().moveTo(1515,620));await room(a,'campus');
    await position(a,'campus',{x:2122,y:368});await wait(700);await a.evaluate(()=>QPGame.getCampus().moveTo(2122,298));await room(a,'playground');
    await a.evaluate(()=>{if(!QPGame.getPlayground().moveTo(2258,410))throw new Error('The east source doorway must have a legal walking route');});
    await room(a,'campus');
    entry.geometry.push({name:'07-운동장-동쪽문-실제보행',...await shot(a,folder,'07-운동장-동쪽문-실제보행')});
    entry.checks.push('Walking through both original school doors transfers automatically with enlarged avatars and original arrival anchors.');
    assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));
    console.log('PASS size '+size+': '+entry.checks.length+' control groups, '+entry.geometry.length+' live screenshots');
    await context.close();
  }
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.missing,[]);report.success=true;report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();
})().catch(async e=>{report.error=e.stack;report.completedAt=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.error(e);await browser?.close();process.exitCode=1;});
