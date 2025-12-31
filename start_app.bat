@echo off
echo Starting Backend...
start cmd /k "python -m uvicorn backend.main:app --reload --port 8000"

echo Starting Frontend...
start cmd /k "cd frontend && npm run dev"

echo Application starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo Please ensure you have set up your Google Cloud Credentials in client_secret.json!
pause
