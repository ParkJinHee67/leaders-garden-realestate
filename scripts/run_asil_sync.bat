@echo off
cd /d "%~dp0.."
node "%~dp0sync_asil_properties.js" >> "%~dp0sync.log" 2>&1
exit /b %ERRORLEVEL%
