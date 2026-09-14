type Task={id:string;wbsCode:string;name:string;kind:string;parentId?:string|null;parentCode?:string|null;status:string;progress:number;durationDays?:number;plannedEnd?:string};

// Match the actual top-level WBS groups, never Gate tasks or nested assemblies.
export function productionStages(tasks:Task[]){
  const byId=new Map(tasks.map(task=>[task.id,task]));
  const byCode=new Map(tasks.map(task=>[task.wbsCode,task]));
  const parentOf=(task:Task)=>task.parentId?byId.get(task.parentId):task.parentCode?byCode.get(task.parentCode):undefined;
  const roots=tasks.filter(task=>task.kind==="summary"&&!task.parentId&&!task.parentCode);
  return Array.from({length:6},(_,index)=>{
    const code="P"+(index+1);
    const group=roots.find(task=>new RegExp("^"+code+"(?:\\s|$)").test(task.name)||task.wbsCode===code)
      ??roots.find(task=>task.wbsCode===String(index+1)&&!/^P\d+\b/.test(task.name));
    const children=group?tasks.filter(task=>{
      if(task.kind!=="task")return false;
      let parent=parentOf(task);const seen=new Set<string>([task.id]);
      while(parent&&!seen.has(parent.id)){if(parent.id===group.id)return true;seen.add(parent.id);parent=parentOf(parent);}
      return false;
    }):[];
    const completed=children.filter(task=>task.status==="completed").length;
    const weight=children.reduce((sum,task)=>sum+Math.max(1,Number(task.durationDays)||1),0);
    const progress=weight?Math.round(children.reduce((sum,task)=>sum+Math.max(1,Number(task.durationDays)||1)*Math.max(0,Math.min(100,Number(task.progress)||0)),0)/weight):0;
    const status=!group?"missing":children.length>0&&completed===children.length?"completed":children.some(task=>task.status==="active"||task.status==="review"||task.progress>0)?"active":"planned";
    return {code,taskId:group?.id,name:group?.name.replace(new RegExp("^"+code+"\\s*"),"")||"",progress,status,completed,total:children.length};
  });
}
