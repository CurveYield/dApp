@echo off
cd /d "%~dp0"
set PORT=3017
"C:\Program Files\nodejs\corepack.cmd" pnpm --filter frontend-v3 dev:no-gen
