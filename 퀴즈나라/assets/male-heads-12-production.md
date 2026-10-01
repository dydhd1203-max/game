# 남자 SD 헤어 12종 원화 제작

2026-10-01 사용자 요청: 남자 머리가 네 종류뿐이고 몇 개가 비슷하게 보이는 문제를 해결한다. 기존 네 상품 키 `short`, `spiky`, `part`, `messy`는 유지하고, 별도 남자 원화에 여덟 가지 실루엣을 더했다. 기존 여성 헤어 원화·의상·펫·신발은 이 작업에서 수정하지 않았다.

## 배열과 구별점

`sd-heads-male.png`는 1448×1086 RGBA, 4열×3행이며 각 셀은 362×362다. 생성한 최종 PNG를 그대로 사용하며 이미지 편집 코드로 픽셀을 가공하지 않았다.

| 행 | 왼쪽부터 순서 | 미술 차이 |
| --- | --- | --- |
| 1 | short / spiky / part / messy | 짧은 옆가르마 / 높게 선 뾰족머리 / 대칭 가운데 가르마 / 옆으로 뻗는 헝클어진 머리 |
| 2 | crop / bowl / fade / undercut | 얕고 짧은 앞머리 / 둥근 바가지와 일자 앞머리 / 짧은 양옆과 높은 퀴프 / 한쪽으로 길게 쓸어 넘긴 윗머리 |
| 3 | slick / curlm / comma / wolf | 이마를 드러낸 올백 / 둥근 곱슬 덩어리 / 뚜렷한 쉼표 앞머리 / 귀 아래로 긴 층진 뒷머리 |

`curlm`은 새 남자 곱슬 웨이브의 상품 키다. 이전 여성 헤어의 `wave` 호환 별칭을 바꾸지 않도록 새 남자 상품에 `wave` 키를 재사용하지 않는다.

모든 얼굴은 같은 계열의 둥근 SD 남자 얼굴, 청록색 큰 눈, 작은 입과 따뜻한 피부색으로 그렸다. 갈색 헤어는 기존 색상 변경 방식에 맞추었다. 각 머리의 눈·턱·목 위치는 실제 소스 셀에서 측정해 정규화 시 같은 얼굴 위치로 맞춘다. 원화에는 상체·옷·모자·장신구를 포함하지 않는다.

## 제작 지시

기존 남자 시트와 사용자가 보낸 24명 SD 캐릭터 시트를 직접 확인한 뒤 이미지 생성 도구에 다음을 요청했다.

> A new original professional avatar head atlas, exactly twelve clearly different boy hairstyles. Four columns by three rows, transparent alpha. Same cute front-facing boy face, large teal oval eyes, peach cheeks, warm brown outline, matte chestnut broad hair clumps with two to three gentle shading tones. No pixel art, photorealism, thin hair strands, bodies, clothes, accessories, labels, grid or background. Distinct short / spiky / center part / messy / crop / bowl / fade / undercut / slick / curly wave / comma / wolf silhouettes. Every eye remains visible. All art stays within its own cell.

첫 생성에서는 첫 줄 목이 셀 경계에 걸쳐, 같은 도구로 머리를 더 작게 배치하고 행 사이 투명 여백을 다시 요청했다. 보정 지시에는 크롭·페이드·단정 머리의 차이, 전체 머리·목·뾰족 끝이 자신의 셀 안에 들어갈 것을 명시했다.

최종 생성 원본: `exec-54b8dfa8-f57f-4da1-b5bf-d11fb08740fd.png`

SHA-256: `e701d6181a1bfb7ebf5a611c498feeb3c94c53c3432c941bb68c9c96393e46e2`

## 측정과 확인

실측 제안은 `sd-heads-male-metadata.json`에 저장했다. 각 셀의 소스 좌표, 알파 200 이상 원화 경계, 청록색 홍채 픽셀의 무게중심, 눈 영역, 턱·목 기준점과 렌더러용 힌트 배열을 포함한다. 실제 셀이 362×362이므로 현재 렌더러의 362 기준과 단위가 같다. 눈 영역은 홍채 경계를 넓힌 힌트이므로 게임에서 뜬 눈·반쯤 감은 눈·감은 눈을 추가 검수한다.

원본 PNG를 브라우저에서 190px와 **62px** 크기로 표시해 직접 비교했다. 각 상품의 뾰족 끝, 가운데 가르마, 일자 앞머리, 둥근 바가지, 짧은 옆머리, 드러난 이마, 쉼표와 긴 뒷머리가 작은 크기에서도 구별된다. 알파 경계는 모든 셀 안에 있으며 이웃 머리 조각이나 잘린 목은 없다. 전체 UI에서의 상품 수·성별 전환·저장 호환·염색·착용·눈 깜박임은 새 배열을 통합한 다음 별도로 검사한다. 썸네일 원화 확인은 실제 착용 검수를 대신하지 않는다.
