/* Reference body v2. Joints, proportions and garments traced from the approved
   reference sheet (assets/avatar-reference-candidates/body-study-2026-10-04.png,
   tools/build-reference-body.py). Shared fixed joints, authored seated poses. */
(function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg',mounted=new WeakMap(),headCache=new Map();let serial=0;
  // Body-local units: reference sheet pixels × 17.5/286 from the collar row
  // (16, 28.55). Values are the male front joints that tools/build-reference-
  // body.py derives from 기준캐릭터-조사/ref/measure-raw.json, made symmetric.
  const SPEC=Object.freeze({version:2,waist:38.16,knee:42,ankle:44.21,floor:46.05,collar:28.55,hip:[13.95,18.05],shoulder:[[12.02,30.26],[19.98,30.26]],profileShoulder:[[15.77,30.26],[15.8,30.26]],profileHip:[16,16],elbow:[[11.54,34.18],[20.46,34.18]],wrist:[[11.27,36.41],[20.73,36.41]],thigh:3.84,shin:2.21,profileArm:[4,2.77],profileSwing:[.41,3.98],profileFlex:[.31,2.75],walkSpeed:337.5,runSpeed:506.25});
  // The female sheet has its own joints (same derivation, female figures);
  // one shared rig made her limbs and garments slip against each other.
  const SPEC_F=Object.freeze({...SPEC,waist:37.75,knee:41.73,ankle:44.23,hip:[14.06,17.94],shoulder:[[12.09,30.25],[19.91,30.25]],profileShoulder:[[15.78,30.25],[15.81,30.25]],elbow:[[11.56,34.06],[20.44,34.06]],wrist:[[11.26,36.18],[20.74,36.18]],thigh:3.98,shin:2.5,profileArm:[3.9,2.44],profileSwing:[.395,3.876],profileFlex:[.253,2.42]});
  const specFor=sex=>sex==='f'?SPEC_F:SPEC;
  // Independently traced neck-only boundaries on the original short/bob
  // directional paintings: the sheet supplies the neck, so the paintings'
  // own neck stubs and their outlines go. Curves keep hair over the nape;
  // where a cut crosses hair it follows the painted strand edges, never a
  // smooth or straight line. Male back keeps the strokes framing the nape
  // and cuts only below the collar. Male side has no painted neck: its cut
  // only trims the soft fringe under the jaw and stays right of the nape
  // hair (x>=14.3), so no strand tip is clipped. Female side needs no cut:
  // its grey under-jaw 'patch' was hair repainted as skin by the profile
  // neck-skin rule (avatar-direction.js), now fixed at the source. Rules:
  // 아바타-제작기준.md 머리–목 연결 규칙.
  const HEAD_NECK_CUT={
    m:{front:'M12.8 28.65Q13.45 28.45 13.6 27.98Q13.9 27.78 14.3 27.9V31H12.8ZM19.2 28.65Q18.55 28.45 18.4 27.98Q18.1 27.78 17.7 27.9V31H19.2Z',profile:'M14.42 25.783Q15.779 26.416 18.55 26.67Q18.2 27.6 18.5 28.3L18.7 29.4H14.3V26.3Z',back:'M11.5 27.6H13.06Q15.9 27.95 18.56 27.56H20.5V30H11.5Z'},
    f:{}
  };
  // The thigh top is covered by the shorts; a wider root poked out beside
  // the shorts' curved hip as a pale skin tab.
  const THIGH=1.05,LEG_RADII=Object.freeze([THIGH,1.04,.7]);
  // One uniform presentation scale for the body. The original painted head is
  // larger than the reference sheet's head relative to the body; it is drawn
  // at HEAD_SCALE about the neck and the whole figure at STAGE_SCALE about the
  // floor, so the reference proportions hold at the previous overall height.
  // The original side/back head paintings are normalised smaller than the
  // front one. Reference head widths (기준캐릭터-조사): male side 0.98 and
  // back 0.945 of the front, female side 0.83 and back 0.98. [scale, drop].
  // Drops seat each chin over the sheet neck's cast shadow (its flat chin
  // sits a little above the sheet's pointed one). Female front/side were
  // raised 1.5-2.3 sheet px (2026-10-08) to the sheet's chin-to-collar
  // distance; the neck had read slightly short. An optional third value moves
  // the view forward: the male side head sits .45 (~4 sheet px) forward so its
  // nape hair meets the sheet neck's back outline as on the sheet; before, a
  // background notch reached up to the jaw (3-6 px wide in idle/run) and the
  // head silhouette sat behind the sheet's (IoU .949 -> .955).
  const VIEW_HEAD={m:{front:[1,.22],profile:[1.146,.75,.45],back:[1.21,1.05]},f:{front:[1,.15],profile:[1,.88],back:[1.074,0]}},VIEW_HEAD_PIVOT=26.7;
  const BODY_SCALE={x:1.593,y:1.593},ARM_RADII=Object.freeze([.8,.8,.7]),HEAD_SCALE=.88,STAGE_SCALE=1.0627,FLOOR_Y=56.75;
  // Old painted neck-stump strokes under every front portrait, by sex.
  const BACK_HAIR_NECK_CUT={
    f:'M14.45 28.7L14.2 29.1L13.95 29.45L13.7 29.8L13.4 30.3L12.95 30.35L12.6 29.95L12.65 29.5L13.1 29.2L13.5 28.95L13.8 28.7ZM17.55 28.7L17.9 28.7L18.4 28.95L18.95 29.2L19.4 29.5L19.4 29.95L19.05 30.35L18.6 30.3L18.3 29.8L18.05 29.45L17.8 29.1Z',
    m:'M14.1 28.2L14.05 28.9L13.85 29.3L13.6 29.85L13.3 30.35L12.75 30.4L12.35 29.9L12.35 29.4L12.85 28.95L13.2 28.6L13.3 28.2ZM17.9 28.2L18.7 28.2L18.8 28.6L19.15 28.95L19.65 29.4L19.65 29.9L19.25 30.4L18.7 30.35L18.4 29.85L18.15 29.3L17.95 28.9Z'
  };
  // Female front: below the shared jaw, hair near the neck hangs behind the
  // body, so the neck sides and collar points cover the hair ends as on the
  // sheet (the old straight cut at y 28.45 left square blocks on the collar).
  // The front layer keeps the jaw outline, tapering over the neck; elsewhere
  // the line stays at least .10 above the collar/shoulder outline of every
  // front pose (nod peak included). The back layer overlaps it by .3.
  // Head-native units; re-measure if VIEW_HEAD f.front drop, HEAD_SCALE, the
  // nod amplitude or the collar art change. 아바타-제작기준.md rule 5.
  // Front bow (2026-10-08, round 2): bowFace() keeps the boundary outside the
  // jaw where it is on the body while the face band slides down, and moves it
  // with the face only over the jaw (JAW). Measured on the render, the
  // smallest margin over the collar/shoulder outline outside the neck is .40
  // head units at the bow's peak (idle .68; round 1's .42 dip left .23).
  const FRONT_HAIR_CLIP={f:'M-1 -8H33V28.45H22.2L21.95 28.4L21.6 28.38L21.3 28.3L21.05 28.12L20.75 28.02L20.45 27.9L20.1 27.82L19.8 27.7L19.55 27.54L19.38 27.5L19.04 27.58L18.79 27.67L18.46 27.75L18.3 27.83L18.08 27.83L18 27.81L17.8 27.78L17.5 27.77L17.42 27.86L14.62 27.86L14.55 27.74L14.36 27.74L14.2 27.76L14 27.8L13.71 27.8L13.38 27.75L13.04 27.67L12.9 27.58L12.62 27.62L12.35 27.74L12.05 27.9L11.75 27.98L11.45 28.08L11.2 28.2L10.95 28.3L10.6 28.4L10.2 28.42L9.85 28.37L9.55 28.45H-1Z'},BACK_HAIR_CLIP={f:'M-1 48.2V28.2H9.55L9.85 28.07L10.2 28.12L10.6 28.1L10.95 28L11.2 27.9L11.45 27.78L11.75 27.68L12.05 27.6L12.35 27.44L12.62 27.32L12.9 27.28L13.04 27.37L13.38 27.45L13.71 27.5L14 27.5L14.2 27.46L14.36 27.44L14.55 27.44L14.62 27.56L17.42 27.56L17.5 27.47L17.8 27.48L18 27.51L18.08 27.53L18.3 27.53L18.46 27.45L18.79 27.37L19.04 27.28L19.38 27.2L19.55 27.24L19.8 27.4L20.1 27.52L20.45 27.6L20.75 27.72L21.05 27.82L21.3 28L21.6 28.08L21.95 28.1L22.2 28.2H33V48.2Z'};
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,n=x=>Math.round(x*10000)/10000,pt=p=>p.map(n).join(' '),rad=x=>x*Math.PI/180;
  const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],lerp=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
  const rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
  const transform=(a,b,angle)=>{const c=Math.cos(angle),s=Math.sin(angle);return[c,s,-s,c,b[0]-c*a[0]+s*a[1],b[1]-s*a[0]-c*a[1]];};
  const mapped=(m,p)=>[m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];
  const matrix=m=>'matrix('+m.map(n).join(' ')+')';
  function ik(a,b,l1,l2,bend){const d=sub(b,a),length=clamp(Math.hypot(...d),Math.abs(l1-l2)+.001,l1+l2-.001),angle=Math.atan2(d[1],d[0]),offset=Math.acos(clamp((l1*l1+length*length-l2*l2)/(2*l1*length),-1,1))*bend;return add(a,[Math.cos(angle+offset)*l1,Math.sin(angle+offset)*l1]);}
  const TAU=Math.PI*2,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  // The pose render() draws by itself (shop preview, profile, lists, results:
  // screens with no motion controller). reset() returns to the same pose.
  const STATIC_POSE=Object.freeze({action:'idle',direction:'front',time:0}),PART_NAMES=Object.freeze(['far-arm','far-leg','near-leg','pelvis','torso','near-arm']);
  // prefers-reduced-motion, read live on every apply(); a caller may pass
  // state.reducedMotion instead. CALM_HOP scales the happy hop under it.
  const REDUCED=root.matchMedia?.('(prefers-reduced-motion: reduce)')||null,CALM_HOP=.35;
  // Gait per leg phase p; 0 is heel strike with the foot ahead (D4/D5,
  // 기준캐릭터-조사 motion). Stance: heel strike -> foot flat -> heel off ->
  // toe off, the planted foot travelling back under the hip at one constant
  // speed. Swing is authored as thigh/knee angles (degrees from vertical,
  // forward +; knee flexion +), so the lifted knee and heel kick are drawn
  // rather than left to the solver; its ends are the stance's own toe-off and
  // heel-strike angles, so nothing pops. reach = [ahead at strike, behind at
  // toe-off] in body units. bob = hip drop keys [leg phase, drop] over one
  // step (repeats twice per cycle); the hips never stay higher than the
  // planted legs reach. Walking is highest as the legs pass (straight
  // support leg) and lowest at heel strike. Running has a short stance, a
  // flight phase (drop below zero = above the standing height), a high heel
  // kick and knee drive, and a 12 degree forward lean: it lands, sinks to
  // mid-stance, pushes off extended and rises in the air.
  // Arms: swing about the hanging rest (forward +), elbow flexion, upper-arm
  // and forearm abduction (outward +), each [mean, amplitude with the
  // opposite leg]; facing adds to the front/back views, where the swing is
  // seen end-on and is read from the bending elbow and the hand coming in.
  // Running front/back arms are authored poses instead (facingKeys, and
  // backKeys for the back view): [c, swing, flex, abduction, forearm] at the
  // swing value c (+1 = this arm fully forward), Catmull-Rom between them;
  // swing/abduction/forearm add to the rest, flex is absolute (2026-10-08
  // critic: the old forearm lay flat across the belly, the other arm hung
  // straight, and from behind both read as hands on hips). Forward end: the
  // elbow a little out and the fist up toward the chest, folded at the
  // camera (painted as a rounded elbow, arm.fold). Back end: the elbow
  // swings back and out, the hand passes behind the hip. Through mid-swing
  // the forearm hangs down-forward and only curls up as the arm comes
  // forward, so no frame lays it flat across the waist. From behind, the
  // forward arm's elbow tucks in so its curling forearm hides behind the
  // back instead of turning in at the waist.
  const GAIT={
    walk:{duty:.6,reach:[2.5,2.7],flat:.12,heel:.55,heelLift:.5,strike:-16,toe:28,swing:[[.22,-6,60],[.5,15,68],[.78,28,16]],bob:[[0,.56],[.06,.41],[.12,.25],[.2,.1],[.29,.025],[.4,.2]],lean:3,sway:.13,roll:1.7,support:.3,
      arm:{swing:[0,22],flex:[14,10],abduct:[2,-3],forearm:[-2,-7],facing:{flex:[10,15],abduct:[0,-2]}},lag:.03,frontRaise:1.9},
    run:{duty:.34,reach:[1.8,2.8],flat:.1,heel:.5,heelLift:.62,strike:-8,toe:34,swing:[[.3,-10,112],[.6,50,100],[.86,36,30]],bob:[[0,.33],[.12,.45],[.34,.18],[.42,-.1]],lean:12,sway:.06,roll:.9,support:.17,
      arm:{swing:[-4,42],flex:[86,8],abduct:[2,-2],forearm:[-27,-19],facingKeys:[[-1,-62,84,11,-27],[-.5,-36,72,8,-19],[0,-4,60,3,-19],[.25,8,60,4,-30],[.5,18,78,6,-46],[1,34,95,9,-50]],
        backKeys:[[-1,-56,82,6,-4],[-.5,-32,70,3,-10],[0,-4,60,-3,-19],[.25,8,60,-6,-34],[.5,18,78,-6,-45],[1,34,95,-6,-47]]},lag:.02,frontRaise:1.5}
  };
  // Screen drop per body unit of walking depth in front/back views.
  const GROUND_TILT=.3;
  // Share of a profile lean the neck takes back at the collar (solve()).
  const NECK_TAKE=.7;
  // Cubic through authored keys [s, ...values] (Catmull-Rom tangents).
  function keyed(keys,s,k){
    let j=0;while(j<keys.length-2&&s>keys[j+1][0])j++;
    const a=keys[j],b=keys[j+1],h=b[0]-a[0]||1,t=clamp((s-a[0])/h,0,1),slope=(i)=>{const p=keys[Math.max(0,i-1)],q=keys[Math.min(keys.length-1,i+1)];return(q[k]-p[k])/(q[0]-p[0]||1)*h;};
    const m0=slope(j),m1=slope(j+1),t2=t*t,t3=t2*t;
    return(2*t3-3*t2+1)*a[k]+(t3-2*t2+t)*m0+(-2*t3+3*t2)*b[k]+(t3-t2)*m1;
  }
  const legAngles=(d,lt,ls)=>{const l=clamp(Math.hypot(...d),Math.abs(lt-ls)+.002,lt+ls-.002),knee=Math.acos(clamp((lt*lt+ls*ls-l*l)/(2*lt*ls),-1,1)),inner=Math.acos(clamp((lt*lt+l*l-ls*ls)/(2*lt*l),-1,1));return[(Math.atan2(d[0],d[1])+inner)*180/Math.PI,180-knee*180/Math.PI];};
  // Hip drop: the bob keys repeat every half cycle (each leg's step).
  const hipDrop=(g,p)=>{const k=g.bob,P=.5,x0=k[0][0],x=x0+(((p-x0)%P)+P)%P,shift=(d)=>([t,v])=>[t+d,v];return keyed([...k.slice(-2).map(shift(-P)),...k,...k.slice(0,2).map(shift(P))],x,1);};
  // One leg at leg phase p, relative to its hip: [forward, height of the
  // ankle above its planted height], the shoe angle, heel contact and whether
  // the foot is on the ground at all. lt/ls are this view's bones; height is
  // the hip-to-planted-ankle distance. reach is in body units: the stride is
  // one ground distance for every view and sex.
  function step(g,p,lt,ls,height){
    const reach=g.reach,stance=u=>{const heel=smooth(g.heel,1,u);return{forward:mix(reach[0],-reach[1],u),lift:g.heelLift*heel,toe:mix(g.strike,0,smooth(0,g.flat,u))+g.toe*heel,contact:heel<=0,stance:true};};
    if(p<g.duty)return stance(p/g.duty);
    const s=(p-g.duty)/(1-g.duty),end=u=>{const st=stance(u);return legAngles([st.forward,height-hipDrop(g,u?g.duty:0)-st.lift],lt,ls);};
    const [t0,k0]=end(1),[t1,k1]=end(0),keys=[[0,t0,k0],...g.swing,[1,t1,k1]],thigh=rad(keyed(keys,s,1)),knee=rad(Math.max(0,keyed(keys,s,2))),shin=thigh-knee;
    const down=height-hipDrop(g,p),forward=lt*Math.sin(thigh)+ls*Math.sin(shin),lift=Math.max(0,down-lt*Math.cos(thigh)-ls*Math.cos(shin));
    // The foot follows the shin part of the way (the big shoes read as a
    // flip when held square to it), toes relaxing down after toe-off and
    // turning up again just before the heel lands.
    const hang=Math.min(80,-shin*180/Math.PI*.6+4),toe=mix(mix(g.toe,hang,smooth(0,.3,s)),g.strike,smooth(.78,1,s));
    return{forward,lift,toe,contact:false,stance:false};
  }
  // Jump (D8), pose to pose. The game sends grounded+jumpCompression for the
  // take-off crouch and the landing (jumpStage tells them apart; the studio
  // and contact sheets omit it, so the first half of a cycle is take-off)
  // and vy in the air (+480 launch, 0 apex, -480 touchdown) as flight 0..1.
  // Degrees. leg: thigh angle from vertical (forward +) and knee flex for the
  // near then the far leg; splay turns front/back knees out about the hip so
  // a bend reads head-on. profile: screen swing and elbow flex of the near
  // then the far arm. front: swing, abduction, forearm, flex as in the rest
  // model; back: the same for the back view.
  const JUMP={
    // Take-off: knees forward, hips back, chest over the knees, arms swung
    // behind.
    takeoff:{drop:1.45,lean:13,hips:-.55,splay:16,profile:[-50,20,-58,26],front:[-34,22,18,16],back:[-34,22,18,16]},
    // Landing: a deeper give; the arms come down in front for balance.
    landing:{drop:1.6,lean:11,hips:-.45,splay:18,profile:[30,42,12,40],front:[24,30,44,24],back:[24,30,44,24]},
    // Flight legs: launch (legs straight, toes pointed), apex (knees tucked
    // up), fall (legs reach down), touchdown.
    air:[
      {f:0,leg:[-6,8,-3,6],toe:32,lean:3,splay:2},
      {f:.16,leg:[30,64,22,52],toe:24,lean:4,splay:8},
      {f:.46,leg:[58,112,50,102],toe:16,lean:7,splay:12},
      {f:.74,leg:[30,54,24,44],toe:6,lean:4,splay:6},
      {f:1,leg:[12,18,8,14],toe:-3,lean:4,splay:4}
    ],
    // Flight arms (2026-10-08 critic: the old launch held both arms straight
    // out at chin height for four poses, sleepwalker arms; head-on fists read
    // as a boxing guard, from behind a shrug). The arms swing up THROUGH the
    // launch to a brief peak and come down by the apex:
    //  - side: the near arm reaches up and forward, the far arm still trails
    //    behind, so the pair never moves as one parallel bar (the big head
    //    allows no overhead reach; the near hand stays ahead of and under the
    //    chin); the elbows then fold in front of the chest at the apex,
    //    split forward/back for balance on the fall, reach forward to land;
    //  - head-on and from behind: a raised V beside the head (lift: rigid
    //    sleeves, underarm cloth, open hands, as the cheer), lowered with the
    //    elbows leading and the hands trailing (no straight T), out and down
    //    for balance on the fall, forward-down to land.
    airArms:[
      {f:0,profile:[98,24,-30,30],front:[10,116,132,10],back:[8,116,132,10]},
      {f:.12,profile:[104,22,-8,40],front:[8,126,142,8],back:[6,126,142,8]},
      {f:.25,profile:[82,42,14,58],front:[10,122,140,8],back:[8,122,140,8]},
      {f:.36,profile:[63,60,17,64],front:[12,92,134,10],back:[10,92,132,10]},
      {f:.46,profile:[42,82,20,70],front:[18,48,54,16],back:[16,48,54,16]},
      {f:.74,profile:[16,30,-36,30],front:[20,38,36,14],back:[18,38,36,14]},
      {f:1,profile:[30,28,-14,28],front:[24,26,24,20],back:[22,26,24,20]}
    ]
  };
  // Catmull-Rom through flight keys: continuous speed, no hold at a key.
  function airKeys(K,f){
    const i=clamp(K.findIndex(k=>k.f>=f)-1,0,K.length-2),u=clamp((f-K[i].f)/(K[i+1].f-K[i].f),0,1),[a,b,c,d]=[K[Math.max(0,i-1)],K[i],K[i+1],K[Math.min(K.length-1,i+2)]];
    const cr=(p0,p1,p2,p3)=>p1+.5*u*(p2-p0+u*(2*p0-5*p1+4*p2-p3+u*(3*(p1-p2)+p3-p0)));
    const each=(x,y,z,w)=>typeof y==='number'?cr(x,y,z,w):y.map((_,k)=>each(x[k],y[k],z[k],w[k]));
    return Object.fromEntries(Object.keys(b).map(k=>[k,each(a[k],b[k],c[k],d[k])]));
  }
  const jumpAir=f=>({...airKeys(JUMP.air,f),...airKeys(JUMP.airArms,f)});
  // Arms use one body-frame model in every view: swing (forward +),
  // abduction (outward +) and elbow flexion (forward +). The screen keeps
  // x/y and depth carries the foreshortening, so bone lengths never change.
  // Rest arm angles of a spec: front abduction and forearm from the joints,
  // profile swing and elbow flex from the side-view sheet.
  const restOf=S=>Object.freeze({abduction:Math.atan2(S.shoulder[0][0]-S.elbow[0][0],S.elbow[0][1]-S.shoulder[0][1]),forearm:Math.atan2(S.elbow[0][0]-S.wrist[0][0],S.wrist[0][1]-S.elbow[0][1]),swing:Math.atan2(...S.profileSwing),flex:Math.atan2(...S.profileFlex)-Math.atan2(...S.profileSwing)});
  const RESTS={m:restOf(SPEC),f:restOf(SPEC_F)},restFor=sex=>RESTS[sex==='f'?'f':'m'];
  // Rest joints of one view. Front and back paintings differ by a few pixels
  // (the back is narrower at the shoulders), so each view's garments and
  // limbs sit on that view's own sheet joints; profile uses the spec.
  const rigs=new Map();
  function rigFor(sex,view){
    const key=(sex==='f'?'f':'m')+view;if(rigs.has(key))return rigs.get(key);
    let S=specFor(sex);const F=root.QPFoundationReferenceData?.figures[key[0]+'-'+(view==='profile'?'right':view)];
    if(F){
      const L=p=>[16+(p[0]-F.neck[0])*F.k,S.collar+(p[1]-F.neck[1])*F.k],J=F.joints,y=k=>(L(J[k][0])[1]+L(J[k][1])[1])/2,waist=y('hip'),knee=y('knee'),ankle=y('ankle'),sub2=(a,b)=>[a[0]-b[0],a[1]-b[1]];
      const legs={hip:J.hip.map(p=>L(p)[0]),ankleX:J.ankle.map(p=>L(p)[0]),waist,knee,ankle,thigh:knee-waist,shin:ankle-knee};
      if(view==='profile'){const sh=L(J.shoulder[0]),el=L(J.elbow[0]),wr=L(J.wrist[0]),up=sub2(el,sh),lo=sub2(wr,el);
        S=Object.freeze({...S,...legs,profileHip:legs.hip,profileShoulder:[sh,[sh[0]+.03,sh[1]]],profileArm:[Math.hypot(...up),Math.hypot(...lo)],profileSwing:up,profileFlex:lo});}
      else S=Object.freeze({...S,...legs,shoulder:J.shoulder.map(L),elbow:J.elbow.map(L),wrist:J.wrist.map(L)});
    }
    rigs.set(key,S);return S;
  }
  const bodyVector=(swing,abduct)=>[Math.sin(abduct),Math.cos(abduct)*Math.cos(swing),Math.cos(abduct)*Math.sin(swing)];
  function view3d(v,side,view,near){return view==='profile'?[v[2],v[1],(near?1:-1)*v[0]]:view==='back'?[side*v[0],v[1],-v[2]]:[side*v[0],v[1],v[2]];}
  // Seated poses are each ONE 3D pose in body space (outward from the body
  // midline on that limb's side, down, forward), seen from every view, so
  // the four views agree. Angles in degrees; lengths in body units.
  // floor (아빠다리, user's four-view seating reference): pelvis on the floor,
  //   thighs open forward and out to the sides with the knees low (the
  //   reference's knees sit near the floor beside the crossed feet), shins
  //   folded inward in front of the pelvis. Each ankle stays at standing
  //   height, so its shoe lies on the floor with the toe pointing across to
  //   the other side and the two feet cross in front, tucked under the
  //   shins (2026-10-08 round 2: drawn over the shins, the two big shoes
  //   filled the whole band below the shirt). The far (screen-left) foot
  //   sits a little higher, so the near foot crosses in front. The arms hang
  //   straight down to the hands resting inside the knees, as in the front
  //   reference.
  // desk: pelvis on a chair seat, thighs level and forward (foreshortened in
  //   front and back views), knees a little apart, shins down to flat feet
  //   set slightly in and back under the knees; forearms forward, in and a
  //   little down onto the desk (round 2: a level forearm read as holding a
  //   tray in the side view).
  const SEATED=Object.freeze({
    // The side view is drawn for reading, as in the user's side reference
    // (round 2: before, the shirt reached the floor, no knee showed and the
    // hand rested on a shoe, reading as squatting behind it): the thighs
    // leave the front of the seat (`hip`, body units ahead of the hip joint),
    // the near knee sits out in front of the shirt near the floor, its shin
    // folds back under the thigh (the near foot tucked away, hidden), and the
    // child leans `lean` degrees over the knees with the hand on the knee;
    // only the far foot's toe peeks out under the near knee.
    floor:Object.freeze({seat:1.6,out:33,rise:14,fold:[12,4],lift:[.12,0],lean:3,toe:7,hand:[.75,1.15,-.3],side:Object.freeze({out:6,rise:22,fold:[8,70],lift:[0,-.75],lean:10,hip:1.1})}),
    desk:Object.freeze({drop:3.55,out:12,shinTilt:8,shinIn:14,lean:3,swing:14,abduct:8,reach:68,inward:36})
  }),SEATED_BREATH=Object.freeze({rise:.14,steps:3});
  // Two-bone reach in 3D; the elbow bends toward the pole. Target beyond the
  // arm is pulled back onto it, so bone lengths never change.
  function ik3(target,a,b,pole){
    const d=clamp(Math.hypot(...target),Math.abs(a-b)+.001,(a+b)*.999),u=target.map(v=>v/(Math.hypot(...target)||1)),x=(a*a-b*b+d*d)/(2*d),r=Math.sqrt(Math.max(0,a*a-x*x));
    const dot=pole.reduce((s,v,k)=>s+v*u[k],0),perp=pole.map((v,k)=>v-dot*u[k]),pl=Math.hypot(...perp)||1;
    return{elbow:u.map((v,k)=>v*x+perp[k]/pl*r),wrist:u.map(v=>v*d)};
  }
  // Two bones in 3D (x, y, z toward the camera): both lengths stay exact and
  // the joint bends toward `pole`; foreshortening goes into depth.
  function ik3at(a,b,l1,l2,pole){
    const d=b.map((v,i)=>v-a[i]),h=Math.hypot(...d)||1e-6,L=clamp(h,Math.abs(l1-l2)+.001,l1+l2-.001),u=d.map(v=>v/h),along=pole.reduce((s,v,i)=>s+v*u[i],0);
    let q=pole.map((v,i)=>v-along*u[i]);const ql=Math.hypot(...q)||1;q=q.map(v=>v/ql);
    const ca=clamp((l1*l1+L*L-l2*l2)/(2*l1*L),-1,1),sa=Math.sqrt(1-ca*ca);
    return[a.map((v,i)=>v+l1*(ca*u[i]+sa*q[i])),a.map((v,i)=>v+L*u[i])];
  }
  // Ladder climbing (D12; the climber always shows its back). One virtual
  // ladder: hands hold the rails at 16±6.2 (the painted map ladders' rails are
  // 16±6.0–6.6 at the default camera; at 5.7 the hands floated inside them).
  // The female bob is 8.0-8.5 wide at grip height, so her upper grips stay
  // behind the hair within the painted rails; only the lower grip shows.
  // Each limb climbs one step of `rise` per cycle (2026-10-08, round 2: was
  // ~4.5, about two thirds of a painted rung; school-room-world turns climbed
  // world pixels into phase with it, so holds stay put on the map). Big steps
  // keep the cadence down: at the maps' 112-118 px/s about 6.5 cycles a second.
  // The feet stand on rungs. A hand and the opposite foot move together
  // while the other pair holds. A holding limb slides down the body frame at
  // the climbing rate (`rise` per cycle), so it stays on its rung while the
  // body goes up; played backwards (phase falls while descending) the same
  // cycle reaches down and holds while the body sinks. Bone lengths are
  // fixed, so the arms cannot reach over the big head: the top grip is the
  // arm at 97% reach beside the ear, with the hand behind the head; the
  // lowest grip keeps the forearm upright beside the head (a lower grip folds
  // the short forearm under its own sleeve and leaves the elbow sticking out
  // like a hand). Knees open a little (ladder knees) so the bend reads from
  // behind instead of disappearing into depth.
  const CLIMB=Object.freeze({rail:6.2,handZ:-1.2,footZ:-1,palm:.7,reach:.97,low:-1.9,step:3.3,handDuty:.55,poleHigh:[1,.5,.2],poleLow:[.8,1,.2],poleRest:[.25,1,.15],knee:[.7,0,-1],roll:2.5,sway:.15});
  // One limb over a cycle: hold (sliding down, pos 0→1), then lift off and
  // reach up again (pos 1→0, lift 0→1→0 away from the ladder).
  function climbStep(u,duty){if(u<duty)return{pos:u/duty,lift:0};const s=(u-duty)/(1-duty);return{pos:1-smooth(0,1,s),lift:Math.sin(Math.PI*s)};}
  // Grip heights, rise and timing of one sex's back-view rig. Each limb moves
  // two rungs per cycle, so rungs are rise/2 apart. The rise is the n-rung
  // distance between a landing foot's sole and its partner hand's palm, picked
  // so a foot holds at least half the cycle (one foot is always on a rung)
  // and the hands hold ~72% of it.
  function climbRig(S){
    const C=CLIMB,shoulder=S.shoulder[1],hand=Math.hypot(...sub(S.elbow[1],shoulder))+Math.hypot(...sub(S.wrist[1],S.elbow[1])),dx=16+C.rail-shoulder[0];
    const handHigh=shoulder[1]-Math.sqrt(Math.max(0,(C.reach*hand)**2-dx*dx-C.handZ**2)),handLow=shoulder[1]+C.low,travel=handLow-handHigh;
    // The hand's shorter move is centred in its partner foot's move, so the
    // hand has slid (travel−step)/2 below its top grip when the foot lands.
    const footLow=S.waist+Math.sqrt((C.reach*(S.thigh+S.shin))**2-C.footZ**2),span=footLow+S.floor-S.ankle-(handHigh-C.palm)-C.step-(travel-C.step)/2;
    let rise=0;for(let n=3;n<=14;n++){const d=2*span/n;if(C.step/d>=.5&&travel/d<=.88&&(!rise||Math.abs(travel/d-C.handDuty)<Math.abs(travel/rise-C.handDuty)))rise=d;}
    rise||=2*C.step;
    return{handHigh,handLow,footLow,step:C.step,rise,rung:rise/2,handDuty:travel/rise,footDuty:C.step/rise,lead:(travel-C.step)/rise/2};
  }
  // Gestures run over progress 0..1 (1.5 s in the maps).
  // Wave: the forearm leads the raise and trails the lowering, so the arm
  // never passes through a straight horizontal line; the upper arm then
  // stays put and only the forearm and hand wave.
  function waveTimeline(p){
    const up=smooth(0,.2,p)*(1-smooth(.8,.97,p));
    // The hand follows the forearm's wag a little late (a loose wrist).
    const hold=smooth(.12,.26,p)*(1-smooth(.74,.86,p));
    return{up,wag:Math.sin(TAU*3*(p-.2))*hold,turn:Math.sin(TAU*3*(p-.2)-1.1)*hold};
  }
  // Bow (고개 인사), twice: a quick dip, a short hold, a slower rise.
  function bowTimeline(p){let b=0;for(const a of [.03,.51]){const u=(p-a)/.46;if(u>0&&u<1)b=Math.max(b,smooth(0,.32,u)*(1-smooth(.56,1,u)));}return b;}
  // Happy: an anticipation crouch, two hops (air [start, end, height]) and
  // a squash on each landing ([start, end, deepest point, depth]).
  const HAPPY_HOPS=[[.1,.4,1],[.52,.8,.86]],HAPPY_SQUASH=[[0,.1,.7,.8],[.4,.52,.35,1],[.8,.95,.3,.85]],HAPPY_HEIGHT=3.4;
  // Bow: upper-body lean and head pitch on top of it (deg), the pivot at the
  // nape (the hair over the back of the neck stays on it; a pivot at the
  // neck centre lifted the female side lock off the jaw) and the front/back
  // jaw line (stage units).
  const BOW_LEAN=6,BOW_PITCH=13,BOW_PIVOT=[14.7,27.5],BOW_JAW=27.6;
  // Front/back bow (2026-10-08, round 2; the maps always show gestures from
  // the front, where a .42 head dip with 8% foreshortening was invisible at
  // 120 px). The knees give a little (BOW_DIP body units) and the arms hang
  // forward; the head tips: front, the face slides down under the bangs while
  // the crown barely moves and the chin tucks over the neck (BOW_FACE: brow
  // line and chin [male, female], crown/brow/chin shifts in head units per
  // sex, applied as a two-band warp in apply()). The female chin stays over
  // the neck: her front hair boundary cuts the chin flat there, which over the
  // cream collar showed as a straight edge. Back: the head foreshortens about
  // the nape.
  const BOW_DIP=.6,BOW_SWING=10,BOW_HANDS=26,BOW_FACE={brow:[19.2,21.2],chin:[27.9,28.5],shift:[[.5,3,2.3],[.7,2.8,.55]]},BOW_BACK=.15;
  function happyTimeline(p){
    let lift=0,tuck=0,squash=0;
    for(const[a,b,k]of HAPPY_HOPS)if(p>a&&p<b){const u=(p-a)/(b-a);lift=k*4*u*(1-u);tuck=k*Math.sin(Math.PI*u);}
    for(const[a,b,peak,k]of HAPPY_SQUASH)if(p>=a&&p<=b){const u=(p-a)/(b-a);squash=k*(u<peak?smooth(0,peak,u):1-smooth(peak,1,u));}
    return{lift,tuck,squash,arms:smooth(.03,.16,p)*(1-smooth(.84,1,p))};
  }
  // Raised gesture arms. Profile wave: degrees (forward +), the forearm an
  // absolute sagittal angle; the wave hand is held in front of the chin,
  // never over the face.
  const GESTURE_ARMS={wave:{profile:{swing:[86,88],forearm:[134,142],abduct:14,wag:9}}};
  // Front/back gestures and the profile cheer (2026-10-08, round 2) are
  // direction keys in the body frame, each [swing, abduction] in degrees as
  // bodyVector takes them, slerped from the arm's own rest direction. Tweening
  // the angles instead swung the forearm out sideways: the wave's first and
  // last frames read as presenting an open palm, and the cheer passed a T.
  // A raise goes rest -> mid (the elbow out and a little forward, the forearm
  // coming up in front of it, the hand still closed) -> held pose; lowering
  // plays it backwards. Held poses keep the open hands outside the reference
  // heads (silhouettes measured on the render, body units from the midline:
  // male 7.3-7.9 beside the face, the female bob 8.0-8.5 at cheek height and
  // ~7.1 at the jaw), [male, female]. Clear of the bob, a raised hand passes
  // the 32-unit stage by up to ~2.5 units: map actors (.sr-avatar>svg) and the
  // studio stage draw overflow, and only these two screens play gestures.
  const GESTURE_KEYS={
    wave:{
      mid:{upper:[40,40],fore:[155,-6]},
      // The female wag swings mostly outward: inward it reached the bob.
      front:{upper:[[8,106],[8,114]],fore:[[8,154],[8,140]],wag:15,wagIn:[1,.3]},
      back:{upper:[[4,104],[4,113]],fore:[[4,152],[4,142]],wag:15,wagIn:[1,.3]}
    },
    happy:{
      // Raising and lowering, the elbows bend and the forearms come up in
      // front of them (end-on from the front), so the arms never pass straight
      // and level (a T) nor a forearm held out sideways.
      mid:{upper:[25,62],fore:[160,-8]},
      // The female V is lower and straighter: her bob fills the space beside
      // the head that the male hands use (the bones cannot reach past it).
      front:{upper:[[6,128],[6,125]],fore:[[6,140],[6,126]],pump:[5,2]},
      back:{upper:[[0,127],[0,125]],fore:[[0,139],[0,126]],pump:[5,2]},
      // Profile cheer: a fist pump ('아자!'). Both fists punch up ahead of the
      // chin on each hop and pull back to the chest on each landing, elbows
      // bent (an arm held out forward read as sleepwalking or offering).
      // Ahead of the face the hands cannot rise past the chin (the bones
      // cannot reach around the large head): higher they cover the face,
      // straight up they sat on the hair and read as patting the head.
      // [male, female] x [far, near]; the far fist sits a little lower.
      profile:{mid:{upper:[30,8],fore:[122,4]},sexes:[
        {down:[{upper:[14,8],fore:[112,4]},{upper:[20,10],fore:[120,6]}],up:[{upper:[74,8],fore:[138,4]},{upper:[84,10],fore:[146,6]}]},
        {down:[{upper:[14,8],fore:[112,4]},{upper:[20,10],fore:[120,6]}],up:[{upper:[76,8],fore:[142,4]},{upper:[86,10],fore:[152,6]}]}
      ]}
    }
  };
  const slerp=(a,b,t)=>{const d=clamp(a[0]*b[0]+a[1]*b[1]+a[2]*b[2],-1,1),w=Math.acos(d);if(w<1e-5)return lerp(a,b,t);const s=Math.sin(w);return a.map((v,i)=>(Math.sin((1-t)*w)*v+Math.sin(t*w)*b[i])/s);};
  const armKey=k=>[bodyVector(rad(k.upper[0]),rad(k.upper[1])),bodyVector(rad(k.fore[0]),rad(k.fore[1]))];
  // [upper, forearm] directions along keys [[u, upper, forearm], ...].
  function armPath(keys,u){let j=0;while(j<keys.length-2&&u>keys[j+1][0])j++;const a=keys[j],b=keys[j+1],t=clamp((u-a[0])/((b[0]-a[0])||1),0,1);return[slerp(a[1],b[1],t),slerp(a[2],b[2],t)];}
  // Frontal turn of a body-frame direction (outward +) and sagittal tilt
  // (forward +, the profile lean correction).
  const turnOut=(v,a)=>{const r=Math.hypot(v[0],v[1]),b=Math.atan2(v[0],v[1])+a;return[r*Math.sin(b),r*Math.cos(b),v[2]];};
  const tilt=(v,a)=>[v[0],v[1]*Math.cos(a)-v[2]*Math.sin(a),v[2]*Math.cos(a)+v[1]*Math.sin(a)];
  function solve(input={}){
    const direction=input.action==='climb'?'back':['front','back','left','right'].includes(input.direction)?input.direction:input.facing||'front',profile=['left','right'].includes(direction),back=direction==='back',view=profile?'profile':back?'back':'front';
    const SPEC=rigFor(input.sex,view),REST_SWING=Math.atan2(...SPEC.profileSwing),REST_FLEX=Math.atan2(...SPEC.profileFlex)-REST_SWING;
    const action=input.action||'idle',run=action==='run',walk=run||action==='walk',floor=action==='floor-sit'||action==='sit'&&input.seatMode==='floor',desk=action==='sit'&&!floor,jump=action==='jump',climb=action==='climb',CR=climb?climbRig(SPEC):null;
    const rawPhase=((Number(input.phase)||0)%1+1)%1;
    // A cycle has 24 shared painted poses (walk ~50fps, run ~78fps in maps).
    // Quantize drawing only: world position and input timing remain continuous.
    const phase=walk||climb?Math.round(rawPhase*24)%24/24:rawPhase,time=Number.isFinite(input.time)?input.time:0;
    // Gestures also snap to drawn poses (36 over the 1.5 s gesture, 24 fps),
    // in the stepped style of the walk; the painted limbs, sleeves and
    // shorts are then reused from their caches by every avatar.
    const gait=run?GAIT.run:GAIT.walk,gesture=['wave','nod','happy'].includes(input.gesture)?input.gesture:'',progress=Math.round(clamp(Number(input.gestureProgress)||0,0,1)*36)/36;
    const air=jump&&!input.grounded,crouch=jump&&!air;
    // One jump pose: the stage key blended in by compression on the ground,
    // or the flight keys sampled by vy in the air. Like the walk, the drawn
    // pose steps (20 flight poses, 6 crouch depths) so painted limbs, shorts
    // and sleeves are reused between frames and avatars; continuous poses
    // re-warped every limb each frame (30 jumpers: 2.3x the old update time).
    const compression=crouch?Math.round((Number.isFinite(input.jumpCompression)?clamp(input.jumpCompression,0,1):1)*6)/6:0;
    const jumpKey=air?jumpAir(Math.round(clamp((1-(Number(input.vy)||0)/480)/2,0,1)*20)/20):crouch?JUMP[(input.jumpStage?input.jumpStage==='landing':rawPhase>=.5)?'landing':'takeoff']:null;
    // Idle breathing: slow, small, and shared by chest, shoulders and arms.
    // With reduced motion the rig's own clock stops: idle holds its time-0
    // pose (the static render), and a requested gesture still plays but its
    // whole-body hop is damped.
    const calm=Boolean(input.reducedMotion),breath=calm?0:(1-Math.cos(time*1.9))/2;
    const wave=gesture==='wave'?waveTimeline(progress):null,happy=gesture==='happy'?happyTimeline(progress):null,nod=gesture==='nod'?(b=>profile?b:Math.round(b*6)/6)(bowTimeline(progress)):0;
    // (Front/back bows step in sixths: the face warp, knee give and hands
    // reuse seven drawn poses. With all 36 steps distinct, 30 avatars bowing
    // at once took ~2.5x the old update; in sixths ~1.4x.)
    // Hop height in stage units; the landing squash bends the knees.
    const hop=happy?HAPPY_HEIGHT*happy.lift*(calm?CALM_HOP:1):0,squash=happy?happy.squash:0,hopTuck=happy?happy.tuck:0;
    // Walk/run legs first: a planted foot stays on the floor, so the hips sit
    // no higher than the planted legs reach (front/back keep room for roll).
    const legSpan=SPEC.thigh+SPEC.shin-.004-(profile?0:2.1*Math.sin(rad(gait.roll))),steps=walk?[0,1].map(i=>step(gait,(phase+i*.5)%1,SPEC.thigh,SPEC.shin,SPEC.ankle-SPEC.waist)):null;
    const toeIn=i=>profile&&SPEC.ankleX?SPEC.ankleX[i]-SPEC.hip[i]:0,planted=walk?Math.max(...steps.map((s,i)=>s.stance?SPEC.ankle-SPEC.waist-s.lift-Math.sqrt(Math.max(0,legSpan**2-(s.forward+toeIn(i))**2)):-9)):0;
    // Seated body space: lateral is measured from the midline with the front
    // rig's hip spacing, so every view shares one 3D pose. The cross-legged
    // hip joint sits `seat` above the floor (front rig, so turning keeps the
    // head height).
    const FRONT=rigFor(input.sex,'front'),HIP_L=(FRONT.hip[1]-FRONT.hip[0])/2;
    const drop=floor?SPEC.floor-SEATED.floor.seat-FRONT.waist:desk?SEATED.desk.drop:climb?.05:walk?Math.max(hipDrop(gait,phase),planted):crouch?.03+jumpKey.drop*compression:air?.05:.03+.07*breath+(profile?.1:BOW_DIP)*nod+.62*squash;
    // Climbing: phase 0 (the foot of the ladder) starts with one foot just
    // leaving the ground. The reaching arm's shoulder rises and the hips shift
    // over the standing (lower) foot, the lower hand's diagonal partner.
    const cphase=climb?((phase+CR.footDuty-.5)%1+1)%1:0,grips=climb?[0,1].map(i=>climbStep((cphase+CR.lead+(i?0:.5)+1)%1,CR.handDuty)):null;
    // climbIn eases a climber on and off the ladder (0: standing at its foot
    // or top, 1: climbing); the maps derive it from the climbed height, so
    // the start is not a one-frame snap from idle. Six drawn steps.
    const ease=climb?Math.round(clamp(Number.isFinite(input.climbIn)?input.climbIn:1,0,1)*6)/6:1,reachSide=climb?(grips[0].pos-grips[1].pos)*ease:0;
    const sway=climb?CLIMB.sway*reachSide:walk&&!profile?-gait.sway*Math.sin(TAU*(phase-gait.support+.25)):0,roll=climb?-CLIMB.roll*reachSide:walk&&!profile?gait.roll*sway/gait.sway:0;
    const lean=profile?(run?gait.lean:walk?gait.lean+.8*Math.cos(2*TAU*phase):floor?SEATED.floor.side.lean:desk?SEATED.desk.lean:crouch?jumpKey.lean*compression:air?jumpKey.lean:BOW_LEAN*nod+4*squash-2*hopTuck):0;
    // A side crouch sits the hips back over the heels as the knees go forward.
    const hips=profile&&crouch?jumpKey.hips*compression:0;
    const torso=transform([16,SPEC.waist],[16+sway+hips-(profile?.8*nod:0),SPEC.waist+drop],rad(profile?lean:roll));
    // Seated breathing: the chest (shirt, neck and head) and the arms rise
    // and settle in SEATED_BREATH.steps drawn steps; the seat, legs and
    // shorts stay put, so no shorts, limb or sleeve picture is rebuilt (30
    // seated avatars only move layers), and the resting hands lift only a
    // little off the knees. Reduced motion holds the first step.
    const seatBreath=(floor||desk)&&!calm?Math.round(breath*SEATED_BREATH.steps)/SEATED_BREATH.steps:0,chest=seatBreath?[...torso.slice(0,4),torso[4],torso[5]-SEATED_BREATH.rise*seatBreath]:torso;
    // One lean rule (2026-10-08): a leaning body keeps the neck nearer
    // upright (it bends at the collar, taking back NECK_TAKE of the lean) and
    // the head tips forward by the rest, so the nape stays under the hair;
    // with the whole neck leaning, the female side view showed the background
    // between the hair below the ear and the back of the neck. It holds for
    // every lean of the body: walk/run, the jump crouch, flight and landing,
    // the cheering squash, and the seated side leans (hunched over the knees
    // or the desk). The bow is excluded: its head pitches about the nape.
    const leanNeck=profile&&(walk||jump||happy||floor||desk),neckTilt=leanNeck?lean*NECK_TAKE:0,headTilt=leanNeck?lean-neckTilt:0;
    const legs=SPEC.hip.map((hip,i)=>{
      // A cross-legged thigh leaves the front of the seat in the side view
      // (the seat itself lies behind the hip joint), so the knee clears the
      // deep chibi shirt instead of hiding behind it.
      const x=profile?SPEC.profileHip[i]:hip,root=add(mapped(torso,[x,SPEC.waist]),[floor&&profile?SEATED.floor.side.hip:0,0]),p=(phase+i*.5)%1,ax=x+(SPEC.ankleX?SPEC.ankleX[i]-SPEC.hip[i]:0);
      let ankle=[ax,SPEC.ankle],knee,shoeAngle=0,contact=true,forward=0,stance=true,space=null,climbBones=null,seatSpace=null,seatShoe=null,paint=null,knee3=null;
      if(walk){const s=steps[i];forward=s.forward;let lift=s.lift;contact=s.contact;stance=s.stance;shoeAngle=profile?rad(s.toe):0;
        // A swinging foot authored for the mean hip height lifts a little
        // when the hip is lower or rolled away, never stretching the leg.
        // Seen from the front, a foot swinging behind rises no higher on
        // screen than mid-shin: the high heel kick is hidden behind the leg
        // there (drawn, it floated under the shorts). The back view keeps it.
        if(!profile&&!back&&!stance)lift=Math.min(lift,Math.max(0,gait.frontRaise+GROUND_TILT*forward));
        const span=SPEC.thigh+SPEC.shin-.004,down=SPEC.ankle-root[1],dx=profile?ax+forward-root[0]:forward;if(!stance&&dx**2+(down-lift)**2>span**2)lift=down-Math.sqrt(Math.max(0,span**2-dx**2));
        ankle=[ax+(profile?forward:0),SPEC.ankle-lift];}
      if(jumpKey){
        // Front/back knees turn out about the hip-ankle line (a squat or tuck
        // seen head-on); the turn is part of the 3D bone, not a screen nudge.
        const side=i?1:-1,turn=rad(jumpKey.splay)*(air?1:compression),out=Math.sin(turn),fwd=Math.cos(turn),column=d=>root[0]+(ax-x)*d/(SPEC.thigh+SPEC.shin);
        if(air){
          // Flight: thigh angle and knee flex; legs[1] is the near/leading leg.
          const [t,k]=(i?jumpKey.leg.slice(0,2):jumpKey.leg.slice(2)).map(rad),kz=SPEC.thigh*Math.sin(t),ky=SPEC.thigh*Math.cos(t),az=kz+SPEC.shin*Math.sin(t-k),ay=ky+SPEC.shin*Math.cos(t-k);
          contact=false;shoeAngle=profile?rad(jumpKey.toe):0;
          if(profile){knee=[root[0]+kz,root[1]+ky];ankle=[root[0]+az,root[1]+ay];}
          else{knee=[column(ky)+side*kz*out,root[1]+ky];ankle=[column(ay)+side*az*out,root[1]+ay];space=[[0,root[1],0],[side*kz*out,knee[1],kz*fwd],[side*az*out,ankle[1],az*fwd]];}
        }else if(profile)knee=ik(root,ankle,SPEC.thigh,SPEC.shin,-1);
        else{
          // Planted crouch: the sagittal knee, turned out over the toes.
          const sagittal=ik([0,root[1]],[0,ankle[1]],SPEC.thigh,SPEC.shin,-1);
          knee=[mix(root[0],ankle[0],.5)+side*sagittal[0]*out,sagittal[1]];space=[[0,root[1],0],[side*sagittal[0]*out,knee[1],sagittal[0]*fwd],[0,ankle[1],0]];
        }
      }
      if(hop>0){
        // Cheering hop: feet leave the floor and tuck a little at the top.
        forward=profile?-.45*hopTuck:-.3*hopTuck;ankle=[ax+(profile?forward:0),SPEC.ankle-1.15*hopTuck];contact=false;shoeAngle=profile?rad(12*hopTuck):0;
      }
      if(floor||desk){
        const side=i?1:-1,r3=[HIP_L,root[1],0];let k3,a3;
        if(floor){
          const C=SEATED.floor,V=profile?{...C,...C.side}:C,out=rad(V.out),rise=rad(V.rise),fold=rad(V.fold[i]);
          k3=[HIP_L+SPEC.thigh*Math.sin(out)*Math.cos(rise),root[1]-SPEC.thigh*Math.sin(rise),SPEC.thigh*Math.cos(out)*Math.cos(rise)];
          const ay=SPEC.ankle-V.lift[i],dy=clamp(ay-k3[1],-SPEC.shin,SPEC.shin),h=Math.sqrt(SPEC.shin**2-dy**2);
          a3=[k3[0]-h*Math.cos(fold),k3[1]+dy,k3[2]-h*Math.sin(fold)];contact=false;
        }else{
          // Knees a little apart over flat feet that sit slightly in and back
          // under them (a child's chair sit); the thigh takes what is left.
          const C=SEATED.desk,tilt=rad(C.shinTilt),inward=rad(C.shinIn),down=Math.cos(tilt)*Math.cos(inward),ky=SPEC.ankle-SPEC.shin*down,dy=clamp(ky-root[1],-SPEC.thigh,SPEC.thigh),h=Math.sqrt(SPEC.thigh**2-dy**2),out=rad(C.out);
          k3=[HIP_L+h*Math.sin(out),root[1]+dy,h*Math.cos(out)];a3=[k3[0]-SPEC.shin*Math.sin(inward),k3[1]+SPEC.shin*down,k3[2]-SPEC.shin*Math.sin(tilt)*Math.cos(inward)];
        }
        const P=q=>profile?[root[0]+q[2],q[1]]:[x+side*(q[0]-HIP_L),q[1]],D=q=>profile?side*q[0]:back?-q[2]:q[2];
        knee=P(k3);ankle=P(a3);knee3=k3;seatSpace=[[...root,D(r3)],[...knee,D(k3)],[...ankle,D(a3)]];
        // The thigh lies under the shorts; the visible leg is the knee and the
        // shin, painted as one straight piece from the knee (a desk thigh
        // seen from the front or back is nearly end-on, and painting it bent
        // left a kink at the knee). The side view keeps the bent painting.
        if(floor||!profile){const u=sub(knee,ankle),l=Math.hypot(...u);paint=[l>.05?add(knee,u.map(v=>v*SPEC.thigh/l)):add(knee,[0,-SPEC.thigh]),knee,ankle];}
        if(floor){
          // Each foot points across to the other side, so from the front it is
          // a side-on shoe, toe tipped up a little, under both shins. Side view
          // (reference): the near foot is tucked under the far thigh (hidden);
          // the far foot points at the viewer, its toe under the near knee.
          // From behind both feet are in front of the body, hidden.
          const C=SEATED.floor;
          seatShoe=back||profile&&i?{hidden:true}:profile?{view:'Front',index:0,flip:1,angle:0}:{view:'Profile',index:0,flip:i?-1:1,angle:i?C.toe:-C.toe,under:true};
        }
      }
      else if(jumpKey){/* posed above */}
      else if(climb){
        // The stepping foot backs off its rung, rises with the knee forward
        // and a little outward (ladder knees), and lands on the next rung.
        const c=climbStep((cphase+(i?.5:0))%1,CR.footDuty),side=i?1:-1,target=lerp([ax,SPEC.ankle,0],[ax,mix(CR.footLow-CR.step,CR.footLow,c.pos)-.25*c.lift,CLIMB.footZ+.8*c.lift],ease);
        const [k,a]=ik3at([...root,0],target,SPEC.thigh,SPEC.shin,CLIMB.knee.map((v,j)=>j?v:side*v));knee=[k[0],k[1]];ankle=[a[0],a[1]];contact=ease<1&&a[1]>SPEC.ankle-.05;climbBones=[[...root,0],k,a];
      }
      else if(profile)knee=ik(root,ankle,SPEC.thigh,SPEC.shin,-1);
      else{
        // Sagittal bending projects into depth in a front/back view. Solving
        // it as sideways screen motion made a lifted knee splay outwards.
        const sagittal=ik([0,root[1]],[forward,ankle[1]],SPEC.thigh,SPEC.shin,-1);
        knee=[mix(root[0],ankle[0],.5),sagittal[1]];
        ankle.depth=forward;knee.depth=sagittal[0];
        // A cheering squash or hop tuck turns the knees out over the toes as
        // the jump crouch does, so the bend reads head-on rather than only
        // shortening the legs into depth. The squash is shallower than the
        // jump's crouch, so it turns further (30 deg) for a similar sideways
        // knee (~.65 at the deepest landing; the jump landing's is ~.6).
        // The knee turns about the hip-ankle line, so both bones keep length.
        if(happy){const turn=rad(30*squash+12*hopTuck),side=i?1:-1,a=[ankle[1]-root[1],forward],al=Math.hypot(...a)||1,u=a.map(v=>v/al),k=[sagittal[1]-root[1],sagittal[0]],t=k[0]*u[0]+k[1]*u[1],perp=[k[0]-t*u[0],k[1]-t*u[1]],pl=Math.hypot(...perp),c=Math.cos(turn);
          knee=[knee[0]+side*pl*Math.sin(turn),root[1]+t*u[0]+perp[0]*c];knee.depth=t*u[1]+perp[1]*c;ankle.depth=forward;space=[[0,root[1],0],[side*pl*Math.sin(turn),knee[1],knee.depth],[0,ankle[1],forward]];}
        // The maps are seen from above, so ground nearer the camera is lower
        // on screen: a walking foot stepping toward the viewer lands a little
        // lower and the one behind a little higher. A front/back stride then
        // reads as steps, not marching in place. Bones stay unprojected.
        if(walk){const k=(back?-1:1)*GROUND_TILT;ankle.trueY=ankle[1];knee.trueY=knee[1];ankle[1]+=k*forward;knee[1]+=k*knee.depth;}
      }
      const thighAngle=Math.atan2(knee[1]-root[1],knee[0]-root[0])-Math.PI/2,shinAngle=Math.atan2(ankle[1]-knee[1],ankle[0]-knee[0])-Math.PI/2;
      // Seated foreshortening changes the visible length, never the joint lengths.
      const boneSpace=seatSpace||space||climbBones||(profile?[root,knee,ankle]:[[0,root[1]],[knee.depth||0,knee.trueY??knee[1]],[ankle.depth||0,ankle.trueY??ankle[1]]]);
      return{root,knee,ankle,contact,stance:stance&&!air&&!climb&&!floor,shoeAngle,boneSpace,seatShoe,paint,knee3,thigh:transform([hip,SPEC.waist],root,thighAngle),shin:transform([hip,SPEC.knee],knee,shinAngle)};
    });
    const arms=SPEC.shoulder.map((rest,i)=>{
      const side=i?1:-1,shoulder=mapped(torso,profile?SPEC.profileShoulder[i]:rest),upperLength=profile?SPEC.profileArm[0]:Math.hypot(...sub(SPEC.elbow[i],rest)),lowerLength=profile?SPEC.profileArm[1]:Math.hypot(...sub(SPEC.wrist[i],SPEC.elbow[i]));
      // lift: how far a gesture has raised this arm (0..1), read by the
      // garments (raised sleeve and underarm cloth) and the layer order.
      // open: whether the gesture hand shows the open hand drawing (0..1).
      let elbow,wrist,depth=[0,0],lift=0,handTurn=0,open=null;
      if(floor||desk){
        // Seated arms live in the same body space as the seated legs and are
        // projected by view3d, so all four views show one pose.
        let E,W;
        if(floor){
          // The hand rests on top of its own knee, a little inside it
          // (hand: inward, wrist height above the knee centre, back).
          const C=SEATED.floor,k=legs[i].knee3,out=profile?Math.abs(FRONT.shoulder[i][0]-16):side*(shoulder[0]-16),z=profile?shoulder[0]-legs[i].root[0]:Math.sin(rad(C.lean))*(SPEC.waist-rest[1]);
          ({elbow:E,wrist:W}=ik3([k[0]-C.hand[0]-out,k[1]-C.hand[1]-shoulder[1],k[2]+C.hand[2]-z],upperLength,lowerLength,[1,0,-.6]));
        }else{
          // Upper arm a little forward, forearm forward, in and a little down
          // onto the desk.
          const C=SEATED.desk;E=bodyVector(rad(C.swing),rad(C.abduct)).map(v=>v*upperLength);W=bodyVector(rad(C.reach),-rad(C.inward)).map((v,k)=>E[k]+v*lowerLength);
        }
        const e=view3d(E,side,view,i===1),w=view3d(W,side,view,i===1);elbow=[shoulder[0]+e[0],shoulder[1]+e[1]];wrist=[shoulder[0]+w[0],shoulder[1]+w[1]];depth=[e[2],w[2]];
      }else if(climb){
        // Hand over hand on the rail: the top grip is a nearly straight arm
        // with the elbow turned out; pulling down, the elbow bends out and
        // drops until the forearm stands upright beside the head. The
        // released hand comes back off the rail and reaches up again.
        // The raised arm carries the rigid raised sleeve and the shirt's
        // underarm cut (lift), as a greeting arm does; without it the sleeves
        // stretched out sideways like flaps over a straight armhole cut. The
        // gripping hand stays the painted one (no open hand).
        const c=grips[i],sided=v=>v.map((x,j)=>j?x:side*x),grip=[16+side*(CLIMB.rail+.2*c.lift),mix(CR.handHigh,CR.handLow,c.pos),CLIMB.handZ+.9*c.lift],target=lerp([...SPEC.wrist[i],0],grip,ease);
        const [e,w]=ik3at([...shoulder,0],target,upperLength,lowerLength,lerp(sided(CLIMB.poleRest),lerp(sided(CLIMB.poleHigh),sided(CLIMB.poleLow),c.pos),ease));
        elbow=[e[0],e[1]];wrist=[w[0],w[1]];depth=[e[2],w[2]];lift=ease;open=0;
      }else{
        // Rest angles of this arm in this view's sheet (outward +).
        const elbowRest=SPEC.elbow[i],wristRest=SPEC.wrist[i];
        let swing=REST_SWING,abduct=Math.atan2(side*(elbowRest[0]-rest[0]),elbowRest[1]-rest[1]),flex=REST_FLEX,forearm=Math.atan2(side*(wristRest[0]-elbowRest[0]),wristRest[1]-elbowRest[1]);
        if(walk){
          // c = +1 when this arm is fully forward, with the opposite leg. A
          // forward arm bends and its hand comes in toward the body; a back
          // arm straightens and opens a little, so the swing reads from the
          // front and back too. Running arms keep the elbow bent and pump;
          // front/back running arms follow their authored keys (GAIT notes).
          const A=gait.arm,F=profile?{}:A.facing,c=(i?1:-1)*Math.cos(TAU*(phase-gait.lag)),at=k=>rad(A[k][0]+A[k][1]*c+(F[k]?F[k][0]+F[k][1]*c:0));
          if(!profile&&A.facingKeys){const K=back?A.backKeys:A.facingKeys;swing+=rad(keyed(K,c,1));flex=rad(keyed(K,c,2));abduct+=rad(keyed(K,c,3));forearm+=rad(keyed(K,c,4));}
          else{swing+=at('swing');flex=at('flex');abduct+=at('abduct');forearm+=at('forearm');}
        }else if(jumpKey){
          // Take-off swings the arms behind; the launch throws them up (side:
          // the near arm high-forward, never over the face; head-on and from
          // behind: a raised V); the apex folds the side elbows in front of
          // the chest, and the fall and landing reach out and forward for
          // balance. Profile keys are screen angles: +lean cancels the shared
          // -lean below.
          const c=air?1:compression;
          // lift: a raised jump arm wears its sleeve rigidly and opens the
          // underarm cloth, as the wave and the cheer do (the seam-pinned
          // sleeve stretched into flaps). Side arms rise forward, so they stay
          // below the open-hand threshold (.35) and keep the painted hand.
          if(profile){const[s,f]=jumpKey.profile.slice(i?0:2);swing=mix(swing,rad(s),c)+rad(lean);flex=mix(flex,rad(f),c);lift=Math.min(.35,smooth(60,95,s)*c);}
          else{const[s,a,f,k]=back?jumpKey.back:jumpKey.front;swing=mix(swing,rad(s),c);abduct=mix(abduct,rad(a),c);forearm=mix(forearm,rad(f),c);flex=mix(flex,rad(k),c);lift=smooth(50,105,a)*c;}
        }
        else{swing+=rad(1.2*breath-.6);flex+=rad(3*breath);
          // Bowing from the front or back: the arms hang a little forward;
          // from the front the hands also come together in front of the
          // thighs (a polite bow), a silhouette change that reads at 120 px.
          if(nod&&!profile){swing+=rad(BOW_SWING*nod);if(!back){abduct-=rad(3*nod);forearm-=rad(BOW_HANDS*nod);flex+=rad(14*nod);}}}
        const sx=input.sex==='f'?1:0,lead=e=>1-Math.pow(1-e,3),late=e=>Math.pow(e,1.5),restForearm=swing+flex,restDirs=()=>[bodyVector(swing,abduct),bodyVector(swing+flex,forearm)];
        // Gesture directions [upper, forearm] in the body frame (GESTURE_KEYS).
        let dirs=null;
        if(happy){
          // Front/back: both arms come up beside the head with bent elbows
          // and open into a V, rising a little more in the air and giving
          // with the knees on each landing. Profile: fists pumped up ahead of
          // the chin on each hop, pulled down on each landing.
          const e=happy.arms,K=GESTURE_KEYS.happy;lift=e;
          if(profile){const P=K.profile.sexes[sx],k=clamp(.4+.6*happy.tuck-.6*happy.squash,0,1),down=armKey(P.down[i]),up=armKey(P.up[i]),fist=[slerp(down[0],up[0],k),slerp(down[1],up[1],k)];
            dirs=armPath([[0,...restDirs()],[.5,...armKey(K.profile.mid)],[1,...fist]],e);open=0;}
          else{const G=K[view],pump=rad(G.pump[sx]*happy.tuck-9*happy.squash)*e;handTurn=rad(8)*Math.sin(TAU*5*progress+i*Math.PI)*e;
            dirs=armPath([[0,...restDirs()],[.5,...armKey(K.mid)],[1,...armKey({upper:G.upper[sx],fore:G.fore[sx]})]],e).map(v=>turnOut(v,pump));open=smooth(.55,.75,e);}
        }
        if(wave&&i===1){
          // The upper arm settles; the forearm and hand do the waving.
          lift=wave.up;handTurn=rad(-14)*wave.turn;
          if(profile){const G=GESTURE_ARMS.wave.profile,wag=rad(G.wag)*wave.wag;swing=mix(swing,rad(G.swing[sx]),late(wave.up));flex=mix(restForearm,rad(G.forearm[sx]),lead(wave.up))+wag-swing;abduct=mix(abduct,rad(G.abduct),wave.up);}
          else{
            // The forearm comes up in front of the bending elbow (hand still
            // closed) before the upper arm lifts it beside the head; inward
            // wags of the female hand are small (her bob is wider).
            const G=GESTURE_KEYS.wave[view],w=wave.wag>0?wave.wag*G.wagIn[sx]:wave.wag,wag=rad(G.wag)*w;
            dirs=armPath([[0,...restDirs()],[.45,...armKey(GESTURE_KEYS.wave.mid)],[1,...armKey({upper:G.upper[sx],fore:G.fore[sx]})]],wave.up);dirs[1]=turnOut(dirs[1],wag);open=smooth(.5,.7,wave.up);
          }
        }
        if(profile)swing-=rad(lean);
        let Ub=bodyVector(swing,abduct),Fb=bodyVector(swing+flex,forearm);
        if(dirs){[Ub,Fb]=dirs;if(profile&&lean){Ub=tilt(Ub,-rad(lean));Fb=tilt(Fb,-rad(lean));}}
        const U=view3d(Ub,side,view,i===1),F=view3d(Fb,side,view,i===1);
        elbow=[shoulder[0]+U[0]*upperLength,shoulder[1]+U[1]*upperLength];wrist=[elbow[0]+F[0]*lowerLength,elbow[1]+F[1]*lowerLength];depth=[U[2]*upperLength,U[2]*upperLength+F[2]*lowerLength];
      }
      const base=sub(SPEC.elbow[i],rest),angle=Math.atan2(elbow[1]-shoulder[1],elbow[0]-shoulder[0])-Math.atan2(base[1],base[0]);
      // A breathing seated arm rises whole with the chest: its shape (and so
      // its painting and sleeve, shared by every seated avatar) never changes.
      if(seatBreath){const up=chest[5]-torso[5];for(const p of [shoulder,elbow,wrist])p[1]+=up;}
      // fold: a run/jump forearm may turn back over its own upper arm on
      // screen; the skin paints that bend as a rounded elbow.
      return{shoulder,elbow,wrist,depth:depth[1],boneSpace:[[...shoulder,0],[...elbow,depth[0]],[...wrist,depth[1]]],sleeve:transform(rest,shoulder,angle),angle,lift,open:open??lift,handTurn,fold:run||jump};
    });
    return{direction,profile,back,action,phase,torso,chest,legs,arms,floor,desk,drop,lean,neckTilt,headTilt,gesture,hop,nod,headPitch:profile?(BOW_LEAN+BOW_PITCH)*nod:0,spec:SPEC,ladder:CR};
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
    const result={key,skin,headClip:raw.querySelector('#qpx-head-front').outerHTML,backHair:raw.querySelector('.qpx-back-hair')?.outerHTML||'',front:front.outerHTML,profile:QPAvatarDirection.headMarkup(raw,'profile'),back:QPAvatarDirection.headMarkup(raw,'back')};headCache.set(key,result);return result;
  }
  // render() output is assembled from a template per head and outfit: the
  // posed skeleton serialized once with its id and size left as slots, and
  // the head paintings (nine tenths of the string) spliced in by reference
  // rather than parsed and serialized again on every call. A repeat render is
  // a string join; 30 list avatars stay cheap even with the posed body. The
  // key is the head plus the outfit mode: garments chosen per item (stage 3)
  // must join the key.
  const TEMPLATE_ID='qpf-template',TEMPLATE_W='qpfW-template',TEMPLATE_H='qpfH-template',SLOT={[TEMPLATE_ID]:0,[TEMPLATE_W]:1,[TEMPLATE_H]:2},templates=new Map();
  function headChunks(heads,view){
    // The paintings' own clip ids become this render's ids.
    const [text,from,to]=view==='backHair'?[heads.backHair,'url(#qpx-hair-behind)','-hair-behind)']:[heads[view],'url(#qpx-head-front)','-head-front)'];
    heads.chunks??={};if(heads.chunks[view])return heads.chunks[view];
    const out=[];text.split(from).forEach((s,i)=>{if(i)out.push('url(#',SLOT[TEMPLATE_ID],to);out.push(s);});return heads.chunks[view]=out;
  }
  function render(av={},size=280){
    root.QPFoundationSkin?.load();
    if(av.foundationOutfit!=='body')root.QPFoundationOutfit?.load();
    const sex=av.sex==='m'?'m':'f',base={...av,sex,hair:av.hair|| (sex==='m'?'short:1':'bob:1'),expression:av.expression||'bright:0'},heads=headViews(base),outfit=av.foundationOutfit==='body'?'body':'basic',key=heads.key+'\n'+outfit;
    let t=templates.get(key);if(t){templates.delete(key);templates.set(key,t);}
    else{t=template(base,heads,sex,outfit);if(!t.pending){templates.set(key,t);if(templates.size>48)templates.delete(templates.keys().next().value);}}
    if(t.pending)repaintWhenReady();
    const values=['qpf-'+(++serial),String(size*32/56),String(size*62/56)];let html='';for(const c of t.chunks)html+=typeof c==='string'?c:values[c];return html;
  }
  function template(base,heads,sex,outfit){
    const id=TEMPLATE_ID;
    const svg=el('svg',{xmlns:NS,class:'qp-pixel-avatar qp-illustrated-avatar qp-foundation-avatar','data-qp-foundation':'1','data-foundation-outfit':outfit,'data-qpx-sex':sex,'data-foundation-id':id,'data-foundation-skin':heads.skin,viewBox:'0 0 32 62',width:TEMPLATE_W,height:TEMPLATE_H,role:'img','aria-label':(sex==='m'?'남자':'여자')+' 기준 캐릭터',style:'display:block;overflow:visible;--qpx-viewport-scale:1.107142857;--qpx-ground-shift:2.4'});
    const defs=el('defs');svg.append(defs);const skin=pigment(defs,id+'-skin',heads.skin),underlay=pigment(defs,id+'-underlay','#d9e0d1');
    const neckGradient=el('linearGradient',{id:id+'-neck-shadow',gradientUnits:'userSpaceOnUse',x1:16,x2:16,y1:27.8,y2:28.5});neckGradient.append(el('stop',{offset:0,'stop-color':tone(heads.skin,.74),'stop-opacity':.62}),el('stop',{offset:.42,'stop-color':tone(heads.skin,.82),'stop-opacity':.26}),el('stop',{offset:1,'stop-color':tone(heads.skin,.88),'stop-opacity':0}));defs.append(neckGradient);
    const headClip=el('g');headClip.innerHTML=heads.headClip.replaceAll('qpx-head-front',id+'-head-front');defs.append(...headClip.children);
    // Without a back-hair layer, hair below the jaw line would vanish.
    if(FRONT_HAIR_CLIP[sex]&&heads.backHair)defs.querySelector('#'+id+'-head-front').replaceChildren(el('path',{d:FRONT_HAIR_CLIP[sex]}));
    const skinGradient=defs.querySelector('#'+id+'-skin');skinGradient.setAttribute('gradientUnits','userSpaceOnUse');skinGradient.setAttribute('x1','10');skinGradient.setAttribute('x2','22');
    svg.append(el('ellipse',{class:'qpx-contact-shadow',cx:16,cy:56.75365,rx:6.2,ry:.60,fill:'#596654',opacity:.20}));
    const mirror=el('g',{'data-foundation-mirror':'true'}),head=el('g',{'data-foundation-head':'true'}),body=el('g',{'data-foundation-body':'true',transform:`translate(16 28) scale(${BODY_SCALE.x} ${BODY_SCALE.y}) translate(-16 -28)`}),backHair=el('g',{'data-foundation-back-hair':'true'});mirror.append(backHair,body,head);const stage=el('g',{'data-foundation-stage':'true',transform:`translate(16 ${FLOOR_Y}) scale(${STAGE_SCALE}) translate(-16 ${-FLOOR_Y})`});stage.append(mirror);svg.append(stage);
    // Hair below the chin hangs behind the body, as in the regular avatar.
    // The front portraits also carry an old outlined neck stump down there;
    // only those traced strokes are cut, never the hanging hair itself.
    if(heads.backHair){const clip=el('clipPath',{id:id+'-hair-behind',clipPathUnits:'userSpaceOnUse'});clip.append(el('path',{d:(BACK_HAIR_CLIP[sex]||'M-1 28.2H33V48.2H-1Z')+BACK_HAIR_NECK_CUT[sex],'clip-rule':'evenodd'}));defs.append(clip);const fit=VIEW_HEAD[sex].front,hair=el('g',fit?{transform:`translate(0 ${fit[1]}) translate(16 ${VIEW_HEAD_PIVOT}) scale(${fit[0]}) translate(-16 ${-VIEW_HEAD_PIVOT})`}:{});hair.append(document.createComment('qpf-head:backHair'));backHair.append(hair);}
    for(const view of ['front','profile','back']){
      const v=el('g',{'data-foundation-head-view':view}),fit=VIEW_HEAD[sex][view];
      // The painting goes in at the comment when the template is assembled.
      if(fit)v.setAttribute('transform',`translate(${fit[2]||0} ${fit[1]}) translate(16 ${VIEW_HEAD_PIVOT}) scale(${fit[0]}) translate(-16 ${-VIEW_HEAD_PIVOT})`);v.append(document.createComment('qpf-head:'+view));
      // The directional paintings include a flared standalone neck with a
      // dark bottom rim. A body that owns its neck must not show that second
      // neck above the shirt. Cut only the reference heads' neck attachment;
      // original face/hair PNGs and legacy wardrobe rendering stay intact.
      const referenceHead=base.hair.split(':')[0]===(sex==='m'?'short':'bob');
      const cut=referenceHead?HEAD_NECK_CUT[sex][view]:'';
      if(cut){const clip=el('clipPath',{id:id+'-head-only-'+view,clipPathUnits:'userSpaceOnUse'});clip.append(el('path',{d:'M-8 -8H40V48H-8Z'+cut,'clip-rule':'evenodd'}));defs.append(clip);v.setAttribute('clip-path','url(#'+id+'-head-only-'+view+')');}
      // Front bow: the painting above the brow line stays in this view (a
      // clipped, stretched crown band) and the face band below it is the same
      // view again through a <use>, slid down and foreshortened (BOW_FACE).
      // Both bands exist from the start, so a bow never adds nodes.
      if(view==='front'){v.id=id+'-head-view';const crown=el('g',{'data-foundation-bow':'crown'}),warp=el('g',{'data-foundation-bow-warp':'crown'});warp.append(v);crown.append(warp);head.append(crown);}
      else head.append(v);
    }
    {const face=el('g',{'data-foundation-bow':'face','clip-path':'url(#'+id+'-bow-face)',style:'display:none'});face.append(el('use',{href:'#'+id+'-head-view'}));head.append(face);
     for(const band of ['crown','face']){const clip=el('clipPath',{id:id+'-bow-'+band,clipPathUnits:'userSpaceOnUse'});clip.append(el('path',{d:'M-20 -20H52V80H-20Z'}));defs.append(clip);}}
    for(const name of ['far-arm','far-leg','near-leg','pelvis','torso','near-arm'])body.append(el('g',{'data-foundation-part':name}));
    const frontHands=el('g',{'data-foundation-front-hand':'true',transform:body.getAttribute('transform')}),bones=el('g',{'data-foundation-bones':'true',transform:body.getAttribute('transform'),'pointer-events':'none',style:'display:none'});mirror.append(frontHands,bones);
    svg.dataset.foundationSkinFill=skin;svg.dataset.foundationUnderlay=underlay;
    // D13: about twenty screens (shop preview, home portrait, lists, results)
    // show this string without ever calling apply(). It therefore carries
    // the posed idle front body, drawn by apply(STATIC_POSE) itself, so it is
    // that pose by construction. The defs count marks which definitions the
    // pose added; a controller that mounts the string rebuilds exactly those
    // (unpose), so every later apply() keeps one node set. A static avatar
    // gets no clock and no per-frame work.
    svg.dataset.foundationStaticDefs=defs.children.length;apply(svg,STATIC_POSE);
    // Art still loading (not cached; posed again once it arrives): vector
    // limbs stand in for the painted skin, but a body without its garments
    // would read as undressed, so the avatar stays hidden like every avatar
    // during loading (.qp-avatar-loading).
    const ready=module=>!module||module.atlas.ready||Boolean(module.atlas.error),undressed=outfit==='basic'&&!ready(root.QPFoundationOutfit),pending=undressed||!ready(root.QPFoundationSkin);
    svg.dataset.foundationStatic=pending?'pending':'idle-front';if(undressed)svg.setAttribute('visibility','hidden');
    const chunks=[];
    svg.outerHTML.split(/<!--qpf-head:(\w+)-->/).forEach((part,i)=>{if(i%2)chunks.push(...headChunks(heads,part));else part.split(/(qpf-template|qpfW-template|qpfH-template)/).forEach((s,k)=>chunks.push(k%2?SLOT[s]:s));});
    return{chunks,pending};
  }
  // Pending strings already on screen are posed once the art arrives; ones
  // mounted during the next ten seconds as they appear (a one-off watch).
  let repainting=null;
  function repaintWhenReady(){
    if(repainting||typeof document==='undefined')return;
    repainting=Promise.all([root.QPFoundationSkin?.load(),root.QPFoundationOutfit?.load()]).then(()=>{
      const sweep=()=>{for(const svg of document.querySelectorAll('svg[data-foundation-static="pending"]'))prepare(svg);},watch=new MutationObserver(sweep);
      sweep();watch.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>{watch.disconnect();repainting=null;},10000);
    });
  }
  // The posed nodes of a render() string belong to no rig. Remove them, and
  // the definitions they added, before a rig builds its own.
  function unpose(svg){
    const defs=svg.querySelector('defs'),keep=Number(svg.dataset.foundationStaticDefs),body=svg.querySelector('[data-foundation-body]');
    if(defs&&Number.isInteger(keep))while(defs.children.length>keep)defs.lastElementChild.remove();
    for(const name of PART_NAMES){const part=svg.querySelector('[data-foundation-part="'+name+'"]');part.replaceChildren();part.removeAttribute('transform');body.append(part);}
    for(const node of [...body.children])if(!node.dataset.foundationPart)node.remove();
    svg.querySelector('[data-foundation-front-hand]').replaceChildren();svg.querySelector('[data-foundation-bones]').replaceChildren();
    delete svg.dataset.foundationStatic;delete svg.dataset.foundationStaticDefs;svg.removeAttribute('visibility');
  }
  // A mounted render() string is re-posed at once, so nothing flashes between
  // prepare() and the caller's first apply() (maps prepare on mount and pose
  // on their next unblocked frame).
  function prepare(svg){return mount(svg,true);}
  function mount(svg,repose){
    if(!svg?.dataset.qpFoundation)return null;if(mounted.has(svg))return mounted.get(svg);
    const posed=Boolean(svg.dataset.foundationStatic);if(posed)unpose(svg);
    const skin=svg.dataset.foundationSkin,fill=svg.dataset.foundationSkinFill,parts=Object.fromEntries([...svg.querySelectorAll('[data-foundation-part]')].map(e=>[e.dataset.foundationPart,e]));
    const fid=svg.dataset.foundationId,q=k=>svg.querySelector(k),bow={crown:q('[data-foundation-bow="crown"]'),warp:q('[data-foundation-bow-warp]'),face:q('[data-foundation-bow="face"]'),crownClip:q('[id="'+fid+'-bow-crown"] path'),faceClip:q('[id="'+fid+'-bow-face"] path'),behind:FRONT_HAIR_CLIP[svg.dataset.qpxSex]?q('[id="'+fid+'-hair-behind"] path'):null};
    // The front hair boundary exists only with a back-hair layer (template()).
    bow.hair=bow.behind?q('[id="'+fid+'-head-front"] path'):null;bow.use=bow.face?.firstElementChild;
    const r={svg,parts,bow,views:[...svg.querySelectorAll('[data-foundation-head-view]')],head:svg.querySelector('[data-foundation-head]'),backHair:svg.querySelector('[data-foundation-back-hair]'),mirror:svg.querySelector('[data-foundation-mirror]'),body:svg.querySelector('[data-foundation-body]'),frontHands:svg.querySelector('[data-foundation-front-hand]'),bones:svg.querySelector('[data-foundation-bones]'),pose:null};
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
    mounted.set(svg,r);if(posed&&repose)apply(svg,STATIC_POSE);return r;
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
  function seatedLeg(leg,cap){
    // The cross-legged leg seen past the shorts cuff: a round knee and the
    // folded shin as one capsule (the thigh is under the shorts). The skin
    // painting is clipped to it, so no thigh stub shows beside the knee;
    // `cap` returns just the knee's rim, outlined like the painted limbs.
    const k=leg.knee,a=leg.ankle,d=sub(a,k),l=Math.hypot(...d),u=l>.01?d.map(v=>v/l):[1,0],nrm=[-u[1],u[0]],rk=1.06,ra=.74,q=(p,s,b=0)=>pt([p[0]+nrm[0]*s+u[0]*b,p[1]+nrm[1]*s+u[1]*b]);
    if(cap)return'M'+q(k,-rk*.98,.2)+'A'+n(rk)+' '+n(rk)+' 0 1 0 '+q(k,rk*.98,.2);
    return'M'+q(k,rk)+'L'+q(a,ra)+'A'+n(ra)+' '+n(ra)+' 0 0 0 '+q(a,-ra)+'L'+q(k,-rk)+'A'+n(rk)+' '+n(rk)+' 0 1 0 '+q(k,rk)+'Z';
  }
  // Front bow (BOW_FACE): above the brow line the head stretches a little
  // from a crown that barely moves; below it the face slides down under the
  // bangs and foreshortens, the chin tucking over the neck. Both bands map the
  // brow line to the same place, so the painting stays continuous. The
  // female bob's front/back hair boundary keeps its place on the body outside
  // the jaw (the FRONT_HAIR_CLIP margin over the collar and shoulders holds
  // at every depth) and follows the face over the jaw. Returns the face
  // band's transform for the hair hanging behind the body.
  const clipPoints=d=>{const pts=[];let x=0,y=0;for(const [,c,a]of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)){const v=a.trim().split(/[ ,]+/).filter(Boolean).map(Number);if(c==='M'||c==='L'){x=v[0];y=v[1];}else if(c==='H')x=v[0];else if(c==='V')y=v[0];else continue;pts.push([x,y]);}return pts;};
  const HAIR_POINTS=Object.fromEntries(Object.keys(FRONT_HAIR_CLIP).map(k=>[k,{front:clipPoints(FRONT_HAIR_CLIP[k]),back:clipPoints(BACK_HAIR_CLIP[k])}]));
  const JAW=[12.35,12.9,19.38,19.85];
  function bowFace(r,amount){
    const B=r.bow,sex=r.svg.dataset.qpxSex;if(!B?.face)return'';
    if(!amount){if(B.face.style.display!=='none'){B.face.style.display='none';B.crown.removeAttribute('clip-path');B.warp.removeAttribute('transform');if(B.hair)set(B.hair,'d',FRONT_HAIR_CLIP[sex]);if(B.behind)set(B.behind,'d',(BACK_HAIR_CLIP[sex]||'')+BACK_HAIR_NECK_CUT[sex]);}return'';}
    const k=sex==='f'?1:0,b=BOW_FACE.brow[k],chin=BOW_FACE.chin[k],[t,s,c]=BOW_FACE.shift[k].map(v=>v*amount),edge=b+s,crown=(edge-t)/b,face=(chin+c-edge)/(chin-b);
    const faceWarp=' translate(0 '+n(edge)+') scale(1 '+n(face)+') translate(0 '+n(-b)+')';
    set(B.warp,'transform','translate(0 '+n(t)+') scale(1 '+n(crown)+')');set(B.crownClip,'d','M-20 -20H52V'+n(edge+.2)+'H-20Z');set(B.faceClip,'d','M-20 '+n(edge-.2)+'H52V80H-20Z');
    set(B.use,'transform',faceWarp.trim());set(B.crown,'clip-path','url(#'+r.svg.dataset.foundationId+'-bow-crown)');B.face.style.display='';
    if(B.hair){
      // Clip paths are in the view's own units (VIEW_HEAD drop above the head group).
      const fit=VIEW_HEAD[sex].front[1],outside=x=>x<JAW[1]?1-smooth(JAW[0],JAW[1],x):smooth(JAW[2],JAW[3],x),keep=([x,y])=>y<20||y>40?[x,y]:[x,mix(y,b+(y+fit-edge)/face-fit,outside(x))],path=p=>'M'+p.map(q=>pt(keep(q))).join('L')+'Z';
      set(B.hair,'d',path(HAIR_POINTS[sex].front));if(B.behind)set(B.behind,'d',path(HAIR_POINTS[sex].back)+BACK_HAIR_NECK_CUT[sex]);
    }
    return faceWarp;
  }
  // Seated friends breathe out of step with each other: each avatar's
  // breathing clock is offset by its own render serial (0-3.3 s).
  const breathOffset=svg=>(Number(String(svg.dataset.foundationId).slice(4))||0)*1.37%3.3;
  function apply(svg,state={}){
    const r=mount(svg,false);if(!r)return false;const sitting=state.action==='sit'||state.action==='floor-sit',pose=solve({...state,sex:svg.dataset.qpxSex,time:(Number.isFinite(state.time)?state.time:performance.now()/1000)+(sitting?breathOffset(svg):0),reducedMotion:state.reducedMotion??Boolean(REDUCED?.matches)}),view=pose.profile?'profile':pose.back?'back':'front';r.pose=pose;
    set(r.mirror,'transform',(pose.direction==='left'?'translate(32 0) scale(-1 1)':'')+(pose.hop?' translate(0 '+n(-pose.hop)+')':''));
    // The floor shadow shrinks while a cheering hop is in the air.
    set(r.svg.querySelector('.qpx-contact-shadow'),'transform',pose.hop?'translate(16 56.75) scale('+n(1-.28*pose.hop/HAPPY_HEIGHT)+') translate(-16 -56.75)':'');
    // The head sits on the (possibly straightened) neck and takes the rest
    // of a walk/run lean (neckTilt/headTilt, solve()).
    const collar=pose.spec.collar,neck=mapped(pose.chest,add([16,collar],rotate([0,28-collar],-rad(pose.neckTilt||0))));let headPose='translate('+pt([(neck[0]-16)*BODY_SCALE.x,(neck[1]-28)*BODY_SCALE.y])+')'+(pose.headTilt?' rotate('+n(pose.headTilt)+' 16 28)':'');
    if(pose.nod){
      // Bow: in profile the head turns with the bending upper body and
      // pitches further about the nape (the chin tucks, the back of the neck
      // shows over the neck painting). From behind the head foreshortens
      // about the nape; from the front the face band warps (bowFace).
      const outer=p=>[(p[0]-16)*BODY_SCALE.x+16,(p[1]-28)*BODY_SCALE.y+28];
      if(pose.profile){const at=outer(BOW_PIVOT),to=outer(mapped(pose.chest,BOW_PIVOT));headPose='translate('+pt(to)+') rotate('+n(pose.headPitch)+') translate('+pt(at.map(v=>-v))+')';}
      else if(pose.back)headPose+=' translate(0 '+BOW_JAW+') scale(1 '+n(1-BOW_BACK*pose.nod)+') translate(0 '+(-BOW_JAW)+')';
    }
    set(r.head,'transform',headPose+' translate(16 28) scale('+HEAD_SCALE+') translate(-16 -28)');
    const faceWarp=bowFace(r,view==='front'?pose.nod:0);
    if(r.backHair){set(r.backHair,'transform',r.head.getAttribute('transform')+faceWarp);r.backHair.style.display=view==='front'?'':'none';}
    for(const h of r.views)h.style.display=h.dataset.foundationHeadView===view?'':'none';
    set(r.parts.torso,'transform',matrix(pose.chest));set(r.parts.pelvis,'transform',matrix(pose.torso));
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
      set(part.contour,'d',pose.floor?seatedLeg(leg):limb(leg.root,leg.knee,end,[THIGH*narrow,LEG_RADII[1],LEG_RADII[2]]));
      set(part.shade,'d',pose.floor?seatedLeg(leg,true):'M'+pt(add(lerp(leg.root,leg.knee,.75),[-.35,0]))+'Q'+pt(add(leg.knee,[-.35,0]))+' '+pt(add(leg.ankle,[-.26,.12])));set(part.shade,'stroke',tone(svg.dataset.foundationSkin,pose.floor?.7:.88));
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
    // Cross-legged: the knees and folded shins are in front of the shorts and
    // shirt hem, and the hands rest on the knees; in the side view the near
    // shin folds back under the thigh, so the near leg lies under the shorts'
    // thigh (its cuff over the leg) and only the knee shows beyond. From behind, the knees show
    // beside the seat and the arms (hands on the knees) stay behind the back
    // panel. Desk: from the front the knees come out from under the curved
    // shorts cuffs (the skin is clipped to the knee) and the forearms lie in front of
    // the shirt; from the side the thigh is under the shorts; from behind the
    // forearms are beyond the back panel. Climbing arms rise from the shoulders
    // over the back (their hands go behind the head, drawn above the body).
    if(pose.floor)order=pose.back?['far-leg','near-leg','pelvis',...armKeys,'torso']:pose.profile?['far-arm','far-leg','near-leg','pelvis','torso','near-arm']:['pelvis','torso','far-leg','near-leg',...armKeys];
    else if(pose.back&&seated)order=['far-arm','near-arm','far-leg','near-leg','pelvis','torso'];
    else if(pose.action==='climb')order=['far-leg','near-leg','pelvis','torso',...armKeys];
    else if(seated&&pose.profile)order=['far-arm','far-leg','near-leg','pelvis','torso','near-arm'];
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
    // Profile: only the near arm is in front of the head.
    const raised=pose.back?[]:armKeys.filter((k,i)=>pose.arms[i].lift>.12&&(!pose.profile||i===1));
    if(raised.length){if(r.raisedKey!==raised.join()||raised.some(k=>r.parts[k].parentNode!==r.frontHands)){if(r.raised)r.body.append(...order.map(k=>r.parts[k]));r.frontHands.append(...raised.map(k=>r.parts[k]));r.raisedKey=raised.join();}r.raised=true;}else if(r.raised){r.body.append(...order.map(k=>r.parts[k]));r.orderKey=orderKey;r.raised=false;r.raisedKey='';}
    const points=[mapped(pose.torso,[16,28]),mapped(pose.torso,[16,32.8]),mapped(pose.torso,[16,pose.spec.waist]),...pose.arms.flatMap(a=>[a.shoulder,a.elbow,a.wrist]),...pose.legs.flatMap(l=>[l.root,l.knee,l.ankle])];
    const lines=[[0,1,2],[0,3,4,5],[0,6,7,8],[2,9,10,11],[2,12,13,14]];set(r.boneLines,'d',lines.map(line=>'M'+line.map(i=>pt(points[i])).join('L')).join(''));
    points.forEach((p,i)=>{set(r.joints[i],'cx',n(p[0]));set(r.joints[i],'cy',n(p[1]));});r.bones.style.display=state.showBones?'':'none';
    // Seated hip anchor for maps that set the body on a chair: the hip
    // joint (thigh root) of the desk pose in viewBox units. The old painted
    // avatar's pelvis sat at y 39.25; this body's desk hips are lower.
    if(pose.desk){const y=(pose.legs[0].root[1]+pose.legs[1].root[1])/2,hip=n(FLOOR_Y+(28+(y-28)*BODY_SCALE.y-FLOOR_Y)*STAGE_SCALE);if(svg.dataset.qpxSeatHipY!==String(hip))svg.dataset.qpxSeatHipY=hip;}else if(svg.dataset.qpxSeatHipY)delete svg.dataset.qpxSeatHipY;
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
  const api=Object.freeze({spec:SPEC,specFor,restFor,rigFor,thigh:THIGH,armRadii:ARM_RADII,legRadii:LEG_RADII,rest:RESTS.m,headScale:HEAD_SCALE,stageScale:STAGE_SCALE,bodyScale:Object.freeze(BODY_SCALE),solve,render,prepare,apply,reset:svg=>apply(svg,STATIC_POSE),climbRise:sex=>climbRig(rigFor(sex,'back')).rise,staticPose:STATIC_POSE,destroy,inspect:svg=>mounted.get(svg)?.pose||null});
  root.QPAvatarFoundation=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
