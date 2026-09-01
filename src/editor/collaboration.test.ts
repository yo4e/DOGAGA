import { describe, expect, it } from "vitest";
import { EditorController } from "./controller";
import { getVideoTracks } from "./model";

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
});
