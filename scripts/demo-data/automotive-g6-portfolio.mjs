import {csmDefinition} from "./csm-new-car-r14.mjs";

export const automotiveDemo={
  templateCode:"AUTO-SEAT-FABRIC-G6",
  templateName:"G6-GATE 기반 자동차 시트 원단 개발 템플릿",
  templateVersion:"v1.1",
  projectType:{code:"AUTO_SEAT_FABRIC",name:"자동차 시트 원단 개발"},
  customers:[
    {code:"HYUNDAI",name:"현대자동차",englishName:"Hyundai Motor Company",country:"대한민국",industry:"자동차"},
    {code:"KIA",name:"기아자동차",englishName:"Kia Corporation",country:"대한민국",industry:"자동차"},
    {code:"RENAULT",name:"르노자동차",englishName:"Renault Korea",country:"대한민국",industry:"자동차"},
  ],
  description:"약 6개월 동안 자동차 시트 원단 개발의 6단계 실행 활동, 필수 산출물, 3영업일 Gate 승인과 양산 안정화를 관리하는 데모 표준 템플릿",
};

export const gateDefinitions=[
  {code:"G1",name:"개발 타당성 승인",stage:"개발 요구사항 및 타당성 검토",decisionRole:"PM"},
  {code:"G2",name:"원단 설계 승인",stage:"소재·조직·색상 및 시작품 설계",decisionRole:"PL"},
  {code:"G3",name:"시제품 검증 승인",stage:"시제품 제작 및 물성·신뢰성 검증",decisionRole:"PL"},
  {code:"G4",name:"고객 평가 승인",stage:"고객 평가·보완 및 사양 확정",decisionRole:"PM"},
  {code:"G5",name:"양산 준비 승인",stage:"공정·품질·CAPA 및 양산 준비",decisionRole:"PM"},
  {code:"G6",name:"양산 안정화 승인",stage:"초기 양산 품질 안정화 및 최종 이관",decisionRole:"PM"},
];

export const deliverableBlueprints=[
  {gate:1,code:"REQ",title:"고객 요구사항 정의서",category:"DEV_REQUIREMENT",required:true},
  {gate:1,code:"FEAS",title:"개발 타당성 검토서",category:"PLAN_DEV",required:true},
  {gate:1,code:"TARGET",title:"품질 목표 및 검증 계획서",category:"QUALITY_PLAN",required:true},
  {gate:1,code:"COST",title:"목표 원가 검토서",category:"COST_REVIEW",required:false},
  {gate:1,code:"GATE",title:"G1 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true},
  {gate:2,code:"SPEC",title:"원단 설계 사양서",category:"DEV_SPEC",required:true},
  {gate:2,code:"MATERIAL",title:"소재 구성 및 혼용률 검토서",category:"DEV_MATERIAL",required:true},
  {gate:2,code:"COLOR",title:"컬러 배합 및 감성 품질 기준서",category:"DESIGN_COLOR",required:true},
  {gate:2,code:"SAMPLE",title:"시작품 제작 계획서",category:"PLAN_SAMPLE",required:true},
  {gate:2,code:"GATE",title:"G2 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true},
  {gate:3,code:"FLAME",title:"난연 시험 결과서",category:"QUALITY_TEST",required:true},
  {gate:3,code:"ABRASION",title:"내마모 시험 결과서",category:"QUALITY_TEST",required:true},
  {gate:3,code:"LIGHT",title:"내광성 시험 결과서",category:"QUALITY_TEST",required:true},
  {gate:3,code:"FASTNESS",title:"마찰 견뢰도 시험 결과서",category:"QUALITY_TEST",required:true},
  {gate:3,code:"VOC",title:"VOC 및 냄새 시험 결과서",category:"QUALITY_TEST",required:true},
  {gate:3,code:"DIMENSION",title:"치수 안정성 시험 결과서",category:"QUALITY_TEST",required:false},
  {gate:3,code:"GATE",title:"G3 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true},
  {gate:4,code:"CUSTOMER",title:"고객 샘플 평가서",category:"CUSTOMER_REVIEW",required:true},
  {gate:4,code:"ACTION",title:"평가 미흡 항목 보완 조치서",category:"QUALITY_ACTION",required:true},
  {gate:4,code:"FREEZE",title:"최종 사양 확정서",category:"DEV_SPEC",required:true},
  {gate:4,code:"GATE",title:"G4 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true},
  {gate:5,code:"PROCESS",title:"양산 공정 조건서",category:"PRODUCTION_PROCESS",required:true},
  {gate:5,code:"INSPECTION",title:"양산 검사 기준서",category:"QUALITY_INSPECTION",required:true},
  {gate:5,code:"CAPA",title:"FULL CAPA 검증 결과서",category:"PRODUCTION_CAPA",required:true},
  {gate:5,code:"SUPPLIER",title:"협력사 공정 감사 보고서",category:"PURCHASE_VENDOR",required:false},
  {gate:5,code:"GATE",title:"G5 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true},
  {gate:6,code:"INITIAL",title:"초기 양산품 전수 검사 결과서",category:"QUALITY_INSPECTION",required:true},
  {gate:6,code:"STABILITY",title:"품질 안정화 활동 보고서",category:"QUALITY_ACTION",required:true},
  {gate:6,code:"TRANSFER",title:"양산 이관 확인서",category:"PRODUCTION_TRANSFER",required:true},
  {gate:6,code:"FINAL",title:"프로젝트 완료보고서 및 G6 승인서",category:"APPROVAL_FINAL",required:true},
];

const profiles=[
  ["HY-01","HYUNDAI","친환경 바이오 시트 원단 개발",2,"PASS","바이오 PET 38%·재활용 PET 42%·PU 20%","웜그레이","저탄소와 촉감 균형","VOC","2026-02-02","2026-07-31",420,1.15],
  ["HY-02","HYUNDAI","프리미엄 저광택 시트 원단 개발",3,"REVIEW","PET 72%·나일론 18%·PU 10%","차콜블랙","저광택 프리미엄 표면","ABRASION","2025-12-15","2026-06-12",445,1.28],
  ["HY-03","HYUNDAI","고내구성 스포츠 시트 원단 개발",3,"CONDITIONAL_PASS","고강력 PET 64%·나일론 26%·PU 10%","딥레드","측면 마찰 내구성","ABRASION","2025-11-03","2026-05-01",470,1.35],
  ["HY-04","HYUNDAI","난연 안전 시트 원단 개발",4,"REVIEW","난연 PET 76%·모다크릴 18%·PU 6%","다크그레이","난연성과 연기 저감","FLAME","2025-09-01","2026-02-27",455,1.31],
  ["HY-05","HYUNDAI","통기성 컴포트 시트 원단 개발",4,"PASS","PET 58%·메시 나일론 32%·PU 10%","라이트베이지","통기성과 장시간 착좌감","DIMENSION","2025-08-04","2026-01-30",390,1.08],
  ["HY-06","HYUNDAI","재활용 PET 시트 원단 개발",5,"REVIEW","재활용 PET 82%·나일론 12%·PU 6%","오션블루","재활용 함량과 품질 안정성","FASTNESS","2025-06-02","2025-11-28",430,1.22],
  ["HY-07","HYUNDAI","저VOC 항균 시트 원단 개발",6,"REVIEW","저VOC PET 68%·항균 나일론 22%·PU 10%","미스트그레이","냄새와 세균 증식 억제","VOC","2025-03-03","2025-08-29",410,1.17],
  ["KI-01","KIA","초경량 니트 시트 원단 개발",1,"REVIEW","고강력 PET 70%·경량 나일론 24%·PU 6%","스톤그레이","중량 절감과 인장강도","DIMENSION","2026-05-04","2026-10-30",350,0.96],
  ["KI-02","KIA","투톤 패턴 시트 원단 개발",2,"REVIEW","PET 74%·원착사 18%·PU 8%","블랙·오프화이트","패턴 정합과 색차 관리","LIGHT","2026-03-02","2026-08-28",425,1.19],
  ["KI-03","KIA","발수·방오 시트 원단 개발",3,"REJECT","PET 66%·나일론 24%·불소대체 코팅 10%","브라운","친환경 발수와 오염 제거성","FASTNESS","2025-12-01","2026-05-29",440,1.25],
  ["KI-04","KIA","전기차 저탄소 시트 원단 개발",4,"CONDITIONAL_PASS","재활용 PET 78%·바이오 PU 14%·나일론 8%","세이지그린","탄소 저감과 내광성","LIGHT","2025-08-18","2026-02-13",405,1.12],
  ["KI-05","KIA","고탄성 쿠션커버 시트 원단 개발",5,"REVIEW","탄성 PET 54%·나일론 30%·PU 16%","네이비","반복 착좌 복원력","ABRASION","2025-05-05","2025-10-31",465,1.34],
  ["RE-01","RENAULT","유럽향 난연 시트 원단 개발",1,"DEFER","난연 PET 72%·모다크릴 20%·PU 8%","유로차콜","유럽 난연 규격 대응","FLAME","2026-06-01","2026-11-27",450,1.29],
  ["RE-02","RENAULT","친환경 스웨이드 시트 원단 개발",2,"REVIEW","재활용 PET 극세사 84%·바이오 PU 16%","샌드베이지","스웨이드 감성과 재활용성","VOC","2026-03-16","2026-09-11",415,1.16],
  ["RE-03","RENAULT","고내광성 패브릭 시트 원단 개발",6,"PASS","원착 PET 76%·UV 안정 나일론 18%·PU 6%","클라우드그레이","고온 지역 내광성과 색차 안정","LIGHT","2025-02-03","2025-08-01",435,1.23],
];

const customerName=code=>automotiveDemo.customers.find(item=>item.code===code)?.name||code;
export const automotiveProjects=profiles.map(([suffix,customerCode,name,currentGate,gateDecision,composition,color,objective,riskFocus,startDate,endDate,weightGsm,thicknessMm],index)=>({
  code:`AUTO-${suffix}-DEMO`,referenceCode:`SEAT-FABRIC-${suffix}`,customerCode,customerName:customerName(customerCode),name,
  currentGate,gateDecision,composition,color,objective,riskFocus,startDate,endDate,weightGsm,thicknessMm,
  projectStatus:currentGate===6&&gateDecision==="PASS"?"completed":"active",
  sopDate:endDate,seedOrder:index+1,
}));

const stageTasks=gate=>csmDefinition.wbs.filter(item=>item.parentId===`G${gate}`&&item.id!==`G${gate}-REVIEW`);
const DAY_MS=24*60*60*1000;
const TEMPLATE_START="2026-01-05";
const gateLengths={1:20,2:30,3:25,4:25,5:15,6:15};
const activityPlans={
  1:[[0,2],[2,4],[2,6],[6,3],[9,4],[13,2],[15,2],[13,4],[13,4],[15,2]],
  2:[[0,7],[0,3],[3,4],[0,5],[7,3],[10,4],[14,4],[18,3],[21,3],[24,3]],
  3:[[0,4],[0,5],[0,4],[0,4],[4,4],[8,4],[12,3],[4,5],[4,5],[4,5],[9,4],[13,4],[13,5],[17,5]],
  4:[[0,8],[0,3],[3,5],[8,7],[8,5],[0,6],[6,5],[11,4],[15,4],[19,3]],
  5:[[0,6],[6,6]],
  6:[[0,4],[4,5],[4,4],[8,4]],
};
const standardPredecessors=[
  ["G1-A02","G1-A01"],["G1-A03","G1-A01"],["G1-A04","G1-A02"],["G1-A05","G1-A04"],["G1-A06","G1-A05"],
  ["G1-A07","G1-A06"],["G1-A08","G1-A05"],["G1-A09","G1-A05"],["G1-A10","G1-A06"],["G1-REVIEW","G1-A10"],
  ["G2-A11","G1-REVIEW"],["G2-A12","G1-REVIEW"],["G2-A13","G2-A12"],["G2-A14","G1-REVIEW"],["G2-A15","G2-A13"],
  ["G2-A16","G2-A15"],["G2-A17","G2-A16"],["G2-A18","G2-A17"],["G2-A19","G2-A18"],["G2-A20","G2-A19"],["G2-REVIEW","G1-REVIEW"],
  ["G3-A21","G2-REVIEW"],["G3-A22","G2-REVIEW"],["G3-A23","G2-REVIEW"],["G3-A24","G2-REVIEW"],["G3-A25","G3-A23"],
  ["G3-A26","G3-A25"],["G3-A27","G3-A26"],["G3-A28","G3-A24"],["G3-A29","G3-A23"],["G3-A30","G3-A24"],
  ["G3-A31","G3-A28"],["G3-A32","G3-A31"],["G3-A33","G3-A31"],["G3-A34","G3-A32"],["G3-REVIEW","G2-REVIEW"],
  ["G4-A35","G3-REVIEW"],["G4-A36","G3-REVIEW"],["G4-A37","G4-A36"],["G4-A38","G4-A37"],["G4-A39","G4-A37"],
  ["G4-A40","G3-REVIEW"],["G4-A41","G4-A40"],["G4-A42","G4-A41"],["G4-A43","G4-A38"],["G4-A44","G4-A43"],["G4-REVIEW","G3-REVIEW"],
  ["G5-A45","G4-REVIEW"],["G5-A46","G5-A45"],["G5-REVIEW","G4-REVIEW"],
  ["G6-A47","G5-REVIEW"],["G6-A48","G6-A47"],["G6-A49","G6-A47"],["G6-A50","G6-A49"],["G6-REVIEW","G5-REVIEW"],
];
const businessDate=(start,offset)=>{
  const cursor=new Date(`${start}T00:00:00Z`);
  let remaining=offset;
  while(remaining>0){cursor.setUTCDate(cursor.getUTCDate()+1);const day=cursor.getUTCDay();if(day!==0&&day!==6)remaining--}
  return cursor.toISOString().slice(0,10);
};
const gateOffset=gate=>Array.from({length:gate-1},(_,index)=>gateLengths[index+1]).reduce((sum,value)=>sum+value,0);
export function buildAutomotiveTemplate(){
  const predecessorByCode=new Map(standardPredecessors);
  return {
    description:automotiveDemo.description,
    roles:csmDefinition.roles,
    gatePolicy:{decisionRequired:true,startUnlockDecision:"PASS",conditionalPassUnlocks:false,rejectRequiresRework:true},
    gates:gateDefinitions,
    wbs:csmDefinition.wbs.map(item=>{
      const gate=Number(item.id.match(/^G(\d)/)?.[1]||0);
      const review=item.id.endsWith("-REVIEW");
      const activities=gate?stageTasks(gate):[],stageCodes=activities.map(task=>task.id);
      const activityIndex=activities.findIndex(task=>task.id===item.id);
      const stageBlueprints=deliverableBlueprints.filter(output=>output.gate===gate);
      const reviewBlueprint=stageBlueprints.find(output=>output.code==="GATE"||output.code==="FINAL");
      const activityBlueprints=stageBlueprints.filter(output=>output!==reviewBlueprint);
      const assignedBlueprints=review?(reviewBlueprint?[reviewBlueprint]:[]):activityIndex>=0?activityBlueprints.filter((_,index)=>index%Math.max(1,activities.length)===activityIndex):[];
      const stageStart=gateOffset(gate);
      const [relativeStart,durationDays]=review?[gateLengths[gate]-3,3]:(activityPlans[gate]?.[activityIndex]||[0,1]);
      const plannedStart=gate?businessDate(TEMPLATE_START,stageStart+relativeStart):undefined;
      const plannedEnd=gate?businessDate(plannedStart,durationDays-1):undefined;
      return {
        ...item,
        name:review?`${gateDefinitions[gate-1].code} Gate Review · ${gateDefinitions[gate-1].name}`:item.name,
        durationDays:gate?durationDays:item.durationDays,
        plannedStart,
        plannedEnd,
        predecessor:predecessorByCode.get(item.id),
        dependencyType:predecessorByCode.has(item.id)?"FS":undefined,
        dependencyConstraint:predecessorByCode.has(item.id)?"HARD":undefined,
        gatePolicy:review?{gateCode:`G${gate}`,requiredTaskCodes:stageCodes,requiredDeliverables:true,allowedDecision:["PASS"]}:undefined,
        deliverables:assignedBlueprints.map(output=>({name:output.title,type:output.category,required:output.required})),
      };
    }),
  };
}

export const demoRecordPlan={
  deliverablesPerProject:deliverableBlueprints.length,
  totalDeliverables:deliverableBlueprints.length*automotiveProjects.length,
  recordsPerProject:{issues:2,risks:2,collaborationRequests:2},
  totalOperationalRecords:automotiveProjects.length*6,
  documentBodyLength:{minKoreanCharacters:600,maxKoreanCharacters:1200},
};
