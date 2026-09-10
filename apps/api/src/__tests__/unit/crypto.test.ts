import { describe, expect, it } from "vitest";
import {
  generateApiKey,
  generateDeviceCode,
  generateShareToken,
  generateUserCode,
  hashSecret,
  parseApiKeyToken,
  verifySecret,
} from "../../services/crypto.js";

describe("API key generation and parsing", () => {
  it("generates a token matching the oa_live_<prefix>_<secret> shape", () => {
    const key = generateApiKey();
    expect(key.token).toBe(`oa_live_${key.prefix}_${key.secret}`);
    expect(key.token).toMatch(/^oa_live_[A-Za-z0-9_-]{10}_[A-Za-z0-9_-]+$/);
  });

  it("round-trips prefix and secret through parseApiKeyToken", () => {
    const key = generateApiKey();
    const parsed = parseApiKeyToken(key.token);
    expect(parsed).toEqual({ prefix: key.prefix, secret: key.secret });
  });

  it("rejects malformed tokens", () => {
    expect(parseApiKeyToken("not-a-key")).toBeNull();
    expect(parseApiKeyToken("oa_live_short")).toBeNull();
    expect(parseApiKeyToken("")).toBeNull();
  });

  it("generates unique tokens on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.token).not.toBe(b.token);
  });
});

describe("secret hashing", () => {
  it("verifies a correct secret and rejects an incorrect one", async () => {
    const hash = await hashSecret("correct horse battery staple");
    expect(await verifySecret("correct horse battery staple", hash)).toBe(true);
    expect(await verifySecret("wrong", hash)).toBe(false);
  });

  it("never returns the plaintext in the stored hash", async () => {
    const hash = await hashSecret("super-secret-value");
    expect(hash).not.toContain("super-secret-value");
  });

  it("verifySecret returns false (not throw) for a malformed hash", async () => {
    await expect(verifySecret("x", "not-a-real-argon2-hash")).resolves.toBe(false);
  });
});

describe("device flow codes", () => {
  it("generates a user code in XXXX-XXXX shape without ambiguous characters", () => {
    const code = generateUserCode();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(code).not.toMatch(/[01OI]/);
  });

  it("generates unique device codes and share tokens", () => {
    expect(generateDeviceCode()).not.toBe(generateDeviceCode());
    expect(generateShareToken()).not.toBe(generateShareToken());
  });
});
