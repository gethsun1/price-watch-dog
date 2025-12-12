import { parseAndValidate } from "@krnl-dev/sdk-core";
import fs from "fs";

async function main() {
  const content = fs.readFileSync("workflow.yaml", "utf8");
  const res = parseAndValidate({ yamlContent: content });
  if (!res.valid) {
    throw new Error("workflow validation failed");
  }
  // eslint-disable-next-line no-console
  console.log("workflow validated:", Object.keys(res.workflow || {}).join(","));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("validation error:", err);
  process.exitCode = 1;
});

