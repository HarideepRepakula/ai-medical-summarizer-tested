@echo off
echo Starting MedHub Development Servers...
echo.

echo Starting Backend Server (Port 4000)...
start "Backend" cmd /k "cd backend && npm run dev"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server (Port 5173)...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting...
echo Backend: http://localhost:4000
echo Frontend: http://localhost:5173
echo.
pause