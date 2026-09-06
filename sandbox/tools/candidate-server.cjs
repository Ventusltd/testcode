const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const committed=new Set(execFileSync('git',['ls-tree','-r','--name-only',sourceCommit],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).trim().split('\n'));
const cache=new Map();
function readBytes(repoPath,file){
  if(!committed.has(repoPath))return fs.readFileSync(file); // Uncommitted candidate preview.
  if(!cache.has(repoPath))cache.set(repoPath,execFileSync('git',['show',sourceCommit+':'+repoPath],{cwd:root,maxBuffer:64*1024*1024}));
  return cache.get(repoPath);
}
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative = pathname.startsWith('/testcode/') ? '/sandbox/' + pathname.slice(10) : pathname;
  let file = path.resolve(root, '.' + relative);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
    const repoPath=path.relative(root,file).split(path.sep).join('/');
    const bytes=readBytes(repoPath,file);
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream'}).end(bytes);
  } catch {res.writeHead(404).end();}
});
server.listen(Number(process.env.TEST_PORT||8417),'127.0.0.1',()=>console.log('Candidate server ready '+server.address().port+' committed bytes '+sourceCommit));
