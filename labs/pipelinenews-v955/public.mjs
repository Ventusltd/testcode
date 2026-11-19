import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),cfg=JSON.parse(readFileSync(resolve(here,'inputs.json'),'utf8'));
const source=resolve(process.env.SOURCE_ROOT||resolve(here,'source'));
const out=resolve(process.env.EVIDENCE_DIR||resolve(here,'evidence'));mkdirSync(out,{recursive:true});
const local=readFileSync(resolve(source,cfg.source.release,'index.html'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const url='https://globalgrid2050.com/'+cfg.source.release+'/';
const result={url,source_sha:cfg.source.sha,local_sha256:hash(local),status:'not-checked'};
try{
 const response=await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache','User-Agent':'testcode-served-byte-audit/1'}});
 const bytes=Buffer.from(await response.arrayBuffer());
 result.http_status=response.status;result.final_url=response.url;result.content_type=response.headers.get('content-type');result.length=bytes.length;result.served_sha256=hash(bytes);result.matches_exact_source=response.ok&&hash(bytes)===hash(local);result.status=result.matches_exact_source?'MATCH':'MISMATCH';
 if(!result.matches_exact_source)result.first_180=bytes.toString('utf8').slice(0,180);
}catch(e){result.status='FETCH_FAILED';result.error=e.message;}
writeFileSync(resolve(out,'public.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
assert.equal(result.status,'MATCH','Public Pages must serve exactly the pinned V9.55 index; deployment success alone is not acceptance');
