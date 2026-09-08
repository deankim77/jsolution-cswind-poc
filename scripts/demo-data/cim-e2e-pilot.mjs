const phaseNames={
  1:"프로젝트 생성 및 계획수립",
  2:"개발 수행 (Execution)",
  3:"Gate 검증",
  4:"작업 수행 및 협업",
  5:"품질 관리",
  6:"설계변경 (ECR/ECO)",
  7:"재고 / 출고 관리",
  8:"양산 이관",
  9:"원가 관리",
  10:"통합 대시보드 및 완료",
};

const raw=`
1|1|차종 개발 접수 및 정보사항 등록|사업팀|2026-05-11|2026-05-12|completed|차종 개발 접수서;고객 요구 정보|협업 관리
1|2|프로젝트 기본정보 및 개발 범위 확정|PM|2026-05-13|2026-05-14|completed|프로젝트 정의서;개발 범위서|기타 (시스템 공통)
1|3|WBS·일정·담당자 수립|PL|2026-05-15|2026-05-20|completed|프로젝트 WBS;마스터 일정표|워크플로우 관리
1|4|CIM 개발 프로젝트 Kick-off|PM|2026-05-22|2026-05-22|completed|Kick-off 회의록;TFT 조직도|협업 관리
2|5|개발 의뢰서 작성 및 접수|사업팀|2026-05-25|2026-05-27|completed|제품 개발 의뢰서|워크플로우 관리
2|6|기존 칼라·자재·사양·개발 이력 검색|개발팀|2026-05-28|2026-06-02|completed|유사 개발품 검토서|통합 검색
2|7|디자인 파일 및 기준 도면 등록|디자인팀|2026-06-03|2026-06-05|completed|디자인 원본;기준 도면|도면 관리
2|8|제품 사양·칼라·Part·BOM 초안 등록|개발팀|2026-06-08|2026-06-12|completed|개발품 사양서;Part List;BOM 초안|문서 관리
3|9|Gate 판정 기준 및 체크리스트 확정|PL|2026-06-15|2026-06-17|completed|Gate 판정 기준서;Gate 체크리스트|Gate 관리
3|10|필수 산출물 충족 여부 점검|개발팀|2026-06-18|2026-06-19|completed|필수 산출물 점검표|Gate 관리
3|11|Gate 승인 요청 및 검토|PL|2026-06-22|2026-06-23|completed|Gate 승인 요청서;Gate 검토 결과|Gate 관리
3|12|Gate 1 승인 및 다음 단계 전환|PM|2026-06-24|2026-06-24|completed|Gate 1 승인서|메일 / 알람 / 결재
4|13|샘플 제작·작업지시 Task 요청 및 담당자 지정|PL|2026-06-25|2026-06-29|completed|업무 요청서;담당자 배정표|협업 관리
4|14|요청·코멘트·수신확인 관리|개발팀|2026-06-30|2026-07-03|completed|협업 코멘트 이력|협업 관리
4|15|외주 협력사 작업 의뢰|외주협력사|2026-07-06|2026-07-10|active|외주 작업 의뢰서;보안 서약서|외주 업체 관리
4|16|염색 호기·외주 일정 및 결과물 검토|개발팀|2026-07-13|2026-07-17|active|외주 진행 현황;외주 결과 검토서|외주 업체 관리
5|17|원사·원단·후가공 품질 이슈 등록|품질팀|2026-07-20|2026-07-22|completed|품질 이슈 보고서|품질 관리
5|18|칼라 편차·품질 문제 원인 분석|품질팀|2026-07-23|2026-07-28|active|원인 분석서;5Why 분석|품질 관리
5|19|개선조치 수립 및 실행|개발팀|2026-07-29|2026-08-05|active|개선조치 계획서;조치 결과서|품질 관리
5|20|CCM·회차별 품질 이력 검토 및 승인|품질팀|2026-08-06|2026-08-14|review|재발방지 대책서;품질 이력 승인서|품질 관리
6|21|ECR 설계변경 요청 등록|개발팀|2026-08-17|2026-08-18|active|ECR 요청서|설계변경 관리
6|22|BOM·도면·일정 영향도 분석|PL|2026-08-19|2026-08-21|active|설계변경 영향 분석서|설계변경 관리
6|23|ECO 변경 승인|PM|2026-08-24|2026-08-25|planned|ECO 승인서|메일 / 알람 / 결재
6|24|변경 도면·사양·BOM Revision 반영|개발팀|2026-08-26|2026-09-04|planned|변경 도면;변경 사양서;변경 BOM|도면 관리
7|25|개발 샘플 입고 등록|운영팀|2026-09-07|2026-09-08|planned|샘플 입고전표|재고 / 출고 관리
7|26|샘플 재고 및 보관 위치 확인|운영팀|2026-09-09|2026-09-11|planned|샘플 재고현황|재고 / 출고 관리
7|27|평가용 샘플 출고 처리|운영팀|2026-09-14|2026-09-15|planned|샘플 출고전표|재고 / 출고 관리
7|28|입출고·수불 이력 마감|운영팀|2026-09-16|2026-09-18|planned|샘플 수불대장|재고 / 출고 관리
8|29|개발 완료 및 이관 기준 점검|PL|2026-10-05|2026-10-07|planned|양산 이관 체크리스트|Gate 관리
8|30|양산 이관 자료 패키지 작성|개발팀|2026-10-08|2026-10-14|planned|양산품 사양서;최종 도면;최종 BOM|문서 관리
8|31|관련 부서 전자결재 및 확인|PM|2026-10-15|2026-10-19|planned|양산 이관 결재서|메일 / 알람 / 결재
8|32|생산팀 이관 및 이력 등록|생산팀|2026-10-20|2026-10-23|planned|양산 이관 완료서;인수인계 회의록|협업 관리
9|33|BOM 기반 개발 원가 산정|개발팀|2026-11-02|2026-11-06|planned|개발 원가계산서|문서 관리
9|34|표준 원가계산서 등록|사업팀|2026-11-09|2026-11-11|planned|표준 원가계산서|문서 관리
9|35|원가 Revision 비교 및 검토|PL|2026-11-12|2026-11-16|planned|원가 Revision 비교표|문서 관리
9|36|최종 원가 승인|PM|2026-11-17|2026-11-18|planned|최종 원가 승인서|메일 / 알람 / 결재
10|37|프로젝트 진행률·KPI 점검|PM|2026-12-01|2026-12-03|planned|프로젝트 KPI 현황|기타 (시스템 공통)
10|38|지연·산출물·이슈 리스크 분석|PL|2026-12-04|2026-12-08|planned|프로젝트 리스크 분석서|통합 검색
10|39|AI 주간보고 및 경영 보고|PM|2026-12-09|2026-12-11|planned|주간보고서;경영 보고자료|기타 (시스템 공통)
10|40|최종 Gate 및 프로젝트 완료|PM|2026-12-14|2026-12-18|planned|최종 Gate 승인서;프로젝트 완료보고서|Gate 관리
`.trim();

const rows=raw.split("\n").map(line=>{
  const [phase,no,name,role,start,end,status,outputs,requirementArea]=line.split("|");
  return {phase:Number(phase),no:Number(no),name,role,start,end,status,outputs:outputs.split(";"),requirementArea};
});
const businessDays=(start,end)=>{let cursor=new Date(`${start}T00:00:00Z`),last=new Date(`${end}T00:00:00Z`),days=0;while(cursor<=last){const day=cursor.getUTCDay();if(day!==0&&day!==6)days++;cursor.setUTCDate(cursor.getUTCDate()+1)}return Math.max(1,days)};
const categoryFor=name=>/fmea/i.test(name)?"QUALITY_FMEA":/isir/i.test(name)?"QUALITY_ISIR":/시험|검증|결과/i.test(name)?"QUALITY_TEST":/도면/i.test(name)?"DESIGN_DRAWING":/bom/i.test(name)?"DESIGN_BOM":/요구|분석/i.test(name)?"DEV_REQUIREMENT":/설계|사양/i.test(name)?"DEV_SPEC":/회의/i.test(name)?"PLAN_MEETING":/계획|착수/i.test(name)?"PLAN_DEV":/승인|gate/i.test(name)?"APPROVAL_SIGN":/완료|보고/i.test(name)?"APPROVAL_FINAL":"COMMON_REFERENCE";
const simpleRole=value=>["PM","PL"].includes(value)?value:value.includes("품질")?"품질":/(사업|영업|기획|전략|CFT|BP)/.test(value)?"기획":/(자재|협력|외주)/.test(value)?"구매":/(생산|운영)/.test(value)?"생산":"개발";

export const cimDemo={
  templateCode:"CIM-E2E-PILOT-V1",
  templateName:"CIM 통합 개발 End-to-End 표준 프로세스",
  templateVersion:"R1",
  projectCode:"CIM-2026-PILOT-DEMO",
  projectName:"코오롱인더스트리 CIM 통합 개발 · 2026 Pilot",
  customerName:"코오롱인더스트리",
  startDate:"2026-05-11",
  endDate:"2026-12-18",
  description:"고객 최종 통합 요구사항 142건(기존 계열 113건 + 추가검토 29건)과 CIM 시스템 구축 제안서의 End-to-End 10단계를 기반으로 구성한 1차 구축 메인 데모 프로젝트",
  requirementBaseline:{total:142,existingLineItems:113,additionalReviewItems:29,meetingDecisionItems:22,priorEstimateBasis:136},
  demoPositioning:"PMS + 경량 PLM 공통 기반의 편의성 중심 시연",
  demoFocus:["프로젝트·WBS·Gate 일정","Task 실적·산출물·이슈 연결","문서 Revision·미리보기·통합검색","AI 일정 영향·회복안·보고"],
  scopeBoundary:["칼라 마스터·레시피·승인율","샘플 재고·출고·바코드","협력사 Portal·DRM·메일·Teams","CAD·Illustrator 자동변환·CCM 자동연동"],
};

export const cimDefinition={
  description:"CIM 최종 통합 요구사항 142건을 PMS+경량 PLM 공통 기능으로 연결해 프로젝트·업무·산출물·이슈·승인·AI 편의성을 시연하는 End-to-End 표준 템플릿",
  roles:["PM","PL","기획","개발","구매","생산","품질"],
  wbs:Array.from({length:10},(_,index)=>index+1).flatMap(phase=>[
    {id:`P${phase}`,level:1,kind:"summary",name:`${phase}. ${phaseNames[phase]}`,durationDays:0,role:"PM",completionCriteria:"CHILD_COMPLETE",sourceStatus:"active"},
    ...rows.filter(row=>row.phase===phase).map((row,index,phaseRows)=>({
      id:`P${phase}-A${String(row.no).padStart(2,"0")}`,parentId:`P${phase}`,level:2,kind:"task",name:`${String(row.no).padStart(2,"0")}. ${row.name}`,
      taskType:row.name.includes("Gate")?"gate":"normal",durationDays:businessDays(row.start,row.end),plannedStart:row.start,plannedEnd:row.end,role:simpleRole(row.role),
      completionActor:row.name.includes("승인")||row.name.includes("Gate")?"PL":"assignee",
      completionCriteria:row.name.includes("Gate")?"PROGRESS,REQUIRED_APPROVAL,GATE_APPROVAL":"PROGRESS,REQUIRED_UPLOAD",
      predecessorId:index===0?(phase>1?`P${phase-1}-A${String((phase-1)*4).padStart(2,"0")}`:undefined):`P${phase}-A${String(phaseRows[index-1].no).padStart(2,"0")}`,
      deliverables:row.outputs.map(name=>({name,type:categoryFor(name),required:true})),sourceStatus:row.status,requirementArea:row.requirementArea,
    })),
  ]),
};

