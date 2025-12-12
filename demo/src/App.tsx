import { useMemo, useState } from "react";
import "./App.css";
import workflowYaml from "./watchdog/workflow.yaml?raw";
import {
  parseAndValidate,
  executeWorkflow,
  fetchPrice,
  verifyPrice,
  comparePrice,
  buildReturnPayload,
  deliverResult,
} from "./watchdog";

type Outcome = "ABOVE_RANGE" | "BELOW_RANGE" | "WITHIN_RANGE";

interface RunResult {
  price: number;
  outcome: Outcome;
  proof?: { digest: string; signature: string; signer: string };
  userOp?: Record<string, unknown>;
  relays?: Array<{ chain: string; hash: string }>;
}

function App() {
  const defaultToken = import.meta.env.VITE_DEFAULT_TOKEN ?? "ethereum";
  const defaultLower = import.meta.env.VITE_DEFAULT_LOWER ?? "1500";
  const defaultUpper = import.meta.env.VITE_DEFAULT_UPPER ?? "3500";
  const defaultChains = import.meta.env.VITE_CHAIN_ID ?? "1,137";
  const defaultTarget = import.meta.env.VITE_PRICEWATCHER_ADDRESS ?? "0x";

  const [token, setToken] = useState(defaultToken);
  const [lower, setLower] = useState<string>(defaultLower);
  const [upper, setUpper] = useState<string>(defaultUpper);
  const [chains, setChains] = useState(defaultChains);
  const [targetContract, setTargetContract] = useState(defaultTarget);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const lowerNum = useMemo(
    () => (lower ? Number(lower) : undefined),
    [lower],
  );
  const upperNum = useMemo(
    () => (upper ? Number(upper) : undefined),
    [upper],
  );

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const validated = parseAndValidate({ yamlContent: workflowYaml });
      if (!validated.valid) {
        const errs = (validated as any).errors?.join("; ") ?? "unknown validation error";
        throw new Error(`workflow invalid: ${errs}`);
      }

      const chainList = chains
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean);

      const execution = await executeWorkflow({
        workflow: validated.workflow,
        input: {
          token,
          chain: chainList[0] ?? "sepolia",
          lowerBound: lowerNum,
          upperBound: upperNum,
          chains: chainList,
          targetContract,
        },
        handlers: {
          fetch: fetchPrice,
          verify: verifyPrice,
          compare: comparePrice,
          returnNode: buildReturnPayload,
          deliver: deliverResult,
        },
      });

      setResult({
        price: execution.quote.price,
        outcome: execution.compare.status,
        proof: {
          digest: execution.signed.digest,
          signature: execution.signed.signature,
          signer: execution.signed.signer,
        },
        userOp: execution.delivery?.userOp,
        relays: execution.delivery?.relays?.map((r: any) => ({
          chain: r.chain,
          hash: r.hash,
        })),
      });
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Price Watchdog Demo</h1>
        <p>Fetch → Verify → Compare → Deliver (multi-chain)</p>
      </header>

      <section className="card">
        <div className="field-grid">
          <label>
            Token (Coingecko id)
            <input value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label>
            Lower bound (USD)
            <input
              type="number"
              value={lower}
              onChange={(e) => setLower(e.target.value)}
              placeholder="optional"
            />
          </label>
          <label>
            Upper bound (USD)
            <input
              type="number"
              value={upper}
              onChange={(e) => setUpper(e.target.value)}
              placeholder="optional"
            />
          </label>
          <label>
            Chains (comma-separated ids)
            <input
              value={chains}
              onChange={(e) => setChains(e.target.value)}
              placeholder="1,137"
            />
          </label>
          <label>
            Target contract
            <input
              value={targetContract}
              onChange={(e) => setTargetContract(e.target.value)}
              placeholder="0x"
            />
          </label>
        </div>

        <button className="primary" onClick={run} disabled={loading}>
          {loading ? "Running..." : "Run Watchdog"}
        </button>
        {error && <p className="error">Error: {error}</p>}
      </section>

      {result && (
        <section className="card result">
          <h2>Result</h2>
          <div className="pill">Outcome: {result.outcome}</div>
          <p className="muted">Price: ${result.price.toFixed(2)} USD</p>

          {result.proof && (
            <div className="panel">
              <h3>Proof</h3>
              <code>digest: {result.proof.digest}</code>
              <code>signature: {result.proof.signature.slice(0, 42)}...</code>
              <code>signer: {result.proof.signer}</code>
            </div>
          )}

          {result.userOp && (
            <div className="panel">
              <h3>UserOp</h3>
              <code>{JSON.stringify(result.userOp, null, 2)}</code>
            </div>
          )}

          {result.relays && result.relays.length > 0 && (
            <div className="panel">
              <h3>Relays</h3>
              <ul>
                {result.relays.map((r) => (
                  <li key={r.hash}>
                    {r.chain}: {r.hash}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
