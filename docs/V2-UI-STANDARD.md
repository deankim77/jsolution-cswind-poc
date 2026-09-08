# J SOLUTION AI PMS V2 UI 표준

이 문서는 V2 화면의 고정 개발 기준이다. 화면별 임의 스타일보다 이 문서와 `app/ui-standard-tokens.css`가 우선한다.

> **필수 선행 확인:** V2 소스를 조회·분석·수정하기 전에 이 문서를 가장 먼저 끝까지 읽는다. 같은 역할의 UI는 기존 Foundation 컴포넌트와 토큰을 재사용하며, 화면별 새 규칙을 만들지 않는다.

## 1. 레이아웃 기준

| 영역 | 기준 |
| --- | ---: |
| 글로벌 레일 | 62px |
| 프로젝트 컨텍스트 탐색 | 228px |
| 상단 바 | 60px |
| 중앙 작업 탭 | 38px |
| 우측 패널 기본 | 560px |
| 우측 패널 확장 | 760px |

- 중앙 작업영역은 목록, WBS, 문서 미리보기, PART·BOM, 원가관리 등 주 업무를 처리한다.
- 우측 패널은 필터, 상세, 실적, 산출물, 이슈, 이력, 다중 문맥 AI 대화를 처리한다.
- **우측 공통 패널은 최초 오픈 시 확장폭(`--v2-right-panel-wide-width`)으로 연다. 사용자가 필요할 때 축소 버튼으로 기본폭(`--v2-right-panel-width`)으로 줄일 수 있다.**
- 패널을 닫은 뒤 다른 업무/문서/필터/AI 문맥에서 새로 여는 경우에도 최초 상태는 확장폭을 기본으로 한다.
- 우측 패널에서 시작한 AI 대화는 `MY AI HOME · AI LIBRARY`에서 같은 conversation ID로 이어진다.
- 우측 패널 폭은 반드시 `--v2-right-panel-width`, `--v2-right-panel-wide-width` 토큰을 사용한다.
- 우측 패널 확장/축소는 `PanelRightOpen` / `PanelRightClose` 계열 아이콘만 사용하며 닫기(X) 바로 왼쪽에 둔다.

## 2. 타이포그래피

- 기본 폰트 스택: `Pretendard`, `Noto Sans KR`, `Inter`, `Arial`, sans-serif.
- 화면별로 별도 폰트 패밀리를 선언하지 않는다.
- 중앙 화면 제목 22px, 주요 섹션 제목 18px, 카드 핵심 제목·우측 패널 제목 16px을 사용한다.
- 테이블 본문·탭·검색·버튼·입력값은 14px, 테이블 헤더는 13px을 사용한다.
- 보조정보·상태·설명·배지·Kicker는 12px을 사용하며, V2 일반 텍스트의 최소 크기는 12px이다.
- 일반 아이콘은 18px, 주요 기능 아이콘은 20px을 사용한다.
- `12px` 미만의 신규 `font-size`를 금지한다. 단, 간트 막대 내부 진행률 숫자만 `--v2-font-size-gantt-progress: 10px`를 사용한다.
- 좁은 화면은 폰트를 줄이지 않고 열 너비, 말줄임, 줄바꿈, 가로 스크롤로 처리한다.
- WBS 헤더 34px, WBS 행 44px, 검색·아이콘 버튼 34px, 중앙 View Tab 38px, 액션 버튼 30–34px 범위를 유지한다.
- 모든 화면은 `app/ui-standard-tokens.css`의 `--v2-*` 토큰을 사용하며 화면별 숫자 직접 지정을 추가하지 않는다.
- 예외가 필요하면 사용자 확인 후 이 문서와 토큰을 함께 변경한다.

## 3. Surface / Background 기준

V2 중앙 Workspace는 화면마다 다른 흰색·회색 배경을 임의로 사용하지 않는다.

| 역할 | Token | 용도 |
| --- | --- | --- |
| Workspace Background | `--v2-surface-workspace` | 중앙 화면 전체 바탕 |
| Content Surface | `--v2-surface-content` | 카드, 폼, 실제 테이블 본문 |
| Subtle Surface | `--v2-surface-subtle` | 보조 영역, 약한 hover/구분 영역 |
| Table Header Surface | `--v2-surface-table-header` | 목록·테이블 컬럼 헤더 |

- 화면 shell에 `background:#...` 값을 직접 추가하지 않는다.
- 테이블/목록 헤더 색상은 `--v2-surface-table-header`로 통일한다.
- 신규 surface가 필요하면 화면 CSS에 임의 색을 추가하지 않고 Foundation token을 먼저 정의한다.

## 4. 중앙 View Tab 기준

중앙 Workspace 내부의 View 전환 탭은 기능 수와 모듈에 관계없이 동일한 active 표현을 사용한다.

- 높이: `--v2-tab-height`.
- 기본 상태: 배경 없음, muted text/icon.
- 활성 상태: teal text/icon + 하단 `--v2-tab-active-border-width` line.
- 활성 탭에 리본형 배경, 사각 채움, 별도 연한 초록 배경을 사용하지 않는다.
- 탭 컨테이너 자체도 리본형 흰색 박스로 감싸지 않는다.
- 탭 수가 많으면 글씨를 줄이지 않고 horizontal scroll을 사용한다.
- 2개짜리 PART·BOM 탭, 3개짜리 원가관리 탭, WBS View 탭, 문서 라이브러리 탭 모두 같은 visual rule을 사용한다.
- 시스템 설정처럼 관리 섹션 성격이 다른 경우에도 active 표현 원칙은 동일하게 유지하고, 별도 variant가 필요하면 Foundation에 명시적으로 추가한다.

## 5. 컴포넌트와 동작

- 기존 V2 컴포넌트와 `work-view-v2.css` 패턴을 먼저 재사용한다.
- 동일 역할의 버튼, 입력창, 탭, 상태 배지는 화면마다 높이·폰트·색을 다르게 만들지 않는다.
- 신규 화면에 불필요한 `!important`를 사용하지 않는다.
- 중앙 문서 미리보기는 탭으로 열며 PDF, 이미지, DOCX/PPTX/XLSX, 텍스트 포맷을 지원한다.
- WBS 소요일은 회사 업무 캘린더의 근무 요일과 휴무일을 적용하고 선행 업무 후속 일정을 자동 이동한다.

### 5.1 검색·필터 도구 모음 고정 순서

- 모든 목록·업무 화면의 조회 도구는 왼쪽부터 `검색창 → 상세 필터 → 빠른 필터/범위 선택 → 정렬·표시 옵션` 순서로 배치한다.
- 상세 필터 버튼은 검색창 바로 오른쪽에 붙여 두며 행 가운데나 단독 행에 배치하지 않는다.
- 결과 건수는 같은 행의 가장 오른쪽에 배치한다.
- 상세 필터 버튼을 누르면 별도 팝업이나 별도 오버레이가 아니라 기존 우측 공통 패널에서 연다.
- 활성 조건 수는 상세 필터 버튼의 배지로 표시한다.
- 우측 패널에서 조건을 고르는 동안에는 패널 상단의 예상 결과 건수만 갱신하고 중앙 Workspace는 변경하지 않는다.
- `필터 적용`을 누르면 중앙 Workspace를 갱신하고, 패널 닫기·취소 시에는 적용 전 조건을 유지한다.
- `초기화`는 패널의 임시 조건을 비우며, 초기화 결과도 `필터 적용` 후 중앙 Workspace에 반영한다.
- 화면 폭이 좁아 줄바꿈되더라도 검색창과 상세 필터는 하나의 조회 그룹으로 먼저 유지한다.

## 6. 자동 강제 규칙

- V2 UI 변경 후 반드시 `npm run check:v2-ui`를 실행한다.
- 검사기는 Foundation token 존재 여부와 변경된 V2 파일의 신규 위반을 검사한다.
- 변경한 V2 TSX에서 18px 미만 일반 아이콘을 신규 사용하지 않는다.
- 변경한 V2 CSS에서 12px 미만 일반 텍스트를 신규 사용하지 않는다.
- 중앙 tab active에 채움 배경을 신규 추가하지 않는다.
- shell/background, 우측 패널 폭 같은 Foundation 값은 raw 숫자/색상 대신 token을 사용한다.
- 기존 기술부채는 한 번에 전체 리팩터링하지 않되, 해당 파일을 수정할 때 Foundation 기준으로 함께 정리한다.

## 7. AI 변경 금지 기준

- 기존 V1 AI 응답 프롬프트 명령과 거버넌스 설정을 수정하지 않는다.
- V2 기능은 기존 `/api/ai/chat` 계약을 사용하고 문맥 선택·대화 저장·재개 UI만 확장한다.
- 다중 문맥에는 프로젝트, WBS, 문서·산출물, 이슈를 함께 선택할 수 있어야 한다.

## 8. 개발 완료 체크리스트

- 신규 UI가 공통 폰트·레이아웃·surface·tab 토큰을 사용하는지 확인한다.
- 간트 막대 내부 진행률 외의 V2 일반 텍스트에 12px 미만 값이 남아 있거나 새로 추가되지 않았는지 확인한다.
- 중앙 View Tab active가 `teal + underline`인지 확인한다.
- Workspace 배경과 테이블 헤더가 Foundation surface token을 사용하는지 확인한다.
- 우측 패널 아이콘·폭·헤더 위치가 Foundation 규칙과 동일한지 확인한다.
- 우측 공통 패널이 최초 오픈 시 확장폭으로 열리고 축소/재확장이 가능한지 확인한다.
- `npm run check:v2-ui`를 실행해 검사를 통과시킨다.
- 검색창 바로 오른쪽에 상세 필터가 있고 결과 건수가 행 오른쪽에 있는지 확인한다.
- 빈 상태, 로딩, 오류, 저장 완료 상태를 모두 제공한다.
- POC 자동 시드나 화면 전용 임시 데이터가 추가되지 않았는지 확인한다.
- WBS 캘린더, 우측 AI, 중앙 미리보기, 시스템 설정의 실제 저장 API 연결을 확인한다.


### Right Panel Initial State
- Right panels that support 2-step width MUST open in the expanded state (`--v2-right-panel-wide-width`).
- Users MAY collapse the panel to the normal width (`--v2-right-panel-width`) with the standard `PanelRightOpen` / `PanelRightClose` toggle.
- Reopening or resetting the shared right panel MUST restore the expanded default.
