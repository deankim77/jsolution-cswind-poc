export type PartRelations={drawings:{id:string;projectId:string;projectName:string;fileName:string;drawingNumber:string;revision:string;kind:'part'|'assembly'}[];projects:{id:string;name:string;code:string}[]};
type Input={partId:string;edges:{id:string;parentPartId:string;childPartId:string}[];roots:{projectId:string;rootPartId:string}[];projects:{id:string;name:string;code:string}[];records:{id:string;projectId:string;fileName:string}[];reviews:{recordId:string;draft:any}[];occurrences:{recordId:string;projectId:string;itemId:string;bomItemId:string;fact:any}[];identities:{projectId:string;customerKey:string;partId:string}[]};
export function buildPartRelations(input:Input):PartRelations{
 const {partId,edges}=input,ancestors=new Set<string>([partId]),queue=[partId];
 while(queue.length){const id=queue.shift()!;for(const e of edges)if(e.childPartId===id&&!ancestors.has(e.parentPartId)){ancestors.add(e.parentPartId);queue.push(e.parentPartId);}}
 const used=new Set(input.roots.filter(r=>ancestors.has(r.rootPartId)).map(r=>r.projectId));
 const projects=input.projects.filter(p=>used.has(p.id));
 const drawings:PartRelations['drawings']=[];
 for(const record of input.records){
  const project=input.projects.find(p=>p.id===record.projectId);if(!project)continue;
  const draft=input.reviews.find(r=>r.recordId===record.id)?.draft;if(draft?.documentType!=='drawing')continue;
  const roots=(draft.items??[]).filter((i:any)=>i.bom&&i.bom.parentId===null);
  const owners=new Set<string>();
  for(const root of roots){
   const evidence=input.occurrences.filter(o=>o.recordId===record.id&&o.itemId===root.id);
   for(const o of evidence){const edge=edges.find(e=>e.id===o.bomItemId);if(edge)owners.add(edge.childPartId);}
   const keys=[root.bom.customerItemNumber?`ITEM:${root.bom.customerItemNumber}`:'',root.bom.drawingNumber?`DRAWING:${root.bom.drawingNumber}`:''].filter(Boolean);
   for(const identity of input.identities)if(identity.projectId===record.projectId&&keys.includes(identity.customerKey))owners.add(identity.partId);
  }
  const direct=owners.has(partId);
  const contains=input.occurrences.some(o=>o.recordId===record.id&&edges.some(e=>e.id===o.bomItemId&&e.childPartId===partId));
  if(!direct&&!contains&&![...owners].some(id=>ancestors.has(id)))continue;
  drawings.push({id:record.id,projectId:record.projectId,projectName:project.name,fileName:record.fileName,drawingNumber:draft.drawingNumber||roots[0]?.bom?.drawingNumber||'',revision:draft.revisionLabel||'',kind:direct?'part':'assembly'});
 }
 drawings.sort((a,b)=>(a.kind==='part'?0:1)-(b.kind==='part'?0:1)||a.fileName.localeCompare(b.fileName));
 return {drawings,projects};
}
