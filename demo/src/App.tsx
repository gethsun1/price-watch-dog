import { useMemo, useState } from "react";
import "./App.css";
import * as sdk from "@krnl-dev/sdk-core";

type Outcome = "ABOVE_RANGE" | "BELOW_RANGE" | "WITHIN_RANGE";

interface RunResult {
  price: number;
  outcome: Outcome;
  proof?: { digest: string; signature: string; signer: string };
  userOp?: Record<string, unknown>;
  relays?: Array<{ chain: string; hash: string }>;
}

const coingeckoUrl = (token: string) =>
  `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    token,
  )}&vs_currencies=usd`;

const parsePrice = (token: string, data: unknown): number => {
  const anyData = data as any;
  const price =
    anyData?.[token]?.usd ?? anyData?.usd ?? anyData?.price ?? anyData?.priceUsd;
  if (!Number.isFinite(Number(price))) throw new Error("price missing from API");
  return Number(price);
};

function App() {
  const [token, setToken] = useState("ethereum");
  const [lower, setLower] = useState<string>("1500");
  const [upper, setUpper] = useState<string>("3500");
  const [chains, setChains] = useState("1,137");
  const [targetContract, setTargetContract] = useState("0x");
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

  const computeOutcome = (price: number): Outcome => {
    if (upperNum !== undefined && price > upperNum) return "ABOVE_RANGE";
    if (lowerNum !== undefined && price < lowerNum) return "BELOW_RANGE";
    return "WITHIN_RANGE";
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const cgResp = await sdk.http.get(coingeckoUrl(token));
      const price = parsePrice(token, cgResp.data);
      const outcome = computeOutcome(price);

      const payload = {
        token,
        price,
        lowerBound: lowerNum,
        upperBound: upperNum,
        targetContract,
        chains: chains.split(",").map((c) => c.trim()).filter(Boolean),
        outcome,
      };

      const proofRes = sdk.proof.generateEphemeral
        ? await sdk.proof.generateEphemeral(payload)
        : undefined;

      const op = sdk.userOp.create
        ? sdk.userOp.create({
          to: targetContract,
          data: { outcome, price, token, lower: lowerNum, upper: upperNum },
          metadata: { chains: payload.chains },
        })
        : undefined;

      const relayRes = sdk.relay.multiChain
        ? await sdk.relay.multiChain(payload.chains, op ?? {})
        : [];

      setResult({
        price,
        outcome,
        proof: proofRes
          ? {
              digest: proofRes.digest,
              signature: proofRes.signature,
              signer: proofRes.signer,
            }
          : undefined,
        userOp: op,
        relays: relayRes?.map((r) => ({ chain: r.chain, hash: r.hash })),
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
