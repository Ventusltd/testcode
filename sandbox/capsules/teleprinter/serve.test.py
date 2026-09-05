import importlib.util
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
spec = importlib.util.spec_from_file_location("receipt_server", Path(__file__).with_name("serve.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReceiptTests(unittest.TestCase):
    def test_real_server_and_static_negative_control(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "site"
            root.mkdir()
            (root / "index.html").write_text("<h1>test app</h1>")
            evidence = Path(temp) / "offline"
            def request(server, path, data=None):
                url = "http://127.0.0.1:%s%s" % (server.server_port, path)
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}), timeout=5) as response:
                        return response.status, response.read()
                except urllib.error.HTTPError as error:
                    return error.code, error.read()
            server = ThreadingHTTPServer(("127.0.0.1", 0), module.handler(root, evidence))
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                self.assertEqual(request(server, "/")[0], 200)
                status, body = request(server, "/__testcode/receipt")
                self.assertEqual(status, 200)
                self.assertEqual(json.loads(body)["schema"], "testcode.receipt-endpoint.v1")
                self.assertEqual(request(server, "/__testcode/receipt", b'{"case":"measured"}')[0], 201)
                record = json.loads((evidence / "diagnostic-receipts.jsonl").read_text())
                self.assertEqual(record["receipt"]["case"], "measured")
                self.assertEqual(request(server, "/__testcode/receipt", b'bad')[0], 400)
                self.assertEqual(request(server, "/__testcode/receipt", b'[]')[0], 400)
                import http.client
                connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=5)
                connection.putrequest("POST", "/__testcode/receipt")
                connection.putheader("Content-Length", str(module.MAX_BODY+1))
                connection.endheaders()
                self.assertEqual(connection.getresponse().status, 413)
                connection.close()
                self.assertEqual(request(server, "/unknown", b'{}')[0], 404)
                self.assertEqual(len((evidence / "diagnostic-receipts.jsonl").read_text().splitlines()), 1)
            finally:
                server.shutdown()
                server.server_close()
                worker.join()
            from functools import partial
            static = ThreadingHTTPServer(("127.0.0.1", 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
            worker = threading.Thread(target=static.serve_forever, daemon=True)
            worker.start()
            try:
                self.assertEqual(request(static, "/__testcode/receipt")[0], 404)
                self.assertEqual(request(static, "/__testcode/receipt", b'{}')[0], 501)
            finally:
                static.shutdown()
                static.server_close()
                worker.join()
if __name__ == "__main__":
    unittest.main()
