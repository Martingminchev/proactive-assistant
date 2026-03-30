@echo off
echo ========================================
echo Proactive AI Assistant - Setup
echo ========================================
echo.

echo [1/6] Installing server dependencies...
cd server
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install server dependencies
    pause
    exit /b 1
)
echo Server dependencies installed successfully
echo.

echo [2/6] Creating .env file...
if not exist .env (
    copy .env.example .env
    echo .env file created from example
    echo Please edit server\.env with your configuration
) else (
    echo .env file already exists
)
echo.

echo [3/6] Installing client dependencies...
cd ..\client
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install client dependencies
    pause
    exit /b 1
)
echo Client dependencies installed successfully
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Ensure MongoDB is running (mongod or MongoDB Atlas)
echo 2. Ensure Pieces OS is running (pieces.app must be open)
echo 3. Edit server\.env with your MongoDB URI and News API key (optional)
echo 4. Start server: cd server ^&^& npm start
echo 5. Start client: cd client ^&^& npm run dev
echo 6. Open http://localhost:5173 in your browser
echo.
pause
