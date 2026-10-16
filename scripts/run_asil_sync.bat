@echo off
cd /d "%~dp0.."
node "%~dp0sync_asil_properties.js" >> "%~dp0sync.log" 2>&1
set EXIT_CODE=%ERRORLEVEL%
copy /y "%~dp0sync.log" "%~dp0downloads\sync.log" > nul
exit /b %EXIT_CODE%
