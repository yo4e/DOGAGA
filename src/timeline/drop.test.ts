import { describe, expect, it } from "vitest";
import { resolveClipDropIndex } from "./drop";

describe("resolveClipDropIndex", () => {
  it.each([
    [0, 3, 3, 2],
    [2, 3, 0, 0],
    [1, 3, 2, 1],
    [1, 3, 1, 1],
  ])("normalizes same-track drops", (sourceIndex, targetLength, insertionIndex, expected) => {
    expect(resolveClipDropIndex({ sourceIndex, targetLength, insertionIndex, sameTrack: true })).toBe(expected);
  });

  it.each([
    [2, 0, 0],
    [2, 1, 1],
    [2, 2, 2],
    [2, 8, 2],
  ])("preserves cross-track insertion positions", (targetLength, insertionIndex, expected) => {
    expect(resolveClipDropIndex({ sourceIndex: 0, targetLength, insertionIndex, sameTrack: false })).toBe(expected);
  });
});
