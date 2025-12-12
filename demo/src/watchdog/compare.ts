import type { CompareResult, PriceCheckRequest, SignedPriceQuote } from "./types";
import { DEFAULT_PRICE_DECIMALS, fromScaledIntString, toScaledIntString } from "./price";

const now = () => Date.now();

export function comparePrice(
  request: PriceCheckRequest,
  quote: SignedPriceQuote,
): CompareResult {
  const { lowerBound, upperBound } = request;
  const priceDecimals = quote.priceDecimals ?? DEFAULT_PRICE_DECIMALS;
  const priceE8 = quote.priceE8;

  if (upperBound !== undefined) {
    const upperE8 = toScaledIntString(upperBound, priceDecimals);
    if (BigInt(priceE8) > BigInt(upperE8)) {
      return {
        status: "ABOVE_RANGE",
        difference: fromScaledIntString(
          (BigInt(priceE8) - BigInt(upperE8)).toString(),
          priceDecimals,
        ),
        triggeredAt: now(),
      };
    }
  }

  if (lowerBound !== undefined) {
    const lowerE8 = toScaledIntString(lowerBound, priceDecimals);
    if (BigInt(priceE8) < BigInt(lowerE8)) {
      return {
        status: "BELOW_RANGE",
        difference: fromScaledIntString(
          (BigInt(lowerE8) - BigInt(priceE8)).toString(),
          priceDecimals,
        ),
        triggeredAt: now(),
      };
    }
  }

  return { status: "WITHIN_RANGE", difference: 0, triggeredAt: now() };
}


