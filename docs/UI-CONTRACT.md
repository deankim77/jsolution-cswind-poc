# J SOLUTION AI PLM UI Contract

> Status: **LOCKED**
>
> 이 문서는 AI PLM V2의 공식 UI/UX 계약이다. 기능 개발, DB 전환, 리팩터링 과정에서 화면 구조와 공통 UI 규칙을 임의 변경하지 않는다. 변경이 필요하면 제품 책임자의 명시적 승인 후 이 문서를 먼저 수정한다.

## 1. 적용 우선순위

UI 작업은 다음 순서로 규칙을 확인한다.

1. `docs/UI-CONTRACT.md`
2. `docs/V2-UI-STANDARD.md`
3. `docs/COMMON-COMPONENT-RULES.md`
4. `app/ui-standard-tokens.css`
5. `app/v2/v2-ui-foundation-enforcement.css`

상위 규칙과 하위 규칙이 충돌하면 상위 규칙을 따른다.

## 2. 공통 레이아웃 절대 규칙

- 기존 V2 전체 레이아웃의 구조를 임의 변경하지 않는다.
- 중앙 Workspace와 우측 공통 Panel의 역할을 유지한다.
- 공통 Header/Tab/Filter/Toolbar/Panel 패턴을 화면별로 독자 구현하지 않는다.
- 동일 기능은 동일 컴포넌트, 아이콘, 높이, 간격, 상태 표현을 사용한다.
- 기능 추가 때문에 전체 UI 구조를 재배치하지 않는다.
- 좁은 공간 문제는 폰트 축소보다 열 너비, 말줄임, 줄바꿈, 스크롤, Panel 확장으로 해결한다.

## 3. 중앙 Workspace 규칙

- 중앙 View Tab의 active 상태는 teal text/icon + 하단 2px line으로 고정한다.
- active tab에 채움색/리본형 배경을 사용하지 않는다.
- Workspace 배경은 공통 surface token을 사용한다.
- 카드/폼/테이블 본문과 표/목록 Header는 지정된 surface token을 사용한다.
- Project/WBS/My Work/Document/Issue/Workflow/BOM/Cost/System 화면도 동일한 Foundation을 재사용한다.

## 4. 우측 Panel 규칙

- 기본 폭은 `--v2-right-panel-width`를 사용한다.
- 확장 폭은 `--v2-right-panel-wide-width`를 사용한다.
- 화면 CSS에 560px/760px를 직접 기입하지 않는다.
- 확장/축소는 PanelRightOpen / PanelRightClose 계열을 사용한다.
- 확장/축소 버튼은 닫기(X) 바로 왼쪽에 둔다.
- 우측 Panel에서 공간이 부족한 복잡한 등록/편집 기능은 중앙 Workspace 전환을 우선 검토한다.

## 5. 타이포그래피 절대 규칙

기본 규칙:

- 중앙 화면 제목: 22px token
- 주요 Section 제목: 18px token
- Card 핵심 제목 / 우측 Panel 제목: 16px token
- Table body / Tab / Search / Button / Input: 14px token
- Table header: 13px token
- 보조정보 / 상태 / 설명 / Badge / Kicker: 12px token
- 일반 Icon: 18px token
- 주요 기능 Icon: 20px token

신규 `font-size`는 숫자를 직접 쓰기보다 `app/ui-standard-tokens.css`의 `--v2-*` token을 사용한다.

12px 미만 신규 font-size는 금지한다. 기존 승인 예외인 Gantt 진행률 전용 token만 허용한다.

## 6. 색상/간격/아이콘 규칙

- 화면별 임의 색상 추가를 금지한다.
- 공통 token이 있는 spacing/surface/color/font-size는 token을 우선 사용한다.
- 동일 동작에 서로 다른 icon을 임의 적용하지 않는다.
- 같은 상태를 화면마다 다른 색/Badge 패턴으로 표현하지 않는다.

## 7. React UI 구현 규칙

- React가 소유한 DOM을 직접 생성/삭제/교체하는 방식으로 기능을 구현하지 않는다.
- 신규 MutationObserver + querySelector + DOM mutation 기반 bridge/enhancer/fix를 금지한다.
- 다른 컴포넌트의 DOM을 찾아 click을 발생시켜 업무 흐름을 우회하지 않는다.
- state/props/context/callback/action을 사용한다.
- Browser API가 필요한 제한된 경우에는 ref를 우선한다.

## 8. 공통 컴포넌트 우선

신규 UI를 만들 때 순서는 다음과 같다.

1. 기존 공통 컴포넌트 재사용 가능 여부 확인
2. 기존 Foundation 패턴 확장 가능 여부 확인
3. 공통화 가치가 있을 경우 공통 컴포넌트 추가
4. 화면 단독 구현은 최후 수단

같은 버튼, 필터, 탭, Panel, Table interaction을 화면별로 복제하지 않는다.

## 9. UI 변경 승인 절차

다음 항목은 제품 책임자의 명시적 승인 없이 변경하지 않는다.

- 전체 레이아웃
- 중앙/우측 Panel 구조
- 우측 Panel 폭 체계
- View Tab active 패턴
- 공통 Typography scale
- 공통 Color/Surface token
- 공통 Button/Filter/Tab 규격
- 공통 Panel header action 위치
- 공통 React 구현 원칙

승인된 경우 다음 순서를 따른다.

1. `docs/UI-CONTRACT.md` 수정
2. `docs/V2-UI-STANDARD.md` 및 token 수정
3. 자동 검사 수정
4. 실제 화면 수정

## 10. 자동 강제

`npm run check:v2-ui`는 UI Foundation과 token 규칙을 검사한다.

`npm run check:architecture`는 UI에서 DB/Drizzle/D1에 직접 접근하는 구조를 검사한다.

`npm run build`와 `npm run lint`는 두 검사를 모두 통과해야 한다.

UI 변경 작업 완료 조건은 최소 다음과 같다.

```text
npm run check:architecture
npm run check:v2-ui
npm run audit:react-dom
```

위 검사에서 실패한 상태는 완료로 간주하지 않는다.

## CS WIND 생산 분석 패널 — 2026-09-10 사용자 승인
- 고객 문서 목록에서 기존 공통 우측 패널을 사용한다. 별도 중앙 분석 화면은 제거한다.
- 생산 분석에만 `--v2-review-panel-width: 50vw`, `--v2-review-panel-wide-width: 70vw`를 적용하며 최초에는 기본 50%로 연다. WBS/실적/필터의 560/760px 체계와 최초 확장 상태는 유지한다.
- 공통 헤더·확장 버튼·탭을 재사용한다. 분석 요약/PBOM/TRR/생산 준비/작업 정보/기존 AI 대화를 제공한다.
- 고객 원본 및 분석 목록은 공통 WBS 행 44px·헤더 34px 토큰을 사용한다. 불필요한 안내 행을 추가하지 않는다.

### CS WIND PBOM — 2026-09-10 사용자 승인
- PBOM은 내부 품번을 첫 열로 두고 고객 필수 컬럼을 갖춘 공통 계층 테이블로 표시한다. 목록 행 높이는 기존 WBS 토큰을 따른다.
- 분석 패널은 선택 문서의 초안, 중앙 PBOM은 프로젝트의 확정 구조를 표시한다. 확정 전에는 PART를 생성하지 않는다.
- 프로젝트 TOP 아래 문서 ASSY를 직접 연결한다. TOP/ASSY/부품은 기존 회사 공통 채번 설정을 사용하며 BOM 위치와 품번을 분리한다.
- 구매품·공용품 추가는 기존 PART·BOM 편집기를 callback으로 연다.

- 생산 분석 패널의 공통 액션은 탭 아래 한 줄에 배치하고 아이콘·문구를 가로 정렬한다.
- 우측 PBOM은 내부 품번/구분·변경/품명 계층/Pos./고객 Item No./Drawing No./CompRev/Qty Per Unit/원본 Weight/원본 근거를 표시한다. 전체 필수 컬럼과 계산 결과는 중앙 PBOM에서 유지한다.

- 우측 PBOM의 출처 자료/근거 컬럼은 표시하지 않는다. 원본 식별은 패널 공통 헤더에서 제공하며 중앙 PBOM 출처 컬럼은 유지한다.
- 부품 수정은 공통 팝업 스타일을 사용한다. SAVE 성공 시 서버 초안을 갱신하고 팝업을 닫으며, 실패 시 입력을 유지하고 취소 시 변경을 버린다. 확정 반영은 별도 동작이다.

- 우측 PBOM은 문서 최상위 ASSY를 1레벨로 하여 품명 컬럼의 들여쓰기와 고정 펼침 아이콘 자리로 계층을 표시한다. 별도 레벨 컬럼 없이 1레벨까지/2레벨까지/모두 펼치기와 개별 ASSY 접기·펼치기를 제공한다.

- 분석 패널은 긴 확정 확인 목록 없이 상단에서 즉시 확정하고, 현재 문서·영역의 확정 취소 반영을 제공한다. 원본·초안·확정/취소 이력은 보존하며 다른 문서와 공유하거나 이후 수동 변경된 BOM은 덮어쓰지 않는다.

- 생산 분석의 4개 결과 탭은 상단 우측의 공통 검토 액션을 사용한다. 전체 검토 체크박스 → 선택 N개 확정 → 확정 취소 반영을 한 그룹으로 배치하며 확정은 기존 패널 저장 버튼의 primary 토큰을 재사용한다.

- 확정 취소는 문서명·영역·대상 건수를 표시하는 공통 확인 팝업에서 재확인한다. 활성 취소 버튼에는 기존 경고 계열에서 가져온 공통 황토색 토큰(--v2-color-warning, --v2-surface-warning, --v2-border-warning)을 사용하며 미확정 상태는 비활성으로 유지한다.

- BOM 편집기의 REUSE/CURRENT/REFERENCE 제목은 영문 라벨·제목의 같은 높이 2줄로 맞춘다. 중복 편집 안내는 제거하고 타인 잠금 정보는 상단에서 제공한다. 편집 도구는 글자 14px·아이콘 18px·버튼 34px 공통 토큰을 사용하며 CURRENT의 구조/PART·편집 도구·수량은 한 줄로 배치하고, 수량 제목은 부품 행의 수량 열 너비와 우측 여백에 맞춘다. REFERENCE 선택기는 한 줄 높이만 사용하고 빈 도구 행을 만들지 않는다. REUSE 검색·탭은 두 줄을 유지한다.

- 중앙 PBOM은 품번 컬럼에 프로젝트 TOP부터 계층 들여쓰기·고정 펼침 자리·부품 표시를 제공한다. 경로 문자열 컬럼은 숨기고 출처는 자료 ID 링크로 표시하며 상세 근거는 툴팁에 유지한다. TOP 및 ASSY 접기와 표시 깊이 선택을 지원한다.

- 프로젝트 타임라인과 PBOM은 공통 ColumnVisibilityMenu 및 HierarchyActions를 사용한다. 표시 열 체크·기본값 복원, Columns3·ChevronsUp·ChevronsDown 아이콘과 버튼 크기를 공유한다. PBOM 품번은 계층 탐색을 위해 고정 표시하며 열 숨김은 데이터에 영향을 주지 않는다.

- 중앙 PBOM 보기 설정은 상단 검색·새로고침 툴바의 React 선언 슬롯에 렌더링한다. 표시 열 메뉴는 내부 체크/스크롤 중 유지하고 외부 클릭·Escape로 닫으며 가로 스크롤 없이 긴 항목을 줄바꿈한다.

- AI Data Review 목록은 미리보기 칸에서만 원본 팝업을 연다. 자료 ID 이후 칸은 우측 분석 패널을 열고 결과 건수는 해당 탭으로 연결한다. 분석 상태와 4개 영역의 초안 항목 수를 분리하며 미분석은 —, 분석 결과 0건은 0으로 표시한다.

- PBOM 표시 열은 기존 사용자별 /api/state 저장 경계를 사용하고 전체 PBOM/문서 검토 설정을 분리한다. 복원이 완료되기 전 기본값을 저장하지 않으며 열 변경·기본값 복원은 즉시 저장한다. 저장 요청은 순서대로 처리하고 화면 전환 시 취소하지 않는다.
