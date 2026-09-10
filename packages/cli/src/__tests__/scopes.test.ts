import { describe, expect, it } from "vitest";
import { API_KEY_SCOPES, isValidScope } from "../scopes.js";

describe("isValidScope", () => {
  it("accepts every known scope", () => {
    for (const scope of API_KEY_SCOPES) {
      expect(isValidScope(scope)).toBe(true);
    }
  });

  it("rejects unknown scopes", () => {
    expect(isValidScope("artifacts:admin")).toBe(false);
    expect(isValidScope("")).toBe(false);
  });
});
