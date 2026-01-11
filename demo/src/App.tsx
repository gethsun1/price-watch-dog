import { useMemo, useState, useEffect } from "react";
import { BrowserProvider, Contract, Interface } from "ethers";
import type { Signer } from "ethers";
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
  proof?: { 
    digest: string; 
    signature: string; 
    signer: string;
    fetchedAt?: number;
    provedAt?: number;
  };
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
  
  // Wallet connection state
  const [signer, setSigner] = useState<Signer | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  
  // Transaction state
  const [submittingTx, setSubmittingTx] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"pending" | "success" | "error" | null>(null);
  const [gaslessMode, setGaslessMode] = useState(false);
  const [sponsoredGas, setSponsoredGas] = useState<string | null>(null);

  const lowerNum = useMemo(
    () => (lower ? Number(lower) : undefined),
    [lower],
  );
  const upperNum = useMemo(
    () => (upper ? Number(upper) : undefined),
    [upper],
  );

  // Check if wallet is already connected on mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      if (typeof window.ethereum !== "undefined") {
        try {
          const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
          if (accounts && accounts.length > 0) {
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            setSigner(signer);
            setWalletAddress(address);
          }
        } catch (err) {
          console.error("Error checking wallet connection:", err);
        }
      }
    };
    checkWalletConnection();

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: unknown) => {
        const accountList = accounts as string[];
        if (!accountList || accountList.length === 0) {
          setSigner(null);
          setWalletAddress(null);
        } else {
          const provider = new BrowserProvider(window.ethereum!);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          setSigner(signer);
          setWalletAddress(address);
        }
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });

      // Cleanup listeners on unmount
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", () => {});
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      setError("MetaMask or compatible wallet not found. Please install MetaMask.");
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setSigner(signer);
      setWalletAddress(address);
    } catch (err: any) {
      setError(`Failed to connect wallet: ${err?.message ?? String(err)}`);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setSigner(null);
    setWalletAddress(null);
  };

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

      const deliveryResult = {
        price: execution.quote.price,
        outcome: execution.compare.status,
        proof: {
          digest: execution.signed.digest,
          signature: execution.signed.signature,
          signer: execution.signed.signer,
          fetchedAt: execution.signed.fetchedAt,
          provedAt: execution.signed.provedAt,
        },
        userOp: execution.delivery?.userOp,
        relays: execution.delivery?.relays?.map((r: any) => ({
          chain: r.chain,
          hash: r.hash,
        })),
      };
      
      setResult(deliveryResult);

      // If wallet is connected and we have a valid target contract, submit on-chain
      if (signer && targetContract && targetContract !== "0x" && targetContract.length === 42) {
        await submitOnChain(deliveryResult, execution);
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const submitOnChain = async (_deliveryResult: RunResult, execution: any) => {
    if (!signer || !targetContract || !execution.delivery?.userOp) {
      return;
    }

    setSubmittingTx(true);
    setTxStatus("pending");
    setTxHash(null);
    setError(null);
    setSponsoredGas(null);

    try {
      const userOp = execution.delivery.userOp as any;
      if (!userOp.to || !userOp.callData) {
        throw new Error("Invalid UserOp: missing to or callData");
      }

      // Simulate gasless execution if enabled
      if (gaslessMode) {
        // Simulate paymaster sponsorship
        const estimatedGas = "150000"; // Simulated gas estimate
        const gasPrice = "20000000000"; // 20 gwei
        const simulatedSponsoredGas = (BigInt(estimatedGas) * BigInt(gasPrice)).toString();
        setSponsoredGas(simulatedSponsoredGas);
        
        // In a real implementation, this would call a paymaster API
        // For now, we simulate the flow but still submit a regular transaction
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call delay
      }

      // Create contract interface for PriceWatcher
      const PriceWatcherABI = [
        "function handleResult(bytes calldata result, bytes calldata proof) external",
      ];
      
      const contract = new Contract(targetContract, PriceWatcherABI, signer);
      
      // Extract result and proof from UserOp callData
      const iface = new Interface(["function handleResult(bytes result, bytes proof)"]);
      const decoded = iface.decodeFunctionData("handleResult", userOp.callData);
      const resultBytes = decoded[0] as string;
      const proofBytes = decoded[1] as string;

      // Submit transaction (if gasless mode, user would still pay, but in production this would be sponsored)
      const tx = await contract.handleResult(resultBytes, proofBytes);
      setTxHash(tx.hash);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        setTxStatus("success");
      } else {
        setTxStatus("error");
        setError("Transaction failed");
      }
    } catch (err: any) {
      setTxStatus("error");
      setError(`Transaction failed: ${err?.message ?? String(err)}`);
      console.error("On-chain submission error:", err);
    } finally {
      setSubmittingTx(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Price Watchdog Demo</h1>
        <p>Fetch → Verify → Compare → Deliver (multi-chain)</p>
      </header>

      <div className="info-banner" style={{ 
        padding: '12px 20px', 
        margin: '0 0 20px 0', 
        backgroundColor: 'rgba(59, 130, 246, 0.1)', 
        borderLeft: '4px solid rgba(59, 130, 246, 0.5)',
        borderRadius: '4px',
        fontSize: '0.9em',
        color: 'inherit'
      }}>
        ⚙️ This demo includes a <strong>reference consumer</strong> for illustration.
        The kernel outputs an attested price payload that any on-chain consumer can interpret independently.
      </div>

      <section className="card" style={{ marginBottom: '20px' }}>
        <h2>Wallet Connection</h2>
        {walletAddress ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 12px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '4px', fontSize: '0.9em' }}>
              ✓ Connected: <code style={{ fontSize: '0.85em' }}>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</code>
            </div>
            <button onClick={disconnectWallet} style={{ padding: '8px 16px', fontSize: '0.9em' }}>
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            onClick={connectWallet} 
            disabled={connecting}
            className="primary"
            style={{ padding: '10px 20px' }}
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
        {error && walletAddress === null && <p className="error" style={{ marginTop: '10px' }}>Error: {error}</p>}
      </section>

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
          <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              checked={gaslessMode}
              onChange={(e) => setGaslessMode(e.target.checked)}
              disabled={!walletAddress}
            />
            <span>Gasless Mode (Simulated)</span>
          </label>
        </div>

        <button className="primary" onClick={run} disabled={loading || submittingTx}>
          {loading ? "Running..." : submittingTx ? "Submitting..." : "Run Watchdog"}
        </button>
        {error && <p className="error">Error: {error}</p>}
        {!walletAddress && targetContract && targetContract !== "0x" && targetContract.length === 42 && (
          <p className="info" style={{ marginTop: "10px", fontSize: "0.9em", color: "#666" }}>
            💡 Connect wallet to submit on-chain. Workflow will still execute locally.
          </p>
        )}
      </section>

      {result && (
        <section className="card result">
          <h2>Result</h2>
          <div className="pill">Outcome: {result.outcome}</div>
          <p className="muted">Price: ${result.price.toFixed(2)} USD</p>

          {result.proof && (
            <div className="panel">
              <h3>Attested Kernel Output</h3>
              <code>digest: {result.proof.digest}</code>
              <code>signature: {result.proof.signature.slice(0, 42)}...</code>
              <code>signer: {result.proof.signer}</code>
              {result.proof.fetchedAt && (
                <code>fetchedAt: {new Date(result.proof.fetchedAt).toISOString()}</code>
              )}
              {result.proof.provedAt && (
                <code>provedAt: {new Date(result.proof.provedAt).toISOString()}</code>
              )}
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

          {txHash && (
            <div className="panel" style={{ 
              backgroundColor: txStatus === "success" ? "rgba(34, 197, 94, 0.1)" : 
                              txStatus === "error" ? "rgba(239, 68, 68, 0.1)" : 
                              "rgba(59, 130, 246, 0.1)",
              borderLeft: `4px solid ${txStatus === "success" ? "rgba(34, 197, 94, 0.5)" : 
                                          txStatus === "error" ? "rgba(239, 68, 68, 0.5)" : 
                                          "rgba(59, 130, 246, 0.5)"}`,
            }}>
              <h3>On-Chain Transaction</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <strong>Status:</strong>{" "}
                  <span style={{ 
                    color: txStatus === "success" ? "#22c55e" : 
                           txStatus === "error" ? "#ef4444" : "#3b82f6"
                  }}>
                    {txStatus === "success" ? "✓ Success" : 
                     txStatus === "error" ? "✗ Failed" : 
                     "⏳ Pending"}
                  </span>
                </div>
                {gaslessMode && sponsoredGas && (
                  <div style={{ 
                    padding: "8px 12px", 
                    backgroundColor: "rgba(147, 51, 234, 0.1)", 
                    borderRadius: "4px",
                    fontSize: "0.9em"
                  }}>
                    <strong>💰 Gasless Mode (Simulated):</strong>{" "}
                    Sponsored gas: {(BigInt(sponsoredGas) / BigInt(1e18)).toString()} ETH
                    <div style={{ fontSize: "0.85em", marginTop: "4px", color: "#666" }}>
                      Note: This is a simulation. In production, a paymaster would sponsor this transaction.
                    </div>
                  </div>
                )}
                <div>
                  <strong>Transaction Hash:</strong>{" "}
                  <code style={{ fontSize: "0.85em", wordBreak: "break-all" }}>
                    {txHash}
                  </code>
                </div>
                {txStatus === "success" && (
                  <div style={{ fontSize: "0.9em", marginTop: "8px" }}>
                    ✅ Result successfully submitted to PriceWatcher contract
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default App;
