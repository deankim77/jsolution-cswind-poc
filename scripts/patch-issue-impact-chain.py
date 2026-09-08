from pathlib import Path

p=Path('app/project-issue-workspace.tsx')
s=p.read_text()

def repl(a,b,label):
    global s
    count=s.count(a)
    if count != 1:
        raise SystemExit(f'{label}: expected 1, got {count}')
    s=s.replace(a,b,1)

repl(
'import { AlertTriangle,Check,ChevronDown,Download,FileText,Plus,RefreshCw,Search,Users,X } from "lucide-react";',
'import { AlertTriangle,ArrowDown,Check,ChevronDown,Download,FileText,GitBranch,Plus,RefreshCw,Search,Users,X } from "lucide-react";',
'icons')

repl(
'type Task={id:string;wbsCode:string;name:string;kind:"summary"|"task"};',
'type Task={id:string;wbsCode:string;name:string;kind:"summary"|"task";predecessorId?:string|null;predecessorCode?:string|null;plannedStart?:string;plannedEnd?:string;deliverables?:Array<{id?:string;name:string;type?:string;required?:boolean}>};',
'task type')

repl(
'  const taskMap=useMemo(()=>new Map(tasks.map(t=>[t.id,t])),[tasks]);const detail=issues.find(i=>i.id===detailId)||null;\n',
'''  const taskMap=useMemo(()=>new Map(tasks.map(t=>[t.id,t])),[tasks]);const detail=issues.find(i=>i.id===detailId)||null;
  const impactChain=useMemo(()=>{
    if(!detail?.taskId)return null;
    const source=taskMap.get(detail.taskId);if(!source)return null;
    const children=new Map<string,Task[]>();
    for(const task of tasks){if(!task.predecessorId)continue;const list=children.get(task.predecessorId)||[];list.push(task);children.set(task.predecessorId,list);}
    const direct=children.get(source.id)||[];const downstream:Task[]=[];const queue=[...direct];const seen=new Set<string>();
    while(queue.length){const task=queue.shift()!;if(seen.has(task.id))continue;seen.add(task.id);downstream.push(task);queue.push(...(children.get(task.id)||[]));}
    const deliverables=[source,...downstream].flatMap(task=>(task.deliverables||[]).map(item=>({task,item})));
    return {source,direct,downstream,deliverables};
  },[detail?.taskId,taskMap,tasks]);
''',
'impact memo')

marker='<div className="module-status-actions"><button onClick={()=>void changeStatus(detail.id,"open")}>오픈</button><button onClick={()=>void changeStatus(detail.id,"in_progress")}>조치 중</button><button onClick={()=>void changeStatus(detail.id,"resolved")}>해결</button><button onClick={()=>void changeStatus(detail.id,"closed")}>종료</button></div><div className="linked-title">'
panel='''<div className="module-status-actions"><button onClick={()=>void changeStatus(detail.id,"open")}>오픈</button><button onClick={()=>void changeStatus(detail.id,"in_progress")}>조치 중</button><button onClick={()=>void changeStatus(detail.id,"resolved")}>해결</button><button onClick={()=>void changeStatus(detail.id,"closed")}>종료</button></div>{impactChain&&<section className="issue-impact-chain"><header><span><GitBranch size={15}/><strong>영향 Chain</strong></span><small>WBS 선후행 관계 기준 자동 계산</small></header><div className="impact-chain-source"><b>현재 영향 Task</b><strong>WBS {impactChain.source.wbsCode} · {impactChain.source.name}</strong><small>{impactChain.source.plannedStart||"-"} ~ {impactChain.source.plannedEnd||"-"}</small></div>{impactChain.direct.length>0&&<><ArrowDown className="impact-chain-arrow" size={16}/><div className="impact-chain-group"><b>직접 영향</b>{impactChain.direct.map(task=><div key={task.id}><strong>WBS {task.wbsCode} · {task.name}</strong><small>{task.plannedStart||"-"} ~ {task.plannedEnd||"-"}</small></div>)}</div></>}{impactChain.downstream.length>impactChain.direct.length&&<><ArrowDown className="impact-chain-arrow" size={16}/><div className="impact-chain-group secondary"><b>후속 영향</b>{impactChain.downstream.filter(task=>!impactChain.direct.some(d=>d.id===task.id)).slice(0,6).map(task=><div key={task.id}><strong>WBS {task.wbsCode} · {task.name}</strong><small>{task.plannedStart||"-"} ~ {task.plannedEnd||"-"}</small></div>)}</div></>}{impactChain.deliverables.length>0&&<><ArrowDown className="impact-chain-arrow" size={16}/><div className="impact-chain-deliverables"><b>영향 산출물 {impactChain.deliverables.length}건</b>{impactChain.deliverables.slice(0,8).map(({task,item},index)=><span key={item.id||task.id+"-"+index}><FileText size={13}/><strong>{item.name}</strong><small>WBS {task.wbsCode}</small></span>)}</div></>}</section>}<div className="linked-title">'''
repl(marker,panel,'impact panel')
p.write_text(s)

css=Path('app/project-module-workspaces.css')
c=css.read_text() if css.exists() else ''
if '.issue-impact-chain{' not in c:
    c+='''\n.issue-impact-chain{margin:14px 0;padding:12px;border:1px solid #d8e7e5;border-radius:10px;background:#f8fbfb}.issue-impact-chain>header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.issue-impact-chain>header span{display:flex;align-items:center;gap:6px;color:#126f68}.issue-impact-chain>header strong{font-size:12px}.issue-impact-chain>header small{font-size:9px;color:#87979a}.impact-chain-source,.impact-chain-group{display:grid;gap:3px;padding:9px 10px;border:1px solid #e1ebed;border-radius:8px;background:#fff}.impact-chain-source>b,.impact-chain-group>b,.impact-chain-deliverables>b{font-size:9px;color:#0d8a80}.impact-chain-source>strong,.impact-chain-group>div>strong{font-size:11px;color:#263d42}.impact-chain-source>small,.impact-chain-group>div>small{font-size:9px;color:#829195}.impact-chain-group>div{display:grid;gap:2px;padding:6px 0;border-top:1px solid #eef3f4}.impact-chain-group>div:first-of-type{border-top:0}.impact-chain-group.secondary{background:#fbfcfc}.impact-chain-arrow{display:block;margin:5px auto;color:#75a9a5}.impact-chain-deliverables{display:grid;gap:6px;padding:9px 10px;border:1px solid #e1ebed;border-radius:8px;background:#fff}.impact-chain-deliverables>span{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:6px}.impact-chain-deliverables>span strong{font-size:10px;color:#344b50}.impact-chain-deliverables>span small{font-size:9px;color:#89989b}\n'''
    css.write_text(c)
