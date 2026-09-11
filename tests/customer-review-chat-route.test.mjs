import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=fs.readFileSync(new URL('../app/api/ai/chat/route.ts',import.meta.url),'utf8');
function route({customer=false,failFile=false,trr=false,resumeTrr=false}={}){
 const calls=[],writes=[];
 const statement=sql=>({bind(...args){writes.push({sql,args});return this},async first(){return {id:'conversation',context_items:resumeTrr?JSON.stringify(['v1','v2'].map(id=>({id,kind:'TRR 버전',projectId:'p'}))):'[]'}},async all(){return {results:[{role:'user',content:'앞선 질문'}]}}});
 const db={prepare:statement,batch:async()=>[]};
 const scope={companyId:'c',userId:'u',projectId:'p'};
 const imports={
  '../../../../services/trr-service':{createTrrService:()=>({comparison:async(s,ids)=>{assert.equal(s.projectId,'p');assert.deepEqual(Array.from(ids),['v1','v2']);return {text:'V001: 280 Nm / V002: 320 Nm, spec.pdf p.1',items:ids.map(id=>({id,kind:'TRR 버전',projectId:'p',title:id}))}}})},
  '../../../../services/customer-review-prompts':{CUSTOMER_CHAT_PROMPT:'질문에 답한다. 전체 PBOM을 다시 생성하지 않는다.'},
  '../../../../services/customer-review-service':{createCustomerReviewService:()=>({analyze:()=>assert.fail('must not analyze'),prepareChat:async()=>({files:[{id:'raw',fileName:'drawing.png',mime:'image/png',bytes:Buffer.from('png')}],drafts:[]})})},
  '../../projects/[projectId]/customer-data/context':{customerDataScope:async()=>scope,customerDataError:()=>Response.json({error:'failed'},{status:400})},
  '../../../chatgpt-auth':{getChatGPTUser:async()=>({email:'test'})},
  '../ai-governance':{buildAiGovernancePrompt:()=> 'existing common instructions'},
  '../../../../db/request-context':{resolveRequestContext:async()=>scope},
  '../../../../lib/storage-adapter':{getStorageAdapter:()=>({})},
  '../../../../db/postgres-d1-compat':{getLegacyDbCompat:()=>db},
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{assert.ok(imports[id],id);return imports[id]},process:{env:{OPENAI_API_KEY:'test'}},Buffer,Response,console,crypto,fetch:async(url,init)=>{calls.push(JSON.parse(init.body));if(failFile)throw Error('file request failed');return Response.json({output_text:'답변',id:'response'})}});
 return {calls,writes,send:()=>exports.POST(new Request('http://localhost/api/ai/chat',{method:'POST',body:JSON.stringify({message:'도면 설명',conversationId:'conversation',contextItems:customer?[{id:'raw',kind:'고객 원본',title:'drawing.png'}]:[],...(customer?{customerReview:{projectId:'p',recordId:'raw'}}:{}),...(trr?{trrReview:{projectId:'p',versionIds:['v1','v2']}}:{})})}))};
}
test('review chat uses common conversation history and persistence with original image, not draft analysis',async()=>{
 const r=route({customer:true}),res=await r.send(),body=await res.json();
 assert.equal(res.status,200);assert.equal(body.answer,'답변');assert.equal(body.conversationId,'conversation');assert.equal(body.review,undefined);
 assert.equal(r.calls.length,1);const request=r.calls[0];
 assert.match(request.input[0].content,/전체 PBOM을 다시 생성하지/);assert.equal(request.input[1].content,'앞선 질문');
 assert.ok(request.input.at(-1).content.some(x=>x.type==='input_image'));
 assert.ok(r.writes.some(x=>x.sql.includes('INSERT INTO ai_messages')&&x.args.includes('답변')));
 assert.ok(r.writes.every(x=>!x.sql.includes('customer_review')));
});
test('ordinary common chat retains its original instructions and output budget',async()=>{
 const r=route();assert.equal((await r.send()).status,200);
 assert.equal(r.calls[0].input[0].content,'existing common instructions');assert.equal(r.calls[0].max_output_tokens,500);
});
test('review chat does not silently retry a failed original as filename-only analysis',async()=>{
 const r=route({customer:true,failFile:true});assert.equal((await r.send()).status,502);assert.equal(r.calls.length,1);
});
test('TRR comparison uses authorized snapshots and restores them when resuming the conversation',async()=>{
 for(const options of [{trr:true},{resumeTrr:true}]){const r=route(options);assert.equal((await r.send()).status,200);assert.match(r.calls[0].input[0].content,/TRR 보고서 버전/);assert.match(JSON.stringify(r.calls[0].input.at(-1)),/280 Nm.*320 Nm/);assert.equal(r.calls[0].max_output_tokens,4000);assert.ok(r.writes.some(w=>w.sql.includes('UPDATE ai_conversations')&&w.args.some(a=>typeof a==='string'&&a.includes('"projectId":"p"'))));}
});
