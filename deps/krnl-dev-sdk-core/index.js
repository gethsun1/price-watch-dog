const axios = require("axios");
const { randomBytes } = require("crypto");
const { keccak256, toUtf8Bytes, Wallet } = require("ethers");
const yaml = require("js-yaml");
const fs = require("fs");

const http = {
  // Minimal passthrough HTTP GET; in real SDK this would sign requests.
  get: async (url, opts = {}) => {
    return axios.get(url, opts);
  },
  post: async (url, body, opts = {}) => {
    return axios.post(url, body, opts);
  },
};

const proof = {
  // Generates an ephemeral signature over JSON payload; placeholder for real proofing.
  generateEphemeral: async (payload) => {
    const signer = Wallet.createRandom();
    const digest = keccak256(toUtf8Bytes(JSON.stringify(payload)));
    const signature = await signer.signMessage(toUtf8Bytes(digest));
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

const userOp = {
  create: (params) => ({
    ...params,
    nonce: randomBytes(4).toString("hex"),
  }),
};

const relay = {
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

const trigger = {
  action: async (name, payload) => ({
    name,
    payload,
    triggeredAt: Date.now(),
  }),
};

const parseAndValidate = ({ yamlPath, yamlContent }) => {
  const content = yamlContent ?? fs.readFileSync(yamlPath, "utf8");
  const parsed = yaml.load(content);
  if (!parsed?.nodes) {
    throw new Error("workflow missing nodes");
  }
  return { valid: true, workflow: parsed };
};

// Minimal local executor that runs the known nodes in order if provided.
const executeWorkflow = async ({ workflow, handlers, input }) => {
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

module.exports = {
  http,
  proof,
  userOp,
  relay,
  trigger,
  parseAndValidate,
  executeWorkflow,
};

