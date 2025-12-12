import axios from "axios";
import { keccak256, toUtf8Bytes, Wallet, getBytes } from "ethers";

// Browser-compatible random bytes generator
const randomBytes = (size) => {
  const bytes = new Uint8Array(size);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
    return bytes;
  }
  // For Node.js, use a simple fallback
  return new Uint8Array(size).map(() => Math.floor(Math.random() * 256));
};

export const http = {
  // Minimal passthrough HTTP GET; in real SDK this would sign requests.
  get: async (url, opts = {}) => {
    return axios.get(url, opts);
  },
  post: async (url, body, opts = {}) => {
    return axios.post(url, body, opts);
  },
};

export const proof = {
  // Generates an ephemeral signature over JSON payload; placeholder for real proofing.
  generateEphemeral: async (payload) => {
    const signer = Wallet.createRandom();
    const digest = keccak256(toUtf8Bytes(JSON.stringify(payload)));
    const signature = await signer.signMessage(getBytes(digest));
    return {
      digest,
      signature,
      signer: await signer.getAddress(),
      timestamp: Date.now(),
    };
  },
  link: (parentProof, childProof) => ({
    parent: parentProof,
    child: childProof,
    linkedAt: Date.now(),
  }),
};

export const userOp = {
  create: (params) => ({
    ...params,
    nonce: Array.from(randomBytes(4)).map(b => b.toString(16).padStart(2, '0')).join(''),
  }),
};

export const relay = {
  multiChain: async (chains, op) => {
    const now = Date.now();
    return chains.map((chain) => ({
      chain,
      op,
      hash: keccak256(toUtf8Bytes(`${chain}-${now}-${JSON.stringify(op)}`)),
      dispatchedAt: now,
    }));
  },
};

export const trigger = {
  action: async (name, payload) => ({
    name,
    payload,
    triggeredAt: Date.now(),
  }),
};

export const parseAndValidate = ({ yamlPath, yamlContent }) => {
  // Browser environment - yamlContent must be provided
  if (!yamlContent) {
    throw new Error("yamlContent is required in browser environment");
  }
  // For browser, we skip yaml parsing for now
  return { valid: true, workflow: {} };
};

// Minimal local executor that runs the known nodes in order if provided.
export const executeWorkflow = async ({ workflow, handlers, input }) => {
  const fetchFn = handlers?.fetch;
  const verifyFn = handlers?.verify;
  const compareFn = handlers?.compare;
  const returnFn = handlers?.returnNode;
  const deliverFn = handlers?.deliver;

  const quote = await fetchFn(input);
  const signed = await verifyFn(quote);
  const compare = await compareFn(input, signed);
  const result = await returnFn(input, signed, compare);
  const delivery = deliverFn
    ? await deliverFn({
        result,
        chains: input.chains ?? [],
        targetContract: input.targetContract ?? "",
        triggers: input.triggers,
      })
    : undefined;
  return { quote, signed, compare, result, delivery };
};

