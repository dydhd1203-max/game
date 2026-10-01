# 숲속 마을 탐험 지형 제작 기록

제작일: 2026-10-01. 사용자 요청: 비슷한 집이 몰려 있는 좁은 마을을 넓히고, 여러 모양의 계단·높은 통나무·줄을 오르는 등 호기심을 자극하는 공간을 만들기.

## 실제 확인한 참고

- 기존 [forest-town-landmarks.png](forest-town-landmarks.png)와 [forest-town-foliage.png](forest-town-foliage.png)를 직접 확인해 따뜻한 왼쪽 위 광원, 금빛 갈색 나무, 청록 음영, 이끼·꽃·돌의 화풍을 맞췄다.
- 사용자 [house-05e82ecd45294a75.jpg](house-library/originals/house-05e82ecd45294a75.jpg)의 상층 목재 연결 통로 구조를 확인했다. 참고 건물 전체나 흰 배경은 런타임에 붙이지 않았고 새 지형은 집과 다른 실루엣으로 제작했다.
- 기존 돌계단·로프다리와 중복되지 않도록 높은 수직 통나무 사다리, 곡선 나무계단, 어두운 열린 비밀 동굴을 구분했다.

## 저장한 원화

[forest-town-exploration.png](forest-town-exploration.png)는 image_gen 원본 PNG를 바이트 그대로 복사했다. 원 생성 파일 /workspace/generated_images/exec-0266ced6-d084-4ab4-b98d-1dd61ed46ee4.png는 그대로 남아 있다.

- 1774×887 RGBA, 2,134,257 bytes.
- SHA-256: 34a717ac0730e475d6b4c45fee2ab5868dbe428aca6298b192e800dee3466d38.
- 통나무·나무계단·동굴의 세 큰 알파 연결 성분이 독립되어 있다. 바깥은 실제 alpha 0이다.
- 원화의 폭·높이는 균일한 3칸 시트가 아니다. [JSON](forest-town-exploration.json)의 source·anchor·문턱·사다리 및 계단 경로를 사용한다.
- 계단과 동굴의 바운딩박스가 다른 높이에서 조금 겹친다. 두 소품은 source만 사용하지 말고 JSON clipPathAtlas를 전체 PNG 좌표의 clipPath로 함께 사용한다. 실제 투명 여백을 따라 분리했으며 알파 64 이상 기준 계단 197,837픽셀·동굴 232,516픽셀 중 의도한 성분이 잘린 픽셀 0, 다른 큰 소품이 포함된 픽셀 0을 확인했다.

## 실제 이동에 필요한 구분

통나무의 열린 상단 발판은 지붕이나 잎으로 덮지 않았으며 나무판 바닥·뒤쪽 낮은 난간·등불을 그렸다. 긴 앞면 줄사다리의 밑·위 끝과 상단에 설 실제 점을 기록했다. suggestedWidth 290에서 바닥 anchor와 상단 standing point 간 그림상의 높이는 344.5픽셀이고, 줄 밑과 위 사이 높이는 311.5픽셀이다. 게임의 논리 y 이동과 elevation을 이 그림에 맞춰 보정한다. 막연히 400픽셀 오르는 것으로 처리하지 않는다.

곡선 나무계단의 아랫 발판·위쪽 빈 착지 데크·굽은 중간 경로를 기록했다. 돌계단처럼 축에 평행한 직선 ramp로 취급하지 않으며 실제 그려진 계단을 따라 오르도록 설계한다. 비밀 동굴은 열린 청록 문과 앞쪽 돌 문턱을 기록했다.

기본 y 정렬만 사용하면 높은 통나무를 오르는 아바타가 전체 PNG 뒤로 가려질 수 있다. 사다리 오름과 상단 발판 상태에서는 아바타가 전면과 빈 데크 위에 보이도록 층을 보정해야 한다. 원격 친구에게도 같은 상태가 표시되어야 한다. 원화 저장은 오르기·내리기·착지·동굴 접근 검수 완료와 구분한다.

## 미술 확인과 남은 검수

직접 본 원화에서 길게 이어진 나무결과 이끼, 밑에서 꼭대기까지 연결된 줄·나무 발판, 상단 빈 바닥, 나무계단의 곡선·지지대와 열린 동굴 문을 확인했다. 기존 건물·식생과 빛·재질이 맞으며 다른 집으로 보이지 않는다. 실제 확장 마을의 기본 플레이 화면, 오르는 연속 아바타, 문턱 접근, 맵 가림·충돌은 통합 후 별도 검수한다.

## 생성 프롬프트

transparent_background: true. referenced_image_paths: 위 기존 마을 원화 2개와 사용자 연결 통로 참고 1개. 프롬프트 원문:

```text
Create a high quality production TRANSPARENT PNG atlas of THREE new exploration props for this original whimsical FOREST TOWN. Match the existing warm upper-left sunlight, rounded painterly forms, rich gold-brown wood, jade moss, creamy stones and blue-teal reflected shade of reference 1 and reference 2. Reference 3 guides the appeal of raised wooden passages, but do not copy its buildings. Smooth illustrated 2.5D stylized game environment art, slightly top-down elevated three-quarter frontal camera. No pixel art. No characters, no animals, no text, no symbols used as UI, no logos, no watermark.

All THREE fully isolated props in ONE ROW, left / center / right, on genuine alpha transparency. Give generous transparent gaps between their rectangular bounding boxes, at least 45 pixels. Each entire prop including every rope end, tree tip, wooden landing and root is visible. No colored backdrop or floor plates, no entire map, no extra panels. Left prop is tall and fills the height; the other two occupy their own fully separate cells at the same common lower ground baseline.

LEFT: A VERY TALL HOLLOW LOG EXPLORATION TOWER, a gigantic upright old golden-brown tree trunk with whimsical twists, deep warm bark grooves, moss patches and small flowers around its roots. It is intentionally tall, around 1.7 to 1.9 times as high as its widest silhouette. At the VERY TOP is a broad OPEN ROUND WOODEN OBSERVATION DECK with a clearly visible empty walking floor viewed from above. The deck uses honey wooden planks, a low railing ONLY along the back half, a little green foliage behind the railing, and two small lantern posts; no roof or canopy obscuring the deck. A child avatar should be visibly able to stand on the open top floor. A LONG STRAIGHT VERTICAL ROPE LADDER runs up the FRONT CENTER of the entire log from the rooted ground to the edge of the top deck, with two thick hemp ropes and many neat wooden rungs. Both bottom ends and the top attachment are visible. The rope ladder is screen-vertical, not diagonal and not spiraling behind the log. A friendly tiny hollow arch / warm teal glowing knothole at the base gives magical curiosity without blocking the ladder. The clear top walking point sits roughly 400 rendered pixels above the ladder's bottom for a 290-pixel-wide prop. The top deck is about as wide as the middle of the tree plus its root spread. Render long bark surfaces with rich volume, and clear rope rungs.

CENTER: An original CURVED WOODEN STAIRWAY, completely different from the existing straight mossy stone stairs. One broad welcoming flight of about twelve round-edged honey wooden plank steps curves gently from a clearly visible bottom landing at LOWER LEFT to a larger empty UPPER RIGHT landing/deck. It goes upward into the forest, with stout rustic wooden supports, twisted branch railing only along its outer edge, and three small little fern/flower clusters tucked to sides. Show a usable continuous curved step path and both endpoints distinctly. The empty top landing is visible from above, no wall or door blocking it. No building, no water, no surrounding terrain; this is a single reusable wooden stairs prop with attached small supports.

RIGHT: A mysterious but friendly SECRET GLOWING CAVE ENTRANCE, rounded volumetric silver-violet rocks with richly painted planes, mossy upper lip, hanging green vines, small clusters of pale white flowers and warm orange mushrooms at the base. A broad obvious open dark teal cave doorway faces camera at the bottom center. Deep inside, a soft glowing turquoise crystal and tiny golden specks suggest a wonderful secret destination, not horror. The doorway has a flat stone threshold clearly visible for a small avatar to approach and stand on. No actual character inside, no sign, no text, no stairs attached to this cave. Enough width for a readable unique dark-open silhouette distinct from houses and towers.

These props will be used for real climbing and entering, so clear ladder attachment, landing floors and door threshold matter. Original rich polished storybook forest game asset quality. Do not flatten the materials into simple shapes and do not turn the tower into another house.
```
