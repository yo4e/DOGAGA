import {
  getAudioTracks,
  getVideoTracks,
  type EditorState,
  type EditorTrack,
} from "../editor/model";

export type TimelineTrackDirection = "up" | "down";

/**
 * Higher video layers are drawn above lower layers, while audio tracks keep
 * their conventional A1, A2, ... top-to-bottom order.
 */
export function getTimelineRows(state: EditorState): EditorTrack[] {
  return [...[...getVideoTracks(state)].reverse(), ...getAudioTracks(state)];
}

/** Returns the canonical same-kind track index for a visual up/down move. */
export function getTimelineTrackMoveIndex(
  track: EditorTrack,
  sameKindTracks: EditorTrack[],
  direction: TimelineTrackDirection,
): number | null {
  const index = sameKindTracks.findIndex((candidate) => candidate.id === track.id);
  if (index < 0) return null;

  const delta = track.kind === "video"
    ? (direction === "up" ? 1 : -1)
    : (direction === "up" ? -1 : 1);
  const targetIndex = index + delta;
  return targetIndex >= 0 && targetIndex < sameKindTracks.length ? targetIndex : null;
}
