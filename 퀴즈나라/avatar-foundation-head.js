/* Heads of the reference body from the converted hair layers (stage 3, H3):
   window.QPFoundationHead. The 24 head paintings x front/profile/back come as
   one atlas per style (assets/sd-hair-<sex>-<shape>.webp) and their placement
   (assets/sd-hair-data.js, tools/hair/build-heads.py build). Inert unless the
   demo asks for the reference body (?avatar=foundation or the studio session);
   on every other page it requests nothing and students keep today's heads.

   A view is its layers, which partition the painting and are drawn
   additively (mix-blend-mode: plus-lighter in an isolated group):
     hair   brush luminance in R and B, its shine in G: dyed by one colour
            matrix, dye x L / 102 + shine (avatar-pixel.js tonal)
     skin   the body sheet's skin paint: tinted by the body's own matrix
            (QPFoundationSkin.toneMatrix), so face and neck match at every tone
     fixed  eyes, mouth, ink: as painted
     iris   recoloured for the sparkle and cat expressions only
   and blink covers (skin paint) over the open eyes, with today's expression
   stencils and closed-eye strokes (avatar-pixel.js expressionStencil,
   closedEye; avatar-direction.js headMarkup). Ids in the markup carry the
   template's id placeholder (qpf-template); avatar-foundation.js defines the
   filters (defs()) and slots the ids. */
(function(root){
  'use strict';
  const base=new URL('.',document.currentScript.src),params=new URLSearchParams(location.search);
  const DATA='assets/sd-hair-data.js',ID='qpf-template',INK='#493638',WHITE='#fff8f0';
  // Profile faces moved onto the reference style's (H2 registration: f braid 1.9 down, long/pony 1 back…).
  // Off until the user decides (2026-10-17): moved faces left the nape hair short of the body's neck; each
  // painting stays where today's renderer puts it (neck on the body's neck, avatar-direction.js necks[]).
  const PROFILE_REGISTRATION=false;
  const atlas={ready:false,error:null};let loading=null;
  const data=()=>root.QPHairData||null;
  const r=v=>Math.round(v*1e4)/1e4;
  function script(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=()=>{s.remove();resolve();};s.onerror=()=>{s.remove();reject(new Error('머리 자료를 불러오지 못했어요: '+url));};document.head.appendChild(s);});}
  function image(url){return new Promise(resolve=>{const im=new Image();im.onload=im.onerror=()=>resolve(im);im.src=url;});}
  // The data, then every atlas decoded once, so a head never pops in after its avatar shows.
  function load(){
    return loading||(loading=(data()?Promise.resolve():script(new URL(DATA,base).href))
      .then(()=>Promise.all(Object.values(data().styles).map(e=>image(new URL(e.file,base).href))))
      .then(()=>{atlas.ready=true;return atlas;})
      .catch(e=>{atlas.error=e.message;console.error(e);return atlas;}));
  }
  function styleOf(sex,hair){
    const D=data();if(!D)return null;const shape=String(hair||'').split(':')[0];
    return D.styles[sex+':'+shape]||D.styles[sex+':'+(D.aliases[sex]?.[shape]||'')]||D.styles[sex+':short'];
  }
  function colour(cat,value,sex){
    // PAL is the page's top-level const (index.html), not a window property.
    const PALS=typeof PAL!=='undefined'?PAL:root.PAL,P=PALS?.[cat],[shape,i]=String(value||'').split(':'),c=(P?.[+i]||P?.[0]||[cat==='skin'?'#ffe2cc':'#5a3a24'])[0];
    return cat==='hair'?(root.QPClothes?.colorFor?.('hair',shape,sex,c)||c):c;
  }
  // One layer: the style's atlas placed so the layer's rectangle lands on its head-unit rectangle and
  // clipped to it with a CSS inset (no nested <svg>: page styles size every svg inside an avatar holder).
  // dx, dy undo the profile registration (avatar-foundation.js moves the whole view when it is on).
  function piece(e,v,name,dx=0,dy=0){
    // A layer a style lacks still takes its node (node counts stay the same for every head).
    const l=v.layers[name];if(!l)return '<image width="0" height="0"/>';const [ax,ay,w,h,ux,uy,uw,uh]=l,[W,Hh]=e.size,kx=uw/w,ky=uh/h,pc=v=>r(v*100)+'%';
    return `<image href="${e.file}" x="${r(ux-dx-ax*kx)}" y="${r(uy-dy-ay*ky)}" width="${r(W*kx)}" height="${r(Hh*ky)}" preserveAspectRatio="none" style="clip-path:inset(${pc(ay/Hh)} ${pc(1-(ax+w)/W)} ${pc(1-(ay+h)/Hh)} ${pc(ax/W)})"/>`;
  }
  function painting(e,v,dx,dy,iris){
    const add=' style="mix-blend-mode:plus-lighter"';
    return `<g data-foundation-hair-layers="${e.sex}:${e.shape}" style="isolation:isolate">`+
      `<g filter="url(#${ID}-hair-dye)">${piece(e,v,'hair',dx,dy)}</g>`+
      `<g filter="url(#${ID}-head-tone)"${add}>${piece(e,v,'skin',dx,dy)}</g>`+
      `<g${add}>${piece(e,v,'fixed',dx,dy)}</g>`+
      `<g${iris?` filter="url(#${ID}-iris)"`:''}${add}>${piece(e,v,'iris',dx,dy)}</g></g>`;
  }
  const tone=(e,v,name,dx,dy)=>`<g filter="url(#${ID}-head-tone)">${piece(e,v,name,dx,dy)}</g>`;
  // avatar-pixel.js expressionStencil(): its skin patch is the face's own paint through the same tone filter.
  function stencil(expr,[left,right,cy],face){
    const cx=(left+right)/2,my=Math.min(26.3,cy+4.2),patch=`<ellipse cx="${r(cx)}" cy="${r(my)}" rx="2.25" ry="1.4" fill="${face}" filter="url(#${ID}-head-tone)"/>`;let s='';
    if(expr==='happy')s+=patch+`<path d="M${r(cx-1.8)} ${r(my-.5)}Q${r(cx)} ${r(my-.1)} ${r(cx+1.8)} ${r(my-.5)}Q${r(cx+1.6)} ${r(my+1.55)} ${r(cx)} ${r(my+1.5)}Q${r(cx-1.6)} ${r(my+1.55)} ${r(cx-1.8)} ${r(my-.5)}Z" fill="#ac6271" stroke="#774454" stroke-width=".18"/><path d="M${r(cx-1.5)} ${r(my-.4)}Q${r(cx)} ${r(my)} ${r(cx+1.5)} ${r(my-.4)}" fill="none" stroke="${WHITE}" stroke-width=".38"/>`;
    if(expr==='soft')s+=patch+`<path d="M${r(cx-1.35)} ${r(my)}Q${r(cx)} ${r(my+.9)} ${r(cx+1.35)} ${r(my)}" fill="none" stroke="#b97580" stroke-width=".22" stroke-linecap="round"/>`;
    if(expr==='wink')s+=patch+`<path d="M${r(cx-1.1)} ${r(my+.2)}Q${r(cx+.3)} ${r(my+.8)} ${r(cx+1.4)} ${r(my-.5)}" fill="none" stroke="#a35d71" stroke-width=".22" stroke-linecap="round"/>`;
    if(expr==='chic')s+=`<path d="M${r(left-1.5)} ${r(cy-3.5)}Q${r(left)} ${r(cy-3.1)} ${r(left+1.7)} ${r(cy-3.25)}M${r(right-1.7)} ${r(cy-3.25)}Q${r(right)} ${r(cy-3.1)} ${r(right+1.5)} ${r(cy-3.5)}" fill="none" stroke="${INK}" stroke-width=".22"/>`+patch+`<path d="M${r(cx-1.1)} ${r(my+.35)}Q${r(cx)} ${r(my+.1)} ${r(cx+1.1)} ${r(my+.35)}" fill="none" stroke="#a35d71" stroke-width=".2"/>`;
    if(expr==='cat')s+=patch+`<path d="M${r(cx-1.4)} ${r(my)}Q${r(cx-.6)} ${r(my+1)} ${r(cx)} ${r(my)}Q${r(cx+.6)} ${r(my+1)} ${r(cx+1.4)} ${r(my)}" fill="none" stroke="#aa6475" stroke-width=".22" stroke-linecap="round"/>`;
    if(expr==='freckle')for(const [x,y] of [[left-1,cy+3],[left+.4,cy+3.4],[left+1.5,cy+2.8],[right-1.3,cy+2.8],[right,cy+3.4],[right+1.4,cy+3]])s+=`<circle cx="${r(x)}" cy="${r(y)}" r=".16" fill="#af765b"/>`;
    return s;
  }
  // avatar-pixel.js closedEye()/halfEye() strokes over this eye's blink cover.
  function eyeStroke(cx,cy,w,part,smile){
    return part==='half'?`<path d="M${r(cx-w)} ${r(cy+.2)}Q${r(cx)} ${r(cy+1)} ${r(cx+w)} ${r(cy+.2)}" fill="none" stroke="${INK}" stroke-width=".27" stroke-linecap="round"/>`
      :`<path d="M${r(cx-w)} ${r(cy+.6)}Q${r(cx)} ${r(cy+(smile?-1.3:1.9))} ${r(cx+w)} ${r(cy+.6)}M${r(cx-w)} ${r(cy+.6)}l-.5-.5M${r(cx+w)} ${r(cy+.6)}l.5-.5" fill="none" stroke="${INK}" stroke-width=".29" stroke-linecap="round"/>`;
  }
  // The head of one avatar in the three views (markup strings) and what its template must define.
  function views(av){
    const sex=av.sex==='m'?'m':'f',e=styleOf(sex,av.hair);if(!e)return null;
    const hair=colour('hair',av.hair||'short:1',sex),skin=colour('skin','x:'+(av.sk||0)),expr=String(av.expression||'bright:0').split(':')[0];
    const iris=expr==='sparkle'?'#73b9d4':expr==='cat'?'#e2b654':null,F=e.views.front,P=e.views.profile,B=e.views.back;
    const eyes=[F.eyes[0][0],F.eyes[1][0],(F.eyes[0][1]+F.eyes[1][1])/2],w=Math.max(1.75,(eyes[1]-eyes[0])*.33);
    const blink=(part,side,x)=>tone(e,F,'blink-'+side+(part==='half'?'half':'full'))+eyeStroke(x,eyes[2],w,part,part==='closed'&&expr==='happy');
    const attrs=`data-qpx-head="${encodeURIComponent(JSON.stringify(av))}" data-qpx-head-sex="${sex}" data-qpx-head-skin="${skin}"`;
    const front=`<g class="qpx-head" ${attrs}><g class="qpx-hair" data-qpx-hair-color="${hair}" ${attrs}>`+
      `<g clip-path="url(#${ID}-head-front)">${painting(e,F,0,0,iris)}</g>`+stencil(expr,eyes,F.faceTone||'#fcd5c0')+
      (expr==='wink'?blink('closed','right',eyes[1]):'')+
      `<g class="qpx-blink-half">${blink('half','left',eyes[0])}${expr==='wink'?'':blink('half','right',eyes[1])}</g>`+
      `<g class="qpx-blink-closed">${blink('closed','left',eyes[0])}${expr==='wink'?'':blink('closed','right',eyes[1])}</g></g></g>`;
    const backHair=`<g class="qpx-back-hair" clip-path="url(#${ID}-hair-behind)">${painting(e,F,0,0,null)}</g>`;
    const [dx,dy]=P.registration,[ex,ey]=P.landmarks.eye,pw=Math.max(1.1,P.eyeWidth);
    const profile=painting(e,P,dx,dy,iris)+`<g class="qpx-blink-closed">${tone(e,P,'blink',dx,dy)}<path d="M${r(ex-dx-pw)} ${r(ey-dy+.45)}Q${r(ex-dx)} ${r(ey-dy+1.5)} ${r(ex-dx+pw)} ${r(ey-dy+.45)}" fill="none" stroke="${INK}" stroke-width=".28" stroke-linecap="round"/></g>`;
    const back=painting(e,B,0,0,null);
    return{key:JSON.stringify(['layers',sex,e.shape,hair,skin,expr]),layered:true,skin,hair,iris,style:e.sex+':'+e.shape,registration:{profile:PROFILE_REGISTRATION?[dx,dy]:[0,0]},
      headClip:`<clipPath id="${ID}-head-front" clipPathUnits="userSpaceOnUse"><rect x="-1" y="-8" width="34" height="36.45"/></clipPath>`,front,backHair,profile,back};
  }
  // The filters a layered head refers to (template defs): the dye, the body's skin matrix and the iris colour.
  function defs(heads,doc=document){
    const NS='http://www.w3.org/2000/svg',el=(t,a)=>{const n=doc.createElementNS(NS,t);for(const[k,v]of Object.entries(a))n.setAttribute(k,v);return n;};
    const filter=(id,matrix)=>{const f=el('filter',{id,'color-interpolation-filters':'sRGB',x:'0',y:'0',width:'1',height:'1'});f.append(el('feColorMatrix',{type:'matrix',values:matrix}));return f;};
    const rgb=h=>h.slice(1).match(/../g).map(x=>parseInt(x,16));
    const [hr,hg,hb]=rgb(heads.hair).map(c=>r(c/102));
    const out=[filter(ID+'-hair-dye',`${hr} 1 0 0 0 ${hg} 1 0 0 0 ${hb} 1 0 0 0 0 0 0 1 0`),
      filter(ID+'-head-tone',root.QPFoundationSkin?.toneMatrix?root.QPFoundationSkin.toneMatrix(heads.skin):'1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0')];
    if(heads.iris){const [ir,ig,ib]=rgb(heads.iris).map(c=>c/120),row=c=>[.24*c,.61*c,.15*c].map(r).join(' ');out.push(filter(ID+'-iris',`${row(ir)} 0 0 ${row(ig)} 0 0 ${row(ib)} 0 0 0 0 0 1 0`));}
    return out;
  }
  const demo=()=>Boolean(root.QPDemo);
  root.QPFoundationHead=Object.freeze({atlas,load,views,defs,styleOf,data});
  function autoLoad(){if(demo()&&(params.get('avatar')==='foundation'||params.get('session')==='foundation-studio'))load();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',autoLoad,{once:true});else autoLoad();
})(window);
