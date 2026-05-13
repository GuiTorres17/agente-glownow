@echo off
cd /d "c:\Users\Guilherme\OneDrive\Documentos\PI\agente_glownow"
git add -A
git commit -m "feat: adicionar visao mensal nos dashboards e corrigir erros de lint"
git push origin main
del "%~f0"
