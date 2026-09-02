import { describe, expect, it } from "vitest";
import { EditorController } from "../editor/controller";
import { IMAGE_DEFAULT_DURATION_US, clipDurationUs, getVideoTracks } from "../editor/model";
import { addImageClip, setStillDuration } from "./StillImageWebMCPTools";

const S = 1_000_000;

function controllerWithImage() {
  const controller = new EditorController();
  controller.registerAsset({
    id: "image-1",
    kind: "image",
    name: "cover.png",
    durationUs: IMAGE_DEFAULT_DURATION_US,
    width: 1080,
    height: 1080,
  });
  return controller;
}

describe("still-image WebMCP handlers", () => {
  it("adds an image clip with an optional custom duration", () => {
    const controller = controllerWithImage();
    const result = addImageClip(controller, { assetId: "image-1", durationUs: 7 * S });
    const clip = getVideoTracks(controller.getState())[0].clips[0];
    expect(result).toMatchObject({ ok: true, durationUs: 7 * S });
    expect(clipDurationUs(clip)).toBe(7 * S);
  });

  it("changes still duration without exposing source trim semantics", () => {
    const controller = controllerWithImage();
    const added = addImageClip(controller, { assetId: "image-1" });
    setStillDuration(controller, { clipId: added.clipId, durationUs: 9 * S });
    expect(clipDurationUs(getVideoTracks(controller.getState())[0].clips[0])).toBe(9 * S);
  });

  it("rejects non-image assets", () => {
    const controller = controllerWithImage();
    controller.registerAsset({ id: "video-1", kind: "video", name: "one.mp4", durationUs: 10 * S });
    expect(() => addImageClip(controller, { assetId: "video-1" })).toThrow("image asset");
  });
});
