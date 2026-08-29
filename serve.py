#!/usr/bin/env python3
# Dev server with caching disabled so code changes always reach the browser.
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', sys.argv[1] if len(sys.argv) > 1 else 8124))
    try:
        server = http.server.ThreadingHTTPServer(('', port), NoCacheHandler)
    except OSError as e:
        print(f'\n  Could not bind port {port}: {e}')
        print(f'  Something else is using it — likely a plain `python3 -m http.server {port}`.')
        print(f'  Stop that one first:  kill $(lsof -tiTCP:{port} -sTCP:LISTEN)\n')
        sys.exit(1)
    print(
        f'\n  GRAVITY FRONT dev server  ·  caching DISABLED (changes always load)'
        f'\n  ->  http://localhost:{port}'
        f'\n  (run THIS, not `python3 -m http.server` — that one serves stale cached code)'
        f'\n  Ctrl+C to stop.\n',
        flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  server stopped\n')
