interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    isMetaMask?: boolean;
  } & {
    on: <T = unknown>(event: "accountsChanged", callback: (accounts: T) => void) => void;
    on: <T = unknown>(event: "chainChanged", callback: (chainId: T) => void) => void;
  };
}

