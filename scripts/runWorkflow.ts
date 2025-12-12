import "dotenv/config";
import fs from "fs";
import { executeWorkflow, parseAndValidate } from "../kernels/krnl.ts";
import { fetchPrice } from "../kernels/fetch.ts";
import { verifyPrice } from "../kernels/verify.ts";
import { comparePrice } from "../kernels/compare.ts";
import { buildReturnPayload } from "../kernels/return.ts";
import { deliverResult } from "../kernels/deliver.ts";
import type {
  CompareResult,
  PriceCheckRequest,
  SignedPriceQuote,
} from "../kernels/types.ts";

async function main() {
  const args = process.argv.slice(2);
  const token = args[0] ?? process.env.PWD_TOKEN ?? "ethereum";
  const lower = args[1] ? Number(args[1]) : undefined;
  const upper = args[2] ? Number(args[2]) : undefined;
  const chainsEnv = process.env.PWD_CHAINS;
  const targetContract = process.env.PWD_TARGET_CONTRACT;
  if (!targetContract) {
    throw new Error("PWD_TARGET_CONTRACT is required for delivery");
  }
  const apiOverride = process.env.API_URL_OVERRIDE;

  const request: PriceCheckRequest = {
    token,
    chain: process.env.PWD_CHAIN ?? "sepolia",
  };
  if (lower !== undefined) request.lowerBound = lower;
  if (upper !== undefined) request.upperBound = upper;
  if (apiOverride) request.apiUrl = apiOverride;

  const chains = parseChains(chainsEnv);

  const yamlContent = fs.readFileSync("workflow.yaml", "utf8");
  const validated = parseAndValidate({ yamlContent });

  const execution = await executeWorkflow({
    workflow: validated.workflow,
    input: { ...request, chains, targetContract },
    handlers: {
      fetch: fetchPrice,
      verify: verifyPrice,
      compare: async (req: PriceCheckRequest, signed: SignedPriceQuote) =>
        comparePrice(req, signed),
      returnNode: async (
        req: PriceCheckRequest,
        signed: SignedPriceQuote,
        compare: CompareResult,
      ) => buildReturnPayload(req, signed, compare),
      deliver: deliverResult,
    },
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(execution, null, 2));
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

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("workflow run failed:", err);
  process.exitCode = 1;
});

