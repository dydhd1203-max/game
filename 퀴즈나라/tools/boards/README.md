# 확인용 비교판 (?demo=1, 저장 안 함)

그림을 직접 보는 검수용 비교판을 만든다. 출력은 `검증/`(저장소에 올리지 않음)에 둔다.

| 도구 | 만드는 것 |
|---|---|
| `node tools/boards/heads-board.cjs . OUT.png [피부 0-4] [머리색 0-11] [크기]` (예 진한 피부·분홍 `4 6`) | 머리 24개 × 앞·옆·뒤, 머리와 목만, 진한 파란 바탕: 물든 귀·밝은 테두리·목 그루터기 확인(지금 게임 그림) |
| `node tools/boards/hats-views.cjs . OUT.png 모양:색` (예 `cowboy:11`, `hat:` 없이) | 머리 24개 × 앞·옆·뒤에 모자 하나 |
| `node tools/boards/hats-one.cjs . OUT.png 모양:ci,모양:ci,...` (예 `cowboy:11,police:5`) | 모자 여러 개 × 머리 6개 × 앞·옆·뒤 (작게) |
| `node tools/boards/hathair-board.cjs . OUT.png [모양:색,...]` | 푹 쓰는 모자(기본 12종) × 단발·양갈래·포니테일 × 앞·옆·뒤: 머리 모양별 모자 크기 맞춤(`fit-hat-hair.py`) 확인 |
| `node tools/boards/faces-board.cjs . OUT.png` | 얼굴 장식·눈코입 × 남녀 앞·옆, 옆얼굴이 다른 머리, 어두운 피부 |
| `node tools/boards/seat-items.cjs . OUT.png f\|m` | 바닥 앉기 × 상점 옷 전부 × 앞·옆·뒤 (짧은 머리) |
