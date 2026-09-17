#!/usr/bin/env python3
"""LZWay Cloud Print Worker.

Proven 2.5.4-compatible worker used by LZWay 3.5.
Consumes authenticated Supabase cloud_print_jobs and forwards ESC/POS bytes to the configured LAN printer.
"""
from __future__ import annotations

import argparse
import base64
import ipaddress
import json
import os
import socket
import sys
import threading
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

MAX_PAYLOAD = 16 * 1024 * 1024
VERSION = "1.0.0-v35"


def _json_request(url, method="GET", headers=None, payload=None, timeout=20):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    hdrs = {"Content-Type": "application/json"}
    hdrs.update(headers or {})
    req = Request(url, data=body, headers=hdrs, method=method)
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail[:500]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Cloud connection failed: {exc.reason}") from exc


def _validate_printer(host: str, port: int, allowed_host: str, allowed_port: int):
    if str(host).strip() != str(allowed_host).strip() or int(port) != int(allowed_port):
        raise ValueError(f"Printer target not authorized; expected {allowed_host}:{allowed_port}")
    if not 1 <= int(port) <= 65535:
        raise ValueError("Printer port out of range")
    infos = socket.getaddrinfo(host, int(port), type=socket.SOCK_STREAM)
    for info in infos:
        raw = info[4][0].split("%", 1)[0]
        ip = ipaddress.ip_address(raw)
        if ip.is_private or ip.is_link_local or ip.is_loopback:
            return str(host), int(port)
    raise ValueError("Printer must resolve to a private/local address")


def send_to_printer(host: str, port: int, payload: bytes, allowed_host: str, allowed_port: int, connect_timeout=5, send_timeout=30):
    host, port = _validate_printer(host, port, allowed_host, allowed_port)
    if not payload or len(payload) > MAX_PAYLOAD:
        raise ValueError("Empty or oversized print payload")
    with socket.create_connection((host, port), timeout=connect_timeout) as sock:
        sock.settimeout(send_timeout)
        sock.sendall(payload)
        try:
            sock.shutdown(socket.SHUT_WR)
        except OSError:
            pass


class CloudPrintWorker:
    def __init__(self, config: dict):
        self.url = str(config.get("supabase_url", "")).rstrip("/")
        self.anon_key = str(config.get("supabase_anon_key", ""))
        self.workspace_id = str(config.get("workspace_id", "")).strip()
        self.email = str(config.get("email", "")).strip()
        self.printer_ip = str(config.get("printer_ip", "192.168.100.73")).strip()
        self.printer_port = int(config.get("printer_port", 9100))
        self.poll_seconds = max(1, min(30, int(config.get("poll_seconds", 2))))
        self.password_env = str(config.get("password_env", "LZWAY_CLOUD_PASSWORD"))
        self.access_token = ""
        self.stop_event = threading.Event()
        if not all([self.url, self.anon_key, self.workspace_id, self.email]):
            raise ValueError("Missing supabase_url, supabase_anon_key, workspace_id or email")

    def password(self):
        value = os.environ.get(self.password_env, "")
        if not value:
            raise RuntimeError(f"Set {self.password_env} before starting the worker")
        return value

    def login(self):
        result = _json_request(self.url + "/auth/v1/token?grant_type=password", "POST", {"apikey": self.anon_key}, {"email": self.email, "password": self.password()}) or {}
        self.access_token = str(result.get("access_token", ""))
        if not self.access_token:
            raise RuntimeError("Supabase sign-in returned no access token")

    def headers(self):
        if not self.access_token:
            self.login()
        return {"apikey": self.anon_key, "Authorization": "Bearer " + self.access_token, "Content-Type": "application/json"}

    def rpc(self, name, payload):
        try:
            return _json_request(self.url + "/rest/v1/rpc/" + name, "POST", self.headers(), payload)
        except RuntimeError as exc:
            if "HTTP 401" not in str(exc):
                raise
            self.access_token = ""
            return _json_request(self.url + "/rest/v1/rpc/" + name, "POST", self.headers(), payload)

    def claim(self):
        rows = self.rpc("claim_cloud_print_job", {"p_workspace_id": self.workspace_id}) or []
        return rows[0] if isinstance(rows, list) and rows else None

    def process_one(self):
        job = self.claim()
        if not job:
            return False
        job_id = str(job["id"])
        try:
            payload = base64.b64decode(str(job.get("payload_base64", "")), validate=True)
            host = str(job.get("printer_ip") or self.printer_ip)
            port = int(job.get("printer_port") or self.printer_port)
            self.rpc("mark_cloud_print_sending", {"p_job_id": job_id})
            send_to_printer(host, port, payload, self.printer_ip, self.printer_port)
            self.rpc("complete_cloud_print_job", {"p_job_id": job_id, "p_error": ""})
            print(f"PRINTED {job_id} ({len(payload)} bytes -> {host}:{port})", flush=True)
        except Exception as exc:
            try:
                self.rpc("fail_cloud_print_job", {"p_job_id": job_id, "p_error": str(exc)[:1000]})
            except Exception:
                pass
            print(f"FAILED {job_id}: {exc}", file=sys.stderr, flush=True)
        return True

    def run(self, once=False):
        self.login()
        self.rpc("requeue_stale_cloud_print_jobs", {"p_workspace_id": self.workspace_id})
        self.rpc("purge_old_cloud_print_jobs", {"p_workspace_id": self.workspace_id})
        while not self.stop_event.is_set():
            try:
                had_job = self.process_one()
                if once:
                    return 0
                if not had_job:
                    self.stop_event.wait(self.poll_seconds)
            except KeyboardInterrupt:
                return 0
            except Exception as exc:
                print(f"WORKER PAUSED: {exc}", file=sys.stderr, flush=True)
                self.access_token = ""
                if once:
                    return 2
                self.stop_event.wait(10)
        return 0


def load_config(path: str):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Configuration must be a JSON object")
    return data


def main(argv=None):
    p = argparse.ArgumentParser(description="LZWay 3.5 cloud print worker")
    p.add_argument("--config", default="cloud-print-worker.json")
    p.add_argument("--once", action="store_true")
    p.add_argument("--version", action="version", version=VERSION)
    args = p.parse_args(argv)
    return CloudPrintWorker(load_config(args.config)).run(once=args.once)


if __name__ == "__main__":
    raise SystemExit(main())
