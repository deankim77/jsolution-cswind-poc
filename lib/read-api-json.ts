/** Read API responses without treating proxy/login HTML as application JSON. */
export async function readApiJson(response:Response):Promise<any>{
 const text=await response.text();
 try{return JSON.parse(text)}catch{
  const html=/^\s*</.test(text);
  const path=response.url?new URL(response.url).pathname:'';
  console.error('[api-response-format]',{path,status:response.status,contentType:response.headers.get('content-type'),redirected:response.redirected});
  if(response.status===401||response.status===403||/\/login\/?$/.test(path))throw Error(`로그인 상태를 확인하세요. (HTTP ${response.status})`);
  throw Error(`서버가 ${html?'HTML 페이지':'올바르지 않은 응답'}를 반환했습니다. (HTTP ${response.status}${path?`, ${path}`:''})`);
 }
}
