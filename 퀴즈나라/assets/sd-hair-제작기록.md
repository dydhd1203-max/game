# 머리 층 그림 제작 기록 (sd-hair-*, 3단계 H2)

`sd-hair-<성별>-<모양>.webp` 24장과 `sd-hair-data.js`는 생성물이다. 손으로 고치지 않고 아래 명령으로 다시 만든다(두 번 만들면 바이트까지 같음, 2026-10-17 확인).

```
node tools/hair/export-old-heads.cjs 검증/머리/옛머리     # 지금 학생 화면의 픽셀 판정 (약 30초)
node tools/hair/export-body-cover.cjs 검증/머리/옛머리    # 머리 뒤 몸(옷 없음, 서기)이 칠해진 자리 (약 30초, H4)
python3 -B tools/hair/build-heads.py build [--check 검증/머리/검사]   # 층 그림·자료 (약 2분, --check 포함 약 3분)
python3 -B tools/hair/build-heads.py debug f-bob-profile m-short-back   # 한 머리의 목 둘레 판정 6배 (원화 | 판정·지움·남김·구역·몸 가장자리 | 몸 위 결과)
python3 -B tools/hair/build-base-head.py   # 기준 민머리 sd-hair-base-<m|f>.webp·sd-hair-base.json·'m:base'·'f:base' (원화에서, 약 1분, H5)
python3 -B tools/hair/build-base-head.py --lash-test   # 속눈썹 원화 자리에 지금 원화를 넣어 받는 길 시험 (assets에 안 씀)
node tools/hair/make-hair-template.cjs --style base     # 게임이 그린 민머리 그림틀(그림틀과 같은 자리), 눈 둘레 다시 요청의 첫 그림
node tools/hair/board-heads.cjs            # 게임이 그린 민머리 280px 판·840px 목 이음·닫힌 구멍 (약 20초)
python3 -B tools/hair/build-hairstyle.py 원화 --sex f --shape 이름 --install   # 받은 새 머리 원화 → sd-hair-<sex>-<모양>.webp·sd-hair-sheet.json (H5)
python3 -B tools/hair/verify-hairstyle-pipeline.py   # 새 머리 파이프라인 시험 T1~T10 (약 10분, 저장소에 안 씀)
```

기준 민머리(`sd-hair-base-<m|f>.webp`, 'm:base'·'f:base')는 `assets/hair-template/sources/민머리-*.png` 원화에서 만든다. `build-heads.py build`는 `sd-hair-base.json`의 항목을 `sd-hair-data.js`에 다시 합친다(민머리를 지우지 않음). 체험 화면은 민머리 아틀라스를 미리 풀지 않는다(상점 머리가 아님, `e.base`). 탐침 `interior`·`paleRim`·`eyeCore`·`edgePaint`(층 사각형 둘레 칠)·`lashOutsideBlink`·`eyeOutsideBlink`(속눈썹 원화가 있을 때, 감은 눈 덮개 밖)가 한도를 넘으면 실패하고, `--negative translucent|halo|nolash|noborder|shortcover`(옛 방식)는 실패해야 한다. `sources/민머리-눈-<남자|여자>-*.png`가 있으면 앞·옆 눈 둘레의 속눈썹만 그 그림에서 가져온다. 규칙은 `아바타-제작기준.md` '기준 민머리(H5-1)'.

새 머리 모양(origin 'sheet', base '<sex>:base')은 받은 원화에서 `build-hairstyle.py --install`이 만든다: 기준 민머리 층에 머리카락 층을 얹은 아틀라스와 항목(`sd-hair-sheet.json`, `build-heads.py build`가 다시 합침). 머리 층은 다른 머리와 같은 염색 규칙(R=B=밝기, G=광택)이다. 규칙은 `아바타-제작기준.md` '새 머리 모양 파이프라인'.

## 무엇을 담았나

- 원본: `sd-heads-female.png`·`-male.png`(앞), `sd-heads-profile-*.png`(옆), `sd-heads-back-*.png`(뒤). 원본 파일은 바꾸지 않았고 sha256은 `sd-hair-data.js` `sources`에 있다.
- 출발점은 **지금 학생 화면의 판정**이다. `export-old-heads.cjs`가 검사용 브라우저 안에서만 `avatar-pixel.js`·`avatar-direction.js`의 내부 값을 읽어, 픽셀마다 머리카락(염색)·피부(피부색)·그대로 둠을 그대로 뽑는다. 이 판정으로 다시 칠하면 지금 그림과 평균 0.6~0.8단계 안으로 같다(크기 바꿈 차이).
- 그 위에 고친 것(`tools/hair/headlib.py refine`, 구역은 `tools/hair/heads-spec.json`):
  - 귀: 귀 구역 안에서 밝은 피부색은 피부로 되돌림(지금은 머리색으로 물들어 분홍 머리면 흰 귀가 됨). 귀 안쪽 주름 선은 피부, 귀 테두리는 그대로 둠.
  - 뒷모습 정수리: 귀·목덜미 밖의 '피부'는 밝은 머리 결이었으므로 머리카락으로(지금은 진한 피부면 갈색 얼룩).
  - 머리카락–얼굴 경계: 눈·입 밖에서 피부와 머리카락 사이에 끼어 '그대로 둠'이던 픽셀은 밝으면 피부, 중간이면 머리카락. 머리카락이 밝은 피부와 섞여 칠해진 경계 2px 띠는 픽셀마다 머리카락 몫과 피부 몫으로 나눔(`unmix`). 진한 피부·염색 머리에서 밝은 점선 테두리가 생기지 않는다.
  - 깎은 털(남 fade 앞·옆, undercut 앞): 분홍빛 회갈색(b/g 0.78~0.84 이상)을 피부와 짧은 털 몫으로 나눔. 뒷모습 fade는 지금처럼 피부로 둠(`skinZones`).
  - 옛 목 그루터기: 앞모습은 턱선 +0.35 아래의 피부·외곽선·머리 덩어리에 붙지 않은 조각을 지우고, 지금의 턱 아래 자르기는 목 기둥 폭 안에서만 둠(긴 머리는 목 옆에 남음). 옆모습은 남 short·여 bob의 손 경로 구역과 그 위 꼭짓점(귀 밑) 뒤쪽(귀 구역 밖)의 목 피부·테두리를 지움. 뒷모습은 위쪽은 지금 남 short 손 경로 폭, 아래 옛 목 고리 자리만 넓힌 구역(여자는 0.6 아래).
  - 몸과의 이음(H4): 머리 뒤 몸이 칠해진 자리(`body-<성별>-<보기>.png`)를 보고, 지우면 머리카락과 몸 사이에 둘러싸인 빈칸이 생기는 옛 목은 남긴다(귀 뒤, 뒤 목덜미 옆). 몸 밖에 남는 칠이 몸 가장자리에서 끝나면 두 반투명 가장자리와 몸 윤곽이 가는 선으로 보여, 몸 안쪽 2px까지 덮는다. 몸 위에서 지운 목 피부는 남는 피부 옆 3px에서 흐리게 끝낸다(턱 그늘이 곧은 선으로 잘리지 않게). 몸 밖의 옛 목 외곽선은 머리 다발 옆이어도 지운다(남자 옛 목이 몸 목보다 뒤로 두꺼워 머리끝에 매달려 보였음).
  - 옆얼굴 위치: 눈·코·턱이 기준 머리(여 bob, 남 short)와 맞도록 옮기는 값(`registration`)을 잰다(가장 큰 것: 여 braid 아래로 1.9, 여 long·pony·bun 뒤로 0.7~1.0, 여 hime 앞·위로 0.7, 남 slick·crop·undercut·fade 뒤로 0.4~0.7). **게임은 쓰지 않는다**(2026-10-17, 사용자 결정 전): 옮기면 목덜미 머리가 몸의 목에서 떨어진다. 귀 구역만 옮긴 얼굴 기준이고, 목 구역은 지금 자리 기준이다.
  - 옆모습 목: 옛 손 경로(여 bob·남 short) 모양의 구역에서 목 피부와 그 테두리(굵은 머리 다발 2px 안이 아닌 것)를 지운다. 지우기 전 판정으로 경계를 나누고, 지운 목 쪽 피부 몫은 버린다.
- 층(한 머리 모양의 앞·옆·뒤 층을 한 장에 담음, 각 층은 잘라서 원본 해상도로): `hair`(염색용 붓 밝기 L을 R·B 칸에, 광택 0.38 × max(0, L − 160)을 G 칸에: 게임은 색 행렬 하나로 색 × L / 102 + 광택), `skin`(몸과 같은 그림 색), `fixed`(눈·입·외곽선), `iris`(반짝·고양이 표정 눈동자), `blink-*`(깜빡임 덮개, 피부). 층들은 원본 픽셀을 나눈 것이라 **더해서(premultiplied 합) 그리면** 원래 그림이 된다.
- `faceTone`: 보기마다 얼굴의 밝은 피부색(표정 입 채우기에 같은 피부 필터로 씀).
- 피부: 머리 피부 밝은 부분은 몸 그림(목·팔) 피부와 같은 밝기끼리 비교해 1~7단계 차이를 한 번에 옮김(`skinShift`, 홍조·귀 주름은 그대로). 게임에서는 몸과 같은 `QPFoundationSkin.toneMatrix` 필터를 씌운다(H3).

## 검사 결과 (2026-10-17, H4 이음 규칙 뒤)

| 항목 | 결과 |
|---|---|
| 바뀌지 않은 픽셀의 재합성 차이(파란 바탕, 채널 최대) | 평균 0.40(최대 0.78), 99.5% 지점 최대 2.6 |
| 귀 물듦(귀 구역의 피부색이 염색됨) | 지금 21개 머리 4679px → 머리당 최대 11px(머리카락 끝 점) |
| 뒷모습 정수리 피부 | 지금 24개 머리 26306px → 0 |
| 옛 목 그루터기(피부·외곽선) | 지금 44개 머리 38681px → 0 |
| 몸이 못 덮는 둘러싸인 구멍(`hole`, H4) | 지금 판정(지금의 목 자르기 포함) 13개 머리 52px → 0. 이음 규칙 없이 만들면 27개 머리 517px(음성 대조, `--no-hole-guard`) |
| 얼굴 테두리 밝은 점선 | 지금 5개 머리가 한도 40px 넘음(합 839px) → 머리당 최대 37px |
| 크기 | 24장 합 4.1MB, 가장 큰 것 210KB(m:wolf), 가장 작은 것 144KB(f:bob), 자료 75KB |

검사는 `build-heads.py build`에 들어 있어 한도를 넘으면 실패한다(`PROBE_LIMITS`). 각 검사는 지금 판정에 돌려 결함을 실제로 잡는 것을 확인했다.

## 게임 연결 (H3, 2026-10-17)

- `avatar-foundation-head.js`가 체험 주소에서만 이 파일들을 불러와 새 아바타 머리로 그린다(학생 화면은 옛 그림). 층마다 아틀라스를 `<image>` 하나로 놓고 CSS `clip-path: inset()`으로 자른다(아바타 안에 다른 svg를 두지 않는다: 화면 CSS가 아바타 안의 svg를 모두 꾸민다).
- 배포 목록은 `tools/hair-files.cjs`(자료가 가리키는 파일 전부), `tools/check-source.cjs`가 아틀라스 sha256이 자료와 같은지 본다.
- 검사 결과와 남은 것은 `머리스타일-검수.md`.
