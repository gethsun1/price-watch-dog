import { relay, trigger, userOp } from "@krnl-dev/sdk-core";
import type {
  DeliverRequest,
  DeliveryOutput,
  RelayReceipt,
  TriggerResult,
  WatchdogResult,
} from "./types.ts";

type CreateUserOp = (params: Record<string, unknown>) => Record<string, unknown>;
type RelayMultiChain = (
  chains: string[],
  op: Record<string, unknown>,
) => Promise<RelayReceipt[]>;
type TriggerAction = (
  name: string,
  payload: Record<string, unknown>,
) => Promise<TriggerResult>;

interface DeliverDeps {
  createUserOp?: CreateUserOp;
  relayMultiChain?: RelayMultiChain;
  triggerAction?: TriggerAction;
  now?: () => number;
}

const defaultCreateUserOp: CreateUserOp =
  userOp?.create ?? ((params) => ({ ...params }));

const defaultRelayMultiChain: RelayMultiChain =
  relay?.multiChain ??
  (async (chains, op) =>
    chains.map((chain) => ({
      chain,
      op,
      hash: `${chain}-stub-hash`,
      dispatchedAt: Date.now(),
    })));

const defaultTriggerAction: TriggerAction | undefined = trigger?.action;

function buildUserOpPayload(result: WatchdogResult, targetContract: string) {
  return {
    to: targetContract,
    data: {
      outcome: result.compare.status,
      price: result.quote.price,
      token: result.request.token,
      chain: result.request.chain,
      bounds: {
        lower: result.request.lowerBound,
        upper: result.request.upperBound,
      },
      proof: {
        digest: result.quote.digest,
        signature: result.quote.signature,
        signer: result.quote.signer,
      },
    },
    metadata: {
      requestedAt: result.quote.fetchedAt,
      compareAt: result.compare.triggeredAt,
    },
  };
}

async function runTriggers(
  result: WatchdogResult,
  triggerAction: TriggerAction | undefined,
  enabledTypes: Array<"update" | "pause" | "notify"> | undefined,
  webhookUrl?: string,
): Promise<TriggerResult[] | undefined> {
  if (!triggerAction || !enabledTypes || enabledTypes.length === 0) return undefined;

  const payloadBase = {
    outcome: result.compare.status,
    price: result.quote.price,
    token: result.request.token,
    chain: result.request.chain,
    proofDigest: result.quote.digest,
  };

  const actions: TriggerResult[] = [];
  for (const name of enabledTypes) {
    const extra =
      name === "notify" && webhookUrl
        ? { webhookUrl }
        : name === "update"
          ? { bounds: { lower: result.request.lowerBound, upper: result.request.upperBound } }
          : {};

    const res = await triggerAction(name, { ...payloadBase, ...extra });
    actions.push(res);
  }
  return actions;
}

export async function deliverResult(
  input: DeliverRequest,
  deps: DeliverDeps = {},
): Promise<DeliveryOutput> {
  const now = deps.now ?? Date.now;
  const createUserOp = deps.createUserOp ?? defaultCreateUserOp;
  const relayMultiChain = deps.relayMultiChain ?? defaultRelayMultiChain;
  const triggerAction = deps.triggerAction ?? defaultTriggerAction;

  const userOp = createUserOp(
    buildUserOpPayload(input.result, input.targetContract),
  );

  const relays = await relayMultiChain(input.chains, userOp);

  const triggerResults = input.triggers?.enabled
    ? await runTriggers(
        input.result,
        triggerAction,
        input.triggers?.types,
        input.triggers?.webhookUrl,
      )
    : undefined;

  return {
    payload: input.result,
    userOp,
    relays,
    ...(triggerResults ? { triggers: triggerResults } : {}),
    deliveredAt: now(),
  };
}

