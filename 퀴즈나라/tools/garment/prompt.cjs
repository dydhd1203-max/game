'use strict';
// ChatGPT garment prompt for one shop product (stage 3, WP4).
//
//   node tools/garment/prompt.cjs top:shirt:10          print the KO and EN prompts and write image 2
//   node tools/garment/prompt.cjs top:shirt --no-image  prompts only (no headless render)
//   node tools/garment/prompt.cjs top:shirt --kit DIR   also copy 1-그림틀.png, 2-옷참고.png and the prompts into DIR
//   node tools/garment/prompt.cjs --v1                  top:shirt:10 against the v1 prompt, line by line
//   node tools/garment/prompt.cjs --check               every product: no unfilled value, v1 differences as recorded,
//                                                       the prompts in assets/garment-template/프롬프트.md up to date,
//                                                       all frame branches (two/shared/single-sex/mirror) filled
//
// Inputs: tools/garment/prompts.json (frame, class rule lines, v1 record) and
// assets/garment-template/products.json (names, notes, sexes, mirrorSafe,
// designRef). Image 1 is always assets/garment-template/template-sheet.png
// (tools/garment/make-template.py); image 2 is the product's garment-only
// reference written by tools/garment/design-ref.cjs (headless ?demo=1).
// 작업자-안내도.png is for the worker only and is never attached.
const fs=require('node:fs'),path=require('node:path');

const ROOT=path.resolve(__dirname,'..','..');
const KIT=path.join(ROOT,'assets','garment-template');
const PROMPTS=path.join(__dirname,'prompts.json');
const PRODUCTS=path.join(KIT,'products.json');
const DOC=path.join(KIT,'프롬프트.md');
const TEMPLATE=path.join(KIT,'template-sheet.png');

const load=file=>JSON.parse(fs.readFileSync(file,'utf8'));

// Korean particles chosen by the last syllable's final consonant.
function particle(word,kind){
  const last=String(word).trim().slice(-1),code=last.charCodeAt(0)-0xac00,hangul=code>=0&&code<11172;
  const jong=hangul?code%28:0,batchim=jong>0;
  switch(kind){
    case '은':return batchim?'은':'는';
    case '이':return batchim?'이':'가';
    case '을':return batchim?'을':'를';
    case '로':return batchim&&jong!==8?'으로':'로'; // ㄹ final takes 로
    default:throw new Error('unknown particle '+kind);
  }
}
// {name} {name|은} {name^}; values may themselves hold placeholders.
function fill(text,values,depth=0){
  if(depth>4)throw new Error('placeholder loop in '+text);
  const out=text.replace(/\{([A-Za-z]+)(\|[은이을로]|\^)?\}/g,(m,name,mod)=>{
    if(!(name in values))throw new Error('no value for {'+name+'} in: '+text);
    let v=fill(String(values[name]),values,depth+1);
    if(mod==='^')v=v.charAt(0).toUpperCase()+v.slice(1);
    else if(mod)v+=particle(v,mod.slice(1));
    return v;
  });
  return out;
}

function resolve(id,products){
  const [cat,shape,ci]=String(id).split(':'),key=cat+':'+shape,product=products.products[key];
  if(!product)throw new Error('unknown product '+id+'. products.json lists: '+Object.keys(products.products).join(', ')+
    '. The basic outfit (top:tee, bottom:shorts, shoes:sneaker) needs no ChatGPT sheet: the template already wears it.');
  if(ci!==undefined&&!product.sexes.some(sex=>String(product.ci[sex])===ci))
    throw new Error(id+': the shop sells '+key+' only as '+product.sexes.map(sex=>(sex==='m'?'boys ':'girls ')+key+':'+product.ci[sex]).join(', '));
  if(!/^(top\/short-sleeve|bottom\/shorts|shoes\/low)$/.test(product.class))throw new Error(key+': class '+product.class+' has no stage-3 prompt');
  return {key,product};
}

// The filled prompt lines for one language.
function build(product,lang,P){
  const notes=product.notes[lang],cls=P.classes[product.class][lang],ch=P.children[lang];
  const sexes=product.sexes,single=sexes.length===1,shared=!single&&!!product.sharedPicture;
  const values={...cls,item:notes.item,itemM:notes.itemM||notes.item,itemF:notes.itemF||notes.item,look:notes.look,back:notes.back};
  if(single){
    values.child=ch[sexes[0]];values.other=ch[sexes[0]==='m'?'f':'m'];
    values.targets=fill(ch.target,values);values.singleSex=P.singleSex[lang];
  }else{values.targets=ch.targetsBoth;values.singleSex='';}
  values.layout=P.layout[lang][single?'single':shared?'shared':'two'];
  values.mirror=product.mirrorSafe?'':P.mirror[lang];
  const label=lang==='ko'?sex=>ch[sex]:sex=>ch.line[sex];
  values.descriptions=(shared?['- '+ch.both+': '+notes.both]:sexes.map(sex=>'- '+label(sex)+': '+notes[sex])).join('\n');
  return fill(P.frame[lang].join('\n'),values).split('\n');
}

function prompts(id,{P=load(PROMPTS),products=load(PRODUCTS)}={}){
  const {key,product}=resolve(id,products);
  return {key,product,ko:build(product,'ko',P),en:build(product,'en',P)};
}

// v1 comparison: rule/paragraph lines that differ from the recorded v1 text.
function v1Diff(P=load(PROMPTS),products=load(PRODUCTS)){
  const now=prompts(P.v1.product,{P,products}),out=[];
  for(const lang of ['ko','en']){
    const a=P.v1[lang],b=now[lang],n=Math.max(a.length,b.length);
    for(let i=0;i<n;i++)if(a[i]!==b[i])out.push({lang,line:i,rule:(b[i]||a[i]||'').match(/^(\d)\. /)?.[1]||null,v1:a[i]??null,now:b[i]??null});
  }
  return out;
}

// The prompts quoted in 프롬프트.md (blocks after '<!-- prompt:<id>:<lang> -->').
function docBlocks(text=fs.existsSync(DOC)?fs.readFileSync(DOC,'utf8'):''){
  const out={};
  for(const m of text.matchAll(/<!-- prompt:([a-z_]+:[a-z_]+(?::\d+)?):(ko|en) -->\s*```\n([\s\S]*?)\n```/g))out[m[1]+':'+m[2]]=m[3];
  return out;
}

function check(){
  const P=load(PROMPTS),products=load(PRODUCTS),problems=[];
  for(const key of Object.keys(products.products)){
    try{const r=prompts(key,{P,products});
      for(const lang of ['ko','en'])for(const line of r[lang])if(/[{}]/.test(line))problems.push(key+' '+lang+': unfilled value in "'+line+'"');
      const p=r.product;
      for(const field of ['class','sexes','ci','names','colour','display','designRef'])if(p[field]===undefined)problems.push(key+': products.json lacks '+field);
      if(p.mirrorSafe===undefined)problems.push(key+': products.json lacks mirrorSafe');
      for(const sex of p.sexes)for(const f of ['colour','display'])if(!/^#[0-9a-f]{6}$/i.test(p[f]?.[sex]||''))problems.push(key+' '+sex+': '+f+' is not a hex');
      if(p.designRef&&!fs.existsSync(path.join(KIT,p.designRef)))problems.push(key+': image 2 missing ('+p.designRef+'): node tools/garment/design-ref.cjs '+key);
    }catch(e){problems.push(key+': '+e.message);}
  }
  // Every frame branch, on synthetic products derived from the pilot.
  const base=products.products[P.v1.product.split(':').slice(0,2).join(':')];
  const variants={
    'single-m':{...base,sexes:['m'],mirrorSafe:false},
    'single-f-shoes':{...products.products['shoes:ballet']||base,mirrorSafe:false},
    'shared-mirror':{...base,sharedPicture:true,mirrorSafe:false,notes:{ko:{...base.notes.ko,both:'둘 다'},en:{...base.notes.en,both:'both'}}}
  };
  for(const [name,product] of Object.entries(variants)){
    const fake={products:{'x:y':product}};
    try{const r=prompts('x:y',{P,products:fake});
      for(const lang of ['ko','en']){const text=r[lang].join('\n');
        if(/[{}]/.test(text))problems.push('branch '+name+' '+lang+': unfilled value');
        if(!product.mirrorSafe&&!text.includes(P.mirror[lang].trim()))problems.push('branch '+name+' '+lang+': mirror line missing');
        if(product.sexes.length===1&&!text.includes(lang==='ko'?'바꾸지 않습니다':'Do not change the'))problems.push('branch '+name+' '+lang+': single-sex line missing');}
    }catch(e){problems.push('branch '+name+': '+e.message);}
  }
  // Particles.
  for(const [w,k,want] of [['셔츠','로','셔츠로'],['신발','로','신발로'],['반바지, 신발','은','반바지, 신발은'],['윗옷, 반바지','은','윗옷, 반바지는'],['옷','을','옷을'],['신발','을','신발을'],['카고 반바지','로','카고 반바지로'],['윗옷','은','윗옷은']])
    if(w+particle(w,k)!==want)problems.push('particle: '+w+'+'+k+' gives '+w+particle(w,k));
  // v1: only the recorded rules differ.
  const diff=v1Diff(P,products),rules=[...new Set(diff.map(d=>d.rule).filter(Boolean))].sort(),want=Object.keys(P.v1.changes).sort();
  if(diff.some(d=>!d.rule))problems.push('v1: a non-rule line differs: '+JSON.stringify(diff.find(d=>!d.rule)));
  if(JSON.stringify(rules)!==JSON.stringify(want))problems.push('v1: rules '+rules.join(',')+' differ, prompts.json records '+want.join(','));
  // The document quotes the generated prompts and every class rule line.
  const doc=fs.existsSync(DOC)?fs.readFileSync(DOC,'utf8'):'',blocks=docBlocks(doc);
  if(!Object.keys(blocks).length)problems.push('프롬프트.md quotes no generated prompt');
  for(const [cls,def] of Object.entries(P.classes))if(!doc.includes(def.ko.length.replace(/\{item\}/g,'{옷}')))problems.push('프롬프트.md lacks the current '+cls+' rule line');
  for(const [k,text] of Object.entries(blocks)){
    const [cat,shape,...rest]=k.split(':'),lang=rest.pop(),id=[cat,shape,...rest].join(':');
    try{if(prompts(id,{P,products})[lang].join('\n')!==text)problems.push('프롬프트.md '+k+' is stale: node tools/garment/prompt.cjs '+id);}catch(e){problems.push('프롬프트.md '+k+': '+e.message);}
  }
  return {problems,v1:diff,blocks:Object.keys(blocks)};
}

function header(r){
  const p=r.product,sexes=p.sexes.map(sex=>(sex==='m'?'남':'여')+' '+r.key+':'+p.ci[sex]+" '"+p.names[sex]+"' 상점 색 "+p.display[sex]+(p.display[sex]!==p.colour[sex]?' (카탈로그 '+p.colour[sex]+')':'')).join(', ');
  return ['상품: '+sexes+'  ('+p.class+(p.mirrorSafe?'':', 좌우 뒤집기 주의')+(p.sexes.length===1?', 한 성별 상품':'')+')',
    '첨부 1: '+path.relative(ROOT,TEMPLATE)+'  (그림 틀, 먼저)',
    '첨부 2: '+path.relative(ROOT,path.join(KIT,p.designRef))+'  (옷만 그린 디자인 참고, 두 번째)',
    '작업자-안내도.png는 ChatGPT에 올리지 않습니다.'].join('\n');
}

async function main(){
  const H=require('../verify-harness.cjs'),a=H.args();
  for(const flag of ['check','v1','no-image'])if(typeof a[flag]==='string'){a._.push(a[flag]);a[flag]=true;}
  if(a.check){
    const r=check();
    for(const d of r.v1)console.log('v1 '+d.lang+' rule '+d.rule+':\n  v1:  '+d.v1+'\n  now: '+d.now);
    console.log('프롬프트.md quotes: '+r.blocks.join(', '));
    for(const p of r.problems)console.log('PROBLEM: '+p);
    console.log(r.problems.length?'prompt: FAILED':'prompt: OK');
    process.exit(r.problems.length?1:0);
  }
  if(a.v1){
    const P=load(PROMPTS);
    for(const d of v1Diff(P))console.log(d.lang+' rule '+d.rule+' ('+(P.v1.changes[d.rule]||'NOT RECORDED')+')\n  v1:  '+d.v1+'\n  now: '+d.now+'\n');
    return;
  }
  const id=a._[0];
  if(!id){console.error('usage: node tools/garment/prompt.cjs <cat:shape[:ci]> [--no-image] [--kit DIR] | --v1 | --check');process.exit(2);}
  const r=prompts(id);
  console.log(header(r)+'\n\n===== 한국어 =====\n'+r.ko.join('\n')+'\n\n===== English =====\n'+r.en.join('\n')+'\n');
  if(!a['no-image']){
    const ref=path.join(KIT,r.product.designRef),before=fs.existsSync(ref)?H.sha256(fs.readFileSync(ref)):null;
    const result=await require('./design-ref.cjs').run({ids:[r.key]});
    const after=H.sha256(fs.readFileSync(ref));
    console.log('image 2: '+path.relative(ROOT,ref)+' '+(before===after?'(unchanged)':before?'(UPDATED from the shop art)':'(new)')+' sha256 '+after.slice(0,16));
    for(const p of result.catalog.problems)console.log('PROBLEM: '+p);
    if(result.catalog.problems.length)process.exitCode=1;
  }
  if(typeof a.kit==='string'){
    const dir=path.resolve(a.kit);fs.mkdirSync(dir,{recursive:true});
    fs.copyFileSync(TEMPLATE,path.join(dir,'1-그림틀.png'));
    fs.copyFileSync(path.join(KIT,r.product.designRef),path.join(dir,'2-옷참고-'+r.product.designRef));
    fs.writeFileSync(path.join(dir,'프롬프트-한국어.txt'),r.ko.join('\n')+'\n');
    fs.writeFileSync(path.join(dir,'prompt-english.txt'),r.en.join('\n')+'\n');
    console.log('kit: '+dir);
  }
}

module.exports={prompts,v1Diff,check,particle,fill,docBlocks};
if(require.main===module)main().catch(e=>{console.error(e.message||e);process.exit(1);});
