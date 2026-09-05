"""Local static app server with an offline diagnostic receipt endpoint."""
import argparse
import json
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

MAX_BODY = 1048576

def handler(root, output):
    output = Path(output).resolve()
    if any((parent / ".git").exists() for parent in (output, *output.parents)):
        raise ValueError("Receipt output must be outside Git")
    output.mkdir(parents=True, exist_ok=True)
    log = output / "diagnostic-receipts.jsonl"
    lock = threading.Lock()
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(Path(root).resolve()), **kwargs)
        def reply(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        def do_GET(self):
            if urlsplit(self.path).path != "/__testcode/receipt":
                return super().do_GET()
            self.reply(200, {"schema": "testcode.receipt-endpoint.v1", "method": "POST",
                             "storage": "offline", "maxBytes": MAX_BODY})
        def do_POST(self):
            if urlsplit(self.path).path != "/__testcode/receipt":
                return self.reply(404, {"error": "Unknown endpoint"})
            try:
                size = int(self.headers.get("Content-Length", "-1"))
            except ValueError:
                size = -1
            if size < 0:
                return self.reply(411, {"error": "Content-Length required"})
            if size > MAX_BODY:
                return self.reply(413, {"error": "Receipt too large"})
            try:
                payload = json.loads(self.rfile.read(size).decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("Receipt must be an object")
            except (ValueError, UnicodeError):
                return self.reply(400, {"error": "JSON object required"})
            record = {"receivedAt": datetime.now(timezone.utc).isoformat(), "receipt": payload}
            with lock:
                with log.open("a", encoding="utf-8") as stream:
                    stream.write(json.dumps(record, ensure_ascii=False) + "\n")
            self.reply(201, {"ok": True, "receivedAt": record["receivedAt"]})
    return Handler

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", required=True)
    parser.add_argument("--output", required=True, help="Offline evidence directory, outside Git")
    parser.add_argument("--port", type=int, default=8894)
    args = parser.parse_args()
    ThreadingHTTPServer(("127.0.0.1", args.port), handler(args.root, args.output)).serve_forever()
