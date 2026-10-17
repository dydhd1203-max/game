# 확인용 비교판 (?demo=1, 저장 안 함)

그림을 직접 보는 검수용 비교판을 만든다. 출력은 `검증/`(저장소에 올리지 않음)에 둔다.

| 도구 | 만드는 것 |
|---|---|
| `node tools/boards/heads-board.cjs . OUT.png [피부 0-4] [머리색 0-11] [크기]` (예 진한 피부·분홍 `4 6`) | 머리 24개 × 앞·옆·뒤, 머리와 목만, 진한 파란 바탕: 물든 귀·밝은 테두리·목 그루터기 확인 |
| `node tools/boards/heads-motion.cjs . OUT.png [모양,...] [피부] [머리색] [크기]` (예 `f:bob,f:braid,m:short 4 6`) | 머리 몇 개 × 서기·걷기·뛰기·점프·고개 인사·손 흔들기·책상·바닥 × 앞·옆, 진한 파란 바탕 |
| `node tools/verify-hairstyles.cjs` (약 7분, 검사 묶음 H4) | `검증/머리/H4/목이음-<성별>-<보기>.png`(280px 목 이음 8배, 지금 \| 새 층), `목큰-<성별>-<옆\|뒤>.png`(840px 2배, 지금 \| 새 층 \| 몸만): 목 구멍·이음선은 큰 판으로 본다 |
| `node tools/hair/board-heads.cjs [--styles f:base,m:base] [--with f:bob,m:short] [--out 검증/머리/민머리] [--outfit body]` (약 20초, H5) | `머리판-280.png`(머리마다 앞·옆·뒤 × 피부 0 갈색·피부 3 분홍), `목큰.png`(840px 목 2배, 머리를 숨긴 몸과 나란히), `전체-840.png`·`전체-840-몸.png`. 닫힌 구멍(목 구역, 4px 이상 0)·층 검사. 매달린 머리(pony 등)는 몸과 사이가 닫혀 구멍으로 잡히니 `verify-hairstyles.cjs` H로 본다 |
| `node tools/hair/board-heads.cjs --styles f:tlong --with f:long --matrix` (약 40초) | 위에 더해 4방향 × 피부 5 × 머리색 4(120px)와 동작 9가지 × 앞·옆·뒤의 노드 수·층 검사, `동작-280.png`(동작 280px, 피부 2·분홍) |
| `python3 -B tools/hair/build-hairstyle.py 원화 --sex f --shape 이름 --debug` (약 25초, H5) | `검증/머리/새머리/<성별>-<모양>-확인.png`(맞춘 원화 \| 찾은 머리(빨강) \| 갈색·피부 0 미리보기 \| 분홍·진한 피부, 반 크기), `-확인-큰.png`(미리보기 실제 크기). 미리보기에는 몸이 없으니 구멍은 게임 화면(`board-heads.cjs`)으로 본다 |
| `python3 -B tools/hair/verify-hairstyle-pipeline.py` (약 10분, H5 시험) | `검증/머리/H5/IoU-보기.png`(T1·T3·T4 정답과 찾은 머리: 회색 둘 다, 빨강 찾기만, 파랑 정답만), `cases/<시험>/`의 확인판, `R/`(시험 머리를 잠시 설치한 게임 화면) |
| `python3 -B tools/hair/build-heads.py debug f-bob-profile ...` | 한 머리 목 둘레 판정 6배(`검증/머리/디버그/`): 원화 \| 판정(지움 빨강·남김 초록·흐림)과 목 구역(노랑)·몸 가장자리(하늘) \| 몸 위 결과 |
| `node tools/boards/hats-views.cjs . OUT.png 모양:색` (예 `cowboy:11`, `hat:` 없이) | 머리 24개 × 앞·옆·뒤에 모자 하나 |
| `node tools/boards/hats-one.cjs . OUT.png 모양:ci,모양:ci,...` (예 `cowboy:11,police:5`) | 모자 여러 개 × 머리 6개 × 앞·옆·뒤 (작게) |
| `node tools/boards/hathair-board.cjs . OUT.png [모양:색,...]` | 푹 쓰는 모자(기본 12종) × 단발·양갈래·포니테일 × 앞·옆·뒤: 머리 모양별 모자 크기 맞춤(`fit-hat-hair.py`) 확인 |
| `node tools/boards/faces-board.cjs . OUT.png` | 얼굴 장식·눈코입 × 남녀 앞·옆, 옆얼굴이 다른 머리, 어두운 피부 |
| `node tools/boards/seat-items.cjs . OUT.png f\|m` | 바닥 앉기 × 상점 옷 전부 × 앞·옆·뒤 (짧은 머리) |
