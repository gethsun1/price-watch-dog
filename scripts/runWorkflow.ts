import "dotenv/config";
import fs from "fs";
import { executeWorkflow, parseAndValidate } from "@krnl-dev/sdk-core";
import { fetchPrice } from "../kernels/fetch";
import { verifyPrice } from "../kernels/verify";
import { comparePrice } from "../kernels/compare";
import { buildReturnPayload } from "../kernels/return";
import { deliverResult } from "../kernels/deliver";
import type { PriceCheckRequest } from "../kernels/types";

async function main() {
  const args = process.argv.slice(2);
  const token = args[0] ?? process.env.PWD_TOKEN ?? "ethereum";
  const lower = args[1] ? Number(args[1]) : undefined;
  const upper = args[2] ? Number(args[2]) : undefined;
  const chainsEnv = process.env.PWD_CHAINS;
  const targetContract = process.env.PWD_TARGET_CONTRACT;

  const request: PriceCheckRequest = {
    token,
    chain: process.env.PWD_CHAIN ?? "sepolia",
  };
  if (lower !== undefined) request.lowerBound = lower;
  if (upper !== undefined) request.upperBound = upper;

  const chains = chainsEnv ? chainsEnv.split(",").map((c) => c.trim()) : [];

  const yamlContent = fs.readFileSync("workflow.yaml", "utf8");
  const validated = parseAndValidate({ yamlContent });

  const execution = await executeWorkflow({
    workflow: validated.workflow,
    input: { ...request, chains, targetContract },
    handlers: {
      fetch: fetchPrice,
      verify: verifyPrice,
      compare: async (req, signed) => comparePrice(req, signed),
      returnNode: async (req, signed, compare) =>
        buildReturnPayload(req, signed, compare),
      deliver: deliverResult,
    },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(execution, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("workflow run failed:", err);
  process.exitCode = 1;
});

