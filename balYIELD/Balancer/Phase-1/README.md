# balYIELD Balancer Phase 1

This folder contains the balYIELD Balancer Phase 1 frontend package.

The working app is the Balancer frontend monorepo under `frontend-monorepo`, modified for balYIELD Phase 1:

- pool explorer: `/balyield/pools`
- swap: `/balyield/swap`
- pool creation: `/create`

## Run Locally

From this folder:

```powershell
cd .\frontend-monorepo
corepack pnpm install --frozen-lockfile
.\run-bal-dev.cmd
```

Then open:

```text
http://127.0.0.1:3017/balyield/pools
```

## Verification

From `frontend-monorepo` after dependencies are installed:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
corepack pnpm --filter frontend-v3 typecheck
cd .\apps\frontend-v3
..\..\node_modules\.bin\next.cmd build
```

Live Base checks:

```powershell
cd ..\..
node .\tools\verify-balyield-phase1.mjs
node .\tools\verify-balyield-create.mjs
```

## Notes

Do not use Forge for this package. Operational contract reads, simulations, and broadcasts should use Node.js plus `viem`.
