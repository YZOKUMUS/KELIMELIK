@echo off
REM Kelimelik Asistan: yerel sunucu + tarayici (npm run start -> port 5500)
cd /d "%~dp0.." || exit /b 1
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm bulunamadi. Once https://nodejs.org kurun.
  pause
  exit /b 1
)
start "Kelimelik Asistan (sunucu)" /min cmd /c "npm run start"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5500/index.html"
