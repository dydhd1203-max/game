# 기준 캐릭터 조사 결과 (2026-10-08)

로컬 워크플로 base-character-understand 결과. 참고 그림 assets/avatar-reference-candidates/body-study-2026-10-04.png 측정, 현재 기준 몸(foundation) 측정과 코드 상수, 모션 점검, 전체 아바타 확장 방안, 빠진 점 점검. 오려 낸 참고 그림·색·원시 측정값은 ref/ 폴더. 모션 연속 화면(motion/*.png)은 용량 때문에 올리지 않았으니 필요하면 다시 만든다. 보고서 안의 scratchpad 경로는 로컬 PC 경로다.

## reference

{
 "source": "C:/Users/user/Desktop/game-main/퀴즈나라/assets/avatar-reference-candidates/body-study-2026-10-04.png (1448x1086; opaque pixels have alpha 250-253, the edge halo is alpha <100)",
 "method": "Figures were split by 4-connected alpha>100 components, which gave exactly 6 clean components. Pixels were sorted into classes by HSL: outline l<0.16; shirt h70-165; shorts h185-255; cream h31-62 with l≥0.6; skin h<31 with l≥0.6; hair is brown with l<0.6. Chin y was read by eye from 4x zoom crops (z/*-chin.png). Everything else was measured by script, then drawn as lines on the overlay, and I checked the overlay by eye. Line art is dark brown, not black. Fractions are given as value/headH (h) and value/figureH (f). All coordinates are in sheet pixels.",
 "conventions": {
  "headH": "hair top to chin (in the back views the front chin y is used)",
  "torsoTop": "top of the collar",
  "shoulder": "outer sleeve edge at cuff top. In front and back views the contour slopes continuously from the collar to the cuff with no horizontal shoulder. The 'contour' rows give the slope: [y, L, R, width] every 8px.",
  "widths": "include the line-art outline unless marked skin"
 },
 "male": {
  "front": {"bbox":[184,9,457,550],"w":274,"h":542,"headH":246,"headsTall":2.20,
   "head":{"chinY":255,"maxW(hair)":273,"maxW/h":1.11,"earToEar@y215":237,"faceSkinW@y215":155,"faceW/h":0.63},
   "neck":{"y":261,"skinW":38,"/h":0.154,"x":[303,340]},
   "torso":{"top":268,"top/h":1.053,"bottom(hem)":405,"bottom/f":0.731,"height":137,"/h":0.557,"hemW@399":117,"/h":0.476,"maxWwithSleeves@326":187,"/h":0.760,"centerX":319},
   "shoulder":{"y":318,"x":[232,408],"w":177,"/h":0.720,"contour":[[268,90],[276,116],[284,129],[292,140],[300,152],[308,162],[316,174]]},
   "cuffs":{"L":{"x":[231,263],"y":[318,350],"w":33,"h":33},"R":{"x":[376,407],"y":[318,350],"w":32,"h":33}},
   "arms":{"forearmW@355":25,"wristY":393,"wristW":20,"wrist/h":0.083,"handMaxW@404":24,"handTipY":422,"handH":29,"/h":0.118,"cuffTop→wrist":75,"/h":0.305,"cuffTop→tip":104,"/h":0.423,"torsoTop→wrist":125,"torsoTop→tip":154,"/h":0.626,"widthProfile[y,w]":[[359,29],[371,26],[383,24],[391,21],[399,22],[407,24],[415,20],[423,8]]},
   "shorts":{"top":401,"bottom":466,"h":66,"/h":0.268,"topW@407":121,"/h":0.492,"hemW@458":127,"/h":0.516,"cuffBand":"y≈455-466 (grey-blue)"},
   "legs":{"top":467,"shoeTop":508,"len":41,"/h":0.167,"thighW":36,"kneeW":32,"ankleW":28,"thigh/h":0.146,"ankle/h":0.114,"gapThigh":31,"gapAnkle":40,"L_x@470":[269,304],"R_x@470":[336,371]},
   "shoes":{"L":{"x":[250,305],"y":[508,550],"len":56,"h":43},"R":{"x":[334,389],"y":[509,550],"len":56,"h":42},"len/h":0.228,"innerGap":28,"centerSpacing":84,"outerW":140}},
  "right": {"bbox":[579,13,848,550],"w":270,"h":538,"headH":236,"headsTall":2.28,
   "head":{"chinY":249,"note":"jaw bottom is 6px above front chin","maxW(depth,hair)":268,"/h":1.136},
   "neck":{"y":255,"skinW":33,"/h":0.140,"x":[711,743]},
   "torso":{"top":264,"bottom":408,"height":144,"/h":0.610,"shoulderDepth@286":73,"x":[694,766],"chestDepth@306":84,"/h":0.356,"x2":[691,774],"hemDepth@402":105,"/h":0.445,"x3":[680,784],"centerX":732},
   "cuff":{"x":[707,748],"y":[330,347],"w":42,"note":"lower shaded half of roll reaches y≈358"},
   "arm":{"skinTop":347,"upperArmW":27,"wristW(min)@397-402":21,"handW@412-417":26,"handTipY":428,"x@wrist":[723,744],"handCenterX":≈735,"profile[y,l,r,w]":[[352,716,742,27],[372,718,742,25],[392,722,743,22],[402,724,744,21],[412,722,747,26],[422,723,744,22],[427,729,742,14]]},
   "shorts":{"top":409,"bottom":466,"h":58,"topDepth@415":86,"x":[690,775],"hemDepth@458":75},
   "leg":{"top":467,"shoeTop":512,"len":45,"thigh":39,"knee":35,"ankle":36,"narrowest@506":31,"x@470":[707,745]},
   "shoe":{"x":[699,775],"y":[512,550],"len":77,"/h":0.326,"h":39,"toeTowards":"+x (right)"}},
  "back": {"bbox":[973,12,1234,550],"w":262,"h":539,"headH(using front chin)":243,
   "head":{"maxW(hair)@127":258,"/h":1.06,"napeW@245":76,"neckVisible@255":48,"earsVisible":"y≈180-225 both sides"},
   "neck":{"y":261,"skinW":40},
   "torso":{"top":264,"bottom":405,"height":141,"hemW@399":121,"maxW@329":189,"centerX":1101},
   "shoulder":{"y":320,"x":[1013,1189],"w":177,"contour":[[264,67],[272,101],[280,123],[288,134],[296,145],[304,155],[312,167],[320,177]]},
   "cuffs":{"L":{"x":[1013,1042],"y":[320,351]},"R":{"x":[1160,1190],"y":[320,352]}},
   "arms":{"forearmW":24,"wristY":394,"wristW":20,"handMaxW":24,"handTipY":423,"handH":29,"cuffTop→wrist":74,"cuffTop→tip":103},
   "shorts":{"top":403,"bottom":465,"h":63,"topW":122,"hemW@457":133},
   "legs":{"top":466,"shoeTop(heel)":517,"len":51,"thigh":35,"knee":32,"ankle":31,"narrowest":28,"gapThigh":28,"gapAnkle":36},
   "shoes":{"L":{"x":[1044,1086],"y":[517,550],"w":43,"h":34},"R":{"x":[1114,1157],"y":[516,550],"w":44,"h":35},"innerGap":27,"centerSpacing":71,"outerW":114}}
 },
 "female": {
  "front": {"bbox":[173,556,478,1075],"w":306,"h":520,"headH":224,"headsTall":2.32,
   "head":{"chinY":780,"maxW(hair)@724":306,"/h":1.366,"faceSkinW@740":132,"/h":0.59,"hairBottom":"bob ends y≈784-790, roughly level with the collar"},
   "neck":{"y":786,"skinW":41,"/h":0.183,"x":[305,345]},
   "torso":{"top(peter-pan collar)":789,"bottom":924,"bottom/f":0.708,"height":135,"/h":0.603,"hemW@918":118,"/h":0.527,"maxW@850":189,"/h":0.844,"centerX":327},
   "shoulder":{"y":840,"x":[236,412],"w":177,"/h":0.790,"contour":[[797,116],[805,129],[813,142],[821,152],[829,163],[837,172]]},
   "cuffs":{"L":{"x":[234,268],"y":[840,871],"w":35,"h":32},"R":{"x":[378,412],"y":[841,871],"w":35,"h":31}},
   "arms":{"forearmW@876":25,"wristY":912,"wristW":20.5,"handMaxW@924":25,"handTipY":940,"handH":28,"/h":0.125,"cuffTop→wrist":72,"/h":0.32,"cuffTop→tip":100,"/h":0.446,"torsoTop→tip":151,"/h":0.674},
   "shorts":{"top":918,"bottom":984,"h":67,"/h":0.299,"topW@924":121,"/h":0.540,"hemW@976":111,"cuffBand(cream)":"y≈950-984"},
   "legs":{"top":982,"shoeTop":1034,"len":51,"/h":0.23,"thigh":37,"knee":32,"ankle":27,"gapThigh":27,"gapAnkle":40,"L_x@985":[274,310],"R_x@988":[338,374]},
   "shoes":{"L":{"x":[257,310],"y":[1034,1075],"len":54,"h":42},"R":{"x":[338,391],"y":[1034,1075],"len":54,"h":42},"len/h":0.241,"innerGap":27,"centerSpacing":81,"outerW":135}},
  "right": {"bbox":[576,559,845,1075],"w":270,"h":517,"headH":211,"headsTall":2.45,
   "head":{"chinY":770,"maxW(hair depth)@676":255,"/h":1.209},
   "neck":{"y":776,"skinW":29,"x":[719,747]},
   "torso":{"top":784,"bottom":927,"height":143,"/h":0.678,"shoulderDepth@802":69,"chestDepth@822":80,"x":[699,778],"hemDepth@921":109,"x2":[684,792]},
   "cuff":{"x":[710,756],"y":[851,867],"w":47},
   "arm":{"skinTop":868,"upperArmW":27,"wristW@918":20,"handW@933":27,"handTipY":946,"profile[y,l,r,w]":[[873,720,746,27],[893,723,746,24],[913,727,747,21],[918,728,747,20],[933,726,752,27],[943,729,747,19]]},
   "shorts":{"top":927,"bottom":990,"h":64,"topDepth@933":88,"hemDepth@982":83},
   "leg":{"top":991,"shoeTop":1036,"len":45,"thigh":40,"knee":36,"ankle":37,"narrowest@1026":32},
   "shoe":{"x":[704,782],"y":[1036,1075],"len":79,"/h":0.374,"h":40}},
  "back": {"bbox":[955,559,1255,1074],"w":301,"h":516,"headH(front chin)":221,
   "head":{"maxW(hair)@724":301,"/h":1.36,"note":"bob hair hides the neck completely (skin width at y786 = 0)"},
   "torso":{"top":790,"bottom":921,"height":131,"hemW@915":119,"maxW@852":184,"centerX":1103},
   "shoulder":{"y":842,"x":[1016,1188],"w":173,"contour":[[790,86],[798,112],[806,125],[814,137],[822,146],[830,158],[838,167]]},
   "cuffs":{"L":{"x":[1014,1046],"y":[847,873]},"R":{"x":[1158,1188],"y":[842,873]}},
   "arms":{"forearmW":26,"wristY":912,"wristW":19.5,"handMaxW":23.5,"handTipY":940,"handH":27.5,"cuffTop→wrist":70.5,"cuffTop→tip":98},
   "shorts":{"top":917,"bottom":979,"h":63,"topW":122,"hemW@971":129},
   "legs":{"top":980,"shoeTop(heel)":1037,"len":57,"thigh":38,"knee":32.5,"ankle":32,"narrowest":27.5,"gapThigh":24,"gapAnkle":37},
   "shoes":{"L":{"x":[1042,1088],"y":[1038,1073],"w":47,"h":36},"R":{"x":[1116,1162],"y":[1036,1073],"w":47,"h":38},"innerGap":27,"centerSpacing":74,"outerW":121}}
 },
 "crossFigureRatios": {
  "headsTall": "2.20 (male front) to 2.32 (female front)",
  "torso(collar to hem)": "0.56-0.60 h",
  "hemWidth": "0.48-0.53 h, about 117-121 px in every front/back view",
  "shoulderAtCuffTop": "about 177 px in every front/back view (0.72 h male, 0.79 h female)",
  "cuffBox": "about 33x32 px, slanted outward",
  "armBelowCuff": "forearm 25, wrist 20, hand 24 px wide; hand tip about 100-104 px below the cuff top, which is 25-28 px above the shorts bottom, so the hands hang beside the upper shorts",
  "shorts": "about 121 px wide at the top, flaring to 127-133 at the cuff, 63-67 px tall",
  "legs": "visible only 41-58 px between shorts and shoe; thigh 36-38, knee 32, ankle 27-31 px wide; inner gap 24-31 at the thigh and 36-40 at the ankle",
  "shoesFront": "about 55x42 px, inner gap 27-28, centre spacing 81-84",
  "shoesProfile": "77-79 x 39-40 px, toe pointing right",
  "shoesBack": "about 44-47 x 35 px"
 },
 "colors": {
  "skin": {"base":"#f9d2bb","shade":"#dca78f","highlight":"#fbe0cd","blush":"#ebaf9f","outline":"#240704"},
  "hairMale": {"base":"#5d3925","shade":"#45291a","highlight":"#935a3a","outline":"#210f08"},
  "hairFemale": {"base":"#5f3b26","shade":"#472b1b","highlight":"#9a5f3e","outline":"#1e0d06"},
  "shirtMale(dark green)": {"base":"#426b4d","shade":"#30523b","highlight":"#4b7858","outline":"#0c190f"},
  "shirtFemale(bright green)": {"base":"#8dd243","shade":"#5e9f2c","highlight":"#a4e158","outline":"#234615"},
  "cuffCollarMale(cream)": {"base":"#fcf2da","shade":"#f5ddbe","highlight":"#fefbe9","outline":"#322a19"},
  "cuffCollarFemale(cream)": {"base":"#fcf3d9","shade":"#f6debd","highlight":"#fdfbea","outline":"#3e3a13"},
  "shortsMale(navy denim)": {"base":"#333f60","shade":"#242c45","highlight":"#3e4a6e","outline":"#0c0b16"},
  "shortsMaleRolledCuff": {"base":"#7f829a","shade":"#41465c","highlight":"#999cb0"},
  "shortsFemale(sky blue)": {"base":"#62aef1","shade":"#2b69ba","highlight":"#8ccbf9","outline":"#28273f"},
  "shortsFemaleCuff(cream)": {"base":"#fbf1d7","shade":"#f8dfc0","highlight":"#fefae6"},
  "shoesMale(ivory)": {"base":"#f6dcb1","shade":"#e7b979","highlight":"#fdfbf4","outline":"#734927"},
  "shoesFemale(ivory)": {"base":"#f8ddaf","shade":"#eaba7a","highlight":"#fdfcf4","outline":"#855633"},
  "shoeFlowerAccents": {"yellow":"#f5cc7e / #f3b43d","green":"#609524 / #368326"},
  "femaleFlowerPetals":"#faecda (hi #fdfdf9)",
  "flowerCentres": {"base":"#f8b520","shade":"#f19a13","highlight":"#fcd433"},
  "acornEmblem": {"base":"#d38a37","shade":"#955022","highlight":"#f6c461"},
  "iris": {"base":"#213c41","shade":"#0e191d","highlight":"#589c91"},
  "colorNote": "Shade, base and highlight are the 5-15%, 40-60% and 90-98% luminance bands of each class. Outline is the darkest 25% of edge pixels next to that material."
 },
 "caveats": [
  "The female bob covers the neck in the back view and the jaw sides in the front view, so the female head max width is the hair width, not the skull width.",
  "In the profile, the cuff box only covers the bright upper half of the roll. The shaded lower half reaches about y358 for the male and about y868 for the female.",
  "Back-view 'shoeTop' is the heel top, which is about 8px lower than the toe-cap top in the front view.",
  "Female-right blueBottom (1062) is wrong because blue flowers on the shoe were counted. Use shorts bottom 990 instead."
 ],
 "files": {
  "cutouts": ["C:/Users/user/AppData/Local/Temp/claude/C--Users-user-Desktop-game-main/6b0944f9-c5fb-4d6c-8012-7f43a8dba426/scratchpad/base-char/ref/male-front.png (290x558, origin 176,1)","…/ref/male-right.png (286x554, origin 571,5)","…/ref/male-back.png (278x555, origin 965,4)","…/ref/female-front.png (322x536, origin 165,548)","…/ref/female-right.png (286x533, origin 568,551)","…/ref/female-back.png (317x532, origin 947,551)"],
  "annotated": "C:/Users/user/AppData/Local/Temp/claude/C--Users-user-Desktop-game-main/6b0944f9-c5fb-4d6c-8012-7f43a8dba426/scratchpad/base-char/ref/annotated.png (native size; ref/annotated-2x.png is a 2x copy for reading the labels)",
  "classMap": "…/scratchpad/base-char/ref/classmap.png",
  "rawJson": "…/scratchpad/base-char/ref/measure-raw.json (every value above plus per-row arm profiles), …/ref/colors.json",
  "scripts": "…/scratchpad/base-char/{common,classify,cut,measure,annotate,colors,zoom}.cjs",
  "zoomChecks": "…/scratchpad/base-char/z/{mf,ff,mr,fr}-chin.png, z/a-*.png (per-figure 2x overlays), z/cutouts-check.png"
 },
 "projectFilesEdited": "none"
}

## rig

Current foundation character measured at 280px idle, compared with the reference using the same measuring code, and mapped to code. No project files were edited.

## 1. Captures
- `C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-game-main\6b0944f9-c5fb-4d6c-8012-7f43a8dba426\scratchpad\base-char\cur\{male,female}-{front,right,back}.png` (transparent background, bones off, 기본 착장 on)
- Each part captured alone: `...\base-char\cur\layers\{sex}-{dir}-{head,headView,backHair,neck,shirt,sleeves,arms,shorts,legs,shoes}.png`
- Overview of all six views plus the male-front parts: `...\base-char\cur\contact-sheet.png`
- Raw numbers: `...\base-char\cur\measure.json` (per-part boxes) and `...\base-char\cur\profile.json` (the same width-scan run on the 6 reference tiles and the 6 captures)
- Scripts: `cur-capture.cjs`, `profile.cjs`, `arms.cjs`, `arms2.cjs` in the same folder.

At 280px the SVG is 160×310 px, so 1 viewBox unit = 5 px. The SVG origin sits at (60,30) in each capture.

## 2. Current measurements (male front)
Rows in capture px: hair top 32, chin 168 (centre column of the head-only layer), feet 313, shadow centre about 314.

Same width-scan on both images: H = hair top to the first row where width falls below 55% of the widest head row. Reference H = 227 px; current H = 127 px. Values are fractions of H.

| Proportion | Reference | Current | Where it comes from in the current figure |
|---|---|---|---|
| Total height | 2.35 | 2.22 | 282 px |
| Head width | 1.20 | 1.14 | 145 px |
| Narrowest neck | 0.23 | 0.20 | 26 px |
| Chin to collar | 0.15 | 0.13 | shirt top at 175 |
| Shoulder/sleeve outer span | **0.82** | **0.57** | 72 px (shirt 68 px plus sleeves) |
| Shirt height | 0.59 | 0.52 | rows 175–241 |
| Shirt hem width | 0.37 | 0.44 | 56 px |
| Visible shorts | 0.22 | 0.22 | rows 241–269 (whole shorts image 233–269) |
| Shorts bottom to floor | 0.40 | 0.35 | 44 px |
| Visible forearm length | ~0.37 | 0.32 | 41 px below the sleeve |
| Arm width | ~0.11 | 0.11 | 14 px |
| Gap between arm and torso | 3–10 px | **none** | columns 104–175 are solid on rows 182–245 |
| Leg width at shorts cuff | **0.23** | **0.12** | 15 px |
| Leg width at ankle | 0.15 | ~0.10 | |
| Gap between legs | 8–33 px | 22 px, constant | |
| Shoe span (both) | 0.62 | 0.53 | 67 px |
| Shoe height | ~0.16 | 0.15 | 19 px |

Shoulder span as a share of total height (no head definition needed):
- Front: reference 0.35, current 0.255.
- Back: reference 0.357, current 0.285.

Female front:
- Total height: reference 2.23, current 2.19 (H 233 vs 118).
- Head width: reference 1.31, current 1.29.
- Shoulder span: reference 0.80, current 0.61.
- Below the neck, the female body is pixel-identical to the male: shirt, shorts, shoes and arms have the same boxes in measure.json.

Right profile (male):
- Total height: reference 2.37, current 2.47.
- Torso span: reference 0.40, current 0.37.
- Shirt height: reference 0.60, current 0.62.
- Shorts bottom to floor: 0.41 in both.
- In the female right view, the far arm is fully hidden.

**Main differences:**
- Shoulders and sleeves are about 30% too narrow.
- Arms hang inside the shirt outline instead of standing clear of it.
- Thighs and calves are about half the reference thickness.
- The body below the chin is too short: chin to floor is 1.07 head heights now (27.6 to 56.75 units) against about 1.35 in the reference.
- Shoes are about 15% narrow.
- There is no female-specific body or outfit.

## 3. Constants that control each proportion

**avatar-foundation.js**
- `:5` `SPEC` joints, in body units before scaling:
  - waist 38.1, knee 41.3, ankle 44.15, floor 46.05
  - hip x 13.65 / 18.35
  - shoulder (12.7, 29.9) / (19.3, 29.9)
  - profileShoulder 15.6 / 15.85, profileHip 15.65 / 16.35
  - elbow (12.15 / 19.85, 34.05), wrist (12.2 / 19.8, 36.7)
- `:15` `THIGH = 1.04`
- `:18` `BODY_SCALE = {x: 1.55, y: 1.593}` and `ARM_RADII = [.96, .82, .59]`.
  - After scaling: shoulder span 10.23 u (51 px), waist at 44.09, knee 49.19, ankle 53.73, floor 56.75.
  - Arm width: 2×.96×1.55 = 2.98 u (about 15 px).
  - Thigh width: 2×1.04×1.55 = 3.2 u (16 px).
- `:48` `REST_ABDUCTION = atan2(.55, 4.15)`, about 7.5°. With wrist x 12.2 the hand ends inside the shirt edge at 11.55, so the arms overlap the torso.
- `:240` profile narrows legs by 0.8.
- `:254` leg widths `[THIGH*narrow, .89, .49]`; the leg runs to ankle + .36.
- `:262` arm limb uses `ARM_RADII`.
- `:241` calibration torso path; `:250` pelvis; `:251` underlay. The outfit hides all three.
- `:243–249` neck paths and neck shadow. This is the only sex-specific body geometry: female profile neck starts at 26.10, male at 26.55; front female/male curves differ slightly.
- `:166` viewBox `0 0 32 62`, width `size*32/56`. `:171` contact shadow at cy 56.75, rx 6.2.
- `:9–12` `HEAD_NECK_CUT`: male front/profile/back; female profile only. `:20–23` `BACK_HAIR_NECK_CUT`.
- `:37–38` `GAIT`, `:65` idle breath and drop: these are the motion constants.

**avatar-foundation-skin.js**
- `:5` source `assets/sd-foundation-skin-rounded.png` (1536×1024).
- `:8–10` neck crops from `sd-foundation-neck.png` (2172×724).
- `:12–17` arm and leg crop rects, joint landmarks and radii in source pixels (e.g. armFront radii [58, 47, 39], legFront [76, 52, 39]).
- `:33` hand/foot extension past the wrist/ankle: arm 1.04, leg .36.
- `:66` neck painting rect x 13.9, y 26.1, w 4.2, h 4.6.
- `:67` painted widths reuse `armRadii` and `THIGH`; profile legs use 1.
- `:21` `SEAM = .9`; `:56` `PAINT_MEDIAN` and `FACE_LUMINANCE` for tinting.

**avatar-foundation-outfit.js**
- `:95` default source `sd-foundation-basic.png` (1448×1086).
- `:102` `SHORTS_TOP = 35.7` (40.27 after scaling, about 233 px) and `SHORTS_HEIGHT = 5.05`.
- `:104` `ANKLE_IN_SHOE = .06`.
- `:110–127` crops:
  - shirtFront/Back from `sd-foundation-torso.png` (1774×887), rect 610×699
  - shirtProfile from `sd-foundation-shirt-profile-rounded.png`
  - sleeves from `sd-foundation-sleeves.png`; raised sleeves from `sd-foundation-sleeves-raised.png` (rig root, mouth, reach 2.4 / 2.17)
  - hip front/back/profile and 4 shoe crops (anchor, ground, collar hole)
- `:255` **shirt placement**: x 11.55 (profile 13.15), y 28.55, w 8.9 (profile 5.7), h 8.65. After scaling this is 13.8 u = 69 px, which sets torso and shoulder width.
- `:162 / :172` sleeve mesh frame: front x −1.8 / −1.3 + 3.1u, y −.7..2.7; profile x −1.43 + 2.7u, y −.42..2.56.
- `:264` skin clip under the sleeve starts 1.75 (profile 1.95) below the shoulder. `:266` sleeve painted in an 8×8 box at (−4, −4). `:260` sleeve opening 2.18 along the arm.
- `:194` raised-sleeve blend between 50° and 65° of lift.
- `:204` shorts origin [12.05 (profile 13.3), 35.7], size [7.9 (profile 5.4), 5.05]. `:208` thigh weighting starts at y 37.6 over 1.6. `:210` follows the thigh at (y − 38.1)/3.2.
- `:277` shoe width 3.1 front, 2.5 back, 3.7 profile/floor; sole height 1.9 (floor .6).

## 4. How the head is placed
- **Head art.** `headViews()` (foundation.js `:155–161`) renders a body-less `QPAvatar.render(base, 280, 3)` and takes three things from it:
  - the front `.qpx-head`
  - the `#qpx-head-front` clip: rect y −8..28.45 (avatar-pixel.js `:598`)
  - the back hair `.qpx-back-hair`

  Profile and back heads come from `QPAvatarDirection.headMarkup` (avatar-direction.js `:393–401`). Results are cached by avatar data (`headCache`).
- **Front head.** Tile from `sd-heads-{male,female}.png` (1448×1086, 4×3 grid; male `short` = tile 0, female `bob` = tile 1). It is normalized to a 384px canvas drawn as a 32×40 u image (avatar-pixel.js `:576`). Scale makes the face 18 u wide (with a 15.35 u half-width cap), the eyes are centred on x = 16, and **the chin lands at y = 28** (avatar-pixel.js `:140–141`). Measured chin: 27.6 u.
- **Profile head.** From `sd-heads-profile-*.png`, scale 25.8/(w+6), neck anchor at (16, 28.65) (direction.js `:8`, `:98`).
- **Back head.** From `sd-heads-back-*.png`, scale min(28.6/(w+6), 24/(anchor−3)), anchor at (16, 28.75) (direction.js `:10–11`, `:110–111`).
- **Attachment to the body.**
  - The body group is scaled 1.55×1.593 about (16, 28) (`:172`).
  - The head is **not scaled**. Each frame it is only moved by the neck offset times `BODY_SCALE`, plus a small nod offset (`:237`).
  - So the head stays at its native 32×40 u size, and only the part below y = 28 gets wider and longer.
  - Head and body ratios are therefore set by `BODY_SCALE` together with the head normalization (18 u face, chin at 28).
- **Neck.**
  - The painted necks in the head art are cut off by `HEAD_NECK_CUT`, but only for the reference hairstyles (`:183–185`).
  - The body draws its own neck: a per-direction path (`:244`), with the painted `neck{Front,Profile,Back}` texture clipped to it (skin.js `:65–66`) and a shadow gradient (`:248`).
  - Back hair is drawn behind the body, clipped to y 28.2–48.2 minus the stump cut (`:176`), and only in the front view (`:237`).

## 5. How the outfit is attached
- **Loading and cleanup.** `load()` (outfit.js `:227`) loads every source PNG and runs `preparePart` on each crop (`:129–139`). That keeps the largest connected shape and cuts collar/cuff holes. It then:
  - builds `shoeFloor` from the profile shoe, squashed by 0.4
  - mirrors the raised sleeves for the left arm
  - feathers the sewn sleeve edges (`seamTexture`)
- **Each frame, `apply()` (`:248`):**
  - Hides the calibration torso, pelvis and underlay.
  - Shirt: one rigid image per view inside the torso group (`:255`). Breathing comes from the torso matrix.
  - Shorts: one image warped on a 10×10 grid (`shortsTexture`, `:202–219`). The top rows follow the pelvis and the rows below y 37.6 bend toward each thigh.
  - Sleeves: a 12×18 cloth grid pinned at the shoulder seam, re-drawn in 2° steps of arm rotation (`:167–188`), cross-faded to the raised art for gestures (`:193–198`). The upper-arm skin under each sleeve is clipped away (`:264`).
  - Shoes: one image per view, anchored at the ankle and rotated by the foot angle (`:271–289`).
- **Skin.** skin.js `apply()` (`:60–77`) warps the arm/leg paintings onto the bones on an 18×2 grid per limb and tints them with one colour matrix. It hides the vector hands (`:76`), so the hand is the painted extension past the wrist.
- **Why the female wears the male outfit.**
  - The outfit module has no sex input: `definitions` (`:109–128`) and `apply()` never read `data-qpx-sex`.
  - `render()` loads it for every avatar whose `foundationOutfit` is not `'body'` (foundation.js `:164`), and the studio passes `'basic'` for both (avatar-standard.js `:301`).
  - Only one outfit art set exists: `sd-foundation-torso`, `-sleeves`, `-sleeves-raised`, `-shirt-profile-rounded`, `-basic` (hips, shoes) and the skin/neck files.
  - The reference female outfit (bright flower tee, peter-pan collar, pocket, blue flower shorts) needs new per-sex art and per-sex `definitions`, or a sex-keyed source map.
- **Scope.** In the game this rig is only used with `?avatar=foundation` (index.html `:2371`). The shop and maps still use `QPAvatar.render` (avatar-pixel.js `:606`, `BODY_PROPORTIONS` at `:12`: 1.18 × 1.593). There, males get an extra `translate(-.64 0) scale(1.04 1)`, which the foundation rig does not have.

## 6. Differences mapped to code
| Difference from the reference | Constants to change |
|---|---|
| Shoulders 0.57H vs 0.82H | `SPEC.shoulder` x, shirt rect `:255` (8.9 u wide), sleeve frame `:162/:172`, torso crop |
| Arms overlap the torso | `SPEC.elbow`/`SPEC.wrist` x, `REST_ABDUCTION` (`:48`) |
| Legs about half as thick | `THIGH` and the leg widths `.89/.49` (`:254`, skin.js `:67`), shorts size `:204` |
| Body below the chin too short | `BODY_SCALE.y`, plus `SPEC.knee`/`ankle`/`floor` and the shadow position |
| Shoes about 15% narrow | shoe width 3.1 at `:277` |
| Female has no body or outfit of her own | outfit.js has no sex branch; new art and definitions needed |

## motion

# Foundation motion system: catalogue, defects and integration

The foundation motion rig is technically careful, with fixed bone lengths and 3D depth for the arms. But the motions themselves are small and stiff, several poses are visibly wrong, and the rig is not ready to show in any static portrait. In one sentence: the joints work, but the animation is not good yet. Every observation below comes from contact sheets I rendered at 280px and looked at, with zoomed crops where needed. Nothing under 퀴즈나라 was edited.

## 1. How each action is driven (`avatar-foundation.js` `solve()`, lines 52–149)

**Shared setup**
- Body coordinates sit on a 32×62 grid. Joint positions are in `SPEC` (line 5): waist 38.1, knee 41.3, ankle 44.15, front hips at x 13.65/18.35, profile hips at 15.65/16.35, shoulders at 12.7/19.3 and y 29.9.
- The whole body is scaled by `BODY_SCALE` {x 1.55, y 1.593} around point (16, 28) (line 18, applied at line 172). Arm thickness is `ARM_RADII` [.96, .82, .59].
- Thigh is 3.2 long and shin 2.9; legs are bent by a two-bone solver (`ik`, line 30).
- Arms (lines 48–50, 118–143) use one body-frame model with swing, abduction, elbow flexion and forearm angle, then project it per view with `view3d`. Bone lengths never change; depth carries the foreshortening.
- Walk, run and climb snap to 24 drawn poses per cycle (line 58).
- Facing left is the right-facing drawing mirrored (line 236). Climb always forces the back view (line 53).

**Per action**
- **idle:** breathing `(1-cos(1.9t))/2` drops the body 0.07 and moves the arms by about 1.2° swing and 3° elbow bend (lines 63, 65, 128). In profile the ankles are offset ±0.32 (line 71).
- **walk** (`GAIT.walk`, line 37): foot is on the ground 60% of the cycle, stride ±1.75, foot lift 1.35, toe angle 14°, bob 0.28 ± 0.17. Arm swing ±24°, elbow 14 ± 10°. Lean 3° plus 0.8 in profile. In front/back the hips sway 0.11 and roll 1.4°. Legs are 180° out of phase; in front/back the knee bend goes into depth (lines 87–92).
- **run** (line 38): foot on the ground 36% of the cycle, stride ±2.25, foot lift 2.45, lean 9°. Arm swing ±44° with the elbow bent 102°, arms 9° further out, and the forward forearm folds up to 26° toward the chest (line 123).
- **floor-sit** (lines 78–84, 109): no solver. Knees and ankles are fixed coordinates per view; the body drops 5.6; profile lean is 2°. The leg is drawn with a custom outline (`seatedLeg`, line 228) and the arms are fixed vectors. Shoes use a squashed `shoeFloor` image (outfit lines 50–56) at ±8°.
- **sit (desk):** drop 1.55. Knee is at hip +2.4/+1.8 in profile, otherwise +3.05 straight down. Arms are fixed vectors.
- **jump:** `crouch` scales compression 0–1, drop up to 0.85 and profile lean 7°. In the air, `rise = vy/480` and `tuck = 1 − |rise|·0.72`: ankles rise up to 2.4 and arms open 30–40° (lines 60, 73–76, 126–127). The studio adds a lift of up to 3.6 (`avatar-standard.js:14`).
- **wave / nod / happy:** these are gestures blended in over 0–0.18 and out over 0.82–1 of the progress (line 51).
  - Wave: right arm only. Front 112° out, back 104°, profile 130° forward. The forearm flaps ±22° at 3.5 Hz (lines 133–139).
  - Nod: the head moves 0.42 down and 0.35 forward, twice, plus 4° lean (lines 64, 237).
  - Happy: hop of 1.7 × |sin 3πp|; arms 142° out with forearms at 150° (lines 129–131).
- **climb:** wrists alternate between y 30.5 and 25.9 at x = 16 ± (4.9–5.6); elbows come from the solver; feet lift up to 1.9 (lines 77, 112–117).

**Which art swaps per view**
- Head: front, profile or back view (line 238). Back hair shows only in front view (line 237). Each view has its own neck clip and neck path, which also differ by sex (lines 241–249).
- Shirt: front, back or profile image. Sleeves: front-left/right, back-left/right, or one profile sleeve. Raised-sleeve art replaces them when the arm lifts 50–65° (outfit lines 104, 178).
- Shorts: front, back or profile image, deformed by the hips and thighs. Shoes: left, right, back, profile, or the floor variant.
- Skin: arm and leg paintings for front, profile and back (skin `defs`).

**Layer order rules** (lines 270–288)
- Back view while seated or climbing: both arms go behind everything.
- Seated: legs, pelvis, torso, then arms.
- Profile: far arm, far leg, near leg, pelvis, torso, near arm.
- Front/back: an arm moves behind the torso only while walking or running with depth below −0.9.
- During wave or happy (progress 0.05–0.95, not in back view), the raised arm moves to the `frontHands` group above the head.
- Sleeves sit before the hand (outfit line 150). Skin is clipped from 1.75 along the arm (1.95 in profile) (line 174).
- A forearm folded toward the viewer (depth > 0.6, not profile) is drawn again above the sleeve (skin `forearmOverlay`, line 289).
- Floor-sit shoes move above the whole body (outfit line 197).

## 2. Visual defects

Sheets are in `C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-game-main\6b0944f9-c5fb-4d6c-8012-7f43a8dba426\scratchpad\base-char\motion\`:
- `{idle,walk,run,floor-sit,sit,jump,wave,nod,happy,climb}.png`, each with 4 direction rows, male and female side by side.
- Bone-overlay versions: `walk-bones.png`, `run-bones.png`, `floor-sit-bones.png`, `climb-bones.png`, `wave-bones.png`.
- Zoomed crops are `..\base-char\z-*.png`.

**Against the reference artwork (every action)**
- **D1. The female wears the male outfit.** There is no flower tee, peter-pan collar, flower shorts or flower sneakers: `avatar-foundation-outfit.js:5` loads one `sd-foundation-basic.png`, and the assets folder has no female set.
- **D2. Wrong emblem.** The male chest shows a two-leaf sprig, not the acorn.
- **D3. Wrong proportions.** The torso is about 0.55× the head width (reference is about 0.75×) and very thin in profile. The neck shows as a long skin column (about 2 units in profile; the reference barely shows one). In profile the shorts bulge like a rounded bag (see `idle.png` and `z-walk-mleft.png`).

**Per action**
- **D4. walk:** The stride is tiny (±1.75) and the knees barely bend, so in profile it reads as shuffling. Front/back arm swing is hard to see (`walk.png`, `z-walk-mleft.png`).
- **D5. run:**
  - Front/back: the folded forearms are flat stubs pasted on the shirt, and the sleeve on the folded arm becomes a pale, frayed, partly see-through patch (`z-run-arm.png`, p=0.2).
  - Profile: a 9° lean and a short upward heel kick look like a jog in place (`z-run-mright.png`).
- **D6. floor-sit is not a cross-legged sit.**
  - Front: the thighs are short flat ovals and the shoes become a squashed pale smear under the legs. Neither the crossed feet nor the ankles can be read (`z-floor-f.png`).
  - Profile: the knee comes only about 3.5 units forward, so it looks like kneeling or squatting. The arms hang straight down beside the torso instead of resting on the knees (`z-floor-p.png`).
  - Back: no shoes, bare shin stubs, and the arms are hidden behind the shirt (`z-floor-b.png`).
- **D7. sit (desk):** Front and back look like standing with hands in pockets, with no foreshortened thighs. Profile looks like a half squat with no seat.
- **D8. jump:** The crouch is barely visible (at p=0.03 the drop is only about 0.5). The air arms are a stiff, wide-elbowed "T" and the legs tuck only slightly. Profile arms point forward, rigid (`jump.png`).
- **D9. wave:**
  - Profile: the waving hand covers the nose and mouth at p 0.3–0.7, even though the comment at line 136 says this was fixed.
  - Front: at the start and end the arm sticks straight out horizontally, and the raised sleeve stretches into a long tube.
  - Profile p=0.12/0.88: the sleeve fades out near the elbow because of the raised-art alpha fade (outfit line 71) (`z-wave-mleft.png`, `z-wave-sleeve.png`).
- **D10. happy:**
  - Front/back: the forearms bend inward onto the head, so it reads as clutching the head ("headache"), not cheering.
  - Profile: the raised near arm passes straight across the face at p 0.3–0.7.
  - The hop is small (`happy.png`).
- **D11. nod is essentially invisible.** The head only shifts 0.42 down with no rotation (`z-nod.png`).
- **D12. climb:**
  - Both arms are layered behind the shirt (line 273), so the upper arms vanish and stubby hands poke out at the sides.
  - The hands never go above the head (highest y is 25.9, ear height) and reach sideways to x ±5.6, which is wider than any rail.
  - The legs stay straight, with knee bend lost into depth. No ladder is drawn to check whether the hands sit on rails (`climb-bones.png`, `z-climb-b.png`).
- **D13. Static rendering is broken.** `render()` (line 162) returns empty body groups with all three head views visible. Without `apply()`, a portrait shows stacked hair and no body. I checked this with `avatarSVG` under `?avatar=foundation`: `scratchpad\base-char\static-foundation.png`. The outfit field (e.g. `top:'hoodie:2'`) is also ignored.

## 3. Integration points

- **Switch:** `index.html:2370–2371` `avatarSVG()` returns `QPAvatarFoundation.render(av,size)` only when all of these hold: `QPDemo`, `?avatar=foundation`, and the Outfit, Direction (including back), Clothes and Shoes image sets are ready. `lod` is ignored, so lists at lod 1 and 21-player screens get the full image-mesh avatar.
- **Image loading:** the outfit images load only with `?avatar=foundation` or `session=foundation-studio` (`avatar-foundation-outfit.js:138–139`). Script tags are at `index.html:828–831`.
- **Pose dispatch:** `avatar-poses.js` hands off on `svg.dataset.qpFoundation` in `prepare` (229), `apply` (462), `reset` (732) and `destroy` (756). The public object is `QPAvatarPose = {prepare, apply, reset, destroy}` (772).
- **What the foundation reads from the state:**
  - `action`: idle / walk / run / floor-sit / sit / jump / climb.
  - `direction` (front/back/left/right), falling back to `facing`.
  - `phase`, `time` (defaults to `performance.now()`), `seatMode` (desk/floor).
  - `grounded`, `vy`, `jumpCompression`.
  - `gesture` (wave/nod/happy), `gestureProgress`, `showBones`.
- **Callers:**
  - `school-room-world.js` covers the classroom, playground and shared maps. It renders via `options.renderAvatar` (159; `index.html:3248`), then `prepare` (172), `apply` (379) and `destroy` (158, 331). It maps poses as follows:
    - seat → sit/desk
    - `sit-floor` → floor-sit
    - climb → climb, or walk on stair-type climbs
    - moving → walk or run
    - gestures: `hello` → nod, `happy` → happy, otherwise wave
    - climb phase is height/84
  - `avatar-motion.js:52` (motion practice world, `index.html:3282`) passes its own state: `facing` left/right only, plus `vy`, `jumpCompression`, `grounded`. It never sends gestures.
  - `quiz-map.js:29/32/355` and `round-scene.js:25` (sends only `facing:'right'`) call `QPAvatarPose` directly.
  - `map-avatar-display.js:118` `maskAvatar` puts a luminance mask on the outer SVG for tree overlap, so it works for both renders unchanged.
- **Static places with no pose call** will show D13 under the foundation flag: shop preview `pvStage` (`index.html:3388`), profile and menus (3104, 4028, 4100), lists (3331, 3896, 4488…), fashion and results (4404, 4597). For these, the foundation needs a call to `QPAvatarFoundation.reset(svg)` / `QPAvatarPose.apply` (idle, front) once the SVG is mounted, or `render` has to pose itself.

## Main things to fix first
1. Add the female flower outfit art (D1), the acorn emblem (D2), and torso width, neck and profile depth to match the reference (D3).
2. Make `render()` produce a posed idle by itself (D13), so the shop and avatar windows work.
3. Rework floor-sit, both raised-arm gestures (no hand over the face, real cheer and wave arcs), nod with real head rotation, and climb (arms in front, hands above the head on rails).
4. Increase walk/run stride and knee bend, and repair the run-forearm and raised-sleeve transparency.

## propagate

The base body already plugs into the shared renderer, but it is far from usable everywhere. Today it shows one fixed outfit, drops every piece of the player's own clothing, and draws only a floating head unless a motion controller runs it. These problems are fixed by an adapter, a static-pose fallback and per-item art. Most of the cost is the clothing art (strategy C below).

**What I checked (all files read-only; probe scripts are in `scratchpad/base-char/scope/`):**
- `general-vs-foundation.png`: the same two outfitted avatars in front, right and back views, current render next to the base body. The base body loses the jacket, cargo pants, boots, cap, glasses, bag and dog, and the female hood, skirt, ribbon, pearl and cat. It also puts the female in the male dark-green tee and navy shorts. Her flower outfit from the reference image does not exist as art.
- `static-and-crowd.png`: the base body rendered at 36, 50, 98 and 210 px without a motion call shows **only the head**. The body groups are empty because `render()` (avatar-foundation.js:162-191) builds empty parts and only `apply()` (:234) draws the body. The image also shows a 21-avatar crowd of each kind.
- Crowd timing, 21 avatars at 98px, headless software rendering (not a real-device number):

| | First render | Prepare | Walk frame median | Walk frame 90th percentile | First (cold) frame |
|---|---|---|---|---|---|
| Current render | 146 ms | 181 ms | 4.8 ms | 43 ms | 688 ms |
| Base body | 188 ms | 5.5 ms | 4.9 ms | 11.8 ms | 825 ms |

## 1. Every place that draws an avatar

Everything except the shop thumbnails goes through one function, `avatarSVG(av,size,lod)` at index.html:2370. It already switches to the base body (`QPAvatarFoundation.render`) only when the page has `?demo=1&avatar=foundation` and the outfit atlases are loaded (:2371). Otherwise it uses `QPAvatar.render` (:2373). The base render ignores `lod`.

| Where (file:line) | Screen | Size / detail level | Animated? |
|---|---|---|---|
| index.html:3104 | Home portrait | 250 / 3 | static |
| index.html:3248 → school-room-world.js:159 | All shared maps (village, campus, playground, forest garden, treehouse, sky island, picnic, autumn park, camp; index:3264-3276) | 120 / 3, camera 0.76 | **pose controller** (school-room-world.js:172 prepare, :379 apply, :158/:331 destroy) |
| index.html:3282 | Motion practice | 224 / 3 | **pose controller** (index:3293) |
| index.html:3313 → classroom-flow.js:121 | Classroom quiz map, players, round scene | 90 / 3 | quiz map **pose controller** (quiz-map.js:29/:355); round scene **pose controller** (round-scene.js:25); player list static (classroom-flow.js:235) |
| index.html:3331 | Classroom ranking | 40 / 1 | static |
| index.html:3388 | Shop preview | 280 / 3 | static |
| index.html:3531 | Shop male/female chooser | 210 / 3 | static |
| index.html:2418 (`partThumb`) | Shop one-piece outfit thumbnails | h / 1, cropped from the body group | static, current render only |
| QPAvatar.thumb (avatar-pixel.js:613) | All other shop item thumbnails | 64-138 | item only, no body |
| index.html:3733 → quiz-classroom.js:477 | Teacher dashboard | 42 / 1 | static |
| index.html:3896 | Teacher student list | 36 / 1 | static |
| index.html:4006, 4028, 4100 | Practice road, step, done | 50/1, 210/3, 170/3 | static |
| index.html:4404, 4597 | Fashion cards | 208 / 2, 196 / 2 | static |
| index.html:4488, 4567 | Hall of fame rows | 46 / 1 | static |
| index.html:4835 | Live lobby player cards | 68 / 1 | static |
| index.html:4903 (called at 4910, 4943) | Stage quiz assembly and seats | 154 / 3, 112 / 3 | static |
| index.html:4944 | Stage quiz profile card | 224 / 3 | static |
| index.html:4953 | Live OX field | 98 / 3 | moving wrapper, no limb poses |
| index.html:4991 | Results champion | 264 / 3 | static |
| index.html:5050 → quizquiz.js:60, 84, 482, 521, 787, 831 | QUIZQUIZ head chips, my picture, stage players, podium, OX actors, survivors | 70/1, 132/3, 96/3, 88/70/3, 72/3, 62/3 | static (OX actors move only the wrapper) |
| assets/playground-library/preview.html:34 | Map preview tool | 76 / 3 | — |
| avatar-foundation.js:158 | Base body borrows the head (hair, face, expression) from `QPAvatar.render` | 280 | — |

The motion entry points already hand base-body avatars to the base rig: `QPAvatarPose` prepare, apply, reset and destroy forward them at avatar-poses.js:229, 462, 732 and 756.

Two consequences:
- Only the maps, motion practice, quiz map and round scene animate limbs. About 20 static sites would render a bare head.
- The current render's idle breathing and blinking uses CSS animations kept in sync by the MutationObserver at avatar-pixel.js:643-645. The base SVG has no `.qpx-idle` layer, so static sites also lose the "living" feel. That same observer is the natural hook to auto-prepare and pose-apply base-body avatars as they are added.

## 2. Clothing catalogue

Defined in index.html:2190-2207; the per-sex lists are at :2224-2227 and the fixed colour per item at :2228-2240. Each item has one fixed colour per sex.

| Category | Male | Female | How the art is stored | Side / back art |
|---|---|---|---|---|
| Tops | tee, hood, shirt, vest, cardi, jacket, knit (7) | + sailor, tank (9) | Female: `sd-tops.png` 4×4 sheet, hood from `sd-hood.png`. Male: `sd-clothes-male.png` cells (avatar-clothes.js:41) with own colours (:40). Placement boxes, fit points and sleeve openings/masks per sex at avatar-clothes.js:12-15, 18-35, 47-48, 53-54 | Drawn in code, not painted: avatar-pixel.js:331 (side) and :414 (back), used by avatar-direction.js:225-293. Wave-sleeve cloth mesh only for tee and hood (`sd-wardrobe-wave.png`, avatar-cloth-mesh.js:40) |
| Bottoms | shorts, jeans, track, cargo (4) | shorts, jeans, skirt, pleat, track, legging, tutu, cargo, jean_skirt, star_skirt (10) | `sd-bottoms.png` 4×4; male shorts in `sd-clothes-male.png` | Drawn in code (skirts at avatar-pixel.js:299/:401); seated folds at avatar-direction.js:245 |
| One-piece outfits | overall, space, hanbok (3) | dress, robe, overall, space, hanbok (5) | Stored as top+bottom pairs (index:2181-2187), e.g. space = `space:8` + `track:8` | Same as tops/bottoms |
| Shoes | sneaker, dress (=loafer), boots, sandal, hitop, rain, slipper, wing_shoes (8) | + ballet (9) | `sd-shoes.png` 3×3 plus per-foot `sd-shoes-parts.png` 3×6 (avatar-shoes.js:7, 108) | Side and back drawn in code for all 9 (avatar-shoes-profile.js:167, 261) |
| Hats 20, glasses 12, face 12, ear 9, neck 9, back 9 (same for both sexes) | | | Drawn in code (avatar-pixel.js:499-546) | All have side/back versions in avatar-accessory-direction.js (lists at :40-112) |
| Pets 16, effect 1 (`angel`), frames 4 | | | Pet sheet (avatar-pets.js:5); effects (avatar-effects.js) | Pets and effects do not depend on direction |
| Base body outfit | one outfit, **shared by both sexes** | | `sd-foundation-torso.png`, `-sleeves.png`, `-sleeves-raised.png`, `-shirt-profile-rounded.png`, `sd-foundation-basic.png` (avatar-foundation-outfit.js:19-37) | Painted front, side and back, plus raised sleeves |

Other things to know:
- **Body width differs.** The base body is scaled 1.55 × 1.593 (avatar-foundation.js:18). The current render is 1.18 × 1.593 (avatar-pixel.js:12). Every current front image is fitted to a body about 31% narrower.
- **Only the head carries over.** The base head keeps hair, face and expression but sets hat, glasses, face, ear, neck, back and pet to empty (avatar-foundation.js:156).
- **The current starter clothes are close to the reference already.** In `static-and-crowd.png` the male `tee:5` ("도토리 반팔", green with an acorn) and the female `tee:3` flower tee match the reference outfits fairly well.

## 3. Ways to fit the catalogue onto the base body

Required in every option (about 2-3 days):
- Pass every accessory layer through `headViews`/`render` and position it with the existing anchor logic in avatar-accessory-direction.js.
- Add pet, effect and frame layers.
- Add a static-pose fallback: `render()` calls `apply(idle, front)` once, or the avatar-pixel.js:645 observer applies it. Without it, ~20 sites show a head only.
- Add a light breathing/blink loop for static sites.
- Remove the `?avatar=foundation` gate at index.html:2371.
- Rewrite `partThumb` (index.html:2414) to crop the base body.

**A. Warp each item's existing front art onto the base meshes.** Generalise avatar-foundation-outfit.js so `shirtFront`, `sleeve*`, `hip*` and `shoe*` take their texture from `QPClothes.surface(category, shape, colour, sex)` (avatar-clothes.js:234) instead of the fixed outfit. The torso is filled by projecting the item's placement box onto the 1.55-wide torso. Sleeves are cut at the measured sleeve openings (avatar-clothes.js:53-54) and fed to `sleeveTexture`'s 12×18 mesh. Shorts and trousers use `shortsTexture`'s 10×10 mesh, extended down to the ankle for long pants. Shoes come from `QPShoes.renderFoot` at the ankle.
- Side and back use the existing code-drawn garments scaled to the base outline.
- Pros: every item and colour works at once, with no new art.
- Cons: art stretched 1.31× sideways; generated sleeves; code-drawn side/back views that look flat next to the painted base outfit; skirts, robe, tutu and space suit need a different hem (cloth mesh) model.
- Effort: about 1.5-2 weeks.
- Visual risk: high. The user's standard says the reference must be matched exactly and that new renders must not be forced onto bought clothes (아바타-제작기준.md:184).

**B. Paint new art for every item in the base layout.** For each of the 24 shapes (7/9 tops, 4/10 bottoms, 3/5 one-pieces), paint front, side and back torso, front/back/raised sleeves, and hip views, laid out like the current base atlas (1448×1086). Add matching base-shoe art for the 9 shoes. Then reuse avatar-foundation-outfit.js unchanged, only keyed by item.
- Pros: matches the reference exactly, and the seam, sleeve and transition tests already cover the base art.
- Cons: about 30+ painted sheets.
- Effort: about 1 day per item including fitting and review, so roughly 5-6 weeks.
- Risk: art consistency between sheets.

**C. Hybrid (recommended).**
1. First paint the female reference outfit (flower tee with peter-pan collar and pocket, flower shorts with cream cuffs, flower sneakers). It is missing today and blocks matching the reference. Map the starter `tee:5`/`tee:3` and `shorts`/`jeans` items to the two painted base outfits.
2. Paint base art next for the most-worn shapes: hood, shirt, jeans, skirt, cargo and the 5 one-pieces.
3. Use A's warping only for the rest, marked as interim. Keep the side/back accessory paths, which already exist for every accessory.
4. As a safety net, any item without base art keeps the current render until its art passes review (the per-item fallback already in `avatarSVG`).
- Effort: about 2-3 weeks for the infrastructure plus the first 8-10 items. Remaining items are added gradually.
- Risk: a mixed look during the transition, but nothing ever renders head-only or undressed.

Existing tools that help (all in `tools/`):
- `verify-foundation-outfit.cjs`, `-seams`, `-transitions`, `-browser`, `-model`: base-rig regressions, extendable to loop over items.
- `verify-sleeve-insertion.cjs` (an independent sleeve-opening check measured from the PNGs) and `sleeve-aperture-fixtures.json`: directly reusable for strategy A's sleeve cutting.
- `verify-curated-fitting.cjs`: renders the whole fixed-colour wardrobe at 224 and 96 px; switch it to the base render.
- `verify-shoe-wearing.cjs`, `verify-seated-hems.cjs`, `verify-avatar-back.cjs`, `verify-avatar-direction.cjs`, `verify-avatar-accessory-direction.cjs`, `verify-profile-school-outfits.cjs`.
- `measure-avatar-crowd.cjs` and `verify-avatar-map-rendering.cjs`: crowd timing and map display checks.
- `inspect-outfits.cjs`, `inspect-avatar-standard.cjs`, and the research page avatar-standard.html (`QPFoundationStudio.setState`).

Files are in `C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-game-main\6b0944f9-c5fb-4d6c-8012-7f43a8dba426\scratchpad\base-char\scope\`:
- general-vs-foundation.png
- static-and-crowd.png
- cat.cjs
- cmp.cjs
- perf.cjs

## critique (빠진 점 점검)

# Completeness review: base character match (reference vs rig, motion, propagation)

I checked several gaps myself (scripts in `...\scratchpad\base-char\critic\{runs,cur,heads}.cjs`). Nothing under 퀴즈나라 was edited.

## 1. Measurement gaps and contradictions

**Headline:** the rig report reverses the hem verdict. The real hem gap is +19%, and the shoulders still need +38–44%.

**A. There is no shared unit, so the reference and rig numbers cannot be compared directly.**
- The reference report uses headH (hair top to chin, male front 246).
- The rig report uses a width-scan H (reference 227, current 127).
- Several ratios disagree only because of this. Use headH everywhere.
- Measured with headH (current male front: hair top 32, chin 168, so headH 136):

| Item | Reference (/246) | Current (/136) | Change needed |
|---|---|---|---|
| Chin to floor | 295 → 1.20 | 145 → 1.07 | +12% (not the +26% implied by "1.35") |
| Collar to hem | 137 → 0.557 | 66 → 0.485 | +15% |
| Hem width (male front, y400 run 262–378 = 117px) | 0.476 | 54px → 0.40 | **+19% wider** |
| Max width incl. sleeves | 187 → 0.76 | 72 → 0.53 | +44% |
| Visible leg, shorts to shoe | 41 → 0.167 | ~30 → 0.22 | **legs are already too long** |
| Thigh (skin) | 36 → 0.146 | 15 → 0.11 | +33% |
| Ankle | 28 → 0.114 | ~10 → 0.074 | +54% |

- **Hem contradiction.** The rig table gives reference hem 0.37H and calls the current hem too wide. That is wrong: the reference is 117px = 0.515H by the rig's own H, so the current hem is too narrow.
- **Leg width contradiction.** The rig's "leg width at shorts cuff 0.23H" (~52px) measured the shorts leg opening (y462: runs 268–315 and 325–373, about 48px each), not the thigh. Skin thighs are 36px. So the legs are about 25% thin, not "about half".
- **The extra height must not come from a uniform `BODY_SCALE.y`.** Torso and shorts must get longer and the visible leg shorter. Raising the scale evenly would make the already-long legs longer still.

**B. Arm-to-torso gap in the reference (checked).**
- Male front: 2–3px along the forearm (y360–390), opening to 9–10px at the hand (y400–420). Female front is the same: 2–3px, then 9px at y920.
- Male front: the outer edge of the arm is almost vertical, x 233 at the cuff and 230 at the hand.
- So the reference keeps arms clear of the torso by setting the shoulder further out with almost no abduction. Raising `REST_ABDUCTION` (`avatar-foundation.js:48`) would be the wrong lever.

**C. Head size changes with direction. No report measured this.**

| | Front | Right | Back |
|---|---|---|---|
| Reference male, head width | 273 | 268 (0.98) | 258 (0.945) |
| Current male, head width | 146 | 126 (0.86) | 112 (0.77) |
| Current male, figure top row | 32 | 51 | 54 |
| Reference female, head width | 306 | 255 (0.83) | 301 (0.98) |
| Current female, head width | 152 | 121 (0.80) | 139 (0.91) |

- The current male back head is 23% narrower and 22px shorter than the front (`cur/contact-sheet.png` confirms this by eye). Every turn makes the head visibly jump in size.
- The female back hair is a smooth short bob. The front is a wavy bob, and in the reference both front and back are long enough to hide the neck.
- Female/male total height: reference 0.96, current 0.915 (259 vs 283px).

**D. Not measured by any report:**
- Line-art weight in px per figure height (matters at 91px on screen).
- Collar and sleeve-cuff thickness.
- Cuff tilt angle.
- Stance foot angle.
- The reference profile only shows the near arm. The rig says the female far arm is hidden, but nobody said whether the male far arm should be.

**E. Wrong file:line references in the rig report.** `avatar-foundation-outfit.js` has only 205 lines; the rig report's line numbers are about 90 too high.
- Shirt placement is at `:165` (not `:255`).
- `SHORTS_TOP` is at `:12` (not `:102`).
- Shorts origin is at `:114` (not `:204`).
- The definitions are at `:20–37`.

## 2. Motion defects that were not checked

1. **Contradiction with the existing audit records.**
   - `기준캐릭터-자연스러움-검수.md` and `둥근체형-검수.md` (2026-10-07) record as fixed: the side-view wave hand covering the face, and climb hands reaching "머리 위 레일".
   - I checked the climb code: wrist y goes no higher than 25.9 (`:115`). After scaling about y=28 that is 24.65, while the hair top is about 0.4 and the chin 27.6. The hands never go above the head, so the motion report is right.
   - Those old PASS results (`verify-foundation-model.cjs` "hand height" contract) must not be trusted as a regression baseline.
2. **Foot sliding is not quantified.**
   - In stance the foot moves about 3.5 body units × 1.55 ≈ 5.4u, which is about 8.8 screen px at 120px × 0.76.
   - That happens over 288ms, or about 31 px/s, while the avatar moves 337.5 px/s (256 on screen). The feet skate at roughly 8–11×.
   - No report flagged this or chose between stylised skating and a different cadence or stride.
3. **The idle "living feel" is almost invisible.**
   - Breathing moves the body 0.07u × 1.593 ≈ 0.11u, which is about 0.56px at 280px and 0.24px at 120px.
   - The general render has `qpx-sway` (8.7s) and head breath (`avatar-pixel.js:631`). The base render has neither.
   - This is exactly what the user's avatar-window request depends on.
4. **Turning pops.** Head scale changes by direction (1C). Turning mid-walk was not tested. The left view is a mirror of the right, so asymmetric art flips sides: the acorn emblem, the female pocket, the hair part.
5. **No reduced-motion or hidden-tab handling in the rig itself.** Only the research page checks `prefers-reduced-motion` and `document.hidden` (`avatar-standard.js:5,13`). The game's pose callers were not checked.
6. **Changing the geometry will move other things that are tuned to it.**
   - The raised-sleeve blend between 50° and 65°.
   - The skin clip under the sleeve at 1.75 / 1.95 along the arm.
   - The cuff pin points.
   - The desk-sit hip against the chair seat and the chair-back overlap (`verify-school-avatar-size.cjs`).
   - Tree-mask overlap.
7. **Name tag and speech bubble anchors** were not checked against head-top changes per direction.

## 3. Propagation risks not covered

- **Two renders with two body constants.** `BODY_PROPORTIONS` is 1.18 (`avatar-pixel.js:12`) and `BODY_SCALE` is 1.55 (`avatar-foundation.js:18`).
  - The user wants future changes to keep showing up everywhere ("계속 변경할 때도 잘 반영"). That needs one source of truth, otherwise every proportion change has to be made twice.
  - `아바타-제작기준.md:24` says the release decision must include the real shop with chosen clothes, which today is `QPAvatar.render`, not the base rig.
- **The default male outfit does not match the reference.** `newAvatar()` (`index.html:2457–2461`) gives males `bottom:'jeans:5'` (long jeans), not the rolled denim shorts in the reference. Mapping starter items to the base outfit means changing the default, which affects saved accounts, or mapping jeans to shorts art.
- **Head art is shared by both renders.** Fixing the per-direction head scale in `avatar-direction.js` also changes the general render. `verify-avatar-direction`, `verify-avatar-back` and `verify-avatar-accessory-direction` were already failing before any change (자연스러움 doc). That noise will hide new regressions, so record a baseline first.
- **Performance is measured at the wrong count.** The class is 21–30 students, and `AGENTS.md` sets a 30-player budget, but the propagation report timed 21. The earlier 30-player run already misses 30fps (update median 17.6–25ms, frame median 33ms). A female art set adds more texture memory, and the sleeve mesh is redrawn in 2° steps.
- **Asset caching.** Sources are hard-coded `assets/sd-foundation-*.png` with no version tag. Replacing them under the same name on Cloudflare can serve stale art. `build-avatar-file-data.cjs` and the 149-file deployment list both need the new files. `AGENTS.md` says old art must be deleted rather than kept as a fallback.
- **Test fixtures are tied to current coordinates.**
  - Fixed bone lengths in `verify-foundation-model.cjs`.
  - The independent skin and collar samples in `verify-foundation-neck.cjs`.
  - `verify-foundation-seams.cjs`.
  - After a proportion change these must be re-measured from the new art, not simply re-baselined to pass.
- **Project rules vs "match exactly".** `아바타-제작기준.md:7,11` says to keep the existing face and hair, apply one horizontal scale with the head size unchanged, and not change arm length, height, foot contact or walking radius separately. The reference sheet's head and hair differ from the current head art (ears, hair shape, female back bob). Matching the reference exactly conflicts with those rules.

## 4. The 5 most important open questions for the design

1. **Head and hair.** Does "match the reference exactly" include the face, hair and per-direction head size? Or do we keep the existing head art, as `제작기준:7` requires, and only fix the head scale between front, side and back (male back currently 0.77 of the front)?
2. **Where the extra height comes from.** Collar-to-hem needs +15%, the shorts need to be longer, the visible leg shorter, and chin to floor +12%. Should this be per-segment `SPEC` changes, which change bone lengths, contact points and every model-test contract? The rules forbid changing height and arm length separately, so does the user accept breaking that rule to match the reference?
3. **One renderer or two.** Will the base rig replace `QPAvatar.render` for the shop and avatar windows, with a static idle pose and breathing/blink loop added? Or will `QPAvatar.render`'s body be rebuilt to the same constants? The user's own avatar window is the general render today.
4. **Outfit scope for this pass.** Female flower set, acorn emblem, male shorts instead of the default jeans: is this one base outfit per sex, mapped to which starter items? Is new art produced with image tools, or must it come from the user?
5. **Motion targets that can be measured.** What should the acceptance numbers be?
   - Idle breathing visible at 280px and at 91px, for example at least 1.5px and 0.6px.
   - An accepted foot-slide ratio or a cadence change.
   - Climb wrists above the hair top.
   - Wave hand kept clear of the face box.
   - Head-scale jump on turning under 3%.

   These replace the old "hand height" contracts that passed defective poses.
