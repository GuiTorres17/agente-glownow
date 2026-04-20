@echo off
chcp 65001 >nul
title GlowNow - Iniciar Agente + Tunnel
cd /d "%~dp0"

echo ============================================
echo   GlowNow Agent - Inicializador automatico
echo ============================================
echo.

REM --- 1) Verifica Python ---
where python >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Python nao encontrado. Instale em https://www.python.org/downloads/
    pause
    exit /b 1
)

REM --- 2) Verifica/instala cloudflared ---
where cloudflared >nul 2>nul
if errorlevel 1 (
    echo [INFO] cloudflared nao encontrado. Tentando instalar via winget...
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    if errorlevel 1 (
        echo.
        echo [ERRO] Nao consegui instalar cloudflared automaticamente.
        echo Baixe manualmente em:
        echo   https://github.com/cloudflare/cloudflared/releases/latest
        echo Procure por: cloudflared-windows-amd64.exe
        echo Renomeie para cloudflared.exe e coloque nesta pasta.
        pause
        exit /b 1
    )
    echo [OK] cloudflared instalado. Pode ser necessario reabrir este .bat
    echo se o comando ainda nao for reconhecido.
)

REM --- 3) Instala dependencias Python (so na primeira vez) ---
if not exist ".deps_ok" (
    echo [INFO] Instalando dependencias Python...
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias.
        pause
        exit /b 1
    )
    echo ok > .deps_ok
)

REM --- 4) Sobe o uvicorn em uma janela separada ---
echo [INFO] Iniciando API em http://localhost:8000 ...
start "GlowNow API" cmd /k "python -m uvicorn api:app --host 0.0.0.0 --port 8000"

REM --- 5) Aguarda a API subir ---
echo [INFO] Aguardando API ficar pronta...
timeout /t 5 /nobreak >nul

REM --- 6) Abre o Cloudflare Tunnel ---
echo.
echo ============================================
echo  COPIE A URL https://*.trycloudflare.com
echo  que aparecer abaixo e cole no Index.tsx
echo  (constante AGENT_URL) + "/chat"
echo ============================================
echo.
cloudflared tunnel --url http://localhost:8000

pause
