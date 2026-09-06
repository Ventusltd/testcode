const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const relative = pathname.startsWith('/testcode/') ? '/sandbox/' + pathname.slice(10) : pathname;
  let file = path.resolve(root, '.' + relative);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
    const repoPath=path.relative(root,file).split(path.sep).join('/');
    const bytes=repoPath.startsWith('sandbox/202609051906/')
      ? execFileSync('git',['show','HEAD:'+repoPath],{cwd:root,maxBuffer:64*1024*1024}) : fs.readFileSync(file);
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[path.extname(file)]||'application/octet-stream'}).end(bytes);
  } catch {res.writeHead(404).end();}
});
server.listen(Number(process.env.TEST_PORT||8417),'127.0.0.1',()=>console.log('Candidate server ready '+server.address().port));
