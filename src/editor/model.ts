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

export type VideoClipDraft = Omit<VideoClip, "timelineStartUs">;

export type EditorCommand =
  | { type: "addClip"; clip: VideoClipDraft; atIndex?: number }
  | { type: "moveClip"; clipId: ClipId; toIndex: number }
  | { type: "trimClip"; clipId: ClipId; sourceInUs: number; sourceOutUs: number }
  | { type: "splitClip"; clipId: ClipId; atTimelineUs: number; newClipId: ClipId }
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

export function clipDurationUs(clip: Pick<VideoClip, "sourceInUs" | "sourceOutUs">): number {
  return clip.sourceOutUs - clip.sourceInUs;
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
