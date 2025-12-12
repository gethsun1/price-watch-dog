import { expect } from "chai";
import { ethers, Wallet } from "ethers";
import { verifyPrice } from "../kernels/verify.ts";
import type { PriceQuote } from "../kernels/types.ts";

describe("verifyPrice", () => {
  it("produces a deterministic digest and an ECDSA signature over digest bytes (decimal-safe)", async () => {
    const signer = new Wallet(
      "0x0123456789012345678901234567890123456789012345678901234567890123",
    );

    const quote: PriceQuote = {
      token: "ethereum",
      chain: "sepolia",
      price: 1234.56,
      priceE8: "123456000000",
      priceDecimals: 8,
      currency: "USD",
      source: "test",
      fetchedAt: 1700000000000,
    };

    const signed = await verifyPrice(quote, {
      signer,
      now: () => 1700000001234,
      useKrnlProof: false,
    });

    const expectedDigest = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["string", "string", "uint256", "uint8", "string", "string", "uint256"],
        [
          quote.token,
          quote.chain,
          BigInt(quote.priceE8),
          quote.priceDecimals,
          quote.currency,
          quote.source,
          BigInt(quote.fetchedAt),
        ],
      ),
    );

    expect(signed.digest).to.equal(expectedDigest);

    const recovered = ethers.verifyMessage(
      ethers.getBytes(expectedDigest),
      signed.signature,
    );
    expect(recovered.toLowerCase()).to.equal(signer.address.toLowerCase());
    expect(signed.signer.toLowerCase()).to.equal(signer.address.toLowerCase());
    expect(signed.provedAt).to.equal(1700000001234);
  });
});




