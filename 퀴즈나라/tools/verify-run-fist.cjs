'use strict';
// The drawn running fist (2026-10-17, 검수실 motion5 ①): in the front run the forearm folded toward the viewer was
// the hanging arm painting squeezed by the mesh (a blurred, unlined blob with whiskers). It is now drawn art
// (assets/sd-foundation-ref-run-fist.png, avatar-foundation-skin.js RUN_FIST/runFist, cut by
// tools/arm/build-run-fist.cjs). Checked for both sexes over the front run's 24 steps, the back run and the jump:
//   - every front-run arm whose forearm folds toward the viewer (arm.fold and a fist) shows the drawn fist (the fold
//     image carries a transform and the run fist's picture), the arm painted down to the elbow only (its squeezed
//     forearm made the whiskers; the upper arm covers the sleeve picture's own skin) and the drawn FIST strokes hidden;
//   - no other arm, step or view does (back run, the jump, unfolded front steps: the whole painting, no transform);
//   - tools/arm/build-run-fist.cjs --check: the RUN_FIST literal and the atlas match the returned sheets.
// Writes --out (default 검증/달리기주먹): report.json and run-<sex>.png (front run, 24 steps, 280 px) to view.
//   node tools/verify-run-fist.cjs                       exit 1 on a failure
//   node tools/verify-run-fist.cjs --overlay avatar-foundation-skin.js=<old copy>   negative control: MUST fail
// Headless, ?demo=1 only, no mouse. About 20 seconds.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const L=require('./foundation-garment-lib.cjs'),H=L.H,M=require('./foundation-matrix.cjs');
const ROOT=path.resolve(__dirname,'..');
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const OUT=path.resolve(ROOT,arg('--out','검증/달리기주먹')),OVERLAY=arg('--overlay',null);
(async()=>{
  const overlay={};if(OVERLAY){const [rel,file]=OVERLAY.split('=');overlay[rel]=path.resolve(file);}
  const server=await H.serve(H.fsTree(ROOT,overlay));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[],overlay:OVERLAY,samples:[],fails:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:2400,height:1400}});
  await L.install(page,{});
  for(const sex of ['m','f']){
    const states=[];for(let k=0;k<24;k++)states.push({id:'front/run/'+k,state:{action:'run',direction:'front',phase:k/24,time:k*.05,reducedMotion:true}});
    for(let k=0;k<M.FRAMES;k++)states.push({id:'back/run/'+k,state:{...M.actionState('run','back',k),reducedMotion:true}},{id:'front/jump/'+k,state:{...M.actionState('jump','front',k),reducedMotion:true}});
    const cells=states.map(s=>({av:{sex,sk:0,hair:(sex==='f'?'bob':'short')+':1',expression:'bright:0'},state:s.state,size:280}));
    // The game re-applies every frame: read the second apply.
    const g=await page.evaluate(async spec=>{const g=await __fg.grid(spec);
      g.arms=__fg.cells().map(({svg,c})=>{__fg.api.apply(svg,__fg.posed(svg,c.state));const pose=__fg.api.inspect(svg);
        return[0,1].map(i=>{const art=[...svg.querySelectorAll('[data-foundation-forearm-art="fold"]')].find(e=>e.dataset.foundationForearm===String(i)),paint=svg.querySelector('[id$="-arm-paint-'+i+'"]'),hand=svg.querySelector('[data-foundation-open-hand="'+i+'"]'),a=pose?.arms?.[i]||{};
          return{fold:Boolean(a.fold),fist:Boolean(a.fist),artShown:Boolean(art&&art.style.display!=='none'),transform:art?.getAttribute('transform')||'',w:+(art?.getAttribute('width')||0),paintUpper:paint?.dataset.foundationPaintPart==='upper',handShown:Boolean(hand&&hand.style.display!=='none')};});});
      await __fg.settle(document.getElementById('fg-host'));return g;},{cells,cols:12,cellW:174,cellH:314,bg:'#1e2858'});
    await L.capture(page,g,path.join(OUT,'run-'+sex+'.png'));
    states.forEach((s,c)=>{for(const i of [0,1]){const a=g.arms[c][i],drawn=a.artShown&&a.transform.includes('rotate')&&a.paintUpper&&!a.handShown;
      // Folded toward the viewer: the runtime's own test (forearmOverlay 'toward') shows the fold image; a fist there
      // in the front view must be the drawn one.
      const want=s.id.startsWith('front/run/')&&a.fist&&a.artShown;const sample={sex,id:s.id,arm:i,want,drawn,...a};report.samples.push(sample);
      if(want&&!drawn)report.fails.push({...sample,why:'a front-run fist folded toward the viewer is not the drawn fist'});
      if(!want&&(a.transform||a.paintUpper))report.fails.push({...sample,why:'the drawn fist (or an upper-arm-only painting) outside a folded front-run fist'});}});
  }
  let check='';try{check=execFileSync('node',[path.join(__dirname,'arm','build-run-fist.cjs'),'--check'],{cwd:ROOT}).toString();}catch(e){check=(e.stdout||'').toString();report.fails.push({why:'tools/arm/build-run-fist.cjs --check: '+check.trim().replace(/\n/g,'; ')});}
  fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,1));
  const wanted=report.samples.filter(s=>s.want).length;
  console.log((OVERLAY?'[overlay '+OVERLAY+'] ':'')+'arms: '+report.samples.length+', folded front-run fists '+wanted+', failing '+report.fails.length+'; '+check.trim().replace(/\n/g,'; ')+' → '+path.relative(ROOT,OUT));
  for(const f of report.fails.slice(0,10))console.log('  FAIL '+[f.sex,f.id,f.arm!=null?'arm '+f.arm:'',f.why].filter(Boolean).join(' '));
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
  process.exit(report.fails.length||report.errors.length||!wanted?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
