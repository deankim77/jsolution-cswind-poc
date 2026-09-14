/* eslint-disable @typescript-eslint/no-explicit-any */
export function diffSnapshots(from:any,to:any){
  const fromRows=(from?.bom||[]) as any[],toRows=(to?.bom||[]) as any[];
  const fromParts=new Map(((from?.parts||[]) as any[]).map(part=>[part.id,part]));
  const toParts=new Map(((to?.parts||[]) as any[]).map(part=>[part.id,part]));
  const fromRoot=String(from?.rootPartId||""),toRoot=String(to?.rootPartId||"");
  const key=(row:any,rootId:string)=>`${row.parentPartId===rootId?"$ROOT":row.parentPartId}>${row.childPartId}`;
  const fromMap=new Map(fromRows.map(row=>[key(row,fromRoot),row])),toMap=new Map(toRows.map(row=>[key(row,toRoot),row]));
  const added:any[]=[],removed:any[]=[],quantity:any[]=[];
  for(const [k,row] of toMap){
    const before=fromMap.get(k);
    if(!before)added.push(row);
    else if(Number(before.quantity)!==Number(row.quantity)||String(before.unit)!==String(row.unit))quantity.push({before,row});
  }
  for(const [k,row] of fromMap)if(!toMap.has(k))removed.push(row);
  const moved:any[]=[];
  for(let i=added.length-1;i>=0;i--){
    const add=added[i];const removeIndex=removed.findIndex(row=>row.childPartId===add.childPartId);
    if(removeIndex>=0){const remove=removed[removeIndex];moved.push({childPartId:add.childPartId,fromParentPartId:remove.parentPartId,toParentPartId:add.parentPartId,quantity:add.quantity,unit:add.unit});added.splice(i,1);removed.splice(removeIndex,1)}
  }
  const decorate=(row:any,parts:Map<string,any>)=>({...row,parent:parts.get(row.parentPartId),child:parts.get(row.childPartId)});
  return {
    summary:{added:added.length,removed:removed.length,quantityChanged:quantity.length,moved:moved.length,total:added.length+removed.length+quantity.length+moved.length},
    added:added.map(row=>decorate(row,toParts)),
    removed:removed.map(row=>decorate(row,fromParts)),
    quantityChanged:quantity.map(item=>({before:decorate(item.before,fromParts),after:decorate(item.row,toParts)})),
    moved:moved.map(item=>({...item,child:toParts.get(item.childPartId)||fromParts.get(item.childPartId),fromParent:fromParts.get(item.fromParentPartId),toParent:toParts.get(item.toParentPartId)})),
  };
}

