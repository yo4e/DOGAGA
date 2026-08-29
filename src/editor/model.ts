export type AssetId = string;
export type ClipId = string;
export type TransitionId = string;

export type AssetKind = "video" | "audio";

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
  | { type: "deleteClip"; clipId: ClipId }
  | { type: "setAudio"; audio: AudioClip | null }
  | { type: "addTransition"; transition: Transition };

export function createEmptyEditorState(): EditorState {
  return {
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
  const videoEnd = state.videoClips.at(-1)
    ? state.videoClips.at(-1)!.timelineStartUs + clipDurationUs(state.videoClips.at(-1)!)
    : 0;
  const audioEnd = state.audioClip
    ? state.audioClip.timelineStartUs + (state.audioClip.sourceOutUs - state.audioClip.sourceInUs)
    : 0;
  return Math.max(videoEnd, audioEnd);
}
