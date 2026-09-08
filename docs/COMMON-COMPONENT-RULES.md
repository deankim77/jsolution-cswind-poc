# J SOLUTION AI PMS 공통 컴포넌트 개발 규칙

## 목적
같은 기능을 화면별로 다시 구현하지 않는다. UI, 상태, API, 저장 흐름이 같은 기능은 하나의 공통 컴포넌트와 하나의 데이터 계약을 사용한다.

## 필수 규칙
1. **Same function = same component**
   - 동일 목적의 UI/기능은 기존 공통 컴포넌트를 우선 사용한다.
   - 화면별 JSX/CSS/API 호출 복제를 금지한다.

2. **One data contract**
   - 공통 컴포넌트는 명시적인 공통 Type/Props 계약을 사용한다.
   - 화면별 데이터는 공통 Type으로 변환해서 전달하고, DOM에서 다시 읽지 않는다.

3. **One behavior flow**
   - 동일 기능은 동일 API, 동일 저장 정책, 동일 이벤트/상태 흐름을 사용한다.
   - 화면별 별도 저장/후처리 로직을 만들지 않는다.

4. **No DOM workaround for normal app state**
   - `querySelector`, `MutationObserver`, 강제 click, `style.display`는 일반 화면 상태/기능 연결에 사용하지 않는다.
   - React state/props/context를 기본으로 한다.

5. **No duplicate renderer**
   - 새 공통 컴포넌트를 도입할 때 기존 전용 렌더러는 함께 제거한다.
   - CSS로 숨기기만 하고 두 구현을 동시에 유지하지 않는다.

6. **Exception requires an explicit reason**
   - 공통 컴포넌트로 처리할 수 없는 경우 구현 전에 예외 사유와 영향 범위를 설명한다.

## AI 대화 공통 기준
`CommonAiChatPanel`이 WBS / 문서·산출물 / 이슈·리스크의 공통 AI 대화 컴포넌트다.

공통 책임:
- `CommonAiContextItem[]` 선택 문맥 표시/해제
- 사용자 메시지 우측 / AI 메시지 좌측 공통 UI
- `/api/ai/chat` 호출
- 동일 `conversationId` 유지
- AI 대화 목록 갱신 및 후속 대화 연결
- 결과물 유형 감지
- `saveAiArtifactResult()`를 통한 AI 라이브러리 자동 저장
- 결과물 미리보기/다운로드

각 업무 화면은 다음 데이터만 제공한다.
- `items`
- `projectName`
- `source`
- `contextType`
- `contextTitle`
- 선택 해제 callback

업무 화면 내부에 별도 AI send/query/messages/artifact 저장 로직을 다시 만들지 않는다.

## 개발 전 체크
- 이미 같은 기능의 공통 컴포넌트가 있는가?
- 공통 Type으로 전달할 수 있는가?
- 기존 API/저장 흐름을 그대로 재사용할 수 있는가?
- 새 코드가 기존 전용 구현을 중복 생성하지 않는가?

위 항목 중 하나라도 어긋나면 구현 전에 구조를 다시 검토한다.
