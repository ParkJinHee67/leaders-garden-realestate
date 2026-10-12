@echo off
chcp 65001 > nul
echo ========================================================
echo [리더스가든 부동산] 아실 매물 매일 자동 동기화 스케줄러 등록
echo ========================================================
echo 매일 오전 09:00에 자동으로 실행되도록 등록합니다...
schtasks /create /tn "LeadersGarden_AsilSync" /tr "\"d:\홈페이지\리더스가든_부동산\scripts\run_asil_sync.bat\"" /sc daily /st 09:00 /f
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ 윈도우 작업 스케줄러에 성공적으로 등록되었습니다! (매일 09:00 실행)
) else (
    echo.
    echo ⚠️ 스케줄러 등록 실패: 관리자 권한으로 실행해 주세요.
)
pause
