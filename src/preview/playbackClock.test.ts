import { describe, expect, it } from "vitest";
import { playbackPositionUs, type PlaybackClock } from "./playbackClock";

const clock: PlaybackClock = { wallMs: 100, playheadUs: 2_000_000 };

describe("playbackPositionUs", () => {
  it("does not move backwards when the first animation-frame timestamp predates the clock", () => {
    expect(playbackPositionUs(clock, 99.997, 10_000_000)).toBe(2_000_000);
  });

  it("advances from the clock using elapsed milliseconds", () => {
    expect(playbackPositionUs(clock, 350, 10_000_000)).toBe(2_250_000);
  });

  it("stops at the timeline duration", () => {
    expect(playbackPositionUs(clock, 20_000, 5_000_000)).toBe(5_000_000);
  });
});
