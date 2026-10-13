# 첫 마을 정비 작업장 — 3D Jutsu 제작 원본

새 [3D Jutsu 프로젝트](https://higgsfield.ai/3d-jutsu/b579a3b5-2650-4328-b4ec-b38c60aec6e3)에서 제작했다. 앞서 취소된 작업장 시안을 복구하지 않았다. 현재 확정 원본은 revision 4이며, 제작 과정에서 의미별로 나눈 562개 부품을 계속 수정할 수 있다.

## 재현 순서

1. `/3d-jutsu`와 scene-building, composition-modeling, lookdev-lighting 참고를 읽고 새 프로젝트 또는 지정 프로젝트를 조회한다.
2. `get_project`와 `query_python`으로 실제 상태와 revision/sceneSequence를 확인한다.
3. `01_blockout.py`를 `run_python`으로 실행한다. 카메라·조명과 빈 공간이 있는 골조를 만들고 실제 GLB의 정면·옆면을 검수했다.
4. 새 상태를 조회한 뒤 `02_refine.py`로 상세를 추가한다. `03_visual_corrections.py`는 실제 검수에서 보인 지붕 타일 가림과 평평한 오른쪽 벽을 고친다.
5. 새 상태를 조회한 뒤 `04_contact_colors.py`로 불꽃과 정적 접촉 음영을 추가한다. 수정마다 정확한 상태 가드를 전달하며, 진행 중인 수정은 완료를 확인한다.
6. 최종 revision의 GLB를 `get_glb`로 받아 `05_export_runtime.py`로 게임용 부품만 묶는다. 작업용 바닥·카메라·조명은 포함하지 않는다. 원격 내보내기가 중립색 `COLOR_0`와 실제 접촉 음영 `COLOR_1`을 함께 만들므로, 이 단계에서 실제 음영을 게임이 읽는 `COLOR_0`로 옮기고 값이 모두 흰색으로 사라지지 않았는지도 검사한다.
7. 실제 게임의 기본 카메라·접근 동선과 동일 화질 성능을 확인한다. 마지막 검수 경계에서 정확한 최종 revision을 `show_scene`으로 한 번 보여준다.

```sh
blender -b --python 시즌2/tools/workshop-jutsu/05_export_runtime.py -- downloaded-hosted.glb 시즌2/assets/workshop.glb
node 시즌2/tools/import-workshop-glb.mjs
```

위 Blender 명령은 원격 제작을 대신하지 않는 **내보낸 모델의 정적 묶음 처리**다. 파일별 Python을 일반 Python 인터프리터로 실행할 수 없으며, 01~04는 Blender `bpy`가 제공되는 3D Jutsu에서 실행한다. 매 단계 코드는 현재 기록된 앞 단계가 존재하는 것을 전제로 하므로 같은 수정 단계의 무분별한 재실행은 부품 중복을 만들 수 있다.

## 게임 자산 규격

- 게임 좌표 +Y 위, +Z 정면. 바닥 0m, 높이 8.723m, 평면 반경 5.468m.
- 삼각형 25,336개, 불투명 공용 재질 8개. 천은 실제 두께가 있어 양면 렌더링을 요구하지 않는다.
- 외부 텍스처·애니메이션·동적 조명 없음. 게임 GLB의 `COLOR_0`는 선형 재질 색에 곱하는 중립색 접촉 음영이며 실제 범위는 약 0.462~1.0이다.
- 게임 가져오기 과정은 기존 정적 묶음의 색·태양 방향 음영과 합친다. 이 모델을 562회 개별 그리는 방식으로 게임에 넣지 않는다.
- GLB의 바이트·SHA-256·원본 revision·치수·검수 한계는 [자산 명세](../../assets/workshop.manifest.json)에 기록한다.

원격 EEVEE 렌더는 생성·조회까지 성공했으나 도구가 이미지 대신 다운로드 URL만 반환해 에이전트가 원격 렌더 자체를 열어 보는 검수는 하지 못했다. 원격 이미지를 우회 다운로드하지 않았고, 정확한 revision에서 내려받은 GLB를 로컬에서 렌더링해 정면·옆면을 직접 확인했다. 최종 게임 화면·노트북 성능 판단은 별도 통합 검수 결과를 따른다.
