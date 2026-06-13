@echo off
REM Rebuild the UI and restart the background service. Run this after code changes.
cd /d "S:\Project\usage-collector"
call "%~dp0stop.cmd"
echo building UI...
call npm run build
echo starting service (hidden)...
wscript "%~dp0service.vbs"
echo running on http://localhost:47600
