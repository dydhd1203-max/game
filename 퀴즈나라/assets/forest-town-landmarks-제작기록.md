# 숲속 마을 랜드마크 제작 기록

제작일: 2026-10-01. 사용자 승인 방향: 로그인 후 친구들이 모이는 숲속 마을, 작은 SD 아바타, 건물에 들어가 교실·퀴즈·상점 사용, 계단·다리로 실제 높낮이 이동.

## 실제 선택하고 확인한 자료

- 기존 투명 제작 원화 [painted-forest-props.png](painted-forest-props.png): 따뜻한 왼쪽 위 빛, 청록 음영, 둥근 잎, 보랏빛 슬레이트와 크림색 돌. 기존 참나무·바위·우물은 직접 재사용 가능한 제작 PNG이며 이 파일을 바꾸지 않았다.
- 사용자 건물 자료 [house-0c0b1bd03495c453.jpg](house-library/originals/house-0c0b1bd03495c453.jpg): 실제 2×3 상점 시트의 가게 앞 진열·꽃·덩굴·목골조 구조를 참고했다. JPEG 전체를 게임 건물로 붙이지 않았고 외국어 간판은 가져오지 않았다.
- 사용자 맵 자료 [reference-farm-village-sheet.jpg](map-library/originals/reference-farm-village-sheet.jpg): 실제 농장·판타지 가게 시트에서 지붕 실루엣·나무 재질·등불·문 주변 소품 배치를 참고했다. 불투명 JPEG 배경이나 글자는 게임에 붙이지 않았다.
- 상층 통로 구조를 검토한 [house-05e82ecd45294a75.jpg](house-library/originals/house-05e82ecd45294a75.jpg)는 높이 연결 참고로만 확인했다. 런타임 이미지로 쓰지 않았다.
- [reference-forgotten-forest.jpg](map-library/originals/reference-forgotten-forest.jpg)는 도트·어두운 숲 패널이라 현재 밝은 매끄러운 숲속 마을 제작 참고에서 제외했다.

## 저장한 원화

[forest-town-landmarks.png](forest-town-landmarks.png)는 image_gen 생성 PNG의 바이트를 그대로 복사했다. 원 생성 파일은 /workspace/generated_images/exec-f1a1799b-3427-42ed-90c6-7d649a4753ed.png에 그대로 남아 있다.

- 크기 1536×1024, RGBA.
- SHA-256: 4b1ee6e3c21b7e0acd1bc32f2b33dad6ccaa35edc183ab3edd3b4464e00ebb4b.
- 6개 큰 알파 연결 성분을 검사했으며 교실·가게·관측탑·다리·계단·폭포가 서로 분리되어 있다. 원화 배경은 실제 alpha 0이다. 투명 영역의 RGB에는 색이 남아 있지만 게임에서 보이는 불투명 배경이 아니다.
- 최종 출력은 균일 3×2 셀을 따르지 않으므로 균일한 512칸으로 자르지 않는다. [JSON](forest-town-landmarks.json)의 실제 source와 anchor를 사용한다.
- source는 PNG 안의 영역, anchor는 그 영역 기준 제안 바닥점, doorThreshold는 그려진 실제 문턱이다. 제안 anchor만으로 충돌·입장 검수를 완료했다고 판단하지 않는다. 게임 지형과 문턱 접근은 구현 후 기본 플레이 화면에서 별도 확인한다.
- 계단과 다리는 손잡이·바위·꽃이 함께 있는 그림이다. 상판 걷기 선은 JSON walkCenterLine에 기록했으며 옆 장식까지 걸을 수 있게 만들지 않는다.

## 미술 검토

큰 덩어리의 명암, 잎·지붕·돌·나무의 표면, 건물마다 다른 상징과 문 주변 생활 소품을 원화에서 직접 확인했다. 기존 참나무·바위·우물과 광원·시점·색감이 잘 맞는다. 교실은 책, 상점은 가위와 실, 관측탑은 망원경과 별로 문자 없이 구별된다. 실제 게임의 기본 시작 화면·가림·포털 접근 검수는 지형 통합 후 수행해야 한다. 이 원화 저장만으로 풍경 전체 완성이나 충돌 검수 완료를 보고하지 않는다.

## 생성 프롬프트

transparent_background: true. referenced_image_paths: 위 첫 세 자료. 프롬프트 원문:

```text
Create a high quality TRANSPARENT PNG game prop atlas for an original cute, imaginative FOREST TOWN for elementary school children, matching the warm upper-left sunlight, rounded painterly foliage, violet slate tiles, creamy stone and honey wood of reference 1. References 2 and 3 guide meaningful shop displays, flower beds and whimsical readable building silhouettes. This is production game art, not a mood board. Smooth illustrated painted 2.5D stylized assets, elevated three-quarter / top-down view, coherent camera and light. Rich material detail, rounded volumes, deep cool teal shadows, warm highlighted tops. No pixels, no outlines thick enough to look like symbols, no photorealism. No text, NO characters, no animals, no watermark, no background scene, genuinely transparent gutters, no frame or labels.

Layout MUST be exactly 3 columns by 2 rows with six isolated objects, generous transparent space between them, no overlaps, each fully visible with no crop. Individual objects fill about 80% of their cell, clearly separated. Landscape atlas. Top row:
1) LEFT: inviting treehouse classroom, a small blue-violet slate-roof schoolhouse nestled around a strong old trunk, half-timber cream wall, book-shaped carved emblem above a clear front door that faces camera, golden windows, balcony railing, a few vines and pink flowerpots, small wooden deck at front. A child-friendly storybook silhouette. Do not include an access staircase in this cell; just its tree base and ground contact.
2) CENTER: distinct tiny forest TAILOR SHOP on the ground, warm cream timber walls, curled coral terracotta roof, leaf-green-and-cream striped awning, big open front door facing camera, large wooden spool and scissors icon mounted high without letters, clothing rack with 3 miniature pastel coats beside entrance, pincushion and basket of folded fabrics, flowerpots and ivy. Clear doorway and small stone doorstep.
3) RIGHT: quiz observatory / wizard tower, a squat rounded creamy stone base with a wide open front arch door, blue-violet conical slate roof, brass crescent and telescope on upper balcony, star windows, amber interior glow, moss and small blue flowering plants. Distinct silhouette and magical details, approachable with a clear ground-level doorway.

Bottom row:
4) LEFT: a long HORIZONTAL rope suspension footbridge, viewing from above at same elevated camera, WALKING DECK extending purely left to right. Warm detailed wooden planks, posts at both ends, rope railing on its north edge, low south rope edge. The bridge is isolated without cliffs, water or land, no people; full bridge including end posts visible. Do not render diagonal to the screen.
5) CENTER: VERTICAL up/down broad stone staircase with about 10 rounded creamy mossy stone steps, top landing toward TOP of image, bottom landing toward BOTTOM. Warm upper-left light, tiny flowers on sides, no handrails blocking steps, no castle or surrounding landscape. A clean full-width usable staircase, at the same orthographic elevated camera, no diagonal stairs.
6) RIGHT: picturesque short mossy cliff WATERFALL with a turquoise stream lip at top, rounded volumetric rocks and trailing ferns, white translucent flowing water dropping down the front face into a small turquoise pool with ripple detail. Compact isolated landmark. Rich stone planes and clusters of flowers, clearly separate object, no wider background.

Transparent outside each object and any tiny contact shadow; do not place them on broad colored squares or plates. Render organic edges and bright appealing color, matching the established illustration quality. Only six specified game props, not other panels.
```
