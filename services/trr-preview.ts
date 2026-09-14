import {createHash} from 'node:crypto';

// Standalone document viewer, outside the React application. Only this fixed script
// is allowed by CSP; report text is escaped before it reaches the document.
export const trrPaginationScript=String.raw`
(async()=>{
 await document.fonts.ready;
 const source=document.getElementById('source');
 const pages=document.getElementById('pages');
 let content;
 const newPage=()=>{
  const page=document.createElement('section');page.className='sheet';
  page.setAttribute('aria-label',(pages.children.length+1)+' 페이지');
  content=document.createElement('div');content.className='page-content';
  page.append(content);pages.append(page);
 };
 const fits=()=>content.scrollHeight<=content.clientHeight+1;
 const nodes=Array.from(source.children);
 newPage();
 for(let index=0;index<nodes.length;index++){
  const original=nodes[index];
  if(original.hasAttribute('data-page')&&content.children.length)newPage();
  // Match Word keep-next: headings and detail/reference paragraphs stay together
  // when the group fits on one page.
  const group=[original];
  let end=index;
  while(nodes[end]?.hasAttribute('data-keep')&&nodes[end+1]&&!nodes[end+1].hasAttribute('data-page'))group.push(nodes[++end]);
  const hadContent=content.children.length>0;
  const probe=group.map(node=>node.cloneNode(true));probe.forEach(node=>content.append(node));
  const groupFits=fits();probe.forEach(node=>node.remove());
  if(!groupFits&&hadContent)newPage();
  let text=original.textContent;
  let continuation=false;
  while(text.length){
   const node=original.cloneNode(false);node.textContent=text;
   if(continuation)node.classList.add('continuation');
   content.append(node);
   if(fits())break;
   node.remove();
   // Move a whole paragraph first. Split only if it exceeds an empty page.
   if(content.children.length){newPage();continue;}
   content.append(node);
   const chars=Array.from(text);let lo=0,hi=chars.length;
   while(lo<hi){const mid=Math.ceil((lo+hi)/2);node.textContent=chars.slice(0,mid).join('');if(fits())lo=mid;else hi=mid-1;}
   let cut=Math.max(1,lo);
   const prefix=chars.slice(0,cut).join('');
   const space=prefix.lastIndexOf(' ');
   if(space>prefix.length*0.7)cut=Array.from(prefix.slice(0,space+1)).length;
   node.textContent=chars.slice(0,cut).join('');
   text=chars.slice(cut).join('');continuation=true;
   if(text.length)newPage();
  }
 }
 source.remove();
 document.documentElement.dataset.paginated='true';
})().catch(()=>{document.getElementById('pages').replaceChildren();document.getElementById('source').hidden=false;});
`;
export const trrPreviewCsp=`default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${createHash('sha256').update(trrPaginationScript).digest('base64')}'; sandbox allow-scripts`;
