# Workflow Details

This document describes the watchdog workflow defined in `workflow.yaml` and how to validate/execute it locally.

## Inputs
- `token` (string): Coingecko id for the asset.
- `chain` (string): Requesting chain id/name.
- `lowerBound` / `upperBound` (number?): Thresholds.
- `apiUrl` (string?): Optional override for fetch.
- `chains` (string[]): Destination chain ids for delivery.
- `targetContract` (string): Destination contract address for delivery.
- `triggers` (object?): Optional trigger config `{ enabled, types, webhookUrl, metadata }`.

## Nodes
- `fetch`: Calls the external data source (default Coingecko) using SDK HTTP (signed where supported). Output: `quote`.
- `verify`: Signs the quote payload (decimal-safe, `priceE8` + `priceDecimals`). Tries KRNL proof first (when available) and falls back to a local signer. Output: `signedQuote`.
- `compare`: Evaluates bounds and produces `compare` (ABOVE_RANGE | BELOW_RANGE | WITHIN_RANGE).
- `return`: Packages a `WatchdogResult` for downstream use. Output: `result`.
- `deliver`: Builds a UserOp payload and relays across target `chains`; optional triggers (update/pause/notify) can emit additional proofs. Output: `delivery`.

## Running & Validation
- Validate DAG: `npm run krnl:validate` (strict validator; fails on broken DAGs).
- Execute locally: `npm run krnl:run` (DAG executor + kernels).\n+  - Required: `PWD_TARGET_CONTRACT`\n+  - Chains: `PWD_CHAINS=1,137` or `PWD_CHAINS='[\"1\",\"137\"]'`\n+  - Optional: `API_URL_OVERRIDE` (maps to `apiUrl`)\n+  - Optional: `PWD_USE_KRNL_PROOF=0` (force local signer path)
- Harness: `node --loader ts-node/esm kernels/runLocal.ts` (same handlers via workflow executor).

## Extending
- Swap `fetch` data source: pass `apiUrl` or adjust `kernels/fetch.ts`.
- Custom triggers: update `TriggerConfig.types` and extend `deliver.ts` to call `trigger.action` with new payloads; link proofs via SDK `proof.link`.
- On-chain verify: integrate proof verification in `contracts/PriceWatcher.sol` once SDK on-chain helpers are available.

