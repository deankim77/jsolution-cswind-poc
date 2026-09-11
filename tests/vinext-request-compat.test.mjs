import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Readable} from 'node:stream';
import {NodeRequest} from 'srvx/node';
const source=fs.readFileSync(new URL('../node_modules/vinext/dist/server/request-pipeline.js',import.meta.url),'utf8');
const start=source.indexOf('function cloneRequestWithHeaders('),end=source.indexOf('\n//#endregion',start);
const body=source.slice(start,end).replace('cloned = new Request(request, { headers });','cloned = new Request(request.clone(), { headers });');
const clone=new Function('getRequestCf',`${body};return cloneRequestWithHeaders`)(()=>undefined);
const make=(method,payload)=>{const req=Readable.from(payload?[Buffer.from(payload)]:[]);Object.assign(req,{method,url:'/api/test',headers:{host:'localhost'},rawHeaders:['host','localhost'],socket:{}});return new NodeRequest({req});};
test('lazy node requests preserve JSON bodies and replacement headers',async()=>{
 for(const method of ['POST','PUT','PATCH']){
  const original=make(method,'{"item":"부품"}'),copy=clone(original,new Headers({'x-test':'yes'}));
  assert.equal(copy.headers.get('x-test'),'yes');assert.equal(copy.method,method);
  assert.deepEqual(await copy.json(),{item:'부품'});
 }
});
test('native and bodyless requests retain request semantics',async()=>{
 for(const method of ['GET','HEAD'])assert.equal(clone(make(method),new Headers()).body,null);
 const native=new Request('http://localhost/test',{method:'POST',body:'payload',redirect:'manual'});
 const copy=clone(native,new Headers());assert.equal(copy.redirect,'manual');assert.equal(await copy.text(),'payload');assert.equal(await native.text(),'payload');
});
