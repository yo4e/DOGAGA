import { timelineDurationUs, type CanvasSettings, type EditorState } from "./model";

export type SafeEditorState = {
  canvas: CanvasSettings;
  assets: Array<{
    id: string;
    kind: "video" | "audio";
    name: string;
    durationUs: number;
    width?: number;
    height?: number;
  }>;
  videoClips: Array<{
    id: string;
    assetId: string;
    timelineStartUs: number;
    sourceInUs: number;
    sourceOutUs: number;
    playbackRate: number;
    fadeInUs: number;
    fadeOutUs: number;
  }>;
  audioClip: null | {
    id: string;
    assetId: string;
    timelineStartUs: number;
    sourceInUs: number;
    sourceOutUs: number;
    volume: number;
  };
  transitions: Array<{
    id: string;
    kind: "cross-dissolve";
    fromClipId: string;
    toClipId: string;
    durationUs: number;
  }>;
  playheadUs: number;
  durationUs: number;
};

export function toSafeEditorState(state: EditorState): SafeEditorState {
  return {
    canvas: { ...state.canvas },
    assets: state.assets.map(({ id, kind, name, durationUs, width, height }) => ({
      id,
      kind,
      name,
      durationUs,
      ...(width === undefined ? {} : { width }),
      ...(height === undefined ? {} : { height }),
    })),
    videoClips: state.videoClips.map(
      ({ id, assetId, timelineStartUs, sourceInUs, sourceOutUs, playbackRate, fadeInUs, fadeOutUs }) => ({
        id,
        assetId,
        timelineStartUs,
        sourceInUs,
        sourceOutUs,
        playbackRate,
        fadeInUs,
        fadeOutUs,
      }),
    ),
    audioClip: state.audioClip
      ? {
          id: state.audioClip.id,
          assetId: state.audioClip.assetId,
          timelineStartUs: state.audioClip.timelineStartUs,
          sourceInUs: state.audioClip.sourceInUs,
          sourceOutUs: state.audioClip.sourceOutUs,
          volume: state.audioClip.volume,
        }
      : null,
    transitions: state.transitions.map(
      ({ id, kind, fromClipId, toClipId, durationUs }) => ({
        id,
        kind,
        fromClipId,
        toClipId,
        durationUs,
      }),
    ),
    playheadUs: state.playheadUs,
    durationUs: timelineDurationUs(state),
  };
}
