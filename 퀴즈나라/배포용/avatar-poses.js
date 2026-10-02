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
    const fit=window.QPClothes?.fits?.[shape]||{sleeveless:true},cloak=shape==='robe';
    const target=window.QPClothes?.targets?.top?.[shape]||window.QPClothes?.targets?.top?.default||[8.5,28,15,9.5];
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
      return copy;
    };
    let maskSlot=null;
    if(top&&!fit.sleeveless&&!cloak){
      const ps=native.seam.map(point),path='M'+ps[0].join(' ')+'Q'+ps[1].join(' ')+' '+ps[2].join(' ')+'Q'+ps[3].join(' ')+' '+ps[4].join(' ')+'H'+(right?64:-32)+'V'+ps[0][1]+'Z';
      const id=rig.defs.dataset.qpxPoseDefs+'-'+side+'-gesture-sleeve',clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(node('path',{d:path}));clip.appendChild(node('circle',{cx:pivot[0],cy:pivot[1],r:.65}));rig.defs.appendChild(clip);
      const sleeve=node('g',{'clip-path':'url(#'+id+')','data-qpx-wave-sleeve':shape});
      sleeve.appendChild(cloneArtwork([cloneTop()],id+'-art'));arm.appendChild(sleeve);
      if(!rig.gestureCloth){
        const mask=node('mask',{id:rig.defs.dataset.qpxPoseDefs+'-gesture-body',maskUnits:'userSpaceOnUse',x:-32,y:-32,width:96,height:96});
        mask.appendChild(node('rect',{x:-32,y:-32,width:96,height:96,fill:'white'}));rig.defs.appendChild(mask);
        rig.gestureCloth={top,mask,originalMask:top.getAttribute('mask')};
      }
      maskSlot=node('path',{d:path,fill:'white'});rig.gestureCloth.mask.appendChild(maskSlot);
      rig.gestureCloth.mask.appendChild(node('circle',{cx:pivot[0],cy:pivot[1],r:.65,fill:'white'}));
    }
    for(const [at,source]of skinSources.entries())arm.appendChild(cloneArtwork([...source.childNodes],rig.defs.dataset.qpxPoseDefs+'-'+side+'-gesture-skin-'+at));
    const elbow=[pivot[0]+(wrist[0]-pivot[0])*.60,pivot[1]+(wrist[1]-pivot[1])*.60];
    const original=[...arm.childNodes],jointId=rig.defs.dataset.qpxPoseDefs+'-'+side+'-gesture-elbow';
    const forearm=node('g',{'data-qpx-pose-part':side+'-gesture-forearm'});
    for(const [name,y,height,parent]of[['upper',-32,elbow[1]+32,arm],['lower',elbow[1],64-elbow[1],forearm]]){
      const clip=node('clipPath',{id:jointId+'-'+name,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(node('rect',{x:-32,y,width:96,height}));
      clip.appendChild(node('circle',{cx:elbow[0],cy:elbow[1],r:shape==='space'?1.4:1.05}));rig.defs.appendChild(clip);
      const window=node('g',{'clip-path':'url(#'+clip.id+')'});window.appendChild(cloneArtwork(original,jointId+'-'+name+'-art'));
      if(name==='upper')arm.replaceChildren(window);else parent.appendChild(window);
    }
    arm.appendChild(forearm);
    const hands=[...arm.querySelectorAll('.qpx-hand-'+side)].map(hand=>wrap(hand,side+'-gesture-hand'));
    carrier.appendChild(arm);
    if(cloak&&top){
      const id=rig.defs.dataset.qpxPoseDefs+'-'+side+'-cloak-overlap',clip=node('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      clip.appendChild(node('circle',{cx:pivot[0],cy:pivot[1],r:1.0}));rig.defs.appendChild(clip);
      const cap=node('g',{'clip-path':'url(#'+id+')'});cap.appendChild(cloneArtwork([cloneTop()],id+'-art'));carrier.appendChild(cap);
    }
    rig.idle.appendChild(carrier);
    const artwork={carrier,arm,forearm,hands,elbow,pivot,wrist,maskSlot,originals,visible:false};rig.gestureArms.set(side,artwork);return artwork;
  }
  function showArm(rig,side,visible) {
    if(!rig.gestureArms?.has(side)&&!visible)return;
    const artwork=visible?armArtwork(rig,side):rig.gestureArms.get(side);
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
    const longTop = ['dress', 'robe', 'overall'].includes(top && top.dataset.clothShape);
    // A cloth hem has its own bone. Its full artwork never becomes an ankle.
    const waist = skirt || longTop ? 39.25 : 38.5, foot = 46;
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
    const left = clipped('left-leg', -32, waist-.45, 48, 64-waist+.45);
    const right = clipped('right-leg', 16, waist-.45, 48, 64-waist+.45);
    // Shoes retain their painted proportions while knees bend and legs shorten.
    // Cloning the original nodes also preserves their current dye and detail.
    [upper, left, right].forEach(part => {
      part.querySelectorAll('[data-qpx-shoes]').forEach(shoe => shoe.remove());
      if (skirt) part.querySelectorAll('[data-qpx-clothes="bottom"]').forEach(cloth => cloth.remove());
    });
    [left, right].forEach(part => {
      part.querySelectorAll('[data-qpx-clothes="top"]').forEach(cloth => cloth.remove());
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
        clip.appendChild(node('circle',{cx:hip,cy:knee,r:1.9}));defs.appendChild(clip);
      }
      const thigh=node('g',{'clip-path':'url(#'+upperId+')'});thigh.appendChild(cloneArtwork([original],uid+'-'+side+'-thigh-art'));
      const shin=node('g',{'data-qpx-pose-part':side+'-shin'}),skin=node('g',{'clip-path':'url(#'+lowerId+')'});skin.appendChild(original);shin.appendChild(skin);leg.replaceChildren(thigh,shin);return shin;
    }
    const leftShin=kneeJoint(left,'left'),rightShin=kneeJoint(right,'right');
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
    function footArtwork(side){
      if(!shoeArtwork)return null;
      const group=node('g',{'data-qpx-pose-part':side+'-foot','data-qps-foot-host':side,'data-qps-shape':shoeArtwork.dataset.qpxShoes,'data-qps-foot-color':shoeArtwork.dataset.qpxShoeColor});
      const painting=window.QPShoes?.renderFoot(shoeArtwork.dataset.qpxShoes,shoeArtwork.dataset.qpxShoeColor,side);
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
    body.replaceChildren(left, right, upper, hem);
    if (leftFoot) body.appendChild(leftFoot);
    if (rightFoot) body.appendChild(rightFoot);
    svg.insertBefore(defs, svg.firstChild);
    const headPose = wrap(head, 'head');
    const backHair = idle.querySelector('.qpx-back-hair');
    const backHairPose = backHair ? wrap(backHair, 'back-hair') : null;
    const facing = wrap(idle, 'facing');
    const rig = { svg, body, head, idle, children, defs, upper, left, right, hands, wrists,arms,cuffs,armSides,
      headPose, backHairPose, facing, waist, skirtWaist, foot, skirt, longTop, hem, leftFoot, rightFoot,
      leftShin,rightShin,knee,upperClip:defs.querySelector('#'+uid+'-upper rect'),lastAction: 'idle', landingAt: 0,gesture:'',gestureStartedAt:0,previousGesture:svg.getAttribute('data-qpx-gesture'), previousPose: svg.getAttribute('data-qpx-pose') };
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
  function legTransform(hip, waist, scaleY, shear, dx, dy) {
    // Shear rotates the stride in screen space while the hip remains attached.
    return translated(dx, dy) + ' translate(' + hip + ' ' + waist + ') matrix(1 0 ' +
      number(shear) + ' ' + number(scaleY) + ' 0 0) translate(' + (-hip) + ' ' + (-waist) + ')';
  }
  function rotated(angle, x, y) { return 'rotate(' + number(angle) + ' ' + number(x) + ' ' + number(y) + ')'; }
  function footTransform(hip, foot, dx, dy, angle) {
    return translated(dx, dy) + ' ' + rotated(angle, hip, foot);
  }
  function apply(svg, state) {
    const rig = prepare(svg); if (!rig) return false;
    state = state || {};
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
    let handAngleLeft = 0, handAngleRight = 0, walkPose = null;
    let armAngleLeft=0,armAngleRight=0;
    let shinLeft='',shinRight='';
    const span = rig.foot - rig.waist;
    if (action === 'walk') {
      const phase = illustrated && Number.isFinite(state.phase) ? ((state.phase % 1) + 1) % 1 : Number.isFinite(state.step) ? ((state.step % 8) + 8) % 8 / 8 :
        ((finite(state.phase) % 1) + 1) % 1;
      const stride = illustrated ? Math.sin(phase * Math.PI * 2) : [0, .7, 1, .7, 0, -.7, -1, -.7][Math.floor(phase * 8) % 8];
      const reach = qx(stride * 2.05), liftL = qy(Math.max(0, stride) * 1.15);
      const liftR = qy(Math.max(0, -stride) * 1.15);
      walkPose = { reach, liftL, liftR, stride };
      torsoY = qy(-.1 * (1 - Math.cos(phase * Math.PI * 4)));
      lean = illustrated ? stride * 1.15 : 0;
      headX = qx(Math.sin(lean * Math.PI / 180) * (rig.waist - 28) * bodyScale);
      headOffset = headY(torsoY * bodyVerticalScale);
      headLean = lean * .35;
      handAngleLeft = -stride * 6; handAngleRight = stride * 6;
      armAngleLeft=-stride*8;armAngleRight=stride*8;
    } else if (action === 'jump') {
      // World movement belongs to the physics engine; this only gathers the legs.
      const airborne = state.grounded === true ? .25 : 1;
      const ascending = finite(state.vy) >= 0;
      const gather = qx((ascending ? .85 : .25) * airborne);
      const lift = qy((ascending ? 2.1 : .55) * airborne);
      left = legTransform(13.75, rig.waist, Math.max(.35, 1 - lift / span), gather / span, 0, 0);
      right = legTransform(18.25, rig.waist, Math.max(.35, 1 - lift / span), -gather / span, 0, 0);
      footLeft = footTransform(13.75, rig.foot, gather, -lift, ascending ? -9 : -2);
      footRight = footTransform(18.25, rig.foot, -gather, -lift, ascending ? 9 : 2);
      handAngleLeft = (ascending ? -12 : -4) * airborne;
      handAngleRight = (ascending ? 12 : 4) * airborne;
      armAngleLeft=(ascending?-10:-3)*airborne;armAngleRight=(ascending?10:3)*airborne;
      headOffset = headY((ascending ? -.12 : .08) * airborne);
    } else if(action==='climb'){
      const reach=(1+Math.sin(clamp(finite(state.phase),0,1)*Math.PI*6))/2;
      left=rotated(-6-9*reach,13.75,rig.waist);right=rotated(6+9*(1-reach),18.25,rig.waist);
      shinLeft=rotated(-5-7*reach,13.75,rig.knee);shinRight=rotated(5+7*(1-reach),18.25,rig.knee);
      footLeft=left+' '+shinLeft;footRight=right+' '+shinRight;
    } else if (action === 'sit') {
      // Desk knees stay close together. On the floor, bend both joints while
      // preserving the complete shoes and their original contact height.
      // The older motion preview keeps its existing crouch unless a seat mode
      // is requested by the classroom controller.
      const sideFloor = floorSit && ['left', 'right'].includes(state.direction);
      const bend = floorSit ? sideFloor ? 65 : 75 : deskSit ? 24 : 60;
      const leftBend = sideFloor ? -bend : bend, rightBend = -bend;
      const leftShinBend = floorSit ? sideFloor ? 125 : -150 : -bend;
      const rightShinBend = floorSit ? sideFloor ? 125 : 150 : bend;
      const radians = degrees => degrees * Math.PI / 180;
      const drop = qy(floorSit ? span - (rig.knee-rig.waist)*Math.cos(radians(leftBend)) -
        (rig.foot-rig.knee)*Math.cos(radians(leftBend+leftShinBend)) :
        (rig.knee-rig.waist)*(1-Math.cos(radians(bend))));
      torsoY = drop;
      headOffset = headY(drop * bodyVerticalScale);
      left=translated(0,drop)+' '+rotated(leftBend,13.75,rig.waist);
      right=translated(0,drop)+' '+rotated(rightBend,18.25,rig.waist);
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
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if(gesture!==rig.gesture){rig.gesture=gesture;rig.gestureStartedAt=now;}
    const progress=Number.isFinite(state.gestureProgress)?clamp(state.gestureProgress,0,1):clamp((now-rig.gestureStartedAt)/1500,0,1);
    const ease=value=>value*value*(3-2*value);
    const envelope=ease(clamp(progress/.18,0,1))*ease(clamp((1-progress)/.20,0,1));
    const activeGesture=action==='idle'&&envelope>0?gesture:'';
    if(action==='idle'){
      const breath=(1-Math.cos(now/6400*Math.PI*2))*.75;
      armAngleLeft=-breath;armAngleRight=breath;
    }
    if(activeGesture==='nod'){
      headOffset+=headY(.55*Math.pow(Math.sin(progress*Math.PI*2),2)*envelope);
      headLean+=Math.sin(progress*Math.PI*2)*.6*envelope;
    }
    if(activeGesture==='happy'){
      headLean+=Math.sin(progress*Math.PI*4)*1.8*envelope;
      armAngleLeft-=Math.sin(progress*Math.PI*4)*5*envelope;
      armAngleRight+=Math.sin(progress*Math.PI*4)*5*envelope;
      torsoY-=.12*Math.pow(Math.sin(progress*Math.PI*3),2)*envelope;
      headOffset=headY(torsoY*bodyVerticalScale);
    }
    if (rig.lastAction === 'jump' && action !== 'jump' && state.grounded === true) rig.landingAt = now;
    if (action === 'jump' || action === 'sit') rig.landingAt = 0;
    if (rig.landingAt && now - rig.landingAt < 170) {
      const settle = Math.sin((now - rig.landingAt) / 170 * Math.PI) * .42;
      torsoY += settle; headOffset += headY(settle * bodyVerticalScale);
    }
    rig.lastAction = action;
    // Preserve the continuous painted seat/crotch above the two hip bones.
    // The round knees articulate below it without exposing the center cut.
    rig.upperClip.setAttribute('height',rig.waist+32+(action==='sit'?1.45:.45));
    const upperTransform = torsoY || lean ? translated(0, torsoY) + ' ' + rotated(lean, 16, rig.waist) : '';
    const headTransform = headOffset || headX || headLean ? translated(headX, headOffset) + ' ' + rotated(headLean, 16, 28) : '';
    if (walkPose) {
      // The thigh turns at the hip and the shin bends at the knee. Each
      // complete shoe follows its shin, preserving the native ankle overlap.
      const sideView=window.QPAvatarDirection?.atlas.ready&&state.direction!=='front'&&(['left','right'].includes(state.direction)||['left','right'].includes(state.facing));
      const leftBend=Math.max(0,walkPose.stride)*(sideView?22:10),rightBend=-Math.max(0,-walkPose.stride)*(sideView?22:10);
      shinLeft=rotated(leftBend,13.75,rig.knee);shinRight=rotated(rightBend,18.25,rig.knee);
      left=upperTransform+' '+rotated(-walkPose.stride*(sideView?22:8),13.75,rig.waist);
      right=upperTransform+' '+rotated(walkPose.stride*(sideView?22:8),18.25,rig.waist);
      footLeft=left+' '+shinLeft;footRight=right+' '+shinRight;
    }
    setTransform(rig.left, left); setTransform(rig.right, right);
    setTransform(rig.leftShin,shinLeft);setTransform(rig.rightShin,shinRight);
    setTransform(rig.upper, upperTransform);
    setTransform(rig.hem, hemTransform || upperTransform);
    if (rig.leftFoot) setTransform(rig.leftFoot, footLeft);
    if (rig.rightFoot) setTransform(rig.rightFoot, footRight);
    setTransform(rig.headPose, headTransform);
    if (rig.backHairPose) setTransform(rig.backHairPose, headTransform);
    rig.arms.forEach((arm,index)=>{
      if(arm)setTransform(arm,rotated(rig.armSides[index]?armAngleRight:armAngleLeft,...rig.cuffs[index]));
    });
    rig.hands.forEach((hand, index) => {
      if (hand) setTransform(hand, translated(...(index ? handRight : handLeft)) + ' ' +
        rotated(index ? handAngleRight : handAngleLeft, ...rig.wrists[index]));
    });
    const profile=window.QPAvatarDirection?.apply(svg,{...state,action,gesture:activeGesture},rig)||false;
    showArm(rig,'right',activeGesture==='wave'||action==='climb'||profile);
    showArm(rig,'left',action==='climb'||profile);
    if(profile){
      const stride=walkPose?.stride||0;
      for(const [side,angle]of[['left',action==='jump'?14:stride*22],['right',action==='jump'?-16:-stride*22]]){
        const arm=rig.gestureArms.get(side),near=side==='right';
        positionArm(rig,arm,upperTransform,angle,action==='jump'?(near?14:-14):near?Math.max(0,stride)*9:-Math.max(0,-stride)*9,0,(near?16.6:15.6)-arm.pivot[0]);
        arm.carrier.style.opacity=near?'':'0.78';
        // The far arm is behind the complete dressed torso; the near sleeve
        // and wrist move together in front, matching the direction reference.
        if(near)rig.idle.appendChild(arm.carrier);
        else {let bodyRoot=rig.body.closest('[data-qpx-direction-part="body-profile"]');if(bodyRoot){while(bodyRoot.parentNode&&bodyRoot.parentNode!==rig.idle)bodyRoot=bodyRoot.parentNode;rig.idle.insertBefore(arm.carrier,bodyRoot);}}
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
    const shadow=svg.querySelector('.qpx-contact-shadow');if(shadow)shadow.style.visibility=action==='climb'?'hidden':'';
    const mirror=profile?svg.dataset.qpxViewFacing==='left':state.direction!=='front'&&!activeGesture&&state.facing==='left';
    setTransform(rig.facing, mirror ? 'translate(32 0) scale(-1 1)' : '');
    if(activeGesture)svg.setAttribute('data-qpx-gesture',activeGesture);else svg.removeAttribute('data-qpx-gesture');
    const displayAction = floorSit ? 'floor-sit' : action;
    if (svg.getAttribute('data-qpx-pose') !== displayAction) svg.setAttribute('data-qpx-pose', displayAction);
    if (floorSit || deskSit) svg.setAttribute('data-qpx-seat-mode', floorSit ? 'floor' : 'desk');
    else svg.removeAttribute('data-qpx-seat-mode');
    return true;
  }
  function reset(svg) {
    const rig = rigs.get(svg); if (!rig) return false;
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
    rig.lastAction = 'idle'; rig.landingAt = 0;
    return true;
  }
  function destroy(svg) {
    const rig = rigs.get(svg); if (!rig) return false;
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
