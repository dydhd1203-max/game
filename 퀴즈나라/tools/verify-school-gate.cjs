'use strict';
// Real rendered registration + a pixel regression for the old fence through
// the opening. This does not replace visual inspection of the saved captures.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const base=process.env.QUIZ_PREVIEW_URL||'http://127.0.0.1:4173/';
const out=path.resolve(process.env.QUIZ_VERIFICATION_OUTPUT||'검증/학교교문');fs.mkdirSync(out,{recursive:true});
const report={errors:[],realFirebase:false};let browser;
(async()=>{
 browser=await chromium.launch();const p=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 p.on('pageerror',e=>report.errors.push(e.message));
 await p.route(/gstatic.com\/firebasejs|firebaseio.com|firebasedatabase.app/,r=>r.fulfill({body:''}));
 await p.goto(base+'?demo=1&session=gate-registration-'+Date.now());
 await p.waitForFunction(()=>window.QPGame?.getVillage()&&QPAvatar.atlas.ready&&QPClothes.atlas.ready);
 await p.evaluate(()=>QPGame.go('playground',QPPlaygroundScene.interactables.find(p=>p.target==='village').arrival));
 await p.waitForTimeout(700);await p.screenshot({path:path.join(out,'gate-play.png')});
 // A 1:1 source-sized crop contains the full gate, adjoining native rails,
 // paving and grass. No camera/UI crop is interpreted as an asset failure.
 await p.evaluate(()=>{
  const crop=document.createElement('div');crop.id='gate-review';crop.style.cssText='position:fixed;inset:0 auto auto 0;width:750px;height:480px;overflow:hidden;z-index:2147483647;background:white';
  crop.innerHTML='<div id="gate-review-art" style="position:absolute;left:-540px;top:-1020px;width:3714px;height:1808px">'+QPPlaygroundScene.render()+'</div>';document.body.append(crop);
 });
 await p.waitForTimeout(200);
 report.registration=await p.evaluate(()=>{
  const gate=document.querySelector('#gate-review [data-art="school-village-gate"]'),g=gate.querySelector('g'),m=g.transform.baseVal.consolidate().matrix,scale=gate.width.baseVal.value/1582,x=parseFloat(gate.style.left),y=parseFloat(gate.style.top);
  const world=(sx,sy)=>({x:x+scale*(m.a*sx+m.c*sy+m.e),y:y+scale*(m.b*sx+m.d*sy+m.f)});
  return {verticalDrift:world(477,348).x-world(477,492).x,name:gate.querySelector('text').textContent};
 });
 assert.equal(report.registration.name,'삼은초등학교');
 assert(Math.abs(report.registration.verticalDrift)<.01,'Vertical pillars must stay vertical');
 await p.locator('#gate-review').screenshot({path:path.join(out,'gate-detail.png')});
 // A previous revision preserved native rails but left the taller imported
 // rail stubs on the small right post. Preserve that distinct failure case.
 await p.evaluate(()=>{const root=document.getElementById('gate-review');root.querySelector('[data-art="school-gate-clean-pillar"]').style.visibility='hidden';root.querySelector('#school-gate-core path').setAttribute('d','M420 220H790V565H420V495H438V295H420Z M940 350H1140V570H1127V748L1078 790H940Z');});
 await p.locator('#gate-review').screenshot({path:path.join(out,'gate-negative-pillar-stubs.png')});
 await p.evaluate(()=>{const root=document.getElementById('gate-review');root.querySelector('[data-art="school-gate-clean-pillar"]').style.visibility='';root.querySelector('#school-gate-core path').setAttribute('d','M420 220H790V565H420V495H438V295H420Z M940 350H1140V570H1116V748L1048 780H940Z');});
 // Reproduce the actual earlier defect: clearing to the outer image bounds
 // and drawing auxiliary rails of a different height. The rail pixel oracle
 // below must reject this, even though the ground registration is unchanged.
 await p.evaluate(()=>{
  const root=document.getElementById('gate-review'),mask=root.querySelector('#school-gate-old-fence path'),image=root.querySelector('[data-art="school-village-gate"] image');
  window.gateSavedMask=mask.getAttribute('d');mask.setAttribute('d','M0 0L592 296V350L0 54Z');image.removeAttribute('clip-path');
 });
 await p.locator('#gate-review').screenshot({path:path.join(out,'gate-negative-misaligned-rails.png')});
 await p.evaluate(()=>{const root=document.getElementById('gate-review');root.querySelector('#school-gate-old-fence path').setAttribute('d',window.gateSavedMask);root.querySelector('[data-art="school-village-gate"] image').setAttribute('clip-path','url(#school-gate-core)');});
 await p.locator('#gate-review [data-art="school-village-gate"]').evaluate(n=>n.style.visibility='hidden');
 await p.locator('#gate-review').screenshot({path:path.join(out,'floor-cleared.png')});
 // Negative control restores the original fence; the same opening probe must
 // now reject its ivory bars/rail and shadow, rather than pass a blank region.
 await p.locator('#gate-review [data-art="school-gate-cleared-fence"]').evaluate(n=>n.style.visibility='hidden');
 await p.locator('#gate-review').screenshot({path:path.join(out,'floor-negative-old-fence.png')});
 report.pixels=JSON.parse(execFileSync('python3',['-c',`
from PIL import Image
import json,sys
from collections import deque
from pathlib import Path
p=Path(sys.argv[1]); counts={}
source=Image.open(Path(sys.argv[2])/'assets/playground-library/originals/playground-664d4d7c187e5a6d.png').convert('RGB')
rails={}
for name in ['gate-detail','gate-negative-misaligned-rails']:
 im=Image.open(p/(name+'.png')).convert('RGB');wings={}
 for side,span in [('left',range(600,744)),('right',range(1022,1205))]:
  differences=[];top_errors=[]
  for x in span:
   # Compare the rail itself; source sidewalk/grass beyond its silhouette can
   # be covered by another registered campus component.
   for offset in range(805,845):
    y=round(.5*x+offset);actual=im.getpixel((x-540,y-1020));expected=source.getpixel((x-269,y-747))
    differences.extend(abs(a-b) for a,b in zip(actual,expected))
   top=[]
   for offset in range(801,813):
    y=round(.5*x+offset);r,g,b=im.getpixel((x-540,y-1020))
    if min(r,g)>187 and b>149 and r-b<65:top.append(offset)
   if not top:top_errors.append(x)
  wings[side]={'meanRGBError':sum(differences)/len(differences),'missingTopRailColumns':top_errors}
 rails[name]=wings
assert all(v['meanRGBError']<1.0 and not v['missingTopRailColumns'] for v in rails['gate-detail'].values()),rails
assert all(v['meanRGBError']>8 for v in rails['gate-negative-misaligned-rails'].values()),rails
assert len(rails['gate-negative-misaligned-rails']['right']['missingTopRailColumns'])>5,rails
stubs={}
for name in ['gate-detail','gate-negative-pillar-stubs']:
 im=Image.open(p/(name+'.png')).convert('RGB')
 stubs[name]=sum(r>180 and g>175 and b>155 for x in range(1007,1021) for y in range(1288,1306) for r,g,b in [im.getpixel((x-540,y-1020))])
assert stubs['gate-detail']==0 and stubs['gate-negative-pillar-stubs']>40,stubs
# Trace the rendered material from native rails into the actual pillars.
# Warm stone/ivory is distinct from the cool asphalt and green grass here.
im=Image.open(p/'gate-detail.png').convert('RGB');joins={}
for name,span,anchors in [('left',(710,790),(730,768)),('right',(976,1050),(990,1035))]:
 mask=set()
 for x in range(*span):
  for off in range(800,850):
   y=round(x*.5+off);r,g,b=im.getpixel((x-540,y-1020))
   if r>130 and g>130 and b>105 and r>=g-8 and g>=b-5 and r-b<85:mask.add((x,y))
 def connected(points):
  start={q for q in points if abs(q[0]-anchors[0])<=2};target={q for q in points if abs(q[0]-anchors[1])<=2};seen=set(start);todo=deque(start)
  while todo:
   x,y=todo.popleft()
   for q in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
    if q in points and q not in seen:seen.add(q);todo.append(q)
  return len(seen&target)>5
 # Cutting a real 6px gap between the same endpoints must fail this oracle.
 centre=748 if name=='left' else 1016
 joins[name]={'connected':connected(mask),'gapRejected':not connected({q for q in mask if abs(q[0]-centre)>3})}
assert all(v['connected'] and v['gapRejected'] for v in joins.values()),joins
for name in ['floor-cleared','floor-negative-old-fence']:
 im=Image.open(p/(name+'.png')).convert('RGB');bright=0;total=0;colors=[]
 for x in range(835,951):
  for offset in range(810,847):
   r,g,b=im.getpixel((x-540,round(.5*x+offset)-1020));total+=1
   bright+=min(r,g,b)>180 and max(r,g,b)-min(r,g,b)<45
   colors.append((r,g,b))
 counts[name]={'brightRailPixels':bright,'samples':total,'mean':[sum(c[k] for c in colors)/total for k in range(3)]}
assert counts['floor-cleared']['brightRailPixels']<10,counts
assert counts['floor-negative-old-fence']['brightRailPixels']>250,counts
print(json.dumps({'opening':counts,'rails':rails,'pillarStubs':stubs,'joins':joins}))
 `,out,path.resolve(__dirname,'..')],{encoding:'utf8'}));
 await p.locator('#gate-review').evaluate(n=>n.remove());
 const portal=await p.evaluate(()=>QPPlaygroundScene.interactables.find(p=>p.target==='village'));
 const geometry=await p.evaluate(p=>{const n=QPGame.getPlayground().nav;return {entry:n.canStand(p.approach.x,p.approach.y),arrival:n.canStand(p.arrival.x,p.arrival.y),through:n.lineClear(p.arrival,p.approach),posts:QPPlaygroundScene.solids.filter(s=>s.id.startsWith('school-gate-')).every(s=>!n.canStand(s.x,s.y))};},portal);
 assert(Object.values(geometry).every(Boolean),JSON.stringify(geometry));report.geometry=geometry;
 await p.waitForTimeout(700);assert(await p.evaluate(q=>QPGame.getPlayground().moveTo(q.x,q.y),portal.approach));
 await p.waitForFunction(()=>document.querySelector('.school-room-host')?.dataset.zone==='village');
 await p.waitForTimeout(850);assert.equal(await p.locator('.school-room-host').getAttribute('data-zone'),'village');
 report.walkedThroughGate=true;assert.deepEqual(report.errors,[]);report.success=true;
 await browser.close();console.log('PASS gate alignment, upright pillars, cleared fence pixels + negative control, exact school name, unobstructed automatic exit');
})().catch(async e=>{report.error=e.stack;console.error(e);await browser?.close();process.exitCode=1;}).finally(()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)));
