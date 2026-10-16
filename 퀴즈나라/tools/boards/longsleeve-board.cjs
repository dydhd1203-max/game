'use strict';
// 긴팔 움직임 확인판(?demo=1 studio, 저장 안 함): 기본 티셔츠 기록을 복사해 종류를 top/long-sleeve로 바꾸고,
// 팔마다 '팔 띠 모양 소매'(top.armSleeves[i])를 정리한 팔 그림에서 손목 위까지 티셔츠 색으로 칠해 만든 시험용 긴팔을
// 등록한다. 남녀 × 앞·옆·뒤 × 서기·걷기·뛰기·점프·손 흔들기·사다리·책상 앉기를 그린다(원화 전 움직임 시험).
// 예: node tools/boards/longsleeve-board.cjs . 검증/긴팔/판.png [크기]
const ROOT=process.argv[2],OUT=process.argv[3],SIZE=Number(process.argv[4])||280;
const path=require('node:path'),fs=require('node:fs');
const L=require(path.resolve(ROOT,'tools/foundation-garment-lib.cjs')),H=L.H;
(async()=>{
  const server=await H.serve(H.fsTree(ROOT));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:3600,height:3000}});
  await L.install(page,{});
  const res=await page.evaluate(async()=>{
    const G=__fg.G,Sk=window.QPFoundationSkin;await Sk.loadClean();
    const arms=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src='assets/sd-foundation-ref-arms-clean.png';});
    const src=__fg.clone(G.get('top:tee','m').record);src.id='top:longtest';src.shape='longtest';src.class='top/long-sleeve';
    const views={front:'Front',right:'Profile',back:'Back'},images={};
    for(const sex of Object.keys(src.sexes)){
      const base=G.get('top:tee',sex).image,bw=base.naturalWidth||base.width,bh=base.naturalHeight||base.height;
      const strips=[];for(const [v,V] of Object.entries(views))for(const i of [0,1]){const d=Sk.limbDef('arm',sex,V,i,'clean');strips.push({v,i,d});}
      const extraH=Math.max(...strips.map(s=>s.d.rect[3]))+4,totalW=Math.max(bw,strips.reduce((a,s)=>a+s.d.rect[2]+4,0));
      const c=document.createElement('canvas');c.width=totalW;c.height=bh+extraH;const x=c.getContext('2d');x.drawImage(base,0,0);
      // the tee's own colour (its opaque median) shades the painted arm, cut at the wrist
      const tc=document.createElement('canvas');tc.width=bw;tc.height=bh;const tx=tc.getContext('2d');tx.drawImage(base,0,0);const td=tx.getImageData(0,0,bw,bh).data,cols=[];
      for(let p=0;p<td.length;p+=4)if(td[p+3]>250)cols.push([td[p],td[p+1],td[p+2]]);cols.sort((a,b)=>a[0]+a[1]+a[2]-b[0]-b[1]-b[2]);const cloth=cols[Math.floor(cols.length*.55)];
      let ax=0;for(const s of strips){const [rx,ry,rw,rh]=s.d.rect,wrist=s.d.joints[2][1]-ry-2;
        const sc=document.createElement('canvas');sc.width=rw;sc.height=rh;const sx=sc.getContext('2d');sx.drawImage(arms,rx,ry,rw,rh,0,0,rw,rh);const im=sx.getImageData(0,0,rw,rh),q=im.data;
        for(let y=0;y<rh;y++)for(let xx=0;xx<rw;xx++){const k=(y*rw+xx)*4;if(y>=wrist){q[k+3]=0;continue;}const l=(q[k]+q[k+1]+q[k+2])/3/235;q[k]=Math.min(255,cloth[0]*l);q[k+1]=Math.min(255,cloth[1]*l);q[k+2]=Math.min(255,cloth[2]*l);}
        sx.putImageData(im,0,0);x.drawImage(sc,ax,bh+2);
        const f=src.sexes[sex].figures[s.v].top;(f.armSleeves=f.armSleeves||[])[s.i]={rect:[rx,ry,rw,rh],at:[ax,bh+2]};ax+=rw+4;}
      images[sex]=c;src.sexes[sex].size=[c.width,c.height];}
    return await G.register(src,images);
  });
  if(Object.values(res).some(s=>s!=='ready'))throw new Error('register: '+JSON.stringify(res));
  const outfits=await page.evaluate(()=>Object.fromEntries(['m','f'].map(sex=>[sex,{...__fg.outfitFor(null,sex),top:'top:longtest'}])));
  const states=[{action:'idle',time:0},{action:'walk',time:.18},{action:'run',time:.12},{action:'jump',time:.3},{action:'idle',gesture:'wave',gestureProgress:.5,time:0},{action:'climb',time:.2},{action:'sit',seatMode:'desk',time:0}];
  const cells=[];
  for(const sex of ['m','f'])for(const direction of ['front','right','back'])for(const st of states)cells.push({av:{sex,sk:2,hair:(sex==='m'?'short':'bob')+':1',expression:'bright:0',foundationGarments:outfits[sex]},state:{...st,direction,reducedMotion:false},size:SIZE});
  const g=await page.evaluate(spec=>__fg.grid(spec),{cells,cols:states.length,cellW:Math.round(SIZE*.62),cellH:Math.round(SIZE*1.15),labelW:0});
  const info=await page.evaluate(()=>({shown:[...document.querySelectorAll('[data-outfit-part^="arm-sleeve-"]')].filter(e=>e.style.display!=='none'&&e.getAttribute('href')).length,all:document.querySelectorAll('[data-outfit-part^="arm-sleeve-"]').length}));
  fs.mkdirSync(path.dirname(OUT),{recursive:true});await L.capture(page,g,OUT);
  console.log(JSON.stringify({...info,cls:g.info[0].cls,nodes:g.info[0].nodes,errors:report.errors}));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
