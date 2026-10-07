import { describe, expect, it } from "vite-plus/test";

import { ticketRangeAt } from "./ticketSelection";

const LINE = "er: MR-559 with runbook, related to MR-551";

function grow(text: string, word: string, from = 0): string | null {
  const start = text.indexOf(word, from);
  const range = ticketRangeAt(text, start, start + word.length);
  return range ? text.slice(range[0], range[1]) : null;
}

describe("ticketRangeAt", () => {
  it("grows the prefix, the number, and the hyphen to the full ticket id", () => {
    expect(grow(LINE, "MR")).toBe("MR-559");
    expect(grow(LINE, "559")).toBe("MR-559");
    expect(grow(LINE, "-")).toBe("MR-559");
    expect(grow(LINE, "551")).toBe("MR-551");
    expect(grow("see OPTI-41.", "OPTI")).toBe("OPTI-41");
    expect(grow("(COSM-227)", "227")).toBe("COSM-227");
  });

  it("accepts the trailing space that Windows adds to a double-click selection", () => {
    expect(grow(LINE, "559 ")).toBe("MR-559");
  });

  it("leaves other words alone", () => {
    expect(grow(LINE, "runbook")).toBeNull();
    expect(grow("r2-media-domain-and-admin-token", "media")).toBeNull();
    expect(grow("see XMR-559x", "559")).toBeNull();
    expect(grow("aMR-559", "559")).toBeNull();
  });

  it("does not grow a selection that reaches past the ticket", () => {
    expect(grow(LINE, "559 with")).toBeNull();
  });
});
