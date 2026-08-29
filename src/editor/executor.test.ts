import { describe, expect, it } from "vitest";
import { EditorCommandError, executeCommand } from "./executor";
import { createEmptyEditorState, type EditorState } from "./model";
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

  it("reorders clips by index without creating overlap", () => {
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

  it("serializes only the agent-safe editor state", () => {
    let state = addVideo(baseState(), "c1", "v1", 5 * S);
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

    const serialized = JSON.stringify(toSafeEditorState(state));
    expect(serialized).toContain("one.mp4");
    expect(serialized).not.toContain("objectUrl");
    expect(serialized).not.toContain("fileHandle");
    expect(serialized).not.toContain("absolutePath");
  });
});
