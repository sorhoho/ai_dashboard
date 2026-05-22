"""
Lightweight HTTP server that mirrors the Nginx config:
  - Serves static files from the project root
  - GET /health  -> 200 JSON {"status":"ok","service":"ai-dashboard"}
  - Security headers on every response
  - Cache-Control on static asset types
  - 404 for unknown paths
"""
import http.server
import json
import mimetypes
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

STATIC_EXTS = {'.css', '.js', '.csv', '.png', '.jpg', '.ico', '.woff', '.woff2'}
SECURITY_HEADERS = {
    'X-Frame-Options': 'SAMEORIGIN',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
}


class DashboardHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"  [{self.address_string()}] {fmt % args}")

    def send_common_headers(self, path=''):
        for k, v in SECURITY_HEADERS.items():
            self.send_header(k, v)
        ext = os.path.splitext(path)[1].lower()
        if ext in STATIC_EXTS:
            self.send_header('Cache-Control', 'public, max-age=86400')
        else:
            self.send_header('Cache-Control', 'no-cache')

    def do_HEAD(self):
        self._handle(head_only=True)

    def do_GET(self):
        self._handle(head_only=False)

    def _handle(self, head_only=False):
        path = self.path.split('?')[0]

        # Health endpoint
        if path == '/health':
            body = json.dumps({"status": "ok", "service": "ai-dashboard"}, separators=(',', ':')).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_common_headers()
            self.end_headers()
            if not head_only:
                self.wfile.write(body)
            return

        # Map / -> index.html
        if path in ('', '/'):
            path = '/index.html'

        fs_path = os.path.join(ROOT, path.lstrip('/').replace('/', os.sep))

        if not os.path.isfile(fs_path):
            self.send_response(404)
            self.send_header('Content-Type', 'text/plain')
            self.send_common_headers()
            self.end_headers()
            if not head_only:
                self.wfile.write(b'404 Not Found')
            return

        mime, _ = mimetypes.guess_type(fs_path)
        mime = mime or 'application/octet-stream'

        with open(fs_path, 'rb') as f:
            body = f.read()

        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_common_headers(fs_path)
        self.end_headers()
        if not head_only:
            self.wfile.write(body)


if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), DashboardHandler)
    print(f"  Serving '{ROOT}' on http://0.0.0.0:{PORT}")
    server.serve_forever()
