@echo off
REM Production server: one Node process serves BOTH the API and the built UI on PORT.
REM Portable — derives the repo root from its own location and uses node from PATH.
REM Rebuild the UI with `npm run build` after code changes.
cd /d "%~dp0.."
if not defined PORT set PORT=47600
node --import tsx server/src/index.ts >> "scripts\service.log" 2>&1
