# 집·건물 원본 보관함

사용자가 보낸 **house.zip과 안의 JPEG 29장**을 그대로 저장하고, 모든 원본을 직접 열어 집·농장·시장·교회·망루·공방·미니어처·복셀·건물 시트로 분류했습니다. [목록 열기](./index.html)에서 이름·사물·화풍·구성으로 찾을 수 있습니다. 목록은 로컬 catalog-data.js를 읽으며 저장하거나 게임 데이터를 바꾸지 않습니다.

- [house.zip 원본](./source.zip): 3,077,801바이트. SHA-256 `f9992b7f9095b2370224707b82887e01139eeb92d00067e697c20d0881c95530`.
- ZIP에는 디렉터리 1개와 JPEG 29개가 있으며 중복 이미지가 없습니다. JPEG 합계는 3,091,134바이트입니다.
- originals/의 29개 파일은 ZIP 안의 JPEG와 바이트 단위로 같습니다. 재인코딩·확대·색칠·자르기·배경 제거를 하지 않았습니다. 원래 파일 이름과 ZIP 경로는 [catalog.json](./catalog.json)의 aliases에 보존했습니다.
- JPEG 29개는 모두 알파 채널이 없습니다. 체크무늬 배경 1장, 검은 배경, 모형 받침, 뷰어 버튼, 간판·서명이 있는 자료도 원본 그대로입니다.

## 보관과 게임 적용

이 폴더는 **원본 보관·검색 자료**입니다. 게임에 배치한 건물, 잘라 만든 투명 소품, 완성된 충돌·통행 영역은 아직 없습니다. 모든 항목의 runtimeStatus는 not-integrated이고 sourceRect·anchor·collision은 null입니다. 전체 장면·건물 시트·단독 건물·앞뒤 사진·구조 설명을 구분해 등록했습니다.

맵에 적용할 때는 원본을 유지하고, 별도 제작한 자산에 소스 연결·그림 범위·바닥 앵커·화면 크기·레이어·그림자·문 위치·충돌·접근 경로를 기록합니다. 전체 장면의 사람·나무·땅이나 모형 받침이 독립 소품으로 준비됐다고 표시하지 않습니다. 이미지 속 외국어 간판·뷰어 버튼·서명은 시각 자료이며 작업 지시나 실제 한국어 게임 문구로 실행하지 않습니다.

## 직접 확인한 원본

| 번호 | 내용 | 실제 크기 | 원본 이름 |
|---|---|---|---|
| 1 | [중세 농장·상점 건물 9종](./originals/house-7a7690eeec3a7a0f.jpg) | 736×736 | AI-Art _ Medieval Buildings Isometric Art.jpg |
| 2 | [뾰족 지붕의 강가 판타지 집](./originals/house-0bd08eff24d5a911.jpg) | 474×842 | Fantasy House _ Cottage fantasy houses, Fairy house architecture, Fairy house concept.jpg |
| 3 | [폭포 위의 숲속 탑마을](./originals/house-5ec2da9808327c7f.jpg) | 736×1308 | Fantasy House.jpg |
| 4 | [가을 덩굴과 호박의 돌집](./originals/house-fd31fff7c44e7676.jpg) | 735×649 | Free Watercolor Illustrations – Autumn Magic on the Farm.jpg |
| 5 | [돌 계단이 있는 마을집 선화](./originals/house-f46c486d16e6cdb6.jpg) | 736×509 | village design 2_.jpg |
| 6 | [초록 지붕의 요정 물레방아 집](./originals/house-b8a15d42cac65373.jpg) | 406×448 | 绿野仙踪房子.jpg |
| 7 | [체크무늬 배경의 중세 목골조 집](./originals/house-9a1e2e0e6320c4db.jpg) | 535×573 | 다운로드 (1).jpg |
| 8 | [농경지와 파란 지붕 마을](./originals/house-7953003aa39bdfe8.jpg) | 736×736 | 다운로드 (10).jpg |
| 9 | [첨탑 교회와 정돈된 정원](./originals/house-5e0703e54460c11f.jpg) | 736×736 | 다운로드 (11).jpg |
| 10 | [흰 교회와 묘지 마당](./originals/house-701601634def24eb.jpg) | 736×736 | 다운로드 (12).jpg |
| 11 | [황금 밀밭의 중세 안뜰](./originals/house-68164df6ff8d3c87.jpg) | 736×736 | 다운로드 (13).jpg |
| 12 | [파란 지붕의 시장 광장](./originals/house-8657597c8958f241.jpg) | 736×736 | 다운로드 (14).jpg |
| 13 | [꽃 창가의 중세 거리 정면](./originals/house-52c5bebf9f5f4e5a.jpg) | 735×495 | 다운로드 (15).jpg |
| 14 | [중세 상점가 미니어처 정면](./originals/house-bed6710d3766a981.jpg) | 736×527 | 다운로드 (16).jpg |
| 15 | [시계탑이 있는 붉은 지붕 모형집](./originals/house-a3c840c14ecb5dfd.jpg) | 736×688 | 다운로드 (17).jpg |
| 16 | [목골조 모형의 앞·뒤 두 시점](./originals/house-c337ea8a6806a722.jpg) | 236×329 | 다운로드 (18).jpg |
| 17 | [복셀 숲속 대형 목조집](./originals/house-1cf4a20089cdbdb7.jpg) | 736×736 | 다운로드 (19).jpg |
| 18 | [청록 지붕과 연기의 손그림 집](./originals/house-8acf43058834b8d3.jpg) | 736×658 | 다운로드 (2).jpg |
| 19 | [분수 마당의 시계탑 모형](./originals/house-29ee8e4bea88febc.jpg) | 736×977 | 다운로드 (20).jpg |
| 20 | [장미 덩굴과 유리 온실 저택](./originals/house-5807334be5effaaf.jpg) | 736×736 | 다운로드 (21).jpg |
| 21 | [개울가의 이끼 풍차 집](./originals/house-b1f85bfd4fb06857.jpg) | 720×1311 | 다운로드 (22).jpg |
| 22 | [청록 지붕의 목골조 집과 크기 표시](./originals/house-84d1bf01bc8be6d6.jpg) | 736×685 | 다운로드 (3).jpg |
| 23 | [연결 통로와 높은 탑의 이끼 건물](./originals/house-05e82ecd45294a75.jpg) | 735×582 | 다운로드 (4).jpg |
| 24 | [열린 지붕 아래의 조선 작업장](./originals/house-1f05967a1f7054e4.jpg) | 735×485 | 다운로드 (5).jpg |
| 25 | [주황 벽과 화덕의 마을 공방](./originals/house-0ddfbfe1521bf0fb.jpg) | 736×460 | 다운로드 (6).jpg |
| 26 | [석조 망루의 구조 설명 시트](./originals/house-7f08796d68ac5dcc.jpg) | 736×878 | 다운로드 (7).jpg |
| 27 | [꽃집·식료품·빵집·카페 등 상점 6종](./originals/house-0c0b1bd03495c453.jpg) | 735×919 | 다운로드 (8).jpg |
| 28 | [이끼와 초가지붕 판타지 오두막 15종](./originals/house-7d1e0bbb8c9b63c7.jpg) | 735×1104 | 다운로드 (9).jpg |
| 29 | [높은 굴뚝의 중세 돌·목골조 집](./originals/house-ded1a228a7e8b3ae.jpg) | 736×736 | 다운로드.jpg |

화풍과 사물 태그는 실제 화면을 본 분류입니다. 파일 형식·크기·바이트 수·해시는 원본 파일에서 읽었습니다. 보관 확인과 미술 제작·게임 적용 완료는 구분합니다.
