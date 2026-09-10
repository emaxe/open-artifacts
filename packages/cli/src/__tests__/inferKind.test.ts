import { describe, expect, it } from "vitest";
import { inferKind } from "../commands/artifacts.js";

describe("inferKind", () => {
  it("recognizes markdown extensions", () => {
    expect(inferKind("report.md")).toBe("markdown");
    expect(inferKind("report.markdown")).toBe("markdown");
  });

  it("recognizes svg", () => {
    expect(inferKind("logo.svg")).toBe("svg");
  });

  it("recognizes mermaid extensions", () => {
    expect(inferKind("diagram.mmd")).toBe("mermaid");
    expect(inferKind("diagram.mermaid")).toBe("mermaid");
  });

  it("defaults to html for .html and unrecognized extensions", () => {
    expect(inferKind("page.html")).toBe("html");
    expect(inferKind("notes.txt")).toBe("html");
    expect(inferKind("no-extension")).toBe("html");
  });

  it("is case-insensitive", () => {
    expect(inferKind("REPORT.MD")).toBe("markdown");
  });

  it("only looks at the extension, ignoring directories in the path", () => {
    expect(inferKind("/tmp/my.markdown.folder/report.svg")).toBe("svg");
  });
});
