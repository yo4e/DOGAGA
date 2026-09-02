import { describe, expect, it } from "vitest";
import { EditorController } from "../editor/controller";
import { IMAGE_DEFAULT_DURATION_US } from "../editor/model";
import { proposeEditPlan } from "./collaborationHandlers";

const S = 1_000_000;

function controllerWithTimeline() {
  const controller = new EditorController();
  controller.registerAsset({ id: "v1", kind: "video", name: "one.mp4", durationUs: 10 * S });
  controller.execute({
    type: "addClip",
    clip: { id: "clip-1", assetId: "v1", sourceInUs: 0, sourceOutUs: 8 * S },
  });
  controller.execute({ type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
  return controller;
}

describe("propose_edit_plan handler", () => {
  it("creates a pending reviewable plan without changing the timeline", () => {
    const controller = controllerWithTimeline();
    controller.setProjectBrief({ destination: "spotify_canvas", goal: "promotional_loop" });

    const result = proposeEditPlan(controller, {
      title: "Optimize for Spotify Canvas",
      reason: "The destination is a short vertical loop.",
      operations: [
        { type: "set_canvas", preset: "portrait", fitMode: "cover" },
        { type: "move_clip_to_track", clipId: "clip-1", trackId: "video-2" },
        { type: "set_track_opacity", trackId: "video-2", opacity: 0.65 },
      ],
    });

    expect(result).toMatchObject({ ok: true, status: "pending", operationCount: 3 });
    expect(controller.getState().canvas.preset).toBe("landscape");
    expect(controller.getSafeState().editPlan).toMatchObject({
      title: "Optimize for Spotify Canvas",
      status: "pending",
    });
  });

  it("accepts still-image duration as a reviewable edit-plan operation", () => {
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

    const result = proposeEditPlan(controller, {
      title: "Repeat the demonstrated still treatment",
      reason: "The human example used a 3 second still duration.",
      operations: [{ type: "set_still_duration", clipId: "still-1", durationUs: 3 * S }],
    });

    expect(result).toMatchObject({ ok: true, status: "pending", operationCount: 1 });
    expect(controller.getSafeState().editPlan).toMatchObject({
      operations: [{ type: "set_still_duration", clipId: "still-1", durationUs: 3 * S }],
    });
    controller.applyEditPlan(controller.getSafeState().editPlan!.id);
    expect(controller.getState().tracks[0].clips[0]).toMatchObject({ sourceOutUs: 3 * S });
  });

  it("rejects unsupported operation types", () => {
    const controller = controllerWithTimeline();
    expect(() => proposeEditPlan(controller, {
      title: "Unsafe plan",
      reason: "Unsupported operation should be rejected.",
      operations: [{ type: "delete_everything" }],
    })).toThrow("Unsupported edit plan operation");
  });

  it("rejects plans that fail live executor validation", () => {
    const controller = controllerWithTimeline();
    expect(() => proposeEditPlan(controller, {
      title: "Bad target",
      reason: "The target track does not exist.",
      operations: [{ type: "set_track_opacity", trackId: "missing", opacity: 0.5 }],
    })).toThrow("track was not found");
  });
});
