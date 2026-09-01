export type AssetId = string;
export type ClipId = string;
export type TrackId = string;
export type TransitionId = string;

export type AssetKind = "video" | "audio" | "image";
export type TrackKind = "video" | "audio";

export const DEFAULT_VIDEO_TRACK_ID = "video-1";
export const DEFAULT_AUDIO_TRACK_ID = "audio-1";
export const IMAGE_DEFAULT_DURATION_US = 5_000_000;
export const IMAGE_MIN_DURATION_US = 100_000;
export const IMAGE_MAX_DURATION_US = 600_000_000;

export const CANVAS_PRESETS = {
  landscape: { label: "Landscape 16:9", width: 1920, height: 1080 },
  portrait: { label: "Portrait 9:16", width: 1080, height: 1920 },
  square: { label: "Square 1:1", width: 1080, height: 1080 },
  portraitFourFive: { label: "Portrait 4:5", width: 1080, height: 1350 },
} as const;

export const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export const FADE_DURATIONS_US = [0, 250_000, 500_000, 1_000_000, 2_000_000] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

export type CanvasPresetId = keyof typeof CANVAS_PRESETS;
export type CanvasFitMode = "contain" | "cover";

export type CanvasSettings = {
  preset: CanvasPresetId;
  width: number;
  height: number;
  fitMode: CanvasFitMode;
};

export type AssetDescriptor = {
  id: AssetId;
  kind: AssetKind;
  name: string;
  durationUs: number;
  width?: number;
  height?: number;
};

/**
 * V-track clips use one compact representation for both moving video and still images.
 * For image assets, sourceInUs is always 0, sourceOutUs is the display duration,
 * and playbackRate is always 1. Image duration is changed through setClipDuration.
 */
export type VideoClip = {
  id: ClipId;
  assetId: AssetId;
  timelineStartUs: number;
  sourceInUs: number;
  sourceOutUs: number;
  playbackRate: number;
  fadeInUs: number;
  fadeOutUs: number;
};

export type AudioClip = {
  id: ClipId;
  assetId: AssetId;
  timelineStartUs: number;
  sourceInUs: number;
  sourceOutUs: number;
  volume: number;
};

export type VideoTrack = {
  id: TrackId;
  kind: "video";
  name: string;
  order: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  clips: VideoClip[];
};

export type AudioTrack = {
  id: TrackId;
  kind: "audio";
  name: string;
  order: number;
  muted: boolean;
  locked: boolean;
  clips: AudioClip[];
};

export type EditorTrack = VideoTrack | AudioTrack;

export type Transition = {
  id: TransitionId;
  kind: "cross-dissolve";
  fromClipId: ClipId;
  toClipId: ClipId;
  durationUs: number;
};

export type EditorState = {
  canvas: CanvasSettings;
  assets: AssetDescriptor[];
  tracks: EditorTrack[];
  transitions: Transition[];
  playheadUs: number;
};

export type VideoClipDraft = Omit<VideoClip, "timelineStartUs" | "playbackRate" | "fadeInUs" | "fadeOutUs"> & {
  playbackRate?: number;
  fadeInUs?: number;
  fadeOutUs?: number;
};

export type TrackDraft =
  | { id: TrackId; kind: "video"; name: string }
  | { id: TrackId; kind: "audio"; name: string };

export type EditorCommand =
  | { type: "addTrack"; track: TrackDraft }
  | { type: "removeTrack"; trackId: TrackId }
  | { type: "moveTrack"; trackId: TrackId; toIndex: number }
  | { type: "setTrackOpacity"; trackId: TrackId; opacity: number }
  | { type: "setTrackVisibility"; trackId: TrackId; visible: boolean }
  | { type: "setTrackMute"; trackId: TrackId; muted: boolean }
  | { type: "addClip"; clip: VideoClipDraft; atIndex?: number; trackId?: TrackId }
  | { type: "moveClip"; clipId: ClipId; toIndex: number }
  | { type: "moveClipToTrack"; clipId: ClipId; trackId: TrackId; toIndex?: number }
  | { type: "trimClip"; clipId: ClipId; sourceInUs: number; sourceOutUs: number }
  | { type: "splitClip"; clipId: ClipId; atTimelineUs: number; newClipId: ClipId }
  | { type: "setClipSpeed"; clipId: ClipId; playbackRate: number }
  | { type: "setClipDuration"; clipId: ClipId; durationUs: number }
  | { type: "setClipFade"; clipId: ClipId; fadeInUs: number; fadeOutUs: number }
  | { type: "deleteClip"; clipId: ClipId }
  | { type: "setAudio"; audio: AudioClip | null; trackId?: TrackId }
  | { type: "setCanvas"; preset: CanvasPresetId; fitMode: CanvasFitMode }
  | { type: "addTransition"; transition: Transition }
  | { type: "removeTransition"; transitionId: TransitionId };

export type VideoClipLocation = {
  track: VideoTrack;
  trackIndex: number;
  clip: VideoClip;
  clipIndex: number;
};

export type AudioClipLocation = {
  track: AudioTrack;
  trackIndex: number;
  clip: AudioClip;
  clipIndex: number;
};

export function createCanvasSettings(
  preset: CanvasPresetId,
  fitMode: CanvasFitMode,
): CanvasSettings {
  const { width, height } = CANVAS_PRESETS[preset];
  return { preset, width, height, fitMode };
}

export function createVideoTrack(
  id: TrackId,
  name: string,
  order: number,
): VideoTrack {
  return {
    id,
    kind: "video",
    name,
    order,
    visible: true,
    locked: false,
    opacity: 1,
    clips: [],
  };
}

export function createAudioTrack(
  id: TrackId,
  name: string,
  order: number,
): AudioTrack {
  return {
    id,
    kind: "audio",
    name,
    order,
    muted: false,
    locked: false,
    clips: [],
  };
}

export function createEmptyEditorState(): EditorState {
  return {
    canvas: createCanvasSettings("landscape", "contain"),
    assets: [],
    tracks: [
      createVideoTrack(DEFAULT_VIDEO_TRACK_ID, "V1", 0),
      createAudioTrack(DEFAULT_AUDIO_TRACK_ID, "A1", 0),
    ],
    transitions: [],
    playheadUs: 0,
  };
}

export function getVideoTracks(state: EditorState): VideoTrack[] {
  return state.tracks
    .filter((track): track is VideoTrack => track.kind === "video")
    .sort((a, b) => a.order - b.order);
}

export function getAudioTracks(state: EditorState): AudioTrack[] {
  return state.tracks
    .filter((track): track is AudioTrack => track.kind === "audio")
    .sort((a, b) => a.order - b.order);
}

export function getDefaultVideoTrack(state: EditorState): VideoTrack | undefined {
  return state.tracks.find(
    (track): track is VideoTrack => track.kind === "video" && track.id === DEFAULT_VIDEO_TRACK_ID,
  ) ?? getVideoTracks(state)[0];
}

export function getDefaultAudioTrack(state: EditorState): AudioTrack | undefined {
  return state.tracks.find(
    (track): track is AudioTrack => track.kind === "audio" && track.id === DEFAULT_AUDIO_TRACK_ID,
  ) ?? getAudioTracks(state)[0];
}

export function allVideoClips(state: EditorState): VideoClip[] {
  return getVideoTracks(state).flatMap((track) => track.clips);
}

export function allAudioClips(state: EditorState): AudioClip[] {
  return getAudioTracks(state).flatMap((track) => track.clips);
}

export function findVideoClipLocation(state: EditorState, clipId: ClipId): VideoClipLocation | undefined {
  for (let trackIndex = 0; trackIndex < state.tracks.length; trackIndex += 1) {
    const track = state.tracks[trackIndex];
    if (track.kind !== "video") continue;
    const clipIndex = track.clips.findIndex((clip) => clip.id === clipId);
    if (clipIndex >= 0) {
      return { track, trackIndex, clip: track.clips[clipIndex], clipIndex };
    }
  }
  return undefined;
}

export function findAudioClipLocation(state: EditorState, clipId: ClipId): AudioClipLocation | undefined {
  for (let trackIndex = 0; trackIndex < state.tracks.length; trackIndex += 1) {
    const track = state.tracks[trackIndex];
    if (track.kind !== "audio") continue;
    const clipIndex = track.clips.findIndex((clip) => clip.id === clipId);
    if (clipIndex >= 0) {
      return { track, trackIndex, clip: track.clips[clipIndex], clipIndex };
    }
  }
  return undefined;
}

export function assetForClip(state: EditorState, clip: Pick<VideoClip, "assetId">): AssetDescriptor | undefined {
  return state.assets.find((asset) => asset.id === clip.assetId);
}

export function isImageClip(state: EditorState, clip: Pick<VideoClip, "assetId">): boolean {
  return assetForClip(state, clip)?.kind === "image";
}

export function clipDurationUs(
  clip: Pick<VideoClip, "sourceInUs" | "sourceOutUs" | "playbackRate">,
): number {
  const sourceDurationUs = clip.sourceOutUs - clip.sourceInUs;
  return Math.max(1, Math.round(sourceDurationUs / clip.playbackRate));
}

export function sourceTimeUsAt(clip: VideoClip, timelineUs: number): number {
  const timelineOffsetUs = Math.max(
    0,
    Math.min(clipDurationUs(clip), timelineUs - clip.timelineStartUs),
  );
  return Math.min(
    clip.sourceOutUs,
    Math.max(clip.sourceInUs, clip.sourceInUs + Math.round(timelineOffsetUs * clip.playbackRate)),
  );
}

export function clipFadeOpacityAt(clip: VideoClip, timelineUs: number): number {
  const durationUs = clipDurationUs(clip);
  const offsetUs = timelineUs - clip.timelineStartUs;
  if (offsetUs < 0 || offsetUs > durationUs) return 0;

  const fadeInOpacity = clip.fadeInUs > 0 ? Math.min(1, Math.max(0, offsetUs / clip.fadeInUs)) : 1;
  const remainingUs = durationUs - offsetUs;
  const fadeOutOpacity = clip.fadeOutUs > 0 ? Math.min(1, Math.max(0, remainingUs / clip.fadeOutUs)) : 1;
  return Math.min(fadeInOpacity, fadeOutOpacity);
}

export function timelineDurationUs(state: EditorState): number {
  const videoEnd = getVideoTracks(state).reduce(
    (trackMax, track) => Math.max(
      trackMax,
      track.clips.reduce(
        (clipMax, clip) => Math.max(clipMax, clip.timelineStartUs + clipDurationUs(clip)),
        0,
      ),
    ),
    0,
  );
  const audioEnd = getAudioTracks(state).reduce(
    (trackMax, track) => Math.max(
      trackMax,
      track.clips.reduce(
        (clipMax, clip) => Math.max(clipMax, clip.timelineStartUs + (clip.sourceOutUs - clip.sourceInUs)),
        0,
      ),
    ),
    0,
  );
  return Math.max(videoEnd, audioEnd);
}
