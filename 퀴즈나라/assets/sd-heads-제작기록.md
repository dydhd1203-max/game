# 매끄러운 SD 아바타 머리 원화

2026-10-01 사용자 최신 요청에 따라 기존 도트 스타일을 매끄러운 SD 캐릭터 원화로 전환하기 위한 자산입니다. 사용자가 보내 준 24명 캐릭터 의상 시트의 큰 눈·볼터치·풍성한 머리와 부드러운 명암을 화풍 참고로 삼았으며, 얼굴과 헤어는 새로 생성한 원본입니다. 원본 참고 캐릭터의 이미지 자체를 잘라 쓰지 않았습니다. 현재 파일은 최초 반실사 광택 시안을 다시 다듬은 **매트 명암 수정판(version 2)**입니다.

## 파일과 제작 과정

- `sd-heads-female.png`: 여성 머리 12종, 1448×1086 RGBA. 생성 도구 `image_gen.imagegen`의 원본 PNG를 그대로 복사했습니다. 최종 매트 수정판 원본 경로는 `/workspace/generated_images/exec-2ad443fd-e9c7-4a5a-933e-9fdd48d5c411.png`입니다.
- `sd-heads-male.png`: 남성 머리 12종, 1448×1086 RGBA. 같은 대표 머리의 화풍을 로컬 참조로 사용했습니다. 최종 매트 수정판 원본은 `/workspace/generated_images/exec-6a2324ff-f559-436c-9a96-b8043a740e7e.png`입니다.
- `sd-heads.json`: 각 셀의 원본 사각형, 불투명 실루엣 범위, 눈 중심·눈꺼풀 표시 영역과 목·턱 위치의 정렬 보조값, 원본 SHA-256입니다. 위치는 셀 내부 픽셀 좌표입니다. 눈 영역은 눈썹을 제외한 홍채·흰자·속눈썹의 표시 범위이며 깜박임 검수용 힌트입니다.

두 원화 모두 4열×3행이며 셀은 362×362입니다. 순서는 `short, bob, long, twin / pony, curly, bun, hime / part, messy, spiky, braid`입니다. 실제 상점에 노출되는 성별별 헤어 목록은 애플리케이션이 정합니다.

## 생성 지시의 핵심

첫 여성 시안은 마지막 첨부 SD 캐릭터 시트 하나를 참조하여 생성했습니다. 지시는 “original smooth premium 2D illustrated SD fantasy dress-up game heads, not pixel art; exactly twelve complete front-facing heads in four columns by three rows; transparent background; warm peach skin, large sparkling deep brown-to-teal eyes, tiny smile and pink blush; rounded chestnut hair with cream highlights and overlapping softly shaded locks; hair, ears, whole face and tiny bare neck only; no body, clothing, hats, flowers, labels or grid borders; upper-left light; each sprite contained in its own cell”입니다. 헤어 순서는 위 12종을 지정했습니다.

여성 수정 지시는 “keep the same twelve faces and hairstyles, make each head 30 percent smaller relative to its cell; wide fully transparent gutters; all complete hair and neck within the cell, no overlap or clipping; 4×3 square-cell arrangement on 4:3 transparent canvas; at least 40px side margins and 25px vertical margins”입니다.

남성 시안 지시는 “male companion atlas exactly matching the female atlas in illustration family, warm chestnut hair, peach skin, glossy sparkling eyes and rounded shading; original adorable boys with subtly less prominent lashes and boyish eyebrows; twelve complete heads in the same 4×3 order; no body, clothes or permanent accessories; generous transparent gutters”입니다. 최종 수정은 “shrink each complete head by 25 percent inside its own cell; ensure long hair ends at least 35px above the cell bottom; preserve all hairstyle identities and soft painted quality; no colored matte halo”를 추가했습니다.

## 확인한 범위

- 두 파일의 실제 크기와 RGBA 알파를 확인했습니다. 각 12종의 얼굴·헤어가 완전하고, 불투명 머리끼리 겹치지 않습니다.
- Chrome에서 크림색 바닥 위에 원본 PNG를 직접 표시한 화면을 확인했습니다. 검은 투명 미리보기에서 보이는 붉은 외곽 점들은 알파 1~2/255인 거의 투명한 픽셀이며, 크림 바닥에서는 붉은 테두리가 나타나지 않습니다. 원본 PNG의 알파를 평탄화하지 않았습니다.
- 생성기의 실제 눈·턱 높이는 행마다 다릅니다. `sd-heads.json`의 위치 힌트 또는 런타임 얼굴 검출로 착용 몸체에 맞춥니다. 격자에서 단순히 동일 Y로 배치하면 얼굴 높이가 흔들릴 수 있습니다.
- 원화 확인은 실제 게임의 머리색·피부색 변환, 의상 조합과 걷기·점프·앉기 검사를 대체하지 않습니다. 해당 검수는 아바타 렌더 통합 단계에서 수행합니다.

## 매트 수정판의 대표 검수와 생성 지시

실제 착용 전신과 사용자 참고를 대조한 결과, 최초 원화는 잔머리결·검은 그림자·여러 작은 광택이 강한 반실사 화풍이었습니다. 얼굴이 넓은 머리 사이에서 작게 보이고 눈의 홍채 표현도 복잡하여, 머리 원화 자체를 다시 생성했습니다. 원본 이미지를 픽셀 편집하거나 보정 필터로 바꾸지 않았습니다.

먼저 단발 대표 머리 하나를 `image_gen.imagegen`으로 생성했습니다. 대표 원본은 `/workspace/generated_images/exec-48d5781e-7b48-4711-b12d-fc31c73650e1.png`입니다. 대표 제작 지시는 “clean thin warm brown outlines, matte large rounded hair clumps in two or three broad clear tones; remove realistic individual strands, small specular flecks and metallic gradients; wider round peach face, approximately 65 percent of central hair-cap width; big tall oval eyes with simple teal/brown iris tones and one small white catchlight; soft blush, tiny sweet mouth; front-facing complete bob head with tiny bare neck only, generous transparent margins”입니다.

대표 원화를 실제 애플리케이션의 세일러 상의·별치마·구두 SVG와 합친 전후 화면 `/workspace/quiz-cloud/sd-matte-representative-worn.png`를 직접 확인한 뒤, 같은 대표를 남녀 12종 시트의 첫 로컬 참조로 삼았습니다. 두 번째 참조는 최초 각 시트이며, 헤어 종류와 순서만 참고하고 이전 광택을 계승하지 않도록 지정했습니다. 확장 지시는 “exactly twelve isolated complete heads in four columns by three rows; same final representative style and face identity; muted chestnut brown hair, warm peach skin, large simple oval eyes; no permanent hats or accessories; no clothing/body; broad matte color planes rather than fine strand texture; consistent eye/jaw alignment”입니다.

확장 시안에서 긴 머리가 일부 셀을 넘었으므로, 원화 도구로 모든 머리를 셀 안에서 30% 작게 배치하는 여백 수정 시안을 생성했습니다. 최종 불투명 실루엣 24개 모두 셀 내부에 들어오며 상하·좌우 이웃 머리와 겹치지 않습니다. 실제 생성 결과의 눈·턱 위치는 여전히 행마다 다르므로 새 `sd-heads.json` version 2의 좌표를 사용해야 합니다.

눈 위치는 좌·우 홍채 영역의 청록 픽셀을 합쳐 구했습니다. 한쪽 홍채가 여러 작은 연결 성분으로 나뉘는 경우에도 같은 눈의 조각을 모두 포함합니다. 턱 위치는 눈 아래 피부 너비가 목으로 줄어드는 경계와 윤곽선, 목 밑 피부의 끝을 함께 사용했습니다. 눈꺼풀 표시 영역은 홍채 경계에서 왼쪽 7px·위쪽 9px·오른쪽 7px·아래쪽 3px 확장한 힌트이며, 실제 깜박임에서 속눈썹·눈썹·머리 겹침을 검수해야 합니다.

큰 머리 다발과 단순한 홍채, 넓은 얼굴은 이전 시안보다 참고에 가까워졌습니다. 헤어별 세부 실루엣과 앞을 향한 표정, 의상의 강한 색과 재질은 참고 원본과 여전히 다를 수 있습니다. 생성 원화 교체만으로 모든 착용 조합과 움직임이 참고 수준에 도달했다고 보고하지 않습니다.
