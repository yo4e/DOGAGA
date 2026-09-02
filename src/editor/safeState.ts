import {
  getAudioTracks,
  getDefaultAudioTrack,
  getVideoTracks,
  timelineDurationUs,
  type AssetKind,
  type CanvasSettings,
  type EditorState,
} from "./model";

export type SafeVideoClip = {
  id: string;
  assetId: string;
  timelineStartUs: number;
  sourceInUs: number;
  sourceOutUs: number;
  playbackRate: number;
  fadeInUs: number;
  fadeOutUs: number;
};

export type SafeAudioClip = {
  id: string;
  assetId: string;
  timelineStartUs: number;
  sourceInUs: number;
  sourceOutUs: number;
  volume: number;
};

export type SafeEditorTrack =
  | {
      id: string;
      kind: "video";
      name: string;
      order: number;
      visible: boolean;
      locked: boolean;
      opacity: number;
      clips: SafeVideoClip[];
    }
  | {
      id: string;
      kind: "audio";
      name: string;
      order: number;
      muted: boolean;
      locked: boolean;
      clips: SafeAudioClip[];
    };

export type SafeEditorState = {
  canvas: CanvasSettings;
  assets: Array<{
    id: string;
    kind: AssetKind;
    name: string;
    durationUs: number;
    width?: number;
    height?: number;
  }>;
  tracks: SafeEditorTrack[];
  videoClips: Array<SafeVideoClip & { trackId: string }>;
  audioClips: Array<SafeAudioClip & { trackId: string }>;
  audioClip: null | (SafeAudioClip & { trackId: string });
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

function safeVideoClip({
  id,
  assetId,
  timelineStartUs,
  sourceInUs,
  sourceOutUs,
  playbackRate,
  fadeInUs,
  fadeOutUs,
}: SafeVideoClip): SafeVideoClip {
  return { id, assetId, timelineStartUs, sourceInUs, sourceOutUs, playbackRate, fadeInUs, fadeOutUs };
}

function safeAudioClip({
  id,
  assetId,
  timelineStartUs,
  sourceInUs,
  sourceOutUs,
  volume,
}: SafeAudioClip): SafeAudioClip {
  return { id, assetId, timelineStartUs, sourceInUs, sourceOutUs, volume };
}

export function toSafeEditorState(state: EditorState): SafeEditorState {
  const videoTracks = getVideoTracks(state);
  const audioTracks = getAudioTracks(state);
  const defaultAudio = getDefaultAudioTrack(state)?.clips[0] ?? null;

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
    tracks: [
      ...videoTracks.map((track) => ({
        id: track.id,
        kind: "video" as const,
        name: track.name,
        order: track.order,
        visible: track.visible,
        locked: track.locked,
        opacity: track.opacity,
        clips: track.clips.map((clip) => safeVideoClip(clip)),
      })),
      ...audioTracks.map((track) => ({
        id: track.id,
        kind: "audio" as const,
        name: track.name,
        order: track.order,
        muted: track.muted,
        locked: track.locked,
        clips: track.clips.map((clip) => safeAudioClip(clip)),
      })),
    ],
    videoClips: videoTracks.flatMap((track) =>
      track.clips.map((clip) => ({ ...safeVideoClip(clip), trackId: track.id })),
    ),
    audioClips: audioTracks.flatMap((track) =>
      track.clips.map((clip) => ({ ...safeAudioClip(clip), trackId: track.id })),
    ),
    audioClip: defaultAudio
      ? {
          ...safeAudioClip(defaultAudio),
          trackId: getDefaultAudioTrack(state)!.id,
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
