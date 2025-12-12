import "dotenv/config";
import { executeWorkflow, parseAndValidate } from "./krnl.ts";
import { fetchPrice } from "./fetch.ts";
import { comparePrice } from "./compare.ts";
import { verifyPrice } from "./verify.ts";
import { buildReturnPayload } from "./return.ts";
import { deliverResult } from "./deliver.ts";
import type { PriceCheckRequest } from "./types.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

async function runSample(): Promise<void> {
  const request: PriceCheckRequest = {
    token: "ethereum",
    chain: "sepolia",
    lowerBound: 1500,
    upperBound: 3500,
  };

  const targetContract = process.env.PWD_TARGET_CONTRACT;
  const chainsEnv = process.env.PWD_CHAINS;
  const chains = parseChains(chainsEnv);

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

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runSample().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Local run failed:", err);
    process.exitCode = 1;
  });
}

function parseChains(chainsEnv: string | undefined): string[] {
  if (!chainsEnv) return [];
  const trimmed = chainsEnv.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("PWD_CHAINS must be an array");
    return parsed.map((c) => String(c));
  }
  return trimmed
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

