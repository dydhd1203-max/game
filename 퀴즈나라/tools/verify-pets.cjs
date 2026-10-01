const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated companion QA */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?demo=1&session=pets-'+Date.now());
    if(!await page.evaluate(()=>!!window.QPPets))await page.addScriptTag({url:'/avatar-pets.js'});
    await page.waitForFunction(()=>QPPets.atlas.ready||QPPets.atlas.error);
    assert.equal(await page.evaluate(()=>QPPets.atlas.ready),true,await page.evaluate(()=>QPPets.atlas.error));
    const report=await page.evaluate(async()=>{
      const catalog=QPGame.getCatalog(),pets=catalog.CATS.find(c=>c.k==='pet').src;
      const colors=catalog.PAL.basic,items=Object.keys(pets).map(shape=>({shape,name:pets[shape][0],price:pets[shape][1],...QPPets.inspect(shape)}));
      const hsl=(r,g,b)=>{r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;let h=0;if(d)h=60*(hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4);return[h,d?d/(1-Math.abs(2*l-1)):0,l];};
      async function read(shape,color){
        const node=document.createElement('div');node.innerHTML='<svg>'+QPPets.render(shape,color)+'</svg>';
        const src=node.querySelector('image').getAttribute('href'),img=new Image();img.src=src;await img.decode();
        const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return{src,data:ctx.getImageData(0,0,c.width,c.height).data};
      }
      const checks=[],blueSources=[];
      for(const {shape} of items){
        const base=await read(shape,'#5aa8ff');blueSources.push(base.src);
        for(const [color,name] of colors){
          const changed=await read(shape,color),[th,ts]=hsl(...color.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)));
          let alphaSame=true,body=0,target=0,details=0,kept=0;
          for(let i=0;i<base.data.length;i+=4){
            if(base.data[i+3]!==changed.data[i+3])alphaSame=false;if(base.data[i+3]<100)continue;
            const [h,s,l]=hsl(base.data[i],base.data[i+1],base.data[i+2]),[hh,ss]=hsl(changed.data[i],changed.data[i+1],changed.data[i+2]);
            // Sample clear dyed blue body pixels. Eyes, muzzle, cheeks, paws and
            // gold decoration must retain their original values for every dye.
            if(h>190&&h<245&&s>.15&&l>.12&&l<.94){body++;const distance=Math.min(Math.abs(hh-th),360-Math.abs(hh-th));if(ts<.04?ss<.04:distance<20)target++;}
            if((s<.06&&l>.82)||(h<65&&s>.15&&l<.7)||(h>290&&s>.2)){
              details++;if([0,1,2].every(j=>base.data[i+j]===changed.data[i+j]))kept++;
            }
          }
          checks.push({shape,color,name,alphaSame,bodyPixels:body,targetFraction:target/body,detailPixels:details,detailsKept:details===kept});
        }
      }
      const shown=[['#a87352','갈색'],['#ff8ad4','분홍'],['#4ad0c0','민트'],['#f2dfbd','크림']];
      document.body.style.cssText='height:auto;min-height:100vh;overflow:visible;background:#edf6ff;color:#26445c';
      document.body.innerHTML='<main style="padding:24px;font-family:inherit"><h1>펫 · 새 세밀 원화 16종</h1><p>큰 원화와 실제 게임 크기 · 기존 12색 염색</p><section style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">'+items.map(({shape,name},i)=>'<article style="padding:14px;border:1px solid #bfd2e5;border-radius:14px;background:#fffaf4;display:flex;flex-direction:column;align-items:center"><b style="font-size:20px">'+name+'</b><svg width="145" height="150" viewBox="23 35 10 13">'+QPPets.render(shape,shown[i%4][0])+'</svg><div style="display:flex;align-items:end;gap:18px;margin-top:8px">'+shown.map(([c])=>'<svg width="45" height="58" viewBox="23 35 10 13">'+QPPets.render(shape,c)+'</svg>').join('')+'</div></article>').join('')+'</section></main>';
      const freeze=document.createElement('style');freeze.textContent='.qp-pixel-avatar *, .qpx-pet{animation:none!important}';document.head.appendChild(freeze);
      await Promise.all([...document.querySelectorAll('image')].map(async n=>{const img=new Image();img.src=n.getAttribute('href');await img.decode();}));
      await document.fonts.ready;
      return{atlas:QPPets.atlas,items,checks,blueSources,unknown:QPPets.render('missing','#fff')};
    });
    assert.equal(report.items.length,16);assert.equal(report.checks.length,192);assert.equal(report.unknown,'');
    assert.deepEqual(report.items.map(i=>i.shape),['dog','cat','chick','rabbit','bear','penguin','dino','ghost','fish','hamster','panda','fox','unicorn','frog','bee','star']);
    assert.deepEqual(report.items.map(i=>i.price),[600,600,450,650,700,750,900,850,500,600,820,780,1200,560,700,1000]);
    for(const i of report.items){assert(i.width>200&&i.height>200&&i.opaquePixels>30000,'Native independent artwork: '+i.shape);assert(i.target[0]>=23&&i.target[0]+i.target[2]<=33,'Pet must stay in lower-right slot: '+i.shape);assert(i.target[1]>=35&&i.target[1]+i.target[3]<=47.001,'Pet must fit thumbnail crop: '+i.shape);}
    for(const c of report.checks){assert(c.alphaSame,JSON.stringify(c));assert(c.bodyPixels>1000&&c.targetFraction>.95,JSON.stringify(c));assert(c.detailPixels>1000&&c.detailsKept,JSON.stringify(c));}
    report.artHashes=report.blueSources.map(v=>crypto.createHash('sha256').update(v).digest('hex'));delete report.blueSources;
    assert.equal(new Set(report.artHashes).size,16,'All species need independent artwork');
    const out=path.resolve(__dirname,'../검증');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'펫-16종-원화와실제크기.png'),fullPage:true});
    await page.waitForFunction(()=>QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPEffects.atlas.ready&&(!window.QPShoes||QPShoes.atlas.ready));
    report.worn=await page.evaluate(async()=>{
      const values=['cat:9','dog:10','rabbit:8','dino:4','hamster:1','panda:7','unicorn:6','star:2'];
      const avatars=values.map((pet,i)=>({...QPGame.newAvatar(i%2?'m':'f'),hair:i%2?'part:1':'bob:9',top:i%2?'shirt:10':'hood:7',bottom:i%2?'jeans:11':'skirt:7',shoes:'sneaker:8',pet,effect:'angel:0',frame:'',bg:''}));
      document.body.innerHTML='<main style="padding:24px;color:#284862;font-family:inherit"><h1>실제 아바타 옆 · 펫과 천사 동시 착용</h1><section style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">'+avatars.map((a,i)=>'<article style="background:#fffaf4;border:1px solid #bfd2e5;border-radius:14px;padding:20px;display:flex;align-items:center;flex-direction:column">'+QPAvatar.render(a,252,3)+'<b style="margin-top:12px">'+values[i]+'</b></article>').join('')+'</section></main>';
      await Promise.all([...document.querySelectorAll('image')].map(async n=>{const img=new Image();img.src=n.getAttribute('href');await img.decode();}));
      return [...document.querySelectorAll('article')].map(card=>{
        const p=card.querySelector('.qpp-companion'),root=card.querySelector('svg.qp-pixel-avatar'),angel=card.querySelector('.qp-effect'),rect=p.getBoundingClientRect();
        // The head uses a clipped native atlas. SVG group bounds include its
        // offscreen source image, so measure the lower edge of the face area in
        // the avatar's actual screen transform rather than that hidden atlas.
        const faceBottom=new DOMPoint(16,36).matrixTransform(root.getScreenCTM()).y;
        return{shape:p.dataset.qppShape,native:[+p.querySelector('image').getAttribute('width'),+p.querySelector('image').getAttribute('height')],width:rect.width,height:rect.height,belowFace:rect.top>=faceBottom-1,angel:!!angel,hasPixelPose:p.classList.contains('qpx-pet')};
      });
    });
    assert.equal(report.worn.length,8);
    for(const p of report.worn){assert(p.native[0]>200&&p.native[1]>200,'Actual avatar must use native detail: '+p.shape);assert(p.width<=40&&p.height<=50,'Actual pet must keep its companion size: '+p.shape);assert(p.belowFace&&p.angel&&p.hasPixelPose,'Face, angel and pet must coexist: '+JSON.stringify(p));}
    await page.screenshot({path:path.join(out,'펫-아바타와천사-동시착용.png'),fullPage:true});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'펫검증.json'),JSON.stringify({...report,errors},null,2));
    console.log(JSON.stringify({nativeAtlas:[report.atlas.width,report.atlas.height],species:16,colors:12,colorChecks:192,uniqueArtwork:16,alphaAndDetailPreserved:true,wornAvatars:8,petAndAngelTogether:true,errors}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
