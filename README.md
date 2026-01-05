# Cross-Chain Price Watchdog Kernel 

KRNL-powered price watchdog: fetch → verify → compare → return → deliver (multi-chain), with docs and a React demo.

## Project Scope & Kernel Responsibility

This project implements a **KRNL-native reference kernel** demonstrating how off-chain price data can be fetched, verified, cryptographically attested, and delivered on-chain via KRNL's orchestration layer.

The kernel's responsibility **ends at producing a verifiable, attested payload**.
Price comparison logic (bounds, reactions, alerts) is implemented as a **reference consumer contract**, not as part of the core kernel.

This separation is intentional and illustrates best practices for kernel minimalism and composability within KRNL.

## Status
- SDK: `@krnl-dev/sdk-core` is provided via `file:deps/krnl-dev-sdk-core` for local/dev. Swap to the official package when available.
- Workflow: strict validator + executor enforce the required pipeline `fetch → verify → compare → return → deliver` (multi-chain).
- Contract: `contracts/PriceWatcher.sol` consumes `deliver` calldata and verifies `digest/signature/signer` for the signed quote.

## Quickstart
```bash
npm install
npm test
npm run krnl:validate
npm run krnl:run        # executes workflow via DAG executor + kernels
```
Env hints:
```bash
echo "PRICEWATCHDOG_SIGNER_KEY=<private_key>" > .env   # optional fallback signer
echo "PWD_TARGET_CONTRACT=<onchain_addr>" >> .env
echo "PWD_CHAINS=1,137" >> .env                        # or: ["1","137"]
echo "API_URL_OVERRIDE=<https_url>" >> .env            # optional
echo "PWD_USE_KRNL_PROOF=0" >> .env                    # optional: force local signer path
```

## KRNL Execution Trace (DAG)

```
Fetch    → External price source (e.g. Coingecko)
Verify   → Digest construction + signer attestation
Compare  → Reference consumer logic (bounds check)
Deliver  → UserOp payload delivered cross-chain to consumer contract
```

Only the **fetch, verify, and deliver** steps are kernel responsibilities.
The compare step is included as a reference consumer example.

## KRNL runbook (Sepolia + EIP-7702)
- See `docs/KRNL_RUNBOOK.md` for deployment (`krnl deploy`), attestor image creation, frontend env wiring, and end-to-end execution with UserOp delivery to `PriceWatcher.handleResult`.

## Usage
- Validate DAG: `npm run krnl:validate` (strict validator).
- Execute DAG: `npm run krnl:run` (DAG executor; uses env vars above).
- React demo: `cd demo && npm install && npm run dev` (UI executes the DAG and displays fetched price, compare result, proof, userOp + relay preview). Requires Node 20+ for Vite 7.

## Layout
- `kernels/` — fetch, verify, compare, return, deliver; `runLocal.ts` harness.
- `workflow.yaml` — DAG with deliver + triggers.
- `tests/` — mocha/chai (fetch, compare, deliver, workflow validation/execution).
- `scripts/` — SDK-based validate/run helpers.
- `contracts/PriceWatcher.sol` — example consumer with on-chain proof verification.
- `docs/` — `WORKFLOW.md`, `KRNL_RUNBOOK.md`, `architecture.svg`.
- `demo/` — React/Vite TS demo app.

## Extending
- Swap data source: edit `kernels/fetch.ts` or pass `apiUrl`.
- Custom triggers: adjust `TriggerConfig.types` and `deliver.ts` to call new actions (use `proof.link` for traceability).
- On-chain verification: wire proof checks into `PriceWatcher.sol` once SDK on-chain helpers are available.

## Troubleshooting
- SDK fetch failures: ensure outbound HTTPS is allowed; fallback to `API_URL_OVERRIDE`.
- Demo build warning: Vite 7 requires Node 20.19+ (Node 18 may build with warnings but is not supported).

