/** Cross-runtime secure random bytes using the Web Crypto API. */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("random byte length must be a positive integer");
  }
  return globalThis.crypto.getRandomValues(new Uint8Array(length));
}
