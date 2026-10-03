/* Modular raster wardrobe. Coordinates are before the avatar's y=28 body stretch. */
(function(){
  'use strict';
  const names={
    top:['tee','hood','shirt','dress','vest','cardi','sailor','jacket','knit','tank','hanbok','robe','overall','space'],
    bottom:['shorts','jeans','skirt','pleat','track','legging','hanbok','tutu','cargo','jean_skirt','star_skirt']
  };
  const defaults={
    top:{url:'assets/sd-tops.png',columns:4,rows:4,hue:220,hueTolerance:45,names:names.top},
    bottom:{url:'assets/sd-bottoms.png',columns:4,rows:4,hue:220,hueTolerance:45,names:names.bottom}
  };
  const targets={
    top:{default:[8.5,28,15,9.5],hood:[8.5,28,15,9],cardi:[8.5,28,15,9],knit:[8.5,28,15,8.5],tank:[11,28,10,9.5],dress:[8.5,28,15,11.5],robe:[8.5,28,15,12.5],overall:[8.5,28,15,11.5]},
    bottom:{default:[10.5,36,11,8.5],jeans:[11.875,36,8.25,8.5],legging:[11.75,36,8.5,8.5],shorts:[10.5,36,11,5.5],skirt:[10.5,36,11,6.5],pleat:[10.5,36,11,6.5],jean_skirt:[10.5,36,11,6.5],star_skirt:[10.5,36,11,6.5],hanbok:[8.5,36,15,6.5],tutu:[9,36,14,6.5]}
  };
  // Native source joints, measured in the tightly cropped painted garment.
  // Skin is drawn behind its sleeve/strap so the original trim stays in front.
  const fits={
    tee:{cuffs:[[.105,.655],[.895,.645]],short:true,neckline:.30},
    hood:{cuffs:[[.075,.725],[.925,.725]],short:false,neckline:.12},
    shirt:{cuffs:[[.115,.775],[.885,.775]],short:true,neckline:.21},
    dress:{cuffs:[[.19,.445],[.815,.425]],short:true,neckline:.15},
    vest:{cuffs:[[.125,.535],[.89,.555]],short:true,neckline:.20},
    cardi:{cuffs:[[.115,.89],[.885,.905]],short:false,neckline:.13},
    sailor:{cuffs:[[.125,.735],[.885,.765]],short:true,neckline:.20},
    jacket:{cuffs:[[.095,.75],[.905,.77]],short:false,neckline:.12},
    knit:{cuffs:[[.075,.795],[.91,.845]],short:false,neckline:.07},
    tank:{cuffs:[[.20,.14],[.80,.14]],short:true,sleeveless:true},
    hanbok:{cuffs:[[.105,.78],[.895,.80]],short:false,neckline:.18},
    // The female overall's gray neck insert reaches ~18% of its tight crop.
    // Clear only that seeded central opening; preserve the cream collar,
    // shoulder straps and every original atlas pixel outside the opening.
    overall:{cuffs:[[.125,.425],[.88,.43]],short:true,neckline:.19},
    robe:{covered:true,neckline:.12},space:{covered:true,neckline:.08}
  };
  // A separate authored wardrobe keeps the approved female originals intact.
  // Canonical item IDs retain their old colour index; these authored colours
  // are shared by the front raster and its side/back paintings.
  const maleShapes=["tee","hood","shirt","vest","cardi","jacket","knit","hanbok","overall","shorts"];
  const maleColors={"top":{"tee":"#507c59","hood":"#e5ad3c","shirt":"#82ace1","vest":"#314561","cardi":"#6c8054","jacket":"#bb5831","knit":"#ebd1a8","hanbok":"#578573","overall":"#547ca0"},"bottom":{"shorts":"#364c76","jeans":"#547ca0"}};
  const maleCells={"tee":[26,106,363,270],"hood":[405,68,397,321],"shirt":[814,106,359,272],"vest":[1201,99,364,287],"cardi":[1578,106,397,276],"jacket":[18,426,403,287],"knit":[417,433,393,275],"hanbok":[813,440,390,274],"overall":[1206,413,354,326],"shorts":[1609,477,334,240]};
  // Empty neck-insert boundaries in the original female atlas, measured in
  // source pixels. Front collars start below these masks (dress 115+, overall
  // 1012+); only the floating inner highlight and its antialiasing are cleared.
  const femaleNeckMasks={dress:'M1067 99.5H1132L1133.5 107.5H1067Z',overall:'M135 987Q163 991 193 987L192.6 995Q163 1000.4 135.4 995Z'};
  const maleNeckMasks={};
  const maleFits={"tee":{"cuffs":[[0.092437,0.518939],[0.910364,0.518939]],"short":true,"neckline":0.193182},"hood":{"cuffs":[[0.092072,0.774603],[0.928389,0.774603]],"short":false,"neckline":0.377778},"shirt":{"cuffs":[[0.096317,0.541353],[0.909348,0.541353]],"short":true,"neckline":0.218045},"vest":{"cuffs":[[0.100559,0.523132],[0.905028,0.523132]],"short":true,"neckline":0.241993},"cardi":{"cuffs":[[0.084399,0.762963],[0.913043,0.762963]],"short":false,"neckline":0.27037},"jacket":{"cuffs":[[0.080605,0.711744],[0.914358,0.711744]],"short":false,"neckline":0.252669},"knit":{"cuffs":[[0.077519,0.806691],[0.922481,0.806691]],"short":false,"neckline":0.189591},"hanbok":{"cuffs":[[0.091146,0.720149],[0.903646,0.720149]],"short":false,"neckline":0.242537},"overall":{"cuffs":[[0.109195,0.371875],[0.893678,0.371875]],"short":true,"neckline":0.134375}};
  const maleTargets={top:{default:[8.5,28,15,9.5],hood:[8.5,27.2,15,10.2],knit:[8.5,28,15,9.1],overall:[8.5,28,15,11.5]},bottom:{shorts:[10.5,36,11,5.5]}};
  // Two measured edges define each native sleeve opening. Keep the prior
  // wrist references for short sleeves; long wrists follow the new aperture.
  // Fit the upper arm through the full painted aperture
  // instead of attaching a vertical strip to one point near the inner edge.
  const sleeveOpenings={"m":{"tee":[[[0.030812,0.424242],[0.156863,0.606061]],[[0.848739,0.606061],[0.971989,0.424242]]],"hood":[[[0.033248,0.720635],[0.138107,0.831746]],[[0.869565,0.834921],[0.971867,0.730159]]],"shirt":[[[0.028329,0.409774],[0.147309,0.62782]],[[0.824363,0.62782],[0.971671,0.421053]]],"vest":[[[0.03352,0.398577],[0.156425,0.590747]],[[0.849162,0.590747],[0.972067,0.391459]]],"cardi":[[[0.025575,0.692593],[0.143223,0.796296]],[[0.831202,0.796296],[0.959079,0.692593]]],"jacket":[[[0.025189,0.629893],[0.118388,0.754448]],[[0.861461,0.758007],[0.967254,0.629893]]],"knit":[[[0.028424,0.743494],[0.131783,0.840149]],[[0.855297,0.843866],[0.963824,0.747212]]],"hanbok":[[[0.023438,0.61194],[0.138021,0.80597]],[[0.861979,0.809701],[0.981771,0.61194]]],"overall":[[[0.017241,0.271875],[0.132184,0.4125]],[[0.859195,0.4125],[0.988506,0.2625]]]},"f":{"tee":[[[0.004098,0.478495],[0.131148,0.645161]],[[0.831967,0.655914],[0.987705,0.478495]]],"hood":[[[0.020661,0.666252],[0.12314,0.780822]],[[0.878512,0.780822],[0.980992,0.666252]]],"shirt":[[[0.004329,0.707182],[0.138528,0.80663]],[[0.874459,0.80663],[0.995671,0.690608]]],"dress":[[[0.062992,0.398148],[0.173228,0.458333]],[[0.830709,0.467593],[0.933071,0.37963]]],"vest":[[[0.004098,0.421053],[0.131148,0.578947]],[[0.856557,0.593301],[0.991803,0.416268]]],"cardi":[[[0.021583,0.835979],[0.143885,0.920635]],[[0.852518,0.941799],[0.978417,0.857143]]],"sailor":[[[0.003984,0.630769],[0.139442,0.753846]],[[0.864542,0.764103],[0.988048,0.641026]]],"jacket":[[[0.015326,0.699074],[0.164751,0.805556]],[[0.842912,0.800926],[0.984674,0.699074]]],"knit":[[[0.007273,0.743455],[0.127273,0.848168]],[[0.890909,0.910995],[0.989091,0.795812]]],"hanbok":[[[0.007519,0.655022],[0.12782,0.868996]],[[0.87218,0.89083],[0.988722,0.641921]]],"overall":[[[0.004525,0.308411],[0.113122,0.439252]],[[0.877828,0.425234],[0.99095,0.271028]]]}};
  const sleeveApertureMasks={"m":{"tee":"M83.63 267.53999999999996L82.16 268.11L79.93 267.78999999999996L77.03 266.59000000000003L73.57 264.57L69.69 261.78999999999996L65.53 258.37L61.26 254.43L57.03 250.13L53.010000000000005 245.63L49.36 241.11L46.21 236.74L43.69 232.69L41.89 229.11L40.88 226.14L40.71 223.89L41.37 222.45999999999998L42.84 221.89L45.07 222.20999999999998L47.97 223.41L51.43 225.43L55.31 228.20999999999998L59.47 231.63L63.74 235.57L67.97 239.87L71.99000000000001 244.37L75.64 248.89L78.78999999999999 253.26L81.31 257.31L83.11 260.89L84.12 263.86L84.28999999999999 266.11ZM374.65 222.47L375.33 223.9L375.19 226.13L374.24 229.09L372.51 232.66L370.07 236.7L367.01 241.06L363.45 245.58L359.53 250.07L355.39 254.37L351.21 258.3L347.13 261.73L343.31 264.51L339.9 266.55L337.04 267.75L334.83 268.08000000000004L333.35 267.53L332.67 266.1L332.81 263.87L333.76 260.90999999999997L335.49 257.34000000000003L337.93 253.3L340.99 248.94L344.55 244.42L348.47 239.93L352.61 235.63L356.79 231.7L360.87 228.26999999999998L364.69 225.49L368.1 223.45L370.96 222.25L373.17 221.92000000000002Z","hood":"M460.48 331.7L459.04 332.65L456.92 332.94L454.21 332.56L451.02 331.53L447.46 329.88L443.65999999999997 327.67L439.79 325L435.98 321.96000000000004L432.38 318.68L429.14 315.27L426.37 311.87L424.18 308.62L422.65 305.62L421.85 303.01L421.81 300.87L422.52 299.3L423.96 298.35L426.08 298.06L428.79 298.44L431.98 299.47L435.54 301.12L439.34 303.33000000000004L443.21 306L447.02 309.03999999999996L450.62 312.32L453.86 315.73L456.63 319.13L458.82 322.38L460.35 325.38L461.15 327.99L461.19 330.13ZM786.46 302.27L787.1600000000001 303.84000000000003L787.12 305.94L786.35 308.48L784.88 311.37L782.75 314.49L780.06 317.73L776.9100000000001 320.96000000000004L773.4100000000001 324.06L769.7 326.9L765.9300000000001 329.38L762.24 331.41L758.77 332.9L755.6600000000001 333.8L753.02 334.08L750.95 333.71L749.54 332.73L748.8399999999999 331.16L748.88 329.06L749.65 326.52L751.12 323.63L753.25 320.51L755.94 317.27L759.0899999999999 314.03999999999996L762.5899999999999 310.94L766.3 308.1L770.0699999999999 305.62L773.76 303.59000000000003L777.23 302.1L780.3399999999999 301.2L782.98 300.91999999999996L785.05 301.28999999999996Z","shirt":"M867.83 274.38L866.42 274.6L864.3 273.75L861.56 271.88L858.3 269.06L854.64 265.38L850.72 261L846.7 256.08000000000004L842.74 250.81L838.97 245.4L835.55 240.04L832.61 234.95999999999998L830.26 230.34L828.59 226.35L827.67 223.16L827.53 220.89L828.17 219.62L829.58 219.4L831.7 220.25L834.44 222.12L837.7 224.94L841.36 228.62L845.28 233L849.3 237.92L853.26 243.19L857.03 248.6L860.45 253.96L863.39 259.03999999999996L865.74 263.65999999999997L867.41 267.65L868.33 270.84000000000003L868.47 273.11ZM1158.63 222.45L1159.07 223.82L1158.56 226.14L1157.1 229.32L1154.75 233.24L1151.6100000000001 237.74L1147.79 242.66L1143.44 247.8L1138.72 252.97L1133.83 257.96000000000004L1128.94 262.59000000000003L1124.25 266.68L1119.93 270.08000000000004L1116.15 272.64L1113.06 274.27L1110.77 274.91999999999996L1109.37 274.55L1108.93 273.18L1109.44 270.86L1110.9 267.68L1113.25 263.76L1116.3899999999999 259.26L1120.21 254.34L1124.56 249.2L1129.28 244.03L1134.17 239.04L1139.06 234.41L1143.75 230.32L1148.07 226.92000000000002L1151.85 224.36L1154.94 222.73000000000002L1157.23 222.07999999999998Z","vest":"M1258.74 266.45L1257.2 266.88L1254.93 266.33000000000004L1252.01 264.78999999999996L1248.55 262.35L1244.69 259.08000000000004L1240.56 255.12L1236.34 250.61L1232.19 245.74L1228.25 240.68L1224.69 235.64L1221.64 230.8L1219.23 226.35L1217.53 222.47L1216.62 219.3L1216.53 216.95999999999998L1217.26 215.55L1218.8 215.12L1221.07 215.67000000000002L1223.99 217.20999999999998L1227.45 219.65L1231.31 222.92000000000002L1235.44 226.88L1239.66 231.39L1243.81 236.26L1247.75 241.32L1251.31 246.36L1254.36 251.2L1256.77 255.65L1258.47 259.53L1259.38 262.7L1259.47 265.03999999999996ZM1550.76 213.57L1551.52 214.98000000000002L1551.44 217.36L1550.54 220.6L1548.85 224.59L1546.44 229.17000000000002L1543.3899999999999 234.17L1539.83 239.39L1535.9 244.63L1531.73 249.7L1527.5 254.39L1523.37 258.53999999999996L1519.49 261.96000000000004L1516.01 264.55L1513.07 266.19L1510.79 266.82L1509.24 266.43L1508.48 265.02L1508.56 262.64L1509.46 259.4L1511.15 255.41L1513.56 250.83L1516.6100000000001 245.83L1520.17 240.61L1524.1 235.37L1528.27 230.3L1532.5 225.61L1536.63 221.45999999999998L1540.51 218.04000000000002L1543.99 215.45L1546.93 213.81L1549.21 213.18Z","cardi":"M1635.29 322.96000000000004L1634.12 323.96000000000004L1632.18 324.43L1629.54 324.34000000000003L1626.3 323.69L1622.59 322.53L1618.55 320.88L1614.33 318.81L1610.1 316.40999999999997L1606.02 313.75L1602.25 310.96000000000004L1598.93 308.13L1596.19 305.37L1594.13 302.78L1592.84 300.48L1592.36 298.53999999999996L1592.71 297.03999999999996L1593.88 296.03999999999996L1595.82 295.57L1598.46 295.65999999999997L1601.7 296.31L1605.41 297.47L1609.45 299.12L1613.67 301.19L1617.9 303.59000000000003L1621.98 306.25L1625.75 309.03999999999996L1629.07 311.87L1631.81 314.63L1633.87 317.22L1635.16 319.52L1635.64 321.46000000000004ZM1954.25 296.98L1954.52 298.5L1953.8899999999999 300.47L1952.37 302.81L1950.03 305.41999999999996L1946.97 308.21000000000004L1943.28 311.06L1939.13 313.88L1934.66 316.53999999999996L1930.06 318.96000000000004L1925.49 321.03L1921.13 322.68L1917.15 323.84000000000003L1913.7 324.46000000000004L1910.92 324.53999999999996L1908.91 324.05L1907.75 323.02L1907.48 321.5L1908.1100000000001 319.53L1909.63 317.19L1911.97 314.58000000000004L1915.03 311.78999999999996L1918.72 308.94L1922.87 306.12L1927.34 303.46000000000004L1931.94 301.03999999999996L1936.51 298.97L1940.87 297.32L1944.85 296.15999999999997L1948.3 295.53999999999996L1951.08 295.46000000000004L1953.09 295.95Z","jacket":"M66.55 639.63L65.21000000000001 640.38L63.28 640.48L60.81 639.9300000000001L57.91 638.76L54.69 636.99L51.260000000000005 634.7L47.769999999999996 631.99L44.35 628.95L41.120000000000005 625.7L38.21 622.36L35.74 619.0699999999999L33.8 615.95L32.46 613.12L31.78 610.69L31.77 608.75L32.45 607.37L33.79 606.62L35.72 606.52L38.19 607.0699999999999L41.09 608.24L44.31 610.01L47.739999999999995 612.3L51.230000000000004 615.01L54.65 618.05L57.88 621.3L60.79 624.64L63.26 627.9300000000001L65.2 631.05L66.53999999999999 633.88L67.22 636.31L67.22999999999999 638.25ZM403.48 607.3L404.06 608.73L403.87 610.75L402.91 613.28L401.23 616.22L398.88 619.46L395.96 622.87L392.59 626.33L388.88 629.69L384.99 632.84L381.05 635.65L377.24 638.01L373.68 639.83L370.51 641.05L367.87 641.61L365.85 641.49L364.52 640.7L363.94 639.27L364.13 637.25L365.09 634.72L366.77 631.78L369.12 628.54L372.04 625.13L375.41 621.67L379.12 618.31L383.01 615.16L386.95 612.35L390.76 609.99L394.32 608.17L397.49 606.95L400.13 606.39L402.15 606.51Z","knit":"M469.32 660.91L468.23 661.83L466.47 662.25L464.12 662.16L461.26 661.5699999999999L458.01 660.5L454.49 658.98L450.83 657.08L447.19 654.87L443.68 652.4300000000001L440.46 649.86L437.65 647.26L435.35 644.73L433.65 642.36L432.61 640.24L432.28 638.46L432.68 637.09L433.77 636.17L435.53 635.75L437.88 635.84L440.74 636.4300000000001L443.99 637.5L447.51 639.02L451.17 640.92L454.81 643.13L458.32 645.5699999999999L461.54 648.14L464.35 650.74L466.65 653.27L468.35 655.64L469.39 657.76L469.72 659.54ZM791.3 638.05L791.65 639.44L791.24 641.24L790.0899999999999 643.37L788.25 645.76L785.79 648.31L782.79 650.9300000000001L779.38 653.51L775.6800000000001 655.95L771.85 658.17L768.02 660.0699999999999L764.3399999999999 661.59L760.96 662.66L758 663.24L755.5799999999999 663.3199999999999L753.79 662.88L752.7 661.95L752.35 660.56L752.76 658.76L753.9100000000001 656.63L755.75 654.24L758.21 651.69L761.21 649.0699999999999L764.62 646.49L768.3199999999999 644.05L772.15 641.83L775.98 639.9300000000001L779.6600000000001 638.41L783.04 637.34L786 636.76L788.4200000000001 636.6800000000001L790.21 637.12Z","hanbok":"M867.71 657.47L866.12 658.01L863.79 657.59L860.83 656.22L857.32 653.96L853.43 650.89L849.28 647.14L845.05 642.84L840.89 638.17L836.97 633.29L833.43 628.41L830.42 623.7L828.04 619.35L826.39 615.52L825.53 612.37L825.5 610.01L826.29 608.53L827.88 607.99L830.21 608.41L833.17 609.78L836.68 612.04L840.57 615.11L844.72 618.86L848.95 623.16L853.11 627.83L857.03 632.71L860.57 637.59L863.58 642.3L865.96 646.65L867.61 650.48L868.47 653.63L868.5 655.99ZM1191.69 608.51L1192.45 610.01L1192.35 612.42L1191.3899999999999 615.64L1189.6100000000001 619.54L1187.07 623.98L1183.88 628.78L1180.16 633.77L1176.04 638.74L1171.69 643.52L1167.28 647.91L1162.97 651.74L1158.94 654.88L1155.32 657.19L1152.27 658.59L1149.91 659.03L1148.31 658.49L1147.55 656.99L1147.65 654.58L1148.6100000000001 651.36L1150.3899999999999 647.46L1152.93 643.02L1156.12 638.22L1159.84 633.23L1163.96 628.26L1168.31 623.48L1172.72 619.09L1177.03 615.26L1181.06 612.12L1184.68 609.81L1187.73 608.41L1190.09 607.97Z","overall":"M1253.67 546.51L1252.36 546.94L1250.39 546.56L1247.83 545.36L1244.77 543.41L1241.33 540.76L1237.66 537.53L1233.88 533.83L1230.14 529.8199999999999L1226.59 525.64L1223.37 521.45L1220.59 517.42L1218.36 513.7L1216.78 510.43L1215.89 507.75L1215.74 505.74L1216.33 504.49L1217.64 504.06L1219.61 504.44L1222.17 505.64L1225.23 507.59000000000003L1228.67 510.24L1232.34 513.47L1236.12 517.17L1239.86 521.1800000000001L1243.41 525.36L1246.63 529.55L1249.41 533.58L1251.64 537.3L1253.22 540.5699999999999L1254.11 543.25L1254.26 545.26ZM1551.63 501.46L1552.15 502.76L1551.84 504.88L1550.71 507.73L1548.8 511.2L1546.18 515.17L1542.97 519.48L1539.27 523.96L1535.24 528.45L1531.03 532.76L1526.79 536.73L1522.7 540.22L1518.91 543.08L1515.56 545.21L1512.79 546.53L1510.7 546.98L1509.37 546.54L1508.85 545.24L1509.16 543.12L1510.29 540.27L1512.2 536.8L1514.82 532.83L1518.03 528.52L1521.73 524.04L1525.76 519.55L1529.97 515.24L1534.21 511.27L1538.3 507.78L1542.09 504.92L1545.44 502.79L1548.21 501.47L1550.3 501.02Z"},"f":{}};
  for(const [sex,shapes]of Object.entries(sleeveOpenings))for(const [shape,openings]of Object.entries(shapes)){
    const fit=sex==='m'?maleFits[shape]:fits[shape];fit.openings=openings;fit.wristCuffs=fit.cuffs;
    fit.cuffs=openings.map(edge=>[(edge[0][0]+edge[1][0])/2,(edge[0][1]+edge[1][1])/2]);
  }
  const fitFor=(shape,sex='f')=>sex==='m'&&maleFits[shape]||fits[shape];
  const targetFor=(category,shape,sex='f')=>sex==='m'&&maleTargets[category]?.[shape]||targets[category]?.[shape]||targets[category]?.default;
  const colorFor=(category,shape,sex='f',fallback)=>sex==='m'&&maleColors[category]?.[shape]||fallback;
  const atlas={ready:false,revision:0,error:null,categories:{top:{ready:false},bottom:{ready:false}}};
  const sprites=new Map(),tinted=new Map(),markup=new Map(),surfaces=new Map();let generation=0,loading=Promise.resolve(false);
  let config={top:{...defaults.top},bottom:{...defaults.bottom}};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function rgb(value){
    const s=String(value||'').trim(),hex=s.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i);
    if(hex){const h=hex[1].length===3?hex[1].split('').map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
    const m=s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    return m?m.slice(1).map(v=>clamp(+v,0,255)):[119,174,192];
  }
  function hsl(r,g,b){
    r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),d=hi-lo,l=(hi+lo)/2;
    let h=0;if(d)h=60*(hi===r?(g-b)/d+(g<b?6:0):hi===g?(b-r)/d+2:(r-g)/d+4);
    return [h,d?d/(1-Math.abs(2*l-1)):0,l];
  }
  function fromHsl(h,s,l){
    const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    const v=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
    return v.map(n=>Math.round(clamp((n+m)*255,0,255)));
  }
  const hueDistance=(a,b)=>Math.min(Math.abs(a-b),360-Math.abs(a-b));
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
  function image(url){return window.QPAvatarImage.load(url);}
  function removeBackground(data,w,h,options){
    if(options.background===false)return;
    let transparent=false;for(let i=3;i<data.length;i+=4)if(data[i]<8){transparent=true;break;}
    if(transparent&&options.background!=='force')return;
    const explicit=options.backgroundColor&&rgb(options.backgroundColor),samples=[];
    for(const [x,y] of [[0,0],[w-1,0],[0,h-1],[w-1,h-1],[w>>1,0],[w>>1,h-1],[0,h>>1],[w-1,h>>1]]){
      const i=(y*w+x)*4;if(data[i+3]>20)samples.push([data[i],data[i+1],data[i+2]]);
    }
    const candidates=explicit?[explicit]:samples.filter(p=>{const [,s,l]=hsl(...p);return l>.65&&s<.16;});
    if(!candidates.length)return;
    const matches=p=>{
      const i=p*4;if(data[i+3]<8)return true;
      const v=[data[i],data[i+1],data[i+2]],[,s,l]=hsl(...v);
      return candidates.some(c=>Math.max(...v.map((n,j)=>Math.abs(n-c[j])))<=(options.backgroundTolerance||25))||(!explicit&&s<.09&&l>.78);
    };
    const visited=new Uint8Array(w*h),queue=new Uint32Array(w*h);let head=0,tail=0;
    const add=p=>{if(!visited[p]&&matches(p)){visited[p]=1;queue[tail++]=p;}};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=1;y<h-1;y++){add(y*w);add(y*w+w-1);}
    while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;data[p*4+3]=0;if(x)add(p-1);if(x<w-1)add(p+1);if(y)add(p-w);if(y<h-1)add(p+w);}
  }
  function dominantTint(data,options){
    const bins=new Float64Array(36);
    for(let i=0;i<data.length;i+=4){if(data[i+3]<80)continue;const [h,s,l]=hsl(data[i],data[i+1],data[i+2]);if(s>.14&&l>.23&&l<.91)bins[Math.floor(h/10)%36]+=s;}
    const bin=bins.indexOf(Math.max(...bins)),hue=Number.isFinite(options.hue)?options.hue:bin*10+5,tolerance=options.hueTolerance||52;
    let total=0,sat=0,light=0;
    for(let i=0;i<data.length;i+=4){if(data[i+3]<80)continue;const [h,s,l]=hsl(data[i],data[i+1],data[i+2]);if(s>.12&&l>.18&&l<.94&&hueDistance(h,hue)<=tolerance){total++;sat+=s;light+=l;}}
    return {hue,tolerance,saturation:total?sat/total:.25,lightness:total?light/total:.6,neutral:total===0};
  }
  function cleanCell(data,w,h){
    const labels=new Uint32Array(w*h),queue=new Uint32Array(w*h),parts=[];
    for(let p=0;p<labels.length;p++){
      if(labels[p]||data[p*4+3]<=12)continue;
      const label=parts.length+1,part={count:0,x0:w,y0:h,x1:-1,y1:-1};let head=0,tail=1;queue[0]=p;labels[p]=label;
      while(head<tail){
        const at=queue[head++],x=at%w,y=(at/w)|0;part.count++;part.x0=Math.min(part.x0,x);part.x1=Math.max(part.x1,x);part.y0=Math.min(part.y0,y);part.y1=Math.max(part.y1,y);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          const xx=x+dx,yy=y+dy;if((!dx&&!dy)||xx<0||xx>=w||yy<0||yy>=h)continue;
          const next=yy*w+xx;if(!labels[next]&&data[next*4+3]>12){labels[next]=label;queue[tail++]=next;}
        }
      }parts.push(part);
    }
    if(!parts.length)return;
    const main=parts.reduce((a,b)=>a.count>b.count?a:b),mainLabel=parts.indexOf(main)+1,keep=parts.map(p=>p===main||p.count>=main.count*.08);
    // A neighboring cell's stray line may sit inside the garment's bounding box.
    // Keep small detached detail only when it touches the actual main silhouette.
    for(let p=0;p<labels.length;p++){
      const label=labels[p];if(!label||keep[label-1])continue;
      const x=p%w,y=(p/w)|0;
      for(let dy=-2;dy<=2&&!keep[label-1];dy++)for(let dx=-2;dx<=2;dx++){
        const xx=x+dx,yy=y+dy;if(xx>=0&&xx<w&&yy>=0&&yy<h&&labels[yy*w+xx]===mainLabel){keep[label-1]=true;break;}
      }
    }
    for(let p=0;p<labels.length;p++)if(!labels[p]||!keep[labels[p]-1])data[p*4+3]=0;
  }
  function openHoodSleeves(data,w,h,sx,sy){
    // Original sd-hood.png coordinates. extract draws the source cell 1:1;
    // only the cell offset is subtracted (the tight crop happens afterwards).
    // Four-connected blue interiors stop at the original cream/brown cuff rim.
    const apertures=[
      {bounds:[184,647,316,747],seeds:[[213,682],[247,704],[280,725]]},
      {bounds:[1223,647,1357,747],seeds:[[1313,682],[1279,704],[1246,725]]}
    ];
    for(const {bounds,seeds}of apertures){
      const x0=Math.max(0,bounds[0]-sx),y0=Math.max(0,bounds[1]-sy);
      const x1=Math.min(w-1,bounds[2]-sx),y1=Math.min(h-1,bounds[3]-sy);
      const queue=[];
      const add=(x,y)=>{
        if(x<x0||x>x1||y<y0||y>y1)return;
        const p=y*w+x,i=p*4,r=data[i],g=data[i+1],b=data[i+2];
        if(data[i+3]>8&&b>40&&b>r*1.25&&b>g*1.25){
          data[i+3]=0;queue.push(p);
        }
      };
      for(const [x,y]of seeds)add(x-sx,y-sy);
      for(let n=0;n<queue.length;n++){
        const p=queue[n],x=p%w,y=Math.floor(p/w);
        add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1);
      }
    }
  }
  function extract(img,category,shape,index,options){
    const cols=options.columns||4,rows=options.rows||4,rect=options.cells&&options.cells[shape];
    const sx=rect?rect[0]:Math.floor(index%cols*img.naturalWidth/cols),sy=rect?rect[1]:Math.floor(Math.floor(index/cols)*img.naturalHeight/rows);
    const sw=rect?rect[2]:Math.floor((index%cols+1)*img.naturalWidth/cols)-sx,sh=rect?rect[3]:Math.floor((Math.floor(index/cols)+1)*img.naturalHeight/rows)-sy;
    if(sw<1||sh<1||sx<0||sy<0||sx+sw>img.naturalWidth||sy+sh>img.naturalHeight)throw new Error('Clothes cell is outside atlas: '+category+'/'+shape);
    const c=canvas(sw,sh),ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.drawImage(img,sx,sy,sw,sh,0,0,sw,sh);
    if(options.neckMask){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.translate(-sx,-sy);ctx.fill(new Path2D(options.neckMask));ctx.restore();}
    // Open only the painted inner elliptical faces. The front cuff lip,
    // knit/cream trim and outer sleeve contour remain the original pixels.
    // The author PNGs stay unchanged; the recessed skin is behind this art.
    const sleeveMask=category==='top'?(options.url==='assets/sd-clothes-male.png'?sleeveApertureMasks.m[shape]:options.url===defaults.top.url||options.url==='assets/sd-hood.png'?sleeveApertureMasks.f[shape]:null):null;
    if(sleeveMask){ctx.save();ctx.globalCompositeOperation='destination-out';ctx.translate(-sx,-sy);ctx.fill(new Path2D(sleeveMask));ctx.restore();}
    const pixels=ctx.getImageData(0,0,sw,sh),perShape={...options,...options.items?.[shape]};
    removeBackground(pixels.data,sw,sh,perShape);
    if(category==='top'&&shape==='hood'&&options.url==='assets/sd-hood.png')openHoodSleeves(pixels.data,sw,sh,sx,sy);
    cleanCell(pixels.data,sw,sh);
    let x0=sw,y0=sh,x1=-1,y1=-1,opaque=0;
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){if(pixels.data[(y*sw+x)*4+3]>12){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);opaque++;}}
    if(!opaque)throw new Error('Clothes cell is empty: '+category+'/'+shape);
    ctx.putImageData(pixels,0,0);const w=x1-x0+1,h=y1-y0+1,crop=canvas(w,h),cc=crop.getContext('2d',{willReadFrequently:true});cc.imageSmoothingEnabled=false;cc.drawImage(c,x0,y0,w,h,0,0,w,h);
    const source=cc.getImageData(0,0,w,h),target=perShape.target||options.targets?.[shape]||targets[category][shape]||targets[category].default;
    if(category==='top'&&shape==='hood'&&options.url==='assets/sd-hood.png'){
      // The loose bunny-hood tabs in the original front painting sit above
      // the shoulders like detached pads when worn. Keep the real blue/pink
      // shoulder slope below them and the collar; leave the source PNG intact.
      cc.save();cc.globalCompositeOperation='destination-out';cc.translate(-sx-x0,-sy-y0);
      cc.fill(new Path2D('M0 0H636V140L565 215Q475 265 399 350H0ZM1536 0H900V140L971 215Q1061 265 1137 350H1536Z'));cc.restore();
      source.data.set(cc.getImageData(0,0,w,h).data);
    }
    if(category==='top'&&fits[shape]?.neckline&&(options.url===defaults.top.url||options.url==='assets/sd-hood.png')){
      const data=source.data,maxY=Math.ceil(h*fits[shape].neckline),seen=new Uint8Array(w*h),queue=[];
      const opening=p=>{const x=p%w,y=Math.floor(p/w),i=p*4;if(x<w*.32||x>w*.68||y>=maxY||data[i+3]<8)return false;const [hue,s,l]=hsl(data[i],data[i+1],data[i+2]);return s<.38&&l>.02&&l<.82||s>.15&&l>.02&&l<.84&&hueDistance(hue,220)<48;};
      for(let y=0;y<Math.min(maxY,h*.15);y++)for(let x=Math.floor(w*.485);x<=w*.515;x++){const p=y*w+x;if(opening(p)){seen[p]=1;queue.push(p);}}
      for(let n=0;n<queue.length;n++){const p=queue[n],x=p%w;for(const d of[-w,w,-1,1]){const next=p+d;if(next<0||next>=seen.length||d===-1&&x===0||d===1&&x===w-1||seen[next]||!opening(next))continue;seen[next]=1;queue.push(next);}}
      if(femaleNeckMasks[shape]&&options.url===defaults.top.url){
        cc.putImageData(source,0,0);cc.save();cc.globalCompositeOperation='destination-out';cc.translate(-sx-x0,-sy-y0);
        cc.fill(new Path2D(femaleNeckMasks[shape]));cc.restore();
        source.data.set(cc.getImageData(0,0,w,h).data);
      }
      for(const p of queue)data[p*4+3]=0;
    }
    return {canvas:crop,category,shape,w,h,data:new Uint8ClampedArray(source.data),url:crop.toDataURL('image/png'),sourceUrl:options.url,sourceCell:[sx,sy,sw,sh],sourceRect:[sx+x0,sy+y0,w,h],target:target.slice(),opaque,tint:dominantTint(source.data,perShape),options:perShape};
  }
  function colorize(sprite,color,skin){
    const rgbColor=rgb(color),skinColor=rgb(skin),key=sprite.category+'/'+sprite.shape+'/'+rgbColor.join(',')+'/'+(sprite.options.skinColors?skinColor.join(','):'');
    if(tinted.has(key))return tinted.get(key);
    if(sprite.options.recolor===false)return sprite.url;
    const [th,ts,tl]=hsl(...rgbColor),data=new Uint8ClampedArray(sprite.data),tint=sprite.tint;
    const skinSources=(sprite.options.skinColors||[]).map(rgb);
    for(let i=0;i<data.length;i+=4){
      if(data[i+3]<8)continue;const src=[data[i],data[i+1],data[i+2]],[h,s,l]=hsl(...src);
      const skinIndex=skinSources.findIndex(c=>Math.max(...src.map((n,j)=>Math.abs(n-c[j])))<14);
      if(skinIndex>=0){data[i]=skinColor[0];data[i+1]=skinColor[1];data[i+2]=skinColor[2];continue;}
      const tintable=tint.neutral?s<.1&&l>.42&&l<.95:s>.09&&l>.015&&l<.985&&hueDistance(h,tint.hue)<=tint.tolerance;
      if(!tintable)continue;
      const delta=l-tint.lightness,nl=clamp(tl+delta*(tl<.3?.48:tl>.8?.7:.85),.025,.93),ns=clamp(ts*(.82+.18*s/Math.max(.15,tint.saturation)),0,.72),out=fromHsl(th,ns,nl);
      data[i]=out[0];data[i+1]=out[1];data[i+2]=out[2];
    }
    const c=canvas(sprite.w,sprite.h),ctx=c.getContext('2d');ctx.putImageData(new ImageData(data,sprite.w,sprite.h),0,0);
    const url=c.toDataURL('image/png');surfaces.set(url,c);if(tinted.size>300){tinted.clear();surfaces.clear();surfaces.set(url,c);}tinted.set(key,url);return url;
  }
  function render(category,shape,color,sex='f',skin='#f7d1b5'){
    const sprite=sprites.get((sex==='m'?'m/':'')+category+'/'+shape)||sprites.get(category+'/'+shape);if(!sprite)return '';
    const key=[atlas.revision,category,shape,color,sex,skin].join('|');if(markup.has(key))return markup.get(key);
    const [x,y,w,h]=sprite.target,url=colorize(sprite,color,skin);
    const out=`<g class="qpc-garment qpc-${esc(category)}" data-qpc-category="${esc(category)}" data-qpc-shape="${esc(shape)}" data-qpc-sex="${sex==='m'?'m':'f'}"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${sprite.w} ${sprite.h}" preserveAspectRatio="none" overflow="hidden"><image href="${url}" width="${sprite.w}" height="${sprite.h}" style="image-rendering:auto"/></svg></g>`;
    if(markup.size>500)markup.clear();markup.set(key,out);return out;
  }
  function surface(category,shape,color,sex='f',skin='#f7d1b5'){
    const sprite=sprites.get((sex==='m'?'m/':'')+category+'/'+shape)||sprites.get(category+'/'+shape);if(!sprite)return null;
    const url=colorize(sprite,color,skin);return{canvas:surfaces.get(url)||sprite.canvas,target:sprite.target.slice(),revision:atlas.revision};
  }
  function inspect(category,shape,sex='f'){const s=sprites.get((sex==='m'?'m/':'')+category+'/'+shape)||sprites.get(category+'/'+shape);return s?{width:s.w,height:s.h,opaquePixels:s.opaque,sourceUrl:s.sourceUrl,sourceCell:s.sourceCell.slice(),sourceRect:s.sourceRect.slice(),target:s.target.slice(),tint:{...s.tint}}:null;}
  function load(next){
    if(next)for(const category of ['top','bottom'])if(next[category])config[category]={...config[category],...next[category]};
    const version=++generation;atlas.ready=false;atlas.error=null;tinted.clear();markup.clear();
    loading=(async()=>{
      const results=await Promise.allSettled(['top','bottom'].map(async category=>{
        const options=config[category];if(options.enabled===false)return;
        const img=await image(options.url),loaded=[];
        for(const [index,shape] of (options.names||names[category]).entries()){
          if(category==='top'&&shape==='hood'&&options.url===defaults.top.url){
            const hood=await image('assets/sd-hood.png');
            loaded.push(extract(hood,category,shape,0,{...options,url:'assets/sd-hood.png',columns:1,rows:1,cells:undefined}));
          }else loaded.push(extract(img,category,shape,index,options));
        }
        if(version!==generation)return;
        for(const key of sprites.keys())if(key.startsWith(category+'/'))sprites.delete(key);
        loaded.forEach(s=>sprites.set(category+'/'+s.shape,s));
        atlas.categories[category]={ready:true,url:options.url,width:img.naturalWidth,height:img.naturalHeight,count:loaded.length};
      }).concat((async()=>{
        const img=await image('assets/sd-clothes-male.png'),loaded=[];
        for(const [index,shape]of maleShapes.entries()){
          const category=shape==='shorts'?'bottom':'top',cell=maleCells[shape];
          loaded.push(extract(img,category,shape,index,{url:'assets/sd-clothes-male.png',columns:5,rows:2,cells:{[shape]:cell},recolor:false,neckMask:maleNeckMasks[shape],target:targetFor(category,shape,'m')}));
        }
        if(version!==generation)return;
        for(const key of sprites.keys())if(key.startsWith('m/'))sprites.delete(key);
        loaded.forEach(s=>sprites.set('m/'+s.category+'/'+s.shape,s));
        atlas.male={ready:true,url:'assets/sd-clothes-male.png',width:img.naturalWidth,height:img.naturalHeight,count:loaded.length};
      })()));
      if(version!==generation)return false;
      const failed=results.filter(r=>r.status==='rejected');atlas.error=failed.map(r=>String(r.reason?.message||r.reason)).join('; ')||null;
      atlas.ready=!failed.length;atlas.revision++;tinted.clear();markup.clear();
      window.dispatchEvent(new CustomEvent(atlas.ready?'qp-clothes-ready':'qp-clothes-error',{detail:{revision:atlas.revision,error:atlas.error}}));return atlas.ready;
    })();return loading;
  }
  window.QPClothes={render,surface,inspect,atlas,names,targets,fits,maleColors,maleFits,maleTargets,fitFor,targetFor,colorFor,load,configure:load,clearCache:()=>{tinted.clear();markup.clear();},whenReady:()=>loading};
  load(window.QP_CLOTHES_ATLAS||undefined);
})();
