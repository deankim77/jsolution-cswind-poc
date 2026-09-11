import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(import.meta.resolve('vinext'));
const file=path.join(path.dirname(entry),'server/request-pipeline.js');
const source=fs.readFileSync(file,'utf8');
const before='cloned = new Request(request, { headers });';
const after='cloned = new Request(request.clone(), { headers });';
if(source.includes(after)){console.log('vinext request compatibility patch already applied.');}
else {
 if(source.split(before).length!==2)throw Error('vinext request pipeline changed; inspect compatibility patch before starting.');
 fs.writeFileSync(file,source.replace(before,after));
 console.log('vinext request compatibility patch applied.');
}
