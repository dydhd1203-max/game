const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const context=await browser.newContext({viewport:{width:1500,height:900}});
    await context.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({body:'/* isolated clothes QA */',contentType:'text/javascript'}));
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173/?demo=1&session=clothes-'+Date.now());
    if(!await page.evaluate(()=>!!window.QPClothes))await page.addScriptTag({url:'/avatar-clothes.js'});
    await page.waitForFunction(()=>QPClothes.atlas.ready||QPClothes.atlas.error);
    assert.equal(await page.evaluate(()=>QPClothes.atlas.ready),true,await page.evaluate(()=>QPClothes.atlas.error));
    const report=await page.evaluate(async()=>{
      const expected={top:['tee','hood','shirt','dress','vest','cardi','sailor','jacket','knit','tank','hanbok','robe','overall','space'],bottom:['shorts','jeans','skirt','pleat','track','legging','hanbok','tutu','cargo','jean_skirt','star_skirt']};
      const tiles=Object.entries(expected).flatMap(([category,list])=>list.map(shape=>({category,shape,...QPClothes.inspect(category,shape)})));
      const colors=[['분홍','#ff8ad4'],['민트','#4ad0c0'],['크림','#f2dfbd'],['보라','#9b7bff'],['갈색','#a87352']];
      const hsl=(r,g,b)=>{r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;let h=0;if(d)h=60*(hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4);return[h,d?d/(1-Math.abs(2*l-1)):0,l];};
      async function pixels(category,shape,color){
        const holder=document.createElement('div');holder.innerHTML=QPClothes.render(category,shape,color,'f','#ffd0ac');
        const img=new Image();img.src=holder.querySelector('image').getAttribute('href');await img.decode();
        const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);return{width:c.width,height:c.height,data:x.getImageData(0,0,c.width,c.height).data};
      }
      const colorChecks=[];
      for(const {category,shape} of tiles){
      const blue=await pixels(category,shape,'#5aa8ff');
      for(const [name,color] of colors){
        const p=await pixels(category,shape,color),target=color.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16)),th=hsl(...target)[0];
        let sameAlpha=true,blueLeft=0,fabric=0,matching=0,white=0,whiteKept=0,gold=0,goldKept=0;
        for(let i=0;i<p.data.length;i+=4){
          if(p.data[i+3]!==blue.data[i+3])sameAlpha=false;if(p.data[i+3]<100)continue;
          const [bh,bs,bl]=hsl(blue.data[i],blue.data[i+1],blue.data[i+2]),[h,s,l]=hsl(p.data[i],p.data[i+1],p.data[i+2]);
          if(bs>.18&&bh>175&&bh<275){fabric++;const distance=Math.min(Math.abs(h-th),360-Math.abs(h-th));if(s>.12&&h>185&&h<235&&distance>25)blueLeft++;if(distance<25)matching++;}
          const equal=p.data[i]===blue.data[i]&&p.data[i+1]===blue.data[i+1]&&p.data[i+2]===blue.data[i+2];
          if(bs<.1&&bl>.8){white++;if(equal)whiteKept++;}if(bh>20&&bh<65&&bs>.25&&bl>.3){gold++;if(equal)goldKept++;}
        }
        colorChecks.push({category,shape,name,color,width:p.width,height:p.height,sameAlpha,fabricPixels:fabric,targetHueFraction:matching/fabric,remainingBlueFraction:blueLeft/fabric,whiteTrimUnchanged:whiteKept===white,goldTrimUnchanged:goldKept===gold});
      }}
      const cards=Object.entries(expected).flatMap(([cat,list])=>list.map(shape=>`<article><b>${cat} · ${shape}</b><svg viewBox="5 26 22 22" width="170" height="180">${QPClothes.render(cat,shape,'#ff8ad4','f','#ffd0ac')}</svg></article>`));
      document.body.innerHTML='<main style="padding:20px;color:#193d5a;font-family:inherit"><h1>의상 원화 · 25개 독립 부위</h1><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:12px">'+cards.join('')+'</div></main>';
      document.body.style.cssText='height:auto;min-height:100vh;overflow:visible';
      document.querySelectorAll('article').forEach(e=>e.style.cssText='border:1px solid #7ca5be;border-radius:10px;background:#f4f8ff;display:flex;align-items:center;flex-direction:column;padding:8px;min-height:205px');
      return{atlas:QPClothes.atlas,tiles,colorChecks,unknownShape:QPClothes.render('top','does-not-exist','#ff8ad4')};
    });
    assert.equal(report.tiles.length,25);assert.equal(report.colorChecks.length,125);assert.equal(report.unknownShape,'');
    for(const tile of report.tiles){
      assert(tile.width>70&&tile.height>70&&tile.opaquePixels>5000,'Native garment must have substantial independent artwork: '+tile.category+'/'+tile.shape);
      const [x,y,w,h]=tile.sourceRect,[cx,cy,cw,ch]=tile.sourceCell;
      assert(x>=cx&&y>=cy&&x+w<=cx+cw&&y+h<=cy+ch,'Crop must remain inside its original source cell');
      if(tile.category==='top'&&tile.shape==='hood')assert.equal(tile.sourceUrl,'assets/sd-hood.png','Actual worn hood must use the lowered-hood painting');
      else assert(tile.width<=315&&tile.height<=315,'Atlas garments must retain independent cells');
    }
    for(const c of report.colorChecks){assert(c.sameAlpha);assert(c.targetHueFraction>.95,JSON.stringify(c));assert(c.remainingBlueFraction<.01,JSON.stringify(c));assert(c.whiteTrimUnchanged&&c.goldTrimUnchanged,JSON.stringify(c));}
    const out=path.resolve(__dirname,'../검증');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'의상-25종.png'),fullPage:true});
    await page.waitForFunction(()=>window.QPAvatar?.atlas.ready===true);
    report.worn=await page.evaluate(async()=>{
      const styles=[
        {name:'분홍 후드 · 보라 주름치마',sex:'f',hair:'bob:1',top:'hood:7',bottom:'pleat:6'},
        {name:'민트 셔츠 · 갈색 청바지',sex:'m',hair:'part:0',top:'shirt:4',bottom:'jeans:11'},
        {name:'크림 세일러 · 분홍 별치마',sex:'f',hair:'long:2',top:'sailor:10',bottom:'star_skirt:7'},
        {name:'보라 니트 · 크림 카고바지',sex:'m',hair:'short:1',top:'knit:6',bottom:'cargo:10'},
        {name:'갈색 가디건 · 민트 치마',sex:'f',hair:'braid:1',top:'cardi:11',bottom:'skirt:4'}
      ];
      const avatars=styles.map(p=>Object.assign(QPGame.newAvatar(p.sex),p,{sk:0,expression:'bright:0',shoes:'sneaker:8',hat:'',glass:'',face:'',ear:'',neck:'',back:'',pet:'',bg:'',frame:''}));
      document.body.innerHTML='<main style="padding:24px;color:#193d5a;font-family:inherit"><h1>분홍 · 민트 · 크림 · 보라 · 갈색</h1><p>상의와 하의를 따로 골라 입은 실제 전신</p><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px">'+avatars.map((av,i)=>'<article style="background:#fffcf7;border:1px solid #bfd2e3;border-radius:20px;padding:20px 8px;display:flex;align-items:center;flex-direction:column;min-height:560px">'+QPAvatar.render(av,400,3)+'<p style="font-size:19px;margin-top:24px;text-align:center">'+styles[i].name+'</p></article>').join('')+'</div></main>';
      document.body.style.cssText='height:auto;min-height:100vh;overflow:visible;background:#edf5ff';
      const freeze=document.createElement('style');freeze.textContent='.qp-pixel-avatar *{animation:none!important}';document.head.appendChild(freeze);
      await Promise.all([...document.querySelectorAll('image')].map(async node=>{const img=new Image();img.src=node.getAttribute('href');await img.decode();}));
      await document.fonts.ready;
      return [...document.querySelectorAll('article')].map((card,i)=>({name:styles[i].name,sex:card.querySelector('[data-qpx-sex]').dataset.qpxSex,garments:[...card.querySelectorAll('.qpc-garment')].map(g=>({category:g.dataset.qpcCategory,shape:g.dataset.qpcShape,sex:g.dataset.qpcSex,width:+g.querySelector('image').getAttribute('width'),height:+g.querySelector('image').getAttribute('height')}))}));
    });
    assert.equal(report.worn.length,5);
    for(const av of report.worn){assert.equal(av.garments.length,2,'Actual worn avatar must have separate raster top and bottom: '+av.name);assert.deepEqual(av.garments.map(g=>g.category).sort(),['bottom','top']);for(const g of av.garments){assert.equal(g.sex,av.sex);assert(g.width>70&&g.height>70);}}
    await page.screenshot({path:path.join(out,'의상-다섯색-전신.png'),fullPage:true});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'의상검증.json'),JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors},null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
