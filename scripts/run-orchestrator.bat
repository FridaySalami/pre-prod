@echo off
TITLE Amazon Operations Orchestrator
cd /d "%~dp0.."
echo Checking environment variables...
REM Variable defined check handled by node-cron within orchestrator.js via dotenv

echo Starting Centralized Node-Cron Orchestrator...
echo Logs will be captured in the \logs\ folder.
node scripts\orchestrator.js
pause
