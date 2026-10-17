// The review room's motion preview sheets (검수실 '동작 미리보기', img/motion-<sex>-<view>.webp):
// 8 steps × 10 motions (서기·걷기·달리기·점프·인사·고개 인사·기뻐하기·사다리·아빠다리·책상 앉기),
// 126×237 cells, 210 px avatar, light stage colour. Demo only, nothing saved.
// node tools/boards/review-motion-sheets.cjs OUTDIR [--sexes m,f] [--views front,right,left,back]
// Writes OUTDIR/motion-<sex>-<view>.png (convert to webp for the page).
const path=require('node:path'),fs=require('node:fs'),L=require(path.resolve(__dirname,'..','foundation-garment-lib.cjs')),H=L.H,M=require(path.resolve(__dirname,'..','foundation-matrix.cjs'));
const OUT=process.argv[2],arg=(k,d)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:d;};
const SEXES=arg('--sexes','m,f').split(','),VIEWS=arg('--views','front,right,left,back').split(',');
const ROWS=[['idle','action'],['walk','action'],['run','action'],['jump','action'],['wave','gesture'],['nod','gesture'],['happy','gesture'],['climb','action'],['floor-sit','action'],['sit','action']];
const state=(name,kind,dir,k)=>kind==='gesture'?{action:'idle',direction:dir,gesture:name,gestureProgress:k/7,time:0}:M.actionState(name,dir,k);
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const server=await H.serve(H.fsTree(path.resolve(__dirname,'..','..')));const browser=await H.launch({args:H.RASTER_ARGS});const report={errors:[]};
  const {page}=await L.openRuntime(browser,server.base,report,{viewport:{width:1100,height:2500}});
  await L.install(page,{});
  for(const sex of SEXES)for(const view of VIEWS){
    const cells=[];for(const [name,kind] of ROWS)for(let k=0;k<8;k++)cells.push({av:{sex,sk:0,hair:(sex==='f'?'bob':'short')+':1',expression:'bright:0'},state:{...state(name,kind,view,k),reducedMotion:true},size:210});
    // The game re-applies every frame: apply once more before the picture.
    const g=await page.evaluate(async spec=>{const g=await __fg.grid(spec);for(const {svg,c} of __fg.cells())__fg.api.apply(svg,__fg.posed(svg,c.state));await __fg.settle(document.getElementById('fg-host'));return g;},{cells,cols:8,cellW:126,cellH:237,bg:'#dfe6ee'});
    await L.capture(page,g,path.join(OUT,'motion-'+sex+'-'+view+'.png'));
  }
  if(report.errors.length)console.error(report.errors.join('\n'));
  await browser.close();await server.close();
})().catch(e=>{console.error(e);process.exit(1);});
