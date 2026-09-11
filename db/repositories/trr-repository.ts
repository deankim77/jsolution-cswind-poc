import {randomUUID} from 'node:crypto';
import {and,desc,eq} from 'drizzle-orm';
import {getDb} from '../index';
import {projectsDb} from '../schema';
import {trrJobs,trrVersions} from '../trr-schema';
import {customerDataAccess,type CustomerDataScope} from './customer-data-repository';
import {CustomerDataError} from '../../lib/customer-data-contract';
const now=()=>Math.floor(Date.now()/1000);
const where=(table:typeof trrJobs|typeof trrVersions,s:CustomerDataScope)=>and(eq(table.companyId,s.companyId),eq(table.projectId,s.projectId));
export function createTrrRepository(db=getDb()){
 return {
  async list(s:CustomerDataScope){const permission=await customerDataAccess(db,s);const versions=await db.select().from(trrVersions).where(where(trrVersions,s)).orderBy(desc(trrVersions.version));const [job]=await db.select().from(trrJobs).where(where(trrJobs,s));return {versions,job:job??null,canGenerate:permission.canUpload};},
  async get(s:CustomerDataScope,id:string){await customerDataAccess(db,s);const [row]=await db.select().from(trrVersions).where(and(where(trrVersions,s),eq(trrVersions.id,id)));if(!row)throw new CustomerDataError('이 프로젝트의 TRR 버전을 찾을 수 없습니다.',404);return row;},
  async projectName(s:CustomerDataScope){await customerDataAccess(db,s);const [p]=await db.select({name:projectsDb.name}).from(projectsDb).where(and(eq(projectsDb.id,s.projectId),eq(projectsDb.companyId,s.companyId)));return p.name;},
  async claim(s:CustomerDataScope){return db.transaction(async tx=>{
   await customerDataAccess(tx,s,true);const [job]=await tx.select().from(trrJobs).where(where(trrJobs,s));
   if(job?.status==='running'&&job.updatedAt>now()-600)return null;
   const token=randomUUID();await tx.insert(trrJobs).values({id:randomUUID(),companyId:s.companyId,projectId:s.projectId,status:'running',token,error:null,updatedAt:now()}).onConflictDoUpdate({target:[trrJobs.companyId,trrJobs.projectId],set:{status:'running',token,error:null,updatedAt:now()}});return token;
  });},
  async heartbeat(s:CustomerDataScope,token:string){const rows=await db.update(trrJobs).set({updatedAt:now()}).where(and(where(trrJobs,s),eq(trrJobs.token,token),eq(trrJobs.status,'running'))).returning({id:trrJobs.id});if(!rows.length)throw new CustomerDataError('TRR 생성 작업이 변경되었습니다.',409);},
  async finish(s:CustomerDataScope,token:string,error:string|null){await db.update(trrJobs).set({status:error?'failed':'completed',error,token:null,updatedAt:now()}).where(and(where(trrJobs,s),eq(trrJobs.token,token)));},
  async save(s:CustomerDataScope,token:string,data:Pick<typeof trrVersions.$inferInsert,'id'|'fingerprint'|'summary'|'document'|'fileKey'>){return db.transaction(async tx=>{
   await customerDataAccess(tx,s,true);const [job]=await tx.select().from(trrJobs).where(where(trrJobs,s));if(job?.token!==token||job.status!=='running')throw new CustomerDataError('TRR 생성 잠금이 변경되었습니다.',409);
   const [duplicate]=await tx.select().from(trrVersions).where(and(where(trrVersions,s),eq(trrVersions.fingerprint,data.fingerprint)));if(duplicate)return {row:duplicate,duplicate:true};
   const [latest]=await tx.select({version:trrVersions.version}).from(trrVersions).where(where(trrVersions,s)).orderBy(desc(trrVersions.version)).limit(1);
   const [row]=await tx.insert(trrVersions).values({...data,companyId:s.companyId,projectId:s.projectId,version:(latest?.version??0)+1,createdBy:s.userId,createdAt:now()}).returning();return {row,duplicate:false};
  });},
 };
}
