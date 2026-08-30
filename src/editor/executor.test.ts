import { describe, expect, it } from "vitest";
import { EditorCommandError, executeCommand } from "./executor";
import { createEmptyEditorState, timelineDurationUs, type EditorState } from "./model";
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

function addVideo(state: EditorState, id: string, assetId: string, durationUs: number): EditorState {
  return executeCommand(state, {
    type: "addClip",
    clip: { id, assetId, sourceInUs: 0, sourceOutUs: durationUs },
  });
}

describe("executeCommand", () => {
  it("packs clips contiguously and ripples after trim", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    expect(state.videoClips.map((clip) => clip.timelineStartUs)).toEqual([0, 5 * S]);

    state = executeCommand(state, {
      type: "trimClip",
      clipId: "c1",
      sourceInUs: 0,
      sourceOutUs: 3 * S,
    });
    expect(state.videoClips.map((clip) => clip.timelineStartUs)).toEqual([0, 3 * S]);
  });

  it("changes timeline duration and ripples following clips at playback rate", () => {
    let state = addVideo(baseState(), "c1", "v1", 8 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = executeCommand(state, { type: "setClipSpeed", clipId: "c1", playbackRate: 2 });

    expect(state.videoClips[0]).toMatchObject({ playbackRate: 2 });
    expect(state.videoClips[1].timelineStartUs).toBe(4 * S);
    expect(timelineDurationUs(state)).toBe(8 * S);
    expect(() => executeCommand(state, {
      type: "setClipSpeed",
      clipId: "c1",
      playbackRate: 3,
    })).toThrowError(/再生速度/);
  });

  it("splits a clip at timeline time while preserving total duration", () => {
    let state = addVideo(baseState(), "c1", "v1", 6 * S);
    state = executeCommand(state, {
      type: "splitClip",
      clipId: "c1",
      atTimelineUs: 2 * S,
      newClipId: "c1-right",
    });

    expect(state.videoClips).toEqual([
      {
        id: "c1",
        assetId: "v1",
        timelineStartUs: 0,
        sourceInUs: 0,
        sourceOutUs: 2 * S,
        playbackRate: 1,
      },
      {
        id: "c1-right",
        assetId: "v1",
        timelineStartUs: 2 * S,
        sourceInUs: 2 * S,
        sourceOutUs: 6 * S,
        playbackRate: 1,
      },
    ]);
    expect(timelineDurationUs(state)).toBe(6 * S);
  });

  it("maps a split through playback rate into source time", () => {
    let state = addVideo(baseState(), "c1", "v1", 8 * S);
    state = executeCommand(state, { type: "setClipSpeed", clipId: "c1", playbackRate: 2 });
    state = executeCommand(state, {
      type: "splitClip",
      clipId: "c1",
      atTimelineUs: 2 * S,
      newClipId: "right",
    });

    expect(state.videoClips.map((clip) => ({
      sourceInUs: clip.sourceInUs,
      sourceOutUs: clip.sourceOutUs,
      playbackRate: clip.playbackRate,
      timelineStartUs: clip.timelineStartUs,
    }))).toEqual([
      { sourceInUs: 0, sourceOutUs: 4 * S, playbackRate: 2, timelineStartUs: 0 },
      { sourceInUs: 4 * S, sourceOutUs: 8 * S, playbackRate: 2, timelineStartUs: 2 * S },
    ]);
  });

  it("moves an outgoing transition to the right half after split", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
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
    state = executeCommand(state, {
      type: "splitClip",
      clipId: "c1",
      atTimelineUs: 2 * S,
      newClipId: "c1-right",
    });

    expect(state.transitions).toEqual([
      {
        id: "t1",
        kind: "cross-dissolve",
        fromClipId: "c1-right",
        toClipId: "c2",
        durationUs: S,
      },
    ]);
    expect(state.videoClips.map((clip) => clip.timelineStartUs)).toEqual([0, 2 * S, 4 * S]);
  });

  it("rejects split at clip edges or with a duplicate new id", () => {
    const state = addVideo(baseState(), "c1", "v1", 5 * S);
    expect(() => executeCommand(state, {
      type: "splitClip",
      clipId: "c1",
      atTimelineUs: 0,
      newClipId: "right",
    })).toThrowError(/内側/);
    expect(() => executeCommand(state, {
      type: "splitClip",
      clipId: "c1",
      atTimelineUs: 2 * S,
      newClipId: "c1",
    })).toThrowError(/すでに存在/);
  });

  it("reorders clips by index without creating accidental overlap", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = executeCommand(state, { type: "moveClip", clipId: "c2", toIndex: 0 });
    expect(state.videoClips.map((clip) => clip.id)).toEqual(["c2", "c1"]);
    expect(state.videoClips.map((clip) => clip.timelineStartUs)).toEqual([0, 4 * S]);
  });

  it("rejects invalid source ranges and wrong asset kinds", () => {
    expect(() =>
      executeCommand(baseState(), {
        type: "addClip",
        clip: { id: "bad", assetId: "a1", sourceInUs: 0, sourceOutUs: S },
      }),
    ).toThrow(EditorCommandError);

    expect(() =>
      executeCommand(baseState(), {
        type: "addClip",
        clip: { id: "bad", assetId: "v1", sourceInUs: 0, sourceOutUs: 11 * S },
      }),
    ).toThrow(EditorCommandError);
  });

  it("makes a cross dissolve a real overlap in timeline time", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
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

    expect(state.videoClips.map((clip) => clip.timelineStartUs)).toEqual([0, 4 * S]);
    expect(timelineDurationUs(state)).toBe(8 * S);
  });

  it("allows a cross dissolve only at an adjacent boundary", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = addVideo(state, "c3", "v3", 3 * S);

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
    expect(state.transitions).toHaveLength(1);

    expect(() =>
      executeCommand(state, {
        type: "addTransition",
        transition: {
          id: "t2",
          kind: "cross-dissolve",
          fromClipId: "c1",
          toClipId: "c3",
          durationUs: S,
        },
      }),
    ).toThrow(EditorCommandError);
  });

  it("drops transitions that become invalid after reordering", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
    state = addVideo(state, "c3", "v3", 3 * S);
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
    state = executeCommand(state, { type: "moveClip", clipId: "c3", toIndex: 1 });
    expect(state.transitions).toEqual([]);
  });

  it("removes a transition and restores contiguous timing", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = addVideo(state, "c2", "v2", 4 * S);
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
    state = executeCommand(state, { type: "removeTransition", transitionId: "t1" });
    expect(state.transitions).toEqual([]);
    expect(state.videoClips.map((clip) => clip.timelineStartUs)).toEqual([0, 5 * S]);
  });

  it("validates audio volume", () => {
    expect(() =>
      executeCommand(baseState(), {
        type: "setAudio",
        audio: {
          id: "audio",
          assetId: "a1",
          timelineStartUs: 0,
          sourceInUs: 0,
          sourceOutUs: 10 * S,
          volume: 2,
        },
      }),
    ).toThrowError(/volume/);
  });

  it("stores a validated canvas preset in shared editor state", () => {
    const state = executeCommand(baseState(), {
      type: "setCanvas",
      preset: "portrait",
      fitMode: "cover",
    });

    expect(state.canvas).toEqual({
      preset: "portrait",
      width: 1080,
      height: 1920,
      fitMode: "cover",
    });
    expect(toSafeEditorState(state).canvas).toEqual(state.canvas);
  });

  it("serializes only the agent-safe editor state", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
    state = executeCommand(state, { type: "setClipSpeed", clipId: "c1", playbackRate: 1.5 });
    state = executeCommand(state, {
      type: "setAudio",
      audio: {
        id: "audio",
        assetId: "a1",
        timelineStartUs: S,
        sourceInUs: 0,
        sourceOutUs: 10 * S,
        volume: 0.5,
      },
    });

    const safe = toSafeEditorState(state);
    const serialized = JSON.stringify(safe);
    expect(safe.videoClips[0].playbackRate).toBe(1.5);
    expect(serialized).toContain("one.mp4");
    expect(serialized).not.toContain("objectUrl");
    expect(serialized).not.toContain("fileHandle");
    expect(serialized).not.toContain("absolutePath");
  });
});
