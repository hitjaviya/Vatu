@echo off
REM Chat Application - Production Build Script (Windows)
REM This script prepares the application for deployment

setlocal enabledelayedexpansion

echo ========================================
echo 🚀 Chat Application - Production Build
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ✗ Node.js is not installed. Please install Node.js 18+ first.
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION% detected
echo.

REM Ask what to build
echo What would you like to build?
echo 1^) Server only
echo 2^) Desktop app only
echo 3^) Both server and desktop app
set /p choice="Enter your choice (1-3): "

REM Get production server URL
if "%choice%"=="2" goto :get_url
if "%choice%"=="3" goto :get_url
goto :build_server

:get_url
echo.
set /p SERVER_URL="Enter your production server URL (e.g., https://api.yourdomain.com): "
if "%SERVER_URL%"=="" (
    echo ✗ Server URL is required for desktop app build
    exit /b 1
)

:build_server
REM Build Server
if "%choice%"=="1" goto :do_build_server
if "%choice%"=="3" goto :do_build_server
goto :build_desktop

:do_build_server
echo.
echo ========================================
echo 📦 Building Server...
echo ========================================
echo.

cd packages\server

REM Install dependencies
echo ℹ Installing server dependencies...
call npm install --production
if %errorlevel% neq 0 (
    echo ✗ Failed to install server dependencies
    cd ..\..
    exit /b 1
)
echo ✓ Server dependencies installed

REM Check for .env file
if not exist .env (
    echo ⚠ .env file not found. Creating template...
    (
        echo NODE_ENV=production
        echo PORT=5000
        echo MONGODB_URI=mongodb://localhost:27017/chatapp
        echo JWT_SECRET=CHANGE-THIS-TO-A-SECURE-RANDOM-STRING
        echo CORS_ORIGIN=https://yourdomain.com
        echo MAX_FILE_SIZE=10485760
        echo UPLOAD_DIR=./uploads
    ) > .env
    echo ⚠ Please update .env file with your production values!
) else (
    echo ✓ .env file found
)

cd ..\..
echo ✓ Server build complete
echo.

:build_desktop
REM Build Desktop App
if "%choice%"=="2" goto :do_build_desktop
if "%choice%"=="3" goto :do_build_desktop
goto :summary

:do_build_desktop
echo.
echo ========================================
echo 🖥️  Building Desktop App...
echo ========================================
echo.

REM Update API URLs
echo ℹ Updating API URLs to production...

REM Backup original files
copy packages\shared\api.js packages\shared\api.js.backup >nul
copy packages\shared\hooks\useSocket.js packages\shared\hooks\useSocket.js.backup >nul

REM Update api.js
powershell -Command "(gc packages\shared\api.js) -replace 'http://localhost:5000/api', '%SERVER_URL%/api' | Out-File -encoding ASCII packages\shared\api.js"

REM Update useSocket.js
powershell -Command "(gc packages\shared\hooks\useSocket.js) -replace 'http://localhost:5000', '%SERVER_URL%' | Out-File -encoding ASCII packages\shared\hooks\useSocket.js"

echo ✓ API URLs updated

REM Install dependencies
cd packages\desktop
echo ℹ Installing desktop app dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ✗ Failed to install desktop app dependencies
    cd ..\..
    move /y packages\shared\api.js.backup packages\shared\api.js >nul
    move /y packages\shared\hooks\useSocket.js.backup packages\shared\hooks\useSocket.js >nul
    exit /b 1
)
echo ✓ Desktop app dependencies installed

REM Build
echo ℹ Building desktop application (this may take a few minutes)...
call npm run build

if %errorlevel% equ 0 (
    echo ✓ Desktop app build complete!
    echo.
    echo ℹ Built files are in: packages\desktop\dist\
    dir dist\*.exe 2>nul
) else (
    echo ✗ Desktop app build failed
    cd ..\..
    move /y packages\shared\api.js.backup packages\shared\api.js >nul
    move /y packages\shared\hooks\useSocket.js.backup packages\shared\hooks\useSocket.js >nul
    exit /b 1
)

cd ..\..

REM Ask if user wants to restore localhost URLs
echo.
set /p restore="Restore localhost URLs for development? (y/n): "
if /i "%restore%"=="y" (
    move /y packages\shared\api.js.backup packages\shared\api.js >nul
    move /y packages\shared\hooks\useSocket.js.backup packages\shared\hooks\useSocket.js >nul
    echo ✓ Localhost URLs restored
) else (
    del packages\shared\api.js.backup 2>nul
    del packages\shared\hooks\useSocket.js.backup 2>nul
    echo ℹ Production URLs kept
)

:summary
REM Summary
echo.
echo ========================================
echo 🎉 Build Complete!
echo ========================================
echo.

if "%choice%"=="1" goto :server_summary
if "%choice%"=="3" goto :server_summary
goto :desktop_summary

:server_summary
echo 📦 Server:
echo    - Location: packages\server\
echo    - Start: cd packages\server ^&^& npm start
echo    - Don't forget to configure .env file!
echo.

:desktop_summary
if "%choice%"=="2" goto :desktop_only_summary
if "%choice%"=="3" goto :desktop_only_summary
goto :final

:desktop_only_summary
echo 🖥️  Desktop App:
echo    - Location: packages\desktop\dist\
echo    - Installers ready for distribution
echo.

:final
echo 📖 For detailed deployment instructions, see DEPLOYMENT.md
echo.
echo ✓ All done! 🚀
echo.

pause
