# 퀴즈나라 전체 소재 보관함

[전체 검색](./index.html)에서 ZIP 종류와 관계없이 집·풀·꽃·창 테두리·아이콘을 찾습니다. 원본 이름, 한국어 설명, 종류, 화풍과 별칭으로 검색할 수 있습니다. 목록은 24개씩 표시하여 큰 팩도 한 번에 모든 이미지를 불러오지 않습니다.

종류별 보관함: [맵·환경](../map-library/index.html), [풀·식생](../grass-library/index.html), [집·건물](../house-library/index.html), [마을·생활 풍경](../village-library/index.html), [메타버스 공간](../metaverse-map-library/index.html), [모션·보행](../motion-library/index.html), [물·연못·폭포](../water-library/index.html), [기본 인터페이스](../interface-library/index.html), [버튼](../button-library/index.html), [아이콘](../icon-library/index.html), [창 테두리](../frame-library/index.html).

각 폴더의 ZIP과 원본 이미지를 그대로 보존합니다. 같은 바이트의 이미지가 여러 이름으로 들어 있으면 한 원본에 별칭을 연결하며, ZIP에는 모든 원래 이름이 남습니다. 각 목록의 크기·바이트 수·SHA-256과 실제 시각 확인 상태를 참고합니다. 불투명 JPEG의 체크무늬는 투명도가 아니며, 저장한 참고 시트가 바로 사용할 수 있는 소품·버튼 또는 완성된 맵은 아닙니다.

숲속 마을과 어울리는 자료부터 고르고 실제 그림을 확인합니다. 이후 사용할 영역, 투명도, 바닥·착용 기준점과 크기를 준비하고 게임의 실제 화면에서 가림·이동·충돌을 검수합니다. 아직 개별 그림을 확인하지 않은 자료는 목록에서 그대로 표시합니다. 현재 아바타의 부드러운 SD 스타일을 유지합니다.

다른 컴퓨터에서는 GitHub의 최신 전체 ZIP을 받아 `game-main/퀴즈나라` 폴더 전체를 사용합니다. `assets/library/index.html`이 이 보관함입니다. 이미지·목록 JS도 함께 있어야 하며, 단일 HTML만 복사하지 않습니다. 이 보관함은 JSON 네트워크 요청 없이 목록 JS를 사용합니다.

`catalog.json`을 수정한 뒤에는 `퀴즈나라/`에서 `node tools/build-map-library.cjs`로 종류별 목록 JS와 통합 목록을 다시 생성합니다. `node tools/check-source.cjs`가 목록 데이터와 원본 이미지·ZIP의 해시를 확인합니다. 원본을 바꿀 때는 기존 파일을 덮기보다 새 자료로 등록하고 실제 출처·권리 정보를 제공받은 범위에서 기록합니다.

사용자의 최신 맵 기준은 **제공한 에셋 원본을 직접 사용**하는 것입니다. 불투명 JPG도 재질 내부 sourceRect 또는 사물 외곽 SVG clipPath로 표시할 수 있으며 원본을 새 그림으로 대체하지 않습니다. 돌길·돌담·물·연못의 실제 원본 영역은 상세 catalog의 runtimeRegions에 기록하고, 전체 검색에서는 `원본 영역 사용 중 · 화면 검수 진행`으로 별도 표시합니다. 원본 전체가 완성 게임 맵이거나 원래 투명 PNG였다는 의미가 아닙니다. 원본 보관·직접 시각 확인·코드 배치·최종 미술 검수를 구분합니다.
