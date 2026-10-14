# 압축 마을 — 5개 생활 건물 3D Jutsu 원본

[새 비공개 프로젝트](https://higgsfield.ai/3d-jutsu/9874ebe5-dc9e-4c9c-b1dc-4ac21261971a)의 **revision 5**에서 제작했다. 기존 정비 작업장 프로젝트/GLB는 수정하지 않았다. 원본에는 재질·부위별로 편집할 수 있는 909개 메시, 확인용 카메라와 조명만 있다. 게임 파일에는 생활 건물 메시만 들어간다.

| 모델 | 실제 표현 | 삼각형 | 평면 반경 | 높이 |
|---|---|---:|---:|---:|
| wagon | 휜 천막·살대·끈, 열린 적재함, 바퀴살, 접이식 좌판·발판 | 22,588 | 4.206m | 4.765m |
| market | 겹친 청록/황토 차양, 두꺼운 천 가장자리, 바구니·토기·걸린 조리도구 | 21,222 | 4.107m | 3.957m |
| assembly | 낮은 돌 화로와 장작, 등받이 벤치, 기와 게시판과 매단 등 | 10,736 | 3.587m | 3.656m |
| smithYard | 겹친 둥근 기와, 보와 사선 버팀, 실제 공구 벽·모루·정비대 | 12,548 | 3.144m | 3.888m |
| supplyYard | 곡면 천막, 열린 3단 선반, 묶은 자루·통·바구니 | 17,312 | 2.871m | 3.632m |

총 **84,406개 삼각형**, 재질 역할 **8개**를 공유한다. 실제 천 두께를 모델링하여 양면 렌더링이 필요하지 않다. 외부 텍스처·애니메이션·동적 조명은 없다. 게임 앞면은 `+Z`, 위는 `+Y`, 각 모델 원점은 바닥 중심이다. 수레 바퀴의 접지는 반경 오차를 포함해 최저 -0.015m다. 게임 배치 회전은 통합 코드에서 적용하며 GLB에 미리 굽지 않는다.

## 재현과 검수

1. `/3d-jutsu`와 scene-building/composition-modeling/lookdev-lighting 지침을 읽고 `get_project`/`query_python`으로 실제 상태를 확인한다.
2. `00_helpers.py`와 `01_blockout.py`를 합쳐 첫 원격 수정으로 실행한다. 미리보기 격자 배치는 게임 맵 배치가 아니다. 작업 카메라·기본 조명을 처음부터 함께 둔다.
3. 실제 revision 1 GLB의 정면과 직교 옆면을 열어 실루엣·깊이·치수를 검사한다. 지붕과 기둥의 지지 틈은 다음 단계에서 보완했다.
4. `00_helpers.py` + `02_refine.py`로 상세를 추가한다. 실제 revision 2 GLB를 정면/수레 근접으로 검사했다. 전체 86,602개 삼각형에서 매우 작은 통 이음새와 바구니 과일 일부만 정리하여 상한을 지켰다.
5. `00_helpers.py` + `03_contact_colors.py`로 접촉 음영을 굽는다. 정면 근접에서 발견한 수레 바퀴 못의 접촉 틈과 간판 지지 누락을 `04_visual_corrections.py`에서 고친 뒤 `03_contact_colors.py`를 다시 실행했다. 이어 5개 모두의 최종 근접 사진에서 확인한 보급소 간판·등걸이 지지는 `05_final_hangers.py`로 보완하고 접촉 음영을 다시 구웠다. 최종 원본이 revision 5다.
6. 최종 원격 GLB를 받고 `05_export_runtime.py`로 모델별 원점을 복원하고 재질별 정적 묶음으로 내보낸다. 편집용 부품 구조는 원격 원본에서 유지한다. 원격 `COLOR_1`의 실제 음영을 게임이 읽는 `COLOR_0`로 옮기며 흰색이 아닌 음영·단위 법선·치수·삼각형·불투명 여부를 검사한다.
7. 최종 게임 GLB 다섯 개를 다시 Blender에 읽어 들인 [전체 모습](../../검수/s2-008/village-assets/front.png)과 각각의 근접 사진을 확인했다. 실제 기본 플레이 시점·21명 성능은 별도 게임 통합 검수에서 확인한다.

```sh
blender -b --python 시즌2/tools/village-jutsu/05_export_runtime.py -- downloaded-revision5.glb 시즌2/assets 5
node 시즌2/tools/import-village-glb.mjs
blender -b --python 시즌2/tools/village-jutsu/04_render_local_glb.py -- 시즌2/assets /tmp/village-front.png front
```

`00`~`05_final_hangers.py` 중 제작 단계 파일은 원격 제작 소스다. `05_export_runtime.py`는 다운받은 정확한 원격 모델의 정적 묶음 처리이며, 원격 제작을 로컬 제작으로 대체하지 않는다. `04_render_local_glb.py`는 원본/게임 GLB를 읽기만 하는 검사 렌더다. 동일 수정 단계를 중복 실행하면 부품이 중복될 수 있으므로 원격 가드와 단계 순서를 지킨다.

원격 EEVEE 렌더는 `village-05-final-camera-check` 작업의 `302918d87d388cdddd35c0bdfdc723d5` 이미지로 생성·조회했다. 연결 도구는 이미지 대신 서명 URL만 반환하므로 원격 렌더 자체의 픽셀 검수는 하지 않았다. 원격 이미지를 우회 다운로드하지 않았고, 내려받은 정확한 모델 파일의 로컬 렌더를 열어 검수했다. 이 모델 렌더는 게임의 기본 카메라나 노트북 FPS 검사를 대신하지 않는다.

[자산 명세](../../assets/village-buildings.manifest.json)에 원본 revision, 작업 ID, 해시와 파일별 상세 수치를 남겼다. 유료 AI 이미지·비디오 생성은 사용하지 않았다.
