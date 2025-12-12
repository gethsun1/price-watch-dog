import { expect } from "chai";
import fs from "fs";
import { parseAndValidate, executeWorkflow } from "../kernels/krnl.ts";
import { verifyPrice } from "../kernels/verify.ts";
import { comparePrice } from "../kernels/compare.ts";
import { buildReturnPayload } from "../kernels/return.ts";
import { deliverResult } from "../kernels/deliver.ts";

describe("workflow validation and execution (stubbed)", () => {
  it("parses workflow.yaml", () => {
    const yamlContent = fs.readFileSync("workflow.yaml", "utf8");
    const res = parseAndValidate({ yamlContent });
    expect(res.valid).to.be.true;
  });

  it("fails validation on a broken DAG (missing required edge)", () => {
    const broken = `
name: broken
inputs:
  token: string
  chain: string
nodes:
  fetch: { module: ./kernels/fetch.ts, function: fetchPrice, outputs: [quote] }
  verify: { module: ./kernels/verify.ts, function: verifyPrice, inputs: [quote], outputs: [signedQuote] }
  compare: { module: ./kernels/compare.ts, function: comparePrice, inputs: [request, signedQuote], outputs: [compare] }
  return: { module: ./kernels/return.ts, function: buildReturnPayload, inputs: [request, signedQuote, compare], outputs: [result] }
  deliver: { module: ./kernels/deliver.ts, function: deliverResult, inputs: [result, chains, targetContract, triggers], outputs: [delivery] }
edges:
  - from: fetch
    to: verify
  - from: verify
    to: compare
  - from: compare
    to: return
`;
    const res = parseAndValidate({ yamlContent: broken });
    expect(res.valid).to.equal(false);
    expect((res as any).errors?.join(" ")).to.contain("missing required edge: return -> deliver");
  });

  it("executes workflow with local handlers", async () => {
    const yamlContent = fs.readFileSync("workflow.yaml", "utf8");
    const res = parseAndValidate({ yamlContent });

    const execution = await executeWorkflow({
      workflow: res.workflow,
      input: { token: "ethereum", chain: "sepolia", lowerBound: 1, upperBound: 1 },
      handlers: {
        fetch: async () => ({
          token: "ethereum",
          chain: "sepolia",
          price: 1,
          priceE8: "100000000",
          priceDecimals: 8,
          currency: "USD",
          source: "mock",
          fetchedAt: 1,
        }),
        verify: verifyPrice,
        compare: comparePrice,
        returnNode: buildReturnPayload,
        deliver: deliverResult,
      },
    });

    expect(execution.compare.status).to.be.a("string");
    expect(execution.result.quote.signature).to.be.a("string");
  });
});

