@echo off
echo Installing Chat Application Dependencies...
echo.

echo [1/3] Installing root dependencies...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 (
    echo Error installing root dependencies
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Installing server dependencies...
cd packages\server
call npm install
if %errorlevel% neq 0 (
    echo Error installing server dependencies
    cd ..\..
    pause
    exit /b %errorlevel%
)
cd ..\..

echo.
echo [3/3] Installing desktop dependencies...
cd packages\desktop
call npm install
if %errorlevel% neq 0 (
    echo Error installing desktop dependencies
    cd ..\..
    pause
    exit /b %errorlevel%
)
cd ..\..

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure MongoDB is running
echo 2. Run 'npm run dev:server' in one terminal
echo 3. Run 'npm run dev:desktop' in another terminal
echo.
pause
