@echo off
chcp 65001 > nul
echo ========================================================
echo [리더스가든 부동산] 아실 매물 자동 동기화 스케줄러 삭제
echo ========================================================
schtasks /delete /tn "LeadersGarden_AsilSync" /f
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ 스케줄러가 삭제되었습니다.
) else (
    echo.
    echo ⚠️ 스케줄러를 찾을 수 없거나 삭제에 실패했습니다.
)
pause
