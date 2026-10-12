@echo off
chcp 65001 > nul
cd /d "d:\홈페이지\리더스가든_부동산"
echo [아실 매물 자동 동기화 실행]
node "scripts\sync_asil_properties.js" >> "scripts\sync.log" 2>&1
exit /b %ERRORLEVEL%
