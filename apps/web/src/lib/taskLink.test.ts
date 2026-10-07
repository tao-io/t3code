import { describe, expect, it } from "vite-plus/test";

import { buildTaskLinkUrl, taskLinkIdFromSelection } from "./taskLink";

describe("taskLinkIdFromSelection", () => {
  it("trims the selection", () => {
    expect(taskLinkIdFromSelection("  MR-559 \t")).toBe("MR-559");
  });

  it("rejects empty, multi-line, and long selections", () => {
    expect(taskLinkIdFromSelection("   ")).toBeNull();
    expect(taskLinkIdFromSelection("MR-1\nMR-2")).toBeNull();
    expect(taskLinkIdFromSelection("MR-1\r\nMR-2")).toBeNull();
    expect(taskLinkIdFromSelection("x".repeat(201))).toBeNull();
    expect(taskLinkIdFromSelection("x".repeat(200))).toBe("x".repeat(200));
  });
});

describe("buildTaskLinkUrl", () => {
  it("replaces every placeholder with the encoded id", () => {
    expect(buildTaskLinkUrl("https://tracker.test/task/{id}?ref={id}", "A B/1")).toEqual({
      kind: "url",
      url: "https://tracker.test/task/A%20B%2F1?ref=A%20B%2F1",
    });
  });

  it("appends the id to a template without a placeholder", () => {
    expect(buildTaskLinkUrl(" https://tracker.test/task/ ", "MR-559")).toEqual({
      kind: "url",
      url: "https://tracker.test/task/MR-559",
    });
  });

  it("reports an empty template as not configured", () => {
    expect(buildTaskLinkUrl("  ", "MR-559")).toEqual({ kind: "not-configured" });
  });

  it("rejects templates that do not build an http(s) URL", () => {
    expect(buildTaskLinkUrl("tracker/{id}", "MR-559")).toEqual({ kind: "invalid-template" });
    expect(buildTaskLinkUrl("javascript:alert('{id}')", "MR-559")).toEqual({
      kind: "invalid-template",
    });
  });
});
