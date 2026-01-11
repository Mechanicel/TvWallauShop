@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%..

pushd "%PROJECT_DIR%" >nul

if exist package.json (
  call npm test
  set RESULT=%ERRORLEVEL%
) else (
  echo No tests defined for infra.
  set RESULT=0
)

popd >nul
exit /b %RESULT%
