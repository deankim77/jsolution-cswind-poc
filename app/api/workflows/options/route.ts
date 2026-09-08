/* eslint-disable @typescript-eslint/no-explicit-any */
import {contextErrorResponse,requireProjectAccess,resolveRequestContext} from "../../../../db/request-context";
import {parseJson,workflowDb} from "../shared";

export async function GET(request:Request){
  const db=await workflowDb();
  let context;
  try{context=await resolveRequestContext(request,db)}
  catch(reason){return contextErrorResponse(reason)??Response.json({error:"사용자 정보를 확인하지 못했습니다."},{status:500})}

  const url=new URL(request.url);
  const projectId=url.searchParams.get("projectId")||"";
  const templateId=url.searchParams.get("templateId")||"";
  const templateCode=url.searchParams.get("templateCode")||"";
  const allowProjectless=url.searchParams.get("allowProjectless")==="1";
  if(!projectId&&!allowProjectless)return Response.json({tasks:[],members:[],users:[],deliverables:[],steps:[]});

  if(projectId){
    try{await requireProjectAccess(db,context,projectId)}
    catch(reason){return contextErrorResponse(reason)??Response.json({error:"프로젝트 접근 권한이 없습니다."},{status:403})}
  }

  let version:any=null;
  if(templateId){
    version=await db.prepare("SELECT definition FROM workflow_template_versions WHERE template_id=? AND status='published' ORDER BY version DESC LIMIT 1").bind(templateId).first<any>();
  }else if(templateCode){
    version=await db.prepare("SELECT v.definition FROM workflow_template_versions v JOIN workflow_templates t ON t.id=v.template_id WHERE t.company_id=? AND t.code=? AND t.status='active' AND v.status='published' ORDER BY v.version DESC LIMIT 1").bind(context.companyId,templateCode).first<any>();
  }

  const usersPromise=db.prepare(`SELECT u.id AS userId,u.name,u.email,COALESCE(parent.name || ' / ','') || COALESCE(org.name,'소속 미지정') AS organizationPath,COALESCE(GROUP_CONCAT(DISTINCT r.name),'') AS roleNames FROM users u LEFT JOIN organizations org ON org.id=u.organization_id AND org.company_id=u.company_id LEFT JOIN organizations parent ON parent.id=org.parent_id AND parent.company_id=u.company_id LEFT JOIN user_roles ur ON ur.user_id=u.id LEFT JOIN roles r ON r.id=ur.role_id AND r.company_id=u.company_id WHERE u.company_id=? AND u.status='active' GROUP BY u.id,u.name,u.email,parent.name,org.name,parent.sort_order,org.sort_order ORDER BY COALESCE(parent.sort_order,0),COALESCE(org.sort_order,0),u.name`).bind(context.companyId).all();
  const tasksPromise=projectId?db.prepare("SELECT id,wbs_code AS wbsCode,name,role_code AS roleCode,assignee_user_id AS assigneeUserId FROM wbs_tasks WHERE project_id=? AND kind<>'summary' ORDER BY sort_order").bind(projectId).all():Promise.resolve({results:[]});
  const membersPromise=projectId?db.prepare("SELECT m.user_id AS userId,u.name,u.email,m.project_role AS projectRole FROM project_members m JOIN users u ON u.id=m.user_id WHERE m.project_id=? AND u.status='active' ORDER BY CASE upper(m.project_role) WHEN 'PM' THEN 0 WHEN 'PL' THEN 1 ELSE 2 END,u.name").bind(projectId).all():Promise.resolve({results:[]});
  const deliverablesPromise=projectId?db.prepare("SELECT id,name,category AS type,task_id AS taskId,status,version,COALESCE(document_kind,'document') AS documentKind,drawing_code AS drawingCode,(SELECT COUNT(*) FROM deliverable_versions v WHERE v.deliverable_id=deliverables.id AND v.deleted_at IS NULL) AS revisionCount FROM deliverables WHERE project_id=? ORDER BY updated_at DESC").bind(projectId).all():Promise.resolve({results:[]});
  const [tasks,members,users,deliverables]=await Promise.all([tasksPromise,membersPromise,usersPromise,deliverablesPromise]);

  return Response.json({
    tasks:tasks.results??[],
    members:members.results??[],
    users:users.results??[],
    deliverables:deliverables.results??[],
    steps:parseJson<any>(version?.definition,{}).steps??[],
  });
}
