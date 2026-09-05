"""Local artifact server + append-only computation receipt collector."""
import json,re,threading,datetime
from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
HERE=Path(__file__).resolve().parent;config=json.loads((HERE/'latest.json').read_text());OUT=Path(config['output']);lock=threading.Lock()
class Handler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=config['webroot'],**kwargs)
 def log_message(self,*args):pass
 def do_POST(self):
  if self.path!='/__testcode/receipt':self.send_error(404);return
  try:
   length=int(self.headers.get('Content-Length',0));assert 0<length<262144
   event=json.loads(self.rfile.read(length));assert event['schema']=='testcode.browser-compute-event.v1'
   visit=event['visit_id'];assert re.fullmatch(r'[a-zA-Z0-9_-]{1,100}',visit)
   event['received_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
   with lock:
    dest=OUT/'receipts';dest.mkdir(exist_ok=True)
    with (dest/(visit+'.jsonl')).open('a',encoding='utf8') as f:f.write(json.dumps(event,separators=(',',':'))+'\n')
   self.send_response(204);self.end_headers()
  except Exception as error:self.send_error(400,str(error))
server=ThreadingHTTPServer(('127.0.0.1',8877),Handler)
print(json.dumps({'url':config['base'],'evidence':str(OUT),'receipt_endpoint':'/__testcode/receipt'}),flush=True)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
