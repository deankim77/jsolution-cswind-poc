const gateNames={
  1:"사전개발 준비단계 (수주확정~PROTO)",
  2:"제품 개발 단계 (PROTO)",
  3:"제품 개발 / 양산 준비 단계 (P1)",
  4:"양산 준비 단계 (P2)",
  5:"양산 단계 (M~SOP)",
  6:"양산 안정화 단계",
};
const gateReviewDates={1:"2025-11-21",2:"2026-06-05",3:"2026-08-28",4:"2026-12-18",5:"2027-01-15",6:"2027-02-26"};
const raw=`
1|1|수주확정 · 프로젝트 설명회|CSM기술팀|사전준비|2025-08-22|2025-08-22|completed|프로젝트 설명회 회의록
1|2|CFT 구성|CFT|사전준비|2025-08-22|2025-08-22|completed|CFT 조직도
1|3|디자인 검토 (DAE)|CSM기술팀|사전준비|2025-08-22|2025-08-22|completed|디자인 검토 결과서;개선 제안서;부품 신기술·구조 분석 자료
1|4|프로젝트 KICK-OFF|CFT|사전준비|2025-08-22|2025-08-22|completed|프로젝트 KICK-OFF 회의록
1|5|사전품질계획 작성|CSM기술팀|1W / M+0|2025-08-29|2025-08-29|completed|사전품질계획서
1|6|과거차 문제점 체크리스트|CSM기술팀|5W / M+1|2025-09-26|2025-09-26|completed|과거차 문제점 체크리스트;개선 제안서
1|7|품질목표 설정|품질보증팀|7W / M+1.5|2025-10-10|2025-10-10|active|품질 목표;품질 확보 방안
1|8|CAPA 확보 계획 수립|생산기획팀|7W / M+1.5|2025-10-10|2025-10-10|completed|CAPA 확보 계획
1|9|신차 개발계획서 작성|CSM기술팀|7W / M+1.5|2025-10-10|2025-10-10|active|신차 개발 계획서
1|10|원부자재 업체 Bidding|사업팀|13W / M+3|2025-11-21|2025-11-21|completed|원부자재 업체 평가표;원부자재 업체 선정결과
2|11|신기술, 신공법, 신규자재 개발|CSM기술팀|7W~13W / M+1.5~3|2025-10-10|2025-11-21|completed|신기술·신공법·신규자재 개발 결과서
2|12|시작품 검사 협정|품질보증팀|15W / M+3.5|2025-12-05|2025-12-05|completed|시작품 검사 협정서
2|13|시작품 관리계획서 작성|CSM기술팀|17W~33W / M+4~8|2025-12-19|2026-04-10|active|시작품 관리계획서
2|14|SQ 인증 업체 운영 계획|사업팀|19W / M+4.5|2026-01-02|2026-01-02|completed|SQ 인증 업체 운영 계획서
2|15|시작품 검증|CSM기술팀|19W / M+4.5|2026-01-02|2026-01-02|active|시작품 검증 결과서
2|16|PROTO 제작 및 입고 대응|CSM기술팀|19W~ / M+4.5~|2026-01-02|2026-01-02|completed|PROTO 제작·입고 대응 기록
2|17|기술자료 배포 (PROTO 단계)|CSM기술팀|21W~33W / M+5~8|2026-01-16|2026-04-10|active|PROTO 기술자료 배포본
2|18|도면&부품 일치성 점검|CSM기술팀|25W / M+6|2026-02-13|2026-02-13|completed|도면·부품 일치성 점검표
2|19|공정 분석 활동 (PROTO)|CSM기술팀|33W / M+8|2026-04-10|2026-04-10|completed|PROTO 공정 분석 보고서
2|20|PROTO 완료보고|CSM기술팀|41W / M+10|2026-06-05|2026-06-05|completed|PROTO 완료보고서
3|21|협력사 선행 공정 점검|CSM기술팀|45W / M+11|2026-07-03|2026-07-03|completed|협력사 선행 공정 점검표
3|22|PILOT 커버링 지형도면 검토|CSM기술팀|45W / M+11|2026-07-03|2026-07-03|completed|PILOT 커버링 지형도면 검토서
3|23|공정 FMEA|CSM기술팀|45W / M+11|2026-07-03|2026-07-03|active|공정 FMEA
3|24|4M 준비 계획서|CSM기술팀|45W / M+11|2026-07-03|2026-07-03|active|4M 준비 계획서
3|25|양산 관리계획서|품질보증팀|47W~ / M+11.5~|2026-07-17|2026-07-17|completed|양산 관리계획서
3|26|검사기준 수립|품질보증팀|47W / M+11.5|2026-07-17|2026-07-17|active|검사기준서
3|27|검사협정 체결|품질보증팀|47W / M+11.5|2026-07-17|2026-07-17|completed|검사협정서
3|28|생산기술 신뢰성 확보 (양산점검회의)|천안운영팀|47W~ / M+11.5~|2026-07-17|2026-07-17|completed|양산점검회의 회의록
3|29|협력업체 공정감사 계획 수립|품질보증팀|47W / M+11.5|2026-07-17|2026-07-17|completed|협력업체 공정감사 계획서
3|30|포장/납품용기/팔레트 개발|천안운영팀|47W / M+11.5|2026-07-17|2026-07-17|completed|포장·납품용기·팔레트 개발 결과
3|31|P1 투입점검회의|CSM기술팀|51W / M+12.5|2026-08-14|2026-08-14|completed|P1 투입점검회의 회의록
3|32|P1 제작준비 및 제작|CFT|51W / M+12.5|2026-08-14|2026-08-14|completed|P1 제작 결과
3|33|PILOT 개발 수불관리|천안운영팀|51W / M+12.5|2026-08-14|2026-08-14|completed|PILOT 개발 수불대장
3|34|PILOT 과거차문제 실물반영 점검|품질보증팀|53W / M+13|2026-08-28|2026-08-28|completed|과거차문제 실물반영 점검표
4|35|해외공장 기술지원 및 점검|CSM기술팀|57W,73W / M+14,M+18|2026-09-25|2027-01-15|completed|해외공장 기술지원 점검표
4|36|P2 투입점검회의|CSM기술팀|61W / M+15|2026-10-23|2026-10-23|active|P2 투입점검회의 회의록
4|37|P2 제작준비 및 제작|CFT|61W / M+15|2026-10-23|2026-10-23|completed|P2 제작 결과
4|38|한계내구 및 악의조건시험|품질보증팀|63W~ / M+15.5~|2026-11-06|2026-11-06|completed|한계내구·악의조건시험 결과서
4|39|CAPA 확보 점검|천안운영팀|63W~ / M+15.5~|2026-11-06|2026-11-06|active|CAPA 확보 점검표
4|40|공정 감사 (협력사 및 고객사)|품질보증팀|63W / M+15.5|2026-10-23|2026-10-23|completed|공정 감사 보고서
4|41|원부자재 승인 및 도면 접수|CSM기술팀|67W / M+16.5|2026-12-04|2026-12-04|active|원부자재 승인서;접수 도면
4|42|초도품 승인 (부품 ISIR)|품질보증팀|69W / M+17|2026-12-18|2026-12-18|active|부품 ISIR 승인서
4|43|공정 분석 활동 (PILOT~M)|CSM기술팀|69W / M+17|2026-12-18|2026-12-18|completed|PILOT~M 공정 분석 보고서
4|44|PILOT 완료보고|CSM기술팀|69W / M+17|2026-12-18|2026-12-18|completed|PILOT 완료보고서
5|45|M 제작 준비 및 제작|천안운영팀|69W / M+17|2026-12-18|2026-12-18|completed|M 제작 결과
5|46|FULL CAPA 연속 생산 점검|천안운영팀|73W / M+18|2027-01-15|2027-01-15|active|FULL CAPA 연속 생산 점검표
6|47|양산 초도품 전수 검사|품질보증팀|73W~ / M+18~|2026-12-18|2026-12-18|completed|양산 초도품 전수 검사결과
6|48|품질·생산성 향상 활동|품질보증팀|73W / M+18|2026-12-18|2026-12-18|active|품질·생산성 향상 활동 보고서
6|49|新ISIR 18단계 최종 승인 및 입력|품질보증팀|73W / M+18|2026-12-18|2026-12-18|completed|新ISIR 18단계 최종 승인서
6|50|프로젝트 완료 보고|CSM기술팀|87W / M+21.5|2027-02-26|2027-02-26|active|프로젝트 완료보고서
`.trim();

const rows=raw.split("\n").map(line=>{const [gate,no,name,role,basis,start,end,status,outputs]=line.split("|");return {gate:Number(gate),no:Number(no),name,role,basis,start,end,status,outputs:outputs.split(";")}});
const businessDays=(start,end)=>{let cursor=new Date(`${start}T00:00:00Z`),last=new Date(`${end}T00:00:00Z`),days=0;while(cursor<=last){const day=cursor.getUTCDay();if(day!==0&&day!==6)days++;cursor.setUTCDate(cursor.getUTCDate()+1)}return Math.max(1,days)};
const categoryFor=name=>/fmea/i.test(name)?"QUALITY_FMEA":/isir/i.test(name)?"QUALITY_ISIR":/시험|검증|결과/i.test(name)?"QUALITY_TEST":/검사|품질/i.test(name)?"QUALITY_INSPECTION":/도면/i.test(name)?"DESIGN_DRAWING":/bom/i.test(name)?"DESIGN_BOM":/업체|협력/i.test(name)?"PURCHASE_VENDOR":/견적/i.test(name)?"PURCHASE_QUOTE":/공정|capa/i.test(name)?"PRODUCTION_PROCESS":/표준/i.test(name)?"PRODUCTION_STANDARD":/양산|이관/i.test(name)?"PRODUCTION_TRANSFER":/요구|분석/i.test(name)?"DEV_REQUIREMENT":/설계|사양/i.test(name)?"DEV_SPEC":/회의/i.test(name)?"PLAN_MEETING":/계획|착수/i.test(name)?"PLAN_DEV":/gate|승인/i.test(name)?"APPROVAL_GATE":/완료|보고/i.test(name)?"APPROVAL_FINAL":"COMMON_REFERENCE";
const simpleRole=value=>["PM","PL"].includes(value)?value:value.includes("품질")?"품질":/(사업|영업|기획|전략|CFT|BP)/.test(value)?"기획":/(자재|협력|외주)/.test(value)?"구매":/(생산|운영)/.test(value)?"생산":"개발";

export const csmDemo={
  templateCode:"CSM-NEW-CAR-R14",
  templateName:"CSM 신차 개발 표준 프로세스",
  templateVersion:"R14",
  projectCode:"CSM-DL3-PE2-DEMO",
  projectName:"코오롱인더스트리 CSM 신차개발 · DL3 PE2",
  customerName:"코오롱인더스트리",
  startDate:"2025-08-22",
  endDate:"2027-02-26",
  description:"고객 제공 CSM 신차 개발 추진 활동 대분류 및 Weekly Scheduler R14 기반 데모 프로젝트",
};

export const csmDefinition={
  description:"PSO 12단계 및 新 ISIR 18단계와 연계된 6 Gate·50개 활동 표준 템플릿",
  roles:["PM","PL","기획","개발","구매","생산","품질"],
  wbs:Array.from({length:6},(_,index)=>index+1).flatMap(gate=>[
    {id:`G${gate}`,level:1,kind:"summary",name:`G${gate} · ${gateNames[gate]}`,durationDays:0,role:"PM",completionCriteria:"CHILD_COMPLETE",sourceStatus:"active"},
    ...rows.filter(row=>row.gate===gate).map(row=>({
      id:`G${gate}-A${String(row.no).padStart(2,"0")}`,parentId:`G${gate}`,level:2,kind:"task",name:`${String(row.no).padStart(2,"0")}. ${row.name}`,
      taskType:"normal",durationDays:businessDays(row.start,row.end),plannedStart:row.start,plannedEnd:row.end,role:simpleRole(row.role),completionActor:"assignee",
      completionCriteria:"PROGRESS,REQUIRED_UPLOAD",deliverables:row.outputs.map(name=>({name,type:categoryFor(name),required:true})),sourceStatus:row.status,
    })),
    {id:`G${gate}-REVIEW`,parentId:`G${gate}`,level:2,kind:"task",name:`G${gate} Gate Review`,taskType:"gate",durationDays:1,plannedStart:gateReviewDates[gate],plannedEnd:gateReviewDates[gate],role:"PL",completionActor:"PL",completionCriteria:"PROGRESS,REQUIRED_APPROVAL,GATE_APPROVAL",deliverables:[{name:`G${gate} Gate 검토 체크리스트`,type:"APPROVAL_GATE",required:true}],sourceStatus:"active"},
  ]),
};
