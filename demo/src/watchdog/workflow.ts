import yaml from "js-yaml";

export interface WorkflowSpec {
  name?: string;
  description?: string;
  inputs?: Record<string, unknown>;
  nodes: Record<
    string,
    {
      module: string;
      function: string;
      inputs?: string[];
      outputs?: string[];
    }
  >;
  edges?: Array<{ from: string; to: string }>;
}

export interface ValidationResult {
  valid: boolean;
  workflow: WorkflowSpec;
  errors?: string[];
}

function asRecord(v: unknown): Record<string, unknown> {
  if (typeof v !== "object" || v === null) return {};
  return v as Record<string, unknown>;
}

export function parseAndValidateWorkflow(args: { yamlContent?: string }): ValidationResult {
  const { yamlContent } = args;
  if (!yamlContent) {
    return { valid: false, workflow: { nodes: {} }, errors: ["yamlContent is required"] };
  }

  const parsed = yaml.load(yamlContent);
  const wf = asRecord(parsed) as unknown as WorkflowSpec;
  const errors: string[] = [];

  if (!wf.nodes || typeof wf.nodes !== "object") errors.push("workflow missing nodes");

  const requiredNodes = ["fetch", "verify", "compare", "return", "deliver"];
  for (const n of requiredNodes) if (!wf.nodes?.[n]) errors.push(`missing required node: ${n}`);

  const edges = wf.edges ?? [];
  const expectedEdges = [
    { from: "fetch", to: "verify" },
    { from: "verify", to: "compare" },
    { from: "compare", to: "return" },
    { from: "return", to: "deliver" },
  ];
  for (const ex of expectedEdges) {
    const found = edges.some((e) => e.from === ex.from && e.to === ex.to);
    if (!found) errors.push(`missing required edge: ${ex.from} -> ${ex.to}`);
  }

  const expectedIO: Record<string, { inputs?: string[]; outputs?: string[] }> = {
    fetch: { outputs: ["quote"] },
    verify: { inputs: ["quote"], outputs: ["signedQuote"] },
    compare: { inputs: ["request", "signedQuote"], outputs: ["compare"] },
    return: { inputs: ["request", "signedQuote", "compare"], outputs: ["result"] },
    deliver: { inputs: ["result", "chains", "targetContract", "triggers"], outputs: ["delivery"] },
  };
  for (const [name, io] of Object.entries(expectedIO)) {
    const node = wf.nodes?.[name];
    if (!node) continue;
    if (io.inputs && JSON.stringify(node.inputs ?? []) !== JSON.stringify(io.inputs)) {
      errors.push(`node ${name} inputs must be ${JSON.stringify(io.inputs)}`);
    }
    if (io.outputs && JSON.stringify(node.outputs ?? []) !== JSON.stringify(io.outputs)) {
      errors.push(`node ${name} outputs must be ${JSON.stringify(io.outputs)}`);
    }
  }

  return { valid: errors.length === 0, workflow: wf, ...(errors.length ? { errors } : {}) };
}

export async function executeWorkflowDAG(args: {
  workflow: WorkflowSpec;
  input: any;
  handlers: Record<string, (...args: any[]) => any>;
}): Promise<any> {
  const { workflow, input, handlers } = args;
  const ctx: Record<string, any> = {
    request: input,
    chains: input?.chains ?? [],
    targetContract: input?.targetContract ?? "",
    triggers: input?.triggers,
  };

  const order = ["fetch", "verify", "compare", "return", "deliver"];
  for (const nodeName of order) {
    const node = workflow.nodes?.[nodeName];
    if (!node) throw new Error(`workflow missing node: ${nodeName}`);
    const handler = handlers[nodeName] ?? handlers[nodeName === "return" ? "returnNode" : nodeName];
    if (!handler) throw new Error(`missing handler for node: ${nodeName}`);

    const inNames = node.inputs ?? [];
    const inputs = inNames.map((n) => ctx[n]);

    let out: any;
    if (nodeName === "deliver") {
      out = await handler({
        result: ctx.result,
        chains: ctx.chains,
        targetContract: ctx.targetContract,
        triggers: ctx.triggers,
      });
    } else if (inputs.length <= 1) {
      out = await handler(inputs[0] ?? ctx.request);
    } else {
      out = await handler(...inputs);
    }

    const outKey = node.outputs?.[0] ?? nodeName;
    ctx[outKey] = out;
    if (nodeName === "verify") ctx.signedQuote = out;
    if (nodeName === "fetch") ctx.quote = out;
    if (nodeName === "compare") ctx.compare = out;
    if (nodeName === "return") ctx.result = out;
    if (nodeName === "deliver") ctx.delivery = out;
  }

  return {
    quote: ctx.quote,
    signed: ctx.signedQuote,
    compare: ctx.compare,
    result: ctx.result,
    delivery: ctx.delivery,
  };
}


