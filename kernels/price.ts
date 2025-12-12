export const DEFAULT_PRICE_DECIMALS = 8;

/**
 * Convert a decimal-like value into a scaled integer string.
 * - `decimals=8` turns 1234.56 -> "123456000000"
 * - Returns a base-10 integer string so it can be JSON-serialized safely.
 */
export function toScaledIntString(
  value: number | string,
  decimals: number = DEFAULT_PRICE_DECIMALS,
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("invalid decimals");
  }

  // Normalize input into a fixed-point decimal string with `decimals` digits.
  let s: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("price was not numeric");
    s = value.toFixed(decimals);
  } else {
    s = value.trim();
    if (!s) throw new Error("price was empty");
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error("price was not numeric");
    // Pad/trim fractional part to `decimals` for consistent rounding down.
    const [i, f = ""] = s.split(".");
    const frac = (f + "0".repeat(decimals)).slice(0, decimals);
    s = `${i}.${frac}`;
  }

  const neg = s.startsWith("-");
  if (neg) throw new Error("price must be non-negative");

  const parts = s.split(".");
  const intPartRaw = parts[0] ?? "0";
  const fracPartRaw = parts[1] ?? "";
  const intPart = intPartRaw.replace(/^0+(?=\d)/, "") || "0";
  const fracPart = (fracPartRaw + "0".repeat(decimals)).slice(0, decimals);

  const combined = (intPart + fracPart).replace(/^0+(?=\d)/, "") || "0";
  return combined;
}

export function scaledIntStringToBigInt(value: string): bigint {
  const s = value.trim();
  if (!/^\d+$/.test(s)) throw new Error("scaled price must be an integer string");
  return BigInt(s);
}

export function fromScaledIntString(
  value: string,
  decimals: number = DEFAULT_PRICE_DECIMALS,
): number {
  const n = scaledIntStringToBigInt(value);
  const div = 10n ** BigInt(decimals);
  // lossy but fine for UI/comparison; on-chain uses the integer.
  return Number(n) / Number(div);
}


