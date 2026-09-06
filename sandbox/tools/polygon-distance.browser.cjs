const fs=require('node:fs'),path=require('node:path');
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/vikra/OneDrive/Documents/GitHub/gridatlas-main-202609050200/node_modules/playwright');}
const base=process.argv[2],out=path.resolve(process.env.TEST_OUTPUT||'polygon-distance-artifacts');fs.mkdirSync(out,{recursive:true});
const reports=[],rad=Math.PI/180,R=6378.137;
const vector=([lon,lat])=>[Math.cos(lat*rad)*Math.cos(lon*rad),Math.cos(lat*rad)*Math.sin(lon*rad),Math.sin(lat*rad)];
function distance(a,b){a=vector(a);b=vector(b);return R*Math.atan2(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]),a.reduce((sum,v,i)=>sum+v*b[i],0));}
const fixtures=[
 ['ordinary-site',[[1,51],[1.01,51],[1.01,51.01],[1,51.01]]],
 ['antipodal-first',[[0,-84.99],[180,84.99],[0,84.99]]],
 ['antipodal-closing',[[180,84.99],[0,84.99],[0,-84.99]]],
 ['near-antipodal',[[0,-84.99],[179.999999,84.989999],[0,84.99]]],
 ['southern-site',[[20,-51],[20.01,-51],[20.01,-51.01],[20,-51.01]]]
];
(async()=>{const browser=await pw.chromium.launch();try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForFunction(()=>window.__GRIDATLAS_V9_MAP__?.getSource('src-zonedraw-points'));
 await page.locator('.gm-title').filter({hasText:/^Scope$/}).click();await page.locator('#btn-zonedraw').click();await page.keyboard.press('Escape');
 for(const [name,points] of fixtures){
  const r={name,checks:[]};reports.push(r);const check=(name,pass,detail)=>{r.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',r.name,name);};
  const ring=[...points,points[0]];
  await page.locator('#zonedraw-file').setInputFiles({name:name+'.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify({type:'Polygon',coordinates:[ring]}))});
  await page.waitForFunction(()=>!window.__GRIDATLAS_V9_MAP__.isMoving());
  const download=async(id,extension)=>{const pending=page.waitForEvent('download');await page.locator(id).click();const file=path.join(out,name+extension);await(await pending).saveAs(file);return fs.readFileSync(file,'utf8');};
  const feature=JSON.parse(await download('#btn-zonedraw-export','.geojson')).features[0];
  const rows=(await download('#btn-zonedraw-csv','.csv')).trim().split(/\r?\n/).slice(1).map(line=>line.split(',').map(Number));
  const segments=points.map((p,i)=>distance(p,points[(i+1)%points.length]));
  const expected=segments.reduce((a,b)=>a+b,0),tolerance=name.includes('antipodal')?.001:1e-7;
  check('GeoJSON perimeter is finite and agrees with independent vector angles',Number.isFinite(feature.properties.perimeter_km)&&Math.abs(feature.properties.perimeter_km-expected)<tolerance,{actual:feature.properties.perimeter_km,expected,toleranceKm:tolerance});
  check('Every CSV distance and chainage is finite',rows.every(row=>row.every(Number.isFinite)),rows);
  check('CSV segments agree with independent vector angles',rows.length===points.length&&rows.every((row,i)=>Math.abs(row[4]/1000-segments[i])<tolerance));
  check('CSV closing chainage agrees with GeoJSON perimeter',Math.abs((rows.at(-1)[3]+rows.at(-1)[4])/1000-feature.properties.perimeter_km)<1e-7);
  check('Export preserves exact input coordinates',JSON.stringify(feature.geometry.coordinates[0])===JSON.stringify(ring)||JSON.stringify(feature.geometry.coordinates[0])===JSON.stringify([...points].reverse().concat([points.at(-1)])));
 }
 reports.push({name:'runtime',checks:[{name:'No script errors',pass:errors.length===0,detail:errors}]});
}finally{await browser.close();}})().catch(e=>{reports.push({error:e.stack});process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,reports},null,2));if(reports.some(r=>r.error||r.checks?.some(c=>!c.pass)))process.exitCode=1;});
