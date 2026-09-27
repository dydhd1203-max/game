// Real grass-only before/after: identical current world, 21 avatars, camera and
// clock. The control restores only the three grass functions from a saved build.
// This measures render structure and visual output, not LG Gram hardware FPS.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {chromium} from './pw.mjs';import {serve} from './serve2.mjs';import {GAME} from './gamefile.mjs';
const file=path.resolve(process.argv[2]||GAME),baseline=process.argv[3];assert.ok(baseline,'Pass the saved baseline76.html as argument 2');
const current=fs.readFileSync(file,'utf8'),old=fs.readFileSync(baseline,'utf8'),out=path.resolve('artifacts/grass77');fs.mkdirSync(out,{recursive:true});
const fn=(s,n)=>{const i=s.indexOf('function '+n+'('),e=s.indexOf('\n}',i);assert.ok(i>=0&&e>i,n);return s.slice(i,e+2);};
const glsl=s=>/const GR_GROUND_GLSL = `[\s\S]*?`;/.exec(s)[0];
let control=current;for(const n of ['grGrainGB','grGroundShader'])control=control.replace(fn(current,n),fn(old,n));control=control.replace(glsl(current),glsl(old));
const files={before:path.join(out,'grass76-control.html'),after:path.join(out,'grass77-current.html')};fs.writeFileSync(files.before,control);fs.writeFileSync(files.after,current);
let browser;const errors=[],results=[];
try{
  browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  for(const label of ['before','after']){
    const server=serve(20577,files[label]);let page;
    try{
      page=await browser.newPage({viewport:{width:1366,height:768}});
      page.on('pageerror',e=>errors.push({label,message:e.message}));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram/i.test(m.text()))errors.push({label,message:m.text()});});
      await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
      await page.addInitScript(()=>{const real=performance.now.bind(performance),raf=requestAnimationFrame.bind(window);let time=null,seed=77137;
        Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
        window.__realNow=real;window.__freeze=()=>{time=100000;};window.__advance=ms=>{time+=ms;window.__loop73();};
        performance.now=()=>time===null?real():time;requestAnimationFrame=f=>time===null?raf(f):0;
        localStorage.setItem('sndOn','0');localStorage.setItem('sheepUid','grass77-review');});
      await page.goto('http://127.0.0.1:20577/?gfx=mid&diag=1',{waitUntil:'load',timeout:240000});
      await page.waitForFunction(()=>window.__READY,null,{timeout:240000});
      await page.evaluate(()=>{const W=window,P=W.__PL,G=W.__G;document.getElementById('iName').value='잔디 검수';document.getElementById('bSolo').click();
        W.__introDone();document.querySelectorAll('.pop').forEach(p=>p.classList.remove('on'));W.__freeze();W.__DBG().noRender=true;
        G.phase='day';G.t=100000;G.paused=false;W.__XP.job=-1;W.__XP.jt=0;W.__camZoom(3.2);W.__setSky(0);W.__updSky(0,true);
        W.__grassSpawn={x:P.x,y:P.y,z:P.z,yaw:P.yaw,pitch:P.pitch};
        for(let i=0;i<20;i++){const id='grassfriend'+i;G.players.set(id,{uid:id,x:P.x+(i%5-2)*2,z:P.z+4+Math.floor(i/5)*2,y:P.y,
          tx:P.x+(i%5-2)*2,tz:P.z+4+Math.floor(i/5)*2,ty:P.y,ry:Math.PI,g:i%5,n:'친구'+(i+1),mv:false,hp:100,down:false,ph:i,wp:-1,jb:-1,jt:0,skin:i%3,hat:i%4,clo:i%5});W.__pcMap.set(id,{g:i%5,wp:-1,jb:-1,jt:0});}
        for(let i=0;i<60;i++)W.__advance(1000/60);
        const d=W.__groundDisc(),pos=d.geometry.attributes.position,mask=d.geometry.attributes.aGMask;
        const candidates=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z);
          if(r>10&&r<25&&mask.getX(i)<.03&&mask.getY(i)<.05&&mask.getZ(i)===0&&mask.getW(i)<.01&&W.__NODES.every(n=>Math.hypot(n.x-x,n.z-z)>4))candidates.push({x,z});}
        candidates.sort((a,b)=>(Math.abs(a.x-10)+Math.abs(a.z-14))-(Math.abs(b.x-10)+Math.abs(b.z-14)));W.__grassOpen=candidates[0]||{x:10,z:14};
        const edge=[];for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z);
          if(r>10&&r<25&&mask.getX(i)>.35&&mask.getX(i)<.65&&mask.getY(i)<.05&&mask.getZ(i)===0)edge.push({x,z});}
        edge.sort((a,b)=>Math.hypot(a.x-W.__grassOpen.x,a.z-W.__grassOpen.z)-Math.hypot(b.x-W.__grassOpen.x,b.z-W.__grassOpen.z));W.__grassEdge=edge[0]||{x:10,z:0};
      });
      const shots=[];
      for(const name of ['spawn','open-play','leaf-close','path-edge','pond-edge','far-field']){
        const shot=await page.evaluate(async name=>{const W=window,P=W.__PL,R=W.__R,C=W.__cam,THREE=W.__THREE;
          if(name!=='spawn'){
            const point=name==='path-edge'?W.__grassEdge:name==='pond-edge'?{x:W.__POND.x+W.__POND.r+2,z:W.__POND.z+2}:W.__grassOpen;
            Object.assign(P,{x:point.x,z:point.z,y:W.__GY,vx:0,vz:0,vy:0,ground:true,down:false,mv:false,_px:point.x,_pz:point.z,yaw:Math.PI,pitch:name==='leaf-close'?-.95:name==='far-field'?-.10:-.43});
            W.__camZoom(name==='leaf-close'?0:3.2);
            for(let i=0;i<60;i++)W.__advance(1000/60);
          }
          W.__setSky(0);W.__updSky(0,true);
          const g=W.__groundDisc(),tex=W.__GRAIN.grass,data=tex.image.getContext('2d').getImageData(0,0,128,128).data;
          const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
          const hashes={};for(const n of ['position','normal','color','aGBase','aGMask'])hashes[n]=await digest(g.geometry.attributes[n].array.buffer);
          const channels=[];for(let c=0;c<4;c++)channels.push(await digest(Uint8Array.from({length:128*128},(_,i)=>data[i*4+c])));
          R.info.autoReset=false;R.info.reset();W.__drawFrame();const png=R.domElement.toDataURL('image/png');
          return {name,png,player:{x:P.x,y:P.y,z:P.z,yaw:P.yaw,pitch:P.pitch},camera:{x:C.position.x,y:C.position.y,z:C.position.z,fov:C.fov},
            calls:R.info.render.calls,triangles:R.info.render.triangles,memory:{...R.info.memory},programs:R.info.programs.length,players:W.__G.players.size+1,
            ground:{hashes,indices:g.geometry.index.count,material:g.material.type,transparent:g.material.transparent,receiveShadow:g.receiveShadow,shininess:g.material.shininess,
              texture:{size:[tex.image.width,tex.image.height],minFilter:tex.minFilter,magFilter:tex.magFilter,anisotropy:tex.anisotropy,hashes:channels}},graphics:{...W.__GFX}};
        },name);
        fs.writeFileSync(path.join(out,`${label}-${name}.png`),Buffer.from(shot.png.split(',')[1],'base64'));delete shot.png;shots.push(shot);
      }
      results.push({label,shots});
    }finally{await page?.close();await new Promise(r=>server.close(r));}
  }
  fs.writeFileSync(path.join(out,'view-probe.json'),JSON.stringify({results,errors},null,2));
  const compared=results[0].shots.map((before,i)=>{const after=results[1].shots[i];
    assert.deepEqual(after.player,before.player,after.name+' player pose');assert.deepEqual(after.camera,before.camera,after.name+' ordinary camera');
    assert.deepEqual(after.ground.hashes,before.ground.hashes,'Terrain shape, normals, colors and masks must stay identical');
    assert.equal(after.calls,before.calls,'Grass detail cannot add draw calls');assert.equal(after.triangles,before.triangles,'Grass detail cannot add triangles');
    assert.deepEqual(after.memory,before.memory,'Grass detail cannot add textures or geometries');assert.deepEqual(after.graphics,before.graphics,'Keep the full quality preset');
    assert.equal(after.players,21);assert.equal(after.ground.transparent,false);assert.equal(after.ground.indices,before.ground.indices);
    for(const c of [0,2,3])assert.equal(after.ground.texture.hashes[c],before.ground.texture.hashes[c],'Preserve shared RGB channels');
    return {name:after.name,calls:after.calls,triangles:after.triangles,memory:after.memory};});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'view.json'),JSON.stringify({sourceSha256:crypto.createHash('sha256').update(current).digest('hex'),baseline,control:'Current source with only grass restored from baseline',results,compared,errors},null,2));
  console.log(JSON.stringify({compared,errors},null,2));console.log('PASS: actual game grass detail retains terrain, 21-player render cost and full quality');
}finally{await browser?.close();}
