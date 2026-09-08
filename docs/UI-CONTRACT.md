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
