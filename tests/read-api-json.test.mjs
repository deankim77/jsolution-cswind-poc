import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs';
const require=createRequire(import.meta.url),ts=require('typescript');require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {readApiJson}=require('../lib/read-api-json.ts');
test('API parser preserves JSON errors and reports HTML status without exposing page content',async()=>{
 assert.deepEqual(await readApiJson(new Response('{"error":"conflict"}',{status:409})),{error:'conflict'});
 await assert.rejects(readApiJson(new Response('<!DOCTYPE html>private page',{status:500})),e=>e.message.includes('HTTP 500')&&!e.message.includes('private page'));
});
