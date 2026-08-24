@echo off
REM Run this file as Administrator: right-click it and choose "Run as administrator".
REM It opens port 4000 in Windows Firewall so other phones/PCs on the same
REM office Wi-Fi can reach this server. You only need to run this once.

netsh advfirewall firewall show rule name="SnowStorageApp" >nul 2>&1
if %errorlevel%==0 (
  echo Firewall rule already exists. Nothing to do.
) else (
  netsh advfirewall firewall add rule name="SnowStorageApp" dir=in action=allow protocol=TCP localport=4000
  if errorlevel 1 (
    echo Failed to add the rule. Make sure you right-clicked this file and chose "Run as administrator".
  ) else (
    echo Done. Port 4000 is now allowed through Windows Firewall.
  )
)
pause
