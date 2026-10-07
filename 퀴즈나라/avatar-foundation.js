/* Reference body v1. Shared fixed joints and authored projected seated poses. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',mounted=new WeakMap(),headCache=new Map();let serial=0;
  const SPEC=Object.freeze({version:1,waist:38.1,knee:41.3,ankle:44.15,floor:46.05,hip:[13.65,18.35],shoulder:[[12.7,29.9],[19.3,29.9]],profileShoulder:[[15.6,29.9],[15.85,29.9]],profileHip:[15.65,16.35],elbow:[[12.15,34.05],[19.85,34.05]],wrist:[[12.2,36.7],[19.8,36.7]],walkSpeed:337.5,runSpeed:506.25});
  // Independently traced neck-only boundaries on the original short/bob
  // directional paintings. Curves preserve the hair that overlaps the nape;
  // a rectangular head crop would cut notches into that hair.
  const HEAD_NECK_CUT={
    m:{front:'M12.8 28.65Q13.45 28.45 13.6 27.98Q13.9 27.78 14.3 27.9V31H12.8ZM19.2 28.65Q18.55 28.45 18.4 27.98Q18.1 27.78 17.7 27.9V31H19.2Z',profile:'M14.25 25.7Q15.6 26.4 18.55 26.67Q18.2 27.6 18.5 28.3L18.7 29.4H12.55V28Q13.45 27.6 13.75 26.65Z',back:'M14.35 26.75Q15.4 26.45 16.1 26.62Q17 26.42 17.5 26.73Q17.7 27.55 18.5 28.15L18.6 29.4H12.7V28.05Q13.9 27.35 14.35 26.75Z'},
    f:{profile:'M15.85 25.55Q16.3 25.85 17.12 26.02Q16.9 26.8 17.25 27.45Q17.7 27.9 18.3 28.05L18.45 29.4H12.65V27.85Q14.85 27.25 15.4 26.8Q15.9 26.2 15.85 25.55Z'}
  };
  // The thigh top is covered by the shorts; a wider root poked out beside
  // the shorts' curved hip as a pale skin tab.
  const THIGH=1.04;
  // Reference study (2026-10-07): a wider, soft SD body beneath the same
  // original head. One presentation scale and limb volume for every outfit.
  const BODY_SCALE={x:1.55,y:1.593},ARM_RADII=Object.freeze([.96,.82,.59]);
  // Old painted neck-stump strokes under every front portrait, by sex.
  const BACK_HAIR_NECK_CUT={
    f:'M14.45 28.7L14.2 29.1L13.95 29.45L13.7 29.8L13.4 30.3L12.95 30.35L12.6 29.95L12.65 29.5L13.1 29.2L13.5 28.95L13.8 28.7ZM17.55 28.7L17.9 28.7L18.4 28.95L18.95 29.2L19.4 29.5L19.4 29.95L19.05 30.35L18.6 30.3L18.3 29.8L18.05 29.45L17.8 29.1Z',
    m:'M14.1 28.2L14.05 28.9L13.85 29.3L13.6 29.85L13.3 30.35L12.75 30.4L12.35 29.9L12.35 29.4L12.85 28.95L13.2 28.6L13.3 28.2ZM17.9 28.2L18.7 28.2L18.8 28.6L19.15 28.95L19.65 29.4L19.65 29.9L19.25 30.4L18.7 30.35L18.4 29.85L18.15 29.3L17.95 28.9Z'
  };
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,n=x=>Math.round(x*10000)/10000,pt=p=>p.map(n).join(' '),rad=x=>x*Math.PI/180;
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  const rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
  const transform=(a,b,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,b[0]-c*a[0]+s*a[1],b[1]-s*a[0]-c*a[1]];};
  const mapped=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  const matrix=m=>'matrix('+m.map(n).join(' ')+')';
  function ik(a,b,l1,l2,bend){const d=sub(b,a),length=clamp(Math.hypot(...d),Math.abs(l1-l2)+.001,l1+l2-.001),angle=Math.atan2(d[1],d[0]),offset=Math.acos(clamp((l1*l1+length*length-l2*l2)/(2*l1*length),-1,1))*bend;return add(a,[Math.cos(angle+offset)*l1,Math.sin(angle+offset)*l1]);}
  const TAU=Math.PI*2,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  // Gait per leg phase p; 0 is heel strike with the foot ahead. The planted
  // foot passes under the hip, the heel peels off before toe-off, then the
  // swing lifts the knee and brings the foot through. Running has a short
  // stance, a flight phase and a high heel kick instead of a faster walk.
  const GAIT={
    walk:{duty:.6,reach:1.75,heel:.72,heelLift:.34,toe:14,lift:1.35,arc:.8,travel:[.04,.92],bob:[.28,.17,.04],lean:3,sway:.11,roll:1.4,support:.3,swing:24,flex:14,fold:10,lag:.03},
    run:{duty:.36,reach:2.25,heel:.5,heelLift:.52,toe:20,lift:2.45,arc:.62,travel:[.12,.95],bob:[.78,.32,.18],lean:9,sway:.06,roll:.8,support:.18,swing:44,flex:102,fold:10,lag:.02}
  };
  function step(g,p){
    if(p<g.duty){const u=p/g.duty,heel=smooth(g.heel,1,u);return{forward:g.reach*(1-2*u),lift:g.heelLift*heel,toe:-10*(1-smooth(0,.12,u))+g.toe*heel,contact:heel<=0};}
    const s=(p-g.duty)/(1-g.duty);
    return{forward:g.reach*(2*smooth(g.travel[0],g.travel[1],s)-1),lift:g.heelLift*(1-s)*(1-s)+g.lift*Math.sin(Math.PI*Math.pow(s,g.arc)),toe:g.toe*(1-smooth(0,.35,s))-10*smooth(.6,1,s),contact:false};
  }
  // Arms use one body-frame model in every view: swing (forward +),
  // abduction (outward +) and elbow flexion (forward +). The screen keeps
  // x/y and depth carries the foreshortening, so bone lengths never change.
  const REST_ABDUCTION=Math.atan2(.55,4.15),REST_FOREARM=-Math.atan2(.05,2.65),REST_SWING=Math.atan2(.1,4.15),REST_FLEX=Math.atan2(.25,2.63)-Math.atan2(.1,4.15);
  const bodyVector=(swing,abduct)=>[Math.sin(abduct),Math.cos(abduct)*Math.cos(swing),Math.cos(abduct)*Math.sin(swing)];
  function view3d(v,side,view,near){return view==='profile'?[v[2],v[1],(near?1:-1)*v[0]]:view==='back'?[side*v[0],v[1],-v[2]]:[side*v[0],v[1],v[2]];}
  function gestureEnvelope(progress){return smooth(0,.18,progress)*(1-smooth(.82,1,progress));}
  function solve(input={}){
    const direction=input.action==='climb'?'back':['front','back','left','right'].includes(input.direction)?input.direction:input.facing||'front',profile=['left','right'].includes(direction),back=direction==='back',view=profile?'profile':back?'back':'front';
    const action=input.action||'idle',run=action==='run',walk=run||action==='walk',floor=action==='floor-sit'||action==='sit'&&input.seatMode==='floor',desk=action==='sit'&&!floor,jump=action==='jump',climb=action==='climb';
    const rawPhase=((Number(input.phase)||0)%1+1)%1;
    // A cycle has 24 shared painted poses (walk ~50fps, run ~78fps in maps).
    // Quantize drawing only: world position and input timing remain continuous.
    const phase=walk||climb?Math.round(rawPhase*24)%24/24:rawPhase,time=Number.isFinite(input.time)?input.time:0;
    const gait=run?GAIT.run:GAIT.walk,gesture=['wave','nod','happy'].includes(input.gesture)?input.gesture:'',progress=clamp(Number(input.gestureProgress)||0,0,1),envelope=gesture?gestureEnvelope(progress):0;
    const air=jump&&!input.grounded,rise=air?clamp((Number(input.vy)||0)/480,-1,1):0,tuck=air?1-Math.abs(rise)*.72:0,crouch=jump&&!air;
    const compression=crouch?(Number.isFinite(input.jumpCompression)?clamp(input.jumpCompression,0,1):1):0;
    // Idle breathing: slow, small, and shared by chest, shoulders and arms.
    const breath=(1-Math.cos(time*1.9))/2;
    const hop=gesture==='happy'?Math.abs(Math.sin(progress*Math.PI*3))*envelope:0,nod=gesture==='nod'?Math.max(0,Math.sin(progress*Math.PI*4))*envelope:0;
    const drop=floor?5.6:desk?1.55:walk?gait.bob[0]+gait.bob[1]*Math.cos(2*TAU*(phase-gait.bob[2])):crouch?.03+.82*compression:air?.05:.03+.07*breath+.12*nod-.03*hop;
    const sway=walk&&!profile?-gait.sway*Math.sin(TAU*(phase-gait.support+.25)):0,roll=walk&&!profile?gait.roll*sway/gait.sway:0;
    const lean=profile?(run?gait.lean:walk?gait.lean+.8*Math.cos(2*TAU*phase):floor?2:crouch?7*compression:air?3-2*rise:4*nod):0;
    const torso=transform([16,SPEC.waist],[16+sway,SPEC.waist+drop],rad(profile?lean:roll));
    const legs=SPEC.hip.map((hip,i)=>{
      const x=profile?SPEC.profileHip[i]:hip,root=mapped(torso,[x,SPEC.waist]),p=(phase+i*.5)%1;
      let ankle=[x+(profile&&!walk&&!jump&&!climb?(i?.32:-.32):0),SPEC.ankle],knee,shoeAngle=0,contact=true,forward=0;
      if(walk){const s=step(gait,p);forward=s.forward;ankle=[x+(profile?forward:0),SPEC.ankle-s.lift];contact=s.contact;shoeAngle=profile?rad(s.toe):0;}
      if(air){
        // Tucked at the top, reaching down again before the landing.
        forward=profile?-.55*tuck:-.35*tuck;ankle=[x+(profile?forward:(i?.2:-.2)*tuck),SPEC.ankle-.35-2.05*tuck];contact=false;shoeAngle=profile?rad(14*tuck-6):0;
      }
      if(climb){const reach=(1+Math.sin((phase+i*.5)*TAU))/2;forward=1.0;ankle=[x,SPEC.ankle-.65-reach*1.9];contact=false;}
      if(floor){
        // User's four-view seating reference: knees open to the sides, calves
        // return inwards, feet cross in front. Profile/back have their own
        // depth projection; no standing foot hangs below the seated pelvis.
        knee=profile?[i?19.15:17.7,i?44.9:44.25]:[i?20.55:11.45,back?45.1:44.45];
        ankle=profile?[i?16.6:16.1,i?45.43:44.8]:[i?17.85:14.15,back?45.35:i?45.43:44.95];
        contact=false;
      }else if(desk){knee=profile?[x+2.4,root[1]+1.8]:[x+(i?.2:-.2),root[1]+3.05];ankle=profile?[x+2.0,44.15]:[x,SPEC.ankle];}
      else if(profile)knee=ik(root,ankle,3.2,2.9,-1);
      else{
        // Sagittal bending projects into depth in a front/back view. Solving
        // it as sideways screen motion made a lifted knee splay outwards.
        const sagittal=ik([0,root[1]],[forward,ankle[1]],3.2,2.9,-1);
        knee=[mix(root[0],ankle[0],.5),sagittal[1]];
        ankle.depth=forward;knee.depth=sagittal[0];
      }
      const thighAngle=Math.atan2(knee[1]-root[1],knee[0]-root[0])-Math.PI/2,shinAngle=Math.atan2(ankle[1]-knee[1],ankle[0]-knee[0])-Math.PI/2;
      let boneSpace=profile?[root,knee,ankle]:[[0,root[1]],[knee.depth||0,knee[1]],[ankle.depth||0,ankle[1]]];
      if(floor||desk){
        // Foreshortening changes the visible length, never the joint lengths.
        const kneeDepth=Math.sqrt(Math.max(0,3.2**2-Math.hypot(...sub(knee,root))**2));
        const ankleDepth=kneeDepth-Math.sqrt(Math.max(0,2.9**2-Math.hypot(...sub(ankle,knee))**2));
        boneSpace=[[...root,0],[...knee,kneeDepth],[...ankle,ankleDepth]];
      }
      return{root,knee,ankle,contact,shoeAngle,boneSpace,thigh:transform([hip,SPEC.waist],root,thighAngle),shin:transform([hip,SPEC.knee],knee,shinAngle)};
    });
    const arms=SPEC.shoulder.map((rest,i)=>{
      const side=i?1:-1,shoulder=mapped(torso,profile?SPEC.profileShoulder[i]:rest),upperLength=Math.hypot(...sub(SPEC.elbow[i],rest)),lowerLength=Math.hypot(...sub(SPEC.wrist[i],SPEC.elbow[i]));
      let elbow,wrist,depth=[0,0];
      if(floor||desk){
        // Authored seated arms: hands rest toward the knees or the desk.
        const upper=floor?(profile?[.95,4.04]:[side*.2,4.1]):(profile?[1.2,4.0]:[side*.5,4.1]),lower=floor?(profile?[.85,2.45]:[-side*.55,2.59]):(profile?[.65,2.55]:[-side*.55,2.59]);
        elbow=add(shoulder,rotate(upper,rad(lean)));wrist=add(elbow,rotate(lower,rad(lean)));
        depth[0]=Math.sqrt(Math.max(0,upperLength**2-Math.hypot(...sub(elbow,shoulder))**2));depth[1]=depth[0]+Math.sqrt(Math.max(0,lowerLength**2-Math.hypot(...sub(wrist,elbow))**2));
      }else if(climb){
        // Hand over hand: the high hand grips above and behind the big head,
        // the low hand pulls at chest height with its elbow tucked below it.
        const reach=(1+Math.sin((phase+(i?0:.5))*TAU))/2;wrist=[16+side*mix(4.9,5.6,reach),mix(30.5,25.9,reach)];
        elbow=ik(shoulder,wrist,upperLength,lowerLength,i?1:-1);
        depth[0]=Math.sqrt(Math.max(0,upperLength**2-Math.hypot(...sub(elbow,shoulder))**2));depth[1]=depth[0]+Math.sqrt(Math.max(0,lowerLength**2-Math.hypot(...sub(wrist,elbow))**2));
      }else{
        let swing=REST_SWING,abduct=REST_ABDUCTION,flex=REST_FLEX,forearm=REST_FOREARM;
        if(walk){
          const c=(i?1:-1)*Math.cos(TAU*(phase-gait.lag));swing+=rad(gait.swing)*c;flex=rad(gait.flex+gait.fold*c);
          // A running forearm crosses toward the chest on the forward swing.
          if(run){abduct+=rad(9);forearm-=rad(26*Math.max(0,c)+4);}else abduct+=rad(2*Math.max(0,-c));
        }else if(air){
          // Arms open upward for balance and come down again for landing.
          if(profile){swing=rad(30+18*Math.max(0,rise)-10*Math.max(0,-rise));flex=rad(22);}else{abduct+=rad(30+10*rise);swing=rad(10);flex=rad(24);forearm=rad(8);}
        }else if(crouch){swing=mix(swing,rad(-24),compression);flex=mix(flex,rad(12),compression);abduct+=rad(4)*compression;}
        else{swing+=rad(1.2*breath-.6);flex+=rad(3*breath);}
        if(gesture==='happy'){
          // Both arms cheer while the body hops.
          const shake=Math.sin(progress*TAU*5);if(profile){swing=mix(swing,rad(172+4*shake),envelope);flex=mix(flex,rad(6),envelope);}else{abduct=mix(abduct,rad(142+5*shake),envelope);forearm=mix(forearm,rad(150+6*shake),envelope);flex=mix(flex,0,envelope);swing=mix(swing,rad(6),envelope);}
        }
        if(gesture==='wave'&&i===1){
          // The upper arm stays raised; the forearm and hand do the waving.
          const wag=Math.sin(progress*TAU*3.5)*envelope;
          // With the rounder hand, a vertical profile wave covered the eye.
          // Lift forward beside the cheek, retaining the same bone lengths.
          if(profile){swing=mix(swing,rad(130),envelope);flex=mix(flex,rad(4+18*wag),envelope);abduct=mix(abduct,rad(12),envelope);}
          else{abduct=mix(abduct,rad(back?104:112),envelope);forearm=mix(forearm,rad((back?148:158)+22*wag),envelope);flex=mix(flex,0,envelope);swing=mix(swing,rad(back?4:8),envelope);}
        }
        if(profile)swing-=rad(lean);
        const U=view3d(bodyVector(swing,abduct),side,view,i===1),F=view3d(bodyVector(swing+flex,forearm),side,view,i===1);
        elbow=[shoulder[0]+U[0]*upperLength,shoulder[1]+U[1]*upperLength];wrist=[elbow[0]+F[0]*lowerLength,elbow[1]+F[1]*lowerLength];depth=[U[2]*upperLength,U[2]*upperLength+F[2]*lowerLength];
      }
      const base=sub(SPEC.elbow[i],rest),angle=Math.atan2(elbow[1]-shoulder[1],elbow[0]-shoulder[0])-Math.atan2(base[1],base[0]);
      return{shoulder,elbow,wrist,depth:depth[1],boneSpace:[[...shoulder,0],[...elbow,depth[0]],[...wrist,depth[1]]],sleeve:transform(rest,shoulder,angle),angle};
    });
    return{direction,profile,back,action,phase,torso,legs,arms,floor,desk,drop,lean,gesture,hop,nod};
  }
  const el=(tag,attrs={})=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
  const set=(e,key,value)=>{if(e.getAttribute(key)!==String(value))e.setAttribute(key,value);};
  const tone=(hex,f)=>'#'+hex.slice(1).match(/../g).map(v=>Math.round(clamp(parseInt(v,16)*f,0,255)).toString(16).padStart(2,'0')).join('');
  const path=(d,fill,stroke='none',width=.12)=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
  function pigment(defs,id,color){const g=el('linearGradient',{id,x1:0,y1:0,x2:1,y2:0});for(const [offset,f]of[[0,.80],[.28,1.04],[.62,1.09],[1,.88]])g.append(el('stop',{offset,'stop-color':tone(color,f)}));defs.append(g);return'url(#'+id+')';}
  function headViews(av){
    const base={...av,rig:undefined,top:'',bottom:'',shoes:'',outfit:'',pet:'',effect:'',bg:'',frame:'',hat:'',glass:'',face:'',ear:'',neck:'',back:''};
    const key=JSON.stringify(base);if(headCache.has(key))return headCache.get(key);
    const raw=new DOMParser().parseFromString(QPAvatar.render(base,280,3),'image/svg+xml').documentElement;
    const front=raw.querySelector('.qpx-head'),skin=front.dataset.qpxHeadSkin;
    const result={skin,headClip:raw.querySelector('#qpx-head-front').outerHTML,backHair:raw.querySelector('.qpx-back-hair')?.outerHTML||'',front:front.outerHTML,profile:QPAvatarDirection.headMarkup(raw,'profile'),back:QPAvatarDirection.headMarkup(raw,'back')};headCache.set(key,result);return result;
  }
  function render(av={},size=280){
    root.QPFoundationSkin?.load();
    if(av.foundationOutfit!=='body')root.QPFoundationOutfit?.load();
    const sex=av.sex==='m'?'m':'f',base={...av,sex,hair:av.hair|| (sex==='m'?'short:1':'bob:1'),expression:av.expression||'bright:0'},heads=headViews(base),id='qpf-'+(++serial);
    const svg=el('svg',{xmlns:NS,class:'qp-pixel-avatar qp-illustrated-avatar qp-foundation-avatar','data-qp-foundation':'1','data-foundation-outfit':av.foundationOutfit==='body'?'body':'basic','data-qpx-sex':sex,'data-foundation-id':id,'data-foundation-skin':heads.skin,viewBox:'0 0 32 62',width:size*32/56,height:size*62/56,role:'img','aria-label':(sex==='m'?'남자':'여자')+' 기준 캐릭터',style:'display:block;overflow:visible;--qpx-viewport-scale:1.107142857;--qpx-ground-shift:2.4'});
    const defs=el('defs');svg.append(defs);const skin=pigment(defs,id+'-skin',heads.skin),underlay=pigment(defs,id+'-underlay','#d9e0d1');
    const neckGradient=el('linearGradient',{id:id+'-neck-shadow',gradientUnits:'userSpaceOnUse',x1:16,x2:16,y1:27.8,y2:28.5});neckGradient.append(el('stop',{offset:0,'stop-color':tone(heads.skin,.74),'stop-opacity':.62}),el('stop',{offset:.42,'stop-color':tone(heads.skin,.82),'stop-opacity':.26}),el('stop',{offset:1,'stop-color':tone(heads.skin,.88),'stop-opacity':0}));defs.append(neckGradient);
    const headClip=el('g');headClip.innerHTML=heads.headClip.replaceAll('qpx-head-front',id+'-head-front');defs.append(...headClip.children);
    const skinGradient=defs.querySelector('#'+id+'-skin');skinGradient.setAttribute('gradientUnits','userSpaceOnUse');skinGradient.setAttribute('x1','10');skinGradient.setAttribute('x2','22');
    svg.append(el('ellipse',{class:'qpx-contact-shadow',cx:16,cy:56.75365,rx:6.2,ry:.60,fill:'#596654',opacity:.20}));
    const mirror=el('g',{'data-foundation-mirror':'true'}),head=el('g',{'data-foundation-head':'true'}),body=el('g',{'data-foundation-body':'true',transform:`translate(16 28) scale(${BODY_SCALE.x} ${BODY_SCALE.y}) translate(-16 -28)`}),backHair=el('g',{'data-foundation-back-hair':'true'});mirror.append(backHair,body,head);svg.append(mirror);
    // Hair below the chin hangs behind the body, as in the regular avatar.
    // The front portraits also carry an old outlined neck stump down there;
    // only those traced strokes are cut, never the hanging hair itself.
    if(heads.backHair){const clip=el('clipPath',{id:id+'-hair-behind',clipPathUnits:'userSpaceOnUse'});clip.append(el('path',{d:'M-1 28.2H33V48.2H-1Z'+BACK_HAIR_NECK_CUT[sex],'clip-rule':'evenodd'}));defs.append(clip);backHair.innerHTML=heads.backHair.replaceAll('url(#qpx-hair-behind)','url(#'+id+'-hair-behind)');}
    for(const view of ['front','profile','back']){
      const v=el('g',{'data-foundation-head-view':view});v.innerHTML=heads[view].replaceAll('url(#qpx-head-front)','url(#'+id+'-head-front)');
      // The directional paintings include a flared standalone neck with a
      // dark bottom rim. A body that owns its neck must not show that second
      // neck above the shirt. Cut only the reference heads' neck attachment;
      // original face/hair PNGs and legacy wardrobe rendering stay intact.
      const referenceHead=base.hair.split(':')[0]===(sex==='m'?'short':'bob');
      const cut=referenceHead?HEAD_NECK_CUT[sex][view]:'';
      if(cut){const clip=el('clipPath',{id:id+'-head-only-'+view,clipPathUnits:'userSpaceOnUse'});clip.append(el('path',{d:'M-8 -8H40V48H-8Z'+cut,'clip-rule':'evenodd'}));defs.append(clip);v.setAttribute('clip-path','url(#'+id+'-head-only-'+view+')');}
      head.append(v);
    }
    for(const name of ['far-arm','far-leg','near-leg','pelvis','torso','near-arm'])body.append(el('g',{'data-foundation-part':name}));
    const frontHands=el('g',{'data-foundation-front-hand':'true',transform:body.getAttribute('transform')}),bones=el('g',{'data-foundation-bones':'true',transform:body.getAttribute('transform'),'pointer-events':'none',style:'display:none'});mirror.append(frontHands,bones);
    svg.dataset.foundationSkinFill=skin;svg.dataset.foundationUnderlay=underlay;
    return svg.outerHTML;
  }
  function prepare(svg){
    if(!svg?.dataset.qpFoundation)return null;if(mounted.has(svg))return mounted.get(svg);
    const skin=svg.dataset.foundationSkin,fill=svg.dataset.foundationSkinFill,parts=Object.fromEntries([...svg.querySelectorAll('[data-foundation-part]')].map(e=>[e.dataset.foundationPart,e]));
    const r={svg,parts,head:svg.querySelector('[data-foundation-head]'),backHair:svg.querySelector('[data-foundation-back-hair]'),mirror:svg.querySelector('[data-foundation-mirror]'),body:svg.querySelector('[data-foundation-body]'),frontHands:svg.querySelector('[data-foundation-front-hand]'),bones:svg.querySelector('[data-foundation-bones]'),pose:null};
    const surface=parent=>{const contour=el('path',{fill,stroke:tone(skin,.78),'stroke-width':.10,'stroke-linejoin':'round'}),shade=el('path',{fill:'none',stroke:tone(skin,.88),'stroke-width':.10,'stroke-linecap':'round'});parent.append(contour,shade);return{parent,contour,shade};};
    r.legs=[surface(parts['far-leg']),surface(parts['near-leg'])];
    r.arms=[surface(parts['far-arm']),surface(parts['near-arm'])];
    for(const arm of r.arms){arm.hand=el('g');arm.parent.append(arm.hand);arm.hand.innerHTML=path('M-.43 -.32Q0 -.5 .43 -.32L.55 .45Q.4 1.02 -.1 1.02Q-.55 .95 -.52 .45L-.65 .1Q-.6 -.15 -.42 .05Z',skin,tone(skin,.78),.10)+path('M-.13 .43V.76M.1 .43V.74','none',tone(skin,.82),.065);}
    r.torso=surface(parts.torso);r.pelvis=surface(parts.pelvis);
    const neckGradient=el('radialGradient',{id:svg.dataset.foundationId+'-neck-skin',cx:'.58',cy:'.62',r:'.85'});for(const[offset,f]of[[0,1.07],[.65,1],[1,.90]])neckGradient.append(el('stop',{offset,'stop-color':tone(skin,f)}));svg.querySelector('defs').append(neckGradient);
    r.neckSurface=el('path',{'data-foundation-skin-part':'neck',fill:'url(#'+svg.dataset.foundationId+'-neck-skin)'});parts.torso.append(r.neckSurface);
    r.neckEdge=el('path',{fill:'none',stroke:tone(skin,.80),'stroke-width':.095,'stroke-linecap':'round',opacity:.65});parts.torso.append(r.neckEdge);
    r.armGradients=r.arms.map((arm,i)=>{const g=el('linearGradient',{id:svg.dataset.foundationId+'-arm-skin-'+i,gradientUnits:'userSpaceOnUse'});for(const[offset,f]of[[0,.88],[.34,1.05],[.66,1.08],[1,.92]])g.append(el('stop',{offset,'stop-color':tone(skin,f)}));svg.querySelector('defs').append(g);arm.contour.setAttribute('fill','url(#'+g.id+')');return g;});
    r.underlay=el('path',{fill:svg.dataset.foundationUnderlay,stroke:'#899780','stroke-width':.10,'data-foundation-base-layer':'true'});parts.pelvis.append(r.underlay);
    r.neckShade=el('path',{fill:'url(#'+svg.dataset.foundationId+'-neck-shadow)'});parts.torso.append(r.neckShade);
    r.boneLines=el('path',{fill:'none',stroke:'#256b78','stroke-width':.16,'stroke-dasharray':'.28 .17'});r.bones.append(r.boneLines);
    r.joints=Array.from({length:15},()=>{const dot=el('circle',{r:.28,fill:'#fffaf0',stroke:'#256b78','stroke-width':.15});r.bones.append(dot);return dot;});
    mounted.set(svg,r);return r;
  }
  function limb(a,b,c,widths){
    // Cross sections belong to the joints. Rounded corners pass through the
    // elbow/knee, rather than treating the joint as a Bezier control point.
    const d1=sub(b,a),d2=sub(c,b),l1=Math.hypot(...d1)||1,l2=Math.hypot(...d2)||1,u=d1.map(v=>v/l1),v=d2.map(x=>x/l2),nu=[-u[1],u[0]],nv=[-v[1],v[0]],corner=Math.min(.8,l1*.28,l2*.28);
    const offset=(p,d,w)=>add(p,d.map(x=>x*w)),pre=offset(b,u,-corner),post=offset(b,v,corner),bis=lerp(nu,nv,.5);
    return'M'+pt(offset(a,nu,widths[0]))+'L'+pt(offset(pre,nu,widths[1]))+'Q'+pt(offset(b,bis,widths[1]))+' '+pt(offset(post,nv,widths[1]))+'L'+pt(offset(c,nv,widths[2]))+'Q'+pt(offset(c,v,.12))+' '+pt(offset(c,nv,-widths[2]))+'L'+pt(offset(post,nv,-widths[1]))+'Q'+pt(offset(b,bis,-widths[1]))+' '+pt(offset(pre,nu,-widths[1]))+'L'+pt(offset(a,nu,-widths[0]));
  }
  function footPath(ankle,angle,profile,side){
    const t=p=>pt(add(ankle,rotate(p,angle))),sign=profile?1:side?1:-1;
    return'M'+t([-.48,-.26])+'L'+t([-.55,.82])+'Q'+t([-.75,1.30])+' '+t([-.57,1.68])+'Q'+t([.1,1.96])+' '+t([sign*1.4,1.83])+'Q'+t([sign*1.85,1.55])+' '+t([sign*1.53,1.25])+'L'+t([.43,.68])+'L'+t([.46,-.26])+'Z';
  }
  function tuckedFoot(ankle,profile,side){
    const sign=profile?1:side?-1:1,t=(x,y)=>pt([ankle[0]+sign*x,ankle[1]+y]);
    const length=profile?1.6:2.45;
    return'M'+t(-.24,-.44)+'Q'+t(.5,-.5)+' '+t(length-.55,-.28)+'Q'+t(length,-.25)+' '+t(length,.12)+'Q'+t(length-.15,.57)+' '+t(.95,.62)+'L'+t(-.24,.49)+'Z';
  }
  function seatedLeg(leg,profile,side){
    // A strongly bent knee has a rounded pose contour, not the sharp inside
    // corner of a stretched standing limb. It remains one owned leg surface.
    const outward=profile?1:side?1:-1,a=leg.root,b=leg.knee,c=leg.ankle,t=(p,x,y)=>pt([p[0]+outward*x,p[1]+y]);
    return'M'+t(a,-.75,-.7)+'Q'+t(a,.65,-1.05)+' '+t(b,.55,-.8)+'Q'+t(b,1.12,-.35)+' '+t(b,.82,.46)+'Q'+t(b,.62,.95)+' '+t(b,-.2,.95)+'L'+t(c,0,.52)+'Q'+t(c,-.42,0)+' '+t(c,0,-.5)+'L'+t(b,-.68,-.05)+'Q'+t(a,.12,.8)+' '+t(a,-.75,.7)+'Z';
  }
  function apply(svg,state={}){
    const r=prepare(svg);if(!r)return false;const pose=solve({...state,time:Number.isFinite(state.time)?state.time:performance.now()/1000}),view=pose.profile?'profile':pose.back?'back':'front';r.pose=pose;
    set(r.mirror,'transform',(pose.direction==='left'?'translate(32 0) scale(-1 1)':'')+(pose.hop?' translate(0 '+n(-pose.hop*1.7)+')':''));
    const neck=mapped(pose.torso,[16,28]);set(r.head,'transform','translate('+pt([(neck[0]-16)*BODY_SCALE.x+(pose.profile?.35:0)*pose.nod,(neck[1]-28)*BODY_SCALE.y+.42*pose.nod])+')');if(r.backHair){set(r.backHair,'transform',r.head.getAttribute('transform'));r.backHair.style.display=view==='front'?'':'none';}
    for(const h of r.head.children)h.style.display=h.dataset.foundationHeadView===view?'':'none';
    set(r.parts.torso,'transform',matrix(pose.torso));set(r.parts.pelvis,'transform',matrix(pose.torso));
    const narrow=pose.profile?.8:1;
    const torso=pose.profile?'M14.6 28.3H17.4Q19.5 29.1 19.25 31.2L18.75 34.6Q19.15 35.6 18.65 36.5Q16 37.1 13.1 36.5Q12.8 35.6 13.3 34.4L12.8 31.2Q12.6 29.5 14.6 28.3Z':'M14.6 28.3H17.4Q18.2 28.7 19.3 29.25Q20.5 29.75 20.2 31.2L19.1 34.4Q19.5 35.6 19 36.5Q16 37.1 13 36.5Q12.5 35.6 12.9 34.4L11.8 31.2Q11.5 29.75 12.7 29.25Q13.8 28.7 14.6 28.3Z';
    set(r.torso.contour,'d',torso);set(r.torso.contour,'stroke','none');set(r.torso.shade,'d',pose.back?'M14.25 30.5Q15.2 31 15.2 32.3M17.75 30.5Q16.8 31 16.8 32.3':'');
    const female=svg.dataset.qpxSex==='f',profileStart=female?'M14.5 26.10Q15.8 26.40 17.7 26.60':'M14.5 26.55Q15.8 27.02 17.7 27.15';
    const neckPath=pose.profile?profileStart+'Q17.1 28.05 17.45 29.92Q16.15 29.72 14.72 28.65Q15.15 27.62 14.5 '+(female?'26.10':'26.55')+'Z':pose.back?'M14.55 26Q16 25.65 17.45 26Q17.25 27.4 17.65 28.45L18 29.25H14L14.35 28.45Q14.75 27.4 14.55 26Z':female?'M14.4 25.55Q16 25.15 17.6 25.55Q17.75 27.2 17.5 28.4Q17.5 29.15 18 30.25H14Q14.5 29.15 14.5 28.4Q14.25 27.2 14.4 25.55Z':'M14.4 25.55Q16 25.12 17.6 25.55Q17.78 27 17.62 28.3Q17.5 29.15 18 30.25H14Q14.5 29.15 14.38 28.3Q14.22 27 14.4 25.55Z';
    set(r.neckSurface,'d',neckPath);set(r.neckShade,'d',neckPath);
    // The large head shades the top of the neck; without it the neck reads as
    // a lighter pillar pasted under the chin.
    {const g=r.svg.querySelector('[id$="-neck-shadow"]'),[top,end]=pose.profile?[26.95,27.95]:pose.back?[26.95,28.05]:female?[27.72,28.48]:[27.8,28.5];set(g,'y1',top);set(g,'y2',end);}
    set(r.neckEdge,'d',pose.profile?'M14.5 '+(female?'26.10':'26.55')+'Q15.15 27.62 14.72 28.65M17.7 '+(female?'26.60':'27.15')+'Q17.1 28.05 17.45 29.92':pose.back?'M14.55 26Q14.75 27.4 14.35 28.45M17.45 26Q17.25 27.4 17.65 28.45':female?'M14.4 25.55Q14.25 27.2 14.5 28.4Q14.5 29.15 14 30.25M17.6 25.55Q17.75 27.2 17.5 28.4Q17.5 29.15 18 30.25':'M14.4 25.55Q14.22 27 14.38 28.3Q14.5 29.15 14 30.25M17.6 25.55Q17.78 27 17.62 28.3Q17.5 29.15 18 30.25');
    set(r.pelvis.contour,'d','M12.95 35.8Q16 36.6 19.05 35.8L19.35 38.85Q18.4 39.5 17.2 39.2L16 38.45L14.8 39.2Q13.6 39.5 12.65 38.85Z');set(r.pelvis.contour,'stroke','none');
    set(r.underlay,'d',pose.floor&&pose.back?'M12.9 35.75Q16 36.45 19.1 35.75L19.75 38.65Q20.3 40.45 16 40.45Q11.7 40.45 12.25 38.65Z':'M12.9 35.75Q16 36.45 19.1 35.75L19.4 38.8Q18.35 39.45 17.25 39.05L16 38.45L14.75 39.05Q13.65 39.45 12.6 38.8Z');
    pose.legs.forEach((leg,i)=>{
      const part=r.legs[i],end=pose.floor?leg.ankle:add(leg.ankle,[0,.36]);
      set(part.contour,'d',pose.floor?seatedLeg(leg,pose.profile,i):limb(leg.root,leg.knee,end,[THIGH*narrow,.89,.49]));
      set(part.shade,'d',pose.floor?'':'M'+pt(add(lerp(leg.root,leg.knee,.75),[-.35,0]))+'Q'+pt(add(leg.knee,[-.35,0]))+' '+pt(add(leg.ankle,[-.26,.12])));
      if(!part.foot){part.foot=el('path',{fill:svg.dataset.foundationSkinFill,stroke:tone(svg.dataset.foundationSkin,.78),'stroke-width':.10,'stroke-linejoin':'round'});part.parent.append(part.foot);}
      // The foot's upper contour stays open under the ankle surface.
      set(part.foot,'d',pose.floor?tuckedFoot(leg.ankle,pose.profile,i):footPath(leg.ankle,leg.shoeAngle,pose.profile,i));part.parent.insertBefore(part.foot,part.contour);
      part.foot.style.display=pose.floor&&pose.back?'none':'';
    });
    pose.arms.forEach((arm,i)=>{
      const part=r.arms[i];set(part.contour,'d',limb(arm.shoulder,arm.elbow,arm.wrist,ARM_RADII));
      // Skin volume follows the arm, instead of a scene-wide horizontal
      // gradient or a drawn line running down the middle of the forearm.
      const v=sub(arm.wrist,arm.shoulder),length=Math.hypot(...v)||1,normal=[v[1]/length,-v[0]/length],middle=lerp(arm.shoulder,arm.wrist,.45),g=r.armGradients[i];
      for(const[k,value]of Object.entries({x1:middle[0]-normal[0]*.8,y1:middle[1]-normal[1]*.8,x2:middle[0]+normal[0]*.8,y2:middle[1]+normal[1]*.8}))set(g,k,n(value));set(part.shade,'d','');
      const angle=Math.atan2(arm.wrist[1]-arm.elbow[1],arm.wrist[0]-arm.elbow[0])-Math.PI/2;set(part.hand,'transform','translate('+pt(arm.wrist)+') rotate('+n(angle*180/Math.PI)+')');
      part.parent.style.opacity='';
    });
    const seated=pose.floor||pose.desk,armKeys=['far-arm','near-arm'];let order;
    // Seated hands rest on the knees in front; seen from behind they and the
    // climbing hands are beyond the back panel.
    if(pose.back&&(seated||pose.action==='climb'))order=['far-arm','near-arm','far-leg','near-leg','pelvis','torso'];
    else if(seated)order=['far-leg','near-leg','pelvis','torso',...armKeys];
    else if(pose.profile)order=['far-arm','far-leg','near-leg','pelvis','torso','near-arm'];
    else{
      // Hanging arms are beside the torso in front and back views, so they
      // stay visible. Only an arm swinging well past the body plane, away
      // from the viewer, passes behind the shirt (the forward arm seen from
      // behind, the back-swinging arm seen from the front).
      const behind=pose.arms.map(a=>(pose.action==='run'||pose.action==='walk')&&a.depth<-.9);
      order=['far-leg','near-leg',...armKeys.filter((k,i)=>behind[i]),'pelvis','torso',...armKeys.filter((k,i)=>!behind[i])];
    }
    const orderKey=order.join()+seated;if(r.orderKey!==orderKey){r.body.append(...order.map(k=>r.parts[k]));r.orderKey=orderKey;}
    // A greeting hand crosses in front of the hair, with the same arm geometry.
    // From behind, the raised hand is beyond the head and stays under it.
    const lifting=state.gestureProgress>.05&&state.gestureProgress<.95&&!pose.back,raised=lifting&&state.gesture==='wave'?['near-arm']:lifting&&state.gesture==='happy'?(pose.profile?['near-arm']:armKeys):[];
    if(raised.length){if(r.raisedKey!==raised.join()||raised.some(k=>r.parts[k].parentNode!==r.frontHands)){if(r.raised)r.body.append(...order.map(k=>r.parts[k]));r.frontHands.append(...raised.map(k=>r.parts[k]));r.raisedKey=raised.join();}r.raised=true;}else if(r.raised){r.body.append(...order.map(k=>r.parts[k]));r.orderKey=orderKey;r.raised=false;r.raisedKey='';}
    const points=[mapped(pose.torso,[16,28]),mapped(pose.torso,[16,32.8]),mapped(pose.torso,[16,SPEC.waist]),...pose.arms.flatMap(a=>[a.shoulder,a.elbow,a.wrist]),...pose.legs.flatMap(l=>[l.root,l.knee,l.ankle])];
    const lines=[[0,1,2],[0,3,4,5],[0,6,7,8],[2,9,10,11],[2,12,13,14]];set(r.boneLines,'d',lines.map(line=>'M'+line.map(i=>pt(points[i])).join('L')).join(''));
    points.forEach((p,i)=>{set(r.joints[i],'cx',n(p[0]));set(r.joints[i],'cy',n(p[1]));});r.bones.style.display=state.showBones?'':'none';
    svg.dataset.qpxView=view;svg.dataset.qpxViewFacing=pose.direction;svg.dataset.qpxPose=pose.action;svg.dataset.qpxSeatMode=pose.floor?'floor':pose.desk?'desk':'';
    r.svg.querySelector('.qpx-contact-shadow').style.visibility=pose.action==='climb'?'hidden':'';
    if(svg.dataset.foundationOutfit==='basic')root.QPFoundationOutfit?.apply(r,pose);
    root.QPFoundationSkin?.apply(r,pose);
    return true;
  }
  function destroy(svg){
    const r=mounted.get(svg);if(!r)return false;
    root.QPFoundationSkin?.destroy(r);root.QPFoundationOutfit?.destroy(svg);
    for(const part of Object.values(r.parts)){r.body.append(part);part.replaceChildren();part.removeAttribute('transform');}
    r.bones.replaceChildren();r.bones.style.display='none';r.frontHands.replaceChildren();for(const g of r.armGradients)g.remove();svg.querySelector('[id$="-neck-skin"]')?.remove();
    return mounted.delete(svg);
  }
  const api=Object.freeze({spec:SPEC,thigh:THIGH,armRadii:ARM_RADII,bodyScale:Object.freeze(BODY_SCALE),solve,render,prepare,apply,reset:svg=>apply(svg,{action:'idle',direction:'front',time:0}),destroy,inspect:svg=>mounted.get(svg)?.pose||null});
  root.QPAvatarFoundation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
