import { ethers, Wallet } from "ethers";

export const http = {
  get: async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    const data = await res.json();
    return { data };
  },
};

export const proof = {
  generateEphemeral: async (payload: unknown) => {
    const signer = Wallet.createRandom();
    const bytes =
      payload instanceof Uint8Array
        ? payload
        : typeof payload === "string"
          ? ethers.toUtf8Bytes(payload)
          : ethers.toUtf8Bytes(JSON.stringify(payload));
    const digest = ethers.keccak256(bytes);
    const signature = await signer.signMessage(ethers.getBytes(digest));
    return {
      digest,
      signature,
      signer: await signer.getAddress(),
      timestamp: Date.now(),
    };
  },
};

export const userOp = {
  create: (params: Record<string, unknown>) => ({
    ...params,
    nonce: Math.floor(Math.random() * 1e9).toString(16),
  }),
};

export const relay = {
  multiChain: async (chains: string[], op: Record<string, unknown>) => {
    const now = Date.now();
    return chains.map((chain) => ({
      chain,
      op,
      hash: ethers.keccak256(ethers.toUtf8Bytes(`${chain}-${now}-${JSON.stringify(op)}`)),
      dispatchedAt: now,
    }));
  },
};

export const trigger = {
  action: async (name: string, payload: Record<string, unknown>) => ({
    name,
    payload,
    triggeredAt: Date.now(),
  }),
};


