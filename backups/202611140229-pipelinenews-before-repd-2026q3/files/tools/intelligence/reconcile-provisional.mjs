import {readFileSync,writeFileSync,readdirSync,existsSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reconcileProvisional} from '../../cartridges/provisional-identity.mjs';
const registerPath='data/provisional/project-register.json';
if(!existsSync(registerPath)){console.log('No provisional register');process.exit(0);}
let path=process.argv[2];
if(!path){
 // Every imported quarterly source must reach an immutable Pipeline build.
 // Choose the newest compatible project payload; never modify that source.
 const releases=readdirSync('releases').filter(x=>/^\d{12}-pipelinenews$/.test(x)).sort().reverse();
 for(const release of releases){
  const dir=`releases/${release}/data`;if(!existsSync(dir))continue;
  const file=readdirSync(dir).find(x=>/-v8-fast-projects\.json$/.test(x));
  if(file){path=`${dir}/${file}`;break;}
 }
}
if(!path)throw Error('No compatible quarterly project payload');
const bytes=readFileSync(path),data=JSON.parse(bytes);
if(data.schema!=='pipelinenews.v8.fast-project-index.v1'||!Array.isArray(data.fields)||!Array.isArray(data.rows))throw Error('Unsupported quarterly source');
const required=['repd_ref','name','operator','county','capacity_mw'];
for(const field of required)if(!data.fields.includes(field))throw Error('Quarterly identity field missing: '+field);
const official=data.rows.map(values=>Object.fromEntries(required.map(field=>{
 const value=values[data.fields.indexOf(field)];
 return [field,data.dictionaries?.[field] ? data.dictionaries[field][value] : value];
})));
const register=JSON.parse(readFileSync(registerPath));
const source={path,sha256:createHash('sha256').update(bytes).digest('hex')};
const result={...register,projects:reconcileProvisional(register.projects,official,source)};
const body=JSON.stringify(result,null,2)+'\n';
if(body!==readFileSync(registerPath,'utf8').replaceAll('\r\n','\n')){
 const temporary=registerPath+'.tmp';writeFileSync(temporary,body);renameSync(temporary,registerPath);
}
console.log(JSON.stringify({source,pending:result.projects.filter(p=>!p.official_repd_ref).length,matched:result.projects.filter(p=>p.official_repd_ref).length}));
