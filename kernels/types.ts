export type PriceStatus = "ABOVE_RANGE" | "BELOW_RANGE" | "WITHIN_RANGE";

export interface PriceCheckRequest {
  token: string;
  chain: string;
  lowerBound?: number;
  upperBound?: number;
  apiUrl?: string;
}

export interface PriceQuote {
  token: string;
  chain: string;
  /**
   * Human-friendly price (USD) for UI/logging.
   * Canonical value for signing/ABI encoding is `priceE8`.
   */
  price: number;
  /** Canonical scaled integer string: price * 1e8 */
  priceE8: string;
  /** Number of decimals used for price scaling (default: 8) */
  priceDecimals: number;
  currency: string;
  source: string;
  fetchedAt: number;
}

export interface SignedPriceQuote extends PriceQuote {
  signature: string;
  signer: string;
  digest: string;
  /** Attestation/proof timestamp (may differ from fetchedAt) */
  provedAt?: number;
}

export interface CompareResult {
  status: PriceStatus;
  difference: number;
  triggeredAt: number;
}

export interface WatchdogResult {
  request: PriceCheckRequest;
  quote: SignedPriceQuote;
  compare: CompareResult;
}

export interface TriggerConfig {
  enabled?: boolean;
  types?: Array<"update" | "pause" | "notify">;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface DeliverRequest {
  result: WatchdogResult;
  chains: string[];
  targetContract: string;
  triggers?: TriggerConfig;
}

export interface RelayReceipt {
  chain: string;
  op?: Record<string, unknown>;
  hash: string;
  dispatchedAt: number;
}

export interface TriggerResult {
  name: string;
  payload: unknown;
  triggeredAt: number;
}

export interface DeliveryOutput {
  payload: WatchdogResult;
  userOp: Record<string, unknown>;
  relays: RelayReceipt[];
  triggers?: TriggerResult[];
  deliveredAt: number;
}

