export type WithdrawalEdge={id:string;parentPartId:string;childPartId:string;quantity:number|null;unit:string;sortOrder:number;note:string|null};
export type WithdrawalBaseline={edgeId:string;before:WithdrawalEdge|null;after:WithdrawalEdge};
/** Only undo unchanged, exclusively owned edges. Keep shared or subsequently edited definitions. */
export function planPbomWithdrawal(edges:WithdrawalEdge[],ownedIds:string[],sharedIds:string[],baselines:WithdrawalBaseline[]){
 const owned=new Set(ownedIds),shared=new Set(sharedIds),protectedParts=new Set<string>();
 for(const e of edges)if(!owned.has(e.id)||shared.has(e.id))protectedParts.add(e.childPartId);
 // A modified definition (or a legacy confirmation lacking a baseline) becomes retained data.
 const same=(a:WithdrawalEdge,b:WithdrawalEdge)=>['parentPartId','childPartId','quantity','unit','sortOrder','note'].every(k=>a[k as keyof WithdrawalEdge]===b[k as keyof WithdrawalEdge]);
 for(const e of edges.filter(e=>owned.has(e.id))){const b=baselines.find(b=>b.edgeId===e.id);if(!b||!same(e,b.after))protectedParts.add(e.childPartId);}
 let changed=true;while(changed){changed=false;for(const e of edges)if(protectedParts.has(e.parentPartId)&&!protectedParts.has(e.childPartId)){protectedParts.add(e.childPartId);changed=true;}}
 const remove:string[]=[],restore:WithdrawalEdge[]=[],retained:string[]=[];
 for(const e of edges.filter(e=>owned.has(e.id))){const b=baselines.find(b=>b.edgeId===e.id);if(shared.has(e.id)||protectedParts.has(e.parentPartId)||!b||!same(e,b.after)){retained.push(e.id);continue}if(b.before)restore.push(b.before);else remove.push(e.id)}
 // Keep the attachment path to retained or manually added descendants.
 const keep=new Set(retained);
 const ownedChildren=new Set(edges.filter(e=>owned.has(e.id)).map(e=>e.childPartId));
 const needed=new Set(edges.filter(e=>keep.has(e.id)||(!owned.has(e.id)&&ownedChildren.has(e.parentPartId))).map(e=>e.parentPartId));
 changed=true;while(changed){changed=false;for(const e of edges)if(owned.has(e.id)&&needed.has(e.childPartId)){keep.add(e.id);if(!needed.has(e.parentPartId)){needed.add(e.parentPartId);changed=true;}}}
 return {remove:remove.filter(id=>!keep.has(id)),restore:restore.filter(e=>!keep.has(e.id)),retained:[...keep]};
}
