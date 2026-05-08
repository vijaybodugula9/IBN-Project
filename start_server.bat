@echo off
echo ============================================================
echo   IBN - Intent-Based Networking System
echo   Starting Server...
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/
    pause
    exit /b 1
)

echo [1/3] Checking dependencies...

REM Check if requirements are installed
pip show Flask >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing dependencies...
    pip install -r requirements.txt
) else (
    echo [OK] Dependencies already installed
)

echo.
echo [2/3] Starting Flask backend server...
echo.

REM Start the Flask app
cd backend
python app.py

pause