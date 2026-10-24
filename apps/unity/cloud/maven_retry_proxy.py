#!/usr/bin/env python3
"""Local read-through cache for Maven Central and the Gradle Plugin Portal, used by `unity_ci.sh build`.

Cloud sessions share an egress IP, and Maven Central (Sonatype, behind Cloudflare) answers bursts from it with
429 "Your ip has exceeded rate limits" and with fake 404s (Content-Length 1 plus a Retry-After header) for files that
exist. Gradle treats both as "artifact not found", caches that result and fails the Unity build. This proxy fetches from the same official hosts, but one request
at a time per slot, retrying 429, rate-limit 404s, 5xx and connection errors with exponential backoff. A plain 404 (no
Retry-After) is re-checked once before it is believed. Successful files are cached on disk, so later builds hit the network only for new artifacts.

Gradle is pointed here by the init script `unity_ci.sh` writes (repository URLs rewritten to http://127.0.0.1:<port>/central/
and /portal/). Usage: python3 maven_retry_proxy.py --port 8765 [--cache DIR]
"""
from __future__ import annotations

import argparse
import os
import random
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

UPSTREAMS = {
    "central": "https://repo.maven.apache.org/maven2/",
    "portal": "https://plugins.gradle.org/m2/",
}
RETRYABLE = {429, 500, 502, 503, 504}
MAX_ATTEMPTS = 40          # rate limits clear slowly; 2, 4, 8 ... capped at MAX_BACKOFF seconds
MAX_BACKOFF = 60.0
NOT_FOUND_CHECKS = 2       # a plain 404 is believed only after this many answers in a row
UPSTREAM_SLOTS = 2         # concurrent upstream requests; bursts are what trigger the limit
TIMEOUT = 60

_slots = threading.BoundedSemaphore(UPSTREAM_SLOTS)
_missing: set[str] = set()
_lock = threading.Lock()


class UpstreamError(Exception):
    pass


def fetch(url: str) -> bytes | None:
    """Body of `url`, or None when it is really absent. Raises UpstreamError when retries run out."""
    not_found = 0
    for attempt in range(MAX_ATTEMPTS):
        status: int | None = None
        try:
            with _slots:
                req = urllib.request.Request(url, headers={"User-Agent": "uomd-maven-retry-proxy/1"})
                with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                    return resp.read()
        except urllib.error.HTTPError as err:
            status = err.code
            if status == 404 and err.headers.get("Retry-After"):
                status = 429  # Sonatype's rate limiter also answers with a 1-byte 404 that carries Retry-After
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
            status = None
        if status == 404:
            not_found += 1
            if not_found >= NOT_FOUND_CHECKS:
                return None
            time.sleep(1.0 + random.random())
            continue
        if status is not None and status not in RETRYABLE:
            raise UpstreamError(f"{url}: HTTP {status}")
        time.sleep(min(MAX_BACKOFF, 2 ** (attempt + 1)) * (0.5 + random.random() / 2))
    raise UpstreamError(f"{url}: gave up after {MAX_ATTEMPTS} attempts")


def resolve(cache: Path, repo: str, rel: str) -> bytes | None:
    if repo not in UPSTREAMS or ".." in rel.split("/") or rel.startswith("/"):
        return None
    key = f"{repo}/{rel}"
    target = cache / repo / rel
    if target.is_file():
        return target.read_bytes()
    with _lock:
        if key in _missing:
            return None
    body = fetch(UPSTREAMS[repo] + rel)
    if body is None:
        with _lock:
            _missing.add(key)
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_name(f"{target.name}.{os.getpid()}.{threading.get_ident()}.part")
    tmp.write_bytes(body)
    tmp.replace(target)
    return body


def make_handler(cache: Path) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def _serve(self, with_body: bool) -> None:
            parts = self.path.split("?", 1)[0].lstrip("/").split("/", 1)
            if len(parts) != 2:
                self.send_error(404)
                return
            try:
                body = resolve(cache, parts[0], parts[1])
            except UpstreamError as err:
                self.log_message("upstream failure: %s", err)
                self.send_error(502)
                return
            if body is None:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Content-Type", "application/octet-stream")
            self.end_headers()
            if with_body:
                self.wfile.write(body)

        def do_GET(self) -> None:  # noqa: N802 (http.server API)
            self._serve(True)

        def do_HEAD(self) -> None:  # noqa: N802
            self._serve(False)

        def log_message(self, fmt: str, *args: object) -> None:
            if "upstream failure" in fmt:
                super().log_message(fmt, *args)

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--cache", type=Path, default=Path.home() / ".cache" / "uomd-maven")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(args.cache))
    server.daemon_threads = True
    server.serve_forever()


if __name__ == "__main__":
    main()
