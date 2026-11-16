"""Execute the real sidecar builder on committed bytes and labelled controls."""
import copy
import hashlib
import json
from pathlib import Path
import socket
import sys
import urllib.request


def main():
    attempts = []

    def blocked(*args, **kwargs):
        attempts.append(True)
        raise RuntimeError("Network is unavailable in this offline replay")

    socket.create_connection = socket.getaddrinfo = blocked
    socket.socket.connect = socket.socket.connect_ex = blocked
    urllib.request.urlopen = blocked
    sys.path.insert(0, sys.argv[1])
    from automation.news.build_news_priority import build, dumps

    raw = Path(sys.argv[2]).read_bytes()
    original_sha = hashlib.sha256(raw).hexdigest()
    doc = json.loads(raw)
    primary = build(raw)
    assert dumps(primary) == dumps(build(raw)), "Sidecar is not deterministic"
    cases = [{"name": "current", "body": raw.decode("utf-8"), "sidecar": primary}]
    for state in ("partial", "failed"):
        changed = copy.deepcopy(doc)
        changed["status"] = state
        total = changed["counts"]["feeds_ok"] + changed["counts"]["feeds_failed"]
        changed["counts"]["feeds_ok"] = total - 1 if state == "partial" else 0
        changed["counts"]["feeds_failed"] = 1 if state == "partial" else total
        body = json.dumps(changed, ensure_ascii=False).encode("utf-8")
        cases.append({"name": state, "body": body.decode("utf-8"), "sidecar": build(body)})
    changed = copy.deepcopy(doc)
    changed["items"][0]["title"] = "TESTCODE COUNTERFACTUAL DIFFERENT COLLECTION"
    different = json.dumps(changed, ensure_ascii=False).encode("utf-8")
    assert not attempts, "Network was attempted"
    assert hashlib.sha256(Path(sys.argv[2]).read_bytes()).hexdigest() == original_sha
    print(json.dumps({"schema": "testcode.news-sidecar-inputs.v1", "cases": cases,
                      "other_collection_sidecar": build(different),
                      "input_sha256": original_sha,
                      "sidecar_sha256": hashlib.sha256(dumps(primary).encode("utf-8")).hexdigest(),
                      "network_attempts": len(attempts), "deterministic": True,
                      "input_unchanged": True}))


if __name__ == "__main__":
    main()
