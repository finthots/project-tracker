@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\.venv\Scripts\python.exe" (
  echo Django environment missing. See README.md for setup.
  pause
  exit /b 1
)
if not exist "frontend\node_modules\vite\bin\vite.js" (
  echo Frontend dependencies missing. See README.md for setup.
  pause
  exit /b 1
)
pushd "backend"
".venv\Scripts\python.exe" manage.py migrate --fake-initial
if errorlevel 1 (
  popd
  echo Database setup failed.
  pause
  exit /b 1
)
popd
start "Project Tracker Django" /D "%~dp0backend" "%~dp0backend\.venv\Scripts\python.exe" manage.py runserver 127.0.0.1:8000
start "Project Tracker React" /D "%~dp0frontend" "C:\Program Files\nodejs\node.exe" node_modules\vite\bin\vite.js --host 127.0.0.1 --port 5175 --strictPort
powershell -NoProfile -Command "Start-Sleep -Seconds 4"
start "" "http://127.0.0.1:5175"
