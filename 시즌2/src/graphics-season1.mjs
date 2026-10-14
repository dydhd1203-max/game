// Season 1 build 106: TONE, HEMI_DS/HEMI_DG, SUN_D, LIGHT_D and LIT_K.
// Keep the same highlight roll-off rather than adding a fullscreen filter.
export function season1Graphics(THREE) {
  const agx=THREE.AgXToneMapping!==undefined;
  const hemi=1.15*.85,ambient=.58*.85,total=hemi+ambient;
  // Uniform ambient light folds exactly into both hemisphere endpoints, so
  // the existing two lights suffice. Colours are combined in linear space.
  const endpoint=hex=>new THREE.Color(hex).multiplyScalar(hemi)
    .add(new THREE.Color(ambient,ambient,ambient)).multiplyScalar(1/total);
  return {toneMapping:agx?THREE.AgXToneMapping:THREE.LinearToneMapping,
    toneName:agx?'AgX':'Linear',exposure:agx?1.28:1.15,
    hemiSky:endpoint(0xb9d4f2),hemiGround:endpoint(0x6b6a4e),hemiIntensity:total,
    sunColor:0xfff1d6,sunIntensity:.84*.85,
    villageSky:0x8eb1d5,forestSky:0x8babae};
}
