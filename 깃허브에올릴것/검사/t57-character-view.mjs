// Real game and preview WebGL renders. pw.mjs enforces hidden execution and
// blocks pointer lock; this suite never sends operating-system input.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from './pw.mjs';
import {serve} from './serve2.mjs';
import {GAME} from './gamefile.mjs';
const out=path.resolve('artifacts/57-character');fs.mkdirSync(out,{recursive:true});
const server=serve(8957,process.argv[2]||GAME),reports=[],errors=[];let browser;
const check=(name,ok,detail)=>{reports.push({name,ok,detail});console.log((ok?'PASS ':'FAIL ')+name+(detail?' '+JSON.stringify(detail):''));};
try{
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
  for(const quality of ['low','mid']){
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader|GL_INVALID|compile/i.test(m.text()))errors.push(m.text());});
    await page.goto('http://127.0.0.1:8957/?gfx='+quality,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>window.__READY===true,null,{timeout:60000});
    const preview=await page.evaluate(()=>{
      const W=window,P=W.__pvw(),A=W.__avatarPreview;
      if(!P||!A)return {available:false};
      A.set(P,{g:2,hat:4,gls:8,clo:2});W.__pvwSpin(P,0);
      const pose=P.body.map(m=>({geometry:m.geometry.uuid,position:m.position.toArray(),scale:m.scale.toArray(),q:m.quaternion.toArray()}));
      const icon=A.table(A.rows,{body:W.__GHEX[2]}),same=icon.children.every((m,i)=>m.geometry===P.body[i].geometry&&m.position.distanceTo(P.body[i].position)<1e-7&&m.quaternion.angleTo(P.body[i].quaternion)<1e-7);
      icon.children.forEach(m=>m.material.dispose());
      let constantBody=true;for(let job=0;job<3;job++)for(let jt=1;jt<=2;jt++){A.set(P,{g:2,job,jt});constantBody&&=P.body.every((m,i)=>m.scale.toArray().every((n,k)=>Math.abs(n-pose[i].scale[k])<1e-7));}
      A.set(P,{g:2,hat:4,gls:8,clo:2});W.__pvwSpin(P,0);
      return {available:true,body:pose.length,shoe:A.rows.filter(r=>r[7]==='r6shoe').length,segments:A.rows.filter(r=>r[7]==='r6limb').length,iconMatches:same,constantBody,texture:!!P.shadow?.material.map,quality:W.__GFX_Q};
    });
    check(quality+' lobby and human icons share constant-size articulated geometry',preview.available&&preview.shoe===2&&preview.segments===8&&preview.iconMatches&&preview.constantBody&&preview.texture,preview);
    await page.screenshot({path:path.join(out,quality+'-lobby.png')});
    await page.evaluate(()=>{document.getElementById('iName').value='캐릭터 검사';document.getElementById('bSolo').click();});
    await page.waitForFunction(()=>window.__G.started);
    await page.evaluate(()=>{const W=window;W.__DBG().noRender=true;W.__DBG().noLogic=true;W.__G.paused=true;W.__G.day=3;W.__G.phase='day';});
    const aiming=await page.evaluate(()=>{
      const W=window,T=W.__THREE,P=W.__PL,G=W.__G,C=W.__cam,scale=W.__avatarRender().scale;
      if(!(scale>0))throw Error('Actual avatar scale API is required');
      G.phase='day';G.mini=null;G.players.clear();W.__KEY.w=false;W.__KEY.shift=false;W.__kbReset();W.__recoilReset();W.__shakeReset();
      let spot;outer:for(let x=-30;x<=30;x+=3)for(let z=-30;z<=30;z+=3){const y=W.__groundUnder(x,z,P.R);if(y<0||y>80)continue;
        if([[0,0],[2,0],[-2,0],[0,4],[0,-4]].every(([dx,dz])=>Math.abs(W.__groundUnder(x+dx,z+dz,P.R)-y)<.01)){spot={x,z,y};break outer;}}
      if(!spot)throw Error('No open ground for aiming');
      Object.assign(P,spot,{vy:0,ground:true,down:false,yaw:0,pitch:-.16,landT:0,jumps:0});W.__setAim(true);W.__KIT.wpn=3;
      const ray=new T.Raycaster(),report=[],bodyScale=[];W.__aimShots=[];
      for(let jb=0;jb<3;jb++)for(let jt=1;jt<=2;jt++){
        W.__XP.job=jb;W.__XP.jt=jt;for(let i=0;i<90;i++){W.__updPlayer(1/60);W.__fovTick(1/60);}C.updateMatrixWorld(true);
        const s=W.__meSheep();Object.assign(s,{x:P.x,y:P.y,z:P.z,ry:P.yaw,g:2,ph:0,mv:false,down:false,wp:3,we:0,hat:0,gls:0,clo:0,jb,jt,air:false,glide:false,land:0,take:0,flip:0,kick:0,aim:true,me:true});
        W.__drawSheep([s],10,40,a=>W.__GHEX[a.g],scale);
        const meshes=[...W.__charMeshes().사람,...W.__P_wing(),...W.__P_wingG()].filter(m=>m.count&&m.visible&&m.material.opacity!==0);
        meshes.forEach(m=>{m.updateMatrixWorld(true);m.computeBoundingSphere();});
        const blocked=[];for(const [x,y] of [[0,0],[-.055,0],[.055,0],[0,-.055],[0,.055]]){ray.setFromCamera(new T.Vector2(x,y),C);const hits=ray.intersectObjects(meshes,false);if(hits.length)blocked.push({x,y,mesh:meshes.indexOf(hits[0].object),instance:hits[0].instanceId});}
        const matrix=new T.Matrix4(),size=new T.Vector3();W.__Pmesh()[0].getMatrixAt(0,matrix);matrix.decompose(new T.Vector3(),new T.Quaternion(),size);bodyScale.push(size.toArray());
        W.__render();W.__aimShots.push({jb,jt,src:W.__R.domElement.toDataURL()});
        report.push({jb,jt,blocked,hidden:W.__camRig().hidden,shoulder:W.__camRig().shoulder,distance:W.__camRig().distance});
      }
      const constantBody=bodyScale.every(a=>a.every((v,i)=>Math.abs(v-bodyScale[0][i])<1e-6));
      const grid=W.__bldH,side=Math.sqrt(grid.length),half=(side-1)/2,saved=[],wallZ=Math.floor(P.z)+1;let wall;
      try{
        for(let x=Math.floor(P.x)-2;x<=Math.floor(P.x)+2;x++){const i=(x+half)+(wallZ+half)*side;saved.push([i,grid[i]]);grid[i]=P.y+4;}
        const hidden=[];for(let i=0;i<24;i++){P.z=spot.z+(i%2?.015:-.015);W.__updPlayer(1/60);hidden.push(W.__camRig().hidden);}
        wall={hiddenStable:hidden.every(Boolean),nearDistance:W.__camRig().distance};
      }finally{for(const [i,value] of saved)grid[i]=value;P.z=spot.z;}
      for(let i=0;i<90;i++)W.__updPlayer(1/60);wall.restored=!W.__camRig().hidden;wall.restoredDistance=W.__camRig().distance;
      W.__setAim(false);W.__XP.job=-1;W.__XP.jt=0;return {report,constantBody,wall};
    });
    check(quality+' all six job tiers keep the same body size',aiming.constantBody);
    check(quality+' actual shoulder-camera reticle stays clear of body and folded wings',aiming.report.every(r=>!r.hidden&&r.blocked.length===0),aiming.report);
    check(quality+' close rear wall keeps aiming body hidden without flicker and restores it outside',aiming.wall.hiddenStable&&aiming.wall.nearDistance<1.45&&aiming.wall.restored&&aiming.wall.restoredDistance>1.75,aiming.wall);
    await page.evaluate(async()=>{const panel=document.createElement('div');panel.id='aimGallery';panel.style.cssText='position:fixed;inset:0;z-index:100010;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);background:#eff6f3;';
      for(const shot of window.__aimShots){const card=document.createElement('div');card.style.cssText='position:relative;display:grid;place-items:center;overflow:hidden;';const im=document.createElement('img');im.src=shot.src;im.style.cssText='width:100%;height:100%;object-fit:contain';card.appendChild(im);
        const label=document.createElement('div');label.textContent=`직업 ${shot.jb+1} · ${shot.jt}차 · 실제 조준 카메라`;label.style.cssText='position:absolute;top:14px;left:12px;color:#244c64;font:600 17px Arial;background:#ffffffe0;padding:6px 10px;border-radius:8px;';card.appendChild(label);
        const reticle=document.createElement('div');reticle.style.cssText='position:absolute;left:50%;top:50%;width:16px;height:16px;border:2px solid white;border-radius:50%;box-shadow:0 0 0 1px #294657;transform:translate(-50%,-50%);';card.appendChild(reticle);panel.appendChild(card);}
      document.body.appendChild(panel);await Promise.all([...panel.querySelectorAll('img')].map(im=>im.decode()));});
    await page.screenshot({path:path.join(out,quality+'-aim-six-jobs.png')});
    await page.evaluate(()=>{document.getElementById('aimGallery')?.remove();window.__aimShots=[];});
    for(const night of [false,true]){
      const world=await page.evaluate(night=>{
        const W=window,T=W.__THREE,R=W.__R,PL=W.__PL;
        document.querySelectorAll('body > :not(canvas)').forEach(e=>e.style.display='none');
        const x=PL.x,z=PL.z,y=W.__groundUnder(x,z,0);Object.assign(PL,{y});
        W.__G.phase=night?'night':'day';W.__setSky(night?1:0);W.__updSky(.001);
        const actor={x,y,z,ry:Math.PI,g:2,ph:0,mv:false,hat:4,gls:0,clo:2,jb:-1,jt:0,wp:0};
        W.__drawSheep([actor],5,40,s=>W.__GHEX[s.g],W.__avatarRender().scale);
        W.__cam.position.set(x+2.1,y+1.7,z+3.6);W.__cam.lookAt(x,y+.95,z);W.__cam.updateMatrixWorld(true);
        W.__shadowFollow?.(x,z,0);R.setRenderTarget(null);R.setPixelRatio(1);R.setSize(1440,1000,false);R.setViewport(0,0,1440,1000);R.setScissorTest(false);W.__render();
        const copy=document.createElement('canvas');copy.width=1440;copy.height=1000;const context=copy.getContext('2d');context.drawImage(R.domElement,0,0);const shadowOn=context.getImageData(0,0,1440,1000).data;
        const contact=W.__avatarRender().contact;contact.visible=false;W.__render();context.drawImage(R.domElement,0,0);const shadowOff=context.getImageData(0,0,1440,1000).data;let shadowPixels=0,shadowDelta=0;
        for(let i=0;i<shadowOn.length;i+=4){const d=Math.abs(shadowOn[i]-shadowOff[i])+Math.abs(shadowOn[i+1]-shadowOff[i+1])+Math.abs(shadowOn[i+2]-shadowOff[i+2]);if(d>3){shadowPixels++;shadowDelta+=d;}}
        contact.visible=true;W.__render();
        const old=document.getElementById('avatarSnapshot');old?.remove();const img=document.createElement('img');img.id='avatarSnapshot';img.src=R.domElement.toDataURL();img.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:100000;';document.body.appendChild(img);
        return {quality:W.__GFX_Q,ground:y,shadow:W.__avatarRender?.().contact.count,shadowPixels,shadowDelta,triangles:R.info.render.triangles};
      },night);
      await page.evaluate(()=>document.getElementById('avatarSnapshot').decode());
      await page.screenshot({path:path.join(out,quality+'-'+(night?'night':'day')+'-world.png')});
      check(quality+' '+(night?'night':'day')+' actual game scene renders with visible contact shadow',world.shadow===1&&world.shadowPixels>40&&world.shadowDelta>200&&world.triangles>1000&&Number.isFinite(world.ground),world);
    }
    const sets=[
      {name:'angles-motion',cols:4,title:'실제 캐릭터 · 앞 / 비스듬히 / 뒤 · 관절과 전신 동작',cards:[
        {label:'정면',angle:0},{label:'비스듬히',angle:.70},{label:'뒷모습',angle:Math.PI},{label:'걷기',mv:true,gp:.7},
        {label:'달리기',mv:true,run:true,gp:1.1},{label:'상승',air:true,vy:5,take:.2},{label:'최고점',air:true,vy:0},{label:'착지',land:.22},
        {label:'곡괭이 준비',act:'mine',actP:.23,tool:'mine'},{label:'곡괭이 타격',act:'mine',actP:.52,tool:'mine'},
        {label:'양손 총 · 반동',wp:3,kick:1},{label:'날개 활공',jb:1,jt:2,air:true,vy:-1,glide:true}]},
      {name:'outfits-jobs',cols:4,title:'귀여운 꾸미기와 직업 · 같은 몸체와 C자 손',cards:[
        {label:'민트 고양이',hat:9,gls:0,clo:2},{label:'크림 토끼',hat:4,gls:8,clo:3},{label:'곰돌이 잠옷',hat:6,gls:8,clo:4},{label:'분홍 리본',hat:3,gls:0,clo:10},
        {label:'직업 1 · 1차',jb:0,jt:1},{label:'직업 1 · 2차',jb:0,jt:2},{label:'직업 2 · 1차',jb:1,jt:1},{label:'직업 2 · 2차',jb:1,jt:2},
        {label:'직업 3 · 1차',jb:2,jt:1},{label:'직업 3 · 2차',jb:2,jt:2},{label:'직업 + 토끼 모자',jb:1,jt:2,hat:4,clo:2},{label:'C자 손과 신발',angle:-.70,hat:0,clo:0}]}
    ];
    for(const set of sets){
      const counts=await page.evaluate(({cols,cards,title})=>{
        const W=window,T=W.__THREE,R=W.__R,width=1440,height=1000,top=62,rows=Math.ceil(cards.length/cols),cw=width/cols,ch=(height-top)/rows;
        W.__G.phase='day';W.__setSky(0);W.__updSky(.001);
        document.querySelectorAll('body > :not(canvas)').forEach(e=>e.style.display='none');
        R.domElement.style.cssText='position:fixed;inset:0;width:1440px;height:1000px;display:block;z-index:100000;';R.setClearColor(0xf1f5f0,1);R.setScissorTest(false);R.clear();R.setScissorTest(true);
        document.getElementById('avatarGalleryLabels')?.remove();
        const labels=document.createElement('div');labels.id='avatarGalleryLabels';labels.style.cssText='position:fixed;inset:0;z-index:100002;pointer-events:none;color:#324f63;font-family:Arial,"Noto Sans KR",sans-serif;';
        const heading=document.createElement('div');heading.textContent=title;heading.style.cssText='padding:18px 28px;font-size:22px;font-weight:600;';labels.appendChild(heading);document.body.appendChild(labels);
        const reports=[];
        cards.forEach((card,i)=>{
          const x=i%cols*cw,y=top+Math.floor(i/cols)*ch,s={x:0,y:0,z:0,ry:Math.PI,g:2,ph:0,mv:false,wp:0,we:0,hat:0,gls:0,clo:0,jb:-1,jt:0,...card};
          const gs=W.__sheepGait(s,10);if(s.mv)gs.v=s.run?8:4;W.__drawSheep([s],10,40,a=>W.__GHEX[a.g],1);
          const scene=new T.Scene(),group=new T.Group();scene.add(group);
          const unique=new Set([...W.__charMeshes().사람,...W.__gunMeshes(),...W.__P_wing(),...W.__P_wingG(),W.__P_jobF(),W.__P_jobR()]);
          const contact=W.__avatarRender?.();if(contact){contact.drawShadows([{...s,air:false}],40,1);unique.add(contact.contact);}
          let parts=0;
          for(const mesh of unique)if(mesh?.isInstancedMesh&&mesh.count){const copy=mesh.clone();copy.instanceMatrix=mesh.instanceMatrix.clone();if(mesh.instanceColor)copy.instanceColor=mesh.instanceColor.clone();copy.frustumCulled=false;group.add(copy);parts+=copy.count;}
          for(const light of W.__scene.children.filter(o=>o.isLight)){const copy=light.clone();copy.castShadow=false;scene.add(copy);if(copy.target)scene.add(copy.target);}
          const floor=new T.Mesh(new T.PlaneGeometry(5,5),new T.MeshLambertMaterial({color:0xdce8d4}));floor.rotation.x=-Math.PI/2;floor.position.y=-.008;scene.add(floor);
          const angle=card.angle??.40,span=s.glide?3.2:2.45,aspect=(cw-12)/(ch-42),camera=new T.OrthographicCamera(-span*aspect/2,span*aspect/2,span/2,-span/2,.1,40);
          camera.position.set(Math.sin(angle)*6,2.1,Math.cos(angle)*6);camera.lookAt(0,.90,0);
          R.setViewport(x+6,height-y-ch+32,cw-12,ch-42);R.setScissor(x+6,height-y-ch+32,cw-12,ch-42);R.render(scene,camera);
          floor.geometry.dispose();floor.material.dispose();
          const label=document.createElement('div');label.textContent=card.label;label.style.cssText='position:absolute;text-align:center;font-size:16px;font-weight:600;left:'+x+'px;top:'+(y+ch-27)+'px;width:'+cw+'px;';labels.appendChild(label);
          reports.push({label:card.label,parts,triangles:R.info.render.triangles});
        });
        R.setScissorTest(false);const snapshot=document.createElement('img');snapshot.id='avatarSnapshot';snapshot.src=R.domElement.toDataURL();snapshot.style.cssText='position:fixed;inset:0;width:1440px;height:1000px;z-index:100001;';document.getElementById('avatarSnapshot')?.remove();document.body.appendChild(snapshot);return reports;
      },set);
      await page.evaluate(()=>document.getElementById('avatarSnapshot').decode());
      await page.screenshot({path:path.join(out,quality+'-'+set.name+'.png')});
      check(quality+' '+set.name+' all real poses rendered',counts.length===12&&counts.every(c=>c.parts>=18&&c.triangles>1000),counts.map(c=>({label:c.label,parts:c.parts})));
    }
    await page.close();
  }
  check('No JavaScript or WebGL shader errors',errors.length===0,errors);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));
  if(reports.some(r=>!r.ok))process.exitCode=1;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
