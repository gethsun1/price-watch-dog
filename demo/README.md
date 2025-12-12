# Price Watchdog Demo (Vite)

Simple UI to execute the full DAG locally (fetch → verify → compare → return → deliver) using `workflow.yaml`, and display the fetched price, compare outcome, proof, and UserOp/relay preview.

## Setup
```bash
cd demo
cp env.example .env     # fill with Sepolia + KRNL values
npm install
npm run dev
```
Note: Vite 7 requires Node 20.19+ or 22.12+.

Key envs (see `.env`):
- `VITE_PRICEWATCHER_ADDRESS`: deployed contract on Sepolia
- `VITE_CHAIN_ID`: default chain list (e.g., `11155111`)
- `PIMLICO_API_KEY`, `VITE_RPC_URL`, `VITE_DELEGATED_ACCOUNT_ADDRESS`, `VITE_DELEGATE_OWNER`
- `VITE_ATTESTOR_IMAGE`, `VITE_PRIVY_APP_ID/SECRET`

## Flow
1) Enter token/lower/upper/target contract/chains (prefilled from env).
2) Click **Run Watchdog** to execute `workflow.yaml` end-to-end and preview the delivery artifacts.
3) Use the values in your KRNL workflow trigger to run on-chain; contract emits `ResultHandled`.
