@echo off
REM Stops the running usage-collector service (whatever is listening on 47600).
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":47600 " ^| findstr LISTENING') do (
  echo stopping pid %%a
  taskkill /PID %%a /F >nul 2>&1
)
echo done.
