@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0.codex\scripts\bootstrap_skills.ps1"
if errorlevel 1 (
    echo.
    echo Shared skill setup failed. Existing user folders were preserved.
    pause
    exit /b 1
)
echo.
echo Shared skill links are ready. Refresh Codex and Claude Code skill discovery.
pause
