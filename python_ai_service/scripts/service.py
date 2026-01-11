#!/usr/bin/env python

import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
TARGET_DIR = BASE_DIR / "target"
PID_FILE = TARGET_DIR / "dev.pid"
META_FILE = TARGET_DIR / "dev.meta.json"


def log(message: str) -> None:
    print(f"[dev-runner] {message}")


def log_error(message: str) -> None:
    print(f"[dev-runner] {message}", file=sys.stderr)


def read_pid() -> int | None:
    if not PID_FILE.exists():
        return None
    value = PID_FILE.read_text(encoding="utf-8").strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if os.name == "nt":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            check=False,
        )
        return str(pid) in result.stdout
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def cleanup_files() -> None:
    if PID_FILE.exists():
        PID_FILE.unlink()
    if META_FILE.exists():
        META_FILE.unlink()


def wait_for_exit(pid: int, timeout_s: float) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if not pid_alive(pid):
            return True
        time.sleep(0.2)
    return not pid_alive(pid)


def stop_process(pid: int) -> bool:
    if os.name == "nt":
        result = subprocess.run(
            ["taskkill", "/PID", str(pid), "/T", "/F"],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0
    try:
        os.killpg(pid, signal.SIGTERM)
    except Exception:
        return False
    if wait_for_exit(pid, 5.0):
        return True
    try:
        os.killpg(pid, signal.SIGKILL)
    except Exception:
        return False
    return wait_for_exit(pid, 5.0)


def ensure_target() -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)


def run_uv_sync() -> None:
    log("Running uv sync")
    result = subprocess.run(["uv", "sync"], cwd=BASE_DIR, check=False)
    if result.returncode != 0:
        log_error("uv sync failed")
        sys.exit(result.returncode)


def start_service() -> None:
    pid = read_pid()
    if pid and pid_alive(pid):
        log_error(f"Service already running with pid {pid}.")
        sys.exit(1)
    if pid and not pid_alive(pid):
        log("Stale pid file found. Removing.")
        cleanup_files()

    run_uv_sync()
    ensure_target()

    command = [
        "uv",
        "run",
        "uvicorn",
        "app.main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
    ]

    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
        process = subprocess.Popen(
            command,
            cwd=BASE_DIR,
            creationflags=creationflags,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    else:
        process = subprocess.Popen(
            command,
            cwd=BASE_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,
        )

    PID_FILE.write_text(str(process.pid), encoding="utf-8")
    META_FILE.write_text(
        json.dumps(
            {
                "pid": process.pid,
                "command": command,
                "cwd": str(BASE_DIR),
                "startedAt": datetime.utcnow().isoformat() + "Z",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    log(f"Started service with pid {process.pid}.")


def stop_service() -> None:
    pid = read_pid()
    if not pid:
        log("Service is not running.")
        cleanup_files()
        return
    if not pid_alive(pid):
        log(f"Stale pid file for pid {pid}. Cleaning up.")
        cleanup_files()
        return
    stopped = stop_process(pid)
    if not stopped:
        log_error(f"Failed to stop pid {pid}.")
        sys.exit(1)
    cleanup_files()
    log(f"Stopped service with pid {pid}.")


def status_service() -> None:
    pid = read_pid()
    if pid and pid_alive(pid):
        log(f"running (pid {pid})")
        return
    if pid:
        log(f"stopped (stale pid {pid})")
        cleanup_files()
        return
    log("stopped")


def build_service() -> None:
    run_uv_sync()
    log("Build complete")


def main() -> None:
    if len(sys.argv) < 2:
        log_error("Usage: service.py <start|stop|status|build>")
        sys.exit(2)
    action = sys.argv[1]
    if action == "start":
        start_service()
    elif action == "stop":
        stop_service()
    elif action == "status":
        status_service()
    elif action == "build":
        build_service()
    else:
        log_error(f"Unknown action: {action}")
        sys.exit(2)


if __name__ == "__main__":
    main()
