## KRNL Watchdog Runbook (Sepolia)

This runbook wires the watchdog DAG (Coingecko fetch → proof → compare → deliver) to KRNL with atomic execution. Code now delivers ABI-encoded calldata to `PriceWatcher.handleResult` and verifies attestor proofs on-chain with replay protection and timestamp validation.

### Prerequisites
- Env (local/dev): `.env` with `PRIVATE_KEY`, `ETHERSCAN_API_KEY`, `SEPOLIA_RPC_URL`, `PIMLICO_API_KEY` (optional, for future gasless execution). Optional: `coingecko-api-key`.
- Tools: Docker Desktop (signed in), MetaMask or compatible wallet on Sepolia, funded Sepolia ETH.
- CLI: `npm install -g @krnl-dev/krnl-cli` (optional, for attestor creation).
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
  - Builds `callData = PriceWatcher.handleResult(result, proof)` for direct contract interaction.
- UserOp structure is created for compatibility; actual on-chain delivery uses direct contract calls via MetaMask/ethers.js when wallet is connected.

### D) Frontend/demo environment
Set in `demo/.env` (optional, defaults work for local testing):
```
VITE_CHAIN_ID=11155111
VITE_PRICEWATCHER_ADDRESS=<PRICEWATCHER_ADDRESS>
VITE_DEFAULT_TOKEN=ethereum
VITE_DEFAULT_LOWER=1500
VITE_DEFAULT_UPPER=3500
```

**Flow:**
1. Start demo: `cd demo && npm install && npm run dev`
2. Connect wallet: Click "Connect Wallet" button in UI (requires MetaMask or compatible wallet)
3. Configure workflow: Enter token, price bounds, target contract address, and chain IDs
4. Execute: Click "Run Watchdog" to execute DAG locally
5. On-chain submission: If wallet is connected and valid target contract is provided, transaction is automatically submitted to `PriceWatcher.handleResult`
6. Monitor: View transaction hash and status in the result panel

### E) Run workflow end-to-end
- Local validation: `npm install` then `npm run krnl:validate`.
- Local execution against Sepolia target: `PWD_TARGET_CONTRACT=<PRICEWATCHER_ADDRESS> PWD_CHAINS=11155111 npm run krnl:run`.
- On-chain via dApp: ensure attestor image is pushed and referenced; Pimlico key used for bundling; submit workflow and confirm `ResultHandled` event and `paused` flag when outcome is `ABOVE_RANGE`.

### F) Proof verification hook (implemented)
- `PriceWatcher.handleResult` recomputes the digest on-chain, recovers the signer, checks token/chain/priceE8 consistency, validates timestamp bounds (24h window), prevents replay attacks via digest storage, and emits `ResultHandled(digest, status, priceE8, priceDecimals, chain, attestor, caller)`. Execution pauses when status is `ABOVE_RANGE`.

**Security features:**
- Replay protection: Each digest can only be used once (stored in `usedDigests` mapping)
- Timestamp validation: `provedAt` must be within 24 hours and not in the future
- Signature verification: ECDSA signature recovery and signer validation
- Consistency checks: Token, chain, and price values must match between result and proof
