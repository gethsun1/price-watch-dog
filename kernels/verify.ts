import { Wallet, ethers, type Signer } from "ethers";
import { proof } from "./krnl.ts";
import type { PriceQuote, SignedPriceQuote } from "./types.ts";
import { scaledIntStringToBigInt } from "./price.ts";

interface VerifyDeps {
  signer?: Signer;
  now?: () => number;
  /**
   * Force-enable KRNL proof path when available. If not set, the kernel will
   * enable it when `process.env.PWD_USE_KRNL_PROOF === "1"`.
   */
  useKrnlProof?: boolean;
}

function createSigner(): Signer {
  const envKey =
    typeof process !== "undefined" ? process.env.PRICEWATCHDOG_SIGNER_KEY : undefined;
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
  const now = deps.now ?? Date.now;

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

  // Default: try KRNL proof first when available. Disable explicitly with `PWD_USE_KRNL_PROOF=0`.
  const envUseKrnl =
    typeof process !== "undefined" ? process.env.PWD_USE_KRNL_PROOF !== "0" : true;
  const useKrnlProof = deps.useKrnlProof ?? envUseKrnl;

  // Prefer KRNL proof module when available, but only accept it if it verifies
  // against the same digest+signature scheme expected by the on-chain consumer.
  if (useKrnlProof && proof?.generateEphemeral) {
    const proofRes = await proof.generateEphemeral(ethers.getBytes(preimage));

    // Basic timestamp sanity: proof time should not precede fetch time.
    if (typeof proofRes?.timestamp === "number" && proofRes.timestamp < quote.fetchedAt) {
      throw new Error("proof timestamp precedes fetchedAt");
    }

    // Only accept KRNL proof if signature verifies over the digest bytes.
    try {
      const recovered = ethers.verifyMessage(ethers.getBytes(digest), proofRes.signature);
      if (recovered.toLowerCase() === String(proofRes.signer).toLowerCase()) {
        return {
          ...quote,
          signature: proofRes.signature,
          signer: proofRes.signer,
          digest,
          provedAt: proofRes.timestamp ?? now(),
        };
      }
    } catch {
      // fall through to local signer path
    }
  }

  const signer = deps.signer ?? createSigner();
  const signature = await signer.signMessage(ethers.getBytes(digest));

  return {
    ...quote,
    signature,
    signer: await signer.getAddress(),
    digest,
    provedAt: now(),
  };
}

