import { executeCommand } from "./executor";
import {
  CANVAS_PRESETS,
  FADE_DURATIONS_US,
  PLAYBACK_RATES,
  clipDurationUs,
  getAudioTracks,
  getVideoTracks,
  type AssetKind,
  type CanvasFitMode,
  type CanvasPresetId,
  type EditorCommand,
  type EditorState,
  type PlaybackRate,
  type VideoClip,
} from "./model";

export const PROJECT_DESTINATION_OPTIONS = [
  { value: "general", label: "General" },
  { value: "spotify_canvas", label: "Spotify Canvas" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
  { value: "instagram_reel", label: "Instagram Reel" },
  { value: "tiktok", label: "TikTok" },
  { value: "music_video", label: "Music video" },
  { value: "custom", label: "Custom" },
] as const;

export const PROJECT_GOAL_OPTIONS = [
  { value: "general", label: "General edit" },
  { value: "promotional_loop", label: "Promotional loop" },
  { value: "vertical_short", label: "Vertical short" },
  { value: "music_centered", label: "Music-centered" },
  { value: "custom", label: "Custom" },
] as const;

export type ProjectDestination = (typeof PROJECT_DESTINATION_OPTIONS)[number]["value"];
export type ProjectGoal = (typeof PROJECT_GOAL_OPTIONS)[number]["value"];

export type ProjectBrief = {
  destination: ProjectDestination;
  goal: ProjectGoal;
};

export type EditPlanOperation =
  | {
      type: "add_visual_clip";
      clipId: string;
      assetId: string;
      trackId: string;
      toIndex?: number;
      durationUs?: number;
      playbackRate?: PlaybackRate;
      fadeInUs?: number;
      fadeOutUs?: number;
    }
  | { type: "set_canvas"; preset: CanvasPresetId; fitMode?: CanvasFitMode }
  | { type: "set_track_opacity"; trackId: string; opacity: number }
  | { type: "set_track_visibility"; trackId: string; visible: boolean }
  | { type: "set_track_mute"; trackId: string; muted: boolean }
  | { type: "move_clip"; clipId: string; toIndex: number }
  | { type: "move_clip_to_track"; clipId: string; trackId: string; toIndex?: number }
  | { type: "trim_clip"; clipId: string; sourceInUs: number; sourceOutUs: number }
  | { type: "set_clip_speed"; clipId: string; playbackRate: PlaybackRate }
  | { type: "set_still_duration"; clipId: string; durationUs: number }
  | { type: "set_clip_fade"; clipId: string; fadeInUs: number; fadeOutUs: number };

export type AgentEditPlanStatus = "pending" | "applied" | "rejected";

export type AgentEditPlan = {
  id: string;
  title: string;
  reason: string;
  operations: EditPlanOperation[];
  status: AgentEditPlanStatus;
  createdAt: number;
  resolvedAt?: number;
};

export type HumanDemonstrationChange =
  | {
      type: "add_visual_clip";
      clipId: string;
      assetId: string;
      assetKind: "video" | "image";
      trackId: string;
      toIndex: number;
      durationUs?: number;
      playbackRate: number;
      fadeInUs: number;
      fadeOutUs: number;
    }
  | {
      type: "set_canvas";
      beforePreset: CanvasPresetId;
      preset: CanvasPresetId;
      beforeFitMode: CanvasFitMode;
      fitMode: CanvasFitMode;
    }
  | { type: "set_track_opacity"; trackId: string; beforeOpacity: number; opacity: number }
  | { type: "set_track_visibility"; trackId: string; beforeVisible: boolean; visible: boolean }
  | { type: "set_track_mute"; trackId: string; beforeMuted: boolean; muted: boolean }
  | { type: "move_clip"; clipId: string; trackId: string; fromIndex: number; toIndex: number }
  | {
      type: "move_clip_to_track";
      clipId: string;
      fromTrackId: string;
      trackId: string;
      fromIndex: number;
      toIndex: number;
    }
  | {
      type: "set_clip_speed";
      clipId: string;
      beforePlaybackRate: number;
      playbackRate: number;
    }
  | {
      type: "set_still_duration";
      clipId: string;
      beforeDurationUs: number;
      durationUs: number;
    }
  | {
      type: "set_clip_fade";
      clipId: string;
      beforeFadeInUs: number;
      beforeFadeOutUs: number;
      fadeInUs: number;
      fadeOutUs: number;
    };

export type HumanDemonstrationStatus = "recording" | "ready" | "empty";

export type HumanDemonstration = {
  id: string;
  status: HumanDemonstrationStatus;
  startedAt: number;
  recordedAt?: number;
  changes: HumanDemonstrationChange[];
};

export type CollaborationState = {
  projectBrief: ProjectBrief;
  editPlan: AgentEditPlan | null;
  humanDemonstration: HumanDemonstration | null;
};

export function createEmptyCollaborationState(): CollaborationState {
  return {
    projectBrief: { destination: "general", goal: "general" },
    editPlan: null,
    humanDemonstration: null,
  };
}

export function isProjectDestination(value: string): value is ProjectDestination {
  return PROJECT_DESTINATION_OPTIONS.some((option) => option.value === value);
}

export function isProjectGoal(value: string): value is ProjectGoal {
  return PROJECT_GOAL_OPTIONS.some((option) => option.value === value);
}

export function cloneEditPlan(plan: AgentEditPlan | null): AgentEditPlan | null {
  return plan
    ? {
        ...plan,
        operations: plan.operations.map((operation) => ({ ...operation })),
      }
    : null;
}

export function cloneHumanDemonstration(demonstration: HumanDemonstration | null): HumanDemonstration | null {
  return demonstration
    ? {
        ...demonstration,
        changes: demonstration.changes.map((change) => ({ ...change })),
      }
    : null;
}

export function cloneEditorStateForDemonstration(state: EditorState): EditorState {
  return {
    canvas: { ...state.canvas },
    assets: state.assets.map((asset) => ({ ...asset })),
    tracks: state.tracks.map((track) => (
      track.kind === "video"
        ? { ...track, clips: track.clips.map((clip) => ({ ...clip })) }
        : { ...track, clips: track.clips.map((clip) => ({ ...clip })) }
    )),
    transitions: state.transitions.map((transition) => ({ ...transition })),
    playheadUs: state.playheadUs,
  };
}

type VisualClipLocation = {
  trackId: string;
  index: number;
  clip: VideoClip;
  assetKind: AssetKind | undefined;
};

function visualClipLocations(state: EditorState): Map<string, VisualClipLocation> {
  const assetKinds = new Map(state.assets.map((asset) => [asset.id, asset.kind] as const));
  const locations = new Map<string, VisualClipLocation>();
  for (const track of getVideoTracks(state)) {
    track.clips.forEach((clip, index) => {
      locations.set(clip.id, {
        trackId: track.id,
        index,
        clip,
        assetKind: assetKinds.get(clip.assetId),
      });
    });
  }
  return locations;
}

function arraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function inferSingleSameTrackMove(beforeIds: readonly string[], afterIds: readonly string[]): { clipId: string; fromIndex: number; toIndex: number } | null {
  if (arraysEqual(beforeIds, afterIds) || beforeIds.length !== afterIds.length) return null;
  const afterSet = new Set(afterIds);
  if (beforeIds.some((id) => !afterSet.has(id))) return null;

  const candidates = beforeIds.flatMap((clipId, fromIndex) => {
    const toIndex = afterIds.indexOf(clipId);
    if (toIndex < 0 || toIndex === fromIndex) return [];
    const beforeWithout = beforeIds.filter((id) => id !== clipId);
    const afterWithout = afterIds.filter((id) => id !== clipId);
    return arraysEqual(beforeWithout, afterWithout) ? [{ clipId, fromIndex, toIndex }] : [];
  });

  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Turn a human's before/after editor states into a conservative semantic example.
 * Unsupported or ambiguous differences are deliberately omitted rather than guessed.
 */
export function createHumanDemonstrationChanges(
  before: EditorState,
  after: EditorState,
): HumanDemonstrationChange[] {
  const changes: HumanDemonstrationChange[] = [];

  if (before.canvas.preset !== after.canvas.preset || before.canvas.fitMode !== after.canvas.fitMode) {
    changes.push({
      type: "set_canvas",
      beforePreset: before.canvas.preset,
      preset: after.canvas.preset,
      beforeFitMode: before.canvas.fitMode,
      fitMode: after.canvas.fitMode,
    });
  }

  const afterVideoTracks = new Map(getVideoTracks(after).map((track) => [track.id, track] as const));
  for (const beforeTrack of getVideoTracks(before)) {
    const afterTrack = afterVideoTracks.get(beforeTrack.id);
    if (!afterTrack) continue;
    if (beforeTrack.opacity !== afterTrack.opacity) {
      changes.push({
        type: "set_track_opacity",
        trackId: beforeTrack.id,
        beforeOpacity: beforeTrack.opacity,
        opacity: afterTrack.opacity,
      });
    }
    if (beforeTrack.visible !== afterTrack.visible) {
      changes.push({
        type: "set_track_visibility",
        trackId: beforeTrack.id,
        beforeVisible: beforeTrack.visible,
        visible: afterTrack.visible,
      });
    }
  }

  const afterAudioTracks = new Map(getAudioTracks(after).map((track) => [track.id, track] as const));
  for (const beforeTrack of getAudioTracks(before)) {
    const afterTrack = afterAudioTracks.get(beforeTrack.id);
    if (!afterTrack) continue;
    if (beforeTrack.muted !== afterTrack.muted) {
      changes.push({
        type: "set_track_mute",
        trackId: beforeTrack.id,
        beforeMuted: beforeTrack.muted,
        muted: afterTrack.muted,
      });
    }
  }

  const beforeLocations = visualClipLocations(before);
  const afterLocations = visualClipLocations(after);
  const addedClipIds = [...afterLocations.keys()]
    .filter((clipId) => !beforeLocations.has(clipId))
    .sort();
  const commonClipIds = [...beforeLocations.keys()]
    .filter((clipId) => afterLocations.has(clipId))
    .sort();

  for (const clipId of addedClipIds) {
    const location = afterLocations.get(clipId)!;
    if (location.assetKind !== "video" && location.assetKind !== "image") continue;
    changes.push({
      type: "add_visual_clip",
      clipId,
      assetId: location.clip.assetId,
      assetKind: location.assetKind,
      trackId: location.trackId,
      toIndex: location.index,
      ...(location.assetKind === "image" ? { durationUs: clipDurationUs(location.clip) } : {}),
      playbackRate: location.clip.playbackRate,
      fadeInUs: location.clip.fadeInUs,
      fadeOutUs: location.clip.fadeOutUs,
    });
  }

  for (const clipId of commonClipIds) {
    const beforeLocation = beforeLocations.get(clipId)!;
    const afterLocation = afterLocations.get(clipId)!;
    if (beforeLocation.trackId !== afterLocation.trackId) {
      changes.push({
        type: "move_clip_to_track",
        clipId,
        fromTrackId: beforeLocation.trackId,
        trackId: afterLocation.trackId,
        fromIndex: beforeLocation.index,
        toIndex: afterLocation.index,
      });
    }
  }

  for (const beforeTrack of getVideoTracks(before)) {
    const afterTrack = afterVideoTracks.get(beforeTrack.id);
    if (!afterTrack) continue;
    const beforeIds = beforeTrack.clips
      .map((clip) => clip.id)
      .filter((clipId) => beforeLocations.get(clipId)?.trackId === afterLocations.get(clipId)?.trackId);
    const afterIds = afterTrack.clips
      .map((clip) => clip.id)
      .filter((clipId) => beforeLocations.get(clipId)?.trackId === afterLocations.get(clipId)?.trackId);
    const move = inferSingleSameTrackMove(beforeIds, afterIds);
    if (move) {
      changes.push({
        type: "move_clip",
        clipId: move.clipId,
        trackId: beforeTrack.id,
        fromIndex: move.fromIndex,
        toIndex: move.toIndex,
      });
    }
  }

  for (const clipId of commonClipIds) {
    const beforeLocation = beforeLocations.get(clipId)!;
    const afterLocation = afterLocations.get(clipId)!;
    const beforeClip = beforeLocation.clip;
    const afterClip = afterLocation.clip;

    if (
      beforeLocation.assetKind === "video"
      && beforeClip.playbackRate !== afterClip.playbackRate
    ) {
      changes.push({
        type: "set_clip_speed",
        clipId,
        beforePlaybackRate: beforeClip.playbackRate,
        playbackRate: afterClip.playbackRate,
      });
    }

    if (beforeLocation.assetKind === "image") {
      const beforeDurationUs = clipDurationUs(beforeClip);
      const durationUs = clipDurationUs(afterClip);
      if (beforeDurationUs !== durationUs) {
        changes.push({
          type: "set_still_duration",
          clipId,
          beforeDurationUs,
          durationUs,
        });
      }
    }

    if (beforeClip.fadeInUs !== afterClip.fadeInUs || beforeClip.fadeOutUs !== afterClip.fadeOutUs) {
      changes.push({
        type: "set_clip_fade",
        clipId,
        beforeFadeInUs: beforeClip.fadeInUs,
        beforeFadeOutUs: beforeClip.fadeOutUs,
        fadeInUs: afterClip.fadeInUs,
        fadeOutUs: afterClip.fadeOutUs,
      });
    }
  }

  return changes;
}

export function operationToEditorCommand(
  state: EditorState,
  operation: EditPlanOperation,
): EditorCommand {
  switch (operation.type) {
    case "add_visual_clip": {
      const asset = state.assets.find((candidate) => candidate.id === operation.assetId);
      if (!asset) throw new Error("The requested asset was not found.");
      if (asset.kind !== "video" && asset.kind !== "image") {
        throw new Error("The selected asset is not a visual asset.");
      }
      const sourceOutUs = asset.kind === "image"
        ? operation.durationUs ?? asset.durationUs
        : asset.durationUs;
      return {
        type: "addClip",
        trackId: operation.trackId,
        ...(operation.toIndex === undefined ? {} : { atIndex: operation.toIndex }),
        clip: {
          id: operation.clipId,
          assetId: operation.assetId,
          sourceInUs: 0,
          sourceOutUs,
          playbackRate: asset.kind === "image" ? 1 : operation.playbackRate ?? 1,
          fadeInUs: operation.fadeInUs ?? 0,
          fadeOutUs: operation.fadeOutUs ?? 0,
        },
      };
    }
    case "set_canvas":
      return {
        type: "setCanvas",
        preset: operation.preset,
        fitMode: operation.fitMode ?? state.canvas.fitMode,
      };
    case "set_track_opacity":
      return { type: "setTrackOpacity", trackId: operation.trackId, opacity: operation.opacity };
    case "set_track_visibility":
      return { type: "setTrackVisibility", trackId: operation.trackId, visible: operation.visible };
    case "set_track_mute":
      return { type: "setTrackMute", trackId: operation.trackId, muted: operation.muted };
    case "move_clip":
      return { type: "moveClip", clipId: operation.clipId, toIndex: operation.toIndex };
    case "move_clip_to_track":
      return {
        type: "moveClipToTrack",
        clipId: operation.clipId,
        trackId: operation.trackId,
        ...(operation.toIndex === undefined ? {} : { toIndex: operation.toIndex }),
      };
    case "trim_clip":
      return {
        type: "trimClip",
        clipId: operation.clipId,
        sourceInUs: operation.sourceInUs,
        sourceOutUs: operation.sourceOutUs,
      };
    case "set_clip_speed":
      return { type: "setClipSpeed", clipId: operation.clipId, playbackRate: operation.playbackRate };
    case "set_still_duration":
      return { type: "setClipDuration", clipId: operation.clipId, durationUs: operation.durationUs };
    case "set_clip_fade":
      return {
        type: "setClipFade",
        clipId: operation.clipId,
        fadeInUs: operation.fadeInUs,
        fadeOutUs: operation.fadeOutUs,
      };
  }
}

export function simulateEditPlan(state: EditorState, operations: readonly EditPlanOperation[]): EditorState {
  return operations.reduce(
    (nextState, operation) => executeCommand(nextState, operationToEditorCommand(nextState, operation)),
    state,
  );
}

function trackName(state: EditorState, trackId: string): string {
  return state.tracks.find((track) => track.id === trackId)?.name ?? trackId;
}

function assetName(state: EditorState, assetId: string): string {
  return state.assets.find((asset) => asset.id === assetId)?.name ?? assetId;
}

function clipName(state: EditorState, clipId: string): string {
  for (const track of state.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (!clip) continue;
    return assetName(state, clip.assetId);
  }
  return clipId;
}

export function describeEditPlanOperation(state: EditorState, operation: EditPlanOperation): string {
  switch (operation.type) {
    case "add_visual_clip": {
      const timing = operation.durationUs === undefined ? "" : ` · ${(operation.durationUs / 1_000_000).toFixed(2)}s still`;
      const fades = operation.fadeInUs || operation.fadeOutUs
        ? ` · fades ${((operation.fadeInUs ?? 0) / 1_000_000).toFixed(2)}s/${((operation.fadeOutUs ?? 0) / 1_000_000).toFixed(2)}s`
        : "";
      return `Add ${assetName(state, operation.assetId)} to ${trackName(state, operation.trackId)}${timing}${fades}`;
    }
    case "set_canvas":
      return `Set canvas to ${CANVAS_PRESETS[operation.preset].label}${operation.fitMode ? ` · ${operation.fitMode}` : ""}`;
    case "set_track_opacity":
      return `Set ${trackName(state, operation.trackId)} opacity to ${Math.round(operation.opacity * 100)}%`;
    case "set_track_visibility":
      return `${operation.visible ? "Show" : "Hide"} ${trackName(state, operation.trackId)}`;
    case "set_track_mute":
      return `${operation.muted ? "Mute" : "Unmute"} ${trackName(state, operation.trackId)}`;
    case "move_clip":
      return `Move ${clipName(state, operation.clipId)} to position ${operation.toIndex + 1}`;
    case "move_clip_to_track":
      return `Move ${clipName(state, operation.clipId)} to ${trackName(state, operation.trackId)}${operation.toIndex === undefined ? "" : ` at position ${operation.toIndex + 1}`}`;
    case "trim_clip":
      return `Trim ${clipName(state, operation.clipId)} to ${(operation.sourceInUs / 1_000_000).toFixed(2)}s–${(operation.sourceOutUs / 1_000_000).toFixed(2)}s`;
    case "set_clip_speed":
      return `Set ${clipName(state, operation.clipId)} speed to ${operation.playbackRate}×`;
    case "set_still_duration":
      return `Set ${clipName(state, operation.clipId)} still duration to ${(operation.durationUs / 1_000_000).toFixed(2)}s`;
    case "set_clip_fade":
      return `Set ${clipName(state, operation.clipId)} fades to ${(operation.fadeInUs / 1_000_000).toFixed(2)}s in / ${(operation.fadeOutUs / 1_000_000).toFixed(2)}s out`;
  }
}

export function describeHumanDemonstrationChange(state: EditorState, change: HumanDemonstrationChange): string {
  switch (change.type) {
    case "add_visual_clip": {
      const timing = change.durationUs === undefined ? "" : ` · ${(change.durationUs / 1_000_000).toFixed(2)}s still`;
      const speed = change.assetKind === "video" && change.playbackRate !== 1 ? ` · ${change.playbackRate}×` : "";
      const fades = change.fadeInUs || change.fadeOutUs
        ? ` · fades ${(change.fadeInUs / 1_000_000).toFixed(2)}s/${(change.fadeOutUs / 1_000_000).toFixed(2)}s`
        : "";
      return `Added ${assetName(state, change.assetId)} to ${trackName(state, change.trackId)} at position ${change.toIndex + 1}${timing}${speed}${fades}`;
    }
    case "set_canvas":
      return `Canvas: ${CANVAS_PRESETS[change.beforePreset].label} · ${change.beforeFitMode} → ${CANVAS_PRESETS[change.preset].label} · ${change.fitMode}`;
    case "set_track_opacity":
      return `${trackName(state, change.trackId)} opacity: ${Math.round(change.beforeOpacity * 100)}% → ${Math.round(change.opacity * 100)}%`;
    case "set_track_visibility":
      return `${trackName(state, change.trackId)}: ${change.beforeVisible ? "visible" : "hidden"} → ${change.visible ? "visible" : "hidden"}`;
    case "set_track_mute":
      return `${trackName(state, change.trackId)}: ${change.beforeMuted ? "muted" : "audible"} → ${change.muted ? "muted" : "audible"}`;
    case "move_clip":
      return `${clipName(state, change.clipId)}: position ${change.fromIndex + 1} → ${change.toIndex + 1} on ${trackName(state, change.trackId)}`;
    case "move_clip_to_track":
      return `${clipName(state, change.clipId)}: ${trackName(state, change.fromTrackId)} → ${trackName(state, change.trackId)}`;
    case "set_clip_speed":
      return `${clipName(state, change.clipId)} speed: ${change.beforePlaybackRate}× → ${change.playbackRate}×`;
    case "set_still_duration":
      return `${clipName(state, change.clipId)} duration: ${(change.beforeDurationUs / 1_000_000).toFixed(2)}s → ${(change.durationUs / 1_000_000).toFixed(2)}s`;
    case "set_clip_fade":
      return `${clipName(state, change.clipId)} fades: ${(change.beforeFadeInUs / 1_000_000).toFixed(2)}s/${(change.beforeFadeOutUs / 1_000_000).toFixed(2)}s → ${(change.fadeInUs / 1_000_000).toFixed(2)}s/${(change.fadeOutUs / 1_000_000).toFixed(2)}s`;
  }
}

export function isSupportedPlaybackRate(value: number): value is PlaybackRate {
  return (PLAYBACK_RATES as readonly number[]).includes(value);
}

export function isSupportedFadeDuration(value: number): boolean {
  return (FADE_DURATIONS_US as readonly number[]).includes(value);
}
