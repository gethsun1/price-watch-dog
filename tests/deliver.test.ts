import { expect } from "chai";
import { deliverResult } from "../kernels/deliver.ts";
import type {
  DeliverRequest,
  RelayReceipt,
  TriggerResult,
  WatchdogResult,
} from "../kernels/types.ts";

const sampleResult: WatchdogResult = {
  request: {
    token: "eth",
    chain: "sepolia",
    lowerBound: 1500,
    upperBound: 2500,
    apiUrl: undefined,
  },
  quote: {
    token: "eth",
    price: 2000,
    currency: "USD",
    source: "test",
    fetchedAt: 1,
    signature: "0xsig",
    signer: "0xsigner",
    digest: "0xdigest",
  },
  compare: {
    status: "WITHIN_RANGE",
    difference: 0,
    triggeredAt: 2,
  },
};

describe("deliverResult", () => {
  it("builds userOp and relays across chains", async () => {
    const relays: RelayReceipt[] = [
      { chain: "1", hash: "0xabc", dispatchedAt: 10 },
      { chain: "137", hash: "0xdef", dispatchedAt: 10 },
    ];

    const req: DeliverRequest = {
      result: sampleResult,
      chains: ["1", "137"],
      targetContract: "0xcontract",
    };

    const output = await deliverResult(req, {
      createUserOp: (params) => ({ ...params, nonce: "1" }),
      relayMultiChain: async () => relays,
      now: () => 1234,
    });

    expect(output.relays).to.deep.equal(relays);
    expect((output.userOp as any).nonce).to.equal("1");
    expect(output.payload.compare.status).to.equal("WITHIN_RANGE");
    expect(output.deliveredAt).to.equal(1234);
  });

  it("executes optional triggers when enabled", async () => {
    const triggers: TriggerResult[] = [
      { name: "notify", payload: { ok: true }, triggeredAt: 5 },
    ];

    const req: DeliverRequest = {
      result: { ...sampleResult, compare: { ...sampleResult.compare, status: "ABOVE_RANGE" } },
      chains: ["1"],
      targetContract: "0xcontract",
      triggers: { enabled: true, types: ["notify"] },
    };

    const output = await deliverResult(req, {
      createUserOp: (params) => params,
      relayMultiChain: async () => [{ chain: "1", hash: "0xabc", dispatchedAt: 10 }],
      triggerAction: async () => triggers[0],
      now: () => 999,
    });

    expect(output.triggers).to.deep.equal(triggers);
    expect(output.relays[0].chain).to.equal("1");
    expect(output.payload.compare.status).to.equal("ABOVE_RANGE");
  });
});

