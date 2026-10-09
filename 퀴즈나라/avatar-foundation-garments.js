/* Garment records of the reference body (stage 3): the registry and its lazy
   loader (window.QPFoundationGarments). Inert unless the demo (window.QPDemo)
   asks for the reference body: ?avatar=foundation or the studio session
   (session=foundation-studio). On every other page it requests nothing.
   Records are keyed 'cat:shape' (assets/sd-garment-<cat>-<shape>.js, generated;
   tools/garment/schema.json). The index (assets/sd-garments-index.js) maps a
   shop item (sex, cat, shape) to a record; each record's atlas is one cropped
   PNG per sex, loaded only for the sex that wears it, through QPAvatarImage
   (file:// safe). A worn item without a record shows the basic outfit's piece
   for that slot, with the reason in data-foundation-fallback:
     todo       not converted yet
     class      a class this runtime does not draw (long sleeves, skirts…)
     outfit     a one-piece outfit (not converted; its empty bottom too)
     error      the record or its atlas failed to load
     candidate  a candidate record outside the studio */
(function(root){
  'use strict';
  const base=new URL('.',document.currentScript.src),params=new URLSearchParams(location.search);
  const SLOTS=Object.freeze(['top','bottom','shoes']),INDEX='assets/sd-garments-index.js';
  // The basic outfit before the index arrives (tools/garment/build-index.cjs starter).
  const BASIC=Object.freeze({top:'top:tee',bottom:'bottom:shorts',shoes:'shoes:sneaker'});
  const BASIC_CLASS=Object.freeze({top:'top/short-sleeve',bottom:'bottom/shorts',shoes:'shoes/low'});
  const RUNTIME=Object.freeze(['top/short-sleeve','bottom/shorts','shoes/low']);
  const ID=/^[a-z]+:[a-z0-9_]+$/;
  const demo=()=>Boolean(root.QPDemo),studio=()=>demo()&&params.get('session')==='foundation-studio';
  const warn=(...a)=>{if(demo())console.warn('[기준 옷]',...a);};
  const extra=Object.create(null),extraCatalogue=Object.create(null),states=new Map(),scripts=new Map(),holds=new Set();
  let indexPromise=null;
  const index=()=>root.QPFoundationGarmentIndex||null;
  const runtimeClass=c=>(index()?.runtimeClasses||RUNTIME).includes(c);
  function script(url){
    if(scripts.has(url))return scripts.get(url);
    const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>{s.remove();resolve();};s.onerror=()=>{s.remove();scripts.delete(url);reject(new Error('옷 자료를 불러오지 못했어요: '+url));};document.head.appendChild(s);});
    scripts.set(url,p);return p;
  }
  function loadIndex(){
    if(index())return Promise.resolve(index());
    if(!demo())return Promise.reject(new Error('기준 옷은 체험 주소에서만 불러옵니다.'));
    return indexPromise||(indexPromise=script(new URL(INDEX,base).href).then(()=>{if(!index())throw new Error('옷 목록이 비어 있어요: '+INDEX);return index();}).catch(e=>{indexPromise=null;throw e;}));
  }
  const recordOf=id=>extra[id]?.record||root.QPFoundationGarmentRecords?.[id]||null;
  function entryOf(id){
    const x=extra[id]?.record;if(x)return{slot:x.slot,class:x.class,status:x.status,legacy:x.legacy,sexes:Object.keys(x.sexes),files:null};
    return index()?.records[id]||null;
  }
  function loadRecord(id){
    if(recordOf(id))return Promise.resolve(recordOf(id));
    return loadIndex().then(I=>{const e=I.records[id];if(!e)throw new Error('옷 기록이 없어요: '+id);return script(new URL(e.files.data,base).href);})
      .then(()=>{const r=recordOf(id);if(!r)throw new Error('옷 자료가 등록되지 않았어요: '+id);return r;});
  }
  // The limb/neck art a top was fitted against: the packed basic keeps the
  // legacy layers; pipeline records use the rule-cleaned arms and neck.
  const bodyArtOf=record=>record?.slot==='top'?(record.bodyArt||(record.legacy?'legacy':'clean')):'legacy';
  // One (record, sex): the data file, then that sex's atlas (and clean body art).
  function loadOne(id,sex){
    const k=id+'|'+sex;let s=states.get(k);if(s)return s.promise;
    s={id,sex,status:'loading',garment:null,error:null};states.set(k,s);
    s.promise=loadRecord(id).then(record=>{
      const entry=record.sexes?.[sex];if(!entry)throw new Error(id+': '+sex+' 그림이 없어요');
      if(!runtimeClass(record.class))throw new Error(id+': 이 종류('+record.class+')는 아직 그리지 않아요');
      const image=extra[id]?extra[id].images[sex]:QPAvatarImage.load(new URL(entry.atlas,base).href);
      const art=bodyArtOf(record)==='clean'?Promise.resolve(root.QPFoundationSkin?.loadClean?.()).then(c=>{if(!c?.ready)throw new Error('정리한 팔·목 그림을 불러오지 못했어요'+(c?.error?': '+c.error:''));}):null;
      return Promise.all([image,art]).then(([img])=>{
        if(!img)throw new Error(id+': '+sex+' 그림이 비어 있어요');
        s.garment=Object.freeze({id,sex,record,legacy:Boolean(record.legacy),bodyArt:bodyArtOf(record),figures:entry.figures,image:img});s.status='ready';
      });
    }).catch(error=>{s.status='error';s.error=error?.message||String(error);warn(id,sex,s.error);});
    return s.promise;
  }
  const stateOf=(id,sex)=>states.get(id+'|'+sex);
  const held=id=>{for(const h of holds)if(!h.ids||h.ids.has(id))return true;return false;};
  function afterHolds(id){const hs=[...holds].filter(h=>!h.ids||h.ids.has(id));return hs.length?Promise.all(hs.map(h=>h.promise)).then(()=>afterHolds(id)):Promise.resolve();}
  // Test hold: renders of these ids (all, without ids) stay pending until
  // release() (verifiers; QPFoundationOutfit.atlas.ready=false is one).
  function hold(ids){const h={ids:ids==null?null:new Set([].concat(ids))};h.promise=new Promise(r=>{h.release=()=>{if(holds.delete(h))r();};});holds.add(h);return h.release;}
  const starter=sex=>{const s=index()?.starter?.[sex==='m'?'m':'f'];return SLOTS.map(slot=>s?.[slot]||BASIC[slot]);};
  // ids: an id list worn by `sex`, or 'starter' (both sexes' basic outfits).
  function pairs(ids,sex){
    if(ids==='starter')return[...starter('m').map(id=>[id,'m']),...starter('f').map(id=>[id,'f'])];
    const list=[].concat(ids||[]).filter(Boolean).map(id=>[id,sex==='m'?'m':'f']);
    // An item may still fail: its slot's basic piece is loaded alongside.
    for(const id of starter(sex))if(!list.some(p=>p[0]===id))list.push([id,sex==='m'?'m':'f']);
    return list;
  }
  const isReady=(id,sex)=>stateOf(id,sex)?.status==='ready'&&!held(id);
  const isSettled=(id,sex)=>{const s=stateOf(id,sex);return Boolean(s)&&s.status!=='loading'&&!held(id);};
  function ensure(ids,sex){const list=pairs(ids,sex);return Promise.all(list.map(([id,s])=>loadOne(id,s).then(()=>afterHolds(id)))).then(()=>status());}
  // Every id loaded (and not held). For a worn set, the basic pieces too.
  const ready=(ids,sex)=>(ids==='starter'?pairs(ids):[].concat(ids||[]).map(id=>[id,sex==='m'?'m':'f'])).every(([id,s])=>isReady(id,s));
  const settled=(ids,sex)=>pairs(ids,sex).every(([id,s])=>isSettled(id,s));
  const get=(id,sex)=>isReady(id,sex)?stateOf(id,sex).garment:null;
  const key=set=>(Array.isArray(set)?set:SLOTS.map(slot=>set?.[slot])).join('|');
  const idsOf=attr=>String(attr||'').split('|').filter(Boolean);
  // What one svg can wear now: undefined while any piece is still loading
  // (or held), null when a slot has neither its item nor the basic piece,
  // else {top,bottom,shoes} garments (a failed item replaced by the basic
  // piece, listed in `failed`).
  function wearable(ids,sex){
    sex=sex==='m'?'m':'f';if(!settled(ids,sex))return undefined;
    const basic=starter(sex),out={failed:{}};
    for(const [i,slot] of SLOTS.entries()){let g=get(ids[i],sex);if(!g){g=get(basic[i],sex);if(!g)return null;out.failed[slot]='error';}out[slot]=g;}
    out.ids=SLOTS.map(slot=>out[slot].id);out.key=out.ids.join('|');return out;
  }
  function lookup(sex,cat,shape){const k=sex+':'+cat+':'+shape;return extraCatalogue[k]||index()?.catalogue?.[k]||null;}
  // The garments one (avatarForSex-normalised) avatar wears, per slot, with
  // the reason when a slot falls back to the basic piece. An avatar without
  // garment fields (the studio's reference character) wears the basic outfit.
  // av.foundationGarments {top,bottom,shoes} names records directly (studio, verifiers).
  function resolve(av={}){
    const sex=av.sex==='m'?'m':'f',basic=starter(sex),set=[],fallback={},explicit=av.foundationGarments||null,whole=String(av.outfit||'').split(':')[0];
    for(const [i,slot] of SLOTS.entries()){
      let id=null,reason='';
      if(explicit&&explicit[slot]){id=explicit[slot];if(!ID.test(id))reason='todo';}
      else if(whole&&slot!=='shoes'){const one=lookup(sex,'outfit',whole);reason=one&&!runtimeClass(entryOf(one)?.class)?'class':'outfit';}
      else{const shape=String(av[slot]||'').split(':')[0];if(shape){id=lookup(sex,slot,shape);if(!id)reason='todo';}}
      if(id&&!reason){
        const e=entryOf(id);
        if(!e&&index())reason='todo';
        else if(e&&e.slot!==slot)reason='todo';
        else if(e&&!runtimeClass(e.class))reason='class';
        else if(e&&e.status==='candidate'&&!studio())reason='candidate';
        else if(e&&!e.sexes.includes(sex))reason='todo';
        else if(stateOf(id,sex)?.status==='error')reason='error';
      }
      if(reason)fallback[slot]=reason;
      set.push(reason||!id?basic[i]:id);
    }
    const cls=set.map((id,i)=>String(entryOf(id)?.class||BASIC_CLASS[SLOTS[i]]).split('/')[1]).join('|');
    return{sex,ids:set,key:key(set),fallback,fallbackKey:SLOTS.filter(s=>fallback[s]).map(s=>s+':'+fallback[s]).join('|'),cls};
  }
  // Data files hand their record here; a class this runtime does not draw is refused (warned).
  function define(record){if(record&&!runtimeClass(record.class))warn(record.id+': '+record.class+' is not a runtime class; the basic piece is shown (fallback class)');}
  // Test-only (the studio session in the demo): an in-page record with its
  // atlas images {m,f} (Image, canvas, or a URL). A new id each time; with
  // {catalogue:true} its (sex, cat, shape) items resolve to it.
  function register(record,images,options={}){
    if(!studio())return Promise.reject(new Error('register() is test-only: ?demo=1&session=foundation-studio'));
    if(!record||!ID.test(record.id)||!SLOTS.includes(record.slot)||!record.sexes)return Promise.reject(new Error('register(): not a garment record'));
    if(recordOf(record.id)||index()?.records[record.id])return Promise.reject(new Error('register(): '+record.id+' already exists; use a new id'));
    const freeze=o=>{if(o&&typeof o==='object'&&!Object.isFrozen(o)){Object.freeze(o);for(const v of Object.values(o))freeze(v);}return o;};
    const r=freeze(JSON.parse(JSON.stringify(record))),sexes=Object.keys(r.sexes);
    for(const sex of ['m','f'])states.delete(r.id+'|'+sex);// a lookup that failed before the record existed
    extra[r.id]={record:r,images:Object.fromEntries(sexes.map(sex=>[sex,Promise.resolve(images?.[sex]).then(v=>typeof v==='string'?QPAvatarImage.load(v):v)]))};
    if(options.catalogue)for(const sex of sexes)extraCatalogue[sex+':'+r.cat+':'+r.shape]=r.id;
    return Promise.all(sexes.map(sex=>loadOne(r.id,sex))).then(()=>Object.fromEntries(sexes.map(sex=>[sex,stateOf(r.id,sex).status])));
  }
  function loadStarter(){return Promise.all([root.QPFoundationSkin?.load(),ensure('starter')]);}
  function status(){const out={};for(const s of states.values())out[s.id+'|'+s.sex]=s.status+(s.error?': '+s.error:'')+(held(s.id)?' (held)':'');return out;}
  const error=()=>{for(const [id,s] of pairs('starter')){const st=stateOf(id,s);if(st?.status==='error')return st.error;}return null;};
  root.QPFoundationGarments=Object.freeze({SLOTS,define,resolve,ensure,ready,settled,get,wearable,key,idsOf,starter,hold,register,loadStarter,status,error,demo,studio});
  // The page-level auto-load, as the outfit did: the demo with
  // ?avatar=foundation or the studio session (QPDemo exists once demo.js ran).
  function autoLoad(){if(demo()&&(params.get('avatar')==='foundation'||params.get('session')==='foundation-studio'))loadStarter();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoLoad,{once:true});else autoLoad();
})(window);
