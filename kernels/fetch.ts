import axios from "axios";
import { http } from "@krnl-dev/sdk-core";
import type { PriceCheckRequest, PriceQuote } from "./types.ts";

type HttpGet = (url: string) => Promise<{ data: unknown }>;

interface FetchDeps {
  httpGet?: HttpGet;
  now?: () => number;
}

const defaultApiFor = (token: string) =>
  `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    token,
  )}&vs_currencies=usd`;

function extractPrice(token: string, data: unknown): number {
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

  const price = Number(priceCandidate);
  if (!Number.isFinite(price)) {
    throw new Error("price was not numeric");
  }

  return price;
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
  const price = extractPrice(token, response.data);

  return {
    token,
    price,
    currency: "USD",
    source: request.apiUrl ? "custom" : "coingecko",
    fetchedAt: now(),
  };
}

