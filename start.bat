@echo off
setlocal
REM Snow Storage Management System - run the server (Windows)
REM Run install.bat once first, then double-click this file each time.
REM Closing this window stops the server, so keep it minimized to keep running.

echo Checking this PC's network address...
echo Use the "IPv4" address below from another phone/PC's browser, like:
echo   http://THAT_IP_ADDRESS:4000
echo (ignore any address starting with 169.254 - that adapter is not connected)
echo.
ipconfig | findstr /i "IPv4" | findstr /v "169.254"
echo.
echo If the phone still cannot connect, run allow-firewall.bat as Administrator once
echo (right-click it, "Run as administrator") to open port 4000 in Windows Firewall.
echo Also make sure the phone is on the SAME Wi-Fi as this PC, not mobile data.
echo.

cd /d "%~dp0backend"
set PORT=4000
echo Starting server. Do not close this window while you are using the app.
call npm start
pause
