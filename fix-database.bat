@echo off
echo Fixing better-sqlite3 compilation...
echo.

REM Try to find and use Visual Studio Developer Command Prompt
set VS_PATH=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat
set VS_PATH_ALT=C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat

if exist "%VS_PATH%" (
    echo Found Visual Studio 2022 Build Tools
    call "%VS_PATH%"
    goto rebuild
)

if exist "%VS_PATH_ALT%" (
    echo Found Visual Studio Build Tools (version 18)
    call "%VS_PATH_ALT%"
    goto rebuild
)

echo Visual Studio Build Tools not found in standard locations.
echo Please install Visual Studio Build Tools 2022 with C++ workload.
echo Download: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
pause
exit /b 1

:rebuild
echo.
echo Rebuilding better-sqlite3...
cd /d "%~dp0"
npm rebuild better-sqlite3

if %ERRORLEVEL% EQU 0 (
    echo.
    echo SUCCESS! better-sqlite3 compiled successfully.
    echo You can now restart the app and database will work.
) else (
    echo.
    echo FAILED! Please check the error messages above.
    echo Make sure "Desktop development with C++" workload is installed.
)

pause
