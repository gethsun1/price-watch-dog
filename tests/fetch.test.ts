import { expect } from "chai";
import { fetchPrice } from "../kernels/fetch.ts";
import type { PriceCheckRequest } from "../kernels/types.ts";

describe("fetchPrice", () => {
  const request: PriceCheckRequest = { token: "ethereum", chain: "sepolia" };

  it("parses coingecko-style response", async () => {
    const mockGet = async () => ({
      data: { ethereum: { usd: 1234.56 } },
    });

    const result = await fetchPrice(request, {
      httpGet: mockGet,
      now: () => 1700000000000,
    });

    expect(result.price).to.equal(1234.56);
    expect(result.currency).to.equal("USD");
    expect(result.source).to.equal("coingecko");
    expect(result.fetchedAt).to.equal(1700000000000);
  });

  it("throws when price is missing", async () => {
    const mockGet = async () => ({ data: {} });
    try {
      await fetchPrice(request, { httpGet: mockGet });
      expect.fail("expected fetchPrice to throw");
    } catch (err) {
      expect(String(err)).to.contain("price not found");
    }
  });
});

