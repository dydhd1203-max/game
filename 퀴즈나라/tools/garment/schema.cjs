'use strict';
/* Garment records (stage 3): validator for tools/garment/schema.json, the
   semantic checks listed in its x-checks, and the id → file name encoding.

     node tools/garment/schema.cjs                    validate every assets/sd-garment-*.js record and the index
     node tools/garment/schema.cjs <file.js|.json>…   validate these records (data files or plain JSON)
     node tools/garment/schema.cjs --builder <file>   as the stage-3 builder: reserved classes are refused
     node tools/garment/schema.cjs --self-test        negative controls (each must be caught with its code)

   const S=require('./schema.cjs');
   S.validate(record,{context:S.loadContext(root),root,builder:false}) → [{code,path,message}]
   S.validateIndex(index,{records}) → issues
   S.stem('bottom:jean_skirt') → 'bottom-jean_skirt'; S.idFromStem(stem); S.filesFor(id,sexes)
   S.readDataFile(file) → the record a data file registers (run in a sandbox)

   Library only: nothing here writes files. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..','..');
const SCHEMA=JSON.parse(fs.readFileSync(path.join(__dirname,'schema.json'),'utf8'));
const RUNTIME_CLASSES=SCHEMA['x-classes'].runtime,RESERVED_CLASSES=SCHEMA['x-classes'].reserved;
const SLOTS=SCHEMA['x-slots'],VIEWS=SCHEMA['x-views'],LEGACY_COMPUTED=SCHEMA['x-legacyComputed'],SHEET=SCHEMA['x-sheet'];
const sha256=x=>crypto.createHash('sha256').update(x).digest('hex');

// ---------------------------------------------------------------------------
// Ids and file names. cat is [a-z]+ and shape [a-z0-9_]+, so 'cat-shape'
// splits at its first '-' and keeps '_' (jean_skirt, wing_shoes, cat_ears).
// ---------------------------------------------------------------------------
const ID_RE=/^([a-z]+):([a-z0-9_]+)$/,STEM_RE=/^([a-z]+)-([a-z0-9_]+)$/;
const ATLAS_RE=new RegExp(SCHEMA['x-files'].atlasPattern),DATA_RE=/^assets\/sd-garment-([a-z]+)-([a-z0-9_]+)\.js$/,BUNDLE_RE=/^assets\/avatar-file-data-garment-([a-z]+)-([a-z0-9_]+)\.js$/;
function stem(id){const m=ID_RE.exec(String(id));if(!m)throw new Error('Garment id must be cat:shape with cat [a-z]+ and shape [a-z0-9_]+: '+id);return m[1]+'-'+m[2];}
function idFromStem(s){const m=STEM_RE.exec(String(s));if(!m)throw new Error('Not a garment file stem: '+s);return m[1]+':'+m[2];}
function filesFor(id,sexes=['m','f']){const s=stem(id),out={data:'assets/sd-garment-'+s+'.js'};for(const sex of sexes)out[sex]='assets/sd-garment-'+s+'-'+sex+'.png';out.bundle='assets/avatar-file-data-garment-'+s+'.js';return out;}
// assets/… path → {kind, id, sex?} or null.
function parseFile(p){let m;
  if((m=ATLAS_RE.exec(p)))return{kind:'atlas',id:m[1]+':'+m[2],sex:m[3]};
  if((m=DATA_RE.exec(p)))return{kind:'data',id:m[1]+':'+m[2]};
  if((m=BUNDLE_RE.exec(p)))return{kind:'bundle',id:m[1]+':'+m[2]};
  return null;}

// ---------------------------------------------------------------------------
// JSON-Schema subset: $ref (#/…), type, const, enum, oneOf/anyOf/allOf,
// required, properties, additionalProperties, minProperties, items, minItems,
// maxItems, uniqueItems, pattern, minLength, minimum, maximum.
// ---------------------------------------------------------------------------
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const isType=(v,t)=>t==='null'?v===null:t==='array'?Array.isArray(v):t==='object'?v!==null&&typeof v==='object'&&!Array.isArray(v):t==='integer'?Number.isInteger(v):t==='number'?typeof v==='number'&&Number.isFinite(v):typeof v===t;
function resolve(ref){if(!ref.startsWith('#/'))throw new Error('Only local $ref: '+ref);return ref.slice(2).split('/').reduce((node,key)=>{if(!node||!(key in node))throw new Error('Unresolved $ref '+ref);return node[key];},SCHEMA);}
function structural(node,value,at,out){
  if(node.$ref)structural(resolve(node.$ref),value,at,out);
  const err=message=>out.push({code:'SCHEMA',path:at||'$',message});
  if('const' in node&&!same(value,node.const))err('must be '+JSON.stringify(node.const));
  if(node.enum&&!node.enum.some(e=>same(e,value)))err('must be one of '+node.enum.map(e=>JSON.stringify(e)).join(', ')+' (got '+JSON.stringify(value)+')');
  if(node.type&&![].concat(node.type).some(t=>isType(value,t))){err('must be '+[].concat(node.type).join('|'));return;}
  for(const key of ['oneOf','anyOf']){if(!node[key])continue;
    const tries=node[key].map(s=>{const e=[];structural(s,value,at,e);return e;}),ok=tries.filter(e=>!e.length).length;
    if(key==='oneOf'?ok!==1:ok<1){if(ok>1)err('matches '+ok+' branches of oneOf');else out.push(...tries.reduce((a,b)=>b.length<a.length?b:a));}}
  if(node.allOf)for(const s of node.allOf)structural(s,value,at,out);
  if(typeof value==='string'){
    if(node.pattern&&!new RegExp(node.pattern,'u').test(value))err('must match '+node.pattern+' (got '+JSON.stringify(value)+')');
    if(node.minLength!==undefined&&[...value].length<node.minLength)err('is shorter than '+node.minLength);}
  if(typeof value==='number'){
    if(node.minimum!==undefined&&value<node.minimum)err('must be >= '+node.minimum);
    if(node.maximum!==undefined&&value>node.maximum)err('must be <= '+node.maximum);}
  if(Array.isArray(value)){
    if(node.minItems!==undefined&&value.length<node.minItems)err('needs at least '+node.minItems+' items');
    if(node.maxItems!==undefined&&value.length>node.maxItems)err('allows at most '+node.maxItems+' items');
    if(node.uniqueItems&&new Set(value.map(v=>JSON.stringify(v))).size!==value.length)err('items must be unique');
    if(node.items)value.forEach((v,i)=>structural(node.items,v,at+'['+i+']',out));}
  if(isType(value,'object')){
    const props=node.properties||{};
    for(const key of node.required||[])if(!(key in value))err('missing '+key);
    if(node.minProperties!==undefined&&Object.keys(value).length<node.minProperties)err('needs at least '+node.minProperties+' properties');
    for(const [key,v] of Object.entries(value)){
      if(props[key])structural(props[key],v,at+'.'+key,out);
      else if(node.additionalProperties===false)err('unknown property '+key);
      else if(isType(node.additionalProperties,'object'))structural(node.additionalProperties,v,at+'.'+key,out);}}
}

// ---------------------------------------------------------------------------
// Context for the frozen-body checks: the reference data (body joints and the
// legacy garment rects), SEAT/SIDE_SEAT and the sleeve mesh canvas from
// avatar-foundation-outfit.js, the frozen body record.
// ---------------------------------------------------------------------------
function literalAfter(src,marker){
  const i=src.indexOf(marker);if(i<0)throw new Error('Not found in avatar-foundation-outfit.js: '+marker);
  let j=i+marker.length,depth=0,k=j;for(;k<src.length;k++){const c=src[k];if(c==='{')depth++;else if(c==='}'&&--depth===0)break;}
  return vm.runInNewContext('('+src.slice(j,k+1)+')');
}
function loadContext(root=ROOT){
  const box={};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/sd-foundation-ref-data.js'),'utf8'),box);
  const outfit=fs.readFileSync(path.join(root,'avatar-foundation-outfit.js'),'utf8');
  const frame=/d:\[\(p\[0\]\+(\d+)\)\*(\d+),\(p\[1\]\+\1\)\*\2\]/.exec(outfit),canvas=/c\.width=c\.height=(\d+);const ctx=c\.getContext\('2d'\),cols=10,rows=12/.exec(outfit);
  if(!frame||!canvas)throw new Error('Sleeve mesh canvas not found in avatar-foundation-outfit.js sleeveTexture');
  const half=Number(frame[1]);if(Number(canvas[1])!==2*half*Number(frame[2]))throw new Error('Sleeve canvas is not centred on the shoulder');
  const frozenPath=path.join(root,'tools/garment/frozen/frozen-body.json'),frozen=JSON.parse(fs.readFileSync(frozenPath,'utf8'));
  return{figures:box.QPFoundationReferenceData.figures,seat:literalAfter(outfit,'const SEAT='),sideSeat:literalAfter(outfit,'const SIDE_SEAT='),
    sleeveBox:[-half,-half,2*half,2*half],frozen,bodyFieldsSha256:frozen.bodyFieldsSha256,legacyBasic:frozen.legacyBasic};
}

// PNG chunk list and IHDR of a file's bytes.
function pngInfo(buf){
  if(buf.length<8||buf.readUInt32BE(0)!==0x89504e47||buf.readUInt32BE(4)!==0x0d0a1a0a)return null;
  const chunks=[];let i=8,ihdr=null;
  while(i+8<=buf.length){const n=buf.readUInt32BE(i),type=buf.toString('latin1',i+4,i+8);chunks.push(type);if(type==='IHDR')ihdr={width:buf.readUInt32BE(i+8),height:buf.readUInt32BE(i+12),depth:buf[i+16],colour:buf[i+17],interlace:buf[i+20]};i+=12+n;if(type==='IEND')break;}
  return{chunks,ihdr,trailing:buf.length-i};
}
const chunksOk=info=>!!info&&info.chunks[0]==='IHDR'&&info.chunks.at(-1)==='IEND'&&info.chunks.slice(1,-1).length>0&&info.chunks.slice(1,-1).every(c=>c==='IDAT')&&info.trailing===0;

// ---------------------------------------------------------------------------
// Semantic checks.
// ---------------------------------------------------------------------------
function legacyFieldsFor(slot){return(SLOTS[slot]?.parts||[]).flatMap(p=>LEGACY_COMPUTED[p]||[]);}
function semantic(r,{context,root,builder}={}){
  const out=[],add=(code,p,message)=>out.push({code,path:p,message});
  const m=ID_RE.exec(r.id);
  if(!m||r.id!==r.cat+':'+r.shape)add('ID','$.id','id must equal cat:shape ('+r.cat+':'+r.shape+')');
  const slot=SLOTS[r.slot];
  if(!slot)return out;
  if(slot.cat!==r.cat)add('ID','$.slot','slot '+r.slot+' belongs to catalogue category '+slot.cat+', not '+r.cat);
  if(!same(r.slots,slot.slots))add('ID','$.slots','slots of '+r.slot+' are '+JSON.stringify(slot.slots));
  if(String(r.class).split('/')[0]!==r.slot)add('ID','$.class','class '+r.class+' does not belong to slot '+r.slot);
  const reserved=RESERVED_CLASSES.includes(r.class);
  if(reserved&&builder)add('CLASS_RESERVED','$.class',r.class+' is reserved: the stage-3 builder makes only '+RUNTIME_CLASSES.join(', '));
  if(reserved&&r.legacy)add('CLASS_RESERVED','$.class','a legacy record must have a runtime class');
  // Legacy: exactly the runtime-computed fields are left null.
  const expected=legacyFieldsFor(r.slot);
  if(r.legacy){
    if(!same([...r.legacyComputed].sort(),[...expected].sort()))add('LEGACY','$.legacyComputed','a legacy '+r.slot+' record lists '+JSON.stringify(expected));
    if(r.source?.kind!=='legacy-basic')add('LEGACY','$.source.kind','a legacy record comes from the legacy basic layers');
    if(r.bodyArt!=='legacy')add('LEGACY','$.bodyArt','a legacy record is drawn over the legacy body art');
  }else if(r.legacyComputed.length)add('LEGACY','$.legacyComputed','a pipeline record computes nothing at runtime');
  const nullWanted=new Set(r.legacy?expected:[]);
  const field=(name,p,value)=>{if(!expected.includes(name))return;if(nullWanted.has(name)&&value!==null)add('LEGACY',p,name+' is computed at runtime for a legacy record and must be null');if(!nullWanted.has(name)&&value===null&&RUNTIME_CLASSES.includes(r.class))add('LEGACY',p,name+' is required for a pipeline record');};
  // Sexes agree.
  const sexes=Object.keys(r.sexes).sort();
  for(const key of ['catalog','mirrorSafe'])if(!same(Object.keys(r[key]).sort(),sexes))add('SEXES','$.'+key,key+' must name the same sexes as sexes ('+sexes.join(',')+')');
  // Catalogue entries.
  for(const [sex,c] of Object.entries(r.catalog)){
    if(!c.item.startsWith(r.id+':')||c.item!==r.id+':'+c.ci)add('CATALOG','$.catalog.'+sex+'.item',c.item+' must be '+r.id+':'+c.ci);
    for(const id of c.legacyIds)if(!id.startsWith(r.id+':'))add('CATALOG','$.catalog.'+sex+'.legacyIds',id+' is not a colour of '+r.id);}
  const files=filesFor(r.id,sexes);
  for(const [sex,S] of Object.entries(r.sexes)){
    const base='$.sexes.'+sex;
    if(S.atlas!==files[sex])add('FILES',base+'.atlas','atlas must be '+files[sex]);
    const rows=SHEET.rows[sex],regions=[];
    const region=(p,rect,at,label)=>{
      if(rect[2]<1||rect[3]<1)add('SHEET',p+'.rect','empty rect');
      if(rect[0]<0||rect[0]+rect[2]>SHEET.width||rect[1]<rows[0]||rect[1]+rect[3]>rows[1])add('SHEET',p+'.rect','rect '+JSON.stringify(rect)+' leaves the '+sex+' sheet rows '+rows.join('–'));
      if(!at)return;const box=[at[0],at[1],rect[2],rect[3]];
      if(box[0]+box[2]>S.size[0]||box[1]+box[3]>S.size[1])add('ATLAS',p,label+' '+JSON.stringify(box)+' leaves the atlas '+S.size.join('x'));
      for(const o of regions)if(box[0]<o.box[0]+o.box[2]&&o.box[0]<box[0]+box[2]&&box[1]<o.box[1]+o.box[3]&&o.box[1]<box[1]+box[3])add('ATLAS',p,label+' overlaps '+o.p);
      regions.push({p:p+(label==='raisedAt'?'.raisedAt':''),box});};
    for(const view of ['front','right','back']){
      const F=S.figures[view],fp=base+'.figures.'+view,pairs=VIEWS[view].pairs,ref=context?.figures?.[sex+'-'+view];
      const parts=Object.keys(F).filter(k=>['top','bottom','shoes'].includes(k)).sort();
      if(!same(parts,[...slot.parts].sort())){add('VIEWS',fp,'parts must be '+slot.parts.join(',')+' (got '+parts.join(',')+')');}
      const eq=(a,b)=>same(a,b),legacyRect=(p,rect,want)=>{if(r.legacy&&ref&&!eq(rect,want))add('LEGACY_RECT',p+'.rect','legacy rect must be '+JSON.stringify(want)+' (sd-foundation-ref-data.js)');};
      if(F.top){const T=F.top,tp=fp+'.top';
        region(tp+'.torso',T.torso.rect,T.torso.at,'at');legacyRect(tp+'.torso',T.torso.rect,ref?.rects.shirt);
        if(T.sleeves.length!==pairs)add('VIEWS',tp+'.sleeves',view+' has '+pairs+' sleeve(s)');
        if(T.underarm&&T.underarm.length!==pairs)add('VIEWS',tp+'.underarm',view+' has '+pairs+' underarm side(s)');
        field('top.underarm',tp+'.underarm',T.underarm);field('top.hem',tp+'.hem',T.hem);field('top.collar',tp+'.collar',T.collar);
        T.sleeves.forEach((s,i)=>{const sp=tp+'.sleeves['+i+']';
          region(sp,s.rect,s.at,'at');if(s.raisedAt)region(sp,s.rect,s.raisedAt,'raisedAt');
          field('sleeves.raisedAt',sp+'.raisedAt',s.raisedAt);field('sleeves.opening',sp+'.opening',s.opening);
          if(!(s.box[2]>0&&s.box[3]>0))add('BOX',sp+'.box','box needs a positive size');
          if(!ref)return;legacyRect(sp,s.rect,ref.rects.sleeve[i]);
          if(!eq(s.shoulder,ref.joints.shoulder[i]))add('ANCHOR',sp+'.shoulder','shoulder must be the frozen joint '+JSON.stringify(ref.joints.shoulder[i]));
          if(r.legacy){const want=(ref.cuff_top-ref.joints.shoulder[i][1])*ref.k;if(s.cuff!==want)add('CUFF',sp+'.cuff','cuff must be (cuff_top − shoulder_y)·k = '+want);
            if(!eq(s.box,context.sleeveBox))add('BOX',sp+'.box','legacy box must be the sleeve mesh canvas '+JSON.stringify(context.sleeveBox));}});
        if(pairs===1&&ref&&!eq(ref.joints.shoulder[0],ref.joints.shoulder[1]))add('VIEWS',tp+'.sleeves','one profile sleeve needs equal shoulders');}
      if(F.bottom){const B=F.bottom,bp=fp+'.bottom';
        region(bp,B.rect,B.at,'at');legacyRect(bp,B.rect,ref?.rects.shorts);
        field('bottom.waistTop',bp+'.waistTop',B.waistTop);field('bottom.edgeTone',bp+'.edgeTone',B.edgeTone);field('bottom.cuffAlong',bp+'.cuffAlong',B.cuffAlong);
        const want=VIEWS[view].seat,other=want==='seat'?'sideSeat':'seat';
        if(r.class==='bottom/shorts'&&!B[want])add('VIEWS',bp+'.'+want,view+' shorts need '+want);
        if(B[other])add('VIEWS',bp+'.'+other,other+' belongs to the '+(other==='seat'?'front/back':'right')+' view');
        if(B.sideSeat)field('sideSeat.span',bp+'.sideSeat.span',B.sideSeat.span??null);
        if(B.cuffAlong&&B.cuffAlong.length!==pairs)add('VIEWS',bp+'.cuffAlong',view+' has '+pairs+' leg(s)');
        if(r.legacy&&context){const key=sex+'-'+view,constant=want==='seat'?context.seat[key]:context.sideSeat[key];
          const got=B[want]&&(want==='seat'?{cut:B.seat.cut,apex:B.seat.apex,cuff:B.seat.cuff,rise:B.seat.rise}:{cut:B.sideSeat.cut,cuff:B.sideSeat.cuff});
          if(!constant||!eq(got,constant))add('SEAT',bp+'.'+want,want+' must equal avatar-foundation-outfit.js '+(want==='seat'?'SEAT':'SIDE_SEAT')+'['+key+'] = '+JSON.stringify(constant));}}
      if(F.shoes){const sp=fp+'.shoes';
        if(F.shoes.length!==pairs)add('VIEWS',sp,view+' has '+pairs+' shoe(s)');
        F.shoes.forEach((s,i)=>{const p=sp+'['+i+']';region(p,s.rect,s.at,'at');field('shoes.opening',p+'.opening',s.opening);field('shoes.sole',p+'.sole',s.sole);
          if(!ref)return;legacyRect(p,s.rect,ref.rects.shoe[i]);if(!eq(s.ankle,ref.joints.ankle[i]))add('ANCHOR',p+'.ankle','ankle must be the frozen joint '+JSON.stringify(ref.joints.ankle[i]));});
        if(pairs===1&&ref&&!eq(ref.joints.ankle[0],ref.joints.ankle[1]))add('VIEWS',sp,'one profile shoe needs equal ankles');}
    }
    // Atlas file: sha256, chunks, size.
    if(root){const file=path.join(root,S.atlas);
      if(!fs.existsSync(file))add('ATLAS_FILE',base+'.atlas',S.atlas+' is missing');
      else{const buf=fs.readFileSync(file),info=pngInfo(buf);
        if(sha256(buf)!==S.sha256)add('ATLAS_FILE',base+'.sha256',S.atlas+' sha256 differs from the record');
        if(!chunksOk(info))add('ATLAS_FILE',base+'.atlas',S.atlas+' must carry only IHDR, IDAT…, IEND (got '+(info?info.chunks.join(','):'not a PNG')+')');
        else if(info.ihdr.depth!==8||info.ihdr.colour!==6||info.ihdr.interlace!==0||info.ihdr.width!==S.size[0]||info.ihdr.height!==S.size[1])add('ATLAS_FILE',base+'.size',S.atlas+' must be 8-bit RGBA, not interlaced, '+S.size.join('x'));}}
  }
  if(context){
    if(r.source.bodyFieldsSha256!==context.bodyFieldsSha256)add('ANCHOR','$.source.bodyFieldsSha256','built against another body (frozen-body.json bodyFieldsSha256 '+context.bodyFieldsSha256.slice(0,12)+'…)');
    if(r.legacy)for(const [name,ref] of Object.entries(r.source.layers||{})){const want=context.legacyBasic[ref.path];if(want!==ref.sha256)add('LEGACY','$.source.layers.'+name,ref.path+' is not the frozen legacy layer');}
    if(r.legacy&&r.source.data&&context.legacyBasic[r.source.data.path]!==r.source.data.sha256)add('LEGACY','$.source.data','not the frozen sd-foundation-ref-data.js');
  }
  return out;
}

function validate(record,opts={}){
  const out=[];structural(SCHEMA,record,'$',out);
  if(out.length)return out;  // semantic checks assume the structure
  return semantic(record,opts);
}

function validateIndex(index,{records}={}){
  const out=[],add=(p,message)=>out.push({code:'INDEX',path:p,message});
  structural(SCHEMA.$defs.index,index,'$',out);if(out.length)return out;
  const ids=Object.keys(index.records);
  if(!same(ids,[...ids].sort()))add('$.records','records must be sorted');
  for(const [id,e] of Object.entries(index.records)){
    let want;try{want=filesFor(id,e.sexes);}catch(error){add('$.records.'+id,error.message);continue;}
    if(!same(e.files,want))add('$.records.'+id+'.files','files must be '+JSON.stringify(want));
    const r=records?.[id];if(records&&!r){add('$.records.'+id,'no record registered under '+id);continue;}
    if(r)for(const key of ['slot','class','status','legacy'])if(r[key]!==e[key])add('$.records.'+id+'.'+key,'differs from the record ('+r[key]+')');
    if(r&&!same(Object.keys(r.sexes).sort(),e.sexes))add('$.records.'+id+'.sexes','differs from the record');}
  const keys=Object.keys(index.catalogue);
  if(!same(keys,[...keys].sort()))add('$.catalogue','catalogue keys must be sorted');
  for(const [key,id] of Object.entries(index.catalogue)){
    const m=/^(m|f):([a-z]+):([a-z0-9_]+)$/.exec(key);if(!m){add('$.catalogue.'+key,'key must be sex:cat:shape');continue;}
    const e=index.records[id];if(!e){add('$.catalogue.'+key,id+' is not in records');continue;}
    if(!e.sexes.includes(m[1]))add('$.catalogue.'+key,id+' has no '+m[1]+' art');
    const r=records?.[id];if(r&&r.catalog[m[1]]&&!r.catalog[m[1]].item.startsWith(m[2]+':'+m[3]+':'))add('$.catalogue.'+key,'record '+id+' sells '+r.catalog[m[1]].item);
    if(r&&r.id!==m[2]+':'+m[3])add('$.catalogue.'+key,'maps another shape ('+r.id+')');}
  for(const sex of ['m','f'])for(const slot of ['top','bottom','shoes']){
    const id=index.starter[sex][slot],item=index.starterItems[sex][slot],e=index.records[id];
    if(!e){add('$.starter.'+sex+'.'+slot,id+' is not in records');continue;}
    if(!(e.slot===slot||SLOTS[e.slot].slots.includes(slot)))add('$.starter.'+sex+'.'+slot,id+' is not a '+slot);
    if(index.catalogue[sex+':'+id]!==id)add('$.starter.'+sex+'.'+slot,id+' is not on the '+sex+' catalogue');
    if(!item.startsWith(id+':'))add('$.starterItems.'+sex+'.'+slot,item+' is not a colour of '+id);
    const r=records?.[id];if(r&&r.catalog[sex]?.item!==item)add('$.starterItems.'+sex+'.'+slot,'record '+id+' sells '+(r.catalog[sex]?.item||'nothing')+' to '+sex);}
  if(!same(index.runtimeClasses,[...RUNTIME_CLASSES].sort()))add('$.runtimeClasses','must be '+JSON.stringify([...RUNTIME_CLASSES].sort()));
  return out;
}

// The record a data file registers, read in a sandbox (no window, no runtime).
function readDataFile(file){
  const text=fs.readFileSync(file,'utf8'),box={};vm.runInNewContext(text,box,{filename:file});
  const ids=Object.keys(box.QPFoundationGarmentRecords||{});
  if(ids.length!==1)throw new Error(file+' must register exactly one record (got '+ids.length+')');
  return{record:box.QPFoundationGarmentRecords[ids[0]],text};
}
function readRecord(file){return file.endsWith('.json')?JSON.parse(fs.readFileSync(file,'utf8')):readDataFile(file).record;}
function readIndex(root=ROOT){const box={};vm.runInNewContext(fs.readFileSync(path.join(root,'assets/sd-garments-index.js'),'utf8'),box);return box.QPFoundationGarmentIndex;}
function dataFiles(root=ROOT){return fs.readdirSync(path.join(root,'assets')).map(f=>'assets/'+f).filter(f=>DATA_RE.test(f)).sort();}
const thaw=x=>JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------------------
// Negative controls: each mutation of a valid record must fail with its code.
// ---------------------------------------------------------------------------
function selfTest(root=ROOT){
  const context=loadContext(root),records=Object.fromEntries(dataFiles(root).map(f=>{const r=readDataFile(path.join(root,f)).record;return[r.id,r];}));
  const fail=[],pass=[];const expect=(label,code,issues)=>{(issues.some(i=>i.code===code)?pass:fail).push(label+' → '+code+(issues.some(i=>i.code===code)?'':' (got '+(issues.map(i=>i.code+' '+i.path).join('; ')||'nothing')+')'));};
  // File names.
  for(const id of ['top:tee','bottom:jean_skirt','bottom:star_skirt','shoes:wing_shoes','hat:cat_ears','top:tee2']){const s=stem(id);const back=idFromStem(s),f=filesFor(id);
    (back===id&&parseFile(f.m)?.id===id&&parseFile(f.m).sex==='m'&&parseFile(f.data)?.id===id&&parseFile(f.bundle)?.id===id?pass:fail).push('file name round trip '+id+' ↔ '+s);}
  for(const bad of ['top:Tee','top:tee-x','top-x:y','top:','top:tee:5'])try{stem(bad);fail.push('bad id accepted: '+bad);}catch{pass.push('bad id refused: '+bad);}
  if(parseFile('assets/sd-garments-index.js')!==null)fail.push('index file parsed as a garment file');else pass.push('index file is not a garment file');
  const top=records['top:tee'],bottom=records['bottom:shorts'],shoes=records['shoes:sneaker'];
  if(!top||!bottom||!shoes){fail.push('the three legacy records are missing (run tools/garment/pack-basic.py)');return{pass,fail};}
  for(const r of [top,bottom,shoes]){const issues=validate(r,{context,root});(issues.length?fail:pass).push('valid '+r.id+(issues.length?': '+issues.map(i=>i.code+' '+i.path+' '+i.message).join('; '):''));}
  const opts={context,root},mut=(r,fn)=>{const c=thaw(r);fn(c);return c;};
  expect('reserved class in the builder','CLASS_RESERVED',validate(mut(top,r=>{r.class='top/long-sleeve';r.legacy=false;}),{...opts,builder:true}));
  expect('reserved class on a legacy record','CLASS_RESERVED',validate(mut(top,r=>{r.class='top/sleeveless';}),opts));
  {const issues=validate(top,{...opts,builder:true});(issues.length?fail:pass).push('builder accepts top/short-sleeve'+(issues.length?' (got '+issues.map(i=>i.code).join(',')+')':''));}
  expect('unknown class','SCHEMA',validate(mut(top,r=>{r.class='top/poncho';}),opts));
  expect('slot of another category','ID',validate(mut(top,r=>{r.slot='bottom';r.slots=['bottom'];}),opts));
  expect('id differs from cat:shape','ID',validate(mut(top,r=>{r.id='top:shirt';}),opts));
  expect('missing profile view','SCHEMA',validate(mut(top,r=>{delete r.sexes.m.figures.right;}),opts));
  expect('unknown property','SCHEMA',validate(mut(top,r=>{r.sexes.f.figures.front.top.torso.offset=[0,0];}),opts));
  expect('reserved field filled','SCHEMA',validate(mut(top,r=>{r.sexes.f.figures.front.shin=[1];}),opts));
  expect('cuff off by 1e-9','CUFF',validate(mut(top,r=>{r.sexes.m.figures.front.top.sleeves[0].cuff+=1e-9;}),opts));
  expect('legacy box changed','BOX',validate(mut(top,r=>{r.sexes.f.figures.back.top.sleeves[1].box=[-4,-4,8,9];}),opts));
  expect('raised art on a legacy record','LEGACY',validate(mut(top,r=>{r.sexes.m.figures.front.top.sleeves[0].raisedAt=[0,0];}),opts));
  expect('legacy record lists too little','LEGACY',validate(mut(top,r=>{r.legacyComputed=r.legacyComputed.slice(1);}),opts));
  expect('pipeline record without underarm','LEGACY',validate(mut(top,r=>{r.legacy=false;r.legacyComputed=[];r.source.kind='chatgpt-sheet';}),opts));
  expect('profile with two sleeves','VIEWS',validate(mut(top,r=>{const s=r.sexes.m.figures.right.top.sleeves;s.push(thaw(s[0]));}),opts));
  expect('top record carrying shorts','VIEWS',validate(mut(top,r=>{r.sexes.m.figures.front.bottom=thaw(bottom.sexes.m.figures.front.bottom);}),opts));
  expect('regions overlap in the atlas','ATLAS',validate(mut(top,r=>{const T=r.sexes.m.figures.front.top;T.sleeves[0].at=[...T.torso.at];}),opts));
  expect('region leaves the atlas','ATLAS',validate(mut(shoes,r=>{r.sexes.f.figures.back.shoes[1].at=[r.sexes.f.size[0]-2,0];}),opts));
  expect('rect leaves the sex rows','SHEET',validate(mut(shoes,r=>{r.sexes.m.figures.front.shoes[0].rect[1]=540;}),opts));
  expect('legacy rect moved','LEGACY_RECT',validate(mut(bottom,r=>{r.sexes.f.figures.front.bottom.rect[0]+=1;}),opts));
  expect('shoulder anchor moved','ANCHOR',validate(mut(top,r=>{r.sexes.f.figures.right.top.sleeves[0].shoulder[0]+=.5;}),opts));
  expect('ankle anchor moved','ANCHOR',validate(mut(shoes,r=>{r.sexes.m.figures.back.shoes[0].ankle[1]-=1;}),opts));
  expect('seat cut +1 (m-front)','SEAT',validate(mut(bottom,r=>{r.sexes.m.figures.front.bottom.seat.cut+=1;}),opts));
  expect('side seat cuff −.5 (f-right)','SEAT',validate(mut(bottom,r=>{r.sexes.f.figures.right.bottom.sideSeat.cuff-=.5;}),opts));
  expect('seat in the profile','VIEWS',validate(mut(bottom,r=>{r.sexes.m.figures.right.bottom.seat=thaw(r.sexes.m.figures.front.bottom.seat);}),opts));
  expect('catalogue item of another shape','CATALOG',validate(mut(top,r=>{r.catalog.m.item='top:shirt:5';}),opts));
  expect('catalogue colour not #rrggbb','SCHEMA',validate(mut(top,r=>{r.catalog.f.colour='green';}),opts));
  expect('catalogue for a missing sex','SEXES',validate(mut(shoes,r=>{delete r.sexes.f;}),opts));
  expect('atlas file name','FILES',validate(mut(top,r=>{r.sexes.m.atlas='assets/sd-garment-top-tea-m.png';}),opts));
  expect('atlas sha256','ATLAS_FILE',validate(mut(top,r=>{r.sexes.f.sha256='0'.repeat(64);}),opts));
  expect('another body','ANCHOR',validate(mut(top,r=>{r.source.bodyFieldsSha256='1'.repeat(64);}),opts));
  expect('legacy layer sha','LEGACY',validate(mut(top,r=>{r.source.layers.shirt.sha256='2'.repeat(64);}),opts));
  // Index.
  let index=null;try{index=readIndex(root);}catch(error){fail.push('index unreadable: '+error.message);}
  if(index){
    const issues=validateIndex(index,{records});(issues.length?fail:pass).push('valid index'+(issues.length?': '+issues.map(i=>i.path+' '+i.message).join('; '):''));
    const bad=fn=>{const c=thaw(index);fn(c);return validateIndex(c,{records});};
    expect('catalogue → missing record','INDEX',bad(i=>{i.catalogue['m:top:hood']='top:hood';const k=Object.keys(i.catalogue).sort();i.catalogue=Object.fromEntries(k.map(x=>[x,i.catalogue[x]]));}));
    expect('catalogue maps another shape','INDEX',bad(i=>{i.catalogue['f:top:tee']='bottom:shorts';}));
    expect('starter of the wrong slot','SCHEMA',bad(i=>{i.starter.f.top='bottom:shorts';}));
    expect('starter not in records','INDEX',bad(i=>{i.starter.f.top='top:shirt';}));
    expect('starter item not sold to that sex','INDEX',bad(i=>{i.starterItems.m.bottom='bottom:shorts:5';}));
    expect('runtime classes changed','INDEX',bad(i=>{i.runtimeClasses.push('top/long-sleeve');}));
    expect('files of another encoding','SCHEMA',bad(i=>{i.records['top:tee'].files.m='assets/sd-garment-top_tee-m.png';}));
    expect('files of another record','INDEX',bad(i=>{i.records['top:tee'].files.m='assets/sd-garment-top-teee-m.png';}));
  }
  return{pass,fail};
}

module.exports={SCHEMA,RUNTIME_CLASSES,RESERVED_CLASSES,ID_RE,ATLAS_RE,DATA_RE,BUNDLE_RE,stem,idFromStem,filesFor,parseFile,
  validate,validateIndex,structural:(node,value)=>{const o=[];structural(node,value,'$',o);return o;},loadContext,pngInfo,chunksOk,readDataFile,readRecord,readIndex,dataFiles,sha256,legacyFieldsFor};

if(require.main===module){
  const argv=process.argv.slice(2),root=ROOT;
  if(argv.includes('--self-test')){
    const {pass,fail}=selfTest(root);for(const p of pass)console.log('  ok   '+p);for(const f of fail)console.log('  FAIL '+f);
    console.log('schema self-test: '+pass.length+' passed, '+fail.length+' failed');process.exit(fail.length?1:0);}
  const builder=argv.includes('--builder'),files=argv.filter(a=>!a.startsWith('--'));
  const context=loadContext(root),targets=files.length?files.map(f=>path.resolve(f)):dataFiles(root).map(f=>path.join(root,f));
  let bad=0;const records={};
  for(const file of targets){const r=readRecord(file),issues=validate(r,{context,root,builder});records[r.id]=r;
    console.log((issues.length?'FAIL ':'ok   ')+path.relative(root,file)+' ('+r.id+', '+r.class+(r.legacy?', legacy':'')+')');for(const i of issues)console.log('       '+i.code+' '+i.path+': '+i.message);bad+=issues.length;}
  if(!files.length){const issues=validateIndex(readIndex(root),{records});console.log((issues.length?'FAIL ':'ok   ')+'assets/sd-garments-index.js');for(const i of issues)console.log('       '+i.code+' '+i.path+': '+i.message);bad+=issues.length;}
  process.exit(bad?1:0);
}
