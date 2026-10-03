// Compare cached map paintings against the independent inline SVG renderer.
// Requires Playwright and Python Pillow/numpy; evidence stays outside Git.
const {chromium}=require('playwright'),fs=require('fs');
function analyze(out){
const analysis=String.raw`from PIL import Image,ImageFilter
from pathlib import Path
import numpy as np,json,sys
p=Path(sys.argv[1]);rows=[]
for name in json.loads((p/'cases.json').read_text())+['negative']:
 im=Image.open(p/(name+'-inline.png')).convert('RGB');a=np.array(im).astype(int)
 d=np.abs(a-np.array(Image.open(p/(name+'-cached.png')).convert('RGB')).astype(int))
 changed=int(np.any(d>2,axis=2).sum());maximum=int(d.max());mean=float(d.mean())
 edge=(np.array(im.filter(ImageFilter.MaxFilter(3))).astype(int)-np.array(im.filter(ImageFilter.MinFilter(3))).astype(int)).max(2)>12
 interior=int(d.max(2)[~edge].max());size=int(name.split('-')[0]) if name!='negative' else 280
 # SVG images and inline paths have different edge coverage in Chromium.
 # Keep tight flat-colour checks and bound the affected edge-pixel count.
 rows.append(dict(case=name,changed=changed,maximum=maximum,interiorMaximum=interior,mean=mean,acceptable=changed<=size*size*.005 and maximum<=64 and interior<=8 and mean<=.05))
(p/'pixels.json').write_text(json.dumps(rows,indent=2))
assert all(r['acceptable'] for r in rows[:-1]),str([r for r in rows[:-1] if not r['acceptable']])
assert not rows[-1]['acceptable'],'2px misplaced painting escaped'
print('PASS',len(rows)-1,'map/inline paintings and 2px displacement negative control')
`;
console.log(require('child_process').execFileSync('python3',['-c',analysis,out],{encoding:'utf8'}));
}
(async()=>{const out=require('path').resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/맵아바타');fs.mkdirSync(out,{recursive:true});if(process.argv.includes('--analyze-only')){analyze(out);return;}const b=await chromium.launch(),p=await b.newPage({viewport:{width:520,height:400},reducedMotion:'reduce'});await p.route('**/www.gstatic.com/firebasejs/**',r=>r.fulfill({body:''}));await p.goto((process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/')+'?demo=1&session=static-comparison');await p.waitForFunction(()=>QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready&&QPAvatarDirection.atlas.ready&&QPAvatarDirection.atlas.backReady&&QPClothMesh.atlas.ready);await p.evaluate(()=>{QPGame.go('school');performance.now=()=>4100;const style=document.createElement('style');style.textContent='*{animation:none!important;transition:none!important}#compare{position:fixed;inset:0;z-index:99999;display:flex;background:#fff9ed}#compare>div>svg{will-change:transform}#compare>div{contain:layout style;position:relative!important;inset:auto!important;width:260px;height:400px;display:flex;justify-content:center;align-items:center}';document.head.append(style);document.body.insertAdjacentHTML('beforeend','<div id="compare"><div id="inline"></div><div id="cached" class="sr-avatar"></div></div>')});const rows=[];
for(const size of [96,280])for(const sex of ['m','f'])for(const shape of ['tee','hood','dress'])for(const direction of ['front','right','left','back'])for(const action of ['walk','floor-sit','wave-rise','wave-high','wave-lower']){
const name=[size,sex,shape,direction,action].join('-');await p.evaluate(({size,sex,shape,direction,action})=>{const av={...QPGame.getMe().av,sex,hair:sex==='m'?'short:1':'bob:1',sk:sex==='m'?0:4,top:shape+':7',bottom:shape==='dress'?'':'skirt:7',outfit:'',shoes:'sneaker:8',pet:'',effect:'',bg:'',frame:''},state={direction,facing:direction==='left'?'left':'right',action:action.startsWith('wave')?'idle':action,gesture:action.startsWith('wave')?'wave':'',gestureProgress:action==='wave-rise'?.2:action==='wave-lower'?.8:.5,seatMode:action==='floor-sit'?'floor':undefined,phase:.25,grounded:true};for(const id of ['inline','cached']){const host=document.getElementById(id);if(host.firstElementChild)QPAvatarPose.destroy(host.firstElementChild);host.innerHTML=QPAvatar.render(av,size,3);for(let i=0;i<2;i++)QPAvatarPose.apply(host.firstElementChild,state);}}, {size,sex,shape,direction,action});await p.waitForFunction(()=>[...document.querySelectorAll('#cached [data-qpx-static-art]')].every(n=>!n.hasAttribute('visibility')));await p.locator('#inline').screenshot({path:out+'/'+name+'-inline.png'});await p.locator('#cached').screenshot({path:out+'/'+name+'-cached.png'});rows.push(name);
}
await p.locator('#inline').screenshot({path:out+'/negative-inline.png'});
await p.evaluate(()=>document.querySelector('#cached>svg').style.transform='translateX(2px)');
await p.locator('#cached').screenshot({path:out+'/negative-cached.png'});
fs.writeFileSync(out+'/cases.json',JSON.stringify(rows));await b.close();
analyze(out);
})().catch(e=>{console.error(e);process.exit(1)});
