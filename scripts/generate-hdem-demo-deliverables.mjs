import {rm,writeFile,mkdir} from "node:fs/promises";
import {resolve,join} from "node:path";
import {hdemDemo,deliverables,equipmentBom} from "./demo-data/hdem-equipment-g6.mjs";
import {writeBusinessBriefDocx} from "./lib/minimal-docx.mjs";

const out=resolve(process.env.HDEM_DOCS_DIR||".demo-generated/hdem-equipment-g6");
if(process.argv.includes("--clean"))await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
const uploaded=deliverables.filter(item=>item.uploaded);
const gateOf=task=>Number(task.match(/^G(\d)/)?.[1]||0);
const ownerFor=task=>task.startsWith("G1")?"프로젝트팀":task.startsWith("G2")?"기계설계팀":task.startsWith("G3")?"설계팀":task.startsWith("G4")?"생산팀":task.startsWith("G5")?"품질팀":"서비스팀";
const safe=value=>value.replace(/[\\/:*?"<>|]/g,"_");
const project={...hdemDemo,code:`${hdemDemo.projectCode}-DEMO`,name:hdemDemo.projectName,customerName:"코오롱인더스트리"};

function sectionsFor(item){
  const common=`본 문서는 ${project.name}의 ${item.name} 산출물로, ${project.equipmentType}을 ${project.site} ${project.line}에 설치하기 위한 기술·품질 기준을 정의한다. 프로젝트는 ${project.deliveryType} 방식으로 수행하며 ${project.process} 공정의 원료 저장, 제습·건조, 진공 이송, 배관 전환 및 PLC/HMI 통합 제어를 포함한다.`;
  const map={
    "고객 요구사항 정의서":["원료 종류 PET/PA/PC 계열, 대상 사출기 6대, 시간당 최대 이송량 600kg/h를 기준으로 한다. 원료 혼입 방지, 설비 정지 최소화, 분진 저감과 유지보수 접근성을 고객 핵심 요구로 정의한다.","공급 범위는 원료 저장부, 제습건조기 3대, Vacuum Loader 6대, Blower 2대, Selector Valve 12대, 이송배관, Control Panel 및 PLC/HMI 프로그램을 포함한다. 공장 전원은 AC 380V 3상, 제어전원은 DC24V를 기준으로 한다.","검수는 FAT와 현장 SAT 두 단계로 수행한다. FAT에서는 자동/수동 운전, 인터록, Alarm, 이송능력과 안전회로를 검증하고 SAT에서는 실제 원료를 사용하여 6개 Line의 연속 운전과 작업자 교육을 완료한다."],
    "프로젝트 착수보고서":["수주 후 G1~G6 Stage-Gate 방식으로 프로젝트를 수행한다. G1 요구·계약 확정, G2 기본설계, G3 상세설계 및 BOM 확정, G4 구매·제작·조립, G5 FAT·출하, G6 설치·시운전·인수 순으로 운영한다.","PM은 일정·Gate·고객 의사결정을 총괄하고 PL은 기계·전기·제어 설계 정합성을 관리한다. 구매, 생산, 품질, 설치 담당자는 WBS Task와 연결된 산출물 및 이슈를 프로젝트 시스템에 등록한다.","주요 리스크는 장기납기 전장품 조달, 외주 판금가공 입고 지연, 현장 배관 간섭, PLC I/O 변경이다. 주간 단위로 계획 대비 지연 Task를 확인하고 Gate 승인 전 필수 산출물 누락 여부를 점검한다."],
    "자동 원료공급 시스템 기본설계 사양서":["시스템은 중앙 저장 Silo에서 원료를 공급하고 제습건조 후 Vacuum 방식으로 사출기별 Hopper에 이송한다. 각 Line은 Selector Valve를 통해 원료 공급원을 전환하며 PLC가 Blower와 Loader의 운전 순서를 제어한다.","설계 처리용량은 전체 600kg/h, 개별 Line 최대 100kg/h를 기준으로 한다. Dry Air 노점은 -40°C 수준, 건조온도는 원료별 Recipe로 관리하고 배관은 Ø38/Ø50 Aluminum Pipe를 사용한다.","제어반은 PLC CPU, 12인치 HMI, Remote I/O, Inverter를 포함하며 Ethernet 기반으로 주요 상태와 Alarm을 모니터링한다. Emergency Stop과 Overload, 원료 부족, Filter 막힘 등 안전·보전 인터록을 기본 적용한다."],
    "기계 상세설계 검토서":["Silo, Hopper, Blower, Dryer, 배관 Support와 Valve 설치 위치를 상세도 기준으로 검토하였다. 유지보수 공간 600mm 이상 확보, Filter 교환 동선, 배관 분해 구간과 점검 Door 접근성을 설계 기준으로 적용한다.","배관 Routing은 곡률반경을 확보하고 불필요한 Elbow를 최소화하여 압력손실과 원료 파손을 줄인다. 주요 지지대는 현장 구조물과 간섭이 없도록 설치 기준점을 정의하고 Leveling 가능 구조를 적용한다.","제작도 배포 전 Layout, 원료이송 계통도와 BOM의 품번·수량을 상호 대조한다. 변경 발생 시 영향 받는 Assembly와 도면을 설계변경 대상으로 등록하고 Revision 이력을 남긴다."],
    "전기·제어 설계 사양서":["Control Panel은 AC380V 동력부와 DC24V 제어부를 분리 구성한다. Blower 7.5kW 2대는 Inverter 제어하고 Dryer, Loader, Valve, Level Sensor 신호를 PLC I/O에 연결한다.","운전모드는 Auto/Manual/Maintenance로 구성한다. Auto 모드에서는 Hopper Low Level 요청에 따라 대상 Line을 선택하고 Valve 전환 확인 후 Blower와 Loader를 순차 기동한다. 이상 신호 발생 시 관련 장비를 정지하고 HMI에 원인과 조치 가이드를 표시한다.","FAT 전 I/O Check, Motor Rotation, E-Stop, Overload, Sensor Simulation을 완료한다. 프로그램 변경은 Version과 변경사유를 기록하며 최종 인수 시 PLC/HMI Backup 파일과 I/O List를 고객에게 제출한다."],
    "제작 BOM 확정서":[`Top Assembly는 자동 원료공급 시스템 ASSY이며 하위에 원료 저장·공급, Vacuum 이송, 제습·건조, 배관·Valve, 전장·제어 Assembly를 구성한다. 현재 기준 Part는 ${equipmentBom.length}종이며 구매품과 제작품을 구분하여 발주·가공 계획에 연결한다.`,`주요 구매품은 PLC CPU, HMI, Inverter, Blower, Vacuum Loader, Dryer, Level Sensor와 Selector Valve이다. 장기납기 품목은 선발주 대상으로 관리하고 입고예정일 변경 시 G4 일정 영향도를 즉시 검토한다.`,`BOM 수량은 프로젝트 설계 기준으로 확정하며 도면 Revision과 BOM Revision의 정합성을 유지한다. 대체품 사용 시 전기 정격, 통신, 설치치수와 성능을 검토하고 PL 승인 후 BOM을 변경한다.`],
    "제작·조립 검사 체크리스트":["기계 조립은 Frame 수평, Bolt 체결, Hopper 및 Valve 방향, 배관 Support, Flexible Hose 연결 상태를 확인한다. Sharp Edge와 간섭, 누락 Cover 여부를 점검하고 부적합은 Punch 항목으로 등록한다.","전장 조립은 Cable Marking, Terminal 체결, 접지, 차단기 정격, 동력·제어 배선 분리 및 Panel 내부 이물 제거 상태를 확인한다. 배선 변경 사항은 전기도면 Red Mark 후 Revision에 반영한다.","중간검사 결과 주요 부적합은 즉시 생산 담당자에게 조치 요청하고 재검사 완료일을 기록한다. FAT 착수 전 Critical Punch는 0건이어야 하며 Minor Punch는 담당자와 완료예정일이 지정되어야 한다."],
    "FAT 시험계획서 및 결과서":["FAT는 외관·조립검사, 절연/통전, I/O Check, 안전회로, Manual 운전, Auto Sequence, Alarm/Interlock, 연속운전 순서로 수행한다. 시험 전 최신 도면·BOM·PLC Version을 기준선으로 확정한다.","성능시험은 6개 Line의 이송 요청을 순차 및 동시 조건으로 발생시켜 Valve 전환, Vacuum 형성, Loader 충진과 Level 복귀를 확인한다. 비상정지와 Sensor Fault를 인위적으로 발생시켜 안전정지 및 Alarm 표시를 검증한다.","현재 사내 예비시험 결과 기본 Sequence는 정상이며 일부 Panel 배선 Label과 PLC I/O Comment 수정 항목을 Punch로 관리 중이다. 공식 FAT 시 고객 입회 결과와 조치 내역을 최종 결과서에 반영한다."],
    "설치·시운전 계획서":["현장 반입 전 설치 위치, 반입 동선, Crane/Forklift 사용조건, 작업허가와 전원·Air Utility 준비 상태를 확인한다. 설비 반입 후 Leveling, Anchor, 배관, 전원·제어 배선을 순차 수행한다.","Cold Commissioning에서 전원, I/O, Motor, Valve와 통신을 확인한 후 실제 원료를 투입하여 Hot Commissioning을 진행한다. Line별 원료 전환, 이송량, 건조조건과 Alarm 복구를 확인하고 SAT Check Sheet에 기록한다.","고객 검수 완료 후 운영자에게 Auto/Manual 운전, Recipe 변경, Alarm 조치, Filter 청소와 정기점검 방법을 교육한다. 최종 도면, 매뉴얼, PLC/HMI Backup, Spare Part List를 제출하고 잔여 Punch 완료 후 인수 서명을 받는다."],
  };
  const details=map[item.name]||["해당 Task의 계획, 실행 기준과 검토 결과를 기록한다.","관련 도면·BOM·이슈와 추적 가능하도록 문서번호와 Revision을 관리한다.","미완료 조치는 담당자와 완료예정일을 지정하고 Gate 검토 시 상태를 확인한다."];
  return [
    {heading:"1. 목적 및 적용 범위",body:common},
    {heading:"2. 주요 기준",body:details[0]},
    {heading:"3. 설계·실행 내용",body:details[1]},
    {heading:"4. 검토 결과 및 관리사항",body:details[2]},
    {heading:"5. 승인 및 후속조치",body:`본 산출물은 ${item.task} Task에 연결하여 관리한다. 담당자는 변경사항과 관련 이슈를 반영하고 PL 검토 후 다음 Gate 입력자료로 사용한다. 필수 산출물의 경우 Gate 승인 전 등록·검토 상태를 확인한다.`},
  ];
}

function svgSheet(item){
  const title=item.name,code=title.match(/HD-[A-Z]+-\d+/)?.[0]||"HD-DWG-001";
  const header=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="white"/><g stroke="#111" fill="none" stroke-width="2"><rect x="25" y="25" width="1550" height="850"/><rect x="1160" y="730" width="415" height="145"/><line x1="1160" y1="775" x2="1575" y2="775"/><line x1="1160" y1="820" x2="1575" y2="820"/></g><g font-family="Arial, Noto Sans KR, sans-serif" fill="#111"><text x="45" y="62" font-size="28" font-weight="700">${title}</text><text x="1180" y="760" font-size="18">DWG NO. ${code} / REV.A</text><text x="1180" y="805" font-size="16">PROJECT: KOLON MATERIAL SUPPLY</text><text x="1180" y="850" font-size="16">현대전기기계공업 표준 데모</text></g>`;
  let body="";
  if(code==="HD-AL-001")body=`<g stroke="#222" fill="none" stroke-width="3"><rect x="90" y="130" width="220" height="180"/><rect x="380" y="130" width="220" height="180"/><rect x="680" y="130" width="180" height="180"/><rect x="930" y="130" width="180" height="180"/><rect x="90" y="430" width="1020" height="180"/><line x1="310" y1="220" x2="380" y2="220"/><line x1="600" y1="220" x2="680" y2="220"/><line x1="860" y1="220" x2="930" y2="220"/><line x1="1020" y1="310" x2="1020" y2="430"/></g><g font-family="Arial, Noto Sans KR, sans-serif" font-size="22" fill="#111"><text x="135" y="225">SILO #1/#2</text><text x="410" y="225">DRYER #1~#3</text><text x="710" y="225">BLOWER</text><text x="955" y="225">PANEL</text><text x="350" y="525">사출기 3~8호기 / MACHINE HOPPER &amp; LOADER</text></g>`;
  else if(code==="HD-PF-002")body=`<defs><marker id="a" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#111"/></marker></defs><g stroke="#222" fill="white" stroke-width="3"><rect x="100" y="180" width="180" height="130"/><rect x="390" y="180" width="180" height="130"/><circle cx="720" cy="245" r="70"/><rect x="870" y="180" width="180" height="130"/><rect x="1160" y="150" width="220" height="190"/><path d="M280 245 H390 M570 245 H650 M790 245 H870 M1050 245 H1160" marker-end="url(#a)"/></g><g font-family="Arial, Noto Sans KR, sans-serif" font-size="22" fill="#111"><text x="145" y="250">SILO</text><text x="425" y="250">DRYER</text><text x="680" y="252">BLOWER</text><text x="900" y="250">SELECTOR</text><text x="1190" y="230">LOADER #1~#6</text><text x="1190" y="270">HOPPER</text></g>`;
  else body=`<g stroke="#222" fill="white" stroke-width="3"><rect x="120" y="130" width="240" height="500"/><rect x="430" y="130" width="260" height="500"/><rect x="760" y="130" width="260" height="500"/><rect x="1090" y="130" width="300" height="500"/><line x1="360" y1="240" x2="430" y2="240"/><line x1="690" y1="240" x2="760" y2="240"/><line x1="1020" y1="240" x2="1090" y2="240"/></g><g font-family="Arial, Noto Sans KR, sans-serif" font-size="22" fill="#111"><text x="190" y="190">MAIN POWER</text><text x="475" y="190">PLC / I/O</text><text x="805" y="190">INVERTER</text><text x="1160" y="190">FIELD I/O</text><text x="165" y="280">MCCB / SMPS</text><text x="485" y="280">CPU + REMOTE</text><text x="815" y="280">BLOWER #1/#2</text><text x="1140" y="280">SENSOR / VALVE</text><text x="485" y="400">HMI 12 inch</text></g>`;
  return `${header}${body}</svg>`;
}

const manifest=[];
for(const item of uploaded){
  const gate=gateOf(item.task),dir=join(out,`G${gate}`);await mkdir(dir,{recursive:true});
  if(item.documentKind==="drawing"){
    const fileName=`${safe(item.name)}_RevA.svg`,path=join(dir,fileName),content=svgSheet(item);await writeFile(path,content,"utf8");
    manifest.push({...item,gate:`G${gate}`,fileName,path,mime:"image/svg+xml",bodyLength:content.length});continue;
  }
  const metadata={documentNumber:`HDEM-${item.task}-${String(gate).padStart(2,"0")}`,revision:"Rev.01",date:"2026-08-28",projectCode:project.code,projectName:project.name,customer:project.customerName,gate:`G${gate}`,owner:ownerFor(item.task),status:gate<=3?"승인":"진행 중",required:item.required?"필수 산출물":"선택 산출물"};
  const document={fileName:`${metadata.documentNumber}_${safe(item.name)}.docx`,title:item.name,subtitle:`${project.customerName} · ${project.name}`,metadata,sections:sectionsFor(item),decision:gate<=3?"검토 완료":"프로젝트 실행 기준으로 사용"};
  const result=await writeBusinessBriefDocx(join(dir,document.fileName),document);
  manifest.push({...item,gate:`G${gate}`,fileName:document.fileName,path:result.path,mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",bodyLength:document.sections.reduce((sum,s)=>sum+s.body.length,0)});
}
await writeFile(join(out,"manifest.json"),JSON.stringify({generatedAt:new Date().toISOString(),count:manifest.length,documents:manifest},null,2));
console.log(`현대전기기계공업 데모 산출물 생성 완료: ${manifest.length}건 (문서 ${manifest.filter(x=>x.documentKind!=="drawing").length} / 도면 ${manifest.filter(x=>x.documentKind==="drawing").length})`);
console.log(`출력 위치: ${out}`);
