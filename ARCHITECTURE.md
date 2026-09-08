# J SOLUTION AI PLM Architecture Contract

> Status: **LOCKED**
>
> 이 문서는 AI PLM의 제품 아키텍처 계약이다. 일반 기능 개발, 버그 수정, 리팩터링 과정에서 임의로 변경하지 않는다. 아키텍처 변경은 제품 책임자의 명시적 승인 후 이 문서를 먼저 수정한 경우에만 허용한다.

## 1. 공식 기술 스택

- Frontend / Application: **Next.js + TypeScript**
- Database: **PostgreSQL**
- ORM: **Drizzle ORM**
- Migration: **drizzle-kit**
- File Storage: DB와 분리된 Storage Adapter
- AI: 업무 코드와 분리된 AI Service / Provider 계층

현재 PostgreSQL 전환 기간에는 기존 D1/SQLite 코드가 임시로 존재할 수 있으나, 신규 기능은 이 계약의 최종 구조를 기준으로 작성한다.

## 2. 절대 데이터 접근 경계

모든 신규 업무 데이터 접근은 다음 흐름을 따른다.

```text
UI
  -> API
    -> Service
      -> Repository
        -> Drizzle
          -> PostgreSQL
```

### 금지 사항

- UI Component에서 `db`, `drizzle-orm`, DB driver를 직접 import하지 않는다.
- UI Component에서 SQL을 직접 실행하지 않는다.
- UI Component에서 Cloudflare D1 binding에 접근하지 않는다.
- API Route에 복잡한 업무 규칙과 DB 쿼리를 함께 누적하지 않는다. 업무 규칙은 Service, DB 접근은 Repository로 분리한다.
- 신규 기능에서 `env.DB`, `drizzle-orm/d1`, `sqlite-core`, `sqliteTable`을 추가하지 않는다.

## 3. 계층별 책임

### UI

- 화면 렌더링, 입력, 사용자 상호작용을 담당한다.
- 데이터는 API Contract를 통해서만 읽고 쓴다.
- DB 구현체를 알지 못해야 한다.

### API

- HTTP Request/Response, 인증 컨텍스트, DTO 검증을 담당한다.
- 업무 처리는 Service에 위임한다.

### Service

- 프로젝트/WBS/BOM/Workflow/Revision 등 업무 규칙을 담당한다.
- DB 상세 구현을 직접 알지 않고 Repository를 사용한다.

### Repository

- Drizzle 기반 DB 접근을 담당한다.
- 쿼리, 트랜잭션, PostgreSQL 최적화가 필요한 경우 이 계층에서 처리한다.
- 복잡한 성능 핵심 쿼리는 PostgreSQL Native SQL을 사용할 수 있다.

## 4. Database 규칙

- 공식 DB는 PostgreSQL이다.
- 테이블/컬럼/인덱스/제약조건은 PostgreSQL 기준으로 설계한다.
- Schema 변경 시 Migration을 반드시 생성한다.
- 운영 DB를 수동 변경한 뒤 Migration을 생략하는 방식을 금지한다.
- 복잡한 BOM 계층, Revision, Workflow, 검색은 PostgreSQL 기능을 활용할 수 있다.
- `pgvector`는 AI 검색 요구가 확정된 모듈부터 선택적으로 적용한다.

## 5. Storage 규칙

실제 문서/도면/첨부파일 binary는 PostgreSQL에 저장하지 않는다.

DB에는 다음과 같은 메타데이터만 저장한다.

- object key / storage key
- 파일명
- MIME type
- size
- checksum
- revision/version
- 등록자/등록일
- 업무 Entity 연결정보

실제 파일은 Storage Adapter를 통해 저장한다.

지원 목표:

- Local / File Server
- NAS
- S3 Compatible Storage
- MinIO
- AWS S3
- Azure Blob 등

업무 로직은 특정 Storage 제품에 직접 종속되지 않는다.

## 6. AI Service 규칙

- 화면이나 Repository에서 OpenAI/Ollama/vLLM 등을 직접 호출하지 않는다.
- AI Provider / AI Service 계층을 통해 호출한다.
- OpenAI API와 Local AI를 교체 가능하게 유지한다.
- 고객사 내부망 Local AI 적용 시 업무 API와 DB 구조를 다시 만들지 않는 것을 목표로 한다.

## 7. 배포 독립성

하나의 코드베이스로 다음 환경을 지원할 수 있게 설계한다.

1. Linux On-Premise
2. Windows On-Premise
3. Cloud

Docker는 배포 옵션이며 제품 실행의 필수 의존성으로 만들지 않는다.

환경별 차이는 코드 하드코딩이 아니라 환경변수/Adapter/설정으로 처리한다.

## 8. 미래 Backend 교체 가능성

향후 고객 프로젝트 또는 개발 조직 상황에 따라 Backend API를 Spring Boot로 분리할 수 있다.

따라서 현재 개발에서도 다음을 지킨다.

- Frontend가 DB에 직접 접근하지 않는다.
- API Contract를 안정적으로 유지한다.
- 업무 규칙을 UI에 넣지 않는다.
- PostgreSQL Schema를 특정 Web Framework에 종속시키지 않는다.

이 원칙을 지키면 향후 다음과 같이 Backend 구현체만 단계적으로 교체할 수 있다.

```text
Next.js UI -> TypeScript API/Service/Repository -> PostgreSQL
                         |
                         +-- future --> Spring Boot API -> PostgreSQL
```

## 9. 아키텍처 변경 승인 절차

다음 항목을 변경하려면 제품 책임자의 명시적 승인이 필요하다.

- PostgreSQL 이외의 공식 DB 채택
- Drizzle ORM 교체
- UI의 DB 직접 접근 허용
- API/Service/Repository 계층 제거
- 파일 binary의 DB 저장
- Storage를 특정 Vendor에 강결합
- AI Provider 직접 호출 구조 도입
- Spring Boot 등 Backend 구조의 공식 전환

승인된 경우 순서는 반드시 다음과 같다.

1. `ARCHITECTURE.md` 변경
2. `AGENTS.md` 변경
3. 자동 검사 규칙 변경
4. 구현 변경

구현부터 변경하고 문서를 사후 수정하지 않는다.

## 10. 자동 강제

`npm run check:architecture`는 최소한 다음을 검사한다.

- 필수 Contract 파일 존재 여부
- UI 영역의 DB/Drizzle 직접 import
- UI 영역의 D1/Cloudflare DB 직접 접근
- 신규 SQLite/D1 의존성 재유입

`npm run build`와 `npm run lint`는 Architecture Check와 UI Check를 모두 통과해야 한다.
