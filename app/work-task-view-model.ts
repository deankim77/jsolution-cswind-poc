export type WorkTaskStatus="planned"|"in_progress"|"review"|"completed";
export type WorkTaskScope="project"|"my-work";

export type WorkTaskViewModel={
  id:string;
  projectId?:string;
  projectCode?:string;
  projectName:string;
  wbsCode:string;
  name:string;
  level:number;
  kind:"summary"|"task";
  taskType?:string;
  plannedStart?:string;
  plannedEnd?:string;
  predecessorCode?:string;
  roleCode?:string;
  assigneeUserId?:string;
  assigneeName?:string;
  progress:number;
  rawStatus?:string;
  status:WorkTaskStatus;
  deliverableCount:number;
  issueCount:number;
  isDelayed:boolean;
};

export type WbsApiTask={
  id:string;
  wbsCode:string;
  level:number;
  kind:"summary"|"task";
  name:string;
  taskType?:string;
  plannedStart?:string;
  plannedEnd?:string;
  predecessorCode?:string;
  roleCode?:string;
  assigneeUserId?:string;
  assigneeName?:string;
  progress?:number;
  status?:string;
  deliverables?:unknown[];
};

export function normalizeWorkTaskStatus(status?:string,progress=0,isDelayed=false):WorkTaskStatus{
  const value=(status||"").toLowerCase();
  if(progress>=100||["completed","complete","done","closed","resolved","완료"].includes(value))return "completed";
  if(isDelayed||["review","attention","warning","risk","delayed","blocked","검토","주의","지연","보류"].some(token=>value.includes(token)))return "review";
  if(progress>0||["in_progress","progress","active","started","진행"].some(token=>value.includes(token)))return "in_progress";
  return "planned";
}

export function isTaskDelayed(task:Pick<WbsApiTask,"plannedEnd"|"status"|"progress">,today=new Date()):boolean{
  if(Number(task.progress||0)>=100)return false;
  const status=(task.status||"").toLowerCase();
  if(status.includes("delay")||status.includes("지연"))return true;
  if(!task.plannedEnd)return false;
  const due=new Date(`${task.plannedEnd}T23:59:59`);
  return Number.isFinite(due.getTime())&&due.getTime()<today.getTime();
}

export function toWorkTaskViewModel(task:WbsApiTask,context:{projectId?:string;projectCode?:string;projectName:string;issueCount?:number}):WorkTaskViewModel{
  const progress=Math.max(0,Math.min(100,Number(task.progress||0)));
  const delayed=isTaskDelayed(task);
  return {
    id:task.id,
    projectId:context.projectId,
    projectCode:context.projectCode,
    projectName:context.projectName,
    wbsCode:task.wbsCode,
    name:task.name,
    level:Number(task.level)||1,
    kind:task.kind,
    taskType:task.taskType,
    plannedStart:task.plannedStart,
    plannedEnd:task.plannedEnd,
    predecessorCode:task.predecessorCode,
    roleCode:task.roleCode,
    assigneeUserId:task.assigneeUserId,
    assigneeName:task.assigneeName,
    progress,
    rawStatus:task.status,
    status:normalizeWorkTaskStatus(task.status,progress,delayed),
    deliverableCount:Array.isArray(task.deliverables)?task.deliverables.length:0,
    issueCount:Number(context.issueCount||0),
    isDelayed:delayed,
  };
}

export function filterWorkTasksByScope(tasks:WorkTaskViewModel[],scope:WorkTaskScope,currentUserId?:string,currentUserName?:string){
  if(scope==="project")return tasks;
  const normalizedName=(currentUserName||"").trim().toLowerCase();
  return tasks.filter(task=>{
    if(currentUserId&&task.assigneeUserId===currentUserId)return true;
    return Boolean(normalizedName&&task.assigneeName?.trim().toLowerCase()===normalizedName);
  });
}

export const workTaskStatusOrder:WorkTaskStatus[]=["planned","in_progress","review","completed"];
export const workTaskStatusLabel:Record<WorkTaskStatus,string>={planned:"예정",in_progress:"진행 중",review:"검토 · 주의",completed:"완료"};
