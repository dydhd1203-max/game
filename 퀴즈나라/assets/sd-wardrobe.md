# 부드러운 SD 아바타 의상 원화

2026-10-01 사용자 요청에 따라 기존 도트 의상을 새롭게 그린, 부드러운 곡선과 명암이 있는 SD 캐릭터용 의상이다. 사용자가 제공한 여러 의상의 캐릭터 시트는 귀여운 비율·풍성한 장식·재질의 참고로 사용했다. 게임에 포함하는 의상은 새로 생성한 원화이며 참고 시트의 캐릭터를 잘라 사용하지 않았다.

## 자산과 착용 계약

세 PNG 모두 실제 알파 채널을 가진 1254×1254 원본이다. 생성 파일을 그대로 복사했으며 리사이즈·후처리·배경 합성은 하지 않았다. `sd-wardrobe.json`에 셀의 소스 좌표, 알파 25 이상 픽셀의 경계와 수, 원본 SHA-256을 기록했다. 런타임에서는 같은 크기의 행·열 셀을 분리해 의상을 입힌다.

| 파일 | 배열 | 순서 |
| --- | --- | --- |
| `sd-tops.png` | 4×4, 14종 | tee, hood, shirt, dress, vest, cardi, sailor, jacket, knit, tank, hanbok, robe, overall, space. 마지막 두 칸은 비어 있다. |
| `sd-bottoms.png` | 4×4, 11종 | shorts, jeans, skirt, pleat, track, legging, hanbok, tutu, cargo, jean_skirt, star_skirt. 마지막 다섯 칸은 비어 있다. |
| `sd-shoes.png` | 3×3, 9쌍 | sneaker, loafer, boots, sandal, hitop, ballet, rain, slipper, wing_shoes. 모든 칸에 좌우 한 쌍이 있다. |

몸·얼굴·머리·손·다리·발의 피부는 의상 원화에 포함하지 않는다. 어깨와 허리 중심을 맞추어 상의·하의를 독립적으로 조합하고, 긴 상의의 옷자락과 넓은 치마는 해당 착용 영역으로 표시한다. 기존 구매·부위별 착용 키를 그대로 사용한다.

참고와 실제 전신을 교차 검수한 뒤 `hood`에는 [내려진 토끼 후드](./sd-hood.md)를 별도 원화로 적용했다. 원래 상의 시트의 후드 칸은 제작 이력으로 남으며 실제 착용과 상품 미리보기는 `sd-hood.png`를 사용한다. 니트·카디건·바지의 착용 영역을 종류별로 맞추고, 신발은 몸의 세로 배율 1.35를 고려해 앞코와 밑창이 납작해지지 않도록 원본 비율로 표시한다. 염색되는 천의 채도와 밝기 상한을 두어 네온 광택을 줄이되 크림색과 금속·꽃 장식의 원본 색은 보존한다.

## 소재와 염색

주요 천·가죽은 파란색 계열(중심 색상각 약 220도)이다. 밝은 면·중간 면·어두운 주름이 있어 염색 뒤에도 부피와 소재가 남는다. 흰색·크림색 레이스, 금색 단추와 버클, 분홍·살구 꽃, 녹색 잎은 기본 천과 색상 계열을 분리했다. 옷 색을 바꿀 때 이 장식의 원색을 보존한다. 신발도 파란 주재료와 크림색 밑창·끈·안감, 금색 장식을 분리했다.

상의는 데이지 자수 티셔츠, 토끼 후드, 나비넥타이 셔츠, 레이스 인형 드레스, 금속 단추 조끼, 꽃 카디건, 리본 세일러, 탐험가 재킷, 별 꽈배기 니트, 꽃 민소매, 전통 한복, 숲 마법사 로브, 멜빵옷, 우주복으로 개성을 구분했다. 하의는 주름·포켓·허리 리본·프릴을 종류에 맞게 설계했다. 신발에는 끈·버클·둥근 앞코·밑창·양쪽 날개 등 서로 다른 구조를 그렸다.

## 제작 프롬프트와 보정 기록

공통 제작 지시: "Production game wardrobe sprite atlas, genuine transparent alpha, luxurious smooth painted Japanese/Korean SD chibi fashion, rounded silhouettes, rich soft shading, delicate outlines, embroidery, ribbons, lace, gold buttons, upper-left light. No pixel art, people, skin, mannequins, labels, grid lines or detached ornaments. Blue dyeable main material, cream lace and gold/pastel decorations. Exact row-major uniform grid."

상의 첫 생성에서는 옷자락이 셀에 걸쳐, 같은 원화를 이미지 생성 도구로 다시 그리며 4×4 칸의 가운데 배치와 넓은 투명 여백을 명시했다. 하의도 같은 도구로 4×4 여백을 넓히고 `jeans`에 두 개의 긴 바짓단을 지정했다. 신발은 3×3 각 칸에 한 쌍씩 들어가도록 가운데 배치와 여백을 보정했다. 최종 PNG 픽셀 자체를 코드나 이미지 편집 라이브러리로 수정하지 않았다.

원본 생성 파일:

- 상의: `exec-a45e0c82-fd29-4250-a738-e85cee5ce84b.png`
- 하의: `exec-04175508-d888-406d-a54e-7c4f4ab36548.png`
- 신발: `exec-042cf7dd-e906-4b94-9889-5435f5b8020d.png`

## 확인 범위

원본을 직접 열어 14종·11종·9쌍의 배열, 곡선·주름·장식, 피부가 섞이지 않는 구성을 확인했다. 모든 필요한 셀의 알파 25 이상 픽셀이 10,000개를 넘고, 마지막 빈 셀에는 해당 픽셀이 없다. 신발 각 셀의 알파 25 이상 원화는 한 개의 큰 연결된 쌍으로 구성되어, 옆 칸 신발의 조각이 섞이지 않는다. 실제 로비·상점·맵에서의 착용 위치·남녀/피부 조합·염색·걷기/점프/앉기는 통합 후 별도로 확인한다. 원화 파일의 품질 확인은 이 실제 착용 검수를 대신하지 않는다.
