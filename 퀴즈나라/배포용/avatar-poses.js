/* Reversible layered illustration rig. Gestures use a 0..1 progress over
 * 1500ms; climbing uses action:'climb' with the controller's 0..1 phase. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg', rigs = new WeakMap();
  const SKIRTS = new Set(['skirt', 'pleat', 'jean_skirt', 'star_skirt', 'tutu', 'hanbok']);
  let serial = 0;
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function node(name, attrs) {
    const out = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([key, value]) => out.setAttribute(key, value));
    return out;
  }
  function setTransform(group, value) {
    if (group.getAttribute('transform') !== value) group.setAttribute('transform', value);
  }
  function wrap(element, name) {
    const group = node('g', { 'data-qpx-pose-part': name });
    element.parentNode.insertBefore(group, element);
    group.appendChild(element);
    return group;
  }
  function unwrap(group) {
    if (!group || !group.parentNode) return;
    while (group.firstChild) group.parentNode.insertBefore(group.firstChild, group);
    group.remove();
  }
  function cloneArtwork(children, prefix) {
    const group = node('g'), ids = new Map();
    children.forEach(child => group.appendChild(child.cloneNode(true)));
    group.querySelectorAll('[id]').forEach(element => {
      const original = element.id, replacement = prefix + '-' + ids.size;
      ids.set(original, replacement); element.id = replacement;
    });
    if (ids.size) group.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attribute => {
        let value = attribute.value;
        ids.forEach((replacement, original) => {
          value = value.split('url(#' + original + ')').join('url(#' + replacement + ')');
          if (value === '#' + original) value = '#' + replacement;
        });
        if (value !== attribute.value) element.setAttribute(attribute.name, value);
      });
    });
    return group;
  }
  function armArtwork(rig,side='right') {
    rig.gestureArms ||= new Map();
    if(rig.gestureArms.has(side))return rig.gestureArms.get(side);
    const right=side==='right',index=right?1:0;
    const top=rig.upper.querySelector('[data-qpx-clothes="top"]'),shape=top?.dataset.clothShape||'tank';
    const fit=window.QPClothes?.fitFor?.(shape,top?.dataset.clothSex||rig.svg.dataset.qpxSex)||window.QPClothes?.fits?.[shape]||{sleeveless:true},cloak=shape==='robe';
    const target=window.QPClothes?.targetFor?.('top',shape,top?.dataset.clothSex||rig.svg.dataset.qpxSex)||window.QPClothes?.targets?.top?.[shape]||window.QPClothes?.targets?.top?.default||[8.5,28,15,9.5];
    const point=([x,y])=>{const px=target[0]+target[2]*x;return[right?px:32-px,target[1]+target[3]*y];};
    const native=shape==='hood'?{pivot:[.73,.305],seam:[[.70,.245],[.755,.34],[.78,.51],[.79,.66],[.805,.84]]}:
      shape==='space'?{pivot:[.74,.23],seam:[[.70,.16],[.745,.30],[.745,.50],[.76,.67],[.76,.83]]}:
      {pivot:[.72,.20],seam:[[.70,.14],[.77,.25],[.78,.48],[.79,.57],[.80,Math.min(.94,(fit.cuffs?.[index]?.[1]||.66)+.08)]]};
    const pivot=fit.sleeveless||cloak?[right?19.1:12.9,29.15]:point(native.pivot);
    const carrier=node('g',{'data-qpx-pose-part':side+'-gesture-carrier','data-qpx-gesture-layer':right?'wave':'arm-left','data-qpx-gesture-arm':side,style:'display:none'});
    const arm=node('g',{'data-qpx-pose-part':side+'-gesture-arm'});
    const sourceArms=rig.arms.filter((_,at)=>rig.armSides[at]===right);
    const originals=sourceArms.map(group=>({group,visibility:group.getAttribute('visibility')}));
    let skinSources=sourceArms,wrist=rig.wrists[index];
    if(cloak&&window.QPAvatar){
      // A cloak has no painted sleeves. Reuse this wearer's existing smooth
      // skin arms rather than treating the embroidered cape as a limb.
      const av=JSON.parse(decodeURIComponent(rig.head.dataset.qpxHead));
      const source=new DOMParser().parseFromString(QPAvatar.render({...av,top:'tank:0'},180,2),'image/svg+xml');
      skinSources=[...source.querySelectorAll('.qpx-arm-'+side+',.qpx-arm-front-'+side)].map(element=>{
        element.style.animation='none';element.querySelectorAll('[class^="qpx-hand"]').forEach(hand=>hand.style.animation='none');return{childNodes:[element]};
      });
      const hand=source.querySelector('.qpx-hand-'+side);
      if(hand)wrist=String(hand.dataset.qpxWrist).split(',').map(Number);
    }else if(shape==='space')wrist=point([.91,.68]);
    const cloneTop=()=>{
      const copy=top.cloneNode(true),original=rig.gestureCloth?rig.gestureCloth.originalMask:top.getAttribute('mask');
      if(rig.gestureCloth){if(original===null)copy.removeAttribute('mask');else copy.setAttribute('mask',original);}
      // Direction visibility belongs to the mounted torso, not this cached
      // frontal sleeve, which must also be ready for a later wave or climb.
      copy.removeAttribute('visibility');copy.style.removeProperty('visibility');
      return copy;
    };
    let maskSlot=null,sleeveArtwork=null;
    if(top&&!fit.sleeveless&&!cloak){
      const ps=native.seam.map(point),path='M'+ps[0][0]+' -32L'+ps[0].join(' ')+'Q'+ps[1].join(' ')+' '+ps[2].join(' ')+'Q'+ps[3].join(' ')+' '+ps[4].join(' ')+'H'+(right?64:-32)+'V-32Z';
      const id=rig.defs.dataset.qpxPoseDefs+'-'+side+'-gesture-sleeve',clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(node('path',{d:path}));clip.appendChild(node('circle',{cx:pivot[0],cy:pivot[1],r:.65}));rig.defs.appendChild(clip);
      const sleeve=node('g',{'clip-path':'url(#'+id+')','data-qpx-wave-sleeve':shape});
      sleeve.appendChild(cloneArtwork([cloneTop()],id+'-art'));sleeveArtwork=sleeve;
      if(!rig.gestureCloth){
        const mask=node('mask',{id:rig.defs.dataset.qpxPoseDefs+'-gesture-body',maskUnits:'userSpaceOnUse',x:-32,y:-32,width:96,height:96});
        mask.appendChild(node('rect',{x:-32,y:-32,width:96,height:96,fill:'white'}));rig.defs.appendChild(mask);
        rig.gestureCloth={top,mask,originalMask:top.getAttribute('mask')};
      }
      maskSlot=node('path',{d:path,fill:'white'});rig.gestureCloth.mask.appendChild(maskSlot);
      rig.gestureCloth.mask.appendChild(node('circle',{cx:pivot[0],cy:pivot[1],r:.65,fill:'white'}));
    }
    // Copy the same wearer's skin BEFORE the native sleeve lip. The hand
    // remains in front. Otherwise mounting an idle/walking gesture moves the
    // arm root on top of the cuff even when the unposed picture is correct.
    let sleeveSkinClip=null;
    if(shape==='hood'&&window.QPClothMesh?.supports(top)&&fit.openings){
      const [a,b]=fit.openings[index].map(([x,y])=>[target[0]+target[2]*x,target[1]+target[3]*y]),mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),sign=(-dy*(wrist[0]-mid[0])+dx*(wrist[1]-mid[1]))>0?1:-1,n=[-dy/len*sign,dx/len*sign],t=[dx/len,dy/len];
      const at=(along,depth)=>[mid[0]+t[0]*along+n[0]*depth,mid[1]+t[1]*along+n[1]*depth].join(' '),clip=node('clipPath',{id:rig.defs.dataset.qpxPoseDefs+'-'+side+'-hood-skin',clipPathUnits:'userSpaceOnUse'});
      clip.append(node('path',{d:'M'+at(-40,-.85)+'L'+at(40,-.85)+'L'+at(40,40)+'L'+at(-40,40)+'Z'}));rig.defs.append(clip);sleeveSkinClip='url(#'+clip.id+')';
    }
    const frontHands=[];
    for(const [at,source]of skinSources.entries()){
      const copy=cloneArtwork([...source.childNodes],rig.defs.dataset.qpxPoseDefs+'-'+side+'-gesture-skin-'+at);
      if(sleeveSkinClip)copy.setAttribute('clip-path',sleeveSkinClip);
      const hands=copy.querySelectorAll('.qpx-hand-'+side).length>0;
      copy.setAttribute(hands?'data-qpx-gesture-hand':'data-qpx-gesture-skin',side);
      if(hands)frontHands.push(copy);else arm.appendChild(copy);
    }
    if(sleeveArtwork)arm.appendChild(sleeveArtwork);
    arm.append(...frontHands);
    const armOptions={shape,color:top?.dataset.clothColor,skin:rig.head.dataset.qpxHeadSkin,sex:top?.dataset.clothSex||rig.svg.dataset.qpxSex,side,pivot,wrist,fit};
    const profilePainting=window.QPAvatar?.renderProfileArm?.(armOptions),backPainting=window.QPAvatar?.renderBackArm?.(armOptions);
    if(profilePainting||backPainting){
      const front=node('g',{'data-qpx-gesture-art':'front'});front.append(...arm.childNodes);arm.appendChild(front);
      for(const [view,painting]of[['profile',profilePainting],['back',backPainting]])if(painting){
        const artwork=node('g',{'data-qpx-gesture-art':view,style:'display:none'});artwork.innerHTML=painting;arm.appendChild(artwork);
      }
    }
    const cuff=fit.cuffs?.[index],cuffPoint=cuff?[target[0]+target[2]*cuff[0],target[1]+target[3]*cuff[1]]:pivot;
    const elbow=fit.short?[cuffPoint[0]+(wrist[0]-cuffPoint[0])*.25,cuffPoint[1]+(wrist[1]-cuffPoint[1])*.25]:[pivot[0]+(wrist[0]-pivot[0])*.60,pivot[1]+(wrist[1]-pivot[1])*.60];
    const original=[...arm.childNodes],jointId=rig.defs.dataset.qpxPoseDefs+'-'+side+'-gesture-elbow';
    const forearm=node('g',{'data-qpx-pose-part':side+'-gesture-forearm'});
    for(const [name,y,height,parent]of[['upper',-32,elbow[1]+32,arm],['lower',elbow[1],64-elbow[1],forearm]]){
      const clip=node('clipPath',{id:jointId+'-'+name,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(node('rect',{x:-32,y,width:96,height}));
      clip.appendChild(node('circle',{cx:elbow[0],cy:elbow[1],r:shape==='hanbok'?1.7:shape==='space'?1.4:1.05}));rig.defs.appendChild(clip);
      const window=node('g',{'clip-path':'url(#'+clip.id+')'});window.appendChild(cloneArtwork(original,jointId+'-'+name+'-art'));
      if(name==='upper')arm.replaceChildren(window);else parent.appendChild(window);
    }
    arm.appendChild(forearm);
    const hands=[...arm.querySelectorAll('.qpx-hand-'+side)].map(hand=>wrap(hand,side+'-gesture-hand'));
    carrier.appendChild(arm);
    if(cloak&&top){
      const id=rig.defs.dataset.qpxPoseDefs+'-'+side+'-cloak-overlap',clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(node('circle',{cx:pivot[0],cy:pivot[1],r:1.0}));rig.defs.appendChild(clip);
      const cap=node('g',{'clip-path':'url(#'+id+')',...(profilePainting||backPainting?{'data-qpx-gesture-art':'front'}:{})});cap.appendChild(cloneArtwork([cloneTop()],id+'-art'));carrier.appendChild(cap);
    }
    rig.idle.appendChild(carrier);
    const artwork={carrier,arm,forearm,hands,elbow,pivot,wrist,maskSlot,originals,visible:false};rig.gestureArms.set(side,artwork);return artwork;
  }
  function showArm(rig,side,visible) {
    if(!rig.gestureArms?.has(side)&&!visible)return;
    const artwork=visible?armArtwork(rig,side):rig.gestureArms.get(side);
    if(!visible&&artwork.rearFore){artwork.arm.appendChild(artwork.forearm);artwork.rearFore.remove();artwork.rearFore=null;}
    artwork.visible=visible;artwork.carrier.style.display=visible?'':'none';
    for(const {group,visibility}of artwork.originals){
      if(visible)group.setAttribute('visibility','hidden');else if(visibility===null)group.removeAttribute('visibility');else group.setAttribute('visibility',visibility);
    }
    if(artwork.maskSlot)artwork.maskSlot.setAttribute('fill',visible?'black':'white');
    if(rig.gestureCloth){
      const {top,mask,originalMask}=rig.gestureCloth;
      if([...rig.gestureArms.values()].some(arm=>arm.visible&&arm.maskSlot))top.setAttribute('mask','url(#'+mask.id+')');
      else if(originalMask===null)top.removeAttribute('mask');else top.setAttribute('mask',originalMask);
    }
  }
  function positionArm(rig,arm,upperTransform,shoulder,forearm,wrist=0,offset=0) {
    if(arm.rearFore){arm.arm.appendChild(arm.forearm);arm.rearFore.remove();arm.rearFore=null;}
    arm.meshAngles=[shoulder,forearm];
    delete arm.carrier.dataset.qpxArmDepth;delete arm.carrier.dataset.qpxArmView;
    const variants=[...arm.carrier.querySelectorAll('[data-qpx-gesture-art]')],view=rig.svg.dataset.qpxView||'front';
    const availableView=variants.some(artwork=>artwork.dataset.qpxGestureArt===view)?view:'front';
    for(const artwork of variants)artwork.style.display=artwork.dataset.qpxGestureArt===availableView?'':'none';
    const bodyMatrix=rig.body.getCTM(),idleMatrix=rig.idle.getCTM();
    if(bodyMatrix&&idleMatrix){const m=idleMatrix.inverse().multiply(bodyMatrix);setTransform(arm.carrier,'matrix('+[m.a,m.b,m.c,m.d,m.e,m.f].map(number).join(' ')+')');}
    setTransform(arm.arm,upperTransform+' '+translated(offset,0)+' '+rotated(shoulder,...arm.pivot));
    setTransform(arm.forearm,rotated(forearm,...arm.elbow));
    for(const hand of arm.hands)setTransform(hand,rotated(wrist,...arm.wrist));
  }
  function grabAngles(arm,x,y) {
    const upper=Math.hypot(arm.elbow[0]-arm.pivot[0],arm.elbow[1]-arm.pivot[1]);
    const lower=Math.hypot(arm.wrist[0]-arm.elbow[0],arm.wrist[1]-arm.elbow[1]);
    const dx=x-arm.pivot[0],dy=y-arm.pivot[1],distance=clamp(Math.hypot(dx,dy),Math.abs(upper-lower)+.03,upper+lower-.03);
    const elbow=Math.acos(clamp((distance*distance-upper*upper-lower*lower)/(2*upper*lower),-1,1))*(arm.pivot[0]>16?-1:1);
    const base=Math.atan2(arm.elbow[1]-arm.pivot[1],arm.elbow[0]-arm.pivot[0]);
    const shoulder=Math.atan2(dy,dx)-Math.atan2(lower*Math.sin(elbow),upper+lower*Math.cos(elbow))-base;
    return[shoulder*180/Math.PI,elbow*180/Math.PI];
  }
  function prepare(svg) {
    if(svg?.dataset.qpFoundation)return window.QPAvatarFoundation.prepare(svg);
    if (!svg || typeof svg.querySelector !== 'function') return null;
    if (rigs.has(svg)) return rigs.get(svg);
    const body = svg.querySelector('.qpx-body'), head = svg.querySelector('.qpx-head');
    const idle = svg.querySelector('.qpx-idle');
    if (!body || !head || !idle) return null;
    const uid = 'qppose-' + (++serial), children = Array.from(body.childNodes);
    const bottom = body.querySelector('[data-qpx-clothes="bottom"]');
    const top = body.querySelector('[data-qpx-clothes="top"]');
    const skirt = SKIRTS.has(bottom && bottom.dataset.clothShape);
    const skirtWaist = finite(bottom?.querySelector('svg')?.getAttribute('y'), 36);
    const leggedTop = top?.dataset.clothShape==='overall';
    const shortLegs = bottom?.dataset.clothShape==='shorts'||leggedTop;
    const longTop = ['dress', 'robe'].includes(top && top.dataset.clothShape);
    // A cloth hem has its own bone. Its full artwork never becomes an ankle.
    const waist = skirt || longTop ? 39.25 : 38.5, foot = 44.55;
    const hemStart = 37.75;
    const shoeArtwork = body.querySelector('[data-qpx-shoes]');
    const defs = node('defs', { 'data-qpx-pose-defs': uid });
    function clipped(name, x, y, width, height) {
      const id = uid + '-' + name;
      const clip = node('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(node('rect', { x, y, width, height })); defs.appendChild(clip);
      const movement = node('g', { 'data-qpx-pose-part': name });
      const window = node('g', { 'clip-path': 'url(#' + id + ')' });
      window.appendChild(cloneArtwork(children, uid + '-' + name + '-art'));
      movement.appendChild(window);
      return movement;
    }
    const upper = clipped('upper', -32, -32, 96, waist + 32 + .45);
    // The seated pelvis keeps a round painted silhouette below the hips;
    // a full-width rectangular crop leaves a square trouser edge behind it.
    const upperSeatClip=node('ellipse',{cx:16,cy:waist-.25,rx:5.8,ry:1.7,style:'display:none'});
    defs.querySelector('#'+uid+'-upper').appendChild(upperSeatClip);
    const left = clipped('left-leg', -32, waist-.45, 48, 64-waist+.45);
    const right = clipped('right-leg', 16, waist-.45, 48, 64-waist+.45);
    // Shoes retain their painted proportions while knees bend and legs shorten.
    // Cloning the original nodes also preserves their current dye and detail.
    [upper, left, right].forEach(part => {
      part.querySelectorAll('[data-qpx-shoes]').forEach(shoe => shoe.remove());
      if (skirt) part.querySelectorAll('[data-qpx-clothes="bottom"]').forEach(cloth => cloth.remove());
    });
    [left, right].forEach(part => {
      if(!leggedTop)part.querySelectorAll('[data-qpx-clothes="top"]').forEach(cloth => cloth.remove());
      part.querySelectorAll('.qpx-arms,.qpx-skin-torso').forEach(skin => skin.remove());
    });
    const knee=42;
    function kneeJoint(leg,side){
      const original=leg.firstChild,upperId=uid+'-'+side+'-thigh-clip',lowerId=uid+'-'+side+'-shin-clip';
      const hip=side==='left'?13.75:18.25;
      for(const [id,y,height]of[[upperId,-32,knee+32],[lowerId,knee,64-knee]]){
        const clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
        clip.appendChild(node('rect',{x:-32,y,width:96,height}));
        // A painted, overlapping knee keeps the fabric silhouette round when
        // the joint bends. A straight crop exposes a rectangular cut surface.
        clip.appendChild(node('circle',{cx:hip,cy:knee,r:.5}));defs.appendChild(clip);
      }
      const thigh=node('g',{'clip-path':'url(#'+upperId+')'});thigh.appendChild(cloneArtwork([original],uid+'-'+side+'-thigh-art'));
      const shin=node('g',{'data-qpx-pose-part':side+'-shin'}),skin=node('g',{'clip-path':'url(#'+lowerId+')'});skin.appendChild(original);
      // A shorts hem belongs to the thigh. The rounded knee overlap used to
      // copy it onto the shin as well, producing a second cuff below each leg.
      if(shortLegs)skin.querySelectorAll('[data-qpx-clothes]').forEach(cloth=>cloth.remove());
      shin.appendChild(skin);leg.replaceChildren(thigh,shin);return shin;
    }
    const leftShin=kneeJoint(left,'left'),rightShin=kneeJoint(right,'right');
    const thighs=[left.firstElementChild,right.firstElementChild].map((thigh,index)=>{
      const hip=index?18.25:13.75,id=uid+'-'+(index?'right':'left')+'-seated-thigh';
      const clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      // Fold the painted thigh around a rounded hip and knee. The standing
      // pants' straight waist crop must not become a dangling rear shin.
      clip.appendChild(node('rect',{x:hip-2.35,y:waist,width:4.7,height:knee-waist}));
      clip.appendChild(node('circle',{cx:hip,cy:waist,r:2.35}));
      clip.appendChild(node('circle',{cx:hip,cy:knee,r:1.9}));defs.appendChild(clip);
      return{thigh,original:thigh.getAttribute('clip-path'),seated:'url(#'+id+')'};
    });
    function clothingClip(name, x, y, width, height, artwork) {
      const id = uid + '-' + name + '-clip';
      const clip = node('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
      clip.appendChild(node('rect', { x, y, width, height })); defs.appendChild(clip);
      const group = node('g', { 'data-qpx-pose-part': name });
      const window = node('g', { 'clip-path': 'url(#' + id + ')' });
      window.appendChild(cloneArtwork(artwork, uid + '-' + name + '-art'));
      group.appendChild(window);
      return group;
    }
    const hem = node('g', { 'data-qpx-pose-part': 'hem' });
    if (skirt && bottom) hem.appendChild(cloneArtwork([bottom], uid + '-skirt-art'));
    if (longTop && top) {
      const lowerTop = clothingClip('coat-hem', -32, hemStart, 96, 64 - hemStart, [top]);
      hem.appendChild(lowerTop);
      const coreClipId = uid + '-coat-core';
      const coreClip = node('clipPath', { id: coreClipId, clipPathUnits: 'userSpaceOnUse' });
      coreClip.appendChild(node('rect', { x: -32, y: -32, width: 96, height: hemStart + 32 }));
      defs.appendChild(coreClip);
      upper.querySelectorAll('[data-qpx-clothes="top"]').forEach(cloth => {
        const core = wrap(cloth, 'coat-core'); core.setAttribute('clip-path', 'url(#' + coreClipId + ')');
      });
    }
    if(leggedTop){
      // Overalls have two trouser legs, not a skirt-like fixed hem. Keep the
      // bib/pelvis on the torso and let each complete rolled cuff move once.
      const id=uid+'-overall-pelvis',clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(node('path',{d:'M-32 -32H64V37.25H18.25Q17 37.3 16 38.3Q15 37.3 13.75 37.25H-32Z'}));defs.appendChild(clip);
      upper.querySelectorAll('[data-qpx-clothes="top"]').forEach(cloth=>wrap(cloth,'overall-core').setAttribute('clip-path','url(#'+id+')'));
    }
    function footArtwork(side){
      if(!shoeArtwork)return null;
      const group=node('g',{'data-qpx-pose-part':side+'-foot','data-qps-foot-host':side,'data-qps-shape':shoeArtwork.dataset.qpxShoes,'data-qps-foot-color':shoeArtwork.dataset.qpxShoeColor,'data-qps-skin':head.dataset.qpxHeadSkin});
      const painting=window.QPShoes?.renderFoot(shoeArtwork.dataset.qpxShoes,shoeArtwork.dataset.qpxShoeColor,side,head.dataset.qpxHeadSkin);
      if(painting)group.innerHTML=painting;
      else group.appendChild(clothingClip(side+'-foot-fallback',side==='left'?-32:16,-32,48,96,[shoeArtwork]));
      return group;
    }
    const leftFoot=footArtwork('left'),rightFoot=footArtwork('right');
    const handNodes = [upper.querySelector('.qpx-hand-left'), upper.querySelector('.qpx-hand-right')];
    const wrists = handNodes.map((hand, index) => {
      const encoded = hand && hand.dataset.qpxWrist ? String(hand.dataset.qpxWrist).split(',').map(Number) : null;
      const x = hand && finite(hand.dataset.qpxWristX, NaN), y = hand && finite(hand.dataset.qpxWristY, NaN);
      return [Number.isFinite(x) ? x : encoded && Number.isFinite(encoded[0]) ? encoded[0] : index ? 20.8 : 11.2,
        Number.isFinite(y) ? y : encoded && Number.isFinite(encoded[1]) ? encoded[1] : 36.4];
    });
    const hands = handNodes.map((hand, index) => hand ? wrap(hand, index ? 'right-hand' : 'left-hand') : null);
    const armNodes = [...upper.querySelectorAll('[data-qpx-arm-side]')];
    const armSides=armNodes.map(arm=>arm.dataset.qpxArmSide==='right');
    const cuffs = armNodes.map((arm,index) => {
      const point=String(arm?.dataset.qpxCuff||'').split(',').map(Number);
      return point.length===2&&point.every(Number.isFinite)?point:[index?21:11,34];
    });
    const arms = armNodes.map((arm,index)=>arm?wrap(arm,(armSides[index]?'right':'left')+'-arm'+(arm.classList.contains('qpx-arm-front-left')||arm.classList.contains('qpx-arm-front-right')?'-front':'')):null);
    // The pose owns a connected wrist; the idle hand's independent one-pixel
    // translation must not pull it away from the painted cuff during movement.
    handNodes.forEach(hand => { if (hand) hand.style.animation = 'none'; });
    armNodes.forEach(arm => { if (arm) arm.style.animation = 'none'; });
    // One continuous skin silhouette follows each hip/knee/ankle. Repeated
    // source-leg crops exposed straight corners and duplicate calf outlines.
    const skin= head.dataset.qpxHeadSkin||'#ffe2cc',skinTone=(factor)=>'#'+skin.slice(1).match(/../g).map(v=>Math.round(Math.min(255,parseInt(v,16)*factor)).toString(16).padStart(2,'0')).join('');
    const coveredLegs=['jeans','track','legging','cargo'].includes(bottom?.dataset.clothShape);
    const skinLegs=['left','right'].map((side,index)=>{
      const id=uid+'-'+side+'-leg-pigment',gradient=node('linearGradient',{id,x1:'0',x2:'1',y1:'0',y2:'0'});
      for(const [offset,color]of [[0,skinTone(.85)],[.42,skin],[.7,skinTone(1.08)],[1,skinTone(.96)]])gradient.appendChild(node('stop',{offset,'stop-color':color}));defs.appendChild(gradient);
      const group=node('g',{'data-qpx-continuous-leg':side}),outline=node('path',{fill:'url(#'+id+')',stroke:skinTone(.77),'stroke-width':.13,'stroke-linejoin':'round'}),paint=node('path',{fill:'none',stroke:'none'});group.append(outline,paint);return{group,outline,paint,side,index};
    });
    for(const part of [left,right,upper])part.querySelectorAll('.qpx-leg-left,.qpx-leg-right').forEach(original=>original.style.opacity='0');
    const rearFeet=['left','right'].map(side=>{const g=node('g',{'data-qps-rear-owner':side});if(shoeArtwork)g.innerHTML=window.QPShoes?.renderRearFoot?.(shoeArtwork.dataset.qpxShoes,shoeArtwork.dataset.qpxShoeColor,side)||'';return g;});
    body.replaceChildren(...rearFeet,...skinLegs.map(s=>s.group),left, right, upper, hem);
    if (leftFoot) body.appendChild(leftFoot);
    if (rightFoot) body.appendChild(rightFoot);
    svg.insertBefore(defs, svg.firstChild);
    const headPose = wrap(head, 'head');
    const backHair = idle.querySelector('.qpx-back-hair');
    const backHairPose = backHair ? wrap(backHair, 'back-hair') : null;
    const facing = wrap(idle, 'facing');
    const rig = { svg, body, head, idle, children, defs, upper, left, right, hands, wrists,arms,cuffs,armSides,
      headPose, backHairPose, facing, waist, skirtWaist, foot, skirt, longTop, leggedTop, hem, leftFoot, rightFoot,skinLegs,coveredLegs,rearFeet,
      leftShin,rightShin,knee,thighs,legClips:['left','right'].map(side=>defs.querySelector('#'+uid+'-'+side+'-leg rect')),upperClip:defs.querySelector('#'+uid+'-upper rect'),upperSeatClip,lastAction: 'idle', landingAt: 0,gesture:'',gestureStartedAt:0,previousGesture:svg.getAttribute('data-qpx-gesture'), previousPose: svg.getAttribute('data-qpx-pose') };
    rigs.set(svg, rig);
    reset(svg);
    return rig;
  }
  function pixelUnits(element) {
    const matrix = element.getScreenCTM && element.getScreenCTM(), density = window.devicePixelRatio || 1;
    const x = matrix ? Math.hypot(matrix.a, matrix.b) * density : 1;
    const y = matrix ? Math.hypot(matrix.c, matrix.d) * density : 1;
    return [x > 0 ? x : 1, y > 0 ? y : 1];
  }
  function number(value) { return String(Math.round(value * 100000) / 100000); }
  function translated(x, y) { return 'translate(' + number(x) + ' ' + number(y) + ')'; }
  function rotated(angle, x, y) { return 'rotate(' + number(angle) + ' ' + number(x) + ' ' + number(y) + ')'; }
  function connectedLeg(rig,hip,dx,lift,torsoY,lean,bend=1,shoeAngle=0) {
    // Solve two fixed-length bones in the dressed torso's local coordinates.
    // The ankle target stays on the ground for the supporting leg; the whole
    // shoe follows that ankle instead of stretching either painted leg.
    const radians=lean*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
    const px=hip+dx-16,py=rig.foot-lift-rig.waist-torsoY;
    const x=16+c*px+s*py-hip,y=-s*px+c*py;
    const upper=rig.knee-rig.waist,lower=rig.foot-rig.knee;
    const distance=clamp(Math.hypot(x,y),Math.abs(upper-lower)+.00001,upper+lower-.00001);
    const elbow=bend*Math.acos(clamp((distance*distance-upper*upper-lower*lower)/(2*upper*lower),-1,1));
    const shoulder=Math.atan2(-x,y)-Math.atan2(lower*Math.sin(elbow),upper+lower*Math.cos(elbow));
    const a=shoulder*180/Math.PI,b=elbow*180/Math.PI;
    const torso=torsoY||lean?translated(0,torsoY)+' '+rotated(lean,16,rig.waist):'';
    const leg=torso+' '+rotated(a,hip,rig.waist),shin=rotated(b,hip,rig.knee);
    return{leg,shin,foot:leg+' '+shin+' '+rotated(shoeAngle-lean-a-b,hip,rig.foot)};
  }
  function continuousLegs(rig){
    const inverse=rig.body.getCTM()?.inverse();if(!inverse)return;
    const locate=(element,x,y)=>{const p=new DOMPoint(x,y).matrixTransform(inverse.multiply(element.getCTM()));return[p.x,p.y];};
    rig.rearFeet.forEach((group,i)=>{const foot=i?rig.rightFoot:rig.leftFoot;group.style.display=rig.svg.dataset.qpxView==='front'?'':'none';if(foot){const m=inverse.multiply(foot.getCTM());group.setAttribute('transform','matrix('+[m.a,m.b,m.c,m.d,m.e,m.f].map(number).join(' ')+')');}});
    for(const {group,outline,paint,index}of rig.skinLegs){
      group.style.display='';
      const hip=index?18.25:13.75,leg=index?rig.right:rig.left,shin=index?rig.rightShin:rig.leftShin;
      const root=locate(rig.svg.dataset.qpxView==='profile'?leg:rig.upper,hip,rig.waist-.7),knee=locate(leg,hip,rig.knee),ankle=locate(shin,hip,44.55);
      const mid=(a,b)=>a.map((n,i)=>(n+b[i])/2),point=p=>p.map(number).join(' ');
      const profile=rig.svg.dataset.qpxView==='profile',a=rig.coveredLegs?locate(shin,hip,43.9):root,b=knee,c=ankle;
      // A calf tapers into the ankle. A constant-width round-ended stroke
      // leaves a second bare foot below a small shoe mouth.
      const normal=(u,v)=>{const dx=v[0]-u[0],dy=v[1]-u[1],n=Math.hypot(dx,dy)||1;return[dy/n,-dx/n];},n=normal(b,c),u=normal(a,b),offset=(p,n,w)=>point([p[0]+n[0]*w,p[1]+n[1]*w]);
      const r=rig.coveredLegs?.51:1.05,tip=.45,d=rig.coveredLegs?
        'M'+offset(a,n,r)+'L'+offset(c,n,tip)+'Q'+point(c)+' '+offset(c,n,-tip)+'L'+offset(a,n,-r)+'Z':
        'M'+offset(a,u,r)+'Q'+offset(b,u,1.12)+' '+offset(b,n,.98)+'Q'+offset(mid(b,c),n,.84)+' '+offset(c,n,tip)+'Q'+point(c)+' '+offset(c,n,-tip)+'Q'+offset(mid(b,c),n,-.84)+' '+offset(b,n,-.98)+'Q'+offset(b,u,-1.12)+' '+offset(a,u,-r)+'Z';
      outline.setAttribute('d',d);paint.setAttribute('d',d);
    }
  }
  function apply(svg, state) {
    if(svg?.dataset.qpFoundation)return window.QPAvatarFoundation.apply(svg,state);
    const rig = prepare(svg); if (!rig) return false;
    state = state || {};
    const running=state.action==='run';
    if(running)state={...state,action:'walk'};
    const floorSit = state.action === 'floor-sit' || state.action === 'sit' && state.seatMode === 'floor';
    const deskSit = state.action === 'sit' && state.seatMode === 'desk';
    const action = floorSit ? 'sit' : ['walk', 'jump', 'sit', 'climb'].includes(state.action) ? state.action : 'idle';
    const gesture=['wave','nod','happy'].includes(state.gesture)?state.gesture:'';
    const [sx, sy] = pixelUnits(rig.body), [, headSy] = pixelUnits(rig.headPose);
    const illustrated = svg.classList.contains('qp-illustrated-avatar');
    const qx = value => illustrated ? value : Math.round(value * sx) / sx;
    const qy = value => illustrated ? value : Math.round(value * sy) / sy;
    const headY = value => illustrated ? value : Math.round(value * headSy) / headSy;
    const bodyScale=finite(window.QPAvatar?.proportions?.scale,1);
    const bodyVerticalScale=finite(window.QPAvatar?.proportions?.verticalScale,1.35);
    let left = '', right = '', torsoY = 0, lean = 0, headOffset = 0, headX = 0, headLean = 0;
    let hemTransform = '', footLeft = '', footRight = '', handLeft = [0, 0], handRight = [0, 0];
    let handAngleLeft = 0, handAngleRight = 0, walkPose = null,jumpPose=null;
    let armAngleLeft=0,armAngleRight=0;
    let shinLeft='',shinRight='';
    const span = rig.foot - rig.waist;
    const sideView=window.QPAvatarDirection?.atlas.ready&&(['left','right'].includes(state.direction)||
      !['front','back'].includes(state.direction)&&['left','right'].includes(state.facing));
    if (action === 'walk') {
      const phase = illustrated && Number.isFinite(state.phase) ? ((state.phase % 1) + 1) % 1 : Number.isFinite(state.step) ? ((state.step % 8) + 8) % 8 / 8 :
        ((finite(state.phase) % 1) + 1) % 1;
      const stride = illustrated ? Math.sin(phase * Math.PI * 2) : [0, .7, 1, .7, 0, -.7, -1, -.7][Math.floor(phase * 8) % 8];
      const reach = qx(stride * (sideView?(running?3.1:2.35):(running?1.15:.80))), liftL = qy(Math.max(0, stride) * (running?1.45:.95));
      const liftR = qy(Math.max(0, -stride) * (running?1.45:.95));
      walkPose = { reach, liftL, liftR, stride };
      lean = illustrated ? stride * .65 : 0;
      const clearance=Math.abs(reach)+Math.abs(lean*Math.PI/180*span)+.03;
      torsoY=qy(span-Math.sqrt(Math.max(0,span*span-clearance*clearance))+.025*(1-Math.cos(phase*Math.PI*4)));
      headLean = lean * .35;
      armAngleLeft=-stride*(running?15:6);armAngleRight=stride*(running?15:6);
    } else if (action === 'jump') {
      // Physics raises the entire actor. The knees gather continuously through
      // the apex, retaining the clothes' lengths and the native ankle overlap.
      const airborne=state.grounded===true?.25:1,t=clamp((finite(state.vy)+240)/720,0,1);
      const launch=t*t*(3-2*t);jumpPose={launch,airborne};
      const gather=qx((.15+.55*launch)*airborne),lift=qy((.08+1.77*launch)*airborne);
      const l=connectedLeg(rig,13.75,gather,lift,0,0,sideView?1:-1);
      const r=connectedLeg(rig,18.25,sideView?gather:-gather,lift,0,0,1);
      left=l.leg;right=r.leg;shinLeft=l.shin;shinRight=r.shin;footLeft=l.foot;footRight=r.foot;
      armAngleLeft=-(3+7*launch)*airborne;armAngleRight=(3+7*launch)*airborne;
    } else if(action==='climb'){
      const reach=(1+Math.sin(clamp(finite(state.phase),0,1)*Math.PI*6))/2;
      left=rotated(-6-9*reach,13.75,rig.waist);right=rotated(6+9*(1-reach),18.25,rig.waist);
      shinLeft=rotated(-5-7*reach,13.75,rig.knee);shinRight=rotated(5+7*(1-reach),18.25,rig.knee);
      footLeft=left+' '+shinLeft;footRight=right+' '+shinRight;
    } else if (action === 'sit') {
      // Basic sitting gathers the knees under the torso instead of opening
      // them into a wide squat. The feet keep their complete painting and
      // original contact height while both leg joints fold comfortably.
      // The older motion preview keeps its existing crouch unless a seat mode
      // is requested by the classroom controller.
      const sideFloor = floorSit && ['left', 'right'].includes(state.direction);
      const bend = floorSit ? sideFloor ? 105 : 100 : deskSit ? 24 : 60;
      const leftBend = sideFloor ? -bend : bend, rightBend = -bend;
      const leftShinBend = floorSit ? sideFloor ? 150 : -150 : -bend;
      const rightShinBend = floorSit ? sideFloor ? 150 : 150 : bend;
      const radians = degrees => degrees * Math.PI / 180;
      const drop = qy(floorSit ? span - (rig.knee-rig.waist)*Math.cos(radians(leftBend)) -
        (rig.foot-rig.knee)*Math.cos(radians(leftBend+leftShinBend)) :
        (rig.knee-rig.waist)*(1-Math.cos(radians(bend))));
      torsoY = drop;
      headOffset = headY(drop * bodyVerticalScale);
      const gather=floorSit&&!sideFloor ? 1.1 : 0;
      left=translated(gather,drop)+' '+rotated(leftBend,13.75,rig.waist);
      right=translated(-gather,drop)+' '+rotated(rightBend,18.25,rig.waist);
      shinLeft=rotated(leftShinBend,13.75,rig.knee);shinRight=rotated(rightShinBend,18.25,rig.knee);
      footLeft=left+' '+shinLeft;footRight=right+' '+shinRight;
      if (floorSit) {
        footLeft += ' ' + rotated(-(leftBend+leftShinBend),13.75,rig.foot);
        footRight += ' ' + rotated(-(rightBend+rightShinBend),18.25,rig.foot);
      }
      if (rig.skirt || rig.longTop) {
        const anchor = rig.longTop ? 37.75 : rig.skirtWaist;
        hemTransform = translated(0, drop) + ' translate(16 ' + anchor + ') scale(' +
          (deskSit ? '1 .88' : floorSit ? '1.06 .55' : '1.075 .63') + ') translate(-16 ' + (-anchor) + ')';
      }
      handAngleLeft = -5; handAngleRight = 5;
      armAngleLeft=-4;armAngleRight=4;
      if(floorSit){
        armAngleLeft=-10;armAngleRight=10;
        handAngleLeft=6;handAngleRight=-6;
        if(sideFloor){
          lean=4;
          headLean=lean*.35;
        }
      }
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if(gesture!==rig.gesture){rig.gesture=gesture;rig.gestureStartedAt=now;}
    const progress=Number.isFinite(state.gestureProgress)?clamp(state.gestureProgress,0,1):clamp((now-rig.gestureStartedAt)/1500,0,1);
    const ease=value=>value*value*(3-2*value);
    const envelope=ease(clamp(progress/.18,0,1))*ease(clamp((1-progress)/.20,0,1));
    const activeGesture=action==='idle'&&envelope>0?gesture:'';
    if(action==='idle'){
      const breath=(1-Math.cos(now/6400*Math.PI*2))*.2;
      armAngleLeft=-breath;armAngleRight=breath;
      torsoY+=(1-Math.cos(now/6400*Math.PI*2))*.035;
    }
    if(activeGesture==='nod'){
      headLean+=Math.sin(progress*Math.PI*2)*1.6*envelope;
    }
    if(activeGesture==='happy'){
      headLean+=Math.sin(progress*Math.PI*4)*1.8*envelope;
      armAngleLeft-=Math.sin(progress*Math.PI*4)*5*envelope;
      armAngleRight+=Math.sin(progress*Math.PI*4)*5*envelope;
      torsoY+=.08*Math.pow(Math.sin(progress*Math.PI*3),2)*envelope;
    }
    if (rig.lastAction === 'jump' && action !== 'jump' && state.grounded === true) rig.landingAt = now;
    if (action === 'jump' || action === 'sit') rig.landingAt = 0;
    if (rig.landingAt && now - rig.landingAt < 170) {
      const settle = Math.sin((now - rig.landingAt) / 170 * Math.PI) * .42;
      torsoY += settle;
    }
    headX=qx(Math.sin(lean*Math.PI/180)*(rig.waist-28)*bodyScale);
    headOffset=headY((torsoY+(1-Math.cos(lean*Math.PI/180))*(rig.waist-28))*bodyVerticalScale);
    rig.lastAction = action;
    // Preserve the continuous painted seat/crotch above the two hip bones.
    // The round knees articulate below it without exposing the center cut.
    rig.upperClip.setAttribute('height',rig.waist+32+(floorSit?-.55:action==='sit'?1.45:.45));
    rig.upperSeatClip.style.display=floorSit?'':'none';
    for(const part of rig.thighs)part.thigh.setAttribute('clip-path',floorSit?part.seated:part.original);
    for(const clip of rig.legClips){
      const overlap=floorSit?2.35:rig.leggedTop?1.5:.45;
      clip.setAttribute('y',rig.waist-overlap);
      clip.setAttribute('height',64-rig.waist+overlap);
    }
    const upperTransform = torsoY || lean ? translated(0, torsoY) + ' ' + rotated(lean, 16, rig.waist) : '';
    let headTransform = headOffset || headX || headLean ? translated(headX, headOffset) + ' ' + rotated(headLean, 16, 28) : '';
    if (walkPose) {
      const l=connectedLeg(rig,13.75,walkPose.reach,walkPose.liftL,torsoY,lean,sideView?1:-1);
      const r=connectedLeg(rig,18.25,-walkPose.reach,walkPose.liftR,torsoY,lean,1);
      left=l.leg;right=r.leg;shinLeft=l.shin;shinRight=r.shin;footLeft=l.foot;footRight=r.foot;
    }else if(action==='idle'&&torsoY){
      // Breathing and landing lower the connected pelvis while both soles
      // retain their ground contact, instead of sliding the shirt over legs.
      const l=connectedLeg(rig,13.75,0,0,torsoY,lean,sideView?1:-1);
      const r=connectedLeg(rig,18.25,0,0,torsoY,lean,1);
      left=l.leg;right=r.leg;shinLeft=l.shin;shinRight=r.shin;footLeft=l.foot;footRight=r.foot;
    }
    setTransform(rig.left, left); setTransform(rig.right, right);
    setTransform(rig.leftShin,shinLeft);setTransform(rig.rightShin,shinRight);
    setTransform(rig.upper, upperTransform);
    setTransform(rig.hem, hemTransform || upperTransform);
    if (rig.leftFoot) setTransform(rig.leftFoot, footLeft);
    if (rig.rightFoot) setTransform(rig.rightFoot, footRight);
    // Match the real dressed neck, including the male torso's horizontal
    // proportion, without scaling the original head painting.
    const upperMatrix=rig.upper.getCTM(),headParentMatrix=rig.headPose.parentNode?.getCTM();
    if(upperMatrix&&headParentMatrix){
      const neck=headParentMatrix.inverse().multiply(upperMatrix),x=neck.a*16+neck.c*28+neck.e-16,y=neck.b*16+neck.d*28+neck.f-28;
      headTransform=translated(x,y)+' '+rotated(headLean,16,28);
    }
    setTransform(rig.headPose, headTransform);
    if (rig.backHairPose) setTransform(rig.backHairPose, headTransform);
    rig.arms.forEach((arm,index)=>{
      if(arm)setTransform(arm,rotated(rig.armSides[index]?armAngleRight:armAngleLeft,...rig.cuffs[index]));
    });
    rig.hands.forEach((hand, index) => {
      if (hand) setTransform(hand, translated(...(index ? handRight : handLeft)) + ' ' +
        rotated(index ? handAngleRight : handAngleLeft, ...rig.wrists[index]));
    });
    const profile=window.QPAvatarDirection?.apply(svg,{...state,action,seatMode:floorSit?'floor':state.seatMode,gesture:activeGesture},rig)||false;
    const backView=rig.svg.dataset.qpxView==='back'&&typeof window.QPAvatar?.renderBackArm==='function';
    // Seated arms use the same sleeve/skin carrier as walking and greetings.
    // Rotating only the old skin below a fixed cuff put it over the cuff edge.
    const frontArms=!profile&&!backView&&['walk','jump','idle','sit'].includes(action);
    showArm(rig,'right',activeGesture==='wave'||action==='climb'||profile||backView||frontArms);
    showArm(rig,'left',action==='climb'||profile||backView||frontArms);
    if(profile){
      const stride=walkPose?.stride||0;
      const jumpSwing=jumpPose?(4+8*jumpPose.launch)*jumpPose.airborne:0;
      for(const [side,angle]of[['left',action==='jump'?jumpSwing:stride*12],['right',action==='jump'?-jumpSwing:-stride*12]]){
        const arm=rig.gestureArms.get(side),near=side==='right';
        // Both side arms drop from the shoulder, then fold forward toward
        // the lap. Their native left/right slopes differ; normalize those
        // slopes before bending, and let the whole pose mirror for left.
        const nativeAngle=Math.atan2(arm.elbow[1]-arm.pivot[1],arm.elbow[0]-arm.pivot[0])*180/Math.PI;
        const shoulder=floorSit?85-nativeAngle:angle;
        const elbow=floorSit?-55:action==='jump'?(near?7:-7)*(jumpPose?.launch||.25):near?Math.max(0,stride)*5:-Math.max(0,-stride)*5;
        const wrist=floorSit?nativeAngle-90:0;
        positionArm(rig,arm,upperTransform,shoulder,elbow,wrist,(near?16.6:15.6)-arm.pivot[0]);
        arm.carrier.style.opacity=near?'':'0.78';
        // The far arm is behind the complete dressed torso; the near sleeve
        // and wrist move together in front, matching the direction reference.
        if(near)rig.idle.appendChild(arm.carrier);
        else {let bodyRoot=rig.body.closest('[data-qpx-direction-part="body-profile"]');if(bodyRoot){while(bodyRoot.parentNode&&bodyRoot.parentNode!==rig.idle)bodyRoot=bodyRoot.parentNode;rig.idle.insertBefore(arm.carrier,bodyRoot);}}
      }
    }else if(backView){
      for(const [side,shoulder,wrist]of[['left',armAngleLeft,handAngleLeft],['right',armAngleRight,handAngleRight]]){
        const arm=rig.gestureArms.get(side),right=side==='right';
        const nativeAngle=Math.atan2(arm.elbow[1]-arm.pivot[1],arm.elbow[0]-arm.pivot[0])*180/Math.PI;
        positionArm(rig,arm,upperTransform,floorSit?(right?75:105)-nativeAngle:shoulder,
          floorSit?(right?35:-35):0,floorSit?nativeAngle-90:wrist);
        arm.carrier.style.opacity='';
        // A rear view reverses camera depth. The arm swinging forward in
        // character space is hidden by the back; the returning arm is near.
        // Standing/sitting arms join underneath the back shoulder silhouette.
        const depth=(walkPose?.stride||0)*(right?-1:1),near=!floorSit&&depth>.08;
        arm.carrier.dataset.qpxArmDepth=near?'near':'far';
        arm.carrier.dataset.qpxArmView='back';
        let bodyRoot=rig.body;while(bodyRoot.parentNode&&bodyRoot.parentNode!==rig.idle)bodyRoot=bodyRoot.parentNode;
        // Shoulder and upper sleeve stay sewn beneath the back silhouette.
        // Only the returning forearm crosses in front; never pop the entire
        // deltoid on top of the shoulder when depth changes mid-stride.
        rig.idle.insertBefore(arm.carrier,bodyRoot);
        if(near){
          const m=rig.idle.getCTM().inverse().multiply(arm.arm.getCTM()),g=node('g',{'data-qpx-rear-forearm':side,'transform':'matrix('+[m.a,m.b,m.c,m.d,m.e,m.f].map(number).join(' ')+')'});
          g.appendChild(arm.forearm);rig.idle.appendChild(g);arm.rearFore=g;
        }
      }
    }else if(frontArms){
      const stride=walkPose?.stride||0;
      for(const [side,shoulder]of[['left',armAngleLeft],['right',armAngleRight]]){
        const arm=rig.gestureArms.get(side),right=side==='right';
        const elbow=action==='jump'?(right?8:-8)*(jumpPose?.launch||.25):right?Math.max(0,stride)*4:-Math.max(0,-stride)*4;
        positionArm(rig,arm,upperTransform,shoulder,elbow,0);arm.carrier.style.opacity='';rig.idle.appendChild(arm.carrier);
      }
    }else if(rig.gestureArms)for(const arm of rig.gestureArms.values())arm.carrier.style.opacity='';
    if(activeGesture==='wave'){
      const arm=rig.gestureArms.get('right'),swing=Math.sin(progress*Math.PI*8);
      positionArm(rig,arm,upperTransform,(-70+swing*5)*envelope,(-80+swing*8)*envelope,swing*17*envelope);
    }
    if(action==='climb'){
      const reach=(1+Math.sin(clamp(finite(state.phase),0,1)*Math.PI*6))/2;
      for(const [side,amount]of[['right',reach],['left',1-reach]]){
        const arm=rig.gestureArms.get(side),angles=grabAngles(arm,side==='right'?17.15:14.85,23.5+amount*3.2);
        positionArm(rig,arm,upperTransform,...angles,0);
      }
    }
    window.QPClothMesh?.draw(rig);
    continuousLegs(rig);
    const shadow=svg.querySelector('.qpx-contact-shadow');if(shadow)shadow.style.visibility=action==='climb'?'hidden':'';
    const mirror=profile?svg.dataset.qpxViewFacing==='left':state.direction!=='front'&&!activeGesture&&state.facing==='left';
    setTransform(rig.facing, mirror ? 'translate(32 0) scale(-1 1)' : '');
    if(activeGesture)svg.setAttribute('data-qpx-gesture',activeGesture);else svg.removeAttribute('data-qpx-gesture');
    const displayAction = floorSit ? 'floor-sit' : running?'run':action;
    if (svg.getAttribute('data-qpx-pose') !== displayAction) svg.setAttribute('data-qpx-pose', displayAction);
    if (floorSit || deskSit) svg.setAttribute('data-qpx-seat-mode', floorSit ? 'floor' : 'desk');
    else svg.removeAttribute('data-qpx-seat-mode');
    return true;
  }
  function reset(svg) {
    if(svg?.dataset.qpFoundation)return window.QPAvatarFoundation.reset(svg);
    const rig = rigs.get(svg); if (!rig) return false;
    window.QPClothMesh?.reset(rig);
    window.QPAvatarDirection?.reset(svg);
    [rig.upper, rig.left, rig.right, rig.leftShin,rig.rightShin,rig.hem, rig.leftFoot, rig.rightFoot,
      rig.headPose, rig.backHairPose, rig.facing, ...rig.arms, ...rig.hands].forEach(group => {
      if (group) group.removeAttribute('transform');
    });
    svg.setAttribute('data-qpx-pose', 'idle');
    svg.removeAttribute('data-qpx-seat-mode');
    showArm(rig,'right',false);showArm(rig,'left',false);
    const shadow=svg.querySelector('.qpx-contact-shadow');if(shadow)shadow.style.visibility='';
    svg.removeAttribute('data-qpx-gesture');rig.gesture='';rig.gestureStartedAt=0;
    rig.upperClip.setAttribute('height',rig.waist+32+.45);
    rig.upperSeatClip.style.display='none';
    for(const part of rig.thighs)part.thigh.setAttribute('clip-path',part.original);
    for(const clip of rig.legClips){const overlap=rig.leggedTop?1.5:.45;clip.setAttribute('y',rig.waist-overlap);clip.setAttribute('height',64-rig.waist+overlap);}
    continuousLegs(rig);
    rig.lastAction = 'idle'; rig.landingAt = 0;
    return true;
  }
  function destroy(svg) {
    if(svg?.dataset.qpFoundation)return window.QPAvatarFoundation.destroy(svg);
    const rig = rigs.get(svg); if (!rig) return false;
    window.QPClothMesh?.destroy(rig);
    window.QPAvatarDirection?.destroy(svg);
    showArm(rig,'right',false);showArm(rig,'left',false);
    if(rig.gestureArms)for(const arm of rig.gestureArms.values())arm.carrier.remove();
    const shadow=svg.querySelector('.qpx-contact-shadow');if(shadow)shadow.style.visibility='';
    rig.body.replaceChildren(...rig.children);
    unwrap(rig.headPose); unwrap(rig.backHairPose); unwrap(rig.facing); rig.defs.remove();
    if (rig.previousPose === null) svg.removeAttribute('data-qpx-pose');
    else svg.setAttribute('data-qpx-pose', rig.previousPose);
    svg.removeAttribute('data-qpx-seat-mode');
    if(rig.previousGesture===null)svg.removeAttribute('data-qpx-gesture');else svg.setAttribute('data-qpx-gesture',rig.previousGesture);
    rigs.delete(svg);
    return true;
  }
  window.QPAvatarPose = Object.freeze({ prepare, apply, reset, destroy });
})();
