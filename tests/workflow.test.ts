import { expect } from "chai";
import fs from "fs";
import { parseAndValidate, executeWorkflow } from "@krnl-dev/sdk-core";
import { fetchPrice } from "../kernels/fetch.ts";
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

  it("executes workflow with local handlers", async () => {
    const yamlContent = fs.readFileSync("workflow.yaml", "utf8");
    const res = parseAndValidate({ yamlContent });

    const execution = await executeWorkflow({
      workflow: res.workflow,
      input: { token: "ethereum", chain: "sepolia", lowerBound: 1, upperBound: 1 },
      handlers: {
        fetch: async () => ({
          token: "ethereum",
          price: 1,
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

