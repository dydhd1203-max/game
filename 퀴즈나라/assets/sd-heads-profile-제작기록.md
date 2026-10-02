# 일러스트 SD 아바타의 실제 옆모습 원화

이 문서는 2026-10-01의 최초 측면 머리 제작 기록이다. 2026-10-02 현재 위 이동은 별도 뒷머리를 사용하고 원본 번들은 13장이다. 상의·하의·신발·착용 장신구에도 별도 측면·뒷면 SVG 그림을 추가했으며, 현재 제작 조건과 검수 범위는 [아바타 라이브러리](아바타-라이브러리.md)와 [교실 검수 기록](../교실-구현검수.md)을 우선한다. 아래의 정면 투영·11장·뒷모습 제외 설명은 최초 버전의 범위다.

2026-10-01 사용자 요청: `motion.zip`처럼 옆으로 움직일 때 옆모습으로 걷는다. 도트로 되돌리지 않으며 현재 예쁜 SD 뼈대와 부위별 꾸미기·색상을 유지한다.

`motion.zip`의 character sprite sheet, Walk Cycles, pixel art monster 시트 세 장을 개별 확인했다. 첫 시트의 옆눈·옆코·뒤머리, 둘째의 디딤·회수 다리와 팔의 반대 박자, 셋째의 방향별 실루엣 차이를 참고했다. 이 JPEG를 통째로 게임 캐릭터에 붙이지 않는다.

추가 원화는 기존 `sd-heads-female.png`와 `sd-heads-male.png`를 이미지 생성 도구의 직접 참고 이미지로 전달해 같은 화풍의 오른쪽 프로필 12종씩 만들었다. 한쪽 눈, 투영된 작은 코와 턱, 가까운 귀, 뒤머리의 볼륨을 실제 새 그림에 포함한다. 정면 머리를 가로 압축해 만든 옆모습이 아니다. 원본 출력 PNG를 리사이즈·색 변경·배경 편집 없이 그대로 복사했다.

- 여자 생성 원본: `/workspace/generated_images/exec-e3a1f975-d354-4bb5-8f3e-c5276302159b.png`
- 남자 생성 원본: `/workspace/generated_images/exec-99fca606-6a35-4dd3-ba53-2f91291592ae.png`
- 게임 원본: `sd-heads-profile-female.png`, `sd-heads-profile-male.png`
- 원본 해시·안전한 셀 영역·머리 순서: `sd-heads-profile.json`

생성 지시: “Create an additional game sprite HEAD atlas for this EXACT existing illustrated chibi head atlas. Preserve matching character identity, cute proportions, soft smooth painted shading, rich walnut brown hair locks and warm peach skin. All 12 heads face STRICTLY RIGHT in a clean near-90-degree SIDE PROFILE: ONE large visible teal eye only, visible projecting little nose silhouette and rounded chin, ONE ear on the near side, full back-of-skull/hair volume to the left, rightward gaze. This is the actual side view of each referenced hairstyle, NOT squashing or mirroring the frontal heads. HEADS AND SHORT NECKS ONLY, no bodies, clothes, shadows, text, labels or checkerboard. Transparent canvas. Arrange exactly FOUR columns by THREE rows, all heads fully contained in separate equal square cells with safe clear transparent margins. Align every neck bottom consistently within each cell, keep same head scale in all cells. Top left to bottom right correspondence MUST match the reference order. Face profile must look right, separate lip line below nose, thick beautiful layered brown highlights exactly like reference. Each head has ONE SIDE EYE (no second far eye). Do not add accessories or outlines around the whole tile. These will be composited on existing small avatar bodies and colored at runtime. Preserve genuine transparency in all empty canvas areas.”

남자 순서: short, spiky, part, messy, crop, bowl, fade, undercut, slick, curlm, comma, wolf. 여자 순서: short, bob, long, twin, pony, curly, bun, hime, part, messy, spiky, braid. 실제 상점의 여자 8종과 남자 12종을 그대로 유지한다. 생성 출력의 정확한 셀 간격은 자동화 지시와 약간 달랐으므로 바운딩 박스를 별도 기록해 이웃 머리를 함께 그리지 않는다.

`avatar-direction.js`가 각 원화 셀·머리색·피부색·표정·눈 닫는 면을 최초 착용 때만 정규화하고 캐시한다. 프레임마다 Canvas를 생성하지 않는다. 기존 정면 머리는 DOM에 그대로 보존하며 좌우 걷기와 정지 방향에서 프로필을 사용하고, 세로 이동·손인사·밧줄 등반에는 정면을 쓴다. 원화 로딩 실패 시 현재 정면 아바타를 유지한다. 로컬 파일 fallback에는 원본 PNG 11장을 그대로 인코딩한다.

몸·옷·신발은 기존 구매한 부위별 원화를 유지하는 관절별 측면 투영이다. 멀리 있는 팔·다리는 몸 뒤, 가까운 팔·다리는 앞에 놓고 양발을 같은 진행 방향으로 돌린다. 온전한 신발을 발목 주변으로 반전하며 한 쌍을 잘라 만들지 않는다. 이 몸 표현을 새 방향별 의상 원화라고 설명하지 않는다. 완전한 등 뒤 원화와 뒷모습은 이번 좌우 이동 범위에 포함하지 않는다.
