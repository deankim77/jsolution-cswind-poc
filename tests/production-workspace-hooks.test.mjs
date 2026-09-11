import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Linter} from 'eslint';
import parser from '@typescript-eslint/parser';
import hooks from 'eslint-plugin-react-hooks';
const lint=source=>new Linter().verify(source,[{files:['**/*.tsx'],languageOptions:{parser,parserOptions:{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}},plugins:{'react-hooks':hooks},rules:{'react-hooks/rules-of-hooks':'error'}}],{filename:'component.tsx'});
test('production workspace and editor hooks remain unconditional across tab renders',()=>{
 for(const path of ['app/v2/production-workspace.tsx','app/v2/customer-data-workspace.tsx','app/v2/production-bulk-dialog.tsx','app/production-editor/page.tsx']){
  assert.deepEqual(lint(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8')),[],path);
 }
});
test('hook regression check rejects effects below an early tab return',()=>{
 const messages=lint("import {useEffect} from 'react'; export default function Workspace({tab}) { if(tab==='customer') return null; useEffect(()=>{},[]); return <div/>; }");
 assert.ok(messages.some(message=>message.ruleId==='react-hooks/rules-of-hooks'));
});
