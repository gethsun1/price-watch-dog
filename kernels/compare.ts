import type {
  CompareResult,
  PriceCheckRequest,
  SignedPriceQuote,
} from "./types.ts";

const now = () => Date.now();

export function comparePrice(
  request: PriceCheckRequest,
  quote: SignedPriceQuote,
): CompareResult {
  const { lowerBound, upperBound } = request;
  const price = quote.price;

  if (upperBound !== undefined && price > upperBound) {
    return {
      status: "ABOVE_RANGE",
      difference: price - upperBound,
      triggeredAt: now(),
    };
  }

  if (lowerBound !== undefined && price < lowerBound) {
    return {
      status: "BELOW_RANGE",
      difference: lowerBound - price,
      triggeredAt: now(),
    };
  }

  return { status: "WITHIN_RANGE", difference: 0, triggeredAt: now() };
}

