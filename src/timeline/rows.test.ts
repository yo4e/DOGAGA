import { describe, expect, it } from "vitest";
import {
  createAudioTrack,
  createEmptyEditorState,
  createVideoTrack,
} from "../editor/model";
import { getTimelineRows, getTimelineTrackMoveIndex } from "./rows";

function multiTrackState() {
  const state = createEmptyEditorState();
  return {
    ...state,
    tracks: [
      createVideoTrack("video-1", "V1", 0),
      createVideoTrack("video-2", "V2", 1),
      createAudioTrack("audio-1", "A1", 0),
      createAudioTrack("audio-2", "A2", 1),
    ],
  };
}

describe("timeline rows", () => {
  it("shows upper video layers first and audio tracks in ascending order", () => {
    expect(getTimelineRows(multiTrackState()).map((track) => track.name)).toEqual([
      "V2",
      "V1",
      "A1",
      "A2",
    ]);
  });

  it("maps visual up/down controls to canonical track order", () => {
    const state = multiTrackState();
    const [v2, v1, a1, a2] = getTimelineRows(state);
    const videoTracks = [v1, v2];
    const audioTracks = [a1, a2];

    expect(getTimelineTrackMoveIndex(v1, videoTracks, "up")).toBe(1);
    expect(getTimelineTrackMoveIndex(v1, videoTracks, "down")).toBeNull();
    expect(getTimelineTrackMoveIndex(v2, videoTracks, "up")).toBeNull();
    expect(getTimelineTrackMoveIndex(v2, videoTracks, "down")).toBe(0);
    expect(getTimelineTrackMoveIndex(a1, audioTracks, "up")).toBeNull();
    expect(getTimelineTrackMoveIndex(a1, audioTracks, "down")).toBe(1);
    expect(getTimelineTrackMoveIndex(a2, audioTracks, "up")).toBe(0);
    expect(getTimelineTrackMoveIndex(a2, audioTracks, "down")).toBeNull();
  });
});
