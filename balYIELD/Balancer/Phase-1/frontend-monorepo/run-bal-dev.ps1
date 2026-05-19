$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:PORT = '3017'
& 'C:\Program Files\nodejs\corepack.cmd' pnpm --filter frontend-v3 dev:no-gen *> balyield-dev.log
