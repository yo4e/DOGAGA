export type AssetId = string;
export type ClipId = string;
export type TransitionId = string;

export type AssetKind = "video" | "audio";

export const CANVAS_PRESETS = {
  landscape: { label: "横 16:9", width: 1920, height: 1080 },
  portrait: { label: "縦 9:16", width: 1080, height: 1920 },
  square: { label: "正方形 1:1", width: 1080, height: 1080 },
  portraitFourFive: { label: "縦 4:5", width: 1080, height: 1350 },
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
  videoClips: VideoClip[];
  audioClip: AudioClip | null;
  transitions: Transition[];
  playheadUs: number;
};

export type VideoClipDraft = Omit<VideoClip, "timelineStartUs" | "playbackRate" | "fadeInUs" | "fadeOutUs"> & {
  playbackRate?: number;
  fadeInUs?: number;
  fadeOutUs?: number;
};

export type EditorCommand =
  | { type: "addClip"; clip: VideoClipDraft; atIndex?: number }
  | { type: "moveClip"; clipId: ClipId; toIndex: number }
  | { type: "trimClip"; clipId: ClipId; sourceInUs: number; sourceOutUs: number }
  | { type: "splitClip"; clipId: ClipId; atTimelineUs: number; newClipId: ClipId }
  | { type: "setClipSpeed"; clipId: ClipId; playbackRate: number }
  | { type: "setClipFade"; clipId: ClipId; fadeInUs: number; fadeOutUs: number }
  | { type: "deleteClip"; clipId: ClipId }
  | { type: "setAudio"; audio: AudioClip | null }
  | { type: "setCanvas"; preset: CanvasPresetId; fitMode: CanvasFitMode }
  | { type: "addTransition"; transition: Transition }
  | { type: "removeTransition"; transitionId: TransitionId };

export function createCanvasSettings(
  preset: CanvasPresetId,
  fitMode: CanvasFitMode,
): CanvasSettings {
  const { width, height } = CANVAS_PRESETS[preset];
  return { preset, width, height, fitMode };
}

export function createEmptyEditorState(): EditorState {
  return {
    canvas: createCanvasSettings("landscape", "contain"),
    assets: [],
    videoClips: [],
    audioClip: null,
    transitions: [],
    playheadUs: 0,
  };
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
  const videoEnd = state.videoClips.reduce(
    (max, clip) => Math.max(max, clip.timelineStartUs + clipDurationUs(clip)),
    0,
  );
  const audioEnd = state.audioClip
    ? state.audioClip.timelineStartUs + (state.audioClip.sourceOutUs - state.audioClip.sourceInUs)
    : 0;
  return Math.max(videoEnd, audioEnd);
}
