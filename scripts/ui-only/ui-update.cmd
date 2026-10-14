@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 or newer, then double-click ui-update.cmd again.
  echo The original Desktop\web.zip has not been changed.
  pause
  exit /b 1
)
node "%~dp0apply-new-ui.mjs"
if errorlevel 1 (
  echo.
  echo No original archive was overwritten. Read the error above before retrying.
  pause
  exit /b 1
)
echo.
echo Nothing was installed or started automatically.
echo Follow UI-UPDATE-INFO.txt in Desktop\TMV-New-UI to rebuild and run localhost.
pause
exit /b 0
