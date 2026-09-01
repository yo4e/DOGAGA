import {
  allVideoClips,
  clipDurationUs,
  clipFadeOpacityAt,
  getVideoTracks,
  sourceTimeUsAt,
  timelineDurationUs,
  type CanvasFitMode,
  type EditorState,
  type VideoClip,
} from "../editor/model";

export type ExportVideoLayer = {
  trackId: string;
  clipId: string;
  assetId: string;
  sourceTimeUs: number;
  opacity: number;
};

export type DrawRegion = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
};

export type RecorderFormat = {
  mimeType: string;
  extension: "mp4" | "webm";
};

const RECORDER_FORMATS: readonly RecorderFormat[] = [
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

function clipEndUs(clip: VideoClip): number {
  return clip.timelineStartUs + clipDurationUs(clip);
}

function transitionOpacityAt(state: EditorState, clip: VideoClip, timelineUs: number): number {
  const clips = allVideoClips(state);
  for (const transition of state.transitions) {
    const to = clips.find((candidate) => candidate.id === transition.toClipId);
    if (!to) continue;

    const startUs = to.timelineStartUs;
    const endUs = startUs + transition.durationUs;
    if (timelineUs < startUs || timelineUs > endUs) continue;

    const progress = Math.min(1, Math.max(0, (timelineUs - startUs) / transition.durationUs));
    if (clip.id === transition.fromClipId) return 1 - progress;
    if (clip.id === transition.toClipId) return progress;
  }

  return 1;
}

function opacityAt(
  state: EditorState,
  clip: VideoClip,
  trackOpacity: number,
  timelineUs: number,
): number {
  return trackOpacity * transitionOpacityAt(state, clip, timelineUs) * clipFadeOpacityAt(clip, timelineUs);
}

export function exportDurationUs(state: EditorState): number {
  return timelineDurationUs(state);
}

export function videoLayersAt(state: EditorState, timelineUs: number): ExportVideoLayer[] {
  if (!Number.isFinite(timelineUs) || timelineUs < 0) return [];

  return getVideoTracks(state).flatMap((track) => {
    if (!track.visible || track.opacity <= 0) return [];
    return track.clips
      .filter((clip) => timelineUs >= clip.timelineStartUs && timelineUs < clipEndUs(clip))
      .map((clip) => ({
        trackId: track.id,
        clipId: clip.id,
        assetId: clip.assetId,
        sourceTimeUs: sourceTimeUsAt(clip, timelineUs),
        opacity: opacityAt(state, clip, track.opacity, timelineUs),
      }));
  });
}

export function computeDrawRegion(
  sourceWidth: number,
  sourceHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  fitMode: CanvasFitMode,
): DrawRegion {
  if (
    sourceWidth <= 0 || sourceHeight <= 0 ||
    canvasWidth <= 0 || canvasHeight <= 0 ||
    !Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) ||
    !Number.isFinite(canvasWidth) || !Number.isFinite(canvasHeight)
  ) {
    throw new Error("Video or canvas dimensions are invalid");
  }

  if (fitMode === "contain") {
    const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
    const dw = sourceWidth * scale;
    const dh = sourceHeight * scale;
    return {
      sx: 0,
      sy: 0,
      sw: sourceWidth,
      sh: sourceHeight,
      dx: (canvasWidth - dw) / 2,
      dy: (canvasHeight - dh) / 2,
      dw,
      dh,
    };
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  if (sourceAspect > canvasAspect) {
    const sw = sourceHeight * canvasAspect;
    return {
      sx: (sourceWidth - sw) / 2,
      sy: 0,
      sw,
      sh: sourceHeight,
      dx: 0,
      dy: 0,
      dw: canvasWidth,
      dh: canvasHeight,
    };
  }

  const sh = sourceWidth / canvasAspect;
  return {
    sx: 0,
    sy: (sourceHeight - sh) / 2,
    sw: sourceWidth,
    sh,
    dx: 0,
    dy: 0,
    dw: canvasWidth,
    dh: canvasHeight,
  };
}

export function pickRecorderFormat(isTypeSupported: (mimeType: string) => boolean): RecorderFormat | null {
  return RECORDER_FORMATS.find((format) => isTypeSupported(format.mimeType)) ?? null;
}
