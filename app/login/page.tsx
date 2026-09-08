"use client";

import {useEffect,useState} from "react";
import {ArrowRight,LockKeyhole,Mail,ShieldCheck} from "lucide-react";
import "./login.css";

const errorMessage=(code:string)=>code==="config"?"로그인 환경설정이 아직 완료되지 않았습니다.":code==="required"?"이메일과 비밀번호를 입력해 주세요.":code?"이메일 또는 비밀번호가 올바르지 않습니다.":"";

export default function LoginPage(){
  const [error,setError]=useState("");
  useEffect(()=>{setError(errorMessage(new URLSearchParams(window.location.search).get("error")||""))},[]);
  return <main className="js-login-page"><section className="js-login-brand"><div className="brand-mark">JS</div><div><small>J SOLUTION</small><h1>AI PLM</h1><p>프로젝트 · WBS · 산출물 · Workflow를 하나의 기준으로 연결합니다.</p></div><ul><li><ShieldCheck size={18}/>회사 계정으로 안전하게 접속</li><li><ShieldCheck size={18}/>프로젝트 권한에 따른 데이터 접근</li><li><ShieldCheck size={18}/>승인·변경·품질 이력 통합 관리</li></ul></section><section className="js-login-card"><div className="login-heading"><span><LockKeyhole size={20}/></span><div><small>SECURE ACCESS</small><h2>로그인</h2><p>등록된 회사 사용자 계정으로 접속해 주세요.</p></div></div><form action="/api/auth/login" method="post"><label><span>이메일</span><div><Mail size={17}/><input name="email" autoFocus type="email" autoComplete="username" placeholder="name@company.com" required/></div></label><label><span>비밀번호</span><div><LockKeyhole size={17}/><input name="password" type="password" autoComplete="current-password" placeholder="비밀번호 입력" required/></div></label>{error&&<p className="login-error">{error}</p>}<button type="submit">로그인 <ArrowRight size={18}/></button></form><footer>J SOLUTION AI PLM · Authorized users only</footer></section></main>;
}
