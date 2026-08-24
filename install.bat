@echo off
setlocal
REM Snow Storage Management System - first-time setup (Windows)
REM Double-click this file once. Run it again only if you delete backend\data.

cd /d "%~dp0"

echo ==== 1/4. Installing backend packages ====
cd /d "%~dp0backend"
call npm install
if errorlevel 1 goto :error

echo ==== 2/4. Creating sample data (warehouses/items/accounts) ====
if not exist data (
  call npm run seed
) else (
  echo Data already exists, skipping. Delete backend\data to reseed from scratch.
)

echo ==== 3/4. Installing frontend packages ====
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto :error

echo ==== 4/4. Building frontend ====
call npm run build
if errorlevel 1 goto :error

echo.
echo Setup complete. Now double-click start.bat to run the server.
pause
exit /b 0

:error
echo.
echo Something went wrong. Check that Node.js 22.5+ is installed (run "node -v" in cmd).
pause
exit /b 1
