@echo off
REM Amazon Buy Box Monitor Launcher
REM This script is designed to be run by Windows Task Scheduler

REM Change to the project directory
cd /d "C:\Users\JackW.la\pre-prod"

REM Execute the monitor and display output while also logging to file
echo Starting Amazon Buy Box Check at %DATE% %TIME%...
node -r dotenv/config scripts/monitor-top-100-buybox.js 2>&1 | powershell -Command "$Input | Tee-Object -FilePath 'buybox_monitor_log.txt' -Append"

echo.
echo Completed run at %DATE% %TIME%.
echo This window will stay open. Press any key to close manually.
pause
