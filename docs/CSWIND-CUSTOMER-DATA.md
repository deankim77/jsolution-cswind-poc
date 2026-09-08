# CS WIND POC · Customer Data 1차 개발

대상: `C:\Projects\jsolution-cswind-poc`, remote `cswind`, DB `jsolution_cswind_poc`, port `5176`.

## Z440 적용

CS WIND 서버 창에서 Ctrl+C로 종료한 뒤 PowerShell에서 실행한다.

```powershell
cd C:\Projects\jsolution-cswind-poc
git pull cswind main
npm ci
npm run db:migrate:cswind
npm run dev:cswind
```

각 명령이 성공한 것을 확인하고 다음 명령으로 진행한다. 로컬 수정으로 pull이 중단되면 변경을 삭제하지 말고 상태를 확인한다.
DB 마이그레이션은 기존 `drizzle-postgres` journal을 사용하며 0007을 추가한다. 기존 마이그레이션은 수정하지 않았다.
전용 명령은 DB 이름을 확인하여 AI PLM main DB에 적용되는 것을 방지한다.
서버와 마이그레이션이 동일한 DATABASE_URL을 사용하도록 `.dev.vars` / `.env`를 확인한다. Storage는 기존 `STORAGE_ROOT=./storage-cswind` 설정을 유지한다.

## 화면 및 동작

1. 새 프로젝트 또는 프로젝트 정보 수정에서 `Production`(기존 명칭 `생산`도 같은 코드)을 선택한다.
2. 프로젝트 탐색의 **고객 Data · Production**을 연다. 프로젝트별 중앙 작업 탭을 사용한다.
3. 원본 등록: 자료명, 파일, 문서유형, 영향 대상, 선택적 참조 자료, 메모를 입력한다.
4. 목록에서 자료명을 눌러 원본 다운로드·SHA-256·버전 이력·참조 관계를 확인한다.
5. 최신 버전에서 새 Revision을 등록한다. Raw Data ID는 유지되고 버전은 증가한다. 이전 파일은 보존된다.
6. PM/PL 또는 시스템 관리자는 원본 검토 상태를 변경할 수 있다. 참여자는 등록·참조 연결이 가능하다.

업로드 제한은 파일당 50MB다. 자료 ID는 서버에서 생성한 UUID 기반 `RAW-…`이며, 별도의 버전 ID가 각 파일을 식별한다.
동일 이름의 새 자료 등록은 별도 Raw Data ID를 만든다. 같은 자료의 개정본은 **새 Revision 등록**을 사용한다.
R&D 프로젝트에는 Production 영역이 표시되지 않으며, API도 Production 유형·회사·참여 권한을 확인한다.
완료된 프로젝트는 조회·다운로드만 가능하다.

## 이번 단계의 범위

- 원본 파일·메타데이터·버전·참조 관계·감사 이력을 저장한다.
- 영향 대상은 등록자가 분류한 값이며 AI 분석 결과가 아니다.
- `AI Data Review`, `PBOM`, `TTR / Requirement`, `Process Readiness` 탭은 준비 중으로 표시한다.
- AI 분석 상태는 `not_requested`, Applied는 `not_applied`다. 원본 검토 완료가 PBOM 반영을 의미하지 않는다.
- 원본 삭제·분석 실행·Proposed Update·Human Confirm 후 Commit은 후속 개발 범위다.
- 프로젝트 복사 시 고객 원본을 자동 복제하지 않는다. 기존 자료와 리뷰의 잘못된 승계를 방지한다.

## 구현 및 검증

`UI → API → Service → Repository → Drizzle → PostgreSQL` 경계를 사용한다.
Storage Adapter로 파일을 저장하고 DB에는 경로·해시·파일 정보만 저장한다.
프로젝트 행 잠금으로 새 Revision 배정을 직렬화한다. 오래된 버전에서 요청하면 409를 반환한다.
DB 저장 실패 시 새로 올린 파일을 정리하고, 관계의 회사·프로젝트 일치는 복합 FK로 검증한다.

```powershell
npm run check:architecture
npm run check:v2-ui
npm run audit:react-dom
```

테스트용으로 추가했던 PGlite와 직접 tsx 의존성 및 해당 테스트 명령은 사전 합의한 개발환경을 유지하기 위해 제거했다. 아래 최초 검증 결과는 당시 수행한 이력이며 현재 설치에 해당 환경을 추가하지 않는다.
기존 저장소 전체에는 TypeScript 오류와 과거 DOM bridge 기술부채가 있다. 이번 변경에서 오류나 DOM 위험 패턴을 늘리지 않는지 비교한다.
기존 Node Vite 설정의 production build는 잔존 Wrangler 설정 때문에 Cloudflare plugin을 요구한다. 이번 작업은 해당 배포 설정을 변경하지 않으며 `dev:cswind` 실행 경로로 화면을 검증한다.

검증 결과: 기능 테스트 10개 통과, Architecture/UI 검사 통과, DOM 위험 패턴 증가 없음(P0 18/P1 11 유지). 전체 TypeScript 진단은 기존 127개와 동일하며 신규 진단은 없다. Node 개발 서버의 실제 React 화면에서 API 응답을 모의하여 목록·공통 필터·상세·검토·Revision/신규 등록 폼을 확인했다. 실제 저장 로직은 별도의 PostgreSQL 엔진 테스트로 검증했으며 Z440 실DB·실파일 통합 확인은 적용 후 수행한다.
