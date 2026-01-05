
# Cross-Chain Price Watchdog Kernel

A **KRNL-native, cross-chain price kernel** that fetches external price data, produces a cryptographically attested result, and delivers it on-chain via KRNL’s orchestration layer.

**Pipeline:**  
**fetch → verify → compare (reference) → return → deliver (multi-chain)**

The repository includes full documentation, a test suite, and a React demo that demonstrates end-to-end execution.

---

## Project Scope & Kernel Responsibility

This project implements a **KRNL reference kernel** showing how off-chain price data can be:

- fetched from external sources,
- verified and signed inside the kernel execution environment,
- cryptographically attested,
- and delivered on-chain as a **UserOp-compatible payload**.

The kernel’s responsibility **ends at producing an attested price result**.

All interpretation logic — such as bounds checking, alerts, trading actions, or governance decisions — is implemented as a **reference on-chain consumer**, not as part of the core kernel.

This separation is intentional and illustrates **KRNL best practices**:
- minimal kernels,
- composable consumers,
- and protocol-level flexibility.

---

## Why This Kernel Matters (Real Use Cases)

The Price Watchdog Kernel is designed as a **general-purpose price attestation primitive**, not a single-purpose oracle.

Representative applications include:

- **Prediction markets & instant resolution**  
  Fast, attested price resolution without optimistic challenge windows.

- **DeFi risk automation**  
  Trigger liquidations, hedges, or protocol safeguards using trusted price attestations.

- **DAO treasury monitoring**  
  Continuous verification of asset prices for automated rebalancing or governance actions.

- **Cross-chain portfolio management**  
  Deliver the same attested price payload to multiple chains for synchronized execution.

- **Algorithmic trading & hedging systems**  
  Use kernel-produced prices as trust-minimized inputs for automated strategies.

In all cases, **KRNL handles orchestration and trust minimization**, while consumers remain fully sovereign.

---

## Status

- **SDK**: `@krnl-dev/sdk-core` is included via `file:deps/krnl-dev-sdk-core` for local development.  
  Swap to the official package once registry access is available.

- **Workflow**: Strict DAG validation and execution enforce the pipeline  
  `fetch → verify → compare → return → deliver`.

- **Smart Contract**:  
  `contracts/PriceWatcher.sol` demonstrates how a consumer verifies:
  - signed digest,
  - signer identity,
  - and payload integrity on-chain.

---

## Quickstart
```
npm install
npm test
npm run krnl:validate
npm run krnl:run

```

### Environment Configuration

```bash
echo "PRICEWATCHDOG_SIGNER_KEY=<private_key>" > .env   # optional fallback signer
echo "PWD_TARGET_CONTRACT=<onchain_addr>" >> .env
echo "PWD_CHAINS=1,137" >> .env                        # or ["1","137"]
echo "API_URL_OVERRIDE=<https_url>" >> .env            # optional
echo "PWD_USE_KRNL_PROOF=0" >> .env                    # optional: force local signer path

```

----------

## KRNL Execution Trace (DAG)

```text
Fetch    → External price source (e.g. Coingecko)
Verify   → Digest construction + signer attestation
Compare  → Reference consumer logic (bounds check)
Deliver  → UserOp payload delivered cross-chain

```

Only **fetch**, **verify**, and **deliver** are kernel responsibilities.  
The **compare** step exists purely as a **reference consumer example**.

----------

## KRNL Runbook (Sepolia + EIP-7702)

See `docs/KRNL_RUNBOOK.md` for:

-   `krnl deploy` instructions
    
-   Attestor image creation
    
-   Frontend environment wiring
    
-   End-to-end execution with UserOp delivery to  
    `PriceWatcher.handleResult`
    

----------

## Usage

-   **Validate DAG**
    
    ```bash
    npm run krnl:validate
    
    ```
    
-   **Execute DAG**
    
    ```bash
    npm run krnl:run
    
    ```
    
-   **React Demo**
    
    ```bash
    cd demo
    npm install
    npm run dev
    
    ```
    

The demo UI executes the DAG and displays:

-   fetched price,
    
-   attested proof,
    
-   compare result,
    
-   UserOp payload,
    
-   relay preview.
    

> **Note:** Vite 7 requires Node 20+. Node 18 may build with warnings but is not supported.

----------

## Repository Layout

-   `kernels/` — fetch, verify, compare, return, deliver + `runLocal.ts`
    
-   `workflow.yaml` — DAG definition with delivery and triggers
    
-   `tests/` — mocha/chai tests (kernels + workflow)
    
-   `scripts/` — SDK-based validate/run helpers
    
-   `contracts/PriceWatcher.sol` — reference on-chain consumer
    
-   `docs/` — architecture, workflow, KRNL runbook
    
-   `demo/` — React / Vite TypeScript demo app
    

----------

## Extending the Kernel

-   **Change data sources**  
    Edit `kernels/fetch.ts` or pass `apiUrl`.
    
-   **Custom triggers**  
    Extend `TriggerConfig.types` and `deliver.ts` to support notifications or automated actions.
    
-   **Advanced on-chain verification**  
    Integrate future KRNL SDK on-chain helpers for richer proof validation.
    

----------

## Non-Goals (v1)

-   Multi-source aggregation
    
-   Randomized source sampling
    
-   Time-weighted price construction
    
-   Automated on-chain reactions
    

These are intentional **future extensions**, not required to demonstrate kernel correctness or KRNL alignment.

----------

## Troubleshooting

-   **SDK fetch failures**  
    Ensure outbound HTTPS access or set `API_URL_OVERRIDE`.
    
-   **Demo build warnings**  
    Vite 7 requires Node 20+. Older Node versions may build with warnings but are not supported.
    

----------

## License

This project is licensed under the **[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)**.

