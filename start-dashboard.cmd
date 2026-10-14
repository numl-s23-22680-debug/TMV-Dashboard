@echo off
setlocal
cd /d "%~dp0"
title The Man Van - local dashboard preview

echo The Man Van dashboard - local sample preview
echo.

where node >nul 2>&1
if errorlevel 1 goto :node_required
node -e "if (Number(process.versions.node.split('.')[0]) < 24) process.exit(1);" >nul 2>&1
if errorlevel 1 goto :node_required
where npm >nul 2>&1
if errorlevel 1 goto :npm_required

call :install_dependencies "web"
if errorlevel 1 goto :setup_failed
call :install_dependencies "scripts\browser"
if errorlevel 1 goto :setup_failed

set "TMV_OPEN_BROWSER=1"
echo.
echo Starting the dashboard. Your browser will open when it is ready.
echo Keep this window open while using the dashboard.
call npm --prefix scripts/browser run live
if errorlevel 1 goto :preview_failed
echo.
echo Dashboard stopped.
pause
exit /b 0

:install_dependencies
node -e "const f=require('node:fs'),c=require('node:crypto'),p=require('node:path'),d=process.argv[1]; const hash=c.createHash('sha256').update(f.readFileSync(p.join(d,'package-lock.json'))).digest('hex'); const stamp=p.join(d,'node_modules','.tmv-preview-lock.sha256'); process.exit(f.existsSync(p.join(d,'node_modules','.package-lock.json')) && f.existsSync(stamp) && f.readFileSync(stamp,'utf8').trim()===hash ? 0 : 1);" "%~1" >nul 2>&1
if not errorlevel 1 exit /b 0
echo Installing locked dependencies for %~1. Internet access is needed.
call npm ci --prefix "%~1"
if errorlevel 1 exit /b 1
node -e "const f=require('node:fs'),c=require('node:crypto'),p=require('node:path'),d=process.argv[1]; const hash=c.createHash('sha256').update(f.readFileSync(p.join(d,'package-lock.json'))).digest('hex'); f.writeFileSync(p.join(d,'node_modules','.tmv-preview-lock.sha256'),hash+'\n');" "%~1"
exit /b %errorlevel%

:node_required
echo Node.js 24 or newer is required.
echo Install Node.js 24 LTS from https://nodejs.org/en/download
echo Then close this window and double-click start-dashboard.cmd again.
pause
exit /b 1

:npm_required
echo npm was not found. Reinstall Node.js 24 with its npm option enabled.
echo Download: https://nodejs.org/en/download
pause
exit /b 1

:setup_failed
echo.
echo Dependency installation failed. The error is shown above.
echo Check your internet connection, then run start-dashboard.cmd again.
pause
exit /b 1

:preview_failed
echo.
echo The preview could not start. The error is shown above.
echo Close any previous dashboard preview window, then try again.
pause
exit /b 1
