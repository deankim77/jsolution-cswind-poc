# J SOLUTION AI PLM 개발 필수 지침

## 최상위 Contract — 모든 작업 전에 반드시 확인

AI PLM 소스를 조회·분석·수정하기 전에 아래 문서를 이 순서로 확인하고 적용한다.

1. `ARCHITECTURE.md`
2. `docs/UI-CONTRACT.md`
3. `docs/V2-UI-STANDARD.md`
4. `docs/COMMON-COMPONENT-RULES.md`

`ARCHITECTURE.md`와 `docs/UI-CONTRACT.md`는 **LOCKED Contract**다.
기능 개발, 버그 수정, 리팩터링, DB 전환을 이유로 임의 변경하지 않는다.
제품 책임자의 명시적 승인 없이 기술 스택, 데이터 접근 경계, UI Foundation을 변경하지 않는다.

아키텍처/UI Contract 변경 승인이 있는 경우에도 **Contract 문서 → 자동 검사 → 구현** 순서로 변경한다. 구현부터 바꾸고 문서를 사후 수정하지 않는다.

모든 완료 작업은 최소 다음 검사를 통과해야 한다.

```text
npm run check:architecture
npm run check:v2-ui
```

UI/React 구조를 변경한 경우 다음도 통과해야 한다.

```text
npm run audit:react-dom
```

## 데이터 접근 절대 규칙

- 공식 목표 DB는 **PostgreSQL**, ORM은 **Drizzle ORM**이다.
- 신규 업무 데이터 접근은 `UI -> API -> Service -> Repository -> Drizzle -> PostgreSQL` 경계를 따른다.
- UI Component에서 `db`, `drizzle-orm`, DB driver, `cloudflare:workers`, `env.DB`를 직접 사용하지 않는다.
- UI Component에서 SQL을 직접 실행하지 않는다.
- 신규 기능에 D1/SQLite 의존성을 추가하지 않는다.
- PostgreSQL 전환 중 기존 D1/SQLite 코드는 임시 legacy로만 취급하며 신규 구조가 이를 확장하지 않는다.
- DB Schema 변경은 Migration을 반드시 동반한다.
- 실제 문서/도면/첨부파일 binary를 DB에 저장하지 않는다. DB에는 metadata/storage key만 저장한다.
- Storage와 AI Provider는 Adapter/Service 계층으로 분리하여 특정 Vendor에 업무 로직을 직접 결합하지 않는다.

## React 구조 절대 규칙

- React 화면의 기능 수정은 **원본 React 컴포넌트의 state/props/context와 API/Service**에서 처리한다.
- 기능 구현을 위해 React가 소유한 DOM에 `document.createElement`, `appendChild`, `prepend`, `insertBefore`, `.remove()`, `removeChild`, `innerHTML` 등으로 노드를 직접 추가·삭제·교체하지 않는다.
- `MutationObserver + querySelector + DOM mutation` 조합으로 기존 화면을 후처리하는 신규 bridge/enhancer/fix를 만들지 않는다.
- 다른 컴포넌트의 버튼·행을 찾아 `.click()`하여 화면 상태나 업무 로직을 우회하지 않는다. 필요한 동작은 callback/action/context로 명시적으로 연결한다.
- Portal은 React가 JSX로 미리 렌더링한 안정적인 mount node에만 사용한다. Portal mount node를 런타임 DOM 조작으로 만들지 않는다.
- 브라우저 API가 필요한 file input focus/click, scroll, selection 같은 제한된 ref 기반 DOM 접근은 허용하되 전역 `document.querySelector`보다 React ref를 우선한다.
- 기존 bridge/enhancer/fix 계열은 `docs/V2-REACT-DOM-AUDIT-2026-08-29.md` 기준으로 P0부터 순차 제거한다.
- 신규 기능을 추가하기 전에 `npm run audit:react-dom` 결과에 위험 패턴을 새로 늘리지 않았는지 확인한다.

## V2 UI Foundation 절대 규칙

- 같은 역할의 UI는 같은 컴포넌트·토큰·아이콘을 사용한다. 같은 기능을 화면별로 새로 구현하지 않는다.
- 화면별 임의 색상, 임의 배경, 임의 탭 active 표현, 임의 우측 패널 폭을 추가하지 않는다.
- 중앙 View Tab의 active 상태는 **teal text/icon + 하단 2px line**으로 통일한다. active 배경 리본·채움색을 사용하지 않는다.
- 중앙 View Tab 컨테이너는 배경 리본 없이 workspace surface 위에 두고, 항목이 많으면 가로 스크롤로 처리한다.
- 중앙 Workspace 배경은 `--v2-surface-workspace`, 실제 카드·폼·테이블 본문은 `--v2-surface-content`, 표/목록 헤더는 `--v2-surface-table-header`를 사용한다.
- 우측 패널 기본폭은 `--v2-right-panel-width`, 확장폭은 `--v2-right-panel-wide-width`를 사용한다. 560px/760px를 화면 CSS에 직접 쓰지 않는다.
- 우측 패널 확장/축소는 `PanelRightOpen` / `PanelRightClose` 계열만 사용한다. 같은 기능에 Maximize/Expand 계열 아이콘을 임의 사용하지 않는다.
- 우측 패널의 확장/축소 버튼은 닫기(X) 바로 왼쪽에 배치한다.
- 신규 화면은 기존 V2 Foundation 패턴을 먼저 재사용하고, 공통 패턴이 없을 때만 새 컴포넌트를 추가한다.

## V2 타이포그래피 절대 규칙

- V2 일반 텍스트의 최소 크기는 **12px**이다.
- 중앙 화면 제목은 **22px**이다.
- 주요 섹션 제목은 **18px**이다.
- 카드 핵심 제목과 우측 패널 제목은 **16px**이다.
- 테이블 본문, 탭, 검색, 버튼, 입력값은 **14px**이다.
- 테이블 헤더는 **13px**이다.
- 보조정보, 상태, 설명, 배지, Kicker는 **12px**이다.
- 일반 아이콘은 **18px**, 주요 기능 아이콘은 **20px**이다.
- `12px` 미만의 신규 `font-size`를 사용하지 않는다. 단, **간트 막대 내부 진행률 숫자**만 전용 토큰 `--v2-font-size-gantt-progress: 10px`를 사용할 수 있다.
- 화면별 숫자 직접 지정 대신 `app/ui-standard-tokens.css`의 `--v2-*` 토큰을 사용한다.
- 좁은 레이아웃은 글씨를 줄여 해결하지 않는다. 열 너비, 말줄임, 줄바꿈, 가로 스크롤로 처리한다.
- 위 간트 진행률 외의 예외가 필요하면 임의 적용하지 말고 사용자 확인 후 Contract/표준 문서와 토큰을 함께 변경한다.
- V2 UI 변경 후 반드시 `npm run check:v2-ui`를 실행하고 통과시킨다.

## 적용 범위

위 규칙은 V2의 프로젝트, WBS, MY WORK, 문서·산출물, 이슈·리스크, AI HOME, 시스템 설정, PART·BOM, 원가관리, 우측 공통 패널, 팝업과 모든 신규 화면에 적용한다.
V1 전용 화면과 기존 AI 응답 프롬프트는 별도 요청 없이 수정하지 않는다.
