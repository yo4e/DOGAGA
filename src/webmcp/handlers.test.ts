import { describe, expect, it } from "vitest";
import { EditorController } from "../editor/controller";
import {
  addClip,
  addTrack,
  addTransition,
  clearAudio,
  getProjectState,
  moveClip,
  moveClipToTrack,
  moveTrack,
  setAudio,
  setCanvas,
  setClipFade,
  setClipSpeed,
  setTrackMute,
  setTrackOpacity,
  setTrackVisibility,
  splitClip,
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
  it("adds tracks and clips while keeping old add_clip default on V1", () => {
    const controller = controllerWithAssets();
    const first = addClip(controller, { assetId: "v1", sourceOutUs: 5 * S });
    const v2 = addTrack(controller, { kind: "video", name: "V2" });
    const overlay = addClip(controller, { assetId: "v2", trackId: v2.trackId, sourceOutUs: 4 * S });

    const safe = getProjectState(controller);
    expect(safe.videoClips.find((clip) => clip.id === first.clipId)?.trackId).toBe("video-1");
    expect(safe.videoClips.find((clip) => clip.id === overlay.clipId)?.trackId).toBe(v2.trackId);
    expect(safe.tracks.filter((track) => track.kind === "video")).toHaveLength(2);
  });

  it("reorders within a track and moves clips between tracks", () => {
    const controller = controllerWithAssets();
    const first = addClip(controller, { assetId: "v1", sourceOutUs: 5 * S });
    const second = addClip(controller, { assetId: "v2", sourceOutUs: 4 * S });
    moveClip(controller, { clipId: second.clipId, toIndex: 0 });
    expect(getProjectState(controller).videoClips.slice(0, 2).map((clip) => clip.id)).toEqual([second.clipId, first.clipId]);

    const v2 = addTrack(controller, { kind: "video" });
    moveClipToTrack(controller, { clipId: first.clipId, trackId: v2.trackId });
    expect(getProjectState(controller).videoClips.find((clip) => clip.id === first.clipId)?.trackId).toBe(v2.trackId);
  });

  it("sets track opacity, visibility, mute and ordering", () => {
    const controller = controllerWithAssets();
    const v2 = addTrack(controller, { kind: "video" });
    const a2 = addTrack(controller, { kind: "audio" });
    setTrackOpacity(controller, { trackId: v2.trackId, opacity: 0.4 });
    setTrackVisibility(controller, { trackId: v2.trackId, visible: false });
    setTrackMute(controller, { trackId: a2.trackId, muted: true });
    moveTrack(controller, { trackId: v2.trackId, toIndex: 0 });

    const safe = getProjectState(controller);
    expect(safe.tracks.find((track) => track.id === v2.trackId)).toMatchObject({ opacity: 0.4, visible: false, order: 0 });
    expect(safe.tracks.find((track) => track.id === a2.trackId)).toMatchObject({ muted: true });
  });

  it("keeps trim, split, speed and fade on the shared track-aware executor", () => {
    const controller = controllerWithAssets();
    const { clipId } = addClip(controller, { assetId: "v1", sourceOutUs: 8 * S });
    trimClip(controller, { clipId, sourceInUs: S, sourceOutUs: 7 * S });
    setClipSpeed(controller, { clipId, playbackRate: 2 });
    setClipFade(controller, { clipId, fadeInUs: 500_000, fadeOutUs: S });
    controller.setPlayheadUs(S);
    const split = splitClip(controller, { clipId });

    const safe = getProjectState(controller);
    expect(safe.videoClips).toHaveLength(2);
    expect(safe.videoClips[0]).toMatchObject({ playbackRate: 2, fadeInUs: 500_000, fadeOutUs: 0 });
    expect(safe.videoClips[1]).toMatchObject({ id: split.newClipId, playbackRate: 2, fadeInUs: 0, fadeOutUs: S });
  });

  it("sets audio independently on A1 and A2", () => {
    const controller = controllerWithAssets();
    const a2 = addTrack(controller, { kind: "audio", name: "A2" });
    setAudio(controller, { assetId: "a1", timelineStartUs: S, volume: 0.4 });
    setAudio(controller, { assetId: "a1", trackId: a2.trackId, timelineStartUs: 2 * S, volume: 0.2 });

    let safe = getProjectState(controller);
    expect(safe.audioClip).toMatchObject({ trackId: "audio-1", timelineStartUs: S, volume: 0.4 });
    expect(safe.audioClips.find((clip) => clip.trackId === a2.trackId)).toMatchObject({ timelineStartUs: 2 * S, volume: 0.2 });

    clearAudio(controller, { trackId: a2.trackId });
    safe = getProjectState(controller);
    expect(safe.audioClips.some((clip) => clip.trackId === a2.trackId)).toBe(false);
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

  it("creates an actual transition overlap on one track", () => {
    const controller = controllerWithAssets();
    const first = addClip(controller, { assetId: "v1", sourceOutUs: 5 * S });
    const second = addClip(controller, { assetId: "v2", sourceOutUs: 4 * S });
    addTransition(controller, { fromClipId: first.clipId, toClipId: second.clipId, durationUs: S });
    expect(getProjectState(controller).videoClips.find((clip) => clip.id === second.clipId)?.timelineStartUs).toBe(4 * S);
  });

  it("returns only safe project state", () => {
    const controller = controllerWithAssets();
    const text = JSON.stringify(getProjectState(controller));
    expect(text).toContain("tracks");
    expect(text).toContain("one.mp4");
    expect(text).not.toContain("objectUrl");
    expect(text).not.toContain("fileHandle");
  });
});
