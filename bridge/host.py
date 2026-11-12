#!/usr/bin/env python3
"""Native-messaging host for the SpecSnap extension (https://github.com/mmhfarooque/specsnap).

Chrome starts this process when the extension connects. It relays requests from a
localhost HTTP API (used by the `specsnap` CLI / AI agents) to the extension and writes PDFs.

API (127.0.0.1 only, header `X-Token: <~/.config/productcapture/token>` required):
  GET  /status
  POST /capture  {"url": "...", "out": "/abs/file.pdf" | "out_dir": "/abs/dir", "current": false, "opts": {...}}
  POST /extract  {"url": "...", "current": false, "opts": {...}}   -> JSON only, no PDF
"""
import base64, json, os, secrets, struct, sys, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CONF_DIR = os.path.expanduser("~/.config/productcapture")
os.makedirs(CONF_DIR, exist_ok=True)
LOG = os.path.join(CONF_DIR, "host.log")
TOKEN_FILE = os.path.join(CONF_DIR, "token")
CONFIG_FILE = os.path.join(CONF_DIR, "config.json")


def log(*a):
    with open(LOG, "a") as f:
        f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(str(x) for x in a) + "\n")


def load_token():
    if not os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "w") as f:
            f.write(secrets.token_hex(24))
        os.chmod(TOKEN_FILE, 0o600)
    return open(TOKEN_FILE).read().strip()


TOKEN = load_token()
PORT = int(json.load(open(CONFIG_FILE)).get("port", 8777)) if os.path.exists(CONFIG_FILE) else 8777

out_lock = threading.Lock()
pending = {}  # id -> {"ev": Event, "result": dict|None, "chunks": [str]}
state = {"version": None, "connected_at": time.time()}


def send(msg):
    data = json.dumps(msg).encode()
    with out_lock:
        sys.stdout.buffer.write(struct.pack("=I", len(data)) + data)
        sys.stdout.buffer.flush()


def reader():
    stdin = sys.stdin.buffer
    while True:
        raw = stdin.read(4)
        if len(raw) < 4:
            log("extension disconnected; exiting")
            os._exit(0)
        n = struct.unpack("=I", raw)[0]
        msg = json.loads(stdin.read(n))
        t = msg.get("type")
        if t == "hello":
            state["version"] = msg.get("version")
            log("extension connected, version", state["version"])
        elif t in ("chunk", "result"):
            p = pending.get(msg.get("id"))
            if not p:
                continue
            if t == "chunk":
                p["chunks"].append(msg["data"])
            else:
                p["result"] = msg
                p["ev"].set()


def unique_path(path):
    base, ext = os.path.splitext(path)
    i = 2
    while os.path.exists(path):
        path = f"{base} ({i}){ext}"
        i += 1
    return path


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if not secrets.compare_digest(self.headers.get("X-Token", ""), TOKEN):
            self.reply(401, {"ok": False, "error": "bad or missing X-Token"})
            return False
        return True

    def do_GET(self):
        if not self.authorized():
            return
        if self.path == "/status":
            return self.reply(200, {"ok": True, "extension_version": state["version"], "pid": os.getpid()})
        self.reply(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if not self.authorized():
            return
        if self.path not in ("/capture", "/extract"):
            return self.reply(404, {"ok": False, "error": "not found"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        except Exception as e:
            return self.reply(400, {"ok": False, "error": f"bad JSON: {e}"})
        cmd = self.path[1:]
        rid = uuid.uuid4().hex
        p = pending[rid] = {"ev": threading.Event(), "result": None, "chunks": []}
        opts = req.get("opts") or {}
        send({"id": rid, "cmd": cmd, "url": req.get("url"), "current": bool(req.get("current")), "opts": opts})
        ok = p["ev"].wait(timeout=int(opts.get("timeout", 45)) + 240)
        pending.pop(rid, None)
        if not ok:
            return self.reply(504, {"ok": False, "error": "timed out waiting for the extension"})
        res = {k: v for k, v in p["result"].items() if k not in ("type", "id")}
        if not res.get("ok"):
            return self.reply(500, res)
        if cmd == "capture":
            pdf = base64.b64decode("".join(p["chunks"]))
            out = req.get("out")
            if not out:
                out = os.path.join(req.get("out_dir") or os.path.expanduser("~/Downloads/ProductCapture"), res["filename"])
            out = os.path.abspath(os.path.expanduser(out))
            os.makedirs(os.path.dirname(out), exist_ok=True)
            out = unique_path(out) if not req.get("overwrite") else out
            with open(out, "wb") as f:
                f.write(pdf)
            res["file"] = out
            log("saved", out, len(pdf), "bytes")
        self.reply(200, res)


def main():
    if sys.platform == "win32":  # binary stdio for native messaging framing
        import msvcrt
        msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
        msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)
    threading.Thread(target=reader, daemon=True).start()
    try:
        srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    except OSError as e:
        log("cannot bind port", PORT, e)
        # Keep the native port open anyway so the extension doesn't reconnect in a tight loop.
        threading.Event().wait()
    log("listening on 127.0.0.1:%d" % PORT)
    srv.serve_forever()


if __name__ == "__main__":
    main()
