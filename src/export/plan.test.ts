import { describe, expect, it } from "vitest";
import { executeCommand } from "../editor/executor";
import { createEmptyEditorState, type EditorState } from "../editor/model";
import { computeDrawRegion, exportDurationUs, pickRecorderFormat, videoLayersAt } from "./plan";

const S = 1_000_000;

function baseState(): EditorState {
  return {
    ...createEmptyEditorState(),
    assets: [
      { id: "v1", kind: "video", name: "one.mp4", durationUs: 10 * S, width: 1920, height: 1080 },
      { id: "v2", kind: "video", name: "two.mp4", durationUs: 10 * S, width: 1080, height: 1920 },
      { id: "a1", kind: "audio", name: "song.mp3", durationUs: 20 * S },
    ],
  };
}

function withTwoClips(): EditorState {
  let state = baseState();
  state = executeCommand(state, {
    type: "addClip",
    clip: { id: "c1", assetId: "v1", sourceInUs: S, sourceOutUs: 6 * S },
  });
  state = executeCommand(state, {
    type: "addClip",
    clip: { id: "c2", assetId: "v2", sourceInUs: 2 * S, sourceOutUs: 6 * S },
  });
  return state;
}

describe("export plan", () => {
  it("maps timeline time to the active clip source time", () => {
    const state = withTwoClips();
    expect(videoLayersAt(state, 2 * S)).toEqual([
      { clipId: "c1", assetId: "v1", sourceTimeUs: 3 * S, opacity: 1 },
    ]);
    expect(videoLayersAt(state, 6 * S)).toEqual([
      { clipId: "c2", assetId: "v2", sourceTimeUs: 3 * S, opacity: 1 },
    ]);
  });

  it("maps source time and duration through playback rate", () => {
    let state = baseState();
    state = executeCommand(state, {
      type: "addClip",
      clip: { id: "c1", assetId: "v1", sourceInUs: 0, sourceOutUs: 8 * S },
    });
    state = executeCommand(state, { type: "setClipSpeed", clipId: "c1", playbackRate: 2 });

    expect(exportDurationUs(state)).toBe(4 * S);
    expect(videoLayersAt(state, 2 * S)).toEqual([
      { clipId: "c1", assetId: "v1", sourceTimeUs: 4 * S, opacity: 1 },
    ]);
  });

  it("applies clip fade opacity in timeline time", () => {
    let state = baseState();
    state = executeCommand(state, {
      type: "addClip",
      clip: { id: "c1", assetId: "v1", sourceInUs: 0, sourceOutUs: 4 * S },
    });
    state = executeCommand(state, {
      type: "setClipFade",
      clipId: "c1",
      fadeInUs: S,
      fadeOutUs: S,
    });

    expect(videoLayersAt(state, 500_000)[0].opacity).toBeCloseTo(0.5);
    expect(videoLayersAt(state, 2 * S)[0].opacity).toBe(1);
    expect(videoLayersAt(state, 3_500_000)[0].opacity).toBeCloseTo(0.5);
  });

  it("multiplies clip fade with cross dissolve opacity", () => {
    let state = withTwoClips();
    state = executeCommand(state, {
      type: "setClipFade",
      clipId: "c2",
      fadeInUs: S,
      fadeOutUs: 0,
    });
    state = executeCommand(state, {
      type: "addTransition",
      transition: {
        id: "t1",
        kind: "cross-dissolve",
        fromClipId: "c1",
        toClipId: "c2",
        durationUs: S,
      },
    });

    const layers = videoLayersAt(state, 4.5 * S);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({ clipId: "c1", opacity: 0.5 });
    expect(layers[1].clipId).toBe("c2");
    expect(layers[1].opacity).toBeCloseTo(0.25);
    expect(exportDurationUs(state)).toBe(8 * S);
  });

  it("returns two weighted layers during a cross dissolve", () => {
    let state = withTwoClips();
    state = executeCommand(state, {
      type: "addTransition",
      transition: {
        id: "t1",
        kind: "cross-dissolve",
        fromClipId: "c1",
        toClipId: "c2",
        durationUs: S,
      },
    });

    const layers = videoLayersAt(state, 4.5 * S);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({ clipId: "c1", opacity: 0.5 });
    expect(layers[1]).toMatchObject({ clipId: "c2", opacity: 0.5 });
    expect(exportDurationUs(state)).toBe(8 * S);
  });

  it("computes contain geometry without cropping", () => {
    const region = computeDrawRegion(1920, 1080, 1080, 1920, "contain");
    expect(region.sx).toBe(0);
    expect(region.sy).toBe(0);
    expect(region.sw).toBe(1920);
    expect(region.sh).toBe(1080);
    expect(region.dx).toBe(0);
    expect(region.dy).toBeCloseTo(656.25);
    expect(region.dw).toBe(1080);
    expect(region.dh).toBeCloseTo(607.5);
  });

  it("computes cover geometry by cropping the source", () => {
    const region = computeDrawRegion(1920, 1080, 1080, 1920, "cover");
    expect(region.sx).toBeCloseTo(656.25);
    expect(region.sy).toBe(0);
    expect(region.sw).toBeCloseTo(607.5);
    expect(region.sh).toBe(1080);
    expect(region.dx).toBe(0);
    expect(region.dy).toBe(0);
    expect(region.dw).toBe(1080);
    expect(region.dh).toBe(1920);
  });

  it("prefers MP4 when supported and falls back to WebM", () => {
    expect(pickRecorderFormat((mime) => mime === "video/mp4")).toEqual({
      mimeType: "video/mp4",
      extension: "mp4",
    });

    expect(pickRecorderFormat((mime) => mime === "video/webm;codecs=vp8,opus")).toEqual({
      mimeType: "video/webm;codecs=vp8,opus",
      extension: "webm",
    });

    expect(pickRecorderFormat(() => false)).toBeNull();
  });
});
