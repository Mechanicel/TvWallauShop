@echo off
setlocal
echo [INFO] Starte AI-Service auf http://localhost:8000 ...
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
