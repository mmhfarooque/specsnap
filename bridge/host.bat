@echo off
rem SpecSnap native-messaging host launcher for Windows (Chrome needs a .bat/.exe path).
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -u "%~dp0host.py" %*
) else (
  python -u "%~dp0host.py" %*
)
