import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
const root=path.resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Publication directory required');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'publication.json'),'utf8'));
if(!manifest.files||!Object.keys(manifest.files).length)throw Error('Missing publication inputs');
const sha=b=>createHash('sha256').update(b).digest('hex');let checked=0;
for(const[name,expected]of Object.entries(manifest.files)){const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))throw Error('Publication file escapes directory');const bytes=fs.readFileSync(file);if(bytes.length!==expected.bytes||sha(bytes)!==expected.sha256)throw Error('Publication byte mismatch: '+name);checked++;}
if(manifest.data){if(/^[a-z]+:/i.test(manifest.data.url))throw Error('This offline check requires a relative data manifest');const data=fs.readFileSync(path.resolve(root,manifest.data.url));if(sha(data)!==manifest.data.sha256)throw Error('Referenced data manifest mismatch');checked++;}
console.log(JSON.stringify({observed_utc:new Date().toISOString(),passed:true,checked,scope:'Exact checked-out asset bytes and referenced data manifest'}));
