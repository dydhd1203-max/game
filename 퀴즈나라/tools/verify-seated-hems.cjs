'use strict';
// Geometry checks complement the 96/280px art review. They do not certify art.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
  const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/접힌옷자락');fs.mkdirSync(out,{recursive:true});
  const b=await chromium.launch();
  try{
    const p=await b.newPage({reducedMotion:'reduce'});
    await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:''}));
    await p.goto((process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/')+'?demo=1&session=seated-hems');
    await p.waitForFunction(()=>QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady);
    const rows=await p.evaluate(()=>{
      QPGame.go('school');performance.now=()=>4100;
      const style=document.createElement('style');style.textContent='*{animation:none!important}';document.head.append(style);
      const host=document.createElement('div');document.body.append(host);const rows=[];
      for(const size of [96,280])for(const sex of ['m','f'])for(const sk of [0,4])for(const shape of ['skirt','pleat','jean_skirt','star_skirt','tutu','hanbok','dress','robe'])for(const direction of ['front','right','left','back']){
        const long=['dress','robe'].includes(shape),av={...QPGame.getMe().av,sex,sk,hair:sex==='m'?'short:1':'bob:1',outfit:'',top:long?shape+':7':'hood:7',bottom:long?'':shape+':7',pet:'',effect:'',bg:'',frame:''};
        host.innerHTML=QPAvatar.render(av,size,3);const svg=host.firstElementChild;
        const apply=(action,seatMode)=>{for(let i=0;i<2;i++)QPAvatarPose.apply(svg,{action,seatMode,direction,facing:direction==='left'?'left':'right',grounded:true,phase:.25});};
        apply('idle');const rig=QPAvatarPose.prepare(svg),head=rig.head.getBBox(),core=rig.coatCore?.getAttribute('height');
        const footY=()=>new DOMPoint(18.25,44.55).matrixTransform(QPAvatarLocalTransform.relative(rig.rightFoot,rig.body)).y;
        const standingFoot=footY();apply('floor-sit','floor');
        const side=direction==='left'||direction==='right',outline=[...rig.floorHem.children].find(n=>n.localName==='path');
        const covers=()=>[rig.left,rig.right].every((leg,i)=>{const pt=new DOMPoint(i?18.25:13.75,rig.knee).matrixTransform(QPAvatarLocalTransform.relative(leg,rig.floorHem));return outline.isPointInFill(pt);});
        const row={size,sex,sk,shape,direction,headUnscaled:Math.abs(rig.head.getBBox().width-head.width)<.0001,footDrift:Math.abs(footY()-standingFoot),lapVisible:rig.floorHem.style.display!=='none',standingHemHidden:rig.standingHem.style.display==='none'};
        if(side){row.kneesCovered=covers();rig.floorHem.setAttribute('transform','translate(8 0)');row.rejectsDetachedLap=!covers();rig.floorHem.removeAttribute('transform');}
        apply('sit','desk');row.deskRestored=rig.floorHem.style.display==='none'&&rig.standingHem.style.display!=='none';
        apply('walk');apply('idle');row.standingRestored=rig.floorHem.style.display==='none'&&rig.standingHem.style.display!=='none'&&(!rig.coatCore||rig.coatCore.getAttribute('height')===core);
        rows.push(row);QPAvatarPose.destroy(svg);
      }
      host.remove();return rows;
    });
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(rows,null,2));
    assert.equal(rows.length,256);
    for(const row of rows){const side=['left','right'].includes(row.direction);assert(row.headUnscaled&&row.footDrift<.1&&row.deskRestored&&row.standingRestored,JSON.stringify(row));assert.equal(row.lapVisible,side);assert.equal(row.standingHemHidden,side);if(side)assert(row.kneesCovered&&row.rejectsDetachedLap,JSON.stringify(row));}
    console.log('PASS 256 hem/skin/direction/size combinations, crossed-knee coverage, head proportions, foot contact, desk/standing restoration and detached-lap controls.');
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
