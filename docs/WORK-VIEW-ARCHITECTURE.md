# Work View Architecture

## 원칙

같은 Task 데이터는 화면별로 복제하지 않는다. 모든 업무 View는 공통 `WorkTaskViewModel`을 사용한다.

- 프로젝트 일정·WBS와 MY WORK는 동일한 Task 원본을 본다.
- 같은 기능은 같은 컴포넌트를 사용한다.
- View는 표현 방식만 다르며 별도 업무 DB를 만들지 않는다.
- 화면별 임시 DOM 조작으로 상태를 동기화하지 않는다.
- 상태 변경은 공통 데이터 흐름/API를 통해 원본 Task에 반영한다.

## 프로젝트 일정·WBS

최종 View 구성:

1. 보드 — 기존 WBS 실적입력 화면의 발전형. 계층, 진행률, 담당, 산출물, 이슈, 실적 처리 중심.
2. 타임라인 — 프로젝트/담당자별 일정 흐름 확인.
3. 간트 — 선후행 관계, 지연, 오늘선, 향후 Baseline 비교.
4. 칸반 — 프로젝트 전체 Task의 상태 흐름과 병목 확인.
5. 캘린더 — 시작일, 종료일, Gate/마일스톤, 마감 일정 확인.
6. WBS 편집 — PM/PL의 구조, 일정, Role, 담당자, 선행관계 편집.

기존 WBS 실적입력/간트/WBS 편집 기능은 폐기하지 않고 위 View 체계에 흡수한다.

## MY WORK

최종 View 구성:

1. 리스트 — 오늘/이번 주/지연 등 개인 업무 빠른 확인.
2. 칸반 — 개인 실행 흐름 관리.
3. 캘린더 — 개인 시작/마감 일정 확인.

MY WORK는 별도 Task를 생성하지 않는다. 프로젝트 WBS Task 중 현재 사용자에게 배정된 업무를 개인 관점으로 보여준다.

## 공통 칸반

`CommonKanbanView` 하나를 사용한다.

- `scope="project"`: 프로젝트 전체 실행 Task
- `scope="my-work"`: 현재 사용자에게 배정된 실행 Task

공통 컬럼:

- 예정
- 진행 중
- 검토 · 주의
- 완료

카드 공통 정보:

- WBS 코드
- Task명
- 프로젝트명(MY WORK)
- 담당자
- 계획 기간
- 진행률
- 산출물 수
- 이슈 수
- Role
- 지연 표시

## 공통 데이터 계약

`WorkTaskViewModel`을 프로젝트 보드/타임라인/간트/칸반/캘린더와 MY WORK 리스트/칸반/캘린더의 공통 계약으로 사용한다.

View 컴포넌트가 API 호출 규칙을 직접 소유하지 않는다. Data Source가 API 데이터를 `WorkTaskViewModel[]`로 변환하고 각 View에 전달한다.

## 개발 순서

1. 공통 `WorkTaskViewModel` 및 Data Source 구축
2. 기존 프로젝트 WBS 실제 데이터 연결
3. 공통 View Switcher 적용
4. 프로젝트 칸반 연결
5. MY WORK를 동일 Task 모델로 전환 후 공통 칸반 재사용
6. 기존 간트를 공통 Task 모델로 정리
7. 타임라인 추가
8. 캘린더 공통 컴포넌트 추가 및 프로젝트/MY WORK 재사용
9. Baseline/선후행/지연 계산 고도화
