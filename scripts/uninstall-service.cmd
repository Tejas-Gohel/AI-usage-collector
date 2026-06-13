@echo off
REM Removes auto-start and stops the running service.
set "VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Claude Usage Collector.vbs"
if exist "%VBS%" ( del "%VBS%" & echo Removed auto-start launcher. ) else ( echo No auto-start launcher found. )
call "%~dp0stop.cmd"
