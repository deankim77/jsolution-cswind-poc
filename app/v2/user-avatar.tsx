"use client";

import "./user-avatar.css";

type AvatarStyle={skin:string;hair:string;shirt:string;background:string;hairStyle:"short"|"side"|"curl"|"bun"|"wave"|"fade";glasses?:boolean};

export const USER_AVATAR_KEYS=Array.from({length:12},(_,index)=>`avatar-${String(index+1).padStart(2,"0")}`);

const styles:AvatarStyle[]=[
  {skin:"#f4c7a1",hair:"#27211f",shirt:"#0d918c",background:"#dff3f1",hairStyle:"side"},
  {skin:"#e7ad7f",hair:"#4b2d24",shirt:"#4466b0",background:"#e8eefb",hairStyle:"wave",glasses:true},
  {skin:"#8b573d",hair:"#1f1a19",shirt:"#d46b55",background:"#f8e8e2",hairStyle:"curl"},
  {skin:"#f1bf95",hair:"#171717",shirt:"#8056a5",background:"#efe7f6",hairStyle:"bun"},
  {skin:"#6f422f",hair:"#151313",shirt:"#d69a2d",background:"#faefd7",hairStyle:"fade",glasses:true},
  {skin:"#f6d0ad",hair:"#8b5a34",shirt:"#387d69",background:"#e2f2eb",hairStyle:"short"},
  {skin:"#d89566",hair:"#241c19",shirt:"#3d6f91",background:"#e2edf4",hairStyle:"curl"},
  {skin:"#f0b98e",hair:"#3a221d",shirt:"#a55366",background:"#f5e5e9",hairStyle:"bun",glasses:true},
  {skin:"#7b4a34",hair:"#191717",shirt:"#5b67ad",background:"#e7e9f7",hairStyle:"wave"},
  {skin:"#f2c39d",hair:"#1f2328",shirt:"#be6d32",background:"#f8eadf",hairStyle:"side",glasses:true},
  {skin:"#c98255",hair:"#34231e",shirt:"#168477",background:"#dff1ee",hairStyle:"short"},
  {skin:"#5e392c",hair:"#121212",shirt:"#8a5aa3",background:"#eee5f2",hairStyle:"bun"},
];

const hairPath=(style:AvatarStyle["hairStyle"])=>style==="bun"?"M18 29c1-11 9-17 18-17s17 6 18 17c-5-7-11-9-18-9s-13 2-18 9Zm25-16a8 8 0 1 1 13 7":style==="curl"?"M17 31c-2-12 6-21 19-21s21 9 19 21c-4-7-10-11-19-11S21 24 17 31Z":style==="fade"?"M19 27c2-11 8-15 17-15s15 4 17 15c-5-4-10-6-17-6s-12 2-17 6Z":style==="wave"?"M17 31c0-13 8-21 20-21 11 0 19 8 19 20-5-6-10-9-16-9-8 0-12 3-16 8-1-4-3-6-7-7":style==="side"?"M18 30c0-12 8-20 19-20 10 0 18 6 19 17-8-6-16-6-24-2-5 2-9 4-14 5Z":"M19 28c1-11 7-16 17-16 9 0 15 5 17 16-5-5-10-7-17-7s-12 2-17 7Z";

export function UserAvatar({avatarKey="avatar-01",name="사용자",size=36,className=""}:{avatarKey?:string;name?:string;size?:number;className?:string}){
  const index=Math.max(0,USER_AVATAR_KEYS.indexOf(avatarKey));const style=styles[index]??styles[0];
  return <span className={`wv2-user-avatar ${className}`} style={{width:size,height:size}} title={`${name} 아바타`} aria-label={`${name} 아바타`}><svg viewBox="0 0 72 72" role="img" aria-hidden="true"><circle cx="36" cy="36" r="36" fill={style.background}/><path d="M13 72c2-16 11-24 23-24s21 8 23 24" fill={style.shirt}/><ellipse cx="18" cy="34" rx="4" ry="6" fill={style.skin}/><ellipse cx="54" cy="34" rx="4" ry="6" fill={style.skin}/><ellipse cx="36" cy="34" rx="17" ry="21" fill={style.skin}/><path d={hairPath(style.hairStyle)} fill={style.hair}/><circle cx="30" cy="35" r="1.6" fill="#302826"/><circle cx="42" cy="35" r="1.6" fill="#302826"/><path d="M31 43c3 2 7 2 10 0" fill="none" stroke="#9a5e4a" strokeWidth="1.5" strokeLinecap="round"/>{style.glasses&&<g fill="none" stroke="#34434a" strokeWidth="1.5"><rect x="24" y="31" width="10" height="8" rx="3"/><rect x="38" y="31" width="10" height="8" rx="3"/><path d="M34 34h4"/></g>}</svg></span>;
}
