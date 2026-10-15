'use strict';
// H1 (stage 3, Lane C): the head frame, measured from the live foundation
// runtime (index.html?demo=1&avatar=foundation, headless, Firebase blocked).
// Read-only: it renders the reference avatars (m short:1, f bob:1, basic
// outfit) and writes tools/fixtures/head-frame.json, which the hair
// conversion (H2, tools/hair/build-heads.py: neck cut, front split, profile
// hair-back, back collar rule) and the hair checks (H4) read.
//
// Usage (from 퀴즈나라/):
//   node tools/hair/measure-head-frame.cjs           measure, write tools/fixtures/head-frame.json and the
//                                                    overlay images, print the bob FRONT_HAIR_CLIP margins
//   node tools/hair/measure-head-frame.cjs --check   measure again; exit 1 unless the JSON is byte-identical
//                                                    to tools/fixtures/head-frame.json and the bob check
//                                                    passes (BOB below)
//   --out <file>     write elsewhere (needed with --av or a subset)
//   --av '<json>'    extra avatar fields for both sexes, e.g. '{"top":"shirt:10"}' (a shop item, shape:colour)
//                    or '{"foundationGarments":{"top":"<record id>"}}': the same measurement on another
//                    top (its per-pose front outlines, pose by pose against these). Exit 1 when any
//                    slot falls back to the basic piece (todo/class/outfit/error/candidate) or a named
//                    record is not the one worn.
//   --images <dir>   overlay images (default 검증/머리틀/, not committed); --no-images skips them
//   --raw <file>     also keep the unrounded measurement (every view and kind per pose: body, collar,
//                    arms, neck); --from-raw <file> derives the JSON and images from one, without measuring
//   --sexes m,f --views front,right,back   a subset (scratch runs)
// Environment: QUIZ_BROWSER_EXECUTABLE (tools/verify-harness.cjs); one software raster thread
// (H.RASTER_ARGS), so a rerun on the same binary is byte-identical. About 16-18 minutes
// (4-CPU container shared with other jobs), plus a few seconds for the images.
//
// UNITS. 'Head-native' is the head painting's own frame: the 32x40 image of
// an sd-heads tile, i.e. the user space of the paintings' clip paths
// (FRONT_HAIR_CLIP, BACK_HAIR_CLIP, HEAD_NECK_CUT in avatar-foundation.js),
// y down. In the front view it is the frame BEFORE the bow warp: bowFace()
// keeps the hair boundary outside the jaw fixed in exactly this frame, so a
// split written here stays put on the body at every bow depth. Each pose's
// body is mapped into it with that pose's own head transform (neck lean,
// head tilt, back-view bow, hop), so a value says where the body is as seen
// from the head. The head's size differs per view (VIEW_HEAD): 1 unit is
// each view's frame.pxPerUnit280 px of the 280 px render (front 4.676 for
// both sexes; m right 5.359, m back 5.658, f right 4.676, f back 5.022).
//
// METHOD. Every pose is rasterised at SCALE x the 280 px render (the same
// SVG, only bigger; nothing in the runtime depends on the size) in separate
// passes, each alone on a transparent page, head and back hair hidden:
//   collar  the top's torso piece only (the torso part without the neck painting);
//   arms    the body layer without the torso part: arms, sleeves, hands, legs;
//   neck    the neck painting only;
//   hands   the raised hands drawn over the head ([data-foundation-front-hand]),
//           when the pose has any.
// body = collar over arms (alpha composited): the body layer without the
// neck, i.e. collar, shoulders, sleeves and arms. Body or collar pixels under
// a raised hand are hidden in the avatar, and so is any hair edge there:
// they do not count (the happy cheer's underarm fill rises to y 27.9 under
// the raised sleeve). A pixel counts as under the hand wherever the hand
// layer has any alpha: with a partial mask (alpha clamped to 255 - hand) the
// body survived along the antialiased lower edge of the raised arm as
// slivers .01-.35 units thick that set the happy envelope over 7-8 columns.
// The 0.5 alpha edge is read along head-native rays on a .05 grid: columns
// x in [-1, 33] (top edge, first from y=8 down to 40) and rows y (the neck's
// left and right edges). A ray advances at most half a pixel at a time and
// looks at the 3x3 pixel maximum around each step, so a thin stroke whose
// peak alpha only just passes 0.5 is not stepped over; where that maximum
// reaches the edge, the bilinear alpha is read every .005 units (linear
// inside the last step). Values are rounded to .01.
// Each pose is painted fresh: the runtime's paint pool (QPFoundationSkin:
// sleeve, limb and shorts images under keys rounded to a degree, 1/40 or 1/24
// unit, LRU-evicted, emptied after a minute unused) is emptied before every
// pose. Otherwise a pose shows the image painted for whichever earlier pose
// filled its key, so the outline depends on the poses measured before it
// (45 poses moved, by up to .64 in a column where an arm's edge is near
// vertical, i.e. about .02 sideways; no derived value moved by more than
// .01). What the tool cannot reset is the state the runtime leaves on the
// avatar's hidden elements (underarm pieces under a raised sleeve, the bow
// layer's clip): in another pose list a few gesture steps where the arms
// start or finish rising (wave/happy 3, 33, 34) read up to .02 differently,
// although the full render is pixel-identical. The same list in the same
// order gives the same bytes (--check).
//
// POSES (per view): idle, walk, run, jump, floor-sit, sit (desk) x 8 frames
// (tools/foundation-matrix.cjs states, idle at times 0-1.4 s), idle at the
// breathing peak (idle/breath: time pi/rate, rate read from the runtime's
// breath=(1-cos(time*rate))/2; the 8 idle frames reach .94 of it), and wave,
// nod, happy at every drawn gesture step (36ths, 37 poses; the nod peak is
// among them) twice: at time 0 (no breathing; '<gesture>/<k>') and at the
// breathing peak ('<gesture>@breath/<k>'), since a gesture starts at any
// point of the breath, which turns the resting arms a little (avatar-
// foundation.js: swing 1.2 deg, flex 3 deg; the drop moves head and body
// together). Breath moves the arms monotonically, so its two ends bracket it.
// Every step counts: the shared matrix's 6 gesture steps would miss raised-
// arm frames (the front envelope up to 2.8 units higher in a column at the
// edge of a sweeping arm, measured with the nearest 36ths). Climb is
// not a head-frame pose (its hands go above the head). Identical renders
// (same SVG) are measured once.
//
// OUTPUT (tools/fixtures/head-frame.json), per sex x view (front | right |
// back; left mirrors right), arrays on the .05 grid (x0|y0 = first value):
//   frame      idle head-native -> viewBox matrix [a,b,c,d,e,f] and px per unit at 280 px
//   envelope   min over poses of the body outline (front: the collar/shoulder envelope,
//              H2 split = envelope - .10 outside the jaw) and which pose sets it (runs)
//   collar     the collar outline: idle, min and max over poses
//   corridor   neck painting edges per row: idle, always (every pose), ever (any pose)
//   collarRows where the collar meets the neck: front/back left, centre, right;
//              right view nape (back of the neck) and throat; idle/min/max
//   nape       right view: the neck's back outline per row: idle/min/max
//   poses      front only, per pose: head-native -> viewBox and torso -> viewBox
//              matrices and the body outline, a key into 'outlines' (identical
//              outlines shared): runs of vertices, Douglas-Peucker within .005
//              (linear interpolation gives the grid values back within .01).
//              The other views and kinds per pose: --raw.
//
// BOB. 'bob' checks today's female FRONT_HAIR_CLIP against the margins its
// comment records (2026-10-08 round 2: .40 at the nod peak, idle .68), in
// four readings. The boundary is always the pose's live clip path through
// its face warp (bowFace()).
//   method2026  the 2026-10-08 measurement itself, ported unchanged into the
//               page (pageLib bob2026; the round-2 scratch script was never
//               committed): the posed avatar cloned with only the torso part
//               (the shirt's torso piece, no neck painting), rasterised at 40
//               px per viewBox unit; the boundary's M/L points with 20<y<40
//               sampled at tenths of each segment; samples over the body's
//               neck columns (torso x 14..18, viewBox 16 +- 2 x 1.693) skipped;
//               margin = (first row with alpha > 128 at the sample's nearest
//               pixel column - boundary y) / head scale. On idle/0 and the
//               nod steps at time 0, as then.
//   grid2026    the same reading on this tool's head-native .05 grid (the data
//               H2 reads): collar outline minus boundary at grid columns,
//               boundary vertices and the two column edges outside the neck
//               columns (time-0 poses, as method2026). The collar outline is
//               never interpolated across a column edge: next to an edge it is
//               extrapolated from the two nearest columns outside.
//   rule5       the boundary outside the whole JAW blend (bowFace() anchoring
//               1: it stays on the body at every bow depth) against the body
//               outline (collar, sleeves, arms), every front pose (the
//               breathing gestures too): rule 5's 'at least .10'.
//   hair        rule5 only at the columns where the front layer draws hair
//               just above the boundary, read on the rendered avatar
//               (edgeKinds; idle/0 and the time-0 nod poses). At the nod peak
//               the bowed face slides down over the boundary, so beside the
//               jaw the layer draws face skin there (hair.skinAtNodPeak).
// At the nod peak the 2026-10-08 minimum lies at the right column edge (torso
// x 18 = head x 19.62), which is also where the collar outline steps up by
// about .18 (the collar point): just inside it the margin is about .19, at
// the first .05 column outside .44. Just above the boundary there the front
// layer draws the bowed face's skin (corner.drawn), not hair. So the recorded
// .40 is a one-sided value at that corner; it is reproduced, but it is not a
// hair margin (hair.nodPeak is).
const fs=require('node:fs'),path=require('node:path');
const H=require('../verify-harness.cjs'),M=require('../foundation-matrix.cjs');
const ROOT=path.resolve(__dirname,'../..');
const FIXTURE=path.join(ROOT,'tools/fixtures/head-frame.json'),IMAGES=path.join(ROOT,'검증/머리틀');
const VIEWS=Object.freeze(['front','right','back']);
const SIZE=280,SCALE=4,STEP=.05,PREC=100,EDGE=128,TOL=.005;
// The head-native region read on every pose (x range, y range).
const XR=Object.freeze([-1,33]),YR=Object.freeze([8,40]);
// The margins recorded for the bob (avatar-foundation.js FRONT_HAIR_CLIP comment),
// and rule 5's least margin (아바타-제작기준.md: at least .10 above the collar/shoulders).
const BOB=Object.freeze({idle:.68,nodPeak:.40,tolerance:.02,rule:.10});
// The 2026-10-08 measurement: raster px per viewBox unit; the body's neck columns (torso x).
const BOB2026=Object.freeze({scale:40,neckColumns:Object.freeze([14,18])});

const r2=v=>Math.round(v*PREC)/PREC;
const grid=(a,b)=>{const n=Math.round((b-a)/STEP),out=[];for(let i=0;i<=n;i++)out.push(r2(a+i*STEP));return out;};
const XS=grid(...XR),YS=grid(...YR);
const apply=(m,[x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
const invert=m=>{const d=m[0]*m[3]-m[1]*m[2];return[m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];};
const multiply=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];

// Poses of one view, in a fixed order (breath: the idle breathing peak's time).
function poses(direction,breath){
  const out=[];
  for(const action of ['idle','walk','run','jump','floor-sit','sit']){
    for(let k=0;k<M.FRAMES;k++)out.push({id:action+'/'+k,state:M.actionState(action,direction,k)});
    if(action==='idle')out.push({id:'idle/breath',state:{action:'idle',direction,time:breath,reducedMotion:false}});
  }
  for(const gesture of M.GESTURES)for(let k=0;k<=36;k++)out.push({id:gesture+'/'+k,state:{action:'idle',direction,gesture,gestureProgress:k/36,time:0,reducedMotion:false}});
  // A gesture plays at any point of the breath: every step again at its peak
  // (step 0 is idle/breath).
  for(const gesture of M.GESTURES)for(let k=1;k<=36;k++)out.push({id:gesture+'@breath/'+k,state:{action:'idle',direction,gesture,gestureProgress:k/36,time:breath,reducedMotion:false}});
  return out;
}
// The runtime's JAW blend (avatar-foundation.js), read from the source.
function runtimeJaw(root){
  const m=fs.readFileSync(path.join(root,'avatar-foundation.js'),'utf8').match(/const JAW=\[([^\]]+)\];/);
  if(!m)throw Error('avatar-foundation.js: const JAW not found');return m[1].split(',').map(Number);
}
// The standing breath's peak time: breath=(1-cos(time*rate))/2 peaks at pi/rate.
function runtimeBreath(root){
  const m=fs.readFileSync(path.join(root,'avatar-foundation.js'),'utf8').match(/breath=calm\?0:\(1-Math\.cos\(time\*([\d.]+)\)\)\/2/);
  if(!m)throw Error('avatar-foundation.js: the breathing formula was not found');return Math.round(Math.PI/Number(m[1])*1e4)/1e4;
}
// Files whose bytes decide the measurement (a change means: measure again).
function inputs(root){
  const files=['avatar-foundation.js','avatar-foundation-skin.js','avatar-foundation-outfit.js','avatar-foundation-garments.js','avatar-foundation.css',
    ...fs.readdirSync(path.join(root,'assets')).filter(f=>/^sd-(foundation-ref|garment)[\w-]*\.(png|js)$/.test(f)).sort().map(f=>'assets/'+f)];
  return Object.fromEntries(files.map(f=>[f,H.sha256(fs.readFileSync(path.join(root,f)))]));
}

// ---------------------------------------------------------------- page side
function pageLib(cfg){
  const api=window.QPAvatarFoundation;
  const style=document.createElement('style');style.textContent=`
    html,body{background:transparent!important;overflow:hidden!important}
    body>*:not(#hf-host){display:none!important}
    #hf-host{position:absolute;left:0;top:0;width:${cfg.vw}px;height:${cfg.vh}px;margin:0;padding:0}
    #hf-host,#hf-host *{animation:none!important;transition:none!important}
    #hf-host>svg[data-qp-foundation]{position:absolute;left:${cfg.left}px;top:${cfg.top}px}
    #hf-host.hf-pass .qpx-contact-shadow,#hf-host.hf-pass [data-foundation-head],#hf-host.hf-pass [data-foundation-back-hair],#hf-host.hf-pass [data-foundation-front-hand]{display:none!important}
    #hf-host.hf-body [data-foundation-skin-paint="neck"],#hf-host.hf-body [data-foundation-skin-part="neck"]{display:none!important}
    #hf-host.hf-arms [data-foundation-body] [data-foundation-part="torso"]{display:none!important}
    #hf-host.hf-only svg *:not(defs):not(defs *){visibility:hidden!important}
    #hf-host.hf-collar [data-foundation-body] [data-foundation-part="torso"] *{visibility:visible!important}
    #hf-host.hf-neck [data-foundation-body] [data-foundation-skin-paint="neck"]{visibility:visible!important}
    #hf-host.hf-hands [data-foundation-front-hand],#hf-host.hf-hands [data-foundation-front-hand] *{visibility:visible!important}`;
  document.head.append(style);
  const host=document.createElement('div');host.id='hf-host';document.body.append(host);
  const frame=()=>new Promise(r=>requestAnimationFrame(()=>r()));
  async function settle(){
    const hrefs=new Set();for(const im of host.querySelectorAll('image'))hrefs.add(im.getAttribute('href'));
    await Promise.all([...hrefs].filter(Boolean).map(h=>{const i=new Image();i.src=h;return i.decode().catch(()=>{});}));
    await frame();await frame();
  }
  // A transform attribute's own matrix (the view's VIEW_HEAD fit, the bow face warp).
  const dm=m=>new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]),own=el=>{const m=el?.transform?.baseVal?.consolidate()?.matrix;return m?dm(m):new DOMMatrix();};
  const six=m=>[m.a,m.b,m.c,m.d,m.e,m.f];
  // Seated avatars breathe with their own offset (render serial); it is
  // removed so the state's time is what shows (foundation-signature.cjs).
  const offset=svg=>(Number(String(svg.dataset.foundationId).slice(4))||0)*1.37%3.3;
  const posed=(svg,state)=>state.action==='sit'||state.action==='floor-sit'?{...state,time:state.time-offset(svg)}:state;
  const cyrb=(s,seed)=>{let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(36);};
  let svg=null;
  window.__hf={
    mount({av,size}){
      if(svg){api.destroy(svg);svg.remove();}
      host.querySelector('#hf-overlay')?.remove();host.insertAdjacentHTML('afterbegin',api.render(av,size));svg=host.firstElementChild;
      if(svg.dataset.foundationStatic==='pending')throw Error('render is still pending (art not ready)');
      return{garments:svg.dataset.foundationGarments||'',fallback:svg.dataset.foundationFallback||'',class:svg.dataset.foundationClass||''};
    },
    async pose(state){
      // Painted fresh: an empty paint pool, so no cached sleeve, limb or
      // shorts image painted for a neighbouring pose stands in (see METHOD).
      window.QPFoundationSkin.emptyPaint();
      api.apply(svg,posed(svg,state));await settle();
      const view=svg.dataset.qpxView,v=svg.querySelector('[data-foundation-head-view="'+view+'"]'),head=svg.querySelector('[data-foundation-head]');
      // head-native (pre-warp) -> page px, and -> viewBox units
      const toPage=dm(head.getScreenCTM()).multiply(own(v)),toBox=dm(svg.getScreenCTM()).inverse().multiply(toPage);
      const torso=dm(svg.getScreenCTM()).inverse().multiply(dm(svg.querySelector('[data-foundation-part="torso"]').getScreenCTM()));
      const out={view,toPage:six(toPage),toBox:six(toBox),torsoToBox:six(torso),hidden:svg.getAttribute('visibility')==='hidden',hands:svg.querySelector('[data-foundation-front-hand]').children.length>0};
      // The front hair boundary as drawn at this pose (bowFace), mapped into
      // the pre-warp head-native frame through the face band's warp.
      const clip=svg.querySelector('[id="'+svg.dataset.foundationId+'-head-front"] path'),face=svg.querySelector('[data-foundation-bow="face"]');
      if(clip&&view==='front'&&svg.querySelector('[id="'+svg.dataset.foundationId+'-hair-behind"]')){
        const warp=face&&face.style.display!=='none'?own(face.firstElementChild):new DOMMatrix(),fit=own(v);
        out.clip={d:clip.getAttribute('d'),warp:six(fit.inverse().multiply(warp).multiply(fit))};
      }
      // Everything visible in the torso part besides garments: the body pass
      // hides exactly the neck painting, so this must be just that.
      out.torso=[...svg.querySelectorAll('[data-foundation-part="torso"] > *')].filter(e=>!e.dataset.outfitPart&&!e.dataset.outfitOwner&&e.checkVisibility({visibilityProperty:true})).map(e=>e.tagName+(e.dataset.foundationSkinPaint?':'+e.dataset.foundationSkinPaint:''));
      out.sig=cyrb(svg.outerHTML,1)+'.'+cyrb(svg.outerHTML,7);
      return out;
    },
    async pass(name){host.className=name;await frame();await frame();},
    // The 2026-10-08 bob margin measurement (round 2), as it was written: a
    // clone with only the torso part (no neck painting), rasterised as an
    // image at S px per viewBox unit; the hair boundary's M/L points with
    // 20<y<40 through the view fit, the face band's warp and the head group,
    // sampled at tenths of each segment; samples over the body's neck columns
    // (torso x cols, viewBox 16 +- 2 x 1.693 then) skipped; margin = (first
    // row with alpha > 128 at the nearest pixel column - y) / head scale.
    // Only the constants it had written in (the view drop .15, the column
    // band, the head scale .88 x 1.0627) are read from the DOM instead; they
    // are the same values today.
    async bob2026({S,cols}){
      const id=svg.dataset.foundationId,clip=svg.querySelector('[id="'+id+'-head-front"] path'),head=svg.querySelector('[data-foundation-head]'),face=svg.querySelector('[data-foundation-bow="face"]'),use=face?.firstElementChild;
      const v=svg.querySelector('[data-foundation-head-view="'+svg.dataset.qpxView+'"]'),inv=dm(svg.getScreenCTM()).inverse();
      const pts=[...clip.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(m=>[+m[1],+m[2]]);
      const Hm=inv.multiply(dm(head.getScreenCTM())),U=face&&face.style.display!=='none'?own(use):null,fit=own(v);
      const map=([x,y])=>{let q=new DOMPoint(x,y).matrixTransform(fit);if(U)q=q.matrixTransform(U);return q.matrixTransform(Hm);};
      const line=pts.filter(q=>q[1]>20&&q[1]<40).map(map);
      const cl=svg.cloneNode(true);for(const e of cl.querySelectorAll('[data-foundation-head],[data-foundation-back-hair],[data-foundation-front-hand],.qpx-contact-shadow'))e.remove();
      for(const part of cl.querySelectorAll('[data-foundation-part]'))if(part.dataset.foundationPart!=='torso')part.remove();for(const e of cl.querySelectorAll('[data-foundation-skin-paint="neck"]'))e.remove();
      cl.setAttribute('width',32*S);cl.setAttribute('height',62*S);
      const im=new Image(),u=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(cl)],{type:'image/svg+xml'}));im.src=u;await im.decode();URL.revokeObjectURL(u);
      const c=document.createElement('canvas');c.width=32*S;c.height=62*S;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
      const top=X=>{const px=Math.round(X*S);for(let Y=0;Y<c.height;Y++)if(d[(Y*c.width+px)*4+3]>128)return Y/S;return 99;};
      const torso=inv.multiply(dm(svg.querySelector('[data-foundation-part="torso"]').getScreenCTM())),band=cols.map(t=>new DOMPoint(t,28).matrixTransform(torso).x);
      const scale=Math.hypot(Hm.multiply(fit).a,Hm.multiply(fit).b);
      // The torso alone must be there (an empty raster would read 99 everywhere).
      if(top(16)>=99)throw Error('bob2026: the torso clone rasterised empty');
      let worst=99,at=null;
      for(let i=0;i<line.length-1;i++)for(let t=0;t<=1;t+=.1){const X=line[i].x+(line[i+1].x-line[i].x)*t,Y=line[i].y+(line[i+1].y-line[i].y)*t;if(X>band[0]&&X<band[1])continue;const m=(top(X)-Y)/scale;if(m<worst){worst=m;at=[X,Y];}}
      return{margin:worst,at,band,scale};
    },
    // Lines ({pts in page px,color,width,dash,fill,opacity}) and labels over the avatar.
    async overlay({lines,labels,bg}){
      host.querySelector('#hf-overlay')?.remove();host.style.background=bg||'';
      const NS='http://www.w3.org/2000/svg',o=document.createElementNS(NS,'svg');o.id='hf-overlay';o.setAttribute('width',cfg.vw);o.setAttribute('height',cfg.vh);o.style.cssText='position:absolute;left:0;top:0;pointer-events:none;overflow:visible';
      for(const l of lines||[]){if(l.pts.length<2)continue;const e=document.createElementNS(NS,l.fill?'polygon':'polyline');e.setAttribute('points',l.pts.map(p=>p.map(v=>v.toFixed(2)).join(',')).join(' '));e.setAttribute('fill',l.fill||'none');e.setAttribute('stroke',l.color||'none');e.setAttribute('stroke-width',l.width||1);e.setAttribute('stroke-linejoin','round');e.setAttribute('stroke-linecap','round');if(l.dash)e.setAttribute('stroke-dasharray',l.dash);if(l.opacity)e.setAttribute('opacity',l.opacity);o.append(e);}
      for(const t of labels||[]){const e=document.createElementNS(NS,'text');e.setAttribute('x',t.x);e.setAttribute('y',t.y);e.setAttribute('fill',t.color||'#111');e.setAttribute('font-size',t.size||5);e.setAttribute('font-family','sans-serif');e.setAttribute('font-weight','700');if(t.anchor)e.setAttribute('text-anchor',t.anchor);if(t.halo){e.setAttribute('stroke',t.halo);e.setAttribute('stroke-width',(t.size||5)/4);e.setAttribute('paint-order','stroke');}e.textContent=t.text;o.append(e);}
      host.append(o);await frame();await frame();
    },
    clear(){if(svg){api.destroy(svg);svg.remove();svg=null;}host.querySelector('#hf-overlay')?.remove();host.className='';host.style.background='';}
  };
}

// ------------------------------------------------------------------ helpers
async function openRuntime(browser,base,report,viewport,dpr=1){
  const context=await browser.newContext({viewport,deviceScaleFactor:dpr,reducedMotion:'no-preference'});
  await H.isolate(context,report);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(new URL('index.html?demo=1&avatar=foundation',base).href);
  await page.waitForFunction(()=>window.QPGame&&window.QPAvatarFoundation&&window.QPFoundationGarments,null,{timeout:90000});
  await page.evaluate(()=>{QPGame.go('login');return window.QPFoundationGarments.loadStarter();});
  await page.waitForFunction(()=>{const ok=m=>!m||m.atlas?.ready||Boolean(m.atlas?.error);return ok(window.QPFoundationSkin)&&window.QPAvatar?.atlas.ready&&window.QPAvatarDirection?.atlas.ready&&window.QPAvatarDirection.atlas.backReady&&QPFoundationGarments.settled('starter','m')&&QPFoundationGarments.settled('starter','f');},null,{timeout:120000,polling:100});
  const errors=await page.evaluate(()=>[window.QPFoundationSkin?.atlas?.error].filter(Boolean));
  if(errors.length)throw Error('foundation art failed to load: '+errors.join('; '));
  return{context,page};
}
// Page-px rectangle covering a head-native box of one pose.
function roi(toPage,[x0,x1],[y0,y1],vw,vh,pad=2){
  const c=[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(p=>apply(toPage,p));
  const a=Math.max(0,Math.floor(Math.min(...c.map(p=>p[0])))-pad),b=Math.max(0,Math.floor(Math.min(...c.map(p=>p[1])))-pad);
  return{x:a,y:b,width:Math.min(vw,Math.ceil(Math.max(...c.map(p=>p[0])))+pad)-a,height:Math.min(vh,Math.ceil(Math.max(...c.map(p=>p[1])))+pad)-b};
}
// One pass's alpha (0-255) as a plane, and the planes the outlines read:
// body = collar over arms (source-over alpha); every pixel the raised hands
// layer touches at all is hidden in each of them.
const plane=img=>{const n=img.width*img.height,a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=img.data[i*4+3];return{w:img.width,h:img.height,a};};
// The 3x3 pixel maximum of a plane (an upper bound of the bilinear alpha
// anywhere within half a pixel of a pixel's own square).
function withMax(F){
  const {w,h,a}=F,row=new Float32Array(a.length),mx=new Float32Array(a.length);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=j*w+i;let m=a[k];if(i>0&&a[k-1]>m)m=a[k-1];if(i<w-1&&a[k+1]>m)m=a[k+1];row[k]=m;}
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=j*w+i;let m=row[k];if(j>0&&row[k-w]>m)m=row[k-w];if(j<h-1&&row[k+w]>m)m=row[k+w];mx[k]=m;}
  F.mx=mx;return F;
}
function combine(shots){
  const collar=plane(shots.collar),arms=plane(shots.arms),hands=shots.hands?plane(shots.hands).a:null,n=collar.a.length;
  const body={...collar,a:new Float32Array(n)};
  for(let i=0;i<n;i++){
    if(hands&&hands[i]>0){collar.a[i]=0;arms.a[i]=0;continue;}
    const c=collar.a[i],r=arms.a[i];body.a[i]=c+r*(255-c)/255;}
  return{body:withMax(body),collar:withMax(collar),arms:withMax(arms),neck:withMax(plane(shots.neck))};
}
// Bilinear over pixel centres (x, y in pixels of the shot); 0 outside.
function bilinear(F,x,y){
  const i=Math.floor(x),j=Math.floor(y);if(i<-1||j<-1||i>=F.w||j>=F.h)return 0;
  const fx=x-i,fy=y-j,w=F.w,a=F.a,g=(ii,jj)=>ii<0||jj<0||ii>=w||jj>=F.h?0:a[jj*w+ii];
  return g(i,j)*(1-fx)*(1-fy)+g(i+1,j)*fx*(1-fy)+g(i,j+1)*(1-fx)*fy+g(i+1,j+1)*fx*fy;
}
// Could the bilinear alpha reach EDGE within half a pixel of (x, y)? (The
// four pixels it blends at such a point all lie in the 3x3 block around
// pixel (floor(x+.5), floor(y+.5)), whose maximum withMax() holds; outside
// the plane the nearest border block stands in, which only adds.)
function mayReach(F,x,y){const i=Math.min(F.w-1,Math.max(0,Math.floor(x+.5))),j=Math.min(F.h-1,Math.max(0,Math.floor(y+.5)));return F.mx[j*F.w+i]>=EDGE;}
// Distance along a head-native ray (start o and direction d in shot pixels
// per head unit, length len units) to the first point where the bilinear
// alpha reaches EDGE. The ray advances in steps of at most half a pixel (a
// multiple of TOL); a step whose ends cannot reach EDGE (mayReach) is
// skipped whole, any other is read at every multiple of TOL, linear inside
// the last. So a thin stroke is found wherever its alpha passes EDGE at a
// TOL multiple, not only where a coarse step happens to land on it.
function cross(F,o,d,len){
  const at=t=>bilinear(F,o[0]+d[0]*t,o[1]+d[1]*t),may=t=>mayReach(F,o[0]+d[0]*t,o[1]+d[1]*t);
  if(at(0)>=EDGE)return 0;
  const k=Math.max(1,Math.min(Math.round(STEP/TOL),Math.floor(.5/Math.hypot(d[0],d[1])/TOL))),n=Math.round(len/TOL);
  for(let i=0;i<n;i+=k){
    const j1=Math.min(n,i+k);if(!may(i*TOL)&&!may(j1*TOL))continue;
    let v0=at(i*TOL);
    for(let j=i+1;j<=j1;j++){const s=j*TOL,w=at(s);if(w>=EDGE)return s-TOL+TOL*(EDGE-v0)/(w-v0);v0=w;}
  }
  return null;
}
// The neck is read between these columns (it never leaves them).
const NECK_X=Object.freeze([4,28]);
function readPose(shots,rect,toPage){
  const F=combine(shots),shot=([x,y])=>{const p=apply(toPage,[x,y]);return[p[0]-rect.x-.5,p[1]-rect.y-.5];};
  const down=[toPage[2],toPage[3]],across=[toPage[0],toPage[1]],back=[-toPage[0],-toPage[1]];
  const top=P=>XS.map(x=>{const t=cross(P,shot([x,YR[0]]),down,YR[1]-YR[0]);return t===null?null:YR[0]+t;});
  const neck=YS.map(y=>{const len=NECK_X[1]-NECK_X[0],l=cross(F.neck,shot([NECK_X[0],y]),across,len);if(l===null)return null;const r=cross(F.neck,shot([NECK_X[1],y]),back,len);return[NECK_X[0]+l,NECK_X[1]-r];});
  return{body:top(F.body),collar:top(F.collar),arms:top(F.arms),neck};
}
// What the front layer draws just above its boundary, per grid column x in
// EDGE_X, read on a screenshot of the whole avatar (head shown): five
// samples .1-.5 units above the boundary; skin by the hair plan's rule
// (r >= 170, g/r > .70, b/g > .80), any other opaque pixel is hair (strands,
// highlights, ink). 's' when at least 3 samples are skin, 'h' when at least
// 3 are hair, else 'm'; '-' where the boundary has no point.
const EDGE_X=Object.freeze([4,28]);
function edgeKinds(img,rect,toPage,clip){
  const line=clipLine(clip.d,clip.warp);let out='';
  for(const x of XS){if(x<EDGE_X[0]||x>EDGE_X[1])continue;const l=lineAt(line,x);if(!defined(l)){out+='-';continue;}
    let skin=0,hair=0;
    for(const d of [.1,.2,.3,.4,.5]){const p=apply(toPage,[x,l-d]),i=Math.floor(p[0]-rect.x),j=Math.floor(p[1]-rect.y);if(i<0||j<0||i>=img.width||j>=img.height)continue;
      const k=(j*img.width+i)*4,r=img.data[k],g=img.data[k+1],b=img.data[k+2];if(img.data[k+3]<128)continue;if(r>=170&&g/r>.7&&b/g>.8)skin++;else hair++;}
    out+=skin>=3?'s':hair>=3?'h':'m';}
  return out;
}
const kindAt=(pose,x)=>{if(!pose.edge)return null;const i=Math.round((x-EDGE_X[0])/STEP);return i>=0&&i<pose.edge.length?pose.edge[i]:null;};

// ---------------------------------------------------------------- measuring
// The avatar must wear what was asked: no slot may fall back to the basic
// piece (the runtime's reason: todo, class, outfit, error, candidate), and
// records named in av.foundationGarments must be the ones worn.
function checkWorn(sex,av,worn){
  if(worn.fallback)throw Error(sex+': a slot fell back to the basic piece ('+worn.fallback+'; worn '+worn.garments+'), so this would measure the basic outfit; asked '+JSON.stringify(av));
  const ids=String(worn.garments).split('|');
  for(const [slot,id] of Object.entries(av.foundationGarments||{}))if(id&&!ids.includes(id))throw Error(sex+': '+slot+' '+id+' is not worn (worn '+worn.garments+')');
}
async function measure(opts){
  const report={errors:[],blocked:[]},server=await H.serve(H.fsTree(opts.root||ROOT));
  const browser=await H.launch({args:H.RASTER_ARGS});const t0=Date.now();
  const size=SIZE*SCALE,box=[size*32/56,size*62/56],vw=Math.ceil(box[0]*1.6),vh=Math.ceil(box[1]*1.05),left=Math.round((vw-box[0])/2),top=Math.round(box[1]*.02);
  const out={browser:'',sexes:{},errors:report.errors,blocked:report.blocked};
  try{
    const {page,context}=await openRuntime(browser,server.base,report,{width:vw,height:vh});
    out.browser=browser.version();
    await page.evaluate(pageLib,{vw,vh,left,top});
    const breath=runtimeBreath(opts.root||ROOT);
    for(const sex of opts.sexes){
      const av=M.referenceAvatar(sex,0,opts.av||{}),worn=await page.evaluate(spec=>window.__hf.mount(spec),{av,size});
      checkWorn(sex,av,worn);
      out.sexes[sex]={av,worn,views:{}};
      for(const direction of opts.views){
        const list=poses(direction,breath),seen=new Map(),rows=[];
        for(const p of list){
          const info=await page.evaluate(s=>window.__hf.pose(s),p.state);
          if(info.hidden)throw Error(sex+' '+direction+' '+p.id+': the avatar is hidden (garments not settled)');
          if(info.torso.join()!=='image:neck')throw Error(sex+' '+direction+' '+p.id+': unexpected torso nodes '+info.torso.join());
          let m=seen.get(info.sig);
          if(!m){
            const rect=roi(info.toPage,XR,YR,vw,vh),shots={};
            for(const [name,cls] of [['collar','hf-pass hf-body hf-only hf-collar'],['arms','hf-pass hf-body hf-arms'],['neck','hf-pass hf-only hf-neck'],...(info.hands?[['hands','hf-only hf-hands']]:[])]){
              await page.evaluate(n=>window.__hf.pass(n),cls);shots[name]=H.png.decode(await page.screenshot({clip:rect,omitBackground:true,animations:'disabled',caret:'hide'}));}
            await page.evaluate(n=>window.__hf.pass(n),'');
            m=readPose(shots,rect,info.toPage);seen.set(info.sig,m);
          }
          const row={id:p.id,state:p.state,toBox:info.toBox,torsoToBox:info.torsoToBox,clip:info.clip,hands:info.hands,...m};
          // The 2026-10-08 bob measurement, on the poses it was taken on (idle, nod; time 0).
          if(info.clip&&direction==='front'&&(p.id==='idle/0'||p.id.startsWith('nod/'))){
            row.bob2026=await page.evaluate(o=>window.__hf.bob2026(o),{S:BOB2026.scale,cols:BOB2026.neckColumns});
            // What the front layer draws just above its boundary, on the whole avatar as seen.
            const rect=roi(info.toPage,XR,YR,vw,vh);
            row.edge=edgeKinds(H.png.decode(await page.screenshot({clip:rect,omitBackground:true,animations:'disabled',caret:'hide'})),rect,info.toPage,info.clip);
          }
          rows.push(row);
        }
        out.sexes[sex].views[direction]=rows;
        process.stderr.write('  '+sex+' '+direction+': '+list.length+' poses, '+seen.size+' distinct renders, '+((Date.now()-t0)/1000).toFixed(0)+'s\n');
      }
    }
    await page.evaluate(()=>window.__hf.clear());await context.close();
  }finally{await browser.close();await server.close();}
  return out;
}

// ------------------------------------------------------------ derivations
// (Measured values are floats; everything written is rounded to .01.)
const defined=v=>v!==null&&v!==undefined;
const round=v=>!defined(v)?null:Array.isArray(v)?v.map(round):r2(v);
// A grid array trimmed to its defined span, rounded: {x0|y0, values}.
function span(values,axis){
  const a=values.findIndex(defined);if(a<0)return{[axis]:null,values:[]};
  let b=values.length-1;while(!defined(values[b]))b--;
  return{[axis]:axis==='x0'?XS[a]:YS[a],values:round(values.slice(a,b+1))};
}
function columnStats(rows,key){
  const pick=f=>XS.map((x,i)=>{let v=null;for(const r of rows){const y=r[key][i];if(defined(y)&&(v===null||f(y,v)))v=y;}return v;});
  return{min:pick((a,b)=>a<b),max:pick((a,b)=>a>b)};
}
// Which pose sets the envelope, as runs [pose, x from, x to].
function argminRuns(rows,key,env){
  const runs=[];XS.forEach((x,i)=>{if(!defined(env[i]))return;const p=rows.find(r=>r[key][i]===env[i]).id,last=runs[runs.length-1];
    if(last&&last[0]===p&&r2(last[2]+STEP)===x)last[2]=x;else runs.push([p,x,x]);});return runs;
}
function corridorStats(rows){
  const always=YS.map((y,i)=>{let l=-Infinity,r=Infinity;for(const p of rows){const v=p.neck[i];if(!v)return null;l=Math.max(l,v[0]);r=Math.min(r,v[1]);}return l<=r?[l,r]:null;});
  const ever=YS.map((y,i)=>{let l=Infinity,r=-Infinity;for(const p of rows){const v=p.neck[i];if(!v)continue;l=Math.min(l,v[0]);r=Math.max(r,v[1]);}return l<=r?[l,r]:null;});
  return{idle:rows[0].neck,always,ever};
}
// A column outline at any x (linear between grid columns; null across a gap).
function interpGrid(values,x){
  const f=(x-XR[0])/STEP,i=Math.floor(f+1e-9),t=f-i,a=values[i],b=values[i+1];
  if(t<1e-9)return defined(a)?a:null;if(!defined(a)||!defined(b))return null;return a+(b-a)*t;
}
// Where the collar meets a neck edge: going down the edge, the first row
// whose collar top at the edge is at or above the row.
function meetRow(pose,side){
  for(let i=0;i<YS.length;i++){const v=pose.neck[i];if(!v)continue;const c=interpGrid(pose.collar,v[side]);if(defined(c)&&c<=YS[i])return{x:r2(v[side]),y:YS[i]};}
  return null;
}
function collarRows(rows,view){
  const sides=view==='right'?{nape:0,throat:1}:{left:0,right:1},out={};
  const stats=list=>{const ys=list.filter(Boolean).map(v=>v.y);return ys.length?{min:r2(Math.min(...ys)),max:r2(Math.max(...ys))}:{min:null,max:null};};
  for(const [name,side] of Object.entries(sides)){const per=rows.map(r=>meetRow(r,side));out[name]={idle:per[0],...stats(per)};}
  if(view!=='right'){
    // The collar line at the middle of the neck (between its idle meeting points).
    const a=out.left.idle,b=out.right.idle;
    if(a&&b){const xc=r2((a.x+b.x)/2),per=rows.map(r=>{const c=interpGrid(r.collar,xc);return defined(c)?{x:xc,y:r2(c)}:null;});out.centre={idle:per[0],...stats(per)};}
  }
  return out;
}
function napeStats(rows){
  const pick=(i,f)=>{let v=null;for(const r of rows){const n=r.neck[i];if(n&&(v===null||f(n[0],v)))v=n[0];}return v;};
  return{idle:rows[0].neck.map(n=>n?n[0]:null),min:YS.map((y,i)=>pick(i,(a,b)=>a<b)),max:YS.map((y,i)=>pick(i,(a,b)=>a>b))};
}
// Douglas-Peucker on one run of [u,v] points (v the measured value).
function simplify(pts,tol){
  if(pts.length<3)return pts;const keep=new Uint8Array(pts.length);keep[0]=keep[pts.length-1]=1;const stack=[[0,pts.length-1]];
  while(stack.length){const [a,b]=stack.pop();let best=-1,d=tol;
    for(let i=a+1;i<b;i++){const t=(pts[i][0]-pts[a][0])/(pts[b][0]-pts[a][0]),e=Math.abs(pts[a][1]+(pts[b][1]-pts[a][1])*t-pts[i][1]);if(e>d){d=e;best=i;}}
    if(best>0){keep[best]=1;stack.push([a,best],[best,b]);}}
  return pts.filter((p,i)=>keep[i]);
}
// Grid values -> runs of vertices (Douglas-Peucker within RDP of the
// measured values, then rounded to .01), each flat [u0,v0,u1,v1,...].
const RDP=.005;
function encode(values,axis){
  const runs=[];let cur=[];values.forEach((v,i)=>{if(!defined(v)){if(cur.length)runs.push(cur);cur=[];}else cur.push([axis[i],v]);});if(cur.length)runs.push(cur);
  return runs.map(r=>simplify(r,RDP).flatMap(([u,v])=>[u,r2(v)]));
}
// The grid values of an encoded outline (what a consumer reads back).
function decode(runs,axis){
  const out=axis.map(()=>null);
  for(const run of runs){
    if(run.length===2){axis.forEach((u,k)=>{if(Math.abs(u-run[0])<1e-9)out[k]=run[1];});continue;}
    for(let i=0;i+3<run.length;i+=2){const [u0,v0,u1,v1]=run.slice(i,i+4);axis.forEach((u,k)=>{if(u>=u0-1e-9&&u<=u1+1e-9)out[k]=v0+(v1-v0)*(u-u0)/(u1-u0);});}
  }
  return out;
}
function derive(raw){
  const doc={},dict={b:new Map()},ids={b:0};
  const ref=(kind,value)=>{const k=JSON.stringify(value);if(!dict[kind].has(k))dict[kind].set(k,{id:kind+(++ids[kind]),value});return dict[kind].get(k).id;};
  const round6=m=>m.map(v=>Math.round(v*1e6)/1e6);
  for(const [sex,s] of Object.entries(raw.sexes)){
    doc[sex]={};
    for(const [view,rows] of Object.entries(s.views)){
      const idle=rows[0],body=columnStats(rows,'body'),collar=columnStats(rows,'collar'),toBox=round6(idle.toBox),c=corridorStats(rows);
      const v={
        frame:{toViewBox:toBox,pxPerUnit280:Math.round(Math.hypot(toBox[0],toBox[1])*5*1e4)/1e4,pose:'idle/0',note:'head-native -> viewBox (32x62 units, 5 px per unit at 280 px)'},
        envelope:{...span(body.min,'x0'),step:STEP,by:argminRuns(rows,'body',body.min)},
        collar:{idle:span(idle.collar,'x0'),min:span(collar.min,'x0'),max:span(collar.max,'x0'),step:STEP},
        corridor:{idle:span(c.idle,'y0'),always:span(c.always,'y0'),ever:span(c.ever,'y0'),step:STEP,note:'[left, right] x of the neck painting per row; it runs on under the collar'},
        collarRows:collarRows(rows,view)
      };
      if(view==='right'){const n=napeStats(rows);v.nape={idle:span(n.idle,'y0'),min:span(n.min,'y0'),max:span(n.max,'y0'),step:STEP,note:'x of the neck\'s back outline per row (the avatar faces +x)'};}
      // Per pose (front: the envelope's own polylines, so a split or another
      // top's per-pose outlines, measured with --av, can be set against it
      // pose by pose): the head frame, the torso frame and the body outline.
      if(view==='front'){v.poses={};for(const r of rows){const e={toViewBox:round6(r.toBox),torsoToViewBox:round6(r.torsoToBox),body:ref('b',encode(r.body,XS))};if(r.hands)e.raisedHands=true;v.poses[r.id]=e;}}
      doc[sex][view]=v;
    }
  }
  const outlines={};for(const {id,value} of dict.b.values())outlines[id]=value;
  return{views:doc,outlines};
}

// ------------------------------------------------------------------ margins
// The lower boundary of a clip path (its vertices below y 20), through a warp.
function clipLine(d,warp){
  const pts=[];let x=0,y=0;
  for(const [,c,a] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)){const v=a.trim().split(/[ ,]+/).filter(Boolean).map(Number);
    if(c==='M'||c==='L'){x=v[0];y=v[1];}else if(c==='H')x=v[0];else if(c==='V')y=v[0];else continue;pts.push([x,y]);}
  return pts.filter(p=>p[1]>20).map(p=>apply(warp,p)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
function lineAt(line,x){for(let i=1;i<line.length;i++){const [a,b]=[line[i-1],line[i]];if(x>=a[0]&&x<=b[0])return b[0]===a[0]?Math.max(a[1],b[1]):a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return null;}
// bowFace()'s body anchoring of the boundary at x (1 outside the jaw, 0 over it).
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const anchoring=(jaw,x)=>x<jaw[1]?1-smooth(jaw[0],jaw[1],x):smooth(jaw[2],jaw[3],x);
// Head-native x of the body's neck columns (torso x 14 and 18) in one pose.
function neckColumns(pose){const t2h=multiply(invert(pose.toBox),pose.torsoToBox);return BOB2026.neckColumns.map(t=>apply(t2h,[t,28])[0]);}
// An outline at x on one side of the neck columns [a, b], read only from grid
// columns on that side: linear between two of them; between the last one
// and the column edge, extrapolated from the two nearest (never across it).
function outsideAt(values,x,[a,b]){
  const f=(x-XR[0])/STEP,v=i=>i>=0&&i<values.length&&defined(values[i])?values[i]:null;let i;
  if(x<=a)i=Math.min(Math.floor(f+1e-9),Math.floor((a-XR[0])/STEP+1e-9)-1);
  else if(x>=b)i=Math.max(Math.floor(f+1e-9),Math.ceil((b-XR[0])/STEP-1e-9));
  else return null;
  const t=f-i,p=v(i),q=v(i+1);if(Math.abs(t)<1e-9)return p;if(Math.abs(t-1)<1e-9)return q;return p===null||q===null?null:p+(q-p)*t;
}
const better=(best,m,x)=>!best||m<best.margin-1e-12||(Math.abs(m-best.margin)<1e-12&&x<best.x);
// The 2026-10-08 reading on the grid: smallest (collar outline - boundary)
// outside the body's neck columns, at grid columns, the boundary's vertices
// and both column edges.
function marginColumns(pose){
  if(!pose.clip)return null;const line=clipLine(pose.clip.d,pose.clip.warp),cols=neckColumns(pose);let best=null;
  for(const x of [...XS,...line.map(p=>p[0]),...cols]){if(x<XR[0]||x>XR[1]||x>cols[0]&&x<cols[1])continue;
    const c=outsideAt(pose.collar,x,cols),l=lineAt(line,x);if(!defined(c)||!defined(l))continue;if(better(best,c-l,x))best={margin:c-l,x};}
  return best&&{...best,cols};
}
// The front layer over the collar/shoulders: smallest (body outline -
// boundary) where bowFace() anchors the boundary fully to the body (outside
// the JAW blend); keep(x) narrows the columns (the hair reading: where the
// layer draws hair just above it, kindAt).
function marginHair(pose,jaw,keep=()=>true){
  if(!pose.clip)return null;const line=clipLine(pose.clip.d,pose.clip.warp);let best=null;
  for(const x of [...XS,...line.map(p=>p[0]),jaw[0],jaw[3]]){if(x<XR[0]||x>XR[1]||anchoring(jaw,x)<1||!keep(x))continue;
    const b=interpGrid(pose.body,x),l=lineAt(line,x);if(!defined(b)||!defined(l))continue;if(better(best,b-l,x))best={margin:b-l,x};}
  return best;
}
// Runs [x from, x to] of grid columns in EDGE_X of one kind (kindAt), where keep(x).
function kindRuns(pose,kind,keep=()=>true){
  const runs=[];if(!pose.edge)return runs;
  XS.forEach(x=>{if(x<EDGE_X[0]||x>EDGE_X[1]||!keep(x)||kindAt(pose,x)!==kind)return;const last=runs[runs.length-1];if(last&&r2(last[1]+STEP)===x)last[1]=x;else runs.push([x,x]);});
  return runs;
}
const KIND={s:'face skin',h:'hair',m:'mixed (skin and hair)','-':'nothing'};
function bobCheck(raw,jaw){
  const rows=raw.sexes.f?.views.front;if(!rows||!rows[0].clip)return null;
  // peak: every pose at the deepest bow; peak0: those at time 0, the poses
  // the 2026-10-08 measurement was taken on (the two readings of it use only these).
  const deepest=Math.min(...rows.map(r=>r.clip.warp[3])),peak=rows.filter(r=>Math.abs(r.clip.warp[3]-deepest)<1e-9),peak0=peak.filter(r=>!r.id.includes('@breath'));
  const lowest=(list,fn)=>{let best=null;for(const r of list){const m=fn(r);if(m&&(!best||m.margin<best.margin-1e-12))best={...m,pose:r.id};}return best;};
  const out=m=>m?{pose:m.pose,margin:r2(m.margin),x:r2(m.x)}:null;
  const near=(m,want)=>Boolean(m)&&Math.abs(r2(m.margin)-want)<=BOB.tolerance+1e-9;
  // method2026: the in-page port's results (viewBox point -> head-native x).
  const m26=r=>r.bob2026?{margin:r.bob2026.margin,x:apply(invert(r.toBox),r.bob2026.at)[0]}:null;
  const nods=rows.filter(r=>r.id.startsWith('nod/'));
  const method={idle:out(lowest([rows[0]],m26)),nodPeak:out(lowest(peak0,m26)),nod:nods.map(r=>r.bob2026?r2(r.bob2026.margin):null),scale:BOB2026.scale};
  const grid={idle:out(lowest([rows[0]],marginColumns)),nodPeak:out(lowest(peak0,marginColumns))};
  // At the nod peak, beside the right column edge: the last column inside
  // (collar read there) and the first column outside.
  const P=rows.find(r=>r.id===grid.nodPeak.pose),cols=neckColumns(P),line=clipLine(P.clip.d,P.clip.warp);
  const at=(x,inside)=>{const c=inside?interpGrid(P.collar,x):outsideAt(P.collar,x,cols),l=lineAt(line,x);return{x:r2(x),collar:r2(c),boundary:r2(l),margin:r2(c-l)};};
  const xin=r2(Math.floor((cols[1]-XR[0])/STEP+1e-9)*STEP+XR[0]),xout=r2(Math.ceil((cols[1]-XR[0])/STEP-1e-9)*STEP+XR[0]);
  // How much the value leans on where the edge is: the same reading with the
  // right column edge moved by dx (negative = into the neck columns).
  const shift=dx=>{const c=[cols[0],cols[1]+dx];return[dx,r2(outsideAt(P.collar,c[1],c)-lineAt(line,c[1]))];};
  const corner={pose:P.id,edge:r2(cols[1]),lastInside:at(xin,true),atEdge:at(cols[1],false),firstOutside:at(xout,false),anchoring:Math.round(anchoring(jaw,cols[1])*1e3)/1e3,drawn:KIND[kindAt(P,cols[1])],edgeShift:[-.03,-.02,-.01,.01,.02,.03].map(shift)};
  // Rule 5: the boundary outside the JAW blend over the body outline, every front pose.
  const rule5={idle:out(lowest([rows[0]],r=>marginHair(r,jaw))),nodPeak:out(lowest(peak,r=>marginHair(r,jaw))),lowestFrontPose:out(lowest(rows,r=>marginHair(r,jaw)))};
  // The same where the layer draws hair just above the boundary (the poses whose drawing was sampled: idle/0, nod at time 0).
  const isHair=r=>x=>kindAt(r,x)==='h',outside=x=>anchoring(jaw,x)>=1;
  const hair={idle:out(lowest([rows[0]],r=>marginHair(r,jaw,isHair(r)))),nodPeak:out(lowest(peak0,r=>marginHair(r,jaw,isHair(r)))),
    skinAtNodPeak:kindRuns(P,'s',outside),skinAtIdle:kindRuns(rows[0],'s',outside)};
  const status={
    method2026:near(method.idle,BOB.idle)&&near(method.nodPeak,BOB.nodPeak),
    grid2026:near(grid.idle,BOB.idle)&&near(grid.nodPeak,BOB.nodPeak),
    rule5:Boolean(rule5.lowestFrontPose)&&rule5.lowestFrontPose.margin>=BOB.rule
  };
  return{
    clip:'FRONT_HAIR_CLIP.f of avatar-foundation.js, as bowFace() draws it in each pose',jaw,
    recorded:{...BOB,source:'avatar-foundation.js FRONT_HAIR_CLIP comment (2026-10-08, round 2); rule: 아바타-제작기준.md rule 5'},
    nodPeakPoses:peak.map(r=>r.id),faceScale:Math.round(deepest*1e4)/1e4,
    neckColumns:{torso:BOB2026.neckColumns,head:cols.map(r2),note:'the body\'s neck columns of the 2026-10-08 measurement; the shirt\'s collar point steps up at the right edge'},
    method2026:{...method,reading:'the 2026-10-08 script ported unchanged (pageLib bob2026): torso part only, '+BOB2026.scale+' px per viewBox unit, boundary sampled at tenths of its segments, neck columns skipped; idle/0 and the time-0 nod poses, as in 2026-10-08'},
    grid2026:{...grid,reading:'the same reading on the H1 .05 grid: collar outline - boundary outside the neck columns, at grid columns, boundary vertices and the column edges (collar never read across an edge); time-0 poses'},
    corner:{...corner,note:'the nod-peak minimum of the 2026-10-08 reading sits on this edge, one-sided: the collar outline steps up there; drawn: what the front layer draws just above the boundary there (sampled on the render)'},
    rule5:{...rule5,reading:'the boundary outside the whole JAW blend (anchoring 1: it stays on the body at every bow depth) over the body outline (collar, sleeves, arms), every front pose (gestures at time 0 and at the breathing peak); rule 5 asks >= '+BOB.rule},
    hair:{...hair,reading:'the rule-5 reading only where the front layer draws hair just above the boundary (sampled on the render, idle/0 and the time-0 nod poses; skin: r >= 170, g/r > .70, b/g > .80); skinAt*: columns outside the JAW blend where it draws face skin there instead (the bowed face slides down over the boundary)'},
    status,pass:status.method2026&&status.grid2026&&status.rule5
  };
}

// ------------------------------------------------------------------- output
// JSON with arrays of numbers (and of number pairs) kept on one line.
function format(value,indent=''){
  const leaf=v=>v===null||typeof v!=='object',flat=v=>Array.isArray(v)&&v.every(w=>leaf(w)||Array.isArray(w)&&w.every(leaf));
  if(leaf(value)||flat(value))return JSON.stringify(value);
  const next=indent+' ',items=Array.isArray(value)?value.map(v=>next+format(v,next)):Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>next+JSON.stringify(k)+':'+format(v,next));
  return Array.isArray(value)?'[\n'+items.join(',\n')+'\n'+indent+']':'{\n'+items.join(',\n')+'\n'+indent+'}';
}
function documentOf(raw,opts){
  const root=opts.root||ROOT,jaw=runtimeJaw(root),breath=runtimeBreath(root),{views,outlines}=derive(raw);
  return{
    about:'Head frame of the foundation (기준 캐릭터) runtime, measured by tools/hair/measure-head-frame.cjs (stage 3, H1). Generated; do not edit. Read by the hair conversion (H2) and the hair checks (H4).',
    units:'head-native: the head painting\'s 32x40 frame (user space of FRONT_HAIR_CLIP and HEAD_NECK_CUT), the front view before the bow warp; y down; the head\'s size differs per view (VIEW_HEAD), so 1 unit = <sex>.<view>.frame.pxPerUnit280 px at 280 px (front 4.676; m right 5.359, m back 5.658, f right 4.676, f back 5.022)',
    grid:{step:STEP,precision:1/PREC,x:XR,y:YR,alphaEdge:'0.5 (128/255)'},
    render:{url:'index.html?demo=1&avatar=foundation',size:SIZE,scale:SCALE,browser:raw.browser,args:H.RASTER_ARGS.join(' '),handMask:'any alpha of the raised hands layer hides the body there',paint:'fresh: the runtime paint pool (QPFoundationSkin) is emptied before every pose',rays:'steps of at most half a pixel with a 3x3 maximum test, read every .005 where the edge may be'},
    inputs:inputs(root),
    poses:{order:poses('front',breath).map(p=>p.id),breathPeak:breath,note:'the same list in every view (direction = the view); actions are tools/foundation-matrix.cjs actionState (time k*.2, seated breathing offset removed); idle/breath is idle at the standing breath\'s peak (time pi/rate); gestures at progress k/36, at time 0 (<gesture>/<k>) and at the breath\'s peak (<gesture>@breath/<k>)'},
    outfit:Object.fromEntries(Object.entries(raw.sexes).map(([sex,s])=>[sex,{av:s.av,...s.worn}])),
    ...views,
    outlines:{note:'the front poses\' body outlines (keys in front.poses): runs of [x,y,x,y,...], the top edge per .05 column (null between runs); Douglas-Peucker within '+RDP+' of the measured value, vertices rounded to .01, so linear interpolation gives every grid value within .01 (the products above are exact to .01). The other views and kinds per pose (collar, arms, neck): --raw <file>',...outlines},
    bob:bobCheck(raw,jaw)
  };
}
// Every per-pose outline decodes back to its grid values within RDP + .005.
function selfCheck(doc,raw){
  let worst=0;
  for(const [sex,s] of Object.entries(raw.sexes))for(const r of s.views.front||[]){
    const e=doc[sex].front.poses[r.id],got=decode(doc.outlines[e.body],XS);
    r.body.forEach((v,i)=>{if(defined(v)!==defined(got[i]))throw Error('outline gap mismatch '+sex+' front '+r.id);if(defined(v))worst=Math.max(worst,Math.abs(v-got[i]));});
  }
  if(worst>RDP+1/PREC/2+1e-6)throw Error('an encoded outline is off by '+worst);return worst;
}

// ------------------------------------------------------------------- images
const COLOR={frame:'#4d5866',corridor:'#1f9d4a',collar:'#e07800',envelope:'#d6262b',pose:'#ff4f9a',nape:'#7b3fd0',clip:'#1f5fff',columns:'#6b5a8e',m2026:'#000',hair:'#0b6e75',skin:'#e600e6',hairOnly:'#b8860b'};
async function overlays(doc,raw,opts){
  const report={errors:[],blocked:[]},server=await H.serve(H.fsTree(opts.root||ROOT)),browser=await H.launch({args:H.RASTER_ARGS});
  const size=SIZE,box=[size*32/56,size*62/56],vw=Math.ceil(box[0]*1.6),vh=Math.ceil(box[1]*1.3),left=Math.round((vw-box[0])/2),top=Math.round(box[1]*.15),files=[];
  fs.mkdirSync(opts.images,{recursive:true});
  const runsOf=(axis,vals)=>{const out=[];let cur=[];vals.forEach((v,i)=>{if(!defined(v)){if(cur.length)out.push(cur);cur=[];}else cur.push([axis[i],v]);});if(cur.length)out.push(cur);return out;};
  const axisFrom=(a0,n)=>Array.from({length:n},(_,i)=>r2(a0+i*STEP)),cols=sp=>sp.x0===null?[]:runsOf(axisFrom(sp.x0,sp.values.length),sp.values);
  try{
    const {page,context}=await openRuntime(browser,server.base,report,{width:vw,height:vh},4);
    await page.evaluate(pageLib,{vw,vh,left,top});
    const names={front:'앞',right:'오른쪽(옆)',back:'뒤'};
    for(const sex of Object.keys(raw.sexes)){
      await page.evaluate(spec=>window.__hf.mount(spec),{av:raw.sexes[sex].av,size});
      for(const view of Object.keys(raw.sexes[sex].views)){
        const shots=[['idle/0','대기']];if(sex==='f'&&view==='front'&&doc.bob)shots.push([doc.bob.grid2026.nodPeak.pose,'고개 인사 가장 숙인 순간']);
        for(const [poseId,label] of shots){
          const pose=raw.sexes[sex].views[view].find(r=>r.id===poseId),info=await page.evaluate(s=>window.__hf.pose(s),pose.state),V=doc[sex][view];
          const P=q=>apply(info.toPage,q),lines=[],labels=[],w=.5;
          // head frame: the 32x40 painting and a 4-unit grid
          lines.push({pts:[[0,0],[32,0],[32,40],[0,40],[0,0]].map(P),color:COLOR.frame,width:w,dash:'2 1.2'});
          for(let x=4;x<32;x+=4)lines.push({pts:[[x,0],[x,40]].map(P),color:COLOR.frame,width:.25,opacity:.4});
          for(let y=4;y<40;y+=4)lines.push({pts:[[0,y],[32,y]].map(P),color:COLOR.frame,width:.25,opacity:.4});
          for(let x=0;x<=32;x+=8){const q=P([x,-.7]);labels.push({x:q[0],y:q[1],text:String(x),size:4,anchor:'middle',color:COLOR.frame,halo:'#fff'});}
          for(let y=8;y<=40;y+=8){const q=P([-.5,y+.5]);labels.push({x:q[0],y:q[1],text:String(y),size:4,anchor:'end',color:COLOR.frame,halo:'#fff'});}
          // neck corridor: always (filled), ever (outline)
          const band=sp=>{if(sp.y0===null)return[];const ys=axisFrom(sp.y0,sp.values.length),L=[],R=[];sp.values.forEach((v,i)=>{if(v){L.push([v[0],ys[i]]);R.push([v[1],ys[i]]);}});return[...L,...R.reverse()];};
          lines.push({pts:band(V.corridor.always).map(P),fill:COLOR.corridor,opacity:.3});
          lines.push({pts:[...band(V.corridor.ever),band(V.corridor.ever)[0]].filter(Boolean).map(P),color:COLOR.corridor,width:w*.8});
          // this pose's body outline (dashed), the collar min (orange), the envelope (red)
          for(const run of runsOf(XS,pose.body))lines.push({pts:run.map(P),color:COLOR.pose,width:w*.8,dash:'1 .7'});
          for(const run of cols(V.collar.min))lines.push({pts:run.map(P),color:COLOR.collar,width:w});
          for(const run of cols(V.envelope))lines.push({pts:run.map(P),color:COLOR.envelope,width:w*1.3});
          if(V.nape)for(const [sp,dash] of [[V.nape.min,''],[V.nape.max,'1 .6']]){if(sp.y0===null)continue;for(const run of runsOf(axisFrom(sp.y0,sp.values.length),sp.values))lines.push({pts:run.map(([y,x])=>P([x,y])),color:COLOR.nape,width:w,dash});}
          // collar rows: where the collar meets the neck (min solid, max dashed)
          for(const [name,row] of Object.entries(V.collarRows)){if(!row?.idle)continue;const x=row.idle.x;
            for(const [y,dash] of [[row.min,''],[row.max,'.8 .5']])lines.push({pts:[[x-1,y],[x+1,y]].map(P),color:COLOR.collar,width:w*1.8,dash});
            const q=P([x+(name==='left'||name==='nape'?-1.2:name==='centre'?0:1.2),row.max+1.6]);labels.push({x:q[0],y:q[1],text:{left:'왼',right:'오른',centre:'가운데',nape:'목덜미',throat:'목 앞'}[name]+' '+row.min.toFixed(2),size:3.2,anchor:name==='left'||name==='nape'?'end':name==='centre'?'middle':'start',color:'#8a4500',halo:'#fff'});}
          // the bob's hair boundary, the body's neck columns (2026-10-08) and the two smallest margins
          const notes=[];
          if(pose.clip){const line=clipLine(pose.clip.d,pose.clip.warp).filter(p=>p[0]>=-1&&p[0]<=33);lines.push({pts:line.map(P),color:COLOR.clip,width:w*1.1});
            for(const x of neckColumns(pose))lines.push({pts:[[x,25.5],[x,30.5]].map(P),color:COLOR.columns,width:w*.7,dash:'.8 .5'});
            const mc=marginColumns(pose),mh=marginHair(pose,doc.bob.jaw),cy=x=>outsideAt(pose.collar,x,mc.cols);
            lines.push({pts:[[mc.x,lineAt(line,mc.x)],[mc.x,cy(mc.x)]].map(P),color:COLOR.m2026,width:w*1.2});
            lines.push({pts:[[mh.x,lineAt(line,mh.x)],[mh.x,interpGrid(pose.body,mh.x)]].map(P),color:COLOR.hair,width:w*1.2});
            notes.push([COLOR.m2026,'2026-10-08 방식 최소 여유 '+mc.margin.toFixed(2)+' (x '+mc.x.toFixed(2)+'; 목 기둥 밖, 옷깃 기준)'],[COLOR.hair,'규칙 5 여유(턱 블렌드 밖 경계, 몸 윤곽) '+mh.margin.toFixed(2)+' (x '+mh.x.toFixed(2)+')']);
            // where the front layer draws face skin just above the boundary (edgeKinds), and the hair-only margin
            if(pose.edge){const lift=x=>[x,lineAt(line,x)-.35];
              for(const [a,b] of kindRuns(pose,'s'))lines.push({pts:(a===b?[a-.025,b+.025]:XS.filter(x=>x>=a&&x<=b)).map(lift).map(P),color:COLOR.skin,width:w*1.6});
              const hh=marginHair(pose,doc.bob.jaw,x=>kindAt(pose,x)==='h');
              if(hh){lines.push({pts:[[hh.x,lineAt(line,hh.x)],[hh.x,interpGrid(pose.body,hh.x)]].map(P),color:COLOR.hairOnly,width:w*1.2});
                notes.push([COLOR.skin,'경계 바로 위가 얼굴 피부인 열 (렌더에서 읽음)'],[COLOR.hairOnly,'머리카락이 그려진 열만: 여유 '+hh.margin.toFixed(2)+' (x '+hh.x.toFixed(2)+')']);}}}
          const rect=roi(info.toPage,[-5,37],[-4.5,46],vw,vh,1),legend=[
            [COLOR.frame,'머리 틀 32×40 (머리 단위, 칸 4)'],[COLOR.corridor,'목 통로 (면: 모든 자세, 선: 한 자세라도)'],[COLOR.collar,'옷깃 선(모든 자세 최소) · 목과 만나는 줄'],
            [COLOR.envelope,'옷깃·어깨 포락선 (모든 자세 최소)'],[COLOR.pose,'이 자세의 몸 윤곽'],...(V.nape?[[COLOR.nape,'뒷목 윤곽 (실선 최소 · 점선 최대)']]:[]),
            ...(pose.clip?[[COLOR.clip,'지금 단발 앞머리 경계 (FRONT_HAIR_CLIP)'],[COLOR.columns,'몸의 목 기둥 (몸통 x 14·18, 2026-10-08 측정)'],...notes]:[])];
          const legendY=rect.y+rect.height,legendH=legend.length*5+10;
          lines.push({pts:[[rect.x,legendY],[rect.x+rect.width,legendY],[rect.x+rect.width,legendY+legendH],[rect.x,legendY+legendH]],fill:'#ffffff'});
          labels.push({x:rect.x+3,y:legendY+5.5,text:(sex==='m'?'남 short:1':'여 bob:1')+' · '+names[view]+' · '+label+' ('+poseId+') · 280px 화면 4배',size:4,color:'#111'});
          legend.forEach(([c,t],i)=>{const y=legendY+11+i*5;lines.push({pts:[[rect.x+3,y-1.2],[rect.x+10,y-1.2]],color:c,width:1.3});labels.push({x:rect.x+12,y,text:t,size:3.5,color:'#222'});});
          await page.evaluate(o=>window.__hf.overlay(o),{lines,labels,bg:'#d7dee6'});
          const file=path.join(opts.images,'head-frame-'+sex+'-'+view+(poseId==='idle/0'?'':'-'+poseId.replace('/','-'))+'.png');
          fs.writeFileSync(file,await page.screenshot({clip:{x:rect.x,y:rect.y,width:rect.width,height:Math.min(vh-rect.y,rect.height+legendH)}}));files.push(file);
        }
      }
    }
    await page.evaluate(()=>window.__hf.clear());await context.close();
  }finally{await browser.close();await server.close();}
  if(report.errors.length)throw Error('page errors while drawing the overlays: '+report.errors.join('; '));
  return files;
}

// --------------------------------------------------------------------- main
function summary(doc){
  const out=[];
  for(const sex of ['m','f'])for(const view of VIEWS){const V=doc[sex]?.[view];if(!V)continue;
    const near=V.envelope.values.filter((y,i)=>{const x=r2(V.envelope.x0+i*STEP);return defined(y)&&x>=4&&x<=28&&(x<12.35||x>19.85);});
    const rows=Object.entries(V.collarRows).map(([k,r])=>r?.idle?k+' '+r.idle.y.toFixed(2)+' ['+r.min.toFixed(2)+'..'+r.max.toFixed(2)+']':k+' -').join(', ');
    out.push('  '+sex+' '+view.padEnd(5)+' envelope low '+(near.length?Math.min(...near).toFixed(2):'-')+' (x 4-28 outside the jaw); collar meets neck: '+rows);}
  return out.join('\n');
}
// The bob check, item by item (no single verdict without its reading).
function bobText(b){
  const f=m=>m?m.margin.toFixed(2)+' at x '+m.x.toFixed(2)+(m.pose?' ('+m.pose+')':''):'-',ok=v=>v?'reproduced':'NOT reproduced',c=b.corner;
  return['bob FRONT_HAIR_CLIP margins, head units (recorded 2026-10-08: idle .68, nod peak .40, within .02; rule 5: >= .10):',
    '  2026-10-08 method (its script, ported; torso part only, neck columns torso x 14..18 = head x '+b.neckColumns.head.map(v=>v.toFixed(2)).join('..')+' skipped):',
    '    idle '+f(b.method2026.idle)+', nod peak '+f(b.method2026.nodPeak)+'  -> '+ok(b.status.method2026),
    '  same reading on the H1 grid (collar outline, column edges one-sided):',
    '    idle '+f(b.grid2026.idle)+', nod peak '+f(b.grid2026.nodPeak)+'  -> '+ok(b.status.grid2026),
    '    the nod-peak minimum is on the right column edge x '+c.edge.toFixed(2)+' ('+c.pose+'): last column inside x '+c.lastInside.x.toFixed(2)+' '+c.lastInside.margin.toFixed(2)+', edge '+c.atEdge.margin.toFixed(2)+', first column outside x '+c.firstOutside.x.toFixed(2)+' '+c.firstOutside.margin.toFixed(2),
    '    (the collar point steps up there; the front layer draws '+c.drawn+' just above the boundary there, anchoring '+c.anchoring+': not a hair margin)',
    '    with that edge moved by dx (negative: into the columns): '+c.edgeShift.map(([dx,m])=>(dx>0?'+':'')+dx+' '+m.toFixed(2)+(Math.abs(m-b.recorded.nodPeak)<=b.recorded.tolerance+1e-9?'':' (off)')).join(', '),
    '  rule 5, the boundary over the collar/shoulders outside the whole JAW blend (body outline, every front pose): idle '+f(b.rule5.idle)+', nod peak '+f(b.rule5.nodPeak)+', lowest front pose '+f(b.rule5.lowestFrontPose)+'  -> '+(b.status.rule5?'>= .10':'BELOW .10'),
    '  the same where the front layer draws hair just above the boundary (sampled on the render): idle '+f(b.hair.idle)+', nod peak '+f(b.hair.nodPeak),
    '    face skin there instead, outside the JAW blend: idle '+(b.hair.skinAtIdle.map(r=>r.join('-')).join(' ')||'none')+'; nod peak '+(b.hair.skinAtNodPeak.map(r=>r.join('-')).join(' ')||'none')+' (the bowed face)',
    '  '+(b.pass?'bob check passed: the 2026-10-08 reading reproduces .68 (idle) and .40 (nod peak; that value is the one-sided jaw-corner value above, over face skin, not a hair margin); rule 5 holds':'bob check FAILED (see the items above)')].join('\n');
}
if(require.main===module)(async()=>{
  const a=H.args(),root=a.root?path.resolve(a.root):ROOT;
  const opts={root,sexes:H.list(a.sexes,['m','f']),views:H.list(a.views,VIEWS.slice()),av:a.av?JSON.parse(a.av):undefined,images:a['no-images']||a.check?null:a.images&&a.images!==true?path.resolve(a.images):IMAGES};
  const full=opts.sexes.join()==='m,f'&&opts.views.join()===VIEWS.join()&&!opts.av;
  const file=a.out&&a.out!==true?path.resolve(a.out):full?FIXTURE:null;
  if(!file)throw Error('a subset or --av needs --out <file> (tools/fixtures/head-frame.json holds the full basic-outfit measurement)');
  // --raw <file> keeps the unrounded measurement; --from-raw <file> derives from one (no browser).
  const t0=Date.now(),raw=a['from-raw']?JSON.parse(fs.readFileSync(path.resolve(a['from-raw']),'utf8')):await measure(opts);
  if(a.raw&&a.raw!==true)fs.writeFileSync(path.resolve(a.raw),JSON.stringify(raw));
  if(raw.errors.length)throw Error('page errors: '+raw.errors.join('; '));
  const doc=documentOf(raw,opts),text=format(doc)+'\n',worst=selfCheck(doc,raw),b=doc.bob;
  console.log('head frame ('+Object.keys(raw.sexes).join(',')+' x '+opts.views.join(',')+'):\n'+summary(doc)+'\n  per-pose outlines decode within '+worst.toFixed(4));
  if(b)console.log(bobText(b));
  let failed=Boolean(b&&!b.pass);
  if(a.check){
    const old=fs.existsSync(file)?fs.readFileSync(file,'utf8'):null,same=old===text;
    console.log((same?'byte-identical to ':'DIFFERS from ')+path.relative(root,file)+' ('+Buffer.byteLength(text)+' bytes)');
    if(!same){failed=true;const scratch=path.join(root,'검증/머리틀/head-frame.check.json');fs.mkdirSync(path.dirname(scratch),{recursive:true});fs.writeFileSync(scratch,text);console.log('  this run: '+path.relative(root,scratch));}
  }else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);console.log('wrote '+path.relative(root,file)+' ('+Buffer.byteLength(text)+' bytes)');}
  if(opts.images){const files=await overlays(doc,raw,opts);console.log('overlays:\n  '+files.map(f=>path.relative(root,f)).join('\n  '));}
  console.log('seconds '+Math.round((Date.now()-t0)/1000));
  if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

module.exports={measure,derive,documentOf,format,decode,poses,marginColumns,marginHair,neckColumns,outsideAt,bobCheck,clipLine,lineAt,anchoring,interpGrid,runtimeJaw,runtimeBreath,pageLib,openRuntime,roi,apply,cross,combine,XS,YS,STEP};
