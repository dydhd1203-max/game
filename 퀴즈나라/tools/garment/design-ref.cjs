'use strict';
// Garment-only design references (image 2 of the ChatGPT kit) and the
// products.json catalogue check (stage 3, WP4). Read-only: a headless
// ?demo=1 page of this folder, Firebase stubbed, nothing is saved there.
//
//   node tools/garment/design-ref.cjs top:shirt:10 [more ids]   write assets/garment-template/<designRef>
//   node tools/garment/design-ref.cjs --all                     every product of products.json with a designRef
//   node tools/garment/design-ref.cjs --check [ids]             rebuild into a temp dir and compare bytes (writes nothing)
//   node tools/garment/design-ref.cjs --out DIR [ids]           write into DIR instead (review)
//   node tools/garment/design-ref.cjs --verify-products         only the catalogue check of products.json
//
// The pictures are the current shop art with no body: tops and bottoms from
// QPClothes.surface(cat, shape, colour, sex) (the tinted shop painting), shoes
// from QPShoes' per-foot paintings (rear rim under the front, both feet on one
// floor line, spaced like the avatar's ankles). Boy left, girl right; a
// product whose two pictures are identical (same art and colour) or that is
// for one sex only shows one picture. No body is drawn: ChatGPT copied the
// old awkward arms and low shorts when the reference showed them (914c7ef).
//
// Layout (the v1 reference ref-shirt-10-design.png, reproduced byte for byte):
// each picture is scaled to 420 px wide with Pillow's Lanczos filter, centred
// in a band 90 px from the top, 60 px apart and 60 px from the sides, 30 px
// under the tallest picture, on white; PNG written by Pillow (optimize).
// The picture is painted with the shop's display colour: QPClothes.colorFor(
// cat, shape, sex, curatedItem.color) || curatedItem.color (avatar-pixel.js item()).
//
// Every run also checks products.json against the live catalogue for both
// sexes: QPGame.getCatalog().curatedItem(cat, shape, sex) (sexes, colour
// index, name, fixed colour = products.json colour), the painted colour
// (products.json display; boys' tops/shorts via maleColors, cross-checked), and
// the colour a real QPAvatar.render() writes (data-cloth-color / data-qpx-shoe-color).
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const H=require('../verify-harness.cjs');

const ROOT=path.resolve(__dirname,'..','..');
const KIT=path.join(ROOT,'assets','garment-template');
const PRODUCTS=path.join(KIT,'products.json');
const LAYOUT={width:420,side:60,gap:60,top:90,bottom:30};
const SEXES=['m','f'];
const rel=file=>{const r=path.relative(ROOT,file);return r.startsWith('..')?file:r;};

function loadProducts(file=PRODUCTS){return JSON.parse(fs.readFileSync(file,'utf8'));}
// 'top:shirt:10' / 'top:shirt' -> {key:'top:shirt', product}. A colour index
// must be one of the product's per-sex indices (the shop fixes one per sex).
function resolve(id,products=loadProducts()){
  const [cat,shape,ci]=String(id).split(':'),key=cat+':'+shape,product=products.products[key];
  if(!product)throw new Error('unknown product '+id+' (products.json lists '+Object.keys(products.products).join(', ')+')');
  if(ci!==undefined&&!product.sexes.some(sex=>String(product.ci[sex])===ci))
    throw new Error(id+': the shop sells '+key+' only as '+product.sexes.map(sex=>sex+':'+product.ci[sex]).join(', '));
  return {key,cat,shape,product};
}

async function openDemo(){
  const server=await H.serve(H.fsTree(ROOT));
  const browser=await H.launch({args:H.RASTER_ARGS});
  const context=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1});
  const report={};await H.isolate(context,report);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.base+'?demo=1');
  await page.waitForFunction(()=>window.QPGame&&window.QPDemo&&window.QPAvatar&&window.QPClothes?.atlas.ready&&window.QPShoes?.atlas.partsReady,null,{timeout:120000});
  return {page,errors,report,close:async()=>{await browser.close();await server.close();}};
}

// In the page: the live catalogue rows and the garment-only pictures.
function pageCapture({items,withPictures}){
  const C=QPGame.getCatalog();
  const load=src=>new Promise((ok,fail)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=()=>fail(new Error('image did not load'));img.src=src;});
  const href=(markup,attr)=>{const m=markup.match(new RegExp((attr?attr+'="true" ':'')+'href="([^"]+)"'));return m&&m[1];};
  async function shoes(shape,colour){
    // The shop's per-foot paintings: rear rim, then the front painting.
    // renderFoot/inspect alias 'dress' to its 'loafer' painting; renderRearFoot
    // does not, so the alias is applied here.
    const art=shape==='dress'?'loafer':shape,info=QPShoes.inspect(art),feet=[];
    for(const side of ['left','right']){
      const fit=info.feet[side],front=href(QPShoes.renderFoot(art,colour,side,'#ffe2cc'),'data-qps-front-rim'),rear=href(QPShoes.renderRearFoot(art,colour,side));
      if(!front||!rear)throw new Error('no shop painting for shoes:'+shape+' '+side);
      const c=document.createElement('canvas');c.width=fit.width;c.height=fit.height;const g=c.getContext('2d');
      g.drawImage(await load(rear),0,0);g.drawImage(await load(front),0,0);
      const pxPerUnit=fit.width/fit.target[2];feet.push({c,ankle:(fit.ankle[0]-fit.target[0])*pxPerUnit,ankleX:fit.ankle[0],pxPerUnit});
    }
    const [L,R]=feet,xr=Math.round(L.ankle+(R.ankleX-L.ankleX)*L.pxPerUnit-R.ankle),h=Math.max(L.c.height,R.c.height);
    const pair=document.createElement('canvas');pair.width=Math.max(L.c.width,xr+R.c.width);pair.height=h;const g=pair.getContext('2d');
    g.drawImage(L.c,0,h-L.c.height);g.drawImage(R.c,xr,h-R.c.height);return pair;
  }
  return (async()=>{
    const out={};
    for(const {key,cat,shape} of items){
      const row={catalog:{},pictures:{}};
      for(const sex of ['m','f']){
        const it=C.curatedItem(cat,shape,sex);
        if(!it){row.catalog[sex]=null;continue;}
        const painted=window.QPClothes.colorFor(cat,shape,sex,it.color)||it.color;
        const av={sex,sk:0,ec:0,eyes:'round',hair:sex==='m'?'short:1':'bob:1',top:'',bottom:'',shoes:'',outfit:''};av[cat]=shape+':'+it.ci;
        const holder=document.createElement('div');holder.innerHTML=QPAvatar.render(av,120);
        const node=cat==='shoes'?holder.querySelector('[data-qpx-shoe-color]'):holder.querySelector('[data-qpx-clothes="'+cat+'"]');
        row.catalog[sex]={id:it.id,ci:it.ci,name:it.name,price:it.price,starter:C.STARTER.includes(it.id),sexes:it.sexes,
          colour:it.color,display:painted,maleOverride:sex==='m'?window.QPClothes.colorFor(cat,shape,'m')||null:null,
          rendered:node?(cat==='shoes'?node.dataset.qpxShoeColor:node.dataset.clothColor):null};
        if(!withPictures)continue;
        let canvas;
        if(cat==='shoes')canvas=await shoes(shape,painted);
        else{const s=QPClothes.surface(cat,shape,painted,sex);canvas=s&&s.canvas;}
        row.pictures[sex]=canvas?canvas.toDataURL('image/png'):null;
      }
      out[key]=row;
    }
    return out;
  })();
}

// products.json against the live rows (both sexes).
function checkProducts(products,rows){
  const problems=[],table=[];
  for(const [key,row] of Object.entries(rows)){
    const p=products.products[key];
    for(const sex of SEXES){
      const live=row.catalog[sex],sells=p.sexes.includes(sex);
      if(!live){if(sells)problems.push(key+' '+sex+': products.json sells it, the shop does not');continue;}
      if(!sells){problems.push(key+' '+sex+': the shop sells it ('+live.id+'), products.json does not');continue;}
      const want={id:key+':'+p.ci[sex],ci:p.ci[sex],name:p.names[sex],colour:p.colour[sex],display:p.display[sex]};
      for(const [field,value] of Object.entries(want))if(String(live[field]).toLowerCase()!==String(value).toLowerCase())problems.push(key+' '+sex+' '+field+': products.json '+value+', shop '+live[field]);
      if(String(live.rendered).toLowerCase()!==String(live.display).toLowerCase())problems.push(key+' '+sex+': QPAvatar.render paints '+live.rendered+', colorFor gives '+live.display);
      if(sex==='m'&&live.maleOverride&&live.maleOverride.toLowerCase()!==live.display.toLowerCase())problems.push(key+' m: colorFor male override '+live.maleOverride+' is not the painted colour '+live.display);
      if(sex==='f'&&live.display.toLowerCase()!==live.colour.toLowerCase())problems.push(key+' f: girls are painted with the fixed colour, got '+live.display+' for '+live.colour);
      table.push([key,sex,live.id,live.name,live.colour,live.display,live.rendered,live.maleOverride?'maleColors':'palette',live.starter?'starter':'']);
    }
  }
  return {problems,table};
}

// Pillow composition (the v1 layout). Runs isolated (-I): no repo code imported.
const COMPOSE=String.raw`
import base64, io, json, sys
from PIL import Image
job = json.load(sys.stdin)
L = job['layout']
ims = [Image.open(io.BytesIO(base64.b64decode(u.split(',', 1)[1]))).convert('RGBA') for u in job['pictures']]
scaled = [im.resize((L['width'], round(im.height * L['width'] / im.width)), Image.LANCZOS) for im in ims]
H = max(s.height for s in scaled)
n = len(scaled)
canvas = Image.new('RGBA', (2 * L['side'] + n * L['width'] + (n - 1) * L['gap'], L['top'] + H + L['bottom']), (255, 255, 255, 255))
for i, s in enumerate(scaled):
    canvas.alpha_composite(s, (L['side'] + i * (L['width'] + L['gap']), L['top'] + (H - s.height) // 2))
buf = io.BytesIO()
canvas.convert('RGB').save(buf, 'PNG', optimize=True)
sys.stdout.write(base64.b64encode(buf.getvalue()).decode())
`;
function python(){return process.env.QUIZ_PYTHON||(process.platform==='win32'?'python':'python3');}
function compose(pictures){
  const run=spawnSync(python(),['-I','-B','-c',COMPOSE],{input:JSON.stringify({layout:LAYOUT,pictures}),maxBuffer:1<<28});
  if(run.status!==0)throw new Error('Pillow composition failed: '+(run.stderr||run.error||'').toString());
  return Buffer.from(run.stdout.toString(),'base64');
}
// Which pictures go into image 2: boy left, girl right; one when identical.
function picturesFor(product,row){
  const list=product.sexes.map(sex=>row.pictures[sex]);
  if(list.some(p=>!p))throw new Error('no shop picture for '+product.sexes.filter(sex=>!row.pictures[sex]).join(','));
  return list.length===2&&list[0]===list[1]?{pictures:[list[0]],shared:true}:{pictures:list,shared:false};
}

async function run({ids=[],all=false,check=false,out=null,verifyOnly=false}={}){
  const products=loadProducts();
  const keys=all||verifyOnly&&!ids.length?Object.keys(products.products):ids.map(id=>resolve(id,products).key);
  const items=[...new Set(keys)].map(key=>{const [cat,shape]=key.split(':');return {key,cat,shape};});
  const demo=await openDemo();
  try{
    const rows=await demo.page.evaluate(pageCapture,{items,withPictures:!verifyOnly});
    const result={catalog:checkProducts(products,rows),written:[],compared:[],skipped:[],pageErrors:demo.errors,blocked:demo.report.blocked,firebase:demo.report.errors};
    if(!verifyOnly){
      const dir=check?fs.mkdtempSync(path.join(os.tmpdir(),'design-ref-')):out?path.resolve(out):KIT;
      fs.mkdirSync(dir,{recursive:true});
      for(const {key} of items){
        const p=products.products[key];
        if(!p.designRef){result.skipped.push(key+' (no designRef: '+(p.basic?'the template already wears it':'not set')+')');continue;}
        const {pictures,shared}=picturesFor(p,rows[key]),png=compose(pictures),file=path.join(dir,p.designRef);
        const {width,height}=H.png.decode(png);
        if(Boolean(p.sharedPicture)!==shared)result.catalog.problems.push(key+': products.json sharedPicture '+Boolean(p.sharedPicture)+', the shop pictures are '+(shared?'identical':'different'));
        fs.writeFileSync(file,png);
        const entry={key,file:rel(file),size:[width,height],pictures:pictures.length,sha256:H.sha256(png)};
        if(check){
          const committed=path.join(KIT,p.designRef);
          entry.committed=rel(committed);
          entry.identical=fs.existsSync(committed)&&H.sha256(fs.readFileSync(committed))===entry.sha256;
          if(!entry.identical&&fs.existsSync(committed)){
            const a=H.png.decode(fs.readFileSync(committed)),b=H.png.decode(png);let max=0;
            if(a.width===b.width&&a.height===b.height)for(let i=0;i<a.data.length;i++)max=Math.max(max,Math.abs(a.data[i]-b.data[i]));
            entry.pixels=a.width===b.width&&a.height===b.height?(max?'max diff '+max:'equal (encoder differs)'):'size '+a.width+'x'+a.height+' vs '+b.width+'x'+b.height;
          }
          result.compared.push(entry);
        }else result.written.push(entry);
      }
      if(check)fs.rmSync(dir,{recursive:true,force:true});
    }
    return result;
  }finally{await demo.close();}
}

function print(result){
  const t=result.catalog.table;
  if(t.length){console.log('product            sex id                  name             colour     display    rendered   display from');
    for(const r of t)console.log([r[0].padEnd(18),r[1].padEnd(3),r[2].padEnd(19),r[3].padEnd(16),r[4].padEnd(10),r[5].padEnd(10),r[6].padEnd(10),r[7].padEnd(11),r[8]].join(' '));}
  for(const w of result.written)console.log('wrote '+w.file+' '+w.size.join('x')+' ('+w.pictures+' picture'+(w.pictures>1?'s':'')+') sha256 '+w.sha256.slice(0,16));
  for(const c of result.compared)console.log((c.identical?'IDENTICAL ':'DIFFERENT ')+c.committed+(c.identical?'':' ('+(c.pixels||'missing')+')')+' sha256 '+c.sha256.slice(0,16));
  for(const s of result.skipped)console.log('skipped '+s);
  for(const e of result.pageErrors)console.log('page error: '+e);
  for(const e of result.firebase)console.log('FIREBASE: '+e);
  for(const p of result.catalog.problems)console.log('PROBLEM: '+p);
  const ok=!result.catalog.problems.length&&!result.pageErrors.length&&!result.firebase.length&&result.compared.every(c=>c.identical);
  console.log(ok?'design-ref: OK':'design-ref: FAILED');
  return ok;
}

module.exports={run,resolve,loadProducts,LAYOUT,KIT,PRODUCTS};

if(require.main===module){
  const a=H.args();
  if(a.help||a.h){console.log(fs.readFileSync(__filename,'utf8').split('\n').filter(l=>l.startsWith('//')).map(l=>l.slice(3)).join('\n'));process.exit(0);}
  const ids=a._;
  // A bare flag followed by an id ("--check top:shirt:10") parsed as a value.
  for(const flag of ['all','check','verify-products'])if(typeof a[flag]==='string'){ids.push(a[flag]);a[flag]=true;}
  if(!ids.length&&!a.all&&!a['verify-products']&&!a.check){console.error('give product ids (e.g. top:shirt:10), --all, --check or --verify-products');process.exit(2);}
  run({ids,all:!!a.all||(!!a.check&&!ids.length),check:!!a.check,out:typeof a.out==='string'?a.out:null,verifyOnly:!!a['verify-products']})
    .then(result=>process.exit(print(result)?0:1)).catch(e=>{console.error(e.stack||e);process.exit(1);});
}
