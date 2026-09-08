/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {sessionTokenFromCookie,verifyAppSession} from "../lib/app-auth";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  APP_LOGIN_PASSWORD?: string;
  APP_SESSION_SECRET?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const isPublicPath=(pathname:string)=>pathname==="/login"||pathname==="/api/auth/login"||pathname==="/api/auth/logout"||pathname.startsWith("/_vinext/")||pathname.startsWith("/_next/")||pathname==="/favicon.ico"||/\.(?:css|js|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/i.test(pathname);

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const development=["localhost","127.0.0.1"].includes(url.hostname);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if(!development&&!isPublicPath(url.pathname)){
      const secret=String(env.APP_SESSION_SECRET||"");
      if(!secret){
        if(url.pathname.startsWith("/api/"))return Response.json({error:"로그인 환경설정이 필요합니다."},{status:503});
        return new Response("로그인 환경설정이 필요합니다.",{status:503,headers:{"content-type":"text/plain; charset=utf-8"}});
      }
      const session=await verifyAppSession(sessionTokenFromCookie(request.headers.get("cookie")),secret);
      if(!session){
        if(url.pathname.startsWith("/api/"))return Response.json({error:"로그인이 필요합니다."},{status:401});
        return Response.redirect(new URL("/login",request.url),302);
      }
      const headers=new Headers(request.headers);
      headers.set("oai-authenticated-user-email",session.email);
      headers.delete("x-user-id");headers.delete("x-user-email");headers.delete("x-company-id");
      return handler.fetch(new Request(request,{headers}),env,ctx);
    }

    if(!development&&url.pathname==="/login"&&env.APP_SESSION_SECRET){
      const session=await verifyAppSession(sessionTokenFromCookie(request.headers.get("cookie")),env.APP_SESSION_SECRET);
      if(session)return Response.redirect(new URL("/",request.url),302);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
