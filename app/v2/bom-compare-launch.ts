export type BomCompareSeed={rootPartId:string;leftRevisionSeq?:number;rightRevisionSeq?:number};

let pendingSeed:BomCompareSeed|null=null;
let clearTimer:ReturnType<typeof setTimeout>|null=null;

export function setBomCompareSeed(seed:BomCompareSeed){
  pendingSeed=seed;
  if(clearTimer)clearTimeout(clearTimer);
  clearTimer=setTimeout(()=>{pendingSeed=null;clearTimer=null},1500);
}

export function consumeBomCompareSeed(rootPartId:string){
  if(!pendingSeed||pendingSeed.rootPartId!==rootPartId)return null;
  return pendingSeed;
}
