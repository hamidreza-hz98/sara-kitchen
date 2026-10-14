import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ORDER_CODE_PATTERN = /^SK-(?:[0-9A-HJKMNP-TV-Z]{4}-){3}[0-9A-HJKMNP-TV-Z]{4}$/u;

/** 80 random bits, grouped for phone support; the unique DB index is the final collision guard. */
export function generateOrderCode(): string {
  let bits = BigInt(`0x${randomBytes(10).toString("hex")}`);
  const characters = Array.from({ length: 16 }, () => {
    const character = ALPHABET[Number(bits & BigInt(31))]!;
    bits >>= BigInt(5);
    return character;
  });
  return `SK-${[0, 4, 8, 12].map((index) => characters.slice(index, index + 4).join("")).join("-")}`;
}
