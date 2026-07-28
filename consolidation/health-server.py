#!/usr/bin/env python3
"""Minimal health-check endpoint for the autosync status."""
from __future__ import annotations

import http.server
import json
from pathlib import Path

# Config: match the hub's consolidation directory.
HEALTH_FILE = Path("C:/Users/bugre/FlipperZero/consolidation/autosync.health.json")
PORT = 17779


class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - stdlib API
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if HEALTH_FILE.exists():
                self.wfile.write(HEALTH_FILE.read_bytes())
            else:
                self.wfile.write(
                    json.dumps({
                        "status": "unknown",
                        "repo": "C:\\Users\\bugre\\FlipperZero",
                        "message": "No health file yet; autosync has not run.",
                    }).encode("utf-8")
                )
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, *args: object) -> None:
        pass


if __name__ == "__main__":
    print(f"FlipperZero health endpoint: http://127.0.0.1:{PORT}/health")
    http.server.HTTPServer(("127.0.0.1", PORT), HealthHandler).serve_forever()
