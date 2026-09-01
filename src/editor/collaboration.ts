import { executeCommand } from "./executor";
import {
  CANVAS_PRESETS,
  FADE_DURATIONS_US,
  PLAYBACK_RATES,
  type CanvasFitMode,
  type CanvasPresetId,
  type EditorCommand,
  type EditorState,
  type PlaybackRate,
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
  | { type: "set_canvas"; preset: CanvasPresetId; fitMode?: CanvasFitMode }
  | { type: "set_track_opacity"; trackId: string; opacity: number }
  | { type: "set_track_visibility"; trackId: string; visible: boolean }
  | { type: "set_track_mute"; trackId: string; muted: boolean }
  | { type: "move_clip"; clipId: string; toIndex: number }
  | { type: "move_clip_to_track"; clipId: string; trackId: string; toIndex?: number }
  | { type: "trim_clip"; clipId: string; sourceInUs: number; sourceOutUs: number }
  | { type: "set_clip_speed"; clipId: string; playbackRate: PlaybackRate }
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

export type CollaborationState = {
  projectBrief: ProjectBrief;
  editPlan: AgentEditPlan | null;
};

export function createEmptyCollaborationState(): CollaborationState {
  return {
    projectBrief: { destination: "general", goal: "general" },
    editPlan: null,
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

export function operationToEditorCommand(
  state: EditorState,
  operation: EditPlanOperation,
): EditorCommand {
  switch (operation.type) {
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

function clipName(state: EditorState, clipId: string): string {
  for (const track of state.tracks) {
    const clip = track.clips.find((candidate) => candidate.id === clipId);
    if (!clip) continue;
    return state.assets.find((asset) => asset.id === clip.assetId)?.name ?? clipId;
  }
  return clipId;
}

export function describeEditPlanOperation(state: EditorState, operation: EditPlanOperation): string {
  switch (operation.type) {
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
    case "set_clip_fade":
      return `Set ${clipName(state, operation.clipId)} fades to ${(operation.fadeInUs / 1_000_000).toFixed(2)}s in / ${(operation.fadeOutUs / 1_000_000).toFixed(2)}s out`;
  }
}

export function isSupportedPlaybackRate(value: number): value is PlaybackRate {
  return (PLAYBACK_RATES as readonly number[]).includes(value);
}

export function isSupportedFadeDuration(value: number): boolean {
  return (FADE_DURATIONS_US as readonly number[]).includes(value);
}
