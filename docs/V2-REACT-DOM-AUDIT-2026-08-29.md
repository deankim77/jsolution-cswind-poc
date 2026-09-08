# V2 React DOM 안정화 Audit — 2026-08-29

## 목적

V2 기능을 React 원본 컴포넌트/API/DB 대신 DOM 후처리로 구현한 구간을 찾아 제거한다.
이번 Audit의 직접 계기는 이슈/WBS 화면에서 발생한 `removeChild` NotFoundError이며, 같은 유형의 잠재 오류를 전체 V2에서 사전에 제거하는 것이 목표다.

## 절대 원칙

- React 화면 기능은 React state/props/context와 원본 컴포넌트에서 구현한다.
- 저장 규칙은 API와 DB 모델에서 구현한다.
- 화면 표시만 바꾸기 위해 React가 소유한 DOM 자식 노드를 직접 생성/삽입/삭제/교체하지 않는다.
- `MutationObserver + querySelector + createElement/append/remove/innerHTML` 조합으로 기능을 붙이지 않는다.
- 다른 컴포넌트 버튼을 찾아 `.click()`하여 상태를 우회하지 않는다.
- Portal은 React가 소유하는 사전에 정의된 mount node에만 사용한다. mount node 자체를 런타임 DOM 조작으로 만들지 않는다.

## 위험 등급

### P0 — 우선 제거

React가 관리하는 트리 자체를 직접 변경하는 코드. 화면 전환·패널 open/close·조건부 렌더링 시 `removeChild`/hydration/상태 불일치 위험이 높다.

현재 소스에서 직접 확인된 대표 구간:

1. `app/v2/bom-central-tab-bridge.tsx`
   - `document.createElement`, `appendChild`, `MutationObserver`, `.remove()`, 강제 `.click()` 사용
   - 중앙 탭/콘텐츠 host를 React 외부에서 직접 생성하고 BOM 화면을 portal로 삽입
   - 프로젝트 BOM 행에도 셀을 직접 append
   - **조치:** `NewWorkViewApp`의 workspace tab/state 모델로 흡수하고, BOM 탭/콘텐츠를 JSX로 렌더링

2. `app/v2/project-plm-tabs-bridge.tsx`
   - 중앙 View Tab과 canvas host를 `createElement/insertBefore/appendChild`로 생성
   - 우측 패널에도 탭/body host를 직접 생성·삭제
   - 기존 버튼/row를 찾아 `.click()`으로 화면 상태를 전환
   - **조치:** 프로젝트 PLM 탭을 WBS의 정식 `WorkView` 또는 별도 workspace state에 편입

3. `app/v2/right-panel-defaults.tsx`
   - 이슈 등록 폼 내부에 안내 DOM을 `createElement/prepend/innerHTML`로 삽입
   - submit disabled 상태를 DOM에서 직접 변경
   - 패널 폭 버튼을 찾아 강제로 `.click()`
   - **조치:** 이슈 등록 React 컴포넌트의 초기값/validation/JSX로 이동하고 패널 기본폭은 state 초기값으로 변경

4. `app/project-lifecycle-enhancer.tsx`
   - WBS host를 런타임에 직접 생성/prepend
   - MutationObserver와 DOM 탐색으로 현재 프로젝트/선택 Task를 추론
   - 기존 화면 버튼/row를 강제 click하여 기능 연결
   - **조치:** 현재 V2 WBS 구현과 기능 중복 범위를 분석 후 원본 `NewWorkViewApp`/WBS 컴포넌트에 필요한 기능만 흡수

5. `app/wbs-editor-toolbar-enhancer.tsx`
   - toolbar mount를 `createElement/insertBefore`로 생성
   - 원본 버튼을 문자열로 검색 후 `.click()`하여 명령 실행
   - **조치:** WBS editor 명령을 callback/action API로 노출하고 정식 command bar 컴포넌트로 통합

### P1 — 구조 개선

DOM 자체를 크게 변형하지 않더라도 MutationObserver, 전역 querySelector, 강제 click으로 컴포넌트 경계를 우회하는 코드.
P0 제거 후 순차적으로 props/context/event contract로 대체한다.

우선 검토 대상:

- `app/v2/project-code-readonly-bridge.tsx`
- `app/v2/current-ui-fixes-bridge.tsx`
- `app/v2/drawing-type-options-bridge.tsx`
- `app/v2/project-cost-ui-bridge.tsx`
- `app/v2/project-cost-settings-nav-fix.tsx`
- `app/v2/system-cost-navigation-guard.tsx`
- `app/v2/document-preview-workspace.tsx`
- `app/wbs-editor-inline-shell.tsx`
- `app/wbs-operational-toolbar-enhancer.tsx`
- `app/wbs-role-cascade.tsx`
- `app/project-superuser-actions.tsx`
- `app/global-ai-panel-shift.tsx`

각 파일은 이름만으로 판정하지 않고 `npm run audit:react-dom` 결과와 실제 코드 검토 후 P0/P1/P2를 확정한다.

### P2 — 허용 가능하나 의존 축소

DOM을 읽기만 하는 코드, focus/scroll/file-input click처럼 브라우저 API가 필요한 코드.
컴포넌트 ref로 대체할 수 있으면 개선하되 기능 위험이 낮으면 후순위로 둔다.

## 진행 순서

1. **안정화 Freeze**
   - 신규 DOM 후처리 bridge 추가 금지
   - 기능 요구가 들어와도 원본 컴포넌트/API에서만 수정

2. **P0 제거 1차**
   - `right-panel-defaults` 및 최근 임시 bridge부터 제거
   - 프로젝트 코드/원가 표시/패널 아이콘을 원본 React 코드로 이전

3. **WBS/PLM 구조 통합**
   - `project-plm-tabs-bridge`
   - `bom-central-tab-bridge`
   - WBS enhancer 계열
   - 중앙 탭과 우측 패널의 단일 state ownership 확립

4. **문서·도면 데이터 모델 정리**
   - 프로젝트 선택 없는 문서/도면을 임시 hidden project로 우회하지 않음
   - 회사 공통 문서 Library의 정식 entity/schema/API 설계 후 구현

5. **최종 강제화**
   - Audit의 P0=0 확인
   - 이후 `audit-react-dom-overrides.mjs --fail-on-p0`를 CI/build에 연결
   - 예외는 문서화된 ref/portal mount 등 제한된 경우만 허용

## Audit 명령

```bash
npm run audit:react-dom
```

정리 완료 후 강제 검사 후보:

```bash
node scripts/audit-react-dom-overrides.mjs --fail-on-p0
```

## 완료 조건

- V2 화면 전환/패널 open-close에서 React DOM ownership 오류 0건
- 중앙 탭/우측 패널/WBS/BOM이 React state 한 곳에서 제어됨
- 프로젝트 코드 등 업무 규칙이 DOM 후처리가 아니라 API/React state에서 일관됨
- 문서·도면 저장 규칙이 DB/API 모델과 UI validation에서 동일함
- 신규 기능에 DOM mutation bridge를 사용하지 못하도록 자동 검사 적용
