import { describe, expect, it } from "vitest";
import { EditorController } from "../editor/controller";
import {
  addClip,
  addTransition,
  getProjectState,
  moveClip,
  setAudio,
  setCanvas,
  trimClip,
} from "./handlers";

const S = 1_000_000;

function controllerWithAssets() {
  const controller = new EditorController();
  controller.registerAsset({ id: "v1", kind: "video", name: "one.mp4", durationUs: 10 * S });
  controller.registerAsset({ id: "v2", kind: "video", name: "two.mp4", durationUs: 8 * S });
  controller.registerAsset({ id: "a1", kind: "audio", name: "song.wav", durationUs: 20 * S });
  return controller;
}

describe("WebMCP handlers", () => {
  it("adds and reorders clips through the shared controller", () => {
    const controller = controllerWithAssets();
    const first = addClip(controller, { assetId: "v1", sourceOutUs: 5 * S });
    const second = addClip(controller, { assetId: "v2", sourceOutUs: 4 * S });
    moveClip(controller, { clipId: second.clipId, toIndex: 0 });

    expect(controller.getState().videoClips.map((clip) => clip.id)).toEqual([
      second.clipId,
      first.clipId,
    ]);
  });

  it("trims through the same executor validation", () => {
    const controller = controllerWithAssets();
    const { clipId } = addClip(controller, { assetId: "v1" });
    trimClip(controller, { clipId, sourceInUs: S, sourceOutUs: 3 * S });
    expect(controller.getState().videoClips[0]).toMatchObject({ sourceInUs: S, sourceOutUs: 3 * S });
    expect(() => trimClip(controller, { clipId, sourceInUs: 4 * S, sourceOutUs: 3 * S })).toThrow();
  });

  it("sets audio and validates volume in the executor", () => {
    const controller = controllerWithAssets();
    setAudio(controller, { assetId: "a1", timelineStartUs: S, volume: 0.4 });
    expect(controller.getState().audioClip).toMatchObject({ assetId: "a1", timelineStartUs: S, volume: 0.4 });
    expect(() => setAudio(controller, { assetId: "a1", volume: 2 })).toThrow();
  });

  it("sets the canvas through the shared controller", () => {
    const controller = controllerWithAssets();
    setCanvas(controller, { preset: "square", fitMode: "cover" });
    expect(controller.getState().canvas).toEqual({
      preset: "square",
      width: 1080,
      height: 1080,
      fitMode: "cover",
    });
    expect(() => setCanvas(controller, { preset: "cinema" })).toThrow();
  });

  it("creates an actual transition overlap", () => {
    const controller = controllerWithAssets();
    const first = addClip(controller, { assetId: "v1", sourceOutUs: 5 * S });
    const second = addClip(controller, { assetId: "v2", sourceOutUs: 4 * S });
    addTransition(controller, { fromClipId: first.clipId, toClipId: second.clipId, durationUs: S });
    expect(controller.getState().videoClips[1].timelineStartUs).toBe(4 * S);
  });

  it("returns only the safe project state", () => {
    const controller = controllerWithAssets();
    const text = JSON.stringify(getProjectState(controller));
    expect(text).toContain("one.mp4");
    expect(text).not.toContain("objectUrl");
    expect(text).not.toContain("fileHandle");
  });
});
