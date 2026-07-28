#!/usr/bin/env python3
"""Minimal health-check endpoint for the autosync status."""
from __future__ import annotations

import http.server
import json
import logging
from pathlib import Path

# Config: match the hub's consolidation directory.
HEALTH_FILE = Path("C:/Users/bugre/FlipperZero/consolidation/autosync.health.json")
PORT = 17779

LOG_FILE = Path(__file__).with_suffix(".log")
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)


class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - stdlib API
        if self.path == "/health":
            payload: dict
            try:
                if HEALTH_FILE.exists():
                    payload = json.loads(HEALTH_FILE.read_text(encoding="utf-8"))
                else:
                    payload = {
                        "status": "unknown",
                        "repo": "C:\\Users\\bugre\\FlipperZero",
                        "message": "No health file yet; autosync has not run.",
                    }
            except Exception as exc:  # noqa: BLE001 - defensive endpoint
                payload = {
                    "status": "error",
                    "repo": "C:\\Users\\bugre\\FlipperZero",
                    "message": f"Could not read health file: {exc}",
                }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            logging.info("GET %s -> status=%s", self.path, payload.get("status"))
            return
        self.send_response(404)
        self.end_headers()

    def log_message(self, *args: object) -> None:
        # Route access logs through our file logger instead of stderr.
        pass


if __name__ == "__main__":
    logging.info("Starting FlipperZero health endpoint on port %s", PORT)
    http.server.HTTPServer(("127.0.0.1", PORT), HealthHandler).serve_forever()
