#!/usr/bin/env python

import json
import os
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
TARGET_DIR = BASE_DIR / "target"
PID_FILE = TARGET_DIR / "dev.pid"
META_FILE = TARGET_DIR / "dev.meta.json"
UV_ENV_VAR = "UV_EXE"
VENV_DIR = BASE_DIR / ".venv"

LOG_FILE = TARGET_DIR / "uvicorn.log"
SERVICE_NAME = "python_ai_service"


def log(message: str) -> None:
    print(f"[dev-runner] {message}", flush=True)


def log_error(message: str) -> None:
    print(f"[dev-runner] {message}", file=sys.stderr, flush=True)


def _can_run_uv(command: list[str]) -> bool:
    try:
        result = subprocess.run(
            [*command, "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        return False
    return result.returncode == 0


def resolve_uv_command() -> list[str]:
    uv_override = os.environ.get(UV_ENV_VAR)
    if uv_override:
        return [uv_override]

    venv_python: str | None = None
    if os.name == "nt":
        candidate = VENV_DIR / "Scripts" / "python.exe"
        if candidate.exists():
            venv_python = str(candidate)
    else:
        candidate = VENV_DIR / "bin" / "python"
        if candidate.exists():
            venv_python = str(candidate)

    # Prefer: uv inside .venv
    if venv_python and _can_run_uv([venv_python, "-m", "uv"]):
        return [venv_python, "-m", "uv"]

    # Next: global uv
    if _can_run_uv(["uv"]):
        return ["uv"]

    # Fallback: uv installed into current interpreter
    if _can_run_uv([sys.executable, "-m", "uv"]):
        return [sys.executable, "-m", "uv"]

    log_error(
        "uv was not found. Install uv, create python_ai_service/.venv with uv, "
        "or set UV_EXE to the uv executable."
    )
    sys.exit(1)


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


def _bool_env(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    value = value.strip().lower()
    return value in {"1", "true", "yes", "y", "on"}


def pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False

    if os.name == "nt":
        # tasklist outputs OEM codepage; default cp1252 can crash
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}"],
            capture_output=True,
            text=True,
            encoding="oem",
            errors="replace",
            check=False,
        )
        return str(pid) in (result.stdout or "")

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
            encoding="oem",
            errors="replace",
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
    uv_command = resolve_uv_command()
    log("Running uv sync")
    result = subprocess.run([*uv_command, "sync"], cwd=BASE_DIR, check=False)
    if result.returncode != 0:
        log_error("uv sync failed")
        sys.exit(result.returncode)


def _tail_log(path: Path, max_lines: int = 120) -> str:
    if not path.exists():
        return "<no log file found>"
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return "<failed to read log file>"
    if len(lines) <= max_lines:
        return "\n".join(lines)
    return "\n".join(lines[-max_lines:])


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

    host = os.environ.get("AI_SERVICE_HOST", "0.0.0.0").strip() or "0.0.0.0"
    port_str = os.environ.get("AI_SERVICE_PORT", "8000").strip() or "8000"
    try:
        port = int(port_str)
    except ValueError:
        log_error(f"Invalid AI_SERVICE_PORT: {port_str!r}")
        sys.exit(2)

    # Default: NO autoreload (set AI_SERVICE_RELOAD=1 to enable)
    reload_enabled = _bool_env("AI_SERVICE_RELOAD", False)

    uv_command = resolve_uv_command()
    command = [
        *uv_command,
        "run",
        "python",
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        host,
        "--port",
        str(port),
    ]
    if reload_enabled:
        command.append("--reload")

    # Log to file so we can see crashes
    LOG_FILE.write_text("", encoding="utf-8")
    log_fp = open(LOG_FILE, "a", encoding="utf-8", errors="replace")

    try:
        if os.name == "nt":
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
            process = subprocess.Popen(
                command,
                cwd=BASE_DIR,
                creationflags=creationflags,
                stdout=log_fp,
                stderr=log_fp,
            )
        else:
            process = subprocess.Popen(
                command,
                cwd=BASE_DIR,
                stdout=log_fp,
                stderr=log_fp,
                preexec_fn=os.setsid,
            )
    except Exception as e:
        log_error(f"Failed to start uvicorn: {e}")
        log_fp.close()
        sys.exit(1)

    PID_FILE.write_text(str(process.pid), encoding="utf-8")
    META_FILE.write_text(
        json.dumps(
            {
                "pid": process.pid,
                "command": command,
                "cwd": str(BASE_DIR),
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "logFile": str(LOG_FILE),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    # Give uvicorn a moment; if it dies immediately, FAIL with log excerpt
    time.sleep(1.0)
    exit_code = process.poll()
    log_fp.flush()
    log_fp.close()

    if exit_code is not None:
        log_error(f"Service process exited immediately (exit code {exit_code}).")
        log_error(f"Log file: {LOG_FILE}")
        log_error("Last log lines:")
        log_error(_tail_log(LOG_FILE))
        cleanup_files()
        sys.exit(1)

    log(f"Started service with pid {process.pid}.")
    log(f"Log file: {LOG_FILE}")


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
        print(f"{SERVICE_NAME}: RUNNING (pid={pid})", flush=True)
        return
    if pid:
        print(f"{SERVICE_NAME}: STOPPED (stale pid={pid})", flush=True)
        cleanup_files()
        return
    print(f"{SERVICE_NAME}: STOPPED", flush=True)


def build_service() -> None:
    run_uv_sync()
    log("Build complete")


def test_service() -> None:
    run_uv_sync()
    uv_command = resolve_uv_command()
    log("Running pytest via uv")
    result = subprocess.run([*uv_command, "run", "python", "-m", "pytest"], cwd=BASE_DIR, check=False)
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    if len(sys.argv) < 2:
        log_error("Usage: service.py <start|stop|status|build|test>")
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
    elif action == "test":
        test_service()
    else:
        log_error(f"Unknown action: {action}")
        sys.exit(2)


if __name__ == "__main__":
    main()
