import { Wallet, ethers, type Signer } from "ethers";
import { proof } from "@krnl-dev/sdk-core";
import type { PriceQuote, SignedPriceQuote } from "./types.ts";

interface VerifyDeps {
  signer?: Signer;
}

function createSigner(): Signer {
  const envKey = process.env.PRICEWATCHDOG_SIGNER_KEY;
  if (envKey) {
    return new Wallet(envKey);
  }
  // Fallback ephemeral signer for local dev; not persisted.
  return Wallet.createRandom();
}

export async function verifyPrice(
  quote: PriceQuote,
  deps: VerifyDeps = {},
): Promise<SignedPriceQuote> {
  const signer = deps.signer ?? createSigner();
  const payload = {
    token: quote.token,
    price: quote.price,
    currency: quote.currency,
    source: quote.source,
    fetchedAt: quote.fetchedAt,
  };

  if (proof?.generateEphemeral) {
    const sdkProof = await proof.generateEphemeral(payload);
    return {
      ...quote,
      signature: sdkProof.signature,
      signer: sdkProof.signer,
      digest: sdkProof.digest,
    };
  }

  const digest = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  const signature = await signer.signMessage(ethers.getBytes(digest));

  return {
    ...quote,
    signature,
    signer: await signer.getAddress(),
    digest,
  };
}

