import { describe, expect, it } from "vite-plus/test";
import {
  clearFinalAnswerMarker,
  findFinalAnswerRow,
  finishFinalAnswerReading,
  markFinalAnswer,
  readFinalAnswerMarker,
  readFinalAnswerReadingRequest,
  requestFinalAnswerReading,
  resolveFinalAnswerMarker,
  type FinalAnswerCandidateRow,
} from "./finalAnswerReading";

const user = (id: string): FinalAnswerCandidateRow => ({
  id: `row-${id}`,
  kind: "message",
  message: { id, role: "user" },
});
const assistant = (id: string): FinalAnswerCandidateRow => ({
  id: `row-${id}`,
  kind: "message",
  message: { id, role: "assistant" },
});
const work = (id: string): FinalAnswerCandidateRow => ({ id: `row-${id}`, kind: "work" });

describe("findFinalAnswerRow", () => {
  it("picks the last assistant message of the latest turn, after tool calls and commentary", () => {
    const rows = [
      user("u1"),
      assistant("a1"),
      user("u2"),
      assistant("commentary"),
      work("tools"),
      assistant("answer"),
      { id: "meta", kind: "assistant-meta", message: { id: "answer", role: "assistant" } },
      work("trailing"),
    ];
    expect(findFinalAnswerRow(rows)?.id).toBe("row-answer");
  });

  it("has no final answer while the newest user message is unanswered", () => {
    expect(findFinalAnswerRow([user("u1"), assistant("a1"), user("u2"), work("w")])).toBeNull();
    expect(findFinalAnswerRow([])).toBeNull();
  });

  it("reads a turn without a user message, such as an imported history", () => {
    expect(findFinalAnswerRow([work("w"), assistant("a1")])?.id).toBe("row-a1");
  });
});

describe("resolveFinalAnswerMarker", () => {
  it("shows the marker while the marked answer is still the final one", () => {
    expect(resolveFinalAnswerMarker([user("u1"), assistant("a1")], "a1")).toEqual({
      rowId: "row-a1",
      stale: false,
    });
  });

  it("goes stale once the user sends the next message", () => {
    expect(resolveFinalAnswerMarker([user("u1"), assistant("a1"), user("u2")], "a1")).toEqual({
      rowId: null,
      stale: true,
    });
  });

  it("keeps the marker while its answer is not loaded", () => {
    expect(resolveFinalAnswerMarker([], "a1")).toEqual({ rowId: null, stale: false });
    expect(resolveFinalAnswerMarker([user("u1"), assistant("a1")], null)).toEqual({
      rowId: null,
      stale: false,
    });
  });
});

describe("final answer reading requests", () => {
  it("holds one request per thread until the timeline finishes it", () => {
    requestFinalAnswerReading("env:thread-a");
    const first = readFinalAnswerReadingRequest("env:thread-a");
    expect(first).not.toBeNull();
    requestFinalAnswerReading("env:thread-a");
    const second = readFinalAnswerReadingRequest("env:thread-a");
    expect(second).not.toBe(first);

    // A stale request cannot finish the newer one.
    finishFinalAnswerReading(first!);
    expect(readFinalAnswerReadingRequest("env:thread-a")).toBe(second);
    finishFinalAnswerReading(second!);
    expect(readFinalAnswerReadingRequest("env:thread-a")).toBeNull();
    expect(readFinalAnswerReadingRequest("env:thread-b")).toBeNull();
  });
});

describe("final answer markers", () => {
  it("marks one answer per thread until cleared", () => {
    markFinalAnswer("env:thread-m", "a1");
    markFinalAnswer("env:thread-m", "a2");
    expect(readFinalAnswerMarker("env:thread-m")).toBe("a2");
    clearFinalAnswerMarker("env:thread-m");
    expect(readFinalAnswerMarker("env:thread-m")).toBeNull();
  });
});
