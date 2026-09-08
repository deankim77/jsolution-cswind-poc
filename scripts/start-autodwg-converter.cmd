@echo off
setlocal
cd /d "%~dp0.."
if not defined AUTODWG_D2P_EXE set "AUTODWG_D2P_EXE=C:\Program Files (x86)\AutoDWG\AutoDWG DWG to PDF Converter 2020\D2P.exe"
if not defined AUTODWG_CONVERTER_HOST set "AUTODWG_CONVERTER_HOST=127.0.0.1"
if not defined AUTODWG_CONVERTER_PORT set "AUTODWG_CONVERTER_PORT=8791"
echo [J SOLUTION] Starting AutoDWG converter...
echo D2P: %AUTODWG_D2P_EXE%
npm run autodwg:converter
endlocal
