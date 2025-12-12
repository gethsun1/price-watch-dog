## KRNL Watchdog Runbook (Sepolia, atomic + EIP-7702)

This runbook wires the watchdog DAG (Coingecko fetch → proof → compare → deliver) to KRNL with atomic execution and EIP-7702 delegation. Code now delivers ABI-encoded calldata to `PriceWatcher.handleResult` and verifies attestor proofs on-chain.

### Prerequisites
- Env (local/dev): `.env` with `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `SEPOLIA_RPC_URL`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PIMLICO_API_KEY`. Optional: `coingecko-api-key`.
- Tools: Docker Desktop (signed in), MetaMask on Sepolia, funded Sepolia ETH.
- CLI: `npm install -g @krnl-dev/krnl-cli`.
- SDK: repository includes bundled stub `@krnl-dev/sdk-core` (file: `deps/krnl-dev-sdk-core`). Swap to the official package when registry access is available.

### A) Deploy target contract (`PriceWatcher`)
1. From repo root (optional dry-run): `cd contracts && forge install OpenZeppelin/openzeppelin-contracts eth-infinitism/account-abstraction@v0.7.0 foundry-rs/forge-std && forge build`.
2. Deploy via KRNL CLI (uses `PRIVATE_KEY`, verifies with `ETHERSCAN_API_KEY`):
   - `krnl deploy --network sepolia --contract PriceWatcher --verify`
3. Record `PRICEWATCHER_ADDRESS` for later steps.

### B) Create attestor image (fetch + proof + secrets)
1. Run: `krnl create-attestor`.
2. Provide:
   - Project: `price-watchdog`
   - Registry: `docker.io`
   - Docker username: `<your dockerhub user>`
   - Private key: `PRIVATE_KEY`
   - Encryption secret: generate or provide
   - Secrets in DSL:
     - `rpcSepoliaURL=${SEPOLIA_RPC_URL}`
     - `pimlico-apikey=${PIMLICO_API_KEY}`
     - `coingecko-api-key` (only if needed)
3. Output: `ATTESTOR_IMAGE` e.g. `image://docker.io/<user>/price-watchdog:latest` (push to registry). Save for dApp env.

### C) Atomic KRNL execution (delivery payload)
- Workflow: `workflow.yaml` already models fetch → verify → compare → return → deliver.
- `kernels/verify.ts` signs a decimal-safe quote digest:
  - `digest = keccak256(abi.encode(token, chain, priceE8, priceDecimals, currency, source, fetchedAt))`
  - It tries KRNL proof first (when available) and falls back to a local signer; output includes `digest`, `signature`, `signer`, `provedAt`.
- `kernels/deliver.ts` ABI-encodes:
  - `result`: `(status, priceE8, priceDecimals, token, chain)`
  - `proof`: `(digest, signature, signer, token, chain, priceE8, priceDecimals, currency, source, fetchedAt, provedAt)`
  - Builds `callData = PriceWatcher.handleResult(result, proof)` and wraps it in a UserOp (EIP-7702 friendly).
- Use delegation to the KRNL smart account (SCA) before dispatching the UserOp if required by your flow; Pimlico key used for bundling.

### D) Frontend/demo environment
Set in `demo/.env` (or your frontend env):
```
VITE_PRIVY_APP_ID=${PRIVY_APP_ID}
VITE_PRIVY_APP_SECRET=${PRIVY_APP_SECRET}
VITE_CHAIN_ID=11155111
VITE_DELEGATED_ACCOUNT_ADDRESS=<delegated SCA if used>
VITE_DELEGATE_OWNER=<your EOA>
VITE_PRICEWATCHER_ADDRESS=<PRICEWATCHER_ADDRESS>
VITE_ATTESTOR_IMAGE=<ATTESTOR_IMAGE>
VITE_RPC_URL=${SEPOLIA_RPC_URL}
PIMLICO_API_KEY=${PIMLICO_API_KEY}
```
Flow: connect wallet → fund embedded wallet (Sepolia) → delegate via EIP-7702 (if used) → trigger workflow (token/lower/upper/chains) → SDK executes DAG → UserOp relayed to `PriceWatcher`.

### E) Run workflow end-to-end
- Local validation: `npm install` then `npm run krnl:validate`.
- Local execution against Sepolia target: `PWD_TARGET_CONTRACT=<PRICEWATCHER_ADDRESS> PWD_CHAINS=11155111 npm run krnl:run`.
- On-chain via dApp: ensure attestor image is pushed and referenced; Pimlico key used for bundling; submit workflow and confirm `ResultHandled` event and `paused` flag when outcome is `ABOVE_RANGE`.

### F) Proof verification hook (implemented)
- `PriceWatcher.handleResult` recomputes the digest on-chain, recovers the signer, checks token/chain/priceE8 consistency, and emits `ResultHandled(digest, status, priceE8, priceDecimals, chain, attestor, caller)`. Execution pauses when status is `ABOVE_RANGE`.
