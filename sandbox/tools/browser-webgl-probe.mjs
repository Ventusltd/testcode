import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {firefox}=require('playwright');
const observations=[];
for(const headless of [true,false]){
 const browser=await firefox.launch({headless});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('console',message=>{if(['error','warning'].includes(message.type()))errors.push(message.text());});
  const capabilities=await page.evaluate(()=>['webgl2','webgl'].map(kind=>{
   const canvas=document.createElement('canvas'),gl=canvas.getContext(kind);
   if(!gl)return{kind,available:false};
   const extension=gl.getExtension('WEBGL_debug_renderer_info');
   const result={kind,available:true,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(gl.RENDERER),unmaskedRenderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null};
   gl.getExtension('WEBGL_lose_context')?.loseContext();return result;
  }));
  observations.push({headless,browser:browser.version(),capabilities,errors});
 }finally{await browser.close();}
}
fs.mkdirSync('pdf-artifacts',{recursive:true});
fs.writeFileSync('pdf-artifacts/firefox-capabilities.json',JSON.stringify(observations,null,2)+'\n');
console.log(JSON.stringify(observations,null,2));
if(!observations.find(row=>!row.headless).capabilities.some(row=>row.kind==='webgl2'&&row.available))throw Error('The headed Firefox runner does not provide WebGL2 for the map');
