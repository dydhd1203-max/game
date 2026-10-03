/* Reference body v1. Shared fixed joints and authored projected seated poses. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',mounted=new WeakMap(),headCache=new Map();let serial=0;
  const SPEC=Object.freeze({version:1,waist:38.1,knee:41.3,ankle:44.15,floor:46.05,hip:[13.65,18.35],shoulder:[[12.7,29.9],[19.3,29.9]],elbow:[[12.15,34.05],[19.85,34.05]],wrist:[[12.2,36.7],[19.8,36.7]],walkSpeed:225,runSpeed:337.5});
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,n=x=>Math.round(x*10000)/10000,pt=p=>p.map(n).join(' '),rad=x=>x*Math.PI/180;
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  const rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
  const transform=(a,b,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,b[0]-c*a[0]+s*a[1],b[1]-s*a[0]-c*a[1]];};
  const mapped=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  const matrix=m=>'matrix('+m.map(n).join(' ')+')';
  function ik(a,b,l1,l2,bend){const d=sub(b,a),length=clamp(Math.hypot(...d),Math.abs(l1-l2)+.001,l1+l2-.001),angle=Math.atan2(d[1],d[0]),offset=Math.acos(clamp((l1*l1+length*length-l2*l2)/(2*l1*length),-1,1))*bend;return add(a,[Math.cos(angle+offset)*l1,Math.sin(angle+offset)*l1]);}
  function solve(input={}){
    const direction=['front','back','left','right'].includes(input.direction)?input.direction:input.facing||'front',profile=['left','right'].includes(direction),back=direction==='back';
    const action=input.action||'idle',run=action==='run',walk=run||action==='walk',floor=action==='floor-sit'||action==='sit'&&input.seatMode==='floor',desk=action==='sit'&&!floor,jump=action==='jump';
    const phase=((Number(input.phase)||0)%1+1)%1,time=Number.isFinite(input.time)?input.time:0;
    const stride=Math.sin(phase*Math.PI*2),drop=floor?5.6:desk?1.55:walk?(run?.56+.10*Math.cos(phase*Math.PI*4):.16+.09*Math.cos(phase*Math.PI*4)):jump?.15:.06*(1-Math.cos(time*2));
    const lean=profile?(run?5:walk?1.5:floor?2:0):0,torso=transform([16,SPEC.waist],[16,SPEC.waist+drop],rad(lean));
    const legs=SPEC.hip.map((hip,i)=>{
      const x=profile?(i?16.7:15.3):hip,root=mapped(torso,[x,SPEC.waist]),p=(phase+i*.5)%1;
      let ankle=[x,SPEC.ankle],knee,shoeAngle=0,contact=true;
      if(walk){const stance=run?.34:.55,air=p>=stance,t=air?(p-stance)/(1-stance):p/stance,reach=profile?(run?2.05:1.3):.28,lift=air?Math.sin(t*Math.PI)*(run?1.7:1.1):0;
        ankle=[x+(profile?mix(reach,-reach,air?1-t:t):(i?1:-1)*Math.sin(phase*Math.PI*2)*.15),SPEC.ankle-lift];contact=!air;shoeAngle=profile&&air?rad(-12*Math.sin(t*Math.PI)):0;
        if(run){const flight=Math.max(0,Math.sin((phase*.0+p-stance)*Math.PI/(1-stance)))*.10;ankle[1]-=flight;}
      }
      if(jump){const gather=input.grounded?0.1:.65;ankle=[x+(profile?-1.1:(i?-.35:.35))*gather,SPEC.ankle-1.7*gather];contact=false;shoeAngle=profile?rad(-10):0;}
      if(floor){
        // User's four-view seating reference: knees open to the sides, calves
        // return inwards, feet cross in front. Profile/back have their own
        // depth projection; no standing foot hangs below the seated pelvis.
        knee=profile?[i?19.15:17.7,i?44.9:44.25]:[i?20.55:11.45,44.45];
        ankle=profile?[i?16.6:16.1,i?45.43:44.8]:[i?17.85:14.15,back?44.8:i?45.43:44.95];
        contact=false;
      }else if(desk){knee=profile?[x+2.4,root[1]+1.8]:[x+(i?.2:-.2),root[1]+3.05];ankle=profile?[x+2.0,44.15]:[x,SPEC.ankle];}
      else if(profile)knee=ik(root,ankle,3.2,2.9,-1);
      else{
        // Sagittal bending projects into depth in a front/back view. Solving
        // it as sideways screen motion made a lifted knee splay outwards.
        const depth=walk?(run?1.55:1.0)*Math.cos(p*Math.PI*2):jump?-.8:0;
        const sagittal=ik([0,root[1]],[depth,ankle[1]],3.2,2.9,-1);
        knee=[mix(root[0],ankle[0],.5),sagittal[1]];
        ankle.depth=depth;knee.depth=sagittal[0];
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
    const wave=input.gesture==='wave',progress=clamp(Number(input.gestureProgress)||0,0,1),envelope=wave?Math.sin(Math.PI*progress):0;
    const arms=SPEC.shoulder.map((rest,i)=>{
      const side=i?1:-1,shoulder=mapped(torso,profile?[i?17.1:14.9,29.9]:rest);
      let upper=profile?[.1,4.15]:sub(SPEC.elbow[i],rest),lower=profile?[.25,2.63]:sub(SPEC.wrist[i],SPEC.elbow[i]);
      let swing=walk?rad((profile?(run?26:12):(run?8:3))*stride*(i?-1:1)):0,bend=run?rad(profile?-50:side*22):profile?rad(-5):0;
      if(floor){upper=profile?[.95,4.04]:[side*.2,4.1];lower=profile?[.85,2.45]:[-side*.55,2.59];swing=0;bend=0;}
      else if(desk){upper=profile?[1.2,4.0]:[side*.5,4.1];lower=profile?[.65,2.55]:[-side*.55,2.59];swing=0;bend=0;}
      if(jump){swing=rad(side*-12);bend=rad(side*-12);}
      if(wave&&i===1){swing=rad((-108+Math.sin(progress*Math.PI*8)*7)*envelope);bend=rad(-40*envelope);}
      const elbow=add(shoulder,rotate(upper,swing+rad(lean))),wrist=add(elbow,rotate(lower,swing+bend+rad(lean)));
      const base=sub(SPEC.elbow[i],rest),angle=Math.atan2(elbow[1]-shoulder[1],elbow[0]-shoulder[0])-Math.atan2(base[1],base[0]);
      const upperLength=Math.hypot(...sub(SPEC.elbow[i],rest)),lowerLength=Math.hypot(...sub(SPEC.wrist[i],SPEC.elbow[i]));
      const elbowDepth=Math.sqrt(Math.max(0,upperLength**2-Math.hypot(...sub(elbow,shoulder))**2));
      const wristDepth=elbowDepth+Math.sqrt(Math.max(0,lowerLength**2-Math.hypot(...sub(wrist,elbow))**2));
      return{shoulder,elbow,wrist,boneSpace:[[...shoulder,0],[...elbow,elbowDepth],[...wrist,wristDepth]],sleeve:transform(rest,shoulder,angle),angle};
    });
    return{direction,profile,back,action,phase,torso,legs,arms,floor,desk,drop,lean};
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
    const result={skin,headClip:raw.querySelector('#qpx-head-front').outerHTML,front:front.outerHTML,profile:QPAvatarDirection.headMarkup(raw,'profile'),back:QPAvatarDirection.headMarkup(raw,'back')};headCache.set(key,result);return result;
  }
  function render(av={},size=280){
    const sex=av.sex==='m'?'m':'f',base={...av,sex,hair:av.hair|| (sex==='m'?'short:1':'bob:1'),expression:av.expression||'bright:0'},heads=headViews(base),id='qpf-'+(++serial);
    const svg=el('svg',{xmlns:NS,class:'qp-pixel-avatar qp-illustrated-avatar qp-foundation-avatar','data-qp-foundation':'1','data-qpx-sex':sex,'data-foundation-id':id,'data-foundation-skin':heads.skin,viewBox:'0 0 32 62',width:size*32/56,height:size*62/56,role:'img','aria-label':(sex==='m'?'남자':'여자')+' 기준 몸',style:'display:block;overflow:visible;--qpx-viewport-scale:1.107142857;--qpx-ground-shift:2.4'});
    const defs=el('defs');svg.append(defs);const skin=pigment(defs,id+'-skin',heads.skin),underlay=pigment(defs,id+'-underlay','#d9e0d1');
    const headClip=el('g');headClip.innerHTML=heads.headClip.replaceAll('qpx-head-front',id+'-head-front');defs.append(...headClip.children);
    const skinGradient=defs.querySelector('#'+id+'-skin');skinGradient.setAttribute('gradientUnits','userSpaceOnUse');skinGradient.setAttribute('x1','10');skinGradient.setAttribute('x2','22');
    svg.append(el('ellipse',{class:'qpx-contact-shadow',cx:16,cy:56.75365,rx:6.2,ry:.60,fill:'#596654',opacity:.20}));
    const mirror=el('g',{'data-foundation-mirror':'true'}),head=el('g',{'data-foundation-head':'true'}),body=el('g',{'data-foundation-body':'true',transform:'translate(16 28) scale(1.18 1.593) translate(-16 -28)'});mirror.append(body,head);svg.append(mirror);
    for(const view of ['front','profile','back']){const v=el('g',{'data-foundation-head-view':view});v.innerHTML=heads[view].replaceAll('url(#qpx-head-front)','url(#'+id+'-head-front)');head.append(v);}
    for(const name of ['far-arm','far-leg','near-leg','pelvis','torso','near-arm'])body.append(el('g',{'data-foundation-part':name}));
    const frontHands=el('g',{'data-foundation-front-hand':'true',transform:body.getAttribute('transform')}),bones=el('g',{'data-foundation-bones':'true',transform:body.getAttribute('transform'),'pointer-events':'none',style:'display:none'});mirror.append(frontHands,bones);
    svg.dataset.foundationSkinFill=skin;svg.dataset.foundationUnderlay=underlay;
    return svg.outerHTML;
  }
  function prepare(svg){
    if(!svg?.dataset.qpFoundation)return null;if(mounted.has(svg))return mounted.get(svg);
    const skin=svg.dataset.foundationSkin,fill=svg.dataset.foundationSkinFill,parts=Object.fromEntries([...svg.querySelectorAll('[data-foundation-part]')].map(e=>[e.dataset.foundationPart,e]));
    const r={svg,parts,head:svg.querySelector('[data-foundation-head]'),mirror:svg.querySelector('[data-foundation-mirror]'),body:svg.querySelector('[data-foundation-body]'),frontHands:svg.querySelector('[data-foundation-front-hand]'),bones:svg.querySelector('[data-foundation-bones]'),pose:null};
    const surface=parent=>{const contour=el('path',{fill,stroke:tone(skin,.78),'stroke-width':.10,'stroke-linejoin':'round'}),shade=el('path',{fill:'none',stroke:tone(skin,.88),'stroke-width':.10,'stroke-linecap':'round'});parent.append(contour,shade);return{parent,contour,shade};};
    r.legs=[surface(parts['far-leg']),surface(parts['near-leg'])];
    r.arms=[surface(parts['far-arm']),surface(parts['near-arm'])];
    for(const arm of r.arms){arm.hand=el('g');arm.parent.append(arm.hand);arm.hand.innerHTML=path('M-.43 -.32Q0 -.5 .43 -.32L.55 .45Q.4 1.02 -.1 1.02Q-.55 .95 -.52 .45L-.65 .1Q-.6 -.15 -.42 .05Z',skin,tone(skin,.78),.10)+path('M-.13 .43V.76M.1 .43V.74','none',tone(skin,.82),.065);}
    r.torso=surface(parts.torso);r.pelvis=surface(parts.pelvis);
    r.underlay=el('path',{fill:svg.dataset.foundationUnderlay,stroke:'#899780','stroke-width':.10,'data-foundation-base-layer':'true'});parts.pelvis.append(r.underlay);
    r.neckShade=el('path',{fill:tone(skin,.89),opacity:.35});parts.torso.append(r.neckShade);
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
    set(r.mirror,'transform',pose.direction==='left'?'translate(32 0) scale(-1 1)':'');
    const neck=mapped(pose.torso,[16,28]);set(r.head,'transform','translate('+pt([(neck[0]-16)*1.18,(neck[1]-28)*1.593])+')');
    for(const h of r.head.children)h.style.display=h.dataset.foundationHeadView===view?'':'none';
    set(r.parts.torso,'transform',matrix(pose.torso));set(r.parts.pelvis,'transform',matrix(pose.torso));
    const narrow=pose.profile?.8:1;
    const torso=pose.profile?'M14.65 25.55Q16 25.15 17.35 25.55L17.4 28.3Q19.5 29.1 19.25 31.2L18.75 34.6Q19.15 35.6 18.65 36.5Q16 37.1 13.1 36.5Q12.8 35.6 13.3 34.4L12.8 31.2Q12.6 29.5 14.6 28.3Z':'M14.65 25.55Q16 25.15 17.35 25.55L17.4 28.3Q18.2 28.7 19.3 29.25Q20.5 29.75 20.2 31.2L19.1 34.4Q19.5 35.6 19 36.5Q16 37.1 13 36.5Q12.5 35.6 12.9 34.4L11.8 31.2Q11.5 29.75 12.7 29.25Q13.8 28.7 14.6 28.3Z';
    set(r.torso.contour,'d',torso);set(r.torso.contour,'stroke','none');set(r.torso.shade,'d',pose.back?'M14.25 30.5Q15.2 31 15.2 32.3M17.75 30.5Q16.8 31 16.8 32.3':'');
    set(r.neckShade,'d',pose.back?'M14.6 27.2Q16 27.7 17.4 27.2L17.4 28.25Q16 28.55 14.6 28.25Z':'M14.6 26.65Q16 27.05 17.4 26.65L17.4 27.6Q16 27.9 14.6 27.6Z');
    set(r.pelvis.contour,'d','M12.95 35.8Q16 36.6 19.05 35.8L19.35 38.85Q18.4 39.5 17.2 39.2L16 38.45L14.8 39.2Q13.6 39.5 12.65 38.85Z');set(r.pelvis.contour,'stroke','none');
    set(r.underlay,'d',pose.floor&&pose.back?'M12.9 35.75Q16 36.45 19.1 35.75L19.75 38.65Q20.3 40.45 16 40.45Q11.7 40.45 12.25 38.65Z':'M12.9 35.75Q16 36.45 19.1 35.75L19.4 38.8Q18.35 39.45 17.25 39.05L16 38.45L14.75 39.05Q13.65 39.45 12.6 38.8Z');
    pose.legs.forEach((leg,i)=>{
      const part=r.legs[i],end=pose.floor?leg.ankle:add(leg.ankle,[0,.36]);
      set(part.contour,'d',pose.floor?seatedLeg(leg,pose.profile,i):limb(leg.root,leg.knee,end,[1.25*narrow,.89,.49]));
      set(part.shade,'d',pose.floor?'':'M'+pt(add(lerp(leg.root,leg.knee,.75),[-.35,0]))+'Q'+pt(add(leg.knee,[-.35,0]))+' '+pt(add(leg.ankle,[-.26,.12])));
      if(!part.foot){part.foot=el('path',{fill:svg.dataset.foundationSkinFill,stroke:tone(svg.dataset.foundationSkin,.78),'stroke-width':.10,'stroke-linejoin':'round'});part.parent.append(part.foot);}
      // The foot's upper contour stays open under the ankle surface.
      set(part.foot,'d',pose.floor?tuckedFoot(leg.ankle,pose.profile,i):footPath(leg.ankle,leg.shoeAngle,pose.profile,i));part.parent.insertBefore(part.foot,part.contour);
      part.foot.style.display=pose.floor&&pose.back?'none':'';
    });
    pose.arms.forEach((arm,i)=>{
      const part=r.arms[i];set(part.contour,'d',limb(arm.shoulder,arm.elbow,arm.wrist,[.88,.65,.42]));
      set(part.shade,'d','M'+pt(add(lerp(arm.shoulder,arm.elbow,.65),[i?-.22:.22,0]))+'Q'+pt(arm.elbow)+' '+pt(add(arm.wrist,[i?-.2:.2,0])));
      const angle=Math.atan2(arm.wrist[1]-arm.elbow[1],arm.wrist[0]-arm.elbow[0])-Math.PI/2;set(part.hand,'transform','translate('+pt(arm.wrist)+') rotate('+n(angle*180/Math.PI)+')');
      part.parent.style.opacity=pose.profile&&!i?'.85':'';
    });
    const seated=pose.floor||pose.desk,order=pose.floor&&!pose.back?['far-arm','pelvis','far-leg','near-leg','torso','near-arm']:pose.profile?['far-arm','far-leg','near-leg','pelvis','torso','near-arm']:pose.back?['far-arm','near-arm','far-leg','near-leg','pelvis','torso']:['far-leg','near-leg','far-arm','near-arm','pelvis','torso'];
    // Bent running forearms cross in front of the belly. Hiding the entire
    // arm behind the torso erased both hands in the front-facing run cycle.
    if(seated&&!pose.back||pose.action==='run'&&!pose.profile&&!pose.back){order.splice(order.indexOf('far-arm'),1);order.splice(order.indexOf('near-arm'),1);order.push('far-arm','near-arm');}
    const orderKey=order.join()+seated;if(r.orderKey!==orderKey){r.body.append(...order.map(k=>r.parts[k]));r.orderKey=orderKey;}
    // A greeting hand crosses in front of the hair, with the same arm geometry.
    const raised=state.gesture==='wave'&&state.gestureProgress>.05&&state.gestureProgress<.95;
    if(raised){r.frontHands.append(r.parts['near-arm']);r.raised=true;}else if(r.raised){r.body.append(r.parts['near-arm']);r.orderKey='';r.raised=false;}
    const points=[mapped(pose.torso,[16,28]),mapped(pose.torso,[16,32.8]),mapped(pose.torso,[16,SPEC.waist]),...pose.arms.flatMap(a=>[a.shoulder,a.elbow,a.wrist]),...pose.legs.flatMap(l=>[l.root,l.knee,l.ankle])];
    const lines=[[0,1,2],[0,3,4,5],[0,6,7,8],[2,9,10,11],[2,12,13,14]];set(r.boneLines,'d',lines.map(line=>'M'+line.map(i=>pt(points[i])).join('L')).join(''));
    points.forEach((p,i)=>{set(r.joints[i],'cx',n(p[0]));set(r.joints[i],'cy',n(p[1]));});r.bones.style.display=state.showBones?'':'none';
    svg.dataset.qpxView=view;svg.dataset.qpxViewFacing=pose.direction;svg.dataset.qpxPose=pose.action;svg.dataset.qpxSeatMode=pose.floor?'floor':pose.desk?'desk':'';
    return true;
  }
  function destroy(svg){
    const r=mounted.get(svg);if(!r)return false;
    for(const part of Object.values(r.parts)){r.body.append(part);part.replaceChildren();part.removeAttribute('transform');}
    r.bones.replaceChildren();r.bones.style.display='none';r.frontHands.replaceChildren();
    return mounted.delete(svg);
  }
  const api=Object.freeze({spec:SPEC,solve,render,prepare,apply,reset:svg=>apply(svg,{action:'idle',direction:'front',time:0}),destroy,inspect:svg=>mounted.get(svg)?.pose||null});
  root.QPAvatarFoundation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
