import axios from "axios";
import { http } from "./krnl.ts";
import type { PriceCheckRequest, PriceQuote } from "./types.ts";
import {
  DEFAULT_PRICE_DECIMALS,
  fromScaledIntString,
  toScaledIntString,
} from "./price.ts";

type HttpGet = (url: string) => Promise<{ data: unknown }>;

interface FetchDeps {
  httpGet?: HttpGet;
  now?: () => number;
}

const defaultApiFor = (token: string) =>
  `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    token,
  )}&vs_currencies=usd`;

function extractPriceRaw(token: string, data: unknown): number | string {
  if (typeof data !== "object" || data === null) {
    throw new Error("price response was empty");
  }

  // Common API shapes we expect: { token: { usd: number } } or { price: number }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyData = data as any;
  const tokenEntry = anyData[token];
  const priceCandidate =
    tokenEntry?.usd ?? anyData?.usd ?? anyData?.price ?? anyData?.priceUsd;

  if (priceCandidate === undefined) {
    throw new Error("price not found in response");
  }

  return priceCandidate as number | string;
}

export async function fetchPrice(
  request: PriceCheckRequest,
  deps: FetchDeps = {},
): Promise<PriceQuote> {
  const { token, chain } = request;
  if (!token) throw new Error("token is required");
  if (!chain) throw new Error("chain is required");

  const httpGet = deps.httpGet ?? http?.get ?? axios.get;
  const now = deps.now ?? Date.now;
  const apiUrl = request.apiUrl ?? defaultApiFor(token);

  const response = await httpGet(apiUrl);
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
    fetchedAt: now(),
  };
}

