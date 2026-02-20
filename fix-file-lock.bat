@echo off
echo ========================================
echo Fixing File Lock Issue
echo ========================================
echo.
echo This will:
echo   1. Close any processes locking files
echo   2. Clean the build directory
echo   3. Rebuild better-sqlite3
echo.
pause

echo.
echo Step 1: Cleaning build directory...
cd /d "%~dp0"
if exist "node_modules\better-sqlite3\build" (
    echo Removing old build directory...
    rmdir /s /q "node_modules\better-sqlite3\build" 2>nul
    echo Build directory cleaned.
) else (
    echo No build directory found.
)

echo.
echo Step 2: Checking for locked processes...
echo (Make sure File Explorer is not open in the project folder)
echo (Close any antivirus scans if running)
echo.
pause

echo.
echo Step 3: Rebuilding better-sqlite3...
npm rebuild better-sqlite3

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! better-sqlite3 compiled!
    echo ========================================
    echo.
    echo You can now restart the app and database will work.
) else (
    echo.
    echo ========================================
    echo Still having issues?
    echo ========================================
    echo.
    echo Try these steps:
    echo   1. Close File Explorer windows
    echo   2. Close Cursor/VS Code
    echo   3. Run this script again
    echo   4. Or manually delete: node_modules\better-sqlite3\build
    echo   5. Then run: npm rebuild better-sqlite3
)

pause
