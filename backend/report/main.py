"""
Main entry point — doubles as a lightweight HTTP server for the browser extension.

Two modes:
  1. CLI:     python main.py analyze --url <url> --regulation gdpr
  2. Server:  python main.py serve --port 8000
              POST /analyze  { "policy_text": "...", "url": "...", "regulation": "gdpr" }
              GET  /health

Your browser extension sends scraped policy text here via POST /analyze.
The response is a full ComplianceReport in JSON format.
"""

import sys
import os

# ── Resolve project root and add all source directories to path ──
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in [
    _ROOT,
    os.path.join(_ROOT, "embed"),
    os.path.join(_ROOT, "ComplianceReport"),
    os.path.join(_ROOT, "metadata"),
    os.path.join(_ROOT, "settings"),
]:
    if _d not in sys.path:
        sys.path.insert(0, _d)

import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv(os.path.join(_ROOT, ".env"))

from pipeline import CompliancePipeline, export_json, print_report
from scraper import scrape_privacy_policy


# ═══════════════════════════════════════════════
# HTTP SERVER FOR BROWSER EXTENSION
# ═══════════════════════════════════════════════

class ComplianceHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        print(f"[server] {args[0]} {args[1]} {args[2]}")

    def send_json(self, data: dict, status: int = 200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")   # for extension CORS
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # Handle CORS preflight from browser extension
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json({"status": "ok", "service": "PrivaComply RAG Pipeline"})
        else:
            self.send_json({"error": "Not found"}, status=404)

    def do_POST(self):
        if self.path != "/analyze":
            self.send_json({"error": "Not found"}, status=404)
            return

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            self.send_json({"error": "Invalid JSON"}, status=400)
            return

        url        = payload.get("url", "").strip()
        regulation = payload.get("regulation", "gdpr")

        if regulation not in ("gdpr", "pdpa", "both"):
            self._safe_send({"error": f"Invalid regulation: {regulation!r}"}, 400)
            return

        if not url or not url.startswith(("http://", "https://")):
            self._safe_send({"error": f"Invalid or unsupported URL: {url!r}"}, 400)
            return

        print(f"[server] Received request — url={url!r}  regulation={regulation!r}")

        try:
            policy_text, privacy_url = scrape_privacy_policy(url)
        except Exception as e:
            print(f"[server] Scrape failed: {e}")
            self._safe_send({"error": f"Could not fetch privacy policy: {e}"}, 502)
            return

        try:
            pipeline = CompliancePipeline(regulation=regulation)
            report   = pipeline.analyze(policy_text=policy_text, url=privacy_url)
            self._safe_send(export_json(report), 200)
        except Exception as e:
            print(f"[server] Pipeline failed: {e}")
            self._safe_send({"error": f"Analysis failed: {e}"}, 500)

    def _safe_send(self, data: dict, status: int = 200):
        try:
            self.send_json(data, status)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass  # client disconnected before response completed


def run_server(host: str = "localhost", port: int = 8000):
    server = HTTPServer((host, port), ComplianceHandler)
    server.timeout = 300  # 5 min — pipeline can take ~30-60s
    print(f"\n[server] PrivaComply RAG server running at http://{host}:{port}")
    print(f"[server] POST /analyze  — analyse a privacy policy")
    print(f"[server] GET  /health   — health check")
    print(f"[server] Press Ctrl+C to stop\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[server] Stopped.")


# ═══════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════

def cmd_analyze(args):
    if args.url:
        print(f"[scraper] Finding privacy policy for: {args.url}")
        policy_text, privacy_url = scrape_privacy_policy(args.url)
        args.url = privacy_url   # update so the report labels the correct URL
    else:
        with open(args.file) as f:
            policy_text = f.read()

    pipeline = CompliancePipeline(regulation=args.regulation)
    report   = pipeline.analyze(policy_text=policy_text, url=args.url or args.file)

    if args.output_json:
        output = json.dumps(export_json(report), indent=2)
        if args.output_file:
            with open(args.output_file, "w") as f:
                f.write(output)
            print(f"Report saved to: {args.output_file}")
        else:
            print(output)
    else:
        print_report(report)
        if args.output_file:
            with open(args.output_file, "w") as f:
                json.dump(export_json(report), f, indent=2)
            print(f"\nJSON report also saved to: {args.output_file}")


def cmd_ingest(args):
    from ingest import run_ingestion
    run_ingestion(regulation=args.regulation, dry_run=args.dry_run)


def cmd_serve(args):
    run_server(host=args.host, port=args.port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="PrivaComply — GDPR/PDPA RAG Compliance Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # ── analyze ──────────────────────────────────
    p_analyze = subparsers.add_parser("analyze", help="Analyse a privacy policy")
    src = p_analyze.add_mutually_exclusive_group(required=True)
    src.add_argument("--url",  help="Website URL to fetch and analyse")
    src.add_argument("--file", help="Local text file containing policy text")
    p_analyze.add_argument("--regulation", choices=["gdpr", "pdpa", "both"], default="gdpr")
    p_analyze.add_argument("--output-json",  action="store_true", help="Print JSON output")
    p_analyze.add_argument("--output-file",  metavar="PATH", help="Save JSON report to file")
    p_analyze.set_defaults(func=cmd_analyze)

    # ── ingest ───────────────────────────────────
    p_ingest = subparsers.add_parser("ingest", help="Ingest legal documents into Qdrant")
    p_ingest.add_argument("--regulation", choices=["gdpr", "pdpa", "both"], default="both")
    p_ingest.add_argument("--dry-run", action="store_true")
    p_ingest.set_defaults(func=cmd_ingest)

    # ── serve ────────────────────────────────────
    p_serve = subparsers.add_parser("serve", help="Start HTTP server for the browser extension")
    p_serve.add_argument("--host", default="localhost")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.set_defaults(func=cmd_serve)

    args = parser.parse_args()
    args.func(args)
