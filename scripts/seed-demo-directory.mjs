const base=(process.env.PMS_URL||"http://localhost:5174").replace(/\/$/,"");
const clearOnly=process.argv.includes("--clear");
const request=async(path,init={})=>{const response=await fetch(`${base}${path}`,{...init,headers:{accept:"application/json",...(init.body?{"content-type":"application/json"}:{}),...init.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${init.method||"GET"} ${path}: ${data.error||response.statusText}`);return data};
const mutate=(method,body)=>request("/api/system/master-data",{method,body:JSON.stringify(body)});

const organizationPlan=[
  {code:"DEMO_PM_DIV",name:"프로젝트사업본부",sortOrder:10},
  {code:"DEMO_PM",name:"프로젝트관리팀",parentCode:"DEMO_PM_DIV",sortOrder:11},
  {code:"DEMO_PLAN",name:"제품기획팀",parentCode:"DEMO_PM_DIV",sortOrder:12},
  {code:"DEMO_RND_DIV",name:"기술개발본부",sortOrder:20},
  {code:"DEMO_DESIGN",name:"설계개발팀",parentCode:"DEMO_RND_DIV",sortOrder:21},
  {code:"DEMO_SW",name:"SW개발팀",parentCode:"DEMO_RND_DIV",sortOrder:22},
  {code:"DEMO_OP_DIV",name:"운영품질본부",sortOrder:30},
  {code:"DEMO_MFG",name:"생산기술팀",parentCode:"DEMO_OP_DIV",sortOrder:31},
  {code:"DEMO_BUY",name:"구매자재팀",parentCode:"DEMO_OP_DIV",sortOrder:32},
  {code:"DEMO_QA",name:"품질보증팀",parentCode:"DEMO_OP_DIV",sortOrder:33},
  {code:"DEMO_DX",name:"디지털혁신실",sortOrder:40},
];
const userPlan=[
  ["김도윤","DEMO_PM","avatar-01"],["이서진","DEMO_PM","avatar-02"],["박현우","DEMO_PM","avatar-03"],
  ["최유진","DEMO_PLAN","avatar-04"],["정민석","DEMO_PLAN","avatar-05"],
  ["한지아","DEMO_DESIGN","avatar-06"],["윤태호","DEMO_DESIGN","avatar-07"],["송예린","DEMO_DESIGN","avatar-08"],
  ["강준혁","DEMO_SW","avatar-09"],["오수빈","DEMO_SW","avatar-10"],["임재훈","DEMO_SW","avatar-11"],
  ["조하은","DEMO_MFG","avatar-12"],["신동욱","DEMO_MFG","avatar-01"],["배소연","DEMO_MFG","avatar-02"],
  ["문지호","DEMO_BUY","avatar-03"],["장서윤","DEMO_BUY","avatar-04"],
  ["백승현","DEMO_QA","avatar-05"],["유나경","DEMO_QA","avatar-06"],["권민재","DEMO_QA","avatar-07"],
  ["홍채원","DEMO_DX","avatar-08"],
].map(([name,organizationCode,avatarKey],index)=>({name,organizationCode,avatarKey,email:`demo.${String(index+1).padStart(2,"0")}@jjjsolution.com`}));
const rolePlan=[
  ["PM","PM","프로젝트 관리",true,0],["PL","PL","프로젝트 관리",true,1],["PLAN","기획","업무 수행",false,10],
  ["DESIGN","설계","업무 수행",false,20],["DEV","개발","업무 수행",false,30],["PURCHASE","구매","업무 수행",false,40],
  ["PRODUCTION","생산","업무 수행",false,50],["QUALITY","품질","업무 수행",false,60],["SW","IT","업무 수행",false,70],
];
const categoryPlan=[
  ["PLAN_DEV","기획 > 개발계획"],["PLAN_SCHEDULE","기획 > 일정"],["PLAN_ORG","기획 > 조직"],["PLAN_MEETING","기획 > 회의"],
  ["DEV_REQUIREMENT","개발 > 요구사항"],["DEV_SPEC","개발 > 사양"],["DEV_RESULT","개발 > 개발결과"],
  ["DESIGN_DRAWING","설계 > 도면"],["DESIGN_BOM","설계 > BOM"],["DESIGN_CHANGE","설계 > 설계변경"],
  ["PURCHASE_QUOTE","구매 > 견적"],["PURCHASE_VENDOR","구매 > 업체평가"],["PURCHASE_ORDER","구매 > 발주"],
  ["QUALITY_FMEA","품질 > FMEA"],["QUALITY_INSPECTION","품질 > 검사기준"],["QUALITY_TEST","품질 > 시험결과"],["QUALITY_ISIR","품질 > ISIR"],
  ["PRODUCTION_PROCESS","생산 > 공정계획"],["PRODUCTION_STANDARD","생산 > 작업표준"],["PRODUCTION_TRANSFER","생산 > 양산이관"],
  ["APPROVAL_GATE","승인 > Gate"],["APPROVAL_SIGN","승인 > 승인서"],["APPROVAL_FINAL","승인 > 완료보고"],
  ["COMMON_CONTRACT","공통 > 계약"],["COMMON_REFERENCE","공통 > 참고자료"],["COMMON_ETC","공통 > 기타"],
];
const completionPlan=[["PROGRESS","진척 완료"],["REQUIRED_UPLOAD","필수 등록"],["REQUIRED_APPROVAL","필수 승인"],["CHILD_COMPLETE","하위 완료"],["GATE_APPROVAL","Gate 승인"],["OWNER_CONFIRM","담당 확인"]];

let data=await request("/api/system/master-data");
if(clearOnly){
  for(const user of data.users.filter(item=>String(item.email).startsWith("demo.")))await mutate("DELETE",{entity:"user",id:user.id});
  for(const org of [...data.organizations].filter(item=>String(item.code).startsWith("DEMO_")).sort((a,b)=>Number(b.sortOrder)-Number(a.sortOrder)))await mutate("DELETE",{entity:"organization",id:org.id});
  console.log("J SOLUTION 데모 조직과 사용자 데이터를 제거했습니다.");process.exit(0);
}

const orgIds=new Map(data.organizations.map(item=>[item.code,item.id]));
for(const item of organizationPlan){
  const payload={entity:"organization",name:item.name,code:item.code,parentId:item.parentCode?orgIds.get(item.parentCode):undefined,sortOrder:item.sortOrder};
  const existing=data.organizations.find(row=>row.code===item.code);const result=await mutate(existing?"PATCH":"POST",existing?{...payload,id:existing.id}:payload);orgIds.set(item.code,existing?.id||result.id);
}
data=await request("/api/system/master-data");
const defaultRole=data.roles.find(item=>!["SUPER_ADMIN","ADMIN","SYSTEM_ADMIN"].includes(item.code));
for(const item of userPlan){
  const existing=data.users.find(row=>row.email===item.email);const payload={entity:"user",name:item.name,email:item.email,organizationId:orgIds.get(item.organizationCode),avatarKey:item.avatarKey,status:"active",roleIds:existing?.roleIds?.length?existing.roleIds:defaultRole?[defaultRole.id]:[]};
  await mutate(existing?"PATCH":"POST",existing?{...payload,id:existing.id}:payload);
}
for(const [code,name,groupName,required,sortOrder] of rolePlan){const existing=data.projectRoles.find(item=>item.code===code);const payload={entity:"projectRole",code,name,groupName,required,sortOrder,enabled:true};await mutate(existing?"PATCH":"POST",existing?{...payload,id:existing.id}:payload)}
const enabledCodes=new Set(rolePlan.map(item=>item[0]));for(const role of data.projectRoles.filter(item=>!enabledCodes.has(item.code)&&item.enabled!==0))await mutate("PATCH",{...role,entity:"projectRole",enabled:false});
for(const [groupCode,plan] of [["DELIVERABLE_CATEGORY",categoryPlan],["COMPLETION_CONDITION",completionPlan]])for(const [code,label] of plan){const existing=data.codes.find(item=>item.groupCode===groupCode&&item.code===code);const payload={entity:"code",groupCode,code,label,version:1,sortOrder:plan.findIndex(item=>item[0]===code)*10,enabled:true};await mutate(existing?"PATCH":"POST",existing?{...payload,id:existing.id}:payload)}
const activeCategoryCodes=new Set(categoryPlan.map(item=>item[0]));for(const code of data.codes.filter(item=>item.groupCode==="DELIVERABLE_CATEGORY"&&!activeCategoryCodes.has(item.code)&&item.enabled!==0))await mutate("PATCH",{...code,entity:"code",enabled:false});
console.log(`완료: J SOLUTION 데모 조직 ${organizationPlan.length}개 · 사용자 ${userPlan.length}명 · 간략 Role ${rolePlan.length}개 · 문서 분류 ${categoryPlan.length}개 · 완료 조건 ${completionPlan.length}개`);
console.log("사용자 아바타는 시스템 설정 > 사용자에서 12종 중 변경할 수 있습니다.");
