# 숲속 옷 가게 투명 소품 원화

제작: 2026-10-01. 사용자가 제공한 프레임·아이콘·상점 자료 네 장을 실제로 열어 확인하고, 목재·크림색 읽기면·천·화분·가게 진열의 특징을 옷 가게 주변 소품으로 재설계했습니다. 현재 SD 아바타와 실제 상품 원화는 그대로 유지합니다.

- 파일: `forest-shop-props.png`, **1774 × 887, RGBA**. 2×2 분리 소품 시트.
- 생성 결과 `exec-4f86dab1-9bbf-4906-a577-66e33ff0741c.png`를 가공 없이 복사했습니다.
- SHA-256: `17cf130b71ed502336e00c2b998c2b73a488f652dddad6de1ff801faf5d48fe0`.
- 처음 생성한 `exec-267a23b3-ed02-4434-85a8-b81e3296f4d2.png`에서는 옷걸이 윗부분이 셀 경계를 넘어갔습니다. 이미지 생성 도구로 배치와 여백을 다시 조정한 뒤 수정본을 보관했습니다. 이전 시안은 게임 자산으로 사용하지 않습니다.
- 정확한 소스 영역·알파 경계·바닥 정렬점·받침 위 서는 점과 CSS 자르기 비율은 `forest-shop-props.json`에 있습니다.

## 소품과 적용 영역

| 소품 | 고정 셀 `[x,y,w,h]` | 권장 조밀한 표시 영역 `sourceRect` | 역할 |
|---|---|---|---|
| 빈 목재 간판 | `[0,0,887,443]` | `[125,41,667,361]` | 상점 주변의 빈 간판. 제목은 실제 한국어 HTML로 표시 |
| 타원 피팅 받침 | `[887,0,887,443]` | `[935,127,803,286]` | 아바타 발이 목재 윗면에 닿는 피팅 공간 |
| 옷걸이·꽃 화분 | `[0,443,887,444]` | `[125,481,611,380]` | 두 벌의 작은 옷과 화분으로 상점의 생활감 표현 |
| 재봉 작업 묶음 | `[887,443,887,444]` | `[956,537,734,328]` | 실·접힌 천·단추·가위·화분으로 공방 분위기 표현 |

상의와 치마가 걸린 옷걸이는 가게 풍경입니다. 아바타의 착용 레이어나 구매 가능한 새 상품으로 등록한 상태가 아닙니다. 꽃과 천은 상품·가격·선택 상태·입력·실제 아바타를 가리지 않는 주변 영역에 배치합니다. 장식에는 `pointer-events:none`과 `aria-hidden`을 적용하고 버튼과 글자는 실제 UI로 유지합니다.

받침의 `standingAnchorAtlas=[1330,236]`은 비어 있는 목재 윗면에서 직접 확인한 발 위치입니다. 조밀한 sourceRect에 대한 좌표는 `cropStandingAnchor=[395,109]`입니다. 바닥 정렬점 `cropAnchor=[402,273]`과 구분합니다. 아바타를 밑면에 정렬하지 않고 실제 신발 아래가 윗면에 닿도록 표시 크기·포즈별로 확인해야 합니다.

## 확인한 원본 자료와 사용한 부분

| 원본 카탈로그·파일 | 확인 영역과 사용 역할 |
|---|---|
| `frame-library/originals/frame-2ff1ad2045333b73.jpg` | 빈 나무 판과 초록 리본 후보 `[171,210,276,201]`. 목재의 두께·잎·리본을 간판 재질에 반영 |
| `frame-library/originals/frame-6b99379d3662c645.jpg` | 목재 가로 간판/레일 `[106,171,521,87]`, 크림색 종이·차분한 숲빛. 따뜻한 나무와 읽기 공간의 재질 기준 |
| `icon-library/originals/icon-reference-04.jpg` | 천/가죽 조각 `[248,128,109,43]`, 장갑·모자·리본 등의 제작 재료. 접힌 천과 작은 금속·바느질 소품의 소재 기준 |
| `house-library/originals/house-0c0b1bd03495c453.jpg` | 오른쪽 아래 공방·화분·진열 후보 `[365,602,365,301]`. 가게 주변의 식물과 진열·작업장 생활감 |

위 좌표는 원본 JPEG에서 시각적으로 고른 참고 영역입니다. 런타임 알파·개별 사물 앵커를 측정한 좌표와 구분합니다. 원본 자료의 정확한 이름·해시·출처 상태는 각 라이브러리와 이 JSON의 `referenceMaterials`에 보존합니다. 원본의 영어 라벨·브랜드·서명·워터마크는 소품 PNG에 포함하지 않았습니다.

## 원화와 표시 검사

PNG 원본과 보관 파일의 바이트·SHA-256이 일치합니다. 중앙 가로·세로 48픽셀 띠와 각 셀 가장자리에서 알파 8 이상 픽셀은 0개입니다. 중앙 띠에는 알파 0~1의 아주 약한 가장자리 값만 남습니다. 네 소품은 서로 다른 셀로 표시할 때 이웃 사물이 잘려 들어오지 않습니다.

원본 PNG를 SVG viewBox의 네 sourceRect로 표시한 **실제 PC 1200×820 화면**을 직접 열어 확인했습니다. 빈 간판, 받침 윗면·앞면, 옷걸이의 옷·기둥·꽃, 재봉 묶음의 천·가위·실·단추가 모두 온전히 보였고 크림색 판 위에 색 테두리나 배경 사각형이 보이지 않았습니다. PNG 디코딩 치수와 네 표시 영역, 브라우저 오류 0개를 확인했습니다.

이 검사는 소품의 분리·표시 검사입니다. 실제 상점의 배치·상품 선택·구매·아바타 접지·가림과 다른 모션은 해당 UI에서 별도로 검수합니다.

## 생성 지침 원문

Use the supplied four reference images only as material and mood references, and redesign their selected wood, fabric and shop display motifs into ONE original TRANSPARENT game-prop atlas for a cozy forest-village CLOTHING SHOP. Wide landscape 2:1 image, ideally 2048 x 1024. STRICT 2 by 2 grid of FOUR separate single object groups, exact equal cells, ample fully transparent margins and gutters. Each prop fits fully inside its own quadrant, with at least 60 pixels transparent around every cell edge and the central vertical/horizontal seams. Do not copy reference labels, figures or watermarks. Match a charming polished hand-painted SD mobile-game style: warm honey wood, ivory fabric, restrained brass gold hardware, jade and moss green leaves, dusty pastel pink/blue/cream clothes, subtle matte shading in two or three big tonal shapes, delicate material texture, rounded friendly shapes, softly painted edges, upper-left sunlight and contact shadows. Not photorealistic, not glossy resin, not pixel art, no harsh tiny black hatching. Elevated frontal three-quarter perspective, all at a cohesive scale.
TOP LEFT CELL: one empty wide hanging wooden shop sign, clearly readable BLANK honey wood board, softly carved irregular round corners, a small muted green ribbon along the top, two short rope attachments, tiny brass-gold scissors emblem near one corner with a few small jade leaves. Center wood face completely blank: no lettering, symbols or invented language. The scissors must stay tiny at the corner, not across the writing surface.
TOP RIGHT CELL: one broad oval wooden avatar fitting podium seen slightly from above, visible flat elliptical wood top with growth rings and a modest front rim showing real thickness, a tiny leaf and cream flower at either base corner, subtle contact shadow beneath. NO character, no shoes, no center object. Top must be clear and naturally grounded, ready for an avatar to stand on.
BOTTOM LEFT CELL: one small warm wooden clothing display rack, horizontal wooden beam supported by two narrow posts and grounded short feet, exactly two small cute garments hanging neatly from real clothes hangers: dusty pink collared short-sleeve top and dusty pastel blue skirt or simple garment, fabric hems and buttons readable; one little terracotta pot with small cream/pink flowers at a foot. No mannequin, human, body, face, head or feet inside the garments. Clothing rack is shop scenery, not a costume atlas.
BOTTOM RIGHT CELL: one compact tailor workbench still-life group: short low wood shelf or surface, two or three thread spools, neatly folded pastel fabrics, a few buttons in a shallow little dish, small brass-gold scissors, one tiny potted flower. Group must be cohesive, compact and easily recognizable at small sizes. No needles standing in empty air, no person, no room background.
EVERYTHING outside these four prop groups is truly transparent, including background and all quadrant gutters. No opaque backdrop, no white/black/colored/checkerboard background, no scenic forest background. No labels, text, digits, logos, watermark, screenshot, entire UI, UI controls or borders. Do not let any prop touch or cross quadrant boundaries. This is an original reusable transparent prop kit, not a collage of reference JPEGs.

### 셀 여백 수정 지침

Edit this exact transparent four-prop atlas. Preserve the beautiful original artwork, warm wood, green ribbon, folded pastel fabrics, garments, leaves, flowers and all four prop designs. Correct ONLY layout and separation so it becomes a safe STRICT 2x2 sprite atlas. Keep landscape 2:1 aspect ratio and transparency. Each prop must be fully inside its quadrant. A completely TRANSPARENT horizontal gutter centered at exactly 50% image height, at least 80 pixels thick in a 1774x887 canvas (or proportional equivalent), must separate top row from bottom row. Currently the clothing rack touches/crosses that center line: shrink the entire BOTTOM LEFT rack uniformly by about 15%, keeping its shape and detail, then center it lower inside the bottom-left quadrant with all of it below 56% image height and above 94% image height. Uniformly shrink the TOP LEFT hanging sign about 8% and center it within the top-left quadrant so all of it lies above 44% image height. Keep TOP RIGHT oval platform fully inside top-right quadrant with clear top and no avatar; keep BOTTOM RIGHT tailoring still-life fully inside bottom-right quadrant and below 56% image height. Maintain transparent vertical gutter at exactly50%image width, at least80pixels thick. Each corner object should have transparent outer margins at least30pixels. The result should have the EXACT SAME four designs, no new props, no signs/labels/text/logos/numbers/watermarks, no fake checkerboard or solid background. Clean smooth semi-transparent edges, no colored fringe or isolated colored speckles. True RGBA transparency everywhere outside the four compact prop groups, including all gutters. Do not crop any ropes, leaves, flowers, rack pegs or feet.
