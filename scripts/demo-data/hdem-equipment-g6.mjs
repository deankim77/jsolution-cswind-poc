export const hdemDemo={
  templateCode:"HDEM-EQUIPMENT-G6",
  templateName:"현대전기기계공업 표준 템플릿",
  templateVersion:"v1.0",
  projectCode:"HDEM-KOLON-MATERIAL-2026",
  projectName:"코오롱 화성공장 자동 원료공급 시스템 제작·설치",
  projectType:{code:"ORDER_EQUIPMENT_TURNKEY",name:"수주형 설비 제작·설치"},
  description:"수주형 자동화 설비의 수주·착수부터 기본/상세설계, 구매·제작·조립, FAT·출하, 현장 설치·시운전·인수까지 G1~G6 Gate로 관리하는 현대전기기계공업 데모 표준 템플릿",
  startDate:"2026-07-06",endDate:"2026-10-30",currentGate:4,
  equipmentType:"자동 원료공급 시스템",deliveryType:"Turn-key System",process:"플라스틱 사출성형",site:"화성공장",line:"사출 3~8호기",
};

export const gates=[
  {code:"G1",name:"수주·착수 승인",stage:"고객 요구와 계약조건 확정",decisionRole:"PM"},
  {code:"G2",name:"기본설계 승인",stage:"설비 구성과 기본사양 확정",decisionRole:"PL"},
  {code:"G3",name:"상세설계 승인",stage:"제작 가능한 수준의 도면·BOM 확정",decisionRole:"PL"},
  {code:"G4",name:"제작·조립 완료 승인",stage:"구매·가공·조립 및 자체 제작 완료",decisionRole:"PM"},
  {code:"G5",name:"FAT·출하 승인",stage:"사내 검사·시운전 및 출하 가능 상태 확정",decisionRole:"PM"},
  {code:"G6",name:"설치·인수 완료 승인",stage:"현장 설치·SAT·고객 검수 및 최종 인수",decisionRole:"PM"},
];

export const deliverables=[
  {task:"G1-A01",name:"고객 요구사항 정의서",category:"DEV_REQUIREMENT",required:true,uploaded:true},
  {task:"G1-A03",name:"프로젝트 착수보고서",category:"PLAN_DEV",required:true,uploaded:true},
  {task:"G1-R",name:"G1 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true,uploaded:false},
  {task:"G2-A02",name:"자동 원료공급 시스템 기본설계 사양서",category:"DEV_SPEC",required:true,uploaded:true},
  {task:"G2-A03",name:"설비 Layout 도면 HD-AL-001",category:"DRAWING",required:true,uploaded:true,documentKind:"drawing"},
  {task:"G2-A04",name:"원료 이송 계통도 HD-PF-002",category:"DRAWING",required:true,uploaded:true,documentKind:"drawing"},
  {task:"G2-R",name:"G2 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true,uploaded:false},
  {task:"G3-A01",name:"기계 상세설계 검토서",category:"DESIGN_MECHANICAL",required:true,uploaded:true},
  {task:"G3-A02",name:"전기·제어 설계 사양서",category:"DESIGN_ELECTRICAL",required:true,uploaded:true},
  {task:"G3-A02",name:"Control Panel 전기 개략도 HD-EL-003",category:"DRAWING",required:true,uploaded:true,documentKind:"drawing"},
  {task:"G3-A04",name:"제작 BOM 확정서",category:"BOM",required:true,uploaded:true},
  {task:"G3-A05",name:"PLC I/O List",category:"CONTROL_IO",required:true,uploaded:false},
  {task:"G3-R",name:"G3 Gate 검토 체크리스트",category:"APPROVAL_GATE",required:true,uploaded:false},
  {task:"G4-A05",name:"제작·조립 검사 체크리스트",category:"PRODUCTION_INSPECTION",required:true,uploaded:true},
  {task:"G4-A02",name:"구매품 납기 현황표",category:"PURCHASE_VENDOR",required:false,uploaded:false},
  {task:"G5-A03",name:"FAT 시험계획서 및 결과서",category:"QUALITY_TEST",required:true,uploaded:true},
  {task:"G5-A05",name:"출하검사 성적서",category:"QUALITY_INSPECTION",required:true,uploaded:false},
  {task:"G6-A01",name:"설치·시운전 계획서",category:"INSTALLATION",required:true,uploaded:true},
];

const A=(id,parentId,name,role,start,end,progress,status="planned",opts={})=>({id,parentId,level:2,kind:"task",name,taskType:opts.taskType||"normal",durationDays:opts.durationDays||1,plannedStart:start,plannedEnd:end,role,progress,status,completionActor:opts.completionActor||"assignee",completionCriteria:opts.criteria||`${name} 결과 확인 및 관련 산출물 등록`});
const S=(id,name,start,end)=>({id,parentId:null,level:1,kind:"summary",name,taskType:"phase",durationDays:1,plannedStart:start,plannedEnd:end,progress:0,status:"planned"});

const tasks=[
  S("G1","G1 수주·착수","2026-07-06","2026-07-17"),
  A("G1-A01","G1","고객 요구사항 확인 및 적용 범위 정의","SALES","2026-07-06","2026-07-07",100,"completed"),
  A("G1-A02","G1","계약 조건·납기·검수 조건 검토","PM","2026-07-07","2026-07-08",100,"completed"),
  A("G1-A03","G1","프로젝트 Kick-off 및 수행계획 수립","PM","2026-07-09","2026-07-10",100,"completed"),
  A("G1-A04","G1","현장 기초정보 및 Utility 조건 확인","MECHANICAL","2026-07-09","2026-07-13",100,"completed"),
  A("G1-A05","G1","프로젝트 조직·Role·커뮤니케이션 확정","PM","2026-07-13","2026-07-14",100,"completed"),
  A("G1-A06","G1","Master 일정 및 주요 Milestone 확정","PL","2026-07-14","2026-07-15",100,"completed"),
  A("G1-R","G1","G1 Gate 검토 및 착수 승인","PM","2026-07-16","2026-07-17",100,"completed",{taskType:"gate",completionActor:"pm"}),

  S("G2","G2 기본설계","2026-07-20","2026-07-31"),
  A("G2-A01","G2","설치 Site 및 대상 Line 상세 조사","MECHANICAL","2026-07-20","2026-07-21",100,"completed"),
  A("G2-A02","G2","시스템 구성 및 처리용량 기본설계","PL","2026-07-20","2026-07-23",100,"completed"),
  A("G2-A03","G2","설비 Layout 작성 및 간섭 검토","MECHANICAL","2026-07-22","2026-07-24",100,"completed"),
  A("G2-A04","G2","원료 이송·배관 계통 기본설계","MECHANICAL","2026-07-23","2026-07-27",100,"completed"),
  A("G2-A05","G2","주요 장비 사양 선정 및 Capacity 검토","PL","2026-07-24","2026-07-28",100,"completed"),
  A("G2-A06","G2","전원·제어·통신 인터페이스 기본설계","ELECTRICAL","2026-07-27","2026-07-29",100,"completed"),
  A("G2-A07","G2","고객 기본설계 Review 및 Comment 반영","PL","2026-07-29","2026-07-30",100,"completed"),
  A("G2-R","G2","G2 Gate 기본설계 승인","PM","2026-07-31","2026-07-31",100,"completed",{taskType:"gate",completionActor:"pm"}),

  S("G3","G3 상세설계","2026-08-03","2026-08-21"),
  A("G3-A01","G3","기계 상세설계 및 제작도 작성","MECHANICAL","2026-08-03","2026-08-10",100,"completed"),
  A("G3-A02","G3","전기 회로·Control Panel 상세설계","ELECTRICAL","2026-08-03","2026-08-11",100,"completed"),
  A("G3-A03","G3","PLC/HMI 제어 로직 상세설계","SW","2026-08-05","2026-08-13",100,"completed"),
  A("G3-A04","G3","제작 BOM 작성 및 구매/제작 구분 확정","DESIGN","2026-08-10","2026-08-14",100,"completed"),
  A("G3-A05","G3","I/O List 및 계장품 사양 확정","ELECTRICAL","2026-08-11","2026-08-14",100,"completed"),
  A("G3-A06","G3","도면 간 정합성 및 인터페이스 검토","PL","2026-08-17","2026-08-18",100,"completed"),
  A("G3-A07","G3","고객 상세설계 Review Comment 반영","PL","2026-08-18","2026-08-20",100,"completed"),
  A("G3-R","G3","G3 Gate 상세설계 승인","PM","2026-08-21","2026-08-21",100,"completed",{taskType:"gate",completionActor:"pm"}),

  S("G4","G4 구매·제작·조립","2026-08-17","2026-09-18"),
  A("G4-A01","G4","장기납기 구매품 선발주","PURCHASE","2026-08-17","2026-08-20",100,"completed"),
  A("G4-A02","G4","일반 구매품 발주 및 납기 추적","PURCHASE","2026-08-20","2026-09-04",72,"in_progress"),
  A("G4-A03","G4","외주 판금·가공품 제작 및 입고","PRODUCTION","2026-08-20","2026-09-03",58,"in_progress"),
  A("G4-A04","G4","자체 제작품 가공 및 용접","PRODUCTION","2026-08-24","2026-09-04",65,"in_progress"),
  A("G4-A05","G4","기계 Assembly 조립","MECHANICAL","2026-08-27","2026-09-09",45,"in_progress"),
  A("G4-A06","G4","Control Panel 제작 및 전장 조립","ELECTRICAL","2026-08-24","2026-09-08",38,"delayed"),
  A("G4-A07","G4","배관·배선 및 계장품 설치","PRODUCTION","2026-09-07","2026-09-11",0,"planned"),
  A("G4-A08","G4","PLC/HMI 프로그램 제작 및 Unit Test","SW","2026-08-24","2026-09-11",42,"delayed"),
  A("G4-A09","G4","제작 중간검사 및 부적합 조치","QUALITY","2026-09-10","2026-09-15",0,"planned"),
  A("G4-R","G4","G4 Gate 제작·조립 완료 승인","PM","2026-09-18","2026-09-18",0,"planned",{taskType:"gate",completionActor:"pm"}),

  S("G5","G5 검사·FAT·출하","2026-09-21","2026-10-02"),
  A("G5-A01","G5","전기 절연·통전 및 Safety Test","QUALITY","2026-09-21","2026-09-22",0,"planned"),
  A("G5-A02","G5","단독운전 및 Dry Run","SW","2026-09-22","2026-09-23",0,"planned"),
  A("G5-A03","G5","FAT 수행 및 성능 검증","QUALITY","2026-09-24","2026-09-25",0,"planned"),
  A("G5-A04","G5","Punch List 조치 및 재검증","PL","2026-09-28","2026-09-29",0,"planned"),
  A("G5-A05","G5","출하검사 및 고객 확인","QUALITY","2026-09-30","2026-09-30",0,"planned"),
  A("G5-A06","G5","포장·출하 및 현장 반입 준비","PRODUCTION","2026-10-01","2026-10-01",0,"planned"),
  A("G5-R","G5","G5 Gate FAT·출하 승인","PM","2026-10-02","2026-10-02",0,"planned",{taskType:"gate",completionActor:"pm"}),

  S("G6","G6 설치·시운전·인수","2026-10-05","2026-10-30"),
  A("G6-A01","G6","현장 설치계획 및 작업허가 확인","SERVICE","2026-10-05","2026-10-06",0,"planned"),
  A("G6-A02","G6","설비 반입·기계 설치 및 Leveling","MECHANICAL","2026-10-07","2026-10-12",0,"planned"),
  A("G6-A03","G6","현장 배관·전원·제어 배선 연결","ELECTRICAL","2026-10-12","2026-10-16",0,"planned"),
  A("G6-A04","G6","현장 시운전 및 실원료 Test","SW","2026-10-19","2026-10-21",0,"planned"),
  A("G6-A05","G6","SAT 및 고객 검수","QUALITY","2026-10-22","2026-10-23",0,"planned"),
  A("G6-A06","G6","운영·보전 교육","SERVICE","2026-10-26","2026-10-26",0,"planned"),
  A("G6-A07","G6","최종 도면·매뉴얼·예비품 List 제출","PL","2026-10-27","2026-10-28",0,"planned"),
  A("G6-A08","G6","잔여 Punch 조치 및 인수서 서명","PM","2026-10-29","2026-10-29",0,"planned"),
  A("G6-R","G6","G6 Gate 설치·인수 완료 승인","PM","2026-10-30","2026-10-30",0,"planned",{taskType:"gate",completionActor:"pm"}),
];

export const delayedTaskCodes=["G4-A06","G4-A08","G4-A03","G4-A05","G4-A02"];
export const equipmentBom=[
  {key:"ROOT",name:"자동 원료공급 시스템 ASSY",type:"ASSEMBLY",spec:"사출 3~8호기 Turn-key / 6 Line",unit:"SET",cost:0,parent:null,qty:1},
  {key:"STORAGE",name:"원료 저장·공급 Assembly",type:"SUB_ASSEMBLY",spec:"Silo/Hopper 공급부",unit:"SET",cost:0,parent:"ROOT",qty:1},
  {key:"TRANSFER",name:"Vacuum 이송 Assembly",type:"SUB_ASSEMBLY",spec:"6 Line 중앙 이송",unit:"SET",cost:0,parent:"ROOT",qty:1},
  {key:"DRYING",name:"제습·건조 Assembly",type:"SUB_ASSEMBLY",spec:"Dry Air -40°C DP",unit:"SET",cost:0,parent:"ROOT",qty:1},
  {key:"PIPING",name:"배관·Valve Assembly",type:"SUB_ASSEMBLY",spec:"SUS/Al 배관 및 전환밸브",unit:"LOT",cost:0,parent:"ROOT",qty:1},
  {key:"CONTROL",name:"전장·제어 Assembly",type:"SUB_ASSEMBLY",spec:"PLC/HMI/Power Panel",unit:"SET",cost:0,parent:"ROOT",qty:1},
  {key:"SILO",name:"원료 Silo 2㎥",type:"PART",spec:"SUS304 / Level Sensor",unit:"EA",cost:1850000,parent:"STORAGE",qty:2},
  {key:"HOPPER",name:"Machine Hopper 80L",type:"PART",spec:"SUS304 / Sight Glass",unit:"EA",cost:420000,parent:"STORAGE",qty:6},
  {key:"LEVEL",name:"Capacitive Level Sensor",type:"PART",spec:"M30 / PNP / 24VDC",unit:"EA",cost:98000,parent:"STORAGE",qty:8},
  {key:"BLOWER",name:"Vacuum Blower 7.5kW",type:"PART",spec:"Ring Blower / 380VAC",unit:"EA",cost:1680000,parent:"TRANSFER",qty:2},
  {key:"LOADER",name:"Vacuum Loader 50kg/h",type:"PART",spec:"Auto Loader / Filter Unit",unit:"EA",cost:690000,parent:"TRANSFER",qty:6},
  {key:"FILTER",name:"Vacuum Filter Cartridge",type:"PART",spec:"5㎛ Polyester",unit:"EA",cost:62000,parent:"TRANSFER",qty:12},
  {key:"DRYER",name:"Dehumidifying Dryer 120kg",type:"PART",spec:"-40°C Dew Point / 18kW",unit:"EA",cost:4900000,parent:"DRYING",qty:3},
  {key:"HEATER",name:"Dryer Heater 18kW",type:"PART",spec:"SUS Sheath Heater",unit:"EA",cost:540000,parent:"DRYING",qty:3},
  {key:"TEMP",name:"PT100 Temperature Sensor",type:"PART",spec:"PT100 3-wire",unit:"EA",cost:74000,parent:"DRYING",qty:6},
  {key:"PIPE50",name:"Aluminum Material Pipe Ø50",type:"PART",spec:"AL6063 / t2.0",unit:"M",cost:18500,parent:"PIPING",qty:120},
  {key:"PIPE38",name:"Aluminum Material Pipe Ø38",type:"PART",spec:"AL6063 / t2.0",unit:"M",cost:14800,parent:"PIPING",qty:180},
  {key:"VALVE",name:"Material Selector Valve",type:"PART",spec:"2-Way Pneumatic",unit:"EA",cost:385000,parent:"PIPING",qty:12},
  {key:"ELBOW",name:"Long Radius Elbow Ø50",type:"PART",spec:"Aluminum",unit:"EA",cost:42000,parent:"PIPING",qty:24},
  {key:"PLC",name:"PLC CPU Module",type:"PART",spec:"Ethernet / 4k Step 이상",unit:"EA",cost:1180000,parent:"CONTROL",qty:1},
  {key:"HMI",name:"HMI Touch Panel 12inch",type:"PART",spec:"Ethernet / TFT",unit:"EA",cost:980000,parent:"CONTROL",qty:1},
  {key:"INV",name:"Inverter 7.5kW",type:"PART",spec:"3PH 380V / Vector",unit:"EA",cost:640000,parent:"CONTROL",qty:2},
  {key:"IO",name:"Remote I/O Module",type:"PART",spec:"DI16/DO16",unit:"EA",cost:320000,parent:"CONTROL",qty:4},
  {key:"MCCB",name:"MCCB 3P 50AF",type:"PART",spec:"30A / 18kA",unit:"EA",cost:86000,parent:"CONTROL",qty:6},
  {key:"SMPS",name:"SMPS 24VDC 10A",type:"PART",spec:"DIN Rail",unit:"EA",cost:135000,parent:"CONTROL",qty:2},
  {key:"PANEL",name:"Control Panel Enclosure",type:"PART",spec:"W1200×H2000×D600 / IP54",unit:"EA",cost:1850000,parent:"CONTROL",qty:1},
];

export function buildHdemTemplate(){
  const outputsByTask=new Map();
  for(const d of deliverables)outputsByTask.set(d.task,[...(outputsByTask.get(d.task)||[]),{name:d.name,category:d.category,required:d.required,documentKind:d.documentKind||"document"}]);
  return {roles:["PM","PL","SALES","DESIGN","MECHANICAL","ELECTRICAL","SW","PURCHASE","PRODUCTION","QUALITY","SERVICE"],gates,wbs:tasks.map(t=>({...t,deliverables:outputsByTask.get(t.id)||[]}))};
}
