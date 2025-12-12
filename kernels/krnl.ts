// Centralized SDK import. In this repo, `@krnl-dev/sdk-core` is provided via `file:deps/...`.
import * as sdk from "@krnl-dev/sdk-core";
import { executeWorkflowDAG, parseAndValidateWorkflow } from "./workflow.ts";

export const {
  http,
  proof,
  userOp,
  relay,
  trigger,
} = sdk as any;

// Hard-validate and execute the workflow YAML with true DAG semantics for this repo's pipeline,
// regardless of the SDK stub's minimal implementation.
export const parseAndValidate = parseAndValidateWorkflow;
export const executeWorkflow = executeWorkflowDAG;
