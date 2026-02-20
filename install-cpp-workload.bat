@echo off
echo ========================================
echo Install C++ Workload for Build Tools
echo ========================================
echo.
echo This will open Visual Studio Installer.
echo You need to:
echo   1. Click "Modify" on Build Tools 2022
echo   2. Check "Desktop development with C++"
echo   3. Click "Modify" to install
echo.
pause

REM Open Visual Studio Installer
start "" "C:\Program Files (x86)\Microsoft Visual Studio\Installer\vs_installer.exe"

echo.
echo Installer opened!
echo.
echo After installing the C++ workload, run:
echo   npm rebuild better-sqlite3
echo.
pause
