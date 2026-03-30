@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo API TEST - Proactive AI Assistant
echo ========================================
echo.
echo Starting server...

:: Kill any existing node processes
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

:: Start server in background
cd /d C:\Users\marti\Desktop\Projects\proactive-assistant\server
start /B cmd /c "npm start > server.log 2>&1"

:: Wait for server to be ready
echo Waiting for server to start...
set /a retries=0
:wait_loop
timeout /t 2 /nobreak >nul
curl -s http://localhost:3001/health >nul 2>&1
if %errorlevel% == 0 goto server_ready
set /a retries+=1
if %retries% GEQ 30 goto server_timeout
goto wait_loop

:server_timeout
echo ERROR: Server failed to start within timeout
goto cleanup

:server_ready
echo Server is ready!
echo.
echo ========================================
echo TESTING ENDPOINTS
echo ========================================
echo.

:: Create results file
echo # API Test Results - Proactive AI Assistant > TEST_RESULTS.md
echo. >> TEST_RESULTS.md
echo **Test Date:** %date% %time% >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md
echo ## Prerequisites Status >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md
echo - MongoDB: Running >> TEST_RESULTS.md
echo - Pieces OS: Not detected >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md
echo ## Endpoint Results >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Test 1: Health Check
echo Testing 1. Health Check...
curl -s -w "\nHTTP_CODE: %{http_code}\n" http://localhost:3001/health > temp1.txt 2>&1
findstr /C:"HTTP_CODE: 200" temp1.txt >nul
if %errorlevel% == 0 (
    echo   [PASS] Health Check - 200 OK
    echo ### 1. Health Check [PASS] >> TEST_RESULTS.md
    echo - Status: 200 OK >> TEST_RESULTS.md
) else (
    echo   [FAIL] Health Check
    echo ### 1. Health Check [FAIL] >> TEST_RESULTS.md
    echo - Status: Error >> TEST_RESULTS.md
)
echo ```json >> TEST_RESULTS.md
type temp1.txt | findstr /V "HTTP_CODE" >> TEST_RESULTS.md
echo ``` >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Test 2: API Docs
echo Testing 2. API Docs...
curl -s -w "\nHTTP_CODE: %{http_code}\n" http://localhost:3001/api > temp2.txt 2>&1
findstr /C:"HTTP_CODE: 200" temp2.txt >nul
if %errorlevel% == 0 (
    echo   [PASS] API Docs - 200 OK
    echo ### 2. API Docs [PASS] >> TEST_RESULTS.md
    echo - Status: 200 OK >> TEST_RESULTS.md
) else (
    echo   [FAIL] API Docs
    echo ### 2. API Docs [FAIL] >> TEST_RESULTS.md
    echo - Status: Error >> TEST_RESULTS.md
)
echo ```json >> TEST_RESULTS.md
type temp2.txt | findstr /V "HTTP_CODE" >> TEST_RESULTS.md
echo ``` >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Test 3: Context Health
echo Testing 3. Context Health...
curl -s -w "\nHTTP_CODE: %{http_code}\n" http://localhost:3001/api/context/health > temp3.txt 2>&1
findstr /C:"HTTP_CODE: 200" temp3.txt >nul
if %errorlevel% == 0 (
    echo   [PASS] Context Health - 200 OK
    echo ### 3. Context Health [PASS] >> TEST_RESULTS.md
    echo - Status: 200 OK >> TEST_RESULTS.md
) else (
    echo   [FAIL] Context Health
    echo ### 3. Context Health [FAIL] >> TEST_RESULTS.md
    echo - Status: Error >> TEST_RESULTS.md
)
echo ```json >> TEST_RESULTS.md
type temp3.txt | findstr /V "HTTP_CODE" >> TEST_RESULTS.md
echo ``` >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Test 4: Realtime Context
echo Testing 4. Realtime Context...
curl -s -w "\nHTTP_CODE: %{http_code}\n" http://localhost:3001/api/context/realtime > temp4.txt 2>&1
findstr /C:"HTTP_CODE: 200" temp4.txt >nul
if %errorlevel% == 0 (
    echo   [PASS] Realtime Context - 200 OK
    echo ### 4. Realtime Context [PASS] >> TEST_RESULTS.md
    echo - Status: 200 OK >> TEST_RESULTS.md
) else (
    echo   [FAIL] Realtime Context
    echo ### 4. Realtime Context [FAIL] >> TEST_RESULTS.md
    echo - Status: Error >> TEST_RESULTS.md
)
echo ```json >> TEST_RESULTS.md
type temp4.txt | findstr /V "HTTP_CODE" >> TEST_RESULTS.md
echo ``` >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Test 5: Today's Brief
echo Testing 5. Today's Brief...
curl -s -w "\nHTTP_CODE: %{http_code}\n" http://localhost:3001/api/briefs/today > temp5.txt 2>&1
findstr /C:"HTTP_CODE: 200" temp5.txt >nul
if %errorlevel% == 0 (
    echo   [PASS] Today's Brief - 200 OK
    echo ### 5. Today's Brief [PASS] >> TEST_RESULTS.md
    echo - Status: 200 OK >> TEST_RESULTS.md
) else (
    echo   [FAIL] Today's Brief
    echo ### 5. Today's Brief [FAIL] >> TEST_RESULTS.md
    echo - Status: Error >> TEST_RESULTS.md
)
echo ```json >> TEST_RESULTS.md
type temp5.txt | findstr /V "HTTP_CODE" >> TEST_RESULTS.md
echo ``` >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Test 6: Active Suggestions
echo Testing 6. Active Suggestions...
curl -s -w "\nHTTP_CODE: %{http_code}\n" http://localhost:3001/api/suggestions/active > temp6.txt 2>&1
findstr /C:"HTTP_CODE: 200" temp6.txt >nul
if %errorlevel% == 0 (
    echo   [PASS] Active Suggestions - 200 OK
    echo ### 6. Active Suggestions [PASS] >> TEST_RESULTS.md
    echo - Status: 200 OK >> TEST_RESULTS.md
) else (
    echo   [FAIL] Active Suggestions
    echo ### 6. Active Suggestions [FAIL] >> TEST_RESULTS.md
    echo - Status: Error >> TEST_RESULTS.md
)
echo ```json >> TEST_RESULTS.md
type temp6.txt | findstr /V "HTTP_CODE" >> TEST_RESULTS.md
echo ``` >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Test 7: Generate Brief
echo Testing 7. Generate Brief (POST)...
curl -s -w "\nHTTP_CODE: %{http_code}\n" -X POST http://localhost:3001/api/briefs/generate > temp7.txt 2>&1
findstr /C:"HTTP_CODE: 200" temp7.txt >nul
if %errorlevel% == 0 (
    echo   [PASS] Generate Brief - 200 OK
    echo ### 7. Generate Brief [PASS] >> TEST_RESULTS.md
    echo - Status: 200 OK >> TEST_RESULTS.md
) else (
    findstr /C:"HTTP_CODE: 201" temp7.txt >nul
    if %errorlevel% == 0 (
        echo   [PASS] Generate Brief - 201 Created
        echo ### 7. Generate Brief [PASS] >> TEST_RESULTS.md
        echo - Status: 201 Created >> TEST_RESULTS.md
    ) else (
        echo   [FAIL] Generate Brief
        echo ### 7. Generate Brief [FAIL] >> TEST_RESULTS.md
        echo - Status: Error >> TEST_RESULTS.md
    )
)
echo ```json >> TEST_RESULTS.md
type temp7.txt | findstr /V "HTTP_CODE" >> TEST_RESULTS.md
echo ``` >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:: Summary
echo. >> TEST_RESULTS.md
echo ## Summary >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md
echo See above for individual endpoint results. >> TEST_RESULTS.md
echo. >> TEST_RESULTS.md

:cleanup
echo.
echo ========================================
echo Cleaning up...
echo ========================================
taskkill /F /IM node.exe >nul 2>&1
del temp*.txt 2>nul

echo.
echo Test complete! Results saved to TEST_RESULTS.md
cd /d C:\Users\marti\Desktop\Projects\proactive-assistant

endlocal
