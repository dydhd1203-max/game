'use strict';
// Swung sleeves (2026-10-17, 검수실 motion4 '고칠 곳': running and jumping
// sleeves look unnatural). On the sheet a front/back sleeve carries a strip of
// cloth that hangs below its cuff on the inner side, over the shirt beside the
// hanging arm. A sleeve swung out from the body (running, the jump's crouch
// and flight) took the strip along: beside the body it hung below the cuff as
// a green triangle and widened the sleeve into a bell. The runtime now drops
// the strip as the sleeve turns out (avatar-foundation-outfit.js SWING_OUT,
// swungSleeve) and reports what it drew (QPFoundationOutfit.inspect(svg)
// .sleeves[i].strip: 1 the hanging strip kept, 0 dropped).
//
// Checked for both sexes, front and back, idle + every walk, run and jump step:
//   - a sleeve turned out SWING_FULL° or more from its idle turn (or a raised arm) draws no strip (0);
//   - a sleeve turned out WALK_MAX° or less (idle, walking) keeps it (1): over the shirt it is the
//     shirt's side, and walking stays as approved.
// The whole avatars and the sleeves alone (on magenta) of those steps are written to --out for
// viewing (280 px; the strip is a few pixels there, look at them at 2x).
//
//   node tools/verify-swing-sleeves.cjs                         exit 1 on a failure
//   node tools/verify-swing-sleeves.cjs --overlay avatar-foundation-outfit.js=<old copy>
//                                                               negative control: the code before
//                                                               the fix MUST fail
//   --out <dir>   default 검증/소매흔들기
// Headless, ?demo=1 only, no mouse. About 20 seconds.
const fs=require('node:fs'),path=require('node:path');
const L=require('./foundation-garment-lib.cjs'),H=L.H,M=require('./foundation-matrix.cjs');
const ROOT=path.resolve(__dirname,'..');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const OUT=path.resolve(ROOT,arg('--out','검증/소매흔들기')),OVERLAY=arg('--overlay',null),SIZE=280;
const SWING_FULL=17,WALK_MAX=8;
(async()=>{
  const overlay={};if(OVERLAY){const [rel,file]=OVERLAY.split('=');overlay[rel]=path.resolve(file);}
  const server=await H.serve(H.fsTree(ROOT,overlay));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[],overlay:OVERLAY,samples:[],fails:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:1600,height:1400}});
  await L.install(page,{});
  for(const sex of ['m','f'])for(const view of ['front','back']){
    const poses=[{action:'idle',k:0}];for(const action of ['walk','run','jump'])for(let k=0;k<M.FRAMES;k++)poses.push({action,k});
    const cells=poses.map(p=>({av:{sex,sk:0,hair:(sex==='f'?'bob':'short')+':1',expression:'bright:0'},state:{...M.actionState(p.action,view,p.k),reducedMotion:true},size:SIZE}));
    // The game re-applies every frame: read the second apply.
    const g=await page.evaluate(async spec=>{const g=await __fg.grid(spec);
      g.arms=__fg.cells().map(({svg,c})=>{__fg.api.apply(svg,__fg.posed(svg,c.state));const fit=__fg.O.inspect(svg),pose=__fg.api.inspect(svg);
        return[0,1].map(i=>({rot:+((svg.querySelector('[data-outfit-owner="arm-'+i+'"]')?.getAttribute('transform')||'').match(/rotate\(([-\d.]+)/)||[])[1]||0,strip:fit?.sleeves?.[i]?.strip,lift:pose?.arms?.[i]?.lift||0}));});
      await __fg.settle(document.getElementById('fg-host'));return g;},{cells,cols:M.FRAMES+1,cellW:Math.round(SIZE*.62),cellH:Math.round(SIZE*1.12),bg:'#1e2858'});
    await L.capture(page,g,path.join(OUT,'avatars-'+sex+'-'+view+'.png'));
    await page.evaluate(()=>{document.getElementById('fg-host').style.setProperty('--fg-bg','#ff00ff');return __fg.mode('fg-sleeves');});
    await L.capture(page,g,path.join(OUT,'sleeves-'+sex+'-'+view+'.png'));
    const idle=g.arms[0];
    poses.forEach((p,c)=>{for(const i of [0,1]){const a=g.arms[c][i],out=+((i?-1:1)*(a.rot-idle[i].rot)).toFixed(1),s={sex,view,action:p.action,k:p.k,arm:i,out,lift:a.lift,strip:a.strip??null};
      const want=a.lift>0||out>=SWING_FULL?0:out<=WALK_MAX?1:null;s.want=want;
      if(typeof a.strip!=='number')s.fail='no strip reported';else if(want!==null&&Math.abs(a.strip-want)>1e-6)s.fail='strip '+a.strip+', want '+want;
      report.samples.push(s);if(s.fail)report.fails.push(s);}});
  }
  fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,1));
  const n=w=>report.samples.filter(s=>s.want===w).length;
  console.log((OVERLAY?'[overlay '+OVERLAY+'] ':'')+'sleeves: '+report.samples.length+' (no strip wanted '+n(0)+', strip kept '+n(1)+', between '+n(null)+'), failing '+report.fails.length+' → '+path.relative(ROOT,OUT));
  for(const f of report.fails.slice(0,10))console.log('  FAIL '+[f.sex,f.view,f.action,f.k,'arm '+f.arm,'out '+f.out+'°',f.fail].join(' '));
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
  process.exit(report.fails.length||report.errors.length||!n(0)||!n(1)?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
