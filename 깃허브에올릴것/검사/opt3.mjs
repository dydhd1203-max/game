/* 드로우콜 257개가 어디서 나오는지 이름별로 센다 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { serve } from './serve2.mjs';
const srv = serve(+process.argv[3], process.argv[2]);
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg = await b.newPage({viewport:{width:1180,height:720}});
await pg.goto('http://127.0.0.1:'+process.argv[3]+'/', {waitUntil:'load', timeout:60000});
await pg.waitForFunction('window.__READY===true', {timeout:60000});
await pg.fill('#iName','측정'); await pg.click('#bSolo'); await pg.waitForTimeout(1200);
console.log(await pg.evaluate(()=>{
  const W=window, G=W.__G, PL=W.__PL, L=[], TH=W.__THREE;
  for(let i=0;i<5;i++) W.__base[i]={w:999999,s:999999,o:999999};
  W.__recompute(); W.__clear();
  for(let g=0; g<5; g++){ const d=W.__DIRS[g]; G.me.g=g;
    for(let pp=-8; pp<=8; pp+=0.5){
      const x=Math.round(d.dx*42-d.dz*pp), z=Math.round(d.dz*42+d.dx*pp);
      if(W.__canPlace('swall',x,z)===null){ W.__place('swall',x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs('swall','hp',4); o.hp=o.mx; } }
    for(const [t,rr,pp] of [['arrow',36,-4],['arrow',36,4],['arrow',31,-3],['arrow',31,3],
                            ['arrow',26,0],['ice',33,-5],['ice',33,5],['barr',24,-3],['barr',24,3]]){
      const x=Math.round(d.dx*rr-d.dz*pp), z=Math.round(d.dz*rr+d.dx*pp);
      if(W.__canPlace(t,x,z)===null){ W.__place(t,x,z);
        const o=[...W.__STRU.values()].pop(); o.lv=4; o.mx=W.__bs(t,'hp',4); o.hp=o.mx; } } }
  G.me.g=0; W.__rebuild();
  G.day=12; W.__goNight();
  G.wolves.length=0; W.__spawnQ().length=0;
  for(let i=0;i<40;i++){ const g=i%5, d=W.__DIRS[g], w=W.__spawnWolf(i%3, g);
    const r=26+(i%9)*1.8, off=(((i/9)|0)-2)*2.4;
    w.x=d.dx*r-d.dz*off; w.z=d.dz*r+d.dx*off;
    w.y=W.__solidTop(Math.floor(w.x),Math.floor(w.z)); w.mx*=50; w.hp=w.mx; }
  W.__drawWolves(G.wolves,1,1/60); W.__drawWolfHP();
  const d0=W.__DIRS[0];
  PL.x=d0.dx*46; PL.z=d0.dz*46; PL.y=W.__solidTop(Math.floor(PL.x),Math.floor(PL.z))+1;
  /* 물체가 어디 소속인지 이름표를 붙인다 */
  const own = new Map();
  for(const [k,bk] of W.__banks) if(bk.chunks) for(const m of bk.chunks) own.set(m, '세계:'+k);
  for(const [k,m] of W.__struMeshes) own.set(m, '건물:'+k);
  const cls = o => own.get(o) || o.name || (o.isInstancedMesh
      ? '인스턴스:'+(o.count)+'개' : '메시:'+(o.material&&o.material.type||'?'));
  const look=(px,py,pz,tx,ty,tz)=>{ W.__cam.position.set(px,py,pz); W.__cam.lookAt(tx,ty,tz);
    W.__cam.updateMatrixWorld();
    /* 실제로 그려지는 물체를 프러스텀으로 직접 가려 센다 */
    const fr = new TH.Frustum();
    fr.setFromProjectionMatrix(new TH.Matrix4().multiplyMatrices(
      W.__cam.projectionMatrix, W.__cam.matrixWorldInverse));
    const tally = new Map();
    W.__scene.traverse(o=>{
      if(!o.visible || !(o.isMesh||o.isPoints||o.isLine)) return;
      let p=o.parent, vis=true; while(p){ if(!p.visible){vis=false;break;} p=p.parent; }
      if(!vis) return;
      if(o.isInstancedMesh && o.count===0) return;
      if(o.frustumCulled){ if(!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const s=o.geometry.boundingSphere.clone(); s.applyMatrix4(o.matrixWorld);
        if(!fr.intersectsSphere(s)) return; }
      let n = cls(o);
      if(n.startsWith('메시:')){ let p2=o, path=[]; while(p2 && p2!==W.__scene){ path.unshift(p2.name||p2.type); p2=p2.parent; }
        const wp=new TH.Vector3(); o.getWorldPosition(wp);
        const g=o.geometry, prm=g&&g.parameters?Object.values(g.parameters).slice(0,3).map(v=>(+v).toFixed(1)).join('x'):(g&&g.type);
        n = '메시 ▸ '+path.join('/')+'  ['+prm+'] @'+[wp.x,wp.y,wp.z].map(v=>v.toFixed(0)).join(','); }
      tally.set(n, (tally.get(n)||0)+1);
    });
    return tally;
  };
  const names = ['우리 문 앞→밖','우리 문 앞→마을','수정 옆'];
  const views = [[PL.x,PL.y+1.2,PL.z, d0.dx*90,2,d0.dz*90],
                 [PL.x,PL.y+1.2,PL.z, 0,2,0],
                 [3,2.2,3, d0.dx*60,2,d0.dz*60]];
  for(let v=0;v<3;v++){
    W.__R.info.reset(); W.__cam.position.set(views[v][0],views[v][1],views[v][2]);
    W.__cam.lookAt(views[v][3],views[v][4],views[v][5]); W.__render();
    L.push('■ '+names[v]+'  드로우콜 '+W.__R.info.render.calls);
    const t = look(...views[v]);
    [...t.entries()].sort((a,b)=>b[1]-a[1]).slice(0,26)
      .forEach(([k,n])=>L.push('    '+String(n).padStart(4)+'  '+k));
  }
  /* 이름을 붙여 놓지 않았으니, 정적 세계 뱅크와 건물 메시 수를 따로 센다 */
  L.push('');
  L.push('건물 인스턴스메시(struMeshes) 종류 수 = 프러스텀 무시하고 언제나 그려짐');
  let sm=0, smv=0, smTri=0;
  W.__scene.traverse(o=>{ if(o.isInstancedMesh && o.frustumCulled===false && o.count>0){ sm++; smv+=o.count; } });
  L.push('  프러스텀 끈 인스턴스메시 '+sm+'개 · 인스턴스 합 '+smv);
  return L.join('\n');
}));
await b.close(); srv.close();
