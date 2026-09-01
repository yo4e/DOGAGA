import { describe, expect, it } from "vitest";
import { resolveClipDropIndex, resolvePointerInsertionIndex } from "./drop";

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

describe("resolvePointerInsertionIndex", () => {
  it.each([
    [20, [50, 150, 250], 0],
    [80, [50, 150, 250], 1],
    [200, [50, 150, 250], 2],
    [300, [50, 150, 250], 3],
  ])("places the pointer between clip midpoints", (pointerX, midpoints, expected) => {
    expect(resolvePointerInsertionIndex(pointerX, midpoints)).toBe(expected);
  });
});
