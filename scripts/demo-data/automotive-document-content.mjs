const gateStatus=(project,gate)=>gate<project.currentGate?"PASS":gate===project.currentGate?project.gateDecision:"PLANNED";
const verdictLabel={PASS:"승인",REVIEW:"검토 중",CONDITIONAL_PASS:"조건부 승인",REJECT:"반려",DEFER:"보류",PLANNED:"예정"};
const focusLabel={FLAME:"난연",ABRASION:"내마모",LIGHT:"내광성",FASTNESS:"마찰 견뢰도",VOC:"VOC·냄새",DIMENSION:"치수 안정성"};
const addDays=(iso,days)=>{const value=new Date(`${iso}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)};
const projectSuffix=project=>project.code.replace(/^AUTO-|\-DEMO$/g,"");

function testResult(project,code){
  const focused=project.riskFocus===code;
  const values={
    FLAME:focused?{target:"연소속도 100 mm/min 이하",actual:"108 mm/min",result:"미흡"}:{target:"연소속도 100 mm/min 이하",actual:"72 mm/min",result:"적합"},
    ABRASION:focused?{target:"50,000회 후 외관 4급 이상",actual:"47,500회에서 보풀 3급",result:"미흡"}:{target:"50,000회 후 외관 4급 이상",actual:"58,000회 후 외관 4.5급",result:"적합"},
    LIGHT:focused?{target:"내광 4급 이상",actual:"3.5급·색차 ΔE 1.9",result:"미흡"}:{target:"내광 4급 이상",actual:"4.5급·색차 ΔE 0.8",result:"적합"},
    FASTNESS:focused?{target:"건·습 마찰 4급 이상",actual:"건 4급·습 3급",result:"미흡"}:{target:"건·습 마찰 4급 이상",actual:"건 4.5급·습 4급",result:"적합"},
    VOC:focused?{target:"TVOC 50 μg/g 이하·냄새 3등급 이하",actual:"TVOC 64 μg/g·냄새 3.5등급",result:"미흡"}:{target:"TVOC 50 μg/g 이하·냄새 3등급 이하",actual:"TVOC 34 μg/g·냄새 2.5등급",result:"적합"},
    DIMENSION:focused?{target:"가열 수축률 ±1.5% 이내",actual:"경사 -1.2%·위사 -2.1%",result:"미흡"}:{target:"가열 수축률 ±1.5% 이내",actual:"경사 -0.8%·위사 -1.0%",result:"적합"},
  };
  return values[code]||{target:`${project.objective} 고객 기준 충족`,actual:"계획 기준과 시험 데이터를 검토함",result:focused?"보완 필요":"적합"};
}

function documentSpecific(project,blueprint){
  const test=testResult(project,blueprint.code),focus=focusLabel[project.riskFocus]||project.riskFocus;
  if(blueprint.category==="QUALITY_TEST")return {
    purpose:`본 문서는 ${project.name}의 ${blueprint.title.replace(" 결과서","")} 결과를 기록하고 G${blueprint.gate} 승인 가능 여부를 판단하기 위해 작성하였다. 시험편은 ${project.color} 양산 후보 원단이며 구성은 ${project.composition}, 기준 중량은 ${project.weightGsm}g/㎡, 두께는 ${project.thicknessMm}mm이다.`,
    findings:`고객 목표는 ${test.target}이며 실제 측정 결과는 ${test.actual}로 확인되었다. 종합 판정은 '${test.result}'이다. 동일 로트 3개 시험편의 편차와 시험설비 교정 상태를 함께 확인했으며 원자료는 시험 데이터 시트에 보관하였다.`,
    analysis:test.result==="적합"?`측정값이 관리 한계 안에 있고 외관 이상도 발견되지 않았다. 다만 ${focus} 특성은 프로젝트 핵심 관리항목이므로 양산 조건 확정 전 동일 조건 재현 시험을 1회 추가한다.`:`미흡 원인은 ${project.objective} 달성을 위해 조정한 소재 혼용률과 후가공 조건의 상호작용으로 판단한다. 원사 장력, 조직 밀도와 열처리 온도를 순서대로 조정하고 변경 전후 시험값을 비교한다.`,
  };
  if(blueprint.category==="APPROVAL_GATE"||blueprint.category==="APPROVAL_FINAL")return {
    purpose:`G${blueprint.gate} 단계의 활동·필수 산출물·오픈 이슈를 종합 검토하여 다음 단계 착수 가능 여부를 결정한다. 대상은 ${project.customerName} ${project.name}이며 현재 프로젝트의 공식 Gate 상태는 '${verdictLabel[gateStatus(project,blueprint.gate)]}'이다.`,
    findings:`필수 산출물 목록과 담당자 검토 기록을 대조하였다. ${blueprint.gate<project.currentGate?"이 단계의 필수 활동과 승인 조건은 모두 충족되었다.":blueprint.gate===project.currentGate?`${focus} 항목과 연결된 보완 조치의 완료 여부가 핵심 판단 조건이다.`:"선행 Gate가 승인되지 않았으므로 본 단계 활동은 시작 잠금 상태를 유지한다."}`,
    analysis:`Gate 결정은 진척률만으로 자동 산정하지 않는다. PM·PL의 승인 기록, 필수 산출물 등록·승인, 시험 미흡 항목의 조치 결과를 함께 확인하며 PASS 이외의 결정에서는 다음 단계 실행 Task를 해제하지 않는다.`,
  };
  return {
    purpose:`본 문서는 ${project.customerName}의 ${project.name} 개발 과정에서 ${blueprint.title}의 기준과 실행 결과를 정리하기 위해 작성하였다. 개발 목표는 ${project.objective}이며 적용 원단은 ${project.composition}, 색상 ${project.color}, 기준 중량 ${project.weightGsm}g/㎡, 두께 ${project.thicknessMm}mm이다.`,
    findings:`고객 요구사항, WBS 계획일, 담당 Role과 연계 산출물을 검토하였다. ${blueprint.gate<=project.currentGate?`G${blueprint.gate} 단계에서 확보된 실적과 검토 의견을 반영하였다.`:`G${blueprint.gate}는 선행 Gate 승인 후 착수하며 현재는 계획 기준을 유지한다.`} 주요 관리항목은 ${focus} 특성의 목표 달성과 데이터 재현성이다.`,
    analysis:`설계·시험·생산 조건 사이의 추적성을 확보하기 위해 변경 사유와 영향을 문서번호 기준으로 관리한다. 원단 명칭이나 사양이 변경되면 관련 시험 결과, 고객 평가와 양산 기준서를 함께 개정하고 Revision 이력을 남긴다.`,
  };
}

export function buildDeliverableDocument(project,blueprint){
  const suffix=projectSuffix(project),specific=documentSpecific(project,blueprint),status=gateStatus(project,blueprint.gate);
  const issueId=`ISS-${suffix}-G${blueprint.gate}-01`,riskId=`RSK-${suffix}-G${blueprint.gate}-01`,actionId=`COL-${suffix}-G${blueprint.gate}-01`;
  const documentDate=addDays(project.startDate,blueprint.gate*45+project.seedOrder);
  const decision=status==="PASS"?"승인 기준 충족":status==="PLANNED"?"선행 Gate 승인 후 실행":status==="REJECT"?"보완 완료 전 승인 불가":"보완 결과 확인 후 승인 결정";
  const sections=[
    {heading:"1. 목적 및 적용 범위",body:specific.purpose},
    {heading:"2. 검토·시험 결과",body:specific.findings},
    {heading:"3. 분석 및 판단",body:specific.analysis},
    {heading:"4. 이슈·리스크 연계",body:`본 산출물은 이슈 ${issueId}, 리스크 ${riskId}, 협업요청 ${actionId}와 연결한다. ${focusLabel[project.riskFocus]||project.riskFocus} 항목이 계획 기준을 벗어나면 담당자는 원인·조치·재확인 예정일을 갱신하고 PM은 Gate 영향도를 재평가한다. 대시보드에는 오픈 상태와 예정일 초과 여부를 표시한다.`},
    {heading:"5. 후속 조치",body:`담당 Role은 보완 자료와 시험 원자료를 ${addDays(documentDate,14)}까지 등록한다. PL은 변경된 수치와 고객 의견의 반영 여부를 확인하고 PM은 '${decision}' 원칙에 따라 G${blueprint.gate} 결정을 기록한다. 완료된 내용은 다음 Gate의 입력 자료와 AI 프로젝트 브리핑에 사용한다.`},
  ];
  const metadata={
    documentNumber:`${project.referenceCode}-G${blueprint.gate}-${blueprint.code}-R01`,revision:"Rev.01",date:documentDate,
    projectCode:project.code,projectName:project.name,customer:project.customerName,gate:`G${blueprint.gate}`,
    status:verdictLabel[status],owner:blueprint.category.startsWith("QUALITY")?"품질보증팀":blueprint.category.startsWith("PRODUCTION")?"생산기획팀":"소재개발팀",
    required:blueprint.required?"필수 산출물":"선택 산출물",
  };
  return {fileName:`${metadata.documentNumber}_${blueprint.title}.docx`,title:blueprint.title,subtitle:`${project.customerName} · ${project.name}`,metadata,sections,decision};
}

export const documentPlainText=document=>[
  document.title,document.subtitle,...Object.entries(document.metadata).map(([key,value])=>`${key}: ${value}`),
  ...document.sections.flatMap(section=>[section.heading,section.body]),`최종 판단: ${document.decision}`,
].join("\n");


