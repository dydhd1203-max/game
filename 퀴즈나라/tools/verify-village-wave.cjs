/* Inspect actual greeting paint, contact and reversible poses in an isolated demo. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=path.resolve(__dirname,'../검증'),base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUIZ_BROWSER_EXECUTABLE||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1800,height:1100}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/www.gstatic.com/firebasejs/**',route=>route.fulfill({body:'/* isolated greeting QA */',contentType:'text/javascript'}));
    await page.goto(new URL('?demo=1&demo_key=village-wave-'+Date.now(),base).href);
    await page.waitForFunction(()=>window.QPGame?.getMe()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPShoes.atlas.partsReady&&QPShoes.atlas.partsCount===18);
    const report=await page.evaluate(async()=>{
      document.head.insertAdjacentHTML('beforeend','<style>.qp-illustrated-avatar *{animation:none!important}.qpx-blink-half,.qpx-blink-closed{opacity:0!important}body{height:auto!important;overflow:visible!important;display:block!important;background:#fff7e8!important;color:#57432e}</style>');
      const av={...QPGame.getMe().av,sex:'m',hair:'messy:1',expression:'bright:0',bottom:'jeans:5',shoes:'sneaker:8',pet:'',hat:'',glass:'',face:'',ear:'',neck:'',back:'',effect:'',bg:'',frame:''};
      const host=document.createElement('div');document.body.replaceChildren(host);
      const drawable='path,ellipse,rect,image,polygon,line,polyline,circle';
      async function paint(svg,selector){
        const clone=svg.cloneNode(true),selected=selector?new Set(clone.querySelectorAll(selector)):null;
        if(selected)for(const leaf of clone.querySelectorAll(drawable)){
          if(leaf.closest('defs'))continue;
          let current=leaf,keep=false;while(current&&current!==clone){if(selected.has(current)){keep=true;break;}current=current.parentElement;}if(!keep)leaf.remove();
        }
        const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
        const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,points=[];
        for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]>100)points.push([x*32/canvas.width,y*56/canvas.height]);
        const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
        let signature=2166136261;for(const value of data)signature=Math.imul(signature^value,16777619)>>>0;
        return{data:Array.from(data),points,signature,bounds:points.length?[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]:null};
      }
      const equal=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);
      function gap(a,b){let nearest=3;for(const [x,y]of a.points)for(const [xx,yy]of b.points){if(Math.abs(xx-x)>=nearest||Math.abs(yy-y)>=nearest)continue;nearest=Math.min(nearest,Math.hypot(xx-x,yy-y));if(nearest===0)return 0;}return nearest;}
      const cases=[],climbCases=[],samples=[.22,.3125,.4375,.58,.72],footSelector='.qps-foot[data-qps-foot-side]';
      for(const top of ['tee','hood','tank'])for(const sk of [0,4])for(const size of [70,88,224]){
        host.innerHTML=QPAvatar.render({...av,top:top+':7',sk},size,3);const svg=host.firstElementChild;
        QPAvatarPose.prepare(svg);QPAvatarPose.reset(svg);
        const baseline=await paint(svg),feet=await paint(svg,footSelector),hand=await paint(svg,'.qpx-body .qpx-hand-right');
        for(const progress of samples){
          QPAvatarPose.apply(svg,{action:'idle',gesture:'wave',gestureProgress:progress});
          const [wave,body,palm,currentFeet,sleeve,skin]=await Promise.all([
            paint(svg,'[data-qpx-gesture-layer="wave"]'),paint(svg,'.qpx-body'),paint(svg,'[data-qpx-gesture-layer="wave"] .qpx-hand-right'),paint(svg,footSelector),
            paint(svg,'[data-qpx-wave-sleeve]'),paint(svg,'[data-qpx-gesture-layer="wave"] [data-qpx-arm-side="right"]')
          ]);
          cases.push({top,sk,size,progress,handPixels:palm.points.length,handRise:hand.bounds[1]-palm.bounds?.[1],shoulderGap:gap(wave,body),cuffGap:top==='tank'?null:gap(sleeve,skin),feetIdentical:equal(feet.data,currentFeet.data),handBounds:palm.bounds,handSignature:palm.signature});
        }
        // Both a completed gesture and an interrupted gesture restore the
        // actual native painting; hidden copies cannot alter normal poses.
        QPAvatarPose.apply(svg,{action:'idle',gesture:'wave',gestureProgress:1});QPAvatarPose.reset(svg);
        if(!equal(baseline.data,(await paint(svg)).data))throw Error('Completed wave changes resting paint '+top+'/'+sk+'/'+size);
        QPAvatarPose.apply(svg,{action:'idle',gesture:'wave',gestureProgress:.4});QPAvatarPose.apply(svg,{action:'walk',phase:.25});
        if(svg.dataset.qpxGesture||svg.querySelector('[data-qpx-gesture-layer="wave"]').style.display!=='none')throw Error('Movement must cancel wave');
        QPAvatarPose.reset(svg);if(!equal(baseline.data,(await paint(svg)).data))throw Error('Interrupted wave changes resting paint');
        for(const gesture of ['nod','happy']){
          const heads=[];
          for(const progress of samples){
            QPAvatarPose.apply(svg,{action:'idle',gesture,gestureProgress:progress});
            if(!equal(feet.data,(await paint(svg,footSelector)).data))throw Error(gesture+' must keep the native feet planted');
            heads.push((await paint(svg,'.qpx-head')).signature);
            const front=svg.querySelector('[data-qpx-pose-part="head"]'),back=svg.querySelector('[data-qpx-pose-part="back-hair"]');
            if(back&&front.getAttribute('transform')!==back.getAttribute('transform'))throw Error('Greeting must keep front and back hair together');
          }
          if(new Set(heads).size<3)throw Error(gesture+' must show continuous head movement');
        }
        QPAvatarPose.destroy(svg);if(svg.querySelector('[data-qpx-gesture-layer]'))throw Error('Destroy must remove foreground gesture layer');
      }
      for(const top of ['tee','hood','tank','robe','space'])for(const sk of [0,4])for(const size of [88,224]){
        host.innerHTML=QPAvatar.render({...av,top:top+':7',sk},size,3);const svg=host.firstElementChild;
        QPAvatarPose.prepare(svg);QPAvatarPose.reset(svg);const baseline=await paint(svg),hands=[];
        for(const phase of [0,1/12,1/6,1/4]){
          QPAvatarPose.apply(svg,{action:'climb',phase,grounded:false});
          const row={top,sk,size,phase,feet:[],hands:[]};
          for(const side of ['left','right']){
            const [arm,body,palm,foot,leg]=await Promise.all([
              paint(svg,'[data-qpx-pose-part="'+side+'-gesture-arm"]'),paint(svg,'.qpx-body'),paint(svg,'[data-qpx-gesture-arm="'+side+'"] .qpx-hand-'+side),
              paint(svg,'.qps-foot[data-qps-foot-side="'+side+'"]'),paint(svg,'[data-qpx-pose-part="'+side+'-leg"]')
            ]);
            const bounds=palm.bounds||arm.bounds;
            row.hands.push({side,shoulderGap:gap(arm,body),palmPixels:palm.points.length,bounds,centerY:(bounds[1]+bounds[3])/2,centerX:(bounds[0]+bounds[2])/2});
            row.feet.push({side,pixels:foot.points.length,ankleGap:gap(foot,leg)});
          }
          if(svg.dataset.qpxPose!=='climb'||getComputedStyle(svg.querySelector('.qpx-contact-shadow')).visibility!=='hidden')throw Error('Climber must have an airborne rope pose');
          hands.push(row.hands);climbCases.push(row);
        }
        // Native gloved space sleeves have no separate vector palm node;
        // the other styles must visibly exchange the upper and lower grips.
        if(top!=='space'){
          const differences=hands.map(pair=>pair[0].centerY-pair[1].centerY);
          if(Math.max(...differences)<.8||Math.min(...differences)>-.8)throw Error('Climbing hands must alternate upper/lower grips '+top+'/'+sk+'/'+size);
        }
        QPAvatarPose.reset(svg);if(!equal(baseline.data,(await paint(svg)).data))throw Error('Climbing must restore the exact resting painting');
        QPAvatarPose.destroy(svg);
      }
      const gallery=[...['tee','hood','tank'].flatMap(top=>[0,4].flatMap(sk=>[.25,.3125,.4375].map(progress=>({top,sk,progress,size:224})))),...['tee','hood','tank'].flatMap(top=>[0,4].flatMap(sk=>[70,88].map(size=>({top,sk,progress:.3125,size}))))];
      document.body.innerHTML='<h1 style="margin:20px">소매와 손을 함께 드는 인사 · 224px / 작은70·88px</h1><main style="display:grid;grid-template-columns:repeat(9,200px)">'+gallery.map(item=>'<article style="display:flex;flex-direction:column;align-items:center;padding:8px;background:#fff8eb;border:1px solid #ddcdb7"><b>'+item.top+' · 피부'+item.sk+' · '+item.size+'px</b>'+QPAvatar.render({...av,top:item.top+':7',sk:item.sk},item.size,3)+'</article>').join('')+'</main>';
      for(const[index,svg]of [...document.querySelectorAll('article>svg')].entries())QPAvatarPose.apply(svg,{action:'idle',gesture:'wave',gestureProgress:gallery[index].progress});
      return{cases,climbCases,restorationCases:18,footPlantEmotionCases:180,climbRestorationCases:20};
    });
    await page.screenshot({path:path.join(out,'숲속마을-인사-224-70-88.png'),fullPage:true});
    await page.evaluate(()=>{
      const av={...QPGame.getMe().av,sex:'m',sk:4,hair:'messy:1',expression:'bright:0',bottom:'jeans:5',shoes:'sneaker:8',pet:'',hat:'',glass:'',face:'',ear:'',neck:'',back:'',effect:'',bg:'',frame:''};
      const frames=[224,88].flatMap(size=>['tee','hood','tank','robe','space'].flatMap(top=>[0,1/12,1/6,1/4].map(phase=>({top,size,phase}))));
      document.body.innerHTML='<h1 style="margin:20px">양손·무릎을 번갈아 움직이는 등반 포즈 · 224px / 88px</h1><main style="display:grid;grid-template-columns:repeat(8,225px)">'+frames.map(item=>'<article style="display:flex;flex-direction:column;align-items:center;padding:8px;background:#fff8eb;border:1px solid #ddcdb7"><b>'+item.top+' · '+item.size+'px · '+item.phase.toFixed(2)+'</b>'+QPAvatar.render({...av,top:item.top+':7'},item.size,3)+'</article>').join('')+'</main>';
      for(const[index,svg]of [...document.querySelectorAll('article>svg')].entries())QPAvatarPose.apply(svg,{action:'climb',phase:frames[index].phase,grounded:false});
    });
    await page.screenshot({path:path.join(out,'숲속마을-등반-4시점-224-88.png'),fullPage:true});
    fs.writeFileSync(path.join(out,'숲속마을-인사-검증.json'),JSON.stringify(report,null,2));
    const failures=report.cases.filter(row=>row.handPixels<2||row.handRise<5||row.shoulderGap>.8||(row.cuffGap!==null&&row.cuffGap>.8)||!row.feetIdentical);
    const climbFailures=report.climbCases.filter(row=>row.feet.some(foot=>foot.pixels<4||foot.ankleGap>.8)||row.hands.some(hand=>hand.shoulderGap>.8));
    for(const size of [70,88,224])for(const top of ['tee','hood','tank'])for(const sk of [0,4]){
      const rows=report.cases.filter(row=>row.size===size&&row.top===top&&row.sk===sk);
      // A 70px palm has only a few pixels, so use its complete antialiased
      // painting as well as its occupied positions to observe the motion.
      assert(new Set(rows.map(row=>JSON.stringify(row.handBounds))).size>=2,'Hand must occupy multiple visible positions');
      assert(new Set(rows.map(row=>row.handSignature)).size>=3,'Hand painting must visibly oscillate across greeting samples');
    }
    console.log(JSON.stringify({waveCases:report.cases.length,climbCases:report.climbCases.length,restorationCases:report.restorationCases,climbRestorationCases:report.climbRestorationCases,footPlantEmotionCases:report.footPlantEmotionCases,failures,climbFailures,errors},null,2));
    assert.deepEqual(failures,[]);assert.deepEqual(climbFailures,[]);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
