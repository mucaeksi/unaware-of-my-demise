@echo off
setlocal
powershell.exe -NoLogo -NoProfile -STA -ExecutionPolicy RemoteSigned -File "%~dp0tools\Start-Game.ps1" %*
if errorlevel 1 (
  echo.
  echo The game could not start. See the message above.
  pause
  exit /b 1
)
