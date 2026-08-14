@echo off
title Leilao IA - Inicializador
echo ===================================================
echo   Iniciando Servidores Leilao IA PRO v2.0
echo ===================================================

echo [1/2] Iniciando Backend FastAPI (Porta 8000)...
start "Backend - FastAPI" cmd /k "cd /d %~dp0backend && %~dp0backend\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Frontend React (Porta 5173)...
start "Frontend - Vite" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ===================================================
echo   Tudo pronto! Servidores rodando em segundo plano.
echo   Acesse a aplicacao no navegador: http://localhost:5173
echo ===================================================
echo.
echo Mantenha esta janela ou as janelas abertas para manter o sistema ativo.
pause
