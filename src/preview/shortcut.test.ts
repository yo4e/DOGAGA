import { describe, expect, it } from "vitest";
import { isSpaceShortcut } from "./shortcut";

describe("isSpaceShortcut", () => {
  it.each([
    [{ code: "Space", key: " " }, true],
    [{ code: "", key: " " }, true],
    [{ code: "", key: "Spacebar" }, true],
    [{ code: "KeyK", key: "k" }, false],
  ])("recognizes physical and browser-generated Space events", (event, expected) => {
    expect(isSpaceShortcut(event)).toBe(expected);
  });
});
