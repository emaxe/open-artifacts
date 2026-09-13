import { describe, expect, it } from "vitest";
import { parseVersionParam } from "../../services/viewer-version.js";

describe("parseVersionParam", () => {
  it("accepts plain positive integers", () => {
    expect(parseVersionParam("1")).toBe(1);
    expect(parseVersionParam("42")).toBe(42);
    expect(parseVersionParam("1000000")).toBe(1000000);
  });

  it("returns null when the param is absent", () => {
    expect(parseVersionParam(undefined)).toBeNull();
  });

  it.each(["abc", "-1", "0", "1.5", "1e3", " 2", "2 ", "", "00", "999999999999", "1,000", "+1"])(
    "rejects %j",
    (raw) => {
      expect(parseVersionParam(raw)).toBeNull();
    },
  );
});
