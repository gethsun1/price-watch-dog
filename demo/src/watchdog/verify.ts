import { Wallet, ethers } from "ethers";
import { proof } from "./krnl";
import type { PriceQuote, SignedPriceQuote } from "./types";
import { scaledIntStringToBigInt } from "./price";

export async function verifyPrice(quote: PriceQuote): Promise<SignedPriceQuote> {
  const priceE8 = scaledIntStringToBigInt(quote.priceE8);
  const priceDecimals = quote.priceDecimals;

  const preimage = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string", "string", "uint256", "uint8", "string", "string", "uint256"],
    [
      quote.token,
      quote.chain,
      priceE8,
      priceDecimals,
      quote.currency,
      quote.source,
      BigInt(quote.fetchedAt),
    ],
  );

  const digest = ethers.keccak256(preimage);

  // Demo: always prefer proof module (ephemeral). If it doesn't match expected scheme, fallback to local signer.
  if (proof?.generateEphemeral) {
    const proofRes = await proof.generateEphemeral(ethers.getBytes(preimage));
    try {
      const recovered = ethers.verifyMessage(ethers.getBytes(digest), proofRes.signature);
      if (recovered.toLowerCase() === String(proofRes.signer).toLowerCase()) {
        return {
          ...quote,
          signature: proofRes.signature,
          signer: proofRes.signer,
          digest,
          provedAt: proofRes.timestamp ?? Date.now(),
        };
      }
    } catch {
      // fall through
    }
  }

  const signer = Wallet.createRandom();
  const signature = await signer.signMessage(ethers.getBytes(digest));
  return {
    ...quote,
    signature,
    signer: await signer.getAddress(),
    digest,
    provedAt: Date.now(),
  };
}


