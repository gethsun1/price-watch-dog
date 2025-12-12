import "dotenv/config";
import { executeWorkflow, parseAndValidate } from "@krnl-dev/sdk-core";
import { fetchPrice } from "./fetch";
import { comparePrice } from "./compare";
import { verifyPrice } from "./verify";
import { buildReturnPayload } from "./return";
import { deliverResult } from "./deliver";
import type { PriceCheckRequest } from "./types";
import fs from "fs";

async function runSample(): Promise<void> {
  const request: PriceCheckRequest = {
    token: "ethereum",
    chain: "sepolia",
    lowerBound: 1500,
    upperBound: 3500,
  };

  const targetContract = process.env.PWD_TARGET_CONTRACT;
  const chainsEnv = process.env.PWD_CHAINS;
  const chains = chainsEnv ? chainsEnv.split(",").map((c) => c.trim()) : [];

  const workflow = fs.readFileSync("workflow.yaml", "utf8");
  const validated = parseAndValidate({ yamlContent: workflow });

  const execution = await executeWorkflow({
    workflow: validated.workflow,
    input: { ...request, targetContract, chains },
    handlers: {
      fetch: fetchPrice,
      verify: verifyPrice,
      compare: comparePrice,
      returnNode: (req, signed, compare) => buildReturnPayload(req, signed, compare),
      deliver: deliverResult,
    },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(execution, null, 2));
}

if (require.main === module) {
  runSample().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Local run failed:", err);
    process.exitCode = 1;
  });
}

