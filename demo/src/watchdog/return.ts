import type {
  CompareResult,
  PriceCheckRequest,
  SignedPriceQuote,
  WatchdogResult,
} from "./types";

export interface ReturnPayload extends WatchdogResult {
  deliveredAt: number;
}

export function buildReturnPayload(
  request: PriceCheckRequest,
  quote: SignedPriceQuote,
  compare: CompareResult,
): ReturnPayload {
  return {
    request,
    quote,
    compare,
    deliveredAt: Date.now(),
  };
}


