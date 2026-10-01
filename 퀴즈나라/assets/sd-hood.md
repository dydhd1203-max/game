# 후드를 내린 SD 토끼 집업

2026-10-01 사용자 SD 의상 참고와 실제 착용 화면을 교차 검수한 뒤 제작한 상의다. 기존 `sd-tops.png`의 후드를 올린 상의는 분리된 아바타 머리 아래에 큰 빈 구멍이 남으므로, `hood` 상품에는 이 별도 원화를 사용한다. 나머지 상의와 원래 상품·색상 기능은 유지한다.

- 파일: `sd-hood.png`
- 생성 원본: `/workspace/generated_images/exec-5da6e98c-5955-4258-b932-1e12d1709c11.png`
- 크기: 1536 × 1024, RGBA PNG, 1,680,573바이트
- SHA-256: `1b831d9cf572d1e5668697f68b71214e0d84e30464914ab5bbb574e60c181b81`
- `alpha >= 8` 옷 경계: x=163, y=114, width=1210, height=803
- 생성 PNG는 자르기·확대·배경 제거·색 보정 없이 원본 그대로 복사했다. 외부 투명 부분의 RGB는 표시하지 않는다. 가장자리에 낮은 알파의 안티앨리어싱이 남으며, 실제 표시와 색 변경을 따로 확인한다.

작은 목선과 뒤로 접힌 후드, 둥근 파란 소매, 크림색 골지 소매 끝·밑단, 금색 지퍼, 토끼 장식과 데이지 자수를 설계했다. 피부·손·머리·하체·신발은 원화에 넣지 않아 기존 아바타의 부위별 모션과 조합한다. 소매 끝은 크림 천과 안쪽 푸른 공간을 구분해 장갑이나 손으로 보이지 않게 했다.

## 생성 지시

`image_gen`에 기존 `sd-tops.png`를 스타일 참고로 제공하고 다음 요소를 지정했다.

> One standalone wearable SD hoodie, front-facing, centered on a transparent background with safe margins. The hood is DOWN and folded behind the neck, with a very small ordinary neckline; no raised hood and no large empty head hole. Rounded blue dyed fabric around hue 220, calm matte two or three shadow tones, warm brown outlines, cream ribbed fabric cuffs and hem, gold zipper, a small cream bunny charm and daisy embroidery. No head, skin, hands, mannequin, legs, shoes, ground shadow, text or watermark.

첫 후보를 투명 배경에서 확인한 뒤 추가 생성에 다음 조건을 강조했다.

> Preserve the hoodie design and folded collar, remove background glow, aura and ground shadows, and keep only the isolated garment silhouette on transparency. Fabric cuffs remain unmistakably cloth, not hands. Keep the garment below an existing large SD head.

사용자가 보낸 캐릭터 시트는 귀여운 비율과 의상 밀도의 기준으로 참고했다. 참고 캐릭터의 원화나 의상을 복사해 배포 자산으로 넣지 않았다. 이 파일 제작만으로 착용·색상·모션 검수를 완료한 것으로 취급하지 않는다.
