import { expect } from "chai";
import { comparePrice } from "../kernels/compare.ts";
import type { PriceCheckRequest, SignedPriceQuote } from "../kernels/types.ts";

const quoteBase: SignedPriceQuote = {
  token: "eth",
  chain: "sepolia",
  price: 2000,
  priceE8: "200000000000",
  priceDecimals: 8,
  currency: "USD",
  source: "test",
  fetchedAt: 0,
  signature: "0x",
  signer: "0x0",
  digest: "0x",
};

describe("comparePrice", () => {
  it("returns ABOVE_RANGE when price exceeds upper bound", () => {
    const request: PriceCheckRequest = {
      token: "eth",
      chain: "sepolia",
      upperBound: 1500,
    };

    const result = comparePrice(request, { ...quoteBase, price: 2000 });
    expect(result.status).to.equal("ABOVE_RANGE");
    expect(result.difference).to.equal(500);
  });

  it("returns BELOW_RANGE when price is below lower bound", () => {
    const request: PriceCheckRequest = {
      token: "eth",
      chain: "sepolia",
      lowerBound: 2200,
    };

    const result = comparePrice(request, { ...quoteBase, price: 2000 });
    expect(result.status).to.equal("BELOW_RANGE");
    expect(result.difference).to.equal(200);
  });

  it("returns WITHIN_RANGE when within bounds", () => {
    const request: PriceCheckRequest = {
      token: "eth",
      chain: "sepolia",
      lowerBound: 1900,
      upperBound: 2100,
    };

    const result = comparePrice(request, { ...quoteBase, price: 2000 });
    expect(result.status).to.equal("WITHIN_RANGE");
    expect(result.difference).to.equal(0);
  });
});

