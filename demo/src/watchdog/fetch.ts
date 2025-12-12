import { http } from "./krnl";
import type { PriceCheckRequest, PriceQuote } from "./types";
import { DEFAULT_PRICE_DECIMALS, fromScaledIntString, toScaledIntString } from "./price";

const defaultApiFor = (token: string) =>
  `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    token,
  )}&vs_currencies=usd`;

function extractPriceRaw(token: string, data: unknown): number | string {
  if (typeof data !== "object" || data === null) throw new Error("price response was empty");
  const anyData = data as any;
  const tokenEntry = anyData[token];
  const priceCandidate =
    tokenEntry?.usd ?? anyData?.usd ?? anyData?.price ?? anyData?.priceUsd;
  if (priceCandidate === undefined) throw new Error("price not found in response");
  return priceCandidate as number | string;
}

export async function fetchPrice(request: PriceCheckRequest): Promise<PriceQuote> {
  const { token, chain } = request;
  if (!token) throw new Error("token is required");
  if (!chain) throw new Error("chain is required");

  const apiUrl = request.apiUrl ?? defaultApiFor(token);
  const response = await http.get(apiUrl);

  const raw = extractPriceRaw(token, response.data);
  const priceDecimals = DEFAULT_PRICE_DECIMALS;
  const priceE8 = toScaledIntString(
    typeof raw === "string" || typeof raw === "number" ? raw : String(raw),
    priceDecimals,
  );
  const price = fromScaledIntString(priceE8, priceDecimals);

  return {
    token,
    chain,
    price,
    priceE8,
    priceDecimals,
    currency: "USD",
    source: request.apiUrl ? "custom" : "coingecko",
    fetchedAt: Date.now(),
  };
}


