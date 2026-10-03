/* Student-facing gender shelves, one-piece wearing and permanent skin unlocks.
   Isolated demo database only; use the actual controls, transactions and reload. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||path.join(__dirname,'../검증/상점-상품정리'));
const expected={m:{top:['tee','hood','shirt','vest','cardi','jacket','knit'],bottom:['shorts','jeans','track','cargo'],outfit:['overall','space','hanbok']},f:{top:['tee','hood','shirt','vest','cardi','sailor','jacket','knit','tank'],bottom:['shorts','jeans','skirt','pleat','track','legging','tutu','cargo','jean_skirt','star_skirt'],outfit:['dress','robe','overall','space','hanbok']}};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  const checks=[],screens=[],errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated catalogue QA */',contentType:'text/javascript'}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('?demo=1&user=상품검수&session=shop-catalog-'+Date.now(),base).href);
    await page.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready);
    const seed=await page.evaluate(async()=>{
      const me=QPGame.getMe(),key=me.k,user=JSON.parse(JSON.stringify(me));delete user.k;
      user.gold=1600;user.av={...user.av,sex:'f',sk:3,ec:5,hair:'long:8',top:'dress:0',bottom:'skirt:6',outfit:''};
      user.owned={'hair:long:8':1,'hair:long:5':1,'hair:part:6':1,'top:dress:0':1,'top:shirt:11':1,'top:overall:7':1,'bottom:hanbok:9':1,'hat:cap:7':1};
      delete user.skinSetup;delete user.skinOwned;
      await QPDemo.db.ref('quiz/users/'+key).set(user);QPGame.enterUser(key,user);return {key,user};
    });
    const me=()=>page.evaluate(()=>JSON.parse(JSON.stringify(QPGame.getMe())));
    const stored=()=>page.evaluate(async()=>{const m=QPGame.getMe();return(await QPDemo.db.ref('quiz/users/'+m.k).once()).val();});
    const ids=()=>page.locator('#shGrid [data-id]').evaluateAll(ns=>ns.map(n=>n.dataset.id));
    const cat=async name=>{await page.locator('#shTabs [data-c="'+name+'"]').click();};
    const switchSex=async sex=>{await page.locator('#btnGender').click();await page.locator('#avatarSexChoices [data-sex="'+sex+'"]').click();};
    await page.locator('#tbShop').click();let current=await me();
    assert.equal(current.av.outfit,'dress:7');assert.equal(current.av.top,'dress:7');assert.equal(current.av.bottom,'');
    assert.equal(current.av.hair,'long:1');assert.equal(current.av.ec,0);assert.equal(current.av.sk,3);
    assert.deepEqual(current.owned,seed.user.owned);assert.equal(current.gold,1600);assert.deepEqual(current.skinOwned,{'3':1});assert.equal(current.skinSetup,true);
    assert.equal(await page.locator('#shPal, .shop-colour-strip').count(),0);
    checks.push('Existing female dress becomes one piece; previous colour ownership, gold and chosen skin survive without colour controls');
    await page.locator('#shopOwned').click();assert.deepEqual(await ids(),['hair:bob:1','hair:long:1']);
    await cat('outfit');assert.deepEqual(await ids(),['outfit:dress:7','outfit:overall:5','outfit:hanbok:7']);
    await page.locator('#shGrid [data-id="outfit:hanbok:7"]').click();assert.equal(await page.locator('#btnBuy').count(),0);await page.locator('#btnWear').click();
    current=await me();assert.equal(current.av.outfit,'hanbok:7');assert.equal(current.av.top,'hanbok:7');assert.equal(current.av.bottom,'hanbok:0');assert.equal(current.gold,1600);assert.deepEqual(current.owned,seed.user.owned);
    checks.push('A former hanbok-skirt-only owner equips the complete hanbok for free and keeps the exact original ownership and balance');
    await page.locator('#shGrid [data-id="outfit:overall:5"]').click();assert.equal(await page.locator('#btnBuy').count(),0);await page.locator('#btnWear').click();
    current=await me();assert.equal(current.av.outfit,'overall:5');assert.equal(current.av.top,'overall:5');assert.equal(current.av.bottom,'');assert.equal(current.gold,1600);
    await page.locator('#shGrid [data-none]').click();await page.locator('#btnWear').click();current=await me();
    assert.equal(current.av.outfit,'');assert.equal(current.av.top,'tee:3');assert.equal(current.av.bottom,'shorts:5');assert.equal(current.gold,1600);
    await page.locator('#shGrid [data-id="outfit:overall:5"]').click();await page.locator('#btnWear').click();
    await cat('top');await page.locator('#shGrid [data-id="top:shirt:10"]').click();await page.locator('#btnWear').click();current=await me();
    assert.equal(current.av.outfit,'');assert.equal(current.av.top,'shirt:10');assert.equal(current.av.bottom,'shorts:5');assert.deepEqual(current.owned,seed.user.owned);
    const separated=JSON.parse(JSON.stringify(current.av));await cat('outfit');await page.locator('#shGrid [data-none]').click();await page.locator('#btnWear').click();
    assert.deepEqual((await me()).av,separated,'Removing an absent one-piece must leave the separate garments alone');
    checks.push('Old differently coloured outfits equip free as one suit; selecting a separate top removes the whole suit and restores a valid lower garment');
    await page.locator('#shopAll').click();
    for(const sex of ['m','f']){
      await switchSex(sex);current=await me();assert.equal(current.av.sex,sex);assert.equal(current.gold,1600);assert.equal(current.av.sk,3);assert.deepEqual(current.owned,seed.user.owned);
      for(const name of ['top','bottom','outfit']){
        await cat(name);const rows=await ids();assert.deepEqual(rows.map(id=>id.split(':')[1]),expected[sex][name]);assert.equal(new Set(rows.map(id=>id.split(':')[1])).size,rows.length);
      }
      for(const name of (await page.evaluate(()=>QPGame.getCatalog().CATS.map(c=>c.k)))){
        await cat(name);const rows=await ids();assert.equal(new Set(rows.map(id=>id.split(':')[1])).size,rows.length,'A shelf has exactly one colour per style');assert.equal(await page.locator('#shPal').count(),0);
      }
      await cat('outfit');for(const id of await ids()){
        await page.locator('#shGrid [data-id="'+id+'"]').click();
        const preview=await page.evaluate(()=>{const v=QPGame.getCatalog().OUTFIT_PARTS;const node=document.querySelector('#pvStage > svg');return {svg:!!node,painted:node.querySelectorAll('[data-qpc-category="top"]').length,bottom:node.querySelectorAll('[data-qpc-category="bottom"]').length};});
        assert(preview.svg&&preview.painted>0,'Every one-piece fitting preview paints an upper garment: '+id);
        assert.equal(await page.locator('#shInfo [data-qpx-head], #shInfo .qpx-head').count(),0,'A whole-outfit product thumbnail contains clothes and body only, with no unrelated head');
        assert.equal(await page.locator('#shInfo [data-shop-outfit]').getAttribute('data-qpx-sex'),sex);
      }
      await page.locator('#shGrid').evaluate(node=>{node.scrollTop=0;});
      await page.screenshot({path:path.join(out,sex+'-한벌옷-1366.png')});screens.push(sex+'-한벌옷-1366.png');
    }
    checks.push('Male and female shelves have separate valid garments; full suits appear only in their own category; all sixteen shelves show one designed colour per style');
    await switchSex('m');await cat('top');
    await page.locator('#shGrid [data-id="top:hood:5"]').click();assert.equal(await page.locator('#btnBuy').count(),1);
    await page.locator('#btnBuy').evaluate(b=>{b.click();b.click();});await page.waitForFunction(()=>QPGame.getMe().owned['top:hood:5']);
    current=await me();assert.equal(current.gold,1420);assert.equal(current.av.top,'hood:5');assert.equal(current.av.outfit,'');
    checks.push('Repeated activation of a new male garment charges its price once and equips the actual male outfit');
    for(let i=0;i<10;i++){await page.locator('#btnRand').click();current=await me();
      const valid=await page.evaluate(()=>{const m=QPGame.getMe(),c=QPGame.getCatalog();return c.CATS.every(cat=>{const val=m.av[cat.k];if(!val)return cat.off||cat.k==='bottom'&&!!m.av.outfit;const shape=val.split(':')[0];const full=m.av.outfit&&(cat.k==='top'||cat.k==='bottom');return full||c.publicItems(cat.k,m.av.sex).some(it=>it.shape+':'+it.ci===val);});});
      assert(valid);assert.equal(current.av.ec,0);assert.equal(current.av.sk,3);assert.equal(current.gold,1420);
    }
    checks.push('Randomize selects valid owned male styles and never randomizes skin or other colours');
    await cat('top');await page.locator('#shGrid [data-id="top:hood:5"]').click();if(await page.locator('#btnWear').count())await page.locator('#btnWear').click();
    await page.locator('#shGrid [data-id="top:shirt:10"]').click();
    await page.locator('#btnFace').click();await page.locator('#fSk [data-skin="4"]').click();assert.equal(await page.locator('#skinAction').textContent(),'사기 · 100골드');
    const beforeSkin=await me();assert.equal(beforeSkin.av.sk,3);assert.equal(beforeSkin.gold,1420);
    // Hold the real skin transaction while the user closes its modal and
    // attempts free avatar edits. Its completion must not touch removed modal DOM.
    await page.evaluate(()=>{
      const db=QPDemo.db,originalRef=db.ref.bind(db),key=QPGame.getMe().k;
      db.ref=function(target){const ref=originalRef(target),transaction=ref.transaction.bind(ref);
        ref.transaction=function(callback,...args){
          if(target==='quiz/users/'+key&&String(callback).includes('skinPurchaseUser')){
            window.skinTxStarted=true;
            return new Promise((resolve,reject)=>{window.releaseSkinTx=()=>{db.ref=originalRef;return transaction(callback,...args).then(resolve,reject);};});
          }
          return transaction(callback,...args);
        };return ref;
      };
    });
    await page.locator('#skinAction').evaluate(b=>{b.click();b.click();});await page.waitForFunction(()=>window.skinTxStarted);
    await page.evaluate(()=>closeModal());const locked=await me();
    await page.locator('#btnWear').click();assert.deepEqual((await me()).av,locked.av);
    await page.locator('#btnRand').click();assert.deepEqual((await me()).av,locked.av);
    await page.locator('#btnGender').click();assert.equal(await page.locator('#avatarSexChoices').count(),0);
    await page.locator('#btnFace').click();assert.equal(await page.locator('#fSk').isVisible(),false);
    assert.equal(await page.locator('#modal').evaluate(node=>node.classList.contains('on')),false);
    await page.evaluate(()=>window.releaseSkinTx());await page.waitForFunction(()=>QPGame.getMe().av.sk===4);current=await me();
    assert.equal(current.gold,1320);assert.deepEqual(current.skinOwned,{'3':1,'4':1});assert.equal(current.av.top,'hood:5');assert.deepEqual((await stored()).av,current.av);
    await page.locator('#btnWear').click();current=await me();assert.equal(current.av.top,'shirt:10');assert.equal(current.av.sk,4);
    await page.locator('#btnFace').click();
    checks.push('Delayed skin transaction: closing its modal and attempting wear/random/gender cannot save stale skin; completion preserves gold and ownership, then normal edits unlock');
    await page.locator('#fSk [data-skin="3"]').click();await page.locator('#skinAction').click();await page.waitForFunction(()=>QPGame.getMe().av.sk===3);
    await page.locator('#fSk [data-skin="4"]').click();await page.locator('#skinAction').click();await page.waitForFunction(()=>QPGame.getMe().av.sk===4);current=await me();assert.equal(current.gold,1320);
    await page.evaluate(()=>closeModal());await page.reload();await page.waitForFunction(()=>QPGame.getMe()?.av.sk===4&&QPAvatar.atlas.ready);
    current=await me();assert.equal(current.gold,1320);assert.equal(current.skinSetup,true);assert.deepEqual(current.skinOwned,{'3':1,'4':1});assert.equal(current.owned['top:hood:5'],1);
    checks.push('Skin preview changes no account value; a new skin costs 100 once, owned tones re-equip free and ownership/balance survive page reload');
    await page.locator('#tbShop').click();
    await page.evaluate(async()=>{const m=QPGame.getMe(),u=(await QPDemo.db.ref('quiz/users/'+m.k).once()).val();u.gold=99;await QPDemo.db.ref('quiz/users/'+m.k).set(u);});
    await page.waitForFunction(()=>QPGame.getMe().gold===99);await page.locator('#btnFace').click();await page.locator('#fSk [data-skin="1"]').click();assert(await page.locator('#skinAction').isDisabled());current=await me();assert.equal(current.gold,99);assert.equal(current.av.sk,4);await page.evaluate(()=>closeModal());
    checks.push('An unowned skin cannot be bought with 99 gold; account appearance and balance remain unchanged');
    const mixed=await page.evaluate(async()=>{const m=QPGame.getMe(),u=(await QPDemo.db.ref('quiz/users/'+m.k).once()).val();u.av={...u.av,sex:'m',hair:'long:7',top:'tank:7',bottom:'skirt:7',outfit:'dress:7'};await QPDemo.db.ref('quiz/users/'+m.k).set(u);QPGame.enterUser(m.k,u);return u;});
    current=await me();assert.equal(current.av.outfit,'');assert(expected.m.top.includes(current.av.top.split(':')[0]));assert(expected.m.bottom.includes(current.av.bottom.split(':')[0]));assert(['short','spiky','part','messy','crop','bowl','fade','undercut','slick','curlm','comma','wolf'].includes(current.av.hair.split(':')[0])&&current.av.hair.endsWith(':1'));assert.deepEqual(current.owned,mixed.owned);assert.equal(current.gold,99);
    await page.locator('#tbShop').click();await cat('top');
    for(const [width,height] of [[1024,768],[1366,768]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
      const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,shop:document.querySelector('.qp-village-shop').getBoundingClientRect().right}));
      assert(size.scroll<=width+1&&size.shop<=width+1);await page.screenshot({path:path.join(out,'남자상의-'+width+'.png')});screens.push('남자상의-'+width+'.png');
    }
    checks.push('Signing into an old mixed male profile corrects hair, separates and female suit; ownership survives and the actual male shop fits both laptop widths');
    // Finish a deliberately interrupted first setup. The flag is stored before
    // a later login can obtain any other free skin.
    const unfinished=await page.evaluate(async()=>{const m=QPGame.getMe(),u=(await QPDemo.db.ref('quiz/users/'+m.k).once()).val();u.gold=0;u.skinSetup=false;u.skinOwned={};u.av.sk=0;await QPDemo.db.ref('quiz/users/'+m.k).set(u);QPGame.enterUser(m.k,u);return m.k;});
    await page.locator('#initialSkin [data-skin="2"]').click();await page.locator('#skinSetupDone').evaluate(b=>{b.click();b.click();});await page.waitForFunction(()=>QPGame.getMe().skinSetup&&QPGame.getMe().av.sk===2);
    current=await me();assert.equal(current.gold,0);assert.deepEqual(current.skinOwned,{'2':1});assert.equal((await stored()).skinSetup,true);
    await page.reload();await page.waitForFunction(()=>QPGame.getMe()?.av.sk===2&&QPAvatar.atlas.ready);assert.equal(await page.locator('#initialSkin').count(),0);
    await page.locator('#tbShop').click();await page.locator('#btnFace').click();await page.locator('#fSk [data-skin="3"]').click();assert(await page.locator('#skinAction').isDisabled());await page.evaluate(()=>closeModal());
    checks.push('Interrupted first setup completes exactly once for free and cannot grant a second free tone after reload');
    // Actual new-account flow includes the initial skin in its creation transaction.
    await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>QPGame.go('login'));
    await page.locator('#lgNew').click();await page.locator('#lgM').click();await page.locator('#lgSkin [data-skin="4"]').click();
    const freshName='새피부'+Date.now().toString().slice(-6);await page.locator('#lgId').fill(freshName);await page.locator('#lgDots').fill('1234');await page.locator('#lgGo').click();await page.waitForFunction(()=>document.getElementById('lgLab')?.textContent==='한 번 더');
    await page.locator('#lgDots').fill('1234');await page.locator('#lgGo').click();await page.waitForFunction(name=>QPGame.getMe()?.name===name,freshName);
    current=await me();assert.equal(current.av.sex,'m');assert.equal(current.av.sk,4);assert.equal(current.gold,300);assert.equal(current.skinSetup,true);assert.deepEqual(current.skinOwned,{'4':1});
    checks.push('Actual signup lets the student choose the first skin explicitly and stores one free tone with the original 300 starting gold');
    assert.deepEqual(errors,[]);
    const summary={checks,screens,expected,skinPrice:100,errors};fs.writeFileSync(path.join(out,'검증결과.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
