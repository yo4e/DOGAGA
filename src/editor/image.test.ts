import { describe, expect, it } from "vitest";
import { EditorController } from "./controller";
import { DEFAULT_VIDEO_TRACK_ID, IMAGE_DEFAULT_DURATION_US, clipDurationUs, getVideoTracks } from "./model";

const S = 1_000_000;

function controllerWithImage() {
  const controller = new EditorController();
  controller.registerAsset({
    id: "image-1",
    kind: "image",
    name: "cover.png",
    durationUs: IMAGE_DEFAULT_DURATION_US,
    width: 1200,
    height: 1200,
  });
  controller.execute({
    type: "addClip",
    clip: {
      id: "still-1",
      assetId: "image-1",
      sourceInUs: 0,
      sourceOutUs: IMAGE_DEFAULT_DURATION_US,
    },
  });
  return controller;
}

describe("still-image editor semantics", () => {
  it("adds an image to V1 at the 5 second default duration", () => {
    const controller = controllerWithImage();
    const clip = getVideoTracks(controller.getState())[0].clips[0];
    expect(clip.assetId).toBe("image-1");
    expect(clip.playbackRate).toBe(1);
    expect(clipDurationUs(clip)).toBe(5 * S);
    expect(controller.getSafeState().assets[0]).toMatchObject({ kind: "image", width: 1200, height: 1200 });
  });

  it("changes still duration and repacks following clips", () => {
    const controller = controllerWithImage();
    controller.registerAsset({ id: "video-1", kind: "video", name: "next.mp4", durationUs: 10 * S });
    controller.execute({
      type: "addClip",
      clip: { id: "video-clip", assetId: "video-1", sourceInUs: 0, sourceOutUs: 4 * S },
    });

    controller.execute({ type: "setClipDuration", clipId: "still-1", durationUs: 8 * S });
    const [still, video] = getVideoTracks(controller.getState())[0].clips;
    expect(clipDurationUs(still)).toBe(8 * S);
    expect(video.timelineStartUs).toBe(8 * S);
  });

  it("allows fades, track moves, and transitions for stills", () => {
    const controller = controllerWithImage();
    controller.registerAsset({ id: "video-1", kind: "video", name: "next.mp4", durationUs: 10 * S });
    controller.execute({
      type: "addClip",
      clip: { id: "video-clip", assetId: "video-1", sourceInUs: 0, sourceOutUs: 4 * S },
    });
    controller.execute({ type: "setClipFade", clipId: "still-1", fadeInUs: S, fadeOutUs: S });
    controller.execute({
      type: "addTransition",
      transition: {
        id: "transition-1",
        kind: "cross-dissolve",
        fromClipId: "still-1",
        toClipId: "video-clip",
        durationUs: 500_000,
      },
    });
    expect(controller.getState().transitions).toHaveLength(1);

    controller.execute({ type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    controller.execute({ type: "moveClipToTrack", clipId: "still-1", trackId: "video-2" });
    expect(getVideoTracks(controller.getState()).find((track) => track.id === "video-2")?.clips[0]?.id).toBe("still-1");
    expect(controller.getState().transitions).toHaveLength(0);
  });

  it("rejects video-only source operations for stills", () => {
    const controller = controllerWithImage();
    expect(() => controller.execute({
      type: "trimClip",
      clipId: "still-1",
      sourceInUs: 0,
      sourceOutUs: 2 * S,
    })).toThrow("Still images do not support source trim, split, or playback speed");
    expect(() => controller.execute({ type: "setClipSpeed", clipId: "still-1", playbackRate: 2 })).toThrow(
      "Still images do not support source trim, split, or playback speed",
    );
    expect(() => controller.execute({
      type: "splitClip",
      clipId: "still-1",
      atTimelineUs: 2 * S,
      newClipId: "still-2",
    })).toThrow("Still images do not support source trim, split, or playback speed");
  });

  it("rejects still-duration changes for moving video clips", () => {
    const controller = new EditorController();
    controller.registerAsset({ id: "video-1", kind: "video", name: "one.mp4", durationUs: 10 * S });
    controller.execute({
      type: "addClip",
      clip: { id: "video-clip", assetId: "video-1", sourceInUs: 0, sourceOutUs: 5 * S },
    });
    expect(() => controller.execute({ type: "setClipDuration", clipId: "video-clip", durationUs: 6 * S })).toThrow(
      "still-duration operation can only be used with image clips",
    );
  });

  it("keeps the default compatibility video track ID", () => {
    expect(getVideoTracks(controllerWithImage().getState())[0].id).toBe(DEFAULT_VIDEO_TRACK_ID);
  });
});
