@echo off
title VoltGrid Pro - Smart EV Charging System
color 0A
echo.
echo  =====================================================
echo     VOLTGRID PRO - Smart EV Charging System
echo     DSA-Powered C++ Backend with Live Dashboard
echo  =====================================================
echo.

:: -------------------------------------------------------
:: STEP 1: Kill any existing process on port 8080
:: -------------------------------------------------------
echo  [1/3] Checking for existing process on port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    echo  [INFO] Killing PID %%a on port 8080...
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: -------------------------------------------------------
:: STEP 2: Compile if server.exe not found
:: -------------------------------------------------------
echo  [2/3] Checking server.exe...
if not exist server.exe (
    echo  [BUILD] server.exe not found. Compiling backend_server.cpp...
    g++ -std=c++11 -O2 backend_server.cpp -o server.exe -lws2_32
    if %ERRORLEVEL% EQU 0 (
        echo  [BUILD] Compilation successful!
    ) else (
        echo.
        echo  [ERROR] C++ compilation failed!
        echo  Make sure MinGW g++ is installed and in your PATH.
        echo  Falling back to Python server...
        goto RUN_PYTHON
    )
) else (
    echo  [OK] server.exe found.
)

:: -------------------------------------------------------
:: STEP 3: Start C++ Server
:: -------------------------------------------------------
:RUN_CPP
echo  [3/3] Starting C++ Backend Server on port 8080...
echo.
echo  =====================================================
echo   Dashboard URL : http://localhost:8080
echo   Press Ctrl+C to stop the server.
echo  =====================================================
echo.
timeout /t 2 /nobreak >nul
start "" http://localhost:8080/
server.exe 8080
goto END

:: -------------------------------------------------------
:: Fallback: Python Server
:: -------------------------------------------------------
:RUN_PYTHON
echo  [3/3] Starting Python Backend Server on port 8080...
timeout /t 2 /nobreak >nul
start "" http://localhost:8080/
python server.py 8080
goto END

:END
echo.
echo  [INFO] Server stopped.
pause
