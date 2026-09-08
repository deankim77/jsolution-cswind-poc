import { getLegacyDbCompat } from "../../../db/postgres-d1-compat";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {ensureProjectDataFoundation,type RuntimeD1} from "../../../db/project-data-foundation";
import {contextErrorResponse,resolveRequestContext} from "../../../db/request-context";

type D1=RuntimeD1;
type SearchKind="project"|"task"|"document"|"issue"|"workflow"|"ecr"|"quality"|"person";
type StatusIntent=""|"unprocessed"|"active"|"completed"|"approval_pending"|"rejected"|"unregistered"|"delayed";
type SeverityIntent=""|"low"|"medium"|"high"|"critical";
type SearchContext={companyId:string;userId:string};
type SearchArgs={db:D1;context:SearchContext;like:string;compactLike:string;today:string;status:StatusIntent;severity:SeverityIntent;mine:boolean;actionRequired:boolean;top:boolean;subtype:string};
type SearchGroup={kind:SearchKind;items:any[];reason?:string};

async function runtimeDb():Promise<D1>{return getLegacyDbCompat() as D1;}
const compact=(value:string)=>value.toLowerCase().replace(/[\s\-_.·]+/g,"");
const sqlCompact=(expr:string)=>`replace(replace(replace(replace(replace(lower(${expr}),' ',''),'-',''),'_',''),'.',''),'·','')`;
const textMatch=(expr:string)=>`(lower(${expr}) LIKE lower(?) OR ${sqlCompact(expr)} LIKE ?)`;
const textBinds=(args:SearchArgs)=>[args.like,args.compactLike];

const detectTarget=(query:string):SearchKind|""=>{
  const q=compact(query);
  if(/워크플로우|workflow/.test(q))return "workflow";
  if(/설계변경|ecr|eco|engineeringchange/.test(q))return "ecr";
  if(/품질관리|품질문제|qms|quality/.test(q))return "quality";
  if(/리스크|위험|이슈|협업요청|협업/.test(q))return "issue";
  if(/문서|산출물|도면|drawing|document|bom|revision|rev/.test(q))return "document";
  if(/wbs|업무|task/.test(q))return "task";
  if(/프로젝트|과제|project/.test(q))return "project";
  if(/담당자|사람|인원|사용자/.test(q))return "person";
  return "";
};
const detectStatus=(query:string):StatusIntent=>{
  const q=compact(query);
  if(/승인대기|결재대기|검토대기|approvalpending/.test(q))return "approval_pending";
  if(/미등록|등록예정|미제출|unregistered/.test(q))return "unregistered";
  if(/반려|거절|reject|rejected/.test(q))return "rejected";
  if(/지연|늦|delay|overdue/.test(q))return "delayed";
  if(/미처리|미완료|처리전|미결|처리해야할|처리할|처리필요|조치해야할|조치필요|unprocessed|unfinished/.test(q))return "unprocessed";
  if(/완료|종료|처리완료|승인완료|completed|closed/.test(q))return "completed";
  if(/진행중|처리중|진행|active|inprogress/.test(q))return "active";
  return "";
};
const detectSeverity=(query:string):SeverityIntent=>{const q=compact(query);return /심각|치명|critical/.test(q)?"critical":/높음|중요|high/.test(q)?"high":/보통|중간|medium/.test(q)?"medium":/낮음|경미|low/.test(q)?"low":""};
const detectMine=(query:string)=>/(^|\s)(나의|내|내가|나에게|내게|내꺼|내것)(\s|$)/.test(query.trim())||/^(나의|내|내가)/.test(query.trim());
const detectActionRequired=(query:string)=>/처리\s*해야\s*할|처리\s*할|처리\s*필요|조치\s*해야\s*할|조치\s*필요/.test(query);
const detectTop=(query:string)=>/(가장|제일|최대|가장\s*많이|제일\s*많이)/.test(query);
const issueSubtype=(query:string)=>{const q=compact(query);return /리스크|위험|risk/.test(q)?"risk":/협업요청|협업|collaboration/.test(q)?"collaboration":/이슈|issue/.test(q)?"issue":""};
const cleanTerm=(query:string)=>query
  .replace(/(^|\s)(나의|내|내가|나에게|내게|내꺼|내것)(?=\s|$)/g," ")
  .replace(/워크\s*플로우|workflow|설계\s*변경|engineering\s*change|\becr\b|\beco\b|품질\s*관리|품질\s*문제|\bqms\b|quality|리스크|위험|risk|이슈|issue|협업\s*요청|협업|collaboration|문서|산출물|도면|drawing|document|\bbom\b|revision|\brev\b|프로젝트|과제|project|\bwbs\b|업무|\btask\b|담당자|사람|인원|사용자/gi," ")
  .replace(/승인\s*대기|결재\s*대기|검토\s*대기|미\s*등록|등록\s*예정|미\s*제출|반려|거절|지연|늦은?|미\s*처리|미\s*완료|처리\s*전|미결|처리\s*해야\s*할|처리\s*할|처리\s*필요|조치\s*해야\s*할|조치\s*필요|완료|종료|처리\s*완료|승인\s*완료|진행\s*중|처리\s*중|진행/gi," ")
  .replace(/가장\s*많이|제일\s*많이|가장|제일|최대|되고\s*있는|되어\s*있는|되고있는|되어있는/gi," ")
  .replace(/심각|치명|높음|중요|보통|중간|낮음|경미|critical|high|medium|low/gi," ")
  .replace(/찾아\s*줘|찾아|보여\s*줘|보여|검색\s*해\s*줘|검색|알려\s*줘|알려|목록|현황|현재|관련|중인/gi," ")
  .replace(/\s+/g," ").trim();
const labelFor=(target:SearchKind|"",status:StatusIntent,mine:boolean)=>{
  const targetLabel:Record<SearchKind,string>={project:"프로젝트",task:"WBS",document:"문서·산출물",issue:"이슈·리스크",workflow:"워크플로우",ecr:"설계변경",quality:"품질관리",person:"사람"};
  const statusLabel:Record<Exclude<StatusIntent,"">,string>={unprocessed:"미처리",active:"진행 중",completed:"완료",approval_pending:"승인 대기",rejected:"반려",unregistered:"미등록",delayed:"지연"};
  return `${mine?"나의 · ":""}${target?targetLabel[target]:"통합"}${status?` · ${statusLabel[status]}`:""} 검색`;
};

async function searchProject(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,status,mine,today}=args;
  const text=`COALESCE(p.code,'')||' '||COALESCE(p.name,'')||' '||COALESCE(p.customer_name,'')||' '||COALESCE(partner.name,'')||' '||COALESCE(pt.name,'')||' '||COALESCE(profile.description,'')||' '||COALESCE(profile.reference_code,'')||' '||COALESCE((SELECT GROUP_CONCAT(u.name,' ') FROM project_members pm2 JOIN users u ON u.id=pm2.user_id WHERE pm2.project_id=p.id AND pm2.project_role IN ('PM','PL')),'')||' '||COALESCE((SELECT GROUP_CONCAT(REPLACE(g.wbs_code,'-REVIEW',''),' ') FROM wbs_tasks g WHERE g.project_id=p.id AND g.task_type='gate'),'')`;
  const filters=["p.company_id=?",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];
  if(mine){filters.push("EXISTS(SELECT 1 FROM project_members mypm WHERE mypm.project_id=p.id AND mypm.user_id=?)");binds.push(context.userId)}
  if(status==="active")filters.push("p.status='active'");else if(status==="completed")filters.push("p.status='completed'");else if(status==="unprocessed")filters.push("p.status<>'completed'");else if(status==="delayed"){filters.push("EXISTS(SELECT 1 FROM wbs_tasks dx WHERE dx.project_id=p.id AND dx.kind='task' AND dx.status<>'completed' AND COALESCE(dx.progress,0)<100 AND dx.planned_end<?)");binds.push(today)}else if(status==="approval_pending")filters.push("EXISTS(SELECT 1 FROM wbs_tasks gx WHERE gx.project_id=p.id AND gx.task_type='gate' AND gx.status='review')");
  const rows=await db.prepare(`SELECT p.id,'project' AS kind,p.id AS projectId,p.code AS eyebrow,p.name AS title,COALESCE(partner.name,p.customer_name,'거래처 미지정')||' · '||COALESCE(pt.name,'유형 미지정')||' · PM '||COALESCE((SELECT GROUP_CONCAT(u.name,', ') FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=p.id AND pm.project_role='PM'),'미지정')||' · '||p.status AS meta FROM projects p LEFT JOIN partners partner ON partner.id=p.partner_id LEFT JOIN project_types pt ON pt.id=p.project_type_id LEFT JOIN project_profiles profile ON profile.project_id=p.id WHERE ${filters.join(" AND ")} ORDER BY p.updated_at DESC LIMIT 25`).bind(...binds).all();
  return {kind:"project",items:rows.results||[],reason:mine?"내가 참여한 프로젝트":status==="delayed"?"지연 Task가 있는 프로젝트":undefined};
}

async function searchTask(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,status,mine,today,top}=args;
  const text=`COALESCE(w.wbs_code,'')||' '||COALESCE(w.name,'')||' '||COALESCE(w.role_code,'')||' '||COALESCE(u.name,'')||' '||COALESCE(w.planned_start,'')||' '||COALESCE(w.planned_end,'')||' '||COALESCE(w.completion_criteria,'')||' '||COALESCE(w.status,'')||' '||COALESCE(p.code,'')||' '||COALESCE(p.name,'')`;
  const filters=["p.company_id=?","w.kind='task'",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];
  if(mine){filters.push("w.assignee_user_id=?");binds.push(context.userId)}
  if(status==="active")filters.push("w.status='active'");else if(status==="completed")filters.push("w.status='completed'");else if(status==="unprocessed")filters.push("w.status<>'completed' AND COALESCE(w.progress,0)<100");else if(status==="approval_pending")filters.push("w.status='review'");else if(status==="delayed"){filters.push("w.status<>'completed' AND COALESCE(w.progress,0)<100 AND w.planned_end<?");binds.push(today)}
  const taskOrder=status==="delayed"?"w.planned_end ASC,p.updated_at DESC,w.sort_order":top?"COALESCE(w.progress,0) ASC,p.updated_at DESC,w.sort_order":"p.updated_at DESC,w.sort_order";
  const rows=await db.prepare(`SELECT w.id,'task' AS kind,p.id AS projectId,w.id AS taskId,w.wbs_code AS eyebrow,w.name AS title,p.name||' · '||COALESCE(u.name,w.role_code,'미배정')||' · 종료 '||COALESCE(w.planned_end,'미정')||' · '||COALESCE(w.progress,0)||'%' AS meta FROM wbs_tasks w JOIN projects p ON p.id=w.project_id LEFT JOIN users u ON u.id=w.assignee_user_id WHERE ${filters.join(" AND ")} ORDER BY ${taskOrder} LIMIT 35`).bind(...binds).all();
  return {kind:"task",items:rows.results||[],reason:status==="delayed"?(top?"지연일수가 큰 업무부터 정렬":"계획 종료일이 지난 미완료 WBS"):mine?"내 담당 WBS":undefined};
}

async function searchDocument(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,status,mine}=args;
  const text=`COALESCE(d.name,'')||' '||COALESCE(d.category,'')||' '||COALESCE(d.drawing_code,'')||' '||COALESCE(d.internal_drawing_number,'')||' '||COALESCE(d.customer_drawing_number,'')||' '||COALESCE(w.wbs_code,'')||' '||COALESCE(w.name,'')||' '||COALESCE(p.code,'')||' '||COALESCE(p.name,'')||' '||COALESCE((SELECT GROUP_CONCAT(v.file_name,' ') FROM deliverable_versions v WHERE v.deliverable_id=d.id AND v.deleted_at IS NULL),'')`;
  const filters=["p.company_id=?",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];
  if(mine){filters.push("(d.owner_user_id=? OR d.created_by=? OR w.assignee_user_id=?)");binds.push(context.userId,context.userId,context.userId)}
  if(status==="unregistered")filters.push("(d.status='planned' OR NOT EXISTS(SELECT 1 FROM deliverable_versions vx WHERE vx.deliverable_id=d.id AND vx.deleted_at IS NULL))");else if(status==="approval_pending")filters.push("d.status IN ('submitted','review')");else if(status==="rejected")filters.push("d.status='rejected'");else if(status==="completed")filters.push("d.status IN ('approved','completed')");else if(status==="unprocessed")filters.push("d.status NOT IN ('approved','completed')");
  const rows=await db.prepare(`SELECT d.id,'document' AS kind,p.id AS projectId,d.task_id AS taskId,COALESCE(d.drawing_code,d.category,'문서·산출물') AS eyebrow,d.name AS title,p.name||' · '||COALESCE(w.wbs_code||' '||w.name,'프로젝트 공통')||' · '||CASE WHEN EXISTS(SELECT 1 FROM deliverable_versions lv WHERE lv.deliverable_id=d.id AND lv.deleted_at IS NULL) THEN '등록 완료' ELSE '미등록' END AS meta FROM deliverables d JOIN projects p ON p.id=d.project_id LEFT JOIN wbs_tasks w ON w.id=d.task_id WHERE ${filters.join(" AND ")} ORDER BY d.updated_at DESC LIMIT 35`).bind(...binds).all();
  return {kind:"document",items:rows.results||[],reason:mine?"내 담당·등록 문서":status==="unregistered"?"Revision 파일이 없는 문서·산출물":undefined};
}

async function searchIssue(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,status,severity,mine,actionRequired,subtype,today}=args;
  const text=`COALESCE(i.title,'')||' '||COALESCE(i.description,'')||' '||COALESCE(owner.name,'')||' '||COALESCE(i.status,'')||' '||COALESCE(i.severity,'')||' '||COALESCE(i.issue_type,'')||' '||COALESCE(w.wbs_code,'')||' '||COALESCE(w.name,'')||' '||COALESCE(p.name,'')`;
  const filters=["p.company_id=?",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];
  if(mine){filters.push(actionRequired?"i.owner_user_id=?":"(i.owner_user_id=? OR i.created_by=?)");binds.push(context.userId,...(actionRequired?[]:[context.userId]))}if(subtype){filters.push("i.issue_type=?");binds.push(subtype)}if(severity){filters.push("i.severity=?");binds.push(severity)}
  if(status==="active")filters.push("i.status='in_progress'");else if(status==="completed")filters.push("i.status IN ('resolved','closed')");else if(status==="unprocessed")filters.push("i.status NOT IN ('resolved','closed')");else if(status==="delayed"){filters.push("i.status NOT IN ('resolved','closed') AND i.due_date<?");binds.push(today)}
  const rows=await db.prepare(`SELECT i.id,'issue' AS kind,p.id AS projectId,i.task_id AS taskId,CASE i.issue_type WHEN 'risk' THEN '리스크' WHEN 'collaboration' THEN '협업 요청' ELSE '이슈' END AS eyebrow,i.title,p.name||' · '||COALESCE(owner.name,'담당 미지정')||' · '||i.severity||' · '||i.status AS meta FROM project_issues i JOIN projects p ON p.id=i.project_id LEFT JOIN wbs_tasks w ON w.id=i.task_id LEFT JOIN users owner ON owner.id=i.owner_user_id WHERE ${filters.join(" AND ")} ORDER BY CASE i.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,i.updated_at DESC LIMIT 35`).bind(...binds).all();
  return {kind:"issue",items:rows.results||[],reason:mine&&actionRequired?"내가 처리해야 할 미처리 이슈":mine?"내가 등록했거나 담당한 항목":status==="unprocessed"?"열림·처리 중 항목":undefined};
}

async function searchWorkflow(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,status,mine,today}=args;
  const text=`COALESCE(w.workflow_number,'')||' '||COALESCE(w.title,'')||' '||COALESCE(w.request_content,'')||' '||COALESCE(t.code,'')||' '||COALESCE(t.name,'')||' '||COALESCE(req.name,'')||' '||COALESCE(st.name,'')||' '||COALESCE(assignee.name,'')||' '||COALESCE(p.code,'')||' '||COALESCE(p.name,'')||' '||COALESCE((SELECT GROUP_CONCAT(d.name,' ') FROM workflow_instance_deliverables wl JOIN deliverables d ON d.id=wl.deliverable_id WHERE wl.workflow_id=w.id),'')||' '||COALESCE((SELECT d2.name FROM deliverables d2 WHERE d2.id=w.main_deliverable_id),'')`;
  const filters=["w.company_id=?","COALESCE(w.source_type,'GENERAL') NOT IN ('ECR','QUALITY')",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];
  if(mine){filters.push("(w.requester_user_id=? OR EXISTS(SELECT 1 FROM workflow_instance_steps mineStep WHERE mineStep.workflow_id=w.id AND mineStep.assignee_user_id=?))");binds.push(context.userId,context.userId)}
  if(status==="active")filters.push("w.status IN ('in_progress','supplement')");else if(status==="completed")filters.push("w.status IN ('approved','completed','closed')");else if(status==="unprocessed")filters.push("w.status NOT IN ('approved','completed','closed','cancelled')");else if(status==="approval_pending")filters.push("w.status IN ('in_progress','supplement') AND st.action_type='APPROVAL'");else if(status==="rejected")filters.push("w.status='rejected'");else if(status==="delayed"){filters.push("w.status NOT IN ('approved','completed','closed','cancelled') AND w.due_date<?");binds.push(today)}
  const rows=await db.prepare(`SELECT w.id,'workflow' AS kind,p.id AS projectId,w.task_id AS taskId,w.workflow_number AS eyebrow,w.title,p.name||' · '||t.name||' · '||COALESCE(st.name,'단계 미정')||' · '||COALESCE(assignee.name,'처리자 미지정')||' · '||w.status AS meta FROM workflow_instances w JOIN projects p ON p.id=w.project_id JOIN workflow_templates t ON t.id=w.template_id JOIN users req ON req.id=w.requester_user_id LEFT JOIN workflow_instance_steps st ON st.workflow_id=w.id AND st.step_order=w.current_step_order LEFT JOIN users assignee ON assignee.id=st.assignee_user_id WHERE ${filters.join(" AND ")} ORDER BY CASE w.status WHEN 'in_progress' THEN 0 WHEN 'supplement' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,w.updated_at DESC LIMIT 35`).bind(...binds).all();
  return {kind:"workflow",items:rows.results||[],reason:mine?(status==="unprocessed"?"내가 요청했거나 담당한 미처리 워크플로우":"내가 요청했거나 담당한 워크플로우"):status==="unprocessed"?"완료되지 않은 워크플로우":status==="approval_pending"?"현재 단계가 승인인 워크플로우":undefined};
}

async function searchEcr(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,status,mine,today}=args;
  const text=`COALESCE(e.ecr_number,'')||' '||COALESCE(e.title,'')||' '||COALESCE(e.change_target,'')||' '||COALESCE(e.reason,'')||' '||COALESCE(e.before_content,'')||' '||COALESCE(e.after_content,'')||' '||COALESCE(e.impact_content,'')||' '||COALESCE(d.drawing_code,'')||' '||COALESCE(d.internal_drawing_number,'')||' '||COALESCE(d.customer_drawing_number,'')||' '||COALESCE(req.name,'')||' '||COALESCE(p.name,'')`;
  const filters=["e.company_id=?",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];
  if(mine){filters.push("(e.requester_user_id=? OR EXISTS(SELECT 1 FROM workflow_instance_steps mineStep WHERE mineStep.workflow_id=e.workflow_id AND mineStep.assignee_user_id=?))");binds.push(context.userId,context.userId)}
  if(status==="active")filters.push("COALESCE(wf.status,e.status) IN ('in_progress','supplement')");else if(status==="completed")filters.push("COALESCE(wf.status,e.status) IN ('approved','completed','closed')");else if(status==="unprocessed")filters.push("COALESCE(wf.status,e.status) NOT IN ('approved','completed','closed','cancelled')");else if(status==="approval_pending")filters.push("wf.status IN ('in_progress','supplement') AND st.action_type='APPROVAL'");else if(status==="rejected")filters.push("COALESCE(wf.status,e.status)='rejected'");else if(status==="delayed"){filters.push("COALESCE(wf.status,e.status) NOT IN ('approved','completed','closed','cancelled') AND wf.due_date<?");binds.push(today)}
  const rows=await db.prepare(`SELECT e.id,'ecr' AS kind,p.id AS projectId,e.task_id AS taskId,e.ecr_number AS eyebrow,e.title,p.name||' · '||COALESCE(d.drawing_code,e.change_target,'변경 대상 미지정')||' · '||COALESCE(wf.status,e.status) AS meta FROM design_change_requests e JOIN projects p ON p.id=e.project_id LEFT JOIN users req ON req.id=e.requester_user_id LEFT JOIN deliverables d ON d.id=e.drawing_id LEFT JOIN workflow_instances wf ON wf.id=e.workflow_id LEFT JOIN workflow_instance_steps st ON st.workflow_id=wf.id AND st.step_order=wf.current_step_order WHERE ${filters.join(" AND ")} ORDER BY e.updated_at DESC LIMIT 35`).bind(...binds).all();
  return {kind:"ecr",items:rows.results||[],reason:mine?"내가 요청했거나 담당한 설계변경":status==="unprocessed"?"완료되지 않은 설계변경":undefined};
}

async function searchQuality(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,status,severity,mine,today}=args;
  const text=`COALESCE(q.quality_number,'')||' '||COALESCE(q.title,'')||' '||COALESCE(q.issue_type,'')||' '||COALESCE(q.severity,'')||' '||COALESCE(q.description,'')||' '||COALESCE(q.root_cause,'')||' '||COALESCE(q.corrective_action,'')||' '||COALESCE(q.effectiveness_check,'')||' '||COALESCE(owner.name,'')||' '||COALESCE(p.name,'')`;
  const filters=["q.company_id=?",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];
  if(mine){filters.push("(q.owner_user_id=? OR EXISTS(SELECT 1 FROM workflow_instance_steps mineStep WHERE mineStep.workflow_id=q.workflow_id AND mineStep.assignee_user_id=?))");binds.push(context.userId,context.userId)}if(severity){filters.push("q.severity=?");binds.push(severity)}
  if(status==="active")filters.push("COALESCE(wf.status,q.status) IN ('in_progress','supplement')");else if(status==="completed")filters.push("COALESCE(wf.status,q.status) IN ('approved','completed','closed')");else if(status==="unprocessed")filters.push("COALESCE(wf.status,q.status) NOT IN ('approved','completed','closed','cancelled')");else if(status==="approval_pending")filters.push("wf.status IN ('in_progress','supplement') AND st.action_type='APPROVAL'");else if(status==="rejected")filters.push("COALESCE(wf.status,q.status)='rejected'");else if(status==="delayed"){filters.push("COALESCE(wf.status,q.status) NOT IN ('approved','completed','closed','cancelled') AND wf.due_date<?");binds.push(today)}
  const rows=await db.prepare(`SELECT q.id,'quality' AS kind,p.id AS projectId,q.task_id AS taskId,q.quality_number AS eyebrow,q.title,p.name||' · '||COALESCE(q.issue_type,'품질문제')||' · '||q.severity||' · '||COALESCE(owner.name,'담당 미지정')||' · '||COALESCE(wf.status,q.status) AS meta FROM quality_cases q JOIN projects p ON p.id=q.project_id LEFT JOIN users owner ON owner.id=q.owner_user_id LEFT JOIN workflow_instances wf ON wf.id=q.workflow_id LEFT JOIN workflow_instance_steps st ON st.workflow_id=wf.id AND st.step_order=wf.current_step_order WHERE ${filters.join(" AND ")} ORDER BY q.updated_at DESC LIMIT 35`).bind(...binds).all();
  return {kind:"quality",items:rows.results||[],reason:mine?"내가 담당한 품질문제":status==="unprocessed"?"종결되지 않은 품질문제":undefined};
}

async function searchPerson(args:SearchArgs):Promise<SearchGroup>{
  const {db,context,mine}=args;
  const text=`COALESCE(u.name,'')||' '||COALESCE(u.email,'')||' '||COALESCE((SELECT GROUP_CONCAT(p.name,' ') FROM project_members pm JOIN projects p ON p.id=pm.project_id WHERE pm.user_id=u.id),'')`;
  const filters=["u.company_id=?","u.status='active'",textMatch(text)],binds:any[]=[context.companyId,...textBinds(args)];if(mine){filters.push("u.id=?");binds.push(context.userId)}
  const rows=await db.prepare(`SELECT u.id,'person' AS kind,'' AS projectId,u.email AS eyebrow,u.name AS title,COALESCE((SELECT GROUP_CONCAT(DISTINCT p.name) FROM project_members pm JOIN projects p ON p.id=pm.project_id WHERE pm.user_id=u.id),'프로젝트 미배정') AS meta FROM users u WHERE ${filters.join(" AND ")} ORDER BY u.name LIMIT 25`).bind(...binds).all();
  return {kind:"person",items:rows.results||[],reason:mine?"현재 로그인 사용자":undefined};
}

const searchers:Record<SearchKind,(args:SearchArgs)=>Promise<SearchGroup>>={project:searchProject,task:searchTask,document:searchDocument,issue:searchIssue,workflow:searchWorkflow,ecr:searchEcr,quality:searchQuality,person:searchPerson};
const priority:Record<SearchKind,number>={project:0,task:1,document:2,issue:3,workflow:4,ecr:5,quality:6,person:7};

export async function GET(request:Request){
  const db=await runtimeDb();await ensureProjectDataFoundation(db);
  let context;try{context=await resolveRequestContext(request,db)}catch(reason){return contextErrorResponse(reason)??Response.json({error:"로그인이 필요합니다."},{status:401})}
  const url=new URL(request.url),query=(url.searchParams.get("q")||"").trim(),scope=url.searchParams.get("scope")||"all";
  if(!query)return Response.json({results:[],intent:"general",intentLabel:"통합 검색"});

  const target=detectTarget(query),status=detectStatus(query),severity=detectSeverity(query),mine=detectMine(query),actionRequired=detectActionRequired(query),top=detectTop(query),subtype=issueSubtype(query),term=cleanTerm(query);
  const args:SearchArgs={db,context:{companyId:context.companyId,userId:context.userId},like:term?`%${term.toLowerCase()}%`:"%",compactLike:term?`%${compact(term)}%`:"%",today:new Date().toISOString().slice(0,10),status,severity,mine,actionRequired,top,subtype};
  const kinds=(Object.keys(searchers) as SearchKind[]).filter(kind=>scope===kind||(scope==="all"&&(!target||target===kind)));
  const groups=await Promise.all(kinds.map(kind=>searchers[kind](args)));
  const results:any[]=[];
  for(const group of groups)for(const item of group.items){if(results.some(existing=>existing.kind===item.kind&&existing.id===item.id))continue;results.push(group.reason?{...item,intentReason:group.reason}:item)}
  results.sort((a,b)=>(priority[a.kind as SearchKind]??9)-(priority[b.kind as SearchKind]??9));
  return Response.json({results:results.slice(0,120),intent:target||"general",intentLabel:labelFor(target,status,mine),term,status,target,severity,mine,actionRequired,top});
}
