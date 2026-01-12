@echo off
echo Building ChatApp Desktop Application...

REM Build the React app with Vite
cd packages\desktop
echo Building React app with Vite...
call npx vite build

REM Go back to root
cd ..\..

REM Package with electron-packager
echo Packaging with electron-packager...
call npx electron-packager packages\desktop ChatApp --platform=win32 --arch=x64 --icon=packages\desktop\assets\icon.png --out=dist --overwrite --electron-version=39.2.3 --asar

echo.
echo Build complete! Check the dist\ChatApp-win32-x64 folder for your application.
echo Run ChatApp.exe to start the application.
pause
