import { describe, expect, it } from "vitest";
import { EditorCommandError, executeCommand } from "./executor";
import {
  DEFAULT_AUDIO_TRACK_ID,
  DEFAULT_VIDEO_TRACK_ID,
  createEmptyEditorState,
  getAudioTracks,
  getDefaultAudioTrack,
  getDefaultVideoTrack,
  getVideoTracks,
  timelineDurationUs,
  type EditorState,
} from "./model";
import { toSafeEditorState } from "./safeState";

const S = 1_000_000;

function baseState(): EditorState {
  return {
    ...createEmptyEditorState(),
    assets: [
      { id: "v1", kind: "video", name: "one.mp4", durationUs: 10 * S },
      { id: "v2", kind: "video", name: "two.mp4", durationUs: 8 * S },
      { id: "v3", kind: "video", name: "three.mp4", durationUs: 6 * S },
      { id: "a1", kind: "audio", name: "song.wav", durationUs: 30 * S },
    ],
  };
}

function addVideo(
  state: EditorState,
  id: string,
  assetId: string,
  durationUs: number,
  trackId?: string,
): EditorState {
  return executeCommand(state, {
    type: "addClip",
    clip: { id, assetId, sourceInUs: 0, sourceOutUs: durationUs },
    ...(trackId ? { trackId } : {}),
  });
}

function v1(state: EditorState) {
  return getDefaultVideoTrack(state)!;
}

function a1(state: EditorState) {
  return getDefaultAudioTrack(state)!;
}

describe("executeCommand multi-track", () => {
  it("starts with compatibility V1 and A1 tracks", () => {
    const state = baseState();
    expect(getVideoTracks(state).map((track) => [track.id, track.name])).toEqual([[DEFAULT_VIDEO_TRACK_ID, "V1"]]);
    expect(getAudioTracks(state).map((track) => [track.id, track.name])).toEqual([[DEFAULT_AUDIO_TRACK_ID, "A1"]]);
  });

  it("keeps ripple packing independent per video track", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = executeCommand(state, { type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    state = addVideo(state, "overlay", "v3", 3 * S, "video-2");

    expect(v1(state).clips.map((clip) => clip.timelineStartUs)).toEqual([0, 5 * S]);
    expect(getVideoTracks(state)[1].clips[0].timelineStartUs).toBe(0);

    state = executeCommand(state, {
      type: "trimClip",
      clipId: "c1",
      sourceInUs: 0,
      sourceOutUs: 3 * S,
    });
    expect(v1(state).clips.map((clip) => clip.timelineStartUs)).toEqual([0, 3 * S]);
    expect(getVideoTracks(state)[1].clips[0].timelineStartUs).toBe(0);
  });

  it("moves a clip between video tracks and repacks both", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = executeCommand(state, { type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    state = executeCommand(state, { type: "moveClipToTrack", clipId: "c2", trackId: "video-2" });

    expect(v1(state).clips.map((clip) => clip.id)).toEqual(["c1"]);
    expect(getVideoTracks(state)[1].clips.map((clip) => clip.id)).toEqual(["c2"]);
    expect(getVideoTracks(state)[1].clips[0].timelineStartUs).toBe(0);
  });

  it("supports video track opacity, visibility and order", () => {
    let state = baseState();
    state = executeCommand(state, { type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    state = executeCommand(state, { type: "setTrackOpacity", trackId: "video-2", opacity: 0.4 });
    state = executeCommand(state, { type: "setTrackVisibility", trackId: "video-2", visible: false });
    state = executeCommand(state, { type: "moveTrack", trackId: DEFAULT_VIDEO_TRACK_ID, toIndex: 1 });

    expect(getVideoTracks(state).map((track) => track.id)).toEqual(["video-2", DEFAULT_VIDEO_TRACK_ID]);
    expect(getVideoTracks(state)[0]).toMatchObject({ opacity: 0.4, visible: false });
    expect(() => executeCommand(state, { type: "setTrackOpacity", trackId: "video-2", opacity: 2 })).toThrow(/opacity/);
  });

  it("supports multiple audio tracks and mute", () => {
    let state = baseState();
    state = executeCommand(state, { type: "addTrack", track: { id: "audio-2", kind: "audio", name: "A2" } });
    state = executeCommand(state, {
      type: "setAudio",
      audio: { id: "music-1", assetId: "a1", timelineStartUs: 0, sourceInUs: 0, sourceOutUs: 10 * S, volume: 0.5 },
    });
    state = executeCommand(state, {
      type: "setAudio",
      trackId: "audio-2",
      audio: { id: "music-2", assetId: "a1", timelineStartUs: S, sourceInUs: 2 * S, sourceOutUs: 8 * S, volume: 0.3 },
    });
    state = executeCommand(state, { type: "setTrackMute", trackId: "audio-2", muted: true });

    expect(a1(state).clips[0]).toMatchObject({ id: "music-1", volume: 0.5 });
    expect(getAudioTracks(state)[1]).toMatchObject({ muted: true });
    expect(getAudioTracks(state)[1].clips[0]).toMatchObject({ id: "music-2", timelineStartUs: S });
  });

  it("protects V1/A1 and only removes empty added tracks", () => {
    let state = baseState();
    expect(() => executeCommand(state, { type: "removeTrack", trackId: DEFAULT_VIDEO_TRACK_ID })).toThrow(/削除できません/);
    expect(() => executeCommand(state, { type: "removeTrack", trackId: DEFAULT_AUDIO_TRACK_ID })).toThrow(/削除できません/);

    state = executeCommand(state, { type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    state = addVideo(state, "overlay", "v1", 2 * S, "video-2");
    expect(() => executeCommand(state, { type: "removeTrack", trackId: "video-2" })).toThrow(/削除できません/);
    state = executeCommand(state, { type: "deleteClip", clipId: "overlay" });
    state = executeCommand(state, { type: "removeTrack", trackId: "video-2" });
    expect(getVideoTracks(state)).toHaveLength(1);
  });

  it("keeps speed, fade and split semantics inside the selected track", () => {
    let state = addVideo(baseState(), "c1", "v1", 8 * S);
    state = executeCommand(state, { type: "setClipSpeed", clipId: "c1", playbackRate: 2 });
    state = executeCommand(state, { type: "setClipFade", clipId: "c1", fadeInUs: S, fadeOutUs: S });
    state = executeCommand(state, { type: "splitClip", clipId: "c1", atTimelineUs: 2 * S, newClipId: "right" });

    expect(v1(state).clips.map((clip) => ({
      id: clip.id,
      sourceInUs: clip.sourceInUs,
      sourceOutUs: clip.sourceOutUs,
      fadeInUs: clip.fadeInUs,
      fadeOutUs: clip.fadeOutUs,
    }))).toEqual([
      { id: "c1", sourceInUs: 0, sourceOutUs: 4 * S, fadeInUs: S, fadeOutUs: 0 },
      { id: "right", sourceInUs: 4 * S, sourceOutUs: 8 * S, fadeInUs: 0, fadeOutUs: S },
    ]);
    expect(timelineDurationUs(state)).toBe(4 * S);
  });

  it("allows dissolve only between adjacent clips on the same video track", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = executeCommand(state, { type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    state = addVideo(state, "overlay", "v3", 3 * S, "video-2");

    state = executeCommand(state, {
      type: "addTransition",
      transition: { id: "t1", kind: "cross-dissolve", fromClipId: "c1", toClipId: "c2", durationUs: S },
    });
    expect(v1(state).clips.map((clip) => clip.timelineStartUs)).toEqual([0, 4 * S]);

    expect(() => executeCommand(state, {
      type: "addTransition",
      transition: { id: "t2", kind: "cross-dissolve", fromClipId: "c1", toClipId: "overlay", durationUs: S },
    })).toThrow(EditorCommandError);
  });

  it("drops a transition if a participating clip moves to another track", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = executeCommand(state, {
      type: "addTransition",
      transition: { id: "t1", kind: "cross-dissolve", fromClipId: "c1", toClipId: "c2", durationUs: S },
    });
    state = executeCommand(state, { type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    state = executeCommand(state, { type: "moveClipToTrack", clipId: "c2", trackId: "video-2" });
    expect(state.transitions).toEqual([]);
  });

  it("rejects invalid source ranges and wrong asset kinds", () => {
    expect(() => executeCommand(baseState(), {
      type: "addClip",
      clip: { id: "bad", assetId: "a1", sourceInUs: 0, sourceOutUs: S },
    })).toThrow(EditorCommandError);
    expect(() => executeCommand(baseState(), {
      type: "addClip",
      clip: { id: "bad", assetId: "v1", sourceInUs: 0, sourceOutUs: 11 * S },
    })).toThrow(EditorCommandError);
  });

  it("keeps safe state canonical tracks plus legacy views without runtime data", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = executeCommand(state, { type: "addTrack", track: { id: "video-2", kind: "video", name: "V2" } });
    state = addVideo(state, "overlay", "v2", 2 * S, "video-2");
    state = executeCommand(state, {
      type: "setAudio",
      audio: { id: "audio", assetId: "a1", timelineStartUs: S, sourceInUs: 0, sourceOutUs: 10 * S, volume: 0.5 },
    });

    const safe = toSafeEditorState(state);
    expect(safe.tracks.filter((track) => track.kind === "video")).toHaveLength(2);
    expect(safe.videoClips.map((clip) => clip.trackId)).toEqual([DEFAULT_VIDEO_TRACK_ID, "video-2"]);
    expect(safe.audioClip).toMatchObject({ trackId: DEFAULT_AUDIO_TRACK_ID, id: "audio" });
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain("objectUrl");
    expect(serialized).not.toContain("fileHandle");
    expect(serialized).not.toContain("absolutePath");
  });
});
