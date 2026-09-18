// One hidden browser, real game building meshes/materials. No mouse/keyboard
// automation; pw.mjs prevents pointer lock. Always closes the browser/server.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const out=path.resolve('artifacts/56-buildings');fs.mkdirSync(out,{recursive:true});
const server=serve(8956,process.argv[2]||GAME);let browser;
try{
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:930}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8956/?gfx=low',{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__READY===true,null,{timeout:60000});
  await page.evaluate(()=>{document.getElementById('iName').value='건물 갤러리';document.getElementById('bSolo').click();});
  await page.waitForFunction(()=>window.__G.started);
  await page.evaluate(()=>{window.__DBG().noRender=true;window.__DBG().noLogic=true;window.__G.paused=true;window.__G.day=8;window.__G.phase='day';window.__G.me.g=0;});
  const types=['wwall','swall','arrow','ice','barr','pulse'];
  const sets=[
    {name:'levels',cols:6,title:'따뜻한 모둠 기지 · 1 / 4 / 7 단계',cards:[1,4,7].flatMap(lv=>types.map(t=>({t,lv,branch:'',style:0})))},
    {name:'specializations',cols:4,title:'화살탑과 얼음탑 · 서로 다른 특화 모습',cards:[4,7].flatMap(lv=>[['arrow','rapid'],['arrow','sniper'],['ice','blizzard'],['ice','frost']].map(([t,branch])=>({t,lv,branch,style:0})))},
    {name:'themes',cols:4,title:'우리 모둠 꾸미기 · 기본 / 동물 깃발 / 파스텔 지붕 / 별등불',cards:['barr','pulse'].flatMap(t=>[0,1,2,3].map(style=>({t,lv:5,branch:'',style})))}
  ];
  for(const set of sets){
    const report=await page.evaluate(({cols,cards,title})=>{
      const W=window,T=W.__THREE,R=W.__R,width=1440,height=930,top=66,rows=Math.ceil(cards.length/cols),cw=width/cols,ch=(height-top)/rows;
      document.querySelectorAll('body > :not(canvas)').forEach(e=>e.style.display='none');
      const canvas=R.domElement;canvas.style.cssText='position:fixed;inset:0;width:1440px;height:930px;z-index:100000;display:block;';
      R.setRenderTarget(null);R.setPixelRatio(1);R.setSize(width,height,false);R.setScissorTest(false);R.setClearColor(0xf5f8f4,1);R.clear();R.setScissorTest(true);
      document.getElementById('buildingGalleryLabels')?.remove();
      const labels=document.createElement('div');labels.id='buildingGalleryLabels';labels.style.cssText='position:fixed;inset:0;z-index:100001;pointer-events:none;color:#365768;font-family:Arial,"Noto Sans KR",sans-serif;';
      const heading=document.createElement('div');heading.textContent=title;heading.style.cssText='padding:20px 28px;font-size:22px;font-weight:600;';labels.appendChild(heading);document.body.appendChild(labels);
      const branchNames={rapid:'연사 기관총',sniper:'대형 저격총',blizzard:'눈보라',frost:'빙결'},styleNames=['기본','동물 깃발','파스텔 지붕','별등불'];
      const counts=[];
      cards.forEach((card,i)=>{
        const x=i%cols*cw,y=top+Math.floor(i/cols)*ch,B=W.__BUILD[card.t],center=B.size===2?1:.5;
        W.__G.paused=false;W.__buildApi.setFortStyle(card.style);W.__G.paused=true;
        W.__STRU.clear();W.__STRU.set('gallery',{id:'gallery',t:card.t,x:0,z:0,lv:card.lv,g:0,hp:100,mx:100,branch:card.branch,style:card.style});W.__rebuild();
        const scene=new T.Scene(),group=new T.Group();group.position.set(-center,-W.__GY,-center);scene.add(group);
        for(const mesh of W.__struMeshes.values())if(mesh.count){const copy=mesh.clone();copy.instanceMatrix=mesh.instanceMatrix.clone();copy.instanceColor=mesh.instanceColor.clone();copy.frustumCulled=false;group.add(copy);}
        scene.add(new T.HemisphereLight(0xdfe6ec,0x5a7a4a,.95));
        const sun=new T.DirectionalLight(0xffffff,1.15);sun.position.set(-3,6,5);scene.add(sun);
        scene.add(new T.AmbientLight(0xffffff,.30));
        const floor=new T.Mesh(new T.PlaneGeometry(4.4,4.4),new T.MeshLambertMaterial({color:0xdbe7d9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;scene.add(floor);
        const camera=new T.OrthographicCamera(-2.05,2.05,2.45,-1.65,.1,40);camera.position.set(5,4.5,7);camera.lookAt(0,1.18,0);
        R.setViewport(x+5,height-y-ch+30,cw-10,ch-37);R.setScissor(x+5,height-y-ch+30,cw-10,ch-37);R.render(scene,camera);
        floor.geometry.dispose();floor.material.dispose();
        const label=document.createElement('div');label.textContent=B.name+'  Lv.'+card.lv+(card.branch?' · '+branchNames[card.branch]:'')+(card.style?' · '+styleNames[card.style]:'');
        label.style.cssText='position:absolute;text-align:center;font-size:15px;font-weight:600;left:'+x+'px;top:'+(y+ch-27)+'px;width:'+cw+'px;';labels.appendChild(label);
        counts.push({t:card.t,lv:card.lv,branch:card.branch,style:card.style,parts:W.__blocks(card.t,card.lv,card.branch,card.style).length});
      });
      R.setScissorTest(false);
      const snapshot=document.createElement('img');snapshot.id='buildingGallerySnapshot';snapshot.src=canvas.toDataURL('image/png');
      snapshot.style.cssText='position:fixed;inset:0;width:1440px;height:930px;z-index:100000;display:block;';
      document.getElementById('buildingGallerySnapshot')?.remove();document.body.appendChild(snapshot);
      return counts;
    },set);
    await page.evaluate(()=>document.getElementById('buildingGallerySnapshot').decode());
    await page.screenshot({path:path.join(out,set.name+'.png')});console.log(set.name,JSON.stringify(report));
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Real WebGL building galleries saved. No OS input used.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
