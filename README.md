# Cross-Chain Price Watchdog Kernel (Weeks 1–3)

KRNL-powered price watchdog: fetch → verify → compare → return → deliver (multi-chain), with docs and a React demo.

## Status
- SDK: using local stub `@krnl-dev/sdk-core` (file: deps/krnl-dev-sdk-core). Swap to the official package when registry access succeeds.
- CLI: `@krnl-dev/krnl-cli` installed globally (used for future deploys; validation/run now handled via SDK scripts).
- Workflow extended with deliver node + triggers; docs and demo app scaffolded.

## Quickstart
```bash
npm install
npm test
npm run krnl:validate
npm run krnl:run        # executes workflow via SDK executor
```
Env hints:
```bash
echo "PRICEWATCHDOG_SIGNER_KEY=<private_key>" > .env
echo "PWD_TARGET_CONTRACT=<onchain_addr>" >> .env
echo "PWD_CHAINS=1,137" >> .env
```

## Usage
- Harness: `npx ts-node kernels/runLocal.ts` (uses SDK executor + workflow.yaml).
- Validate DAG: `npm run krnl:validate` (SDK parser).
- Execute DAG: `npm run krnl:run` (SDK executor; uses env vars above).
- React demo: `cd demo && npm install && npm run dev` (UI to fetch/compare/deliver + proof/UserOp preview).

## Layout
- `kernels/` — fetch, verify, compare, return, deliver; `runLocal.ts` harness.
- `workflow.yaml` — DAG with deliver + triggers.
- `tests/` — mocha/chai (fetch, compare, deliver, workflow validation/execution).
- `scripts/` — SDK-based validate/run helpers.
- `contracts/PriceWatcher.sol` — example consumer (proof verify stub).
- `docs/` — `WORKFLOW.md`, `architecture.svg`.
- `demo/` — React/Vite TS demo app.

## Extending
- Swap data source: edit `kernels/fetch.ts` or pass `apiUrl`.
- Custom triggers: adjust `TriggerConfig.types` and `deliver.ts` to call new actions (use `proof.link` for traceability).
- On-chain verification: wire proof checks into `PriceWatcher.sol` once SDK on-chain helpers are available.

## Troubleshooting
- npm ESM warning: add `"type": "module"` if you prefer ESM; current scripts force CJS via `TS_NODE_COMPILER_OPTIONS`.
- SDK fetch failures: ensure outbound HTTPS is allowed; fallback to `apiUrl` override.
- Registry access: if the official SDK is unreachable, keep using the bundled stub until access is restored.

