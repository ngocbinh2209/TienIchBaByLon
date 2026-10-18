@echo off
chcp 65001 >nul
echo === Cài BaByLon Desktop Controller ===
where py >nul 2>nul
if errorlevel 1 (
  echo Chưa tìm thấy Python. Hãy cài Python 3.11+ rồi chạy lại file này.
  pause
  exit /b 1
)
py -m pip install --upgrade pyautogui pillow
if errorlevel 1 (
  echo Cài thư viện thất bại.
  pause
  exit /b 1
)
echo Cài xong.
pause
