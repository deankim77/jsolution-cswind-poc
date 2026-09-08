export const APP_SESSION_COOKIE="jsolution_session";

type SessionPayload={email:string;exp:number};

const encoder=new TextEncoder();

function base64UrlEncode(bytes:Uint8Array){let binary="";for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,"")}
function base64UrlDecode(value:string){const padded=value.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-value.length%4)%4);const binary=atob(padded),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);return bytes}
async function hmacKey(secret:string,usage:KeyUsage[]){return crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,usage)}

export async function createAppSession(email:string,secret:string,ttlSeconds=60*60*12){
  const payload:SessionPayload={email:email.trim().toLowerCase(),exp:Math.floor(Date.now()/1000)+ttlSeconds};
  const encoded=base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature=new Uint8Array(await crypto.subtle.sign("HMAC",await hmacKey(secret,["sign"]),encoder.encode(encoded)));
  return `${encoded}.${base64UrlEncode(signature)}`;
}

export async function verifyAppSession(token:string|undefined,secret:string){
  if(!token||!secret)return null;
  const [payloadPart,signaturePart,...rest]=token.split(".");if(!payloadPart||!signaturePart||rest.length)return null;
  try{
    const valid=await crypto.subtle.verify("HMAC",await hmacKey(secret,["verify"]),base64UrlDecode(signaturePart),encoder.encode(payloadPart));
    if(!valid)return null;
    const payload=JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as SessionPayload;
    if(!payload.email||!payload.exp||payload.exp<=Math.floor(Date.now()/1000))return null;
    return payload;
  }catch{return null}
}

export function sessionTokenFromCookie(cookieHeader:string|null){
  if(!cookieHeader)return undefined;
  for(const part of cookieHeader.split(";")){const [name,...value]=part.trim().split("=");if(name===APP_SESSION_COOKIE)return decodeURIComponent(value.join("="))}
  return undefined;
}

export function appSessionCookie(token:string,maxAge=60*60*12){return `${APP_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function clearAppSessionCookie(){return `${APP_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
