import { describe, expect, it } from "vitest";
import { EditorController } from "./controller";
import { IMAGE_DEFAULT_DURATION_US, getVideoTracks } from "./model";

const S = 1_000_000;

function controllerWithVideo() {
  const controller = new EditorController();
  controller.registerAsset({ id: "v1", kind: "video", name: "one.mp4", durationUs: 10 * S });
  controller.execute({
    type: "addClip",
    clip: { id: "clip-1", assetId: "v1", sourceInUs: 0, sourceOutUs: 8 * S },
  });
  controller.execute({ type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
  return controller;
}

describe("agent collaboration", () => {
  it("exposes the project brief through agent-safe state", () => {
    const controller = controllerWithVideo();
    controller.setProjectBrief({ destination: "spotify_canvas", goal: "promotional_loop" });

    expect(controller.getSafeState()).toMatchObject({
      projectBrief: { destination: "spotify_canvas", goal: "promotional_loop" },
      editPlan: null,
      humanDemonstration: null,
    });
  });

  it("validates a proposal without mutating the timeline, then applies atomically through the executor", () => {
    const controller = controllerWithVideo();
    controller.setProjectBrief({ destination: "spotify_canvas", goal: "promotional_loop" });
    const before = controller.getState();

    const plan = controller.proposeEditPlan({
      id: "plan-1",
      title: "Prepare a vertical layered loop",
      reason: "The destination is Spotify Canvas and the current edit is landscape.",
      operations: [
        { type: "set_canvas", preset: "portrait", fitMode: "cover" },
        { type: "move_clip_to_track", clipId: "clip-1", trackId: "video-2" },
        { type: "set_track_opacity", trackId: "video-2", opacity: 0.65 },
        { type: "set_clip_fade", clipId: "clip-1", fadeInUs: 500_000, fadeOutUs: 500_000 },
      ],
    });

    expect(plan.status).toBe("pending");
    expect(controller.getState()).toBe(before);
    expect(controller.getState().canvas.preset).toBe("landscape");
    expect(controller.getSafeState().editPlan).toMatchObject({ id: "plan-1", status: "pending" });

    controller.applyEditPlan("plan-1");
    expect(controller.getState().canvas).toMatchObject({ preset: "portrait", fitMode: "cover" });
    expect(getVideoTracks(controller.getState()).find((track) => track.id === "video-2")).toMatchObject({
      opacity: 0.65,
      clips: [expect.objectContaining({ id: "clip-1", fadeInUs: 500_000, fadeOutUs: 500_000 })],
    });
    expect(controller.getSafeState().editPlan).toMatchObject({ id: "plan-1", status: "applied" });
  });

  it("rejects a plan without editing the project", () => {
    const controller = controllerWithVideo();
    controller.proposeEditPlan({
      id: "plan-2",
      title: "Move to V2",
      reason: "Use a secondary visual layer.",
      operations: [{ type: "move_clip_to_track", clipId: "clip-1", trackId: "video-2" }],
    });

    controller.rejectEditPlan("plan-2");
    expect(getVideoTracks(controller.getState())[0].clips[0]?.id).toBe("clip-1");
    expect(controller.getSafeState().editPlan).toMatchObject({ id: "plan-2", status: "rejected" });
  });

  it("does not partially apply a stale plan when revalidation fails", () => {
    const controller = controllerWithVideo();
    controller.proposeEditPlan({
      id: "plan-3",
      title: "Change canvas and V2 opacity",
      reason: "Test stale-plan revalidation.",
      operations: [
        { type: "set_canvas", preset: "square" },
        { type: "set_track_opacity", trackId: "video-2", opacity: 0.5 },
      ],
    });

    controller.execute({ type: "removeTrack", trackId: "video-2" });
    expect(() => controller.applyEditPlan("plan-3")).toThrow("track was not found");
    expect(controller.getState().canvas.preset).toBe("landscape");
    expect(controller.getSafeState().editPlan).toMatchObject({ id: "plan-3", status: "pending" });
  });

  it("rejects an invalid proposal before it reaches the review UI", () => {
    const controller = controllerWithVideo();
    expect(() => controller.proposeEditPlan({
      id: "plan-4",
      title: "Invalid target",
      reason: "This should fail validation.",
      operations: [{ type: "set_track_opacity", trackId: "missing-track", opacity: 0.5 }],
    })).toThrow("track was not found");
    expect(controller.getSafeState().editPlan).toBeNull();
  });

  it("captures a human example as semantic before/after changes", () => {
    const controller = controllerWithVideo();
    const recording = controller.startHumanDemonstration();

    expect(recording.status).toBe("recording");
    expect(controller.getSafeState().humanDemonstration).toMatchObject({
      id: recording.id,
      status: "recording",
      changes: [],
    });
    expect("snapshot" in (controller.getSafeState().humanDemonstration as object)).toBe(false);

    controller.execute({ type: "setCanvas", preset: "portrait", fitMode: "cover" });
    controller.execute({ type: "moveClipToTrack", clipId: "clip-1", trackId: "video-2" });
    controller.execute({ type: "setTrackOpacity", trackId: "video-2", opacity: 0.4 });
    controller.execute({ type: "setClipSpeed", clipId: "clip-1", playbackRate: 1.5 });
    controller.execute({ type: "setClipFade", clipId: "clip-1", fadeInUs: 500_000, fadeOutUs: 250_000 });

    const demonstration = controller.finishHumanDemonstration();
    expect(demonstration.status).toBe("ready");
    expect(demonstration.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "set_canvas", preset: "portrait", fitMode: "cover" }),
      expect.objectContaining({ type: "move_clip_to_track", clipId: "clip-1", fromTrackId: "video-1", trackId: "video-2" }),
      expect.objectContaining({ type: "set_track_opacity", trackId: "video-2", beforeOpacity: 1, opacity: 0.4 }),
      expect.objectContaining({ type: "set_clip_speed", clipId: "clip-1", beforePlaybackRate: 1, playbackRate: 1.5 }),
      expect.objectContaining({ type: "set_clip_fade", clipId: "clip-1", fadeInUs: 500_000, fadeOutUs: 250_000 }),
    ]));
    expect(controller.getSafeState().humanDemonstration).toMatchObject({
      status: "ready",
      changes: expect.any(Array),
    });
  });

  it("captures still-image display duration semantically", () => {
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

    controller.startHumanDemonstration();
    controller.execute({ type: "setClipDuration", clipId: "still-1", durationUs: 3 * S });
    const demonstration = controller.finishHumanDemonstration();

    expect(demonstration).toMatchObject({
      status: "ready",
      changes: [
        {
          type: "set_still_duration",
          clipId: "still-1",
          beforeDurationUs: 5 * S,
          durationUs: 3 * S,
        },
      ],
    });
  });

  it("captures an added still with its final duration and fades as one semantic example", () => {
    const controller = new EditorController();
    controller.registerAsset({
      id: "image-1",
      kind: "image",
      name: "cover.png",
      durationUs: IMAGE_DEFAULT_DURATION_US,
      width: 1200,
      height: 1200,
    });
    controller.execute({ type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });

    controller.startHumanDemonstration();
    controller.execute({
      type: "addClip",
      trackId: "video-2",
      clip: {
        id: "still-added",
        assetId: "image-1",
        sourceInUs: 0,
        sourceOutUs: IMAGE_DEFAULT_DURATION_US,
      },
    });
    controller.execute({ type: "setClipDuration", clipId: "still-added", durationUs: 3 * S });
    controller.execute({ type: "setClipFade", clipId: "still-added", fadeInUs: 500_000, fadeOutUs: 500_000 });
    const demonstration = controller.finishHumanDemonstration();

    expect(demonstration).toMatchObject({
      status: "ready",
      changes: [{
        type: "add_visual_clip",
        clipId: "still-added",
        assetId: "image-1",
        assetKind: "image",
        trackId: "video-2",
        toIndex: 0,
        durationUs: 3 * S,
        playbackRate: 1,
        fadeInUs: 500_000,
        fadeOutUs: 500_000,
      }],
    });
  });

  it("returns an explicit empty example when no supported semantic change was made", () => {
    const controller = controllerWithVideo();
    controller.startHumanDemonstration();
    controller.setPlayheadUs(2 * S);
    const demonstration = controller.finishHumanDemonstration();

    expect(demonstration).toMatchObject({ status: "empty", changes: [] });
  });

  it("replaces and dismisses a completed demonstration without leaking the previous example", () => {
    const controller = controllerWithVideo();
    const first = controller.startHumanDemonstration();
    controller.execute({ type: "setTrackVisibility", trackId: "video-1", visible: false });
    controller.finishHumanDemonstration();

    const second = controller.startHumanDemonstration();
    expect(second.id).not.toBe(first.id);
    expect(controller.getSafeState().humanDemonstration).toMatchObject({
      id: second.id,
      status: "recording",
      changes: [],
    });
    controller.execute({ type: "setTrackVisibility", trackId: "video-1", visible: true });
    expect(controller.finishHumanDemonstration().changes).toEqual([
      expect.objectContaining({ type: "set_track_visibility", trackId: "video-1", visible: true }),
    ]);

    controller.dismissHumanDemonstration();
    expect(controller.getSafeState().humanDemonstration).toBeNull();
  });
});
