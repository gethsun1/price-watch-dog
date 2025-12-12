export interface HttpModule {
  get: (url: string, opts?: Record<string, unknown>) => Promise<{ data: unknown }>;
  post: (url: string, body: unknown, opts?: Record<string, unknown>) => Promise<{ data: unknown }>;
}

export interface ProofResult {
  digest: string;
  signature: string;
  signer: string;
  timestamp: number;
}

export interface ProofModule {
  generateEphemeral: (payload: unknown) => Promise<ProofResult>;
  link: (parent: unknown, child: unknown) => { parent: unknown; child: unknown; linkedAt: number };
}

export interface UserOpModule {
  create: (params: Record<string, unknown>) => Record<string, unknown>;
}

export interface RelayResult {
  chain: string;
  op: Record<string, unknown>;
  hash: string;
  dispatchedAt: number;
}

export interface RelayModule {
  multiChain: (chains: string[], op: Record<string, unknown>) => Promise<RelayResult[]>;
}

export interface TriggerModule {
  action: (name: string, payload: Record<string, unknown>) => Promise<{ name: string; payload: unknown; triggeredAt: number }>;
}

export interface ParseAndValidateArgs {
  yamlPath?: string;
  yamlContent?: string;
}

export interface ParseAndValidateResult {
  valid: boolean;
  workflow: unknown;
}

export interface ExecuteWorkflowArgs {
  workflow: unknown;
  handlers: {
    fetch?: (input: any) => Promise<any>;
    verify?: (quote: any) => Promise<any>;
    compare?: (input: any, signed: any) => Promise<any>;
    returnNode?: (input: any, signed: any, compare: any) => Promise<any>;
    deliver?: (input: any) => Promise<any>;
  };
  input: any;
}

export interface ExecuteWorkflowResult {
  quote: any;
  signed: any;
  compare: any;
  result: any;
  delivery?: any;
}

export const http: HttpModule;
export const proof: ProofModule;
export const userOp: UserOpModule;
export const relay: RelayModule;
export const trigger: TriggerModule;
export function parseAndValidate(args: ParseAndValidateArgs): ParseAndValidateResult;
export function executeWorkflow(args: ExecuteWorkflowArgs): Promise<ExecuteWorkflowResult>;

